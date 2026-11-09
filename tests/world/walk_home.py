"""Walk the home page and screenshot each stop and place (2026-10-26).

py -3.12 tests/world/walk_home.py BASE OUTDIR [--width 1440] [--scheme light] [--reduce]
Scrolls to the arrival, each road stop (at its arrival point) and each place, waits for the art to settle and
saves one screenshot per point, at device scale 2. Prints console errors. Exit 1 if any.
"""
import argparse, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser(); ap.add_argument("base"); ap.add_argument("out")
ap.add_argument("--width", type=int, default=1440); ap.add_argument("--scheme", default="light"); ap.add_argument("--reduce", action="store_true")
a = ap.parse_args(); out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=["--no-proxy-server"])
    c = b.new_context(viewport={"width": a.width, "height": 900 if a.width > 800 else 812}, device_scale_factor=2, color_scheme=a.scheme, reduced_motion="reduce" if a.reduce else "no-preference")
    pg = c.new_page(); pg.on("console", lambda m: m.type == "error" and errs.append(m.text[:200])); pg.on("pageerror", lambda e: errs.append(str(e)[:200]))
    pg.goto(a.base.rstrip("/") + "/index.html", wait_until="load"); pg.wait_for_timeout(2500)
    tag = f"{a.width}-{a.scheme}{'-rm' if a.reduce else ''}"
    pg.screenshot(path=str(out / f"00-arrival-{tag}.png"))
    targets = pg.evaluate("() => [...document.querySelectorAll('.stop, .place')].map(e => [e.id, e.getBoundingClientRect().top + scrollY, e.getBoundingClientRect().height])")
    for i, (id_, top, h) in enumerate(targets, 1):
        y = top + (h * 0.45 if id_.startswith("s-") else max(0, h / 2 - 450))
        pg.evaluate(f"window.scrollTo(0, {y})"); pg.wait_for_timeout(1800)
        pg.screenshot(path=str(out / f"{i:02d}-{id_}-{tag}.png"))
    b.close()
print("\n".join(errs) or "no console errors")
sys.exit(1 if errs else 0)
