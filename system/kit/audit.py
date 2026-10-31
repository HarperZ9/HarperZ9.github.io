"""audit.py: measure a page's accessibility basics in headless Chromium, in light and dark.

    python audit.py URL [URL ...]          prints one JSON line per page and scheme

Measures, per scheme:
  contrast   WCAG 2.x ratio of every visible text element against its painted ground (nearest opaque
             background up the tree, alpha composited). Reports the minimum, the count below AA (4.5 for
             normal text, 3.0 for large: 24 px, or 18.66 px at weight 700 and over) and the worst few.
  names      buttons, inputs, selects and textareas with no accessible name.
  canvases   canvases with no text alternative (aria-label, aria-labelledby, or aria-hidden).
  tabindex   elements with a positive tabindex, which break keyboard order.
  focus      share of focusable elements whose :focus-visible style changes outline or box-shadow.
  viewport   precision of the first screen (light only), after rubric rewards that count what should be absent
             as well as what should be present: chrome share (rail and tool bar area over viewport area),
             stacked rules (pairs of horizontal rules 2 px or heavier within 96 px of each other), the toy's
             visible height in the first screen, and visible text runs. Reported, never scored: a number a
             page is tuned against stops measuring the page.
Text over a canvas or image measures against the nearest CSS ground, so art-backed text needs a look.
Needs Python Playwright with Chromium.
"""
from __future__ import annotations

import asyncio
import json
import sys

from playwright.async_api import async_playwright

AA_NORMAL, AA_LARGE, WORST_N = 4.5, 3.0, 5

PROBE = r"""
() => {
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
  const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const cv = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  const rgba = (s) => { cv.clearRect(0, 0, 1, 1); cv.fillStyle = "#000"; cv.fillStyle = s; cv.fillRect(0, 0, 1, 1); const d = cv.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (top, bot) => [0, 1, 2].map((i) => top[i] * top[3] + bot[i] * (1 - top[3])).concat(1);
  function ground(el) {
    const stack = [];
    for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 1) break; } }
    let g = rgba(getComputedStyle(document.documentElement).backgroundColor); if (g[3] < 1) g = [255, 255, 255, 1];
    for (let i = stack.length - 1; i >= 0; i--) g = over(stack[i], g);
    return g;
  }
  const out = { n: 0, below: 0, min: 99, worst: [] };
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const t = walker.currentNode; if (!t.textContent.trim()) continue;
    const el = t.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || +cs.opacity === 0) continue;
    if (el.closest("[aria-hidden='true'],.sr-only,script,style,noscript,option")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue;
    const fill = cs.webkitTextFillColor && cs.webkitTextFillColor !== cs.color ? cs.webkitTextFillColor : cs.color;
    let fg = rgba(fill); if (fg[3] === 0) continue;
    const bg = ground(el); fg = over(fg, bg);
    const a = L(fg), b = L(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    const px = parseFloat(cs.fontSize), large = px >= 24 || (px >= 18.66 && +cs.fontWeight >= 700);
    const need = large ? 3.0 : 4.5; out.n++;
    if (ratio < out.min) out.min = ratio;
    if (ratio < need) { out.below++; out.worst.push({ ratio: +ratio.toFixed(2), need, text: t.textContent.trim().slice(0, 40), tag: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : "") }); }
  }
  out.worst.sort((x, y) => x.ratio - y.ratio); out.worst = out.worst.slice(0, 5); out.min = +out.min.toFixed(2);
  const named = (e) => e.getAttribute("aria-label") || e.getAttribute("aria-labelledby") || (e.labels && e.labels.length && [...e.labels].some((l) => l.textContent.trim())) || e.title || (e.tagName === "BUTTON" && e.textContent.trim()) || (e.type === "submit" || e.type === "button") && e.value;
  const ctrls = [...document.querySelectorAll("button,input:not([type=hidden]),select,textarea")].filter((e) => !e.closest("[hidden]") && getComputedStyle(e).display !== "none");
  out.unnamed = ctrls.filter((e) => !named(e)).map((e) => e.outerHTML.slice(0, 80));
  out.controls = ctrls.length;
  const canv = [...document.querySelectorAll("canvas")];
  out.canvases = canv.length; out.canvas_unlabelled = canv.filter((c) => !(c.getAttribute("aria-label") || c.getAttribute("aria-labelledby") || c.getAttribute("aria-hidden") === "true")).length;
  out.pos_tabindex = document.querySelectorAll("[tabindex]:not([tabindex='0']):not([tabindex^='-'])").length;
  return out;
}
"""

VIEWPORT = r"""
() => {
  const vh = innerHeight, vw = innerWidth;
  const vis = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.top < vh && r.bottom > 0 && c.visibility !== "hidden" && c.display !== "none"; };
  let chrome = 0;
  for (const e of document.querySelectorAll(".k-rail,.k-tools")) if (vis(e)) { const r = e.getBoundingClientRect(); chrome += Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) * Math.min(r.width, vw); }
  const rules = [];
  for (const e of document.querySelectorAll("body *")) {
    if (!vis(e) || e.closest(".k-rail,.k-tools,dialog")) continue;
    const c = getComputedStyle(e), r = e.getBoundingClientRect();
    if (parseFloat(c.borderTopWidth) >= 2 && c.borderTopStyle !== "none" && r.width > vw * 0.3) rules.push(r.top);
    else if (e.tagName === "HR" && r.height >= 2 && r.width > vw * 0.3) rules.push(r.top);
  }
  rules.sort((a, b) => a - b); let stacked = 0; for (let i = 1; i < rules.length; i++) if (rules[i] - rules[i - 1] < 96) stacked++;
  const toy = document.querySelector('[data-layer="toy"]'); let toy_px = 0;
  if (toy) { const r = toy.getBoundingClientRect(); toy_px = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)); }
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let runs = 0, n;
  while ((n = w.nextNode())) { const el = n.parentElement; if (n.textContent.trim() && el && vis(el) && !el.closest("[aria-hidden='true'],.sr-only,dialog")) runs++; }
  return { chrome_share: +(chrome / (vw * vh)).toFixed(3), stacked_rules: stacked, toy_px: Math.round(toy_px), text_runs: runs };
}
"""

FOCUS = r"""
async () => {
  const els = [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,textarea,[tabindex='0']")].filter((e) => e.getBoundingClientRect().width > 0).slice(0, 40);
  let ok = 0;
  for (const e of els) {
    const before = getComputedStyle(e); const o0 = before.outlineStyle + before.outlineWidth + before.boxShadow;
    e.focus({ focusVisible: true });
    const after = getComputedStyle(e); const o1 = after.outlineStyle + after.outlineWidth + after.boxShadow;
    const host = e.closest(".k-knob .k-dial") || e.closest(".k-knob");
    if (o0 !== o1 || (host && getComputedStyle(host.querySelector(".k-dial") || host).outlineStyle !== "none")) ok++;
    e.blur();
  }
  return { checked: els.length, visible: ok };
}
"""


async def audit(urls: list[str]) -> None:
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--allow-file-access-from-files"])
        for url in urls:
            for scheme in ("light", "dark"):
                ctx = await browser.new_context(viewport={"width": 1440, "height": 900}, color_scheme=scheme, reduced_motion="reduce")
                page = await ctx.new_page()
                await page.goto(url, wait_until="load", timeout=60000)
                await page.wait_for_timeout(1200)
                await page.keyboard.press("Tab")
                res = await page.evaluate(PROBE)
                res["focus"] = await page.evaluate(FOCUS)
                if scheme == "light":
                    await page.evaluate("window.scrollTo(0, 0)")
                    res["viewport"] = await page.evaluate(VIEWPORT)
                res.update(url=url, scheme=scheme)
                print(json.dumps(res))
                await ctx.close()
        await browser.close()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)
    asyncio.run(audit(sys.argv[1:]))
