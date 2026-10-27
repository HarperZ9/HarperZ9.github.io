"""axe-core over world pages (2026-10-26).

py -3.12 tests/world/axe_pages.py BASE AXE_JS PAGE [PAGE ...]
AXE_JS is a local copy of axe.min.js (axe-core is not shipped with the site). Runs at 1440 light and 375 dark,
after the page settles, and prints every violation with its nodes. Exit 1 if any page has a violation.
"""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

base, axe, pages = sys.argv[1], Path(sys.argv[2]).read_text(encoding="utf-8"), sys.argv[3:]
bad = 0
with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome", args=["--no-proxy-server"])
    for w, scheme in ((1440, "light"), (375, "dark")):
        for pg in pages:
            c = b.new_context(viewport={"width": w, "height": 900 if w > 800 else 812}, color_scheme=scheme)
            page = c.new_page(); page.goto(f"{base}/{pg}", wait_until="load"); page.wait_for_timeout(2500)
            page.add_script_tag(content=axe)
            r = page.evaluate("async () => (await axe.run(document, {resultTypes: ['violations']})).violations.map(v => ({id: v.id, impact: v.impact, n: v.nodes.length, nodes: v.nodes.slice(0, 3).map(n => n.target.join(' '))}))")
            bad += bool(r)
            print(f"{'FAIL' if r else 'ok  '} {pg} {w} {scheme}: {len(r)} violations")
            for v in r: print("      ", json.dumps(v)[:300])
            c.close()
    b.close()
sys.exit(1 if bad else 0)
