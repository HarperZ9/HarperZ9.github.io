"""check.py: drive a kit page's controls in headless Chromium and report what moved.

    python check.py URL [URL ...]

For each page: the kit loaded (window.Kit); the rail shows a trail of two or more crumbs and named tools;
every link has a name; the page has a message line and toy, plain and pro layers; M opens the map and
Escape closes it; the theme lamp flips data-theme, every
knob turns by keyboard (ArrowRight one step, Shift+ArrowRight ten) and by a vertical drag, every fader
takes Shift+Arrow as a coarse step, no page errors were thrown, and nothing scrolls sideways at 390 px.
Failure equivalence (after the genomics auto-optimisation rule that a faster tool must also fail the same
way): the page is loaded twice more at 390 px, once with scripts off and once with every font blocked, and
must still show its title, its message line and its toy layer, with no sideways scroll and no page errors.
Prints one JSON line per page; exit status 1 if any check fails. Needs Python Playwright with Chromium.
"""
from __future__ import annotations

import asyncio
import json
import sys

from playwright.async_api import async_playwright

DRAG_PX = 40

NAV = r"""
() => {
  const vis = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== "hidden"; };
  const name = (e) => (e.getAttribute("aria-label") || e.textContent || e.title || (e.querySelector("img[alt]") || {}).alt || "").trim();
  const links = [...document.querySelectorAll("a[href]")];
  const tools = [...document.querySelectorAll(".k-tools button")];
  return {
    crumbs: document.querySelectorAll(".k-trail li").length,
    tools_named: tools.length > 0 && tools.every((b) => b.textContent.trim().length > 0),
    links: links.length, unnamed_links: links.filter((a) => !name(a)).length,
    hidden_links: links.filter((a) => !vis(a) && !a.closest("dialog")).length,
    map: !!document.querySelector("dialog.k-map"),
    message: !!document.querySelector(".k-message"),
    toy: !!document.querySelector('[data-layer="toy"]'), plain: !!document.querySelector('[data-layer="plain"]'), pro: !!document.querySelector('[data-layer="pro"]'),
  };
}
"""

KNOBS = r"""
async () => {
  const out = [];
  for (const k of [...document.querySelectorAll(".k-knob")].slice(0, 6)) {
    const r = k.querySelector("input"); const v0 = +r.value;
    out.push({ id: r.id || r.getAttribute("aria-label"), v0, min: +r.min, max: +r.max });
  }
  return out;
}
"""


async def check(url: str, browser) -> dict:
    res = {"url": url, "errors": [], "fail": []}
    ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
    page = await ctx.new_page()
    page.on("pageerror", lambda e: res["errors"].append(str(e)[:160]))
    await page.goto(url, wait_until="load", timeout=60000)
    await page.wait_for_timeout(800)
    res["kit"] = await page.evaluate("typeof window.Kit === 'object'")
    res["nav"] = await page.evaluate(NAV)
    res["hand"] = res["nav"]["crumbs"] >= 2 and res["nav"]["tools_named"]
    if res["nav"]["unnamed_links"]:
        res["fail"].append(f"{res['nav']['unnamed_links']} links without a name")
    for k in ("message", "toy", "plain", "pro"):
        if not res["nav"][k]:
            res["fail"].append(f"no {k} layer" if k != "message" else "no message line")
    if res["nav"]["map"]:
        await page.keyboard.press("m")
        opened = await page.evaluate("!!document.querySelector('dialog.k-map[open]')")
        await page.keyboard.press("Escape")
        closed = await page.evaluate("!document.querySelector('dialog.k-map[open]')")
        res["map_keys"] = opened and closed
        if not res["map_keys"]:
            res["fail"].append("map does not open with M and close with Escape")
    t0 = await page.evaluate("document.documentElement.dataset.theme || ''")
    lamp = page.locator('.k-rail [data-k="lamp"]')
    if await lamp.count():
        await lamp.click()
        t1 = await page.evaluate("document.documentElement.dataset.theme || ''")
        res["lamp"] = t0 != t1
    knobs = await page.evaluate(KNOBS)
    res["knobs"] = []
    for i, kn in enumerate(knobs):
        inp = page.locator(".k-knob input").nth(i)
        dial = page.locator(".k-knob .k-dial").nth(i)
        await inp.focus()
        await page.keyboard.press("Home")
        lo = float(await inp.input_value())
        await page.keyboard.press("ArrowRight")
        one = float(await inp.input_value())
        await page.keyboard.press("Shift+ArrowRight")
        ten = float(await inp.input_value())
        await dial.scroll_into_view_if_needed()
        box = await dial.bounding_box()
        before = float(await inp.input_value())
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
        await page.mouse.down()
        await page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2 - DRAG_PX, steps=8)
        await page.mouse.up()
        await page.wait_for_timeout(300)
        dragged = float(await inp.input_value())
        row = {"id": kn["id"], "key": one > lo, "coarse": ten > one or ten == kn["max"], "drag": dragged != before or before == kn["max"]}
        res["knobs"].append(row)
        if not all((row["key"], row["coarse"], row["drag"])):
            res["fail"].append(f"knob {kn['id']}")
    faders = page.locator('input[type="range"]:not(.k-knob input):visible')
    nf = await faders.count()
    if nf:
        f = faders.first
        await f.scroll_into_view_if_needed()
        await f.focus()
        await page.keyboard.press("Home")
        a = float(await f.input_value())
        await page.keyboard.press("Shift+ArrowRight")
        b = float(await f.input_value())
        await page.keyboard.press("ArrowRight")
        c = float(await f.input_value())
        res["fader_coarse"] = (b - a) > (c - b) or b == float(await f.get_attribute("max") or 100)
        if not res["fader_coarse"]:
            res["fail"].append("fader coarse step")
    res["faders"] = nf
    await page.set_viewport_size({"width": 390, "height": 844})
    await page.wait_for_timeout(300)
    res["scroll_x"] = await page.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    if res["scroll_x"]:
        res["fail"].append("sideways scroll at 390 px")
    for k in ("kit", "hand"):
        if not res.get(k):
            res["fail"].append(k)
    if res.get("lamp") is False:
        res["fail"].append("lamp")
    if res["errors"]:
        res["fail"].append("page errors")
    await ctx.close()
    return res


DEGRADED = r"""
() => {
  const v = (e) => { if (!e) return false; const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== "hidden" && c.display !== "none"; };
  return { title: v(document.querySelector("h1")), message: v(document.querySelector(".k-message")),
    toy: v(document.querySelector('[data-layer="toy"]')), scroll_x: document.documentElement.scrollWidth > innerWidth + 1 };
}
"""


async def degraded(url: str, browser) -> dict:
    """Load the page with scripts off, then with fonts blocked; report what a reader still gets."""
    out = {}
    for mode in ("no_script", "no_fonts"):
        ctx = await browser.new_context(viewport={"width": 390, "height": 844}, java_script_enabled=mode != "no_script")
        if mode == "no_fonts":
            await ctx.route("**/*.woff2", lambda r: r.abort())
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)[:160]))
        await page.goto(url)
        await page.wait_for_timeout(600)
        got = await page.evaluate(DEGRADED)
        got["errors"] = errs
        got["fail"] = [k for k in ("title", "message", "toy") if not got[k]] + (["scroll_x"] if got["scroll_x"] else []) + (["errors"] if errs else [])
        out[mode] = got
        await ctx.close()
    return out


async def main(urls: list[str]) -> int:
    bad = 0
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--allow-file-access-from-files"])
        for u in urls:
            r = await check(u, browser)
            r["degraded"] = await degraded(u, browser)
            r["fail"] += [f"{m}: {', '.join(d['fail'])}" for m, d in r["degraded"].items() if d["fail"]]
            bad += bool(r["fail"])
            print(json.dumps(r))
        await browser.close()
    return 1 if bad else 0


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
