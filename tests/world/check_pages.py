"""Load world pages in Chrome and record what went wrong (2026-10-26).

py -3.12 tests/world/check_pages.py BASE OUTDIR [--pages FILE] [--shots] [--variants all|quick] [PATH ...]

For each page and variant (1440 or 375 wide; light or dark; motion or reduced motion) it records console
errors and warnings, page errors, failed or 4xx/5xx requests, horizontal overflow, and (with --shots) a
full-viewport screenshot at device scale 2, so the 100% and 200% look can be checked by eye.
Writes OUTDIR/report.json and prints one line per page and variant. Exit 1 if any page has an error.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from playwright.sync_api import sync_playwright

VARIANTS = {
    "quick": [(1440, "light", "no-preference"), (375, "dark", "reduce")],
    "all": [(w, s, m) for w in (1440, 375) for s in ("light", "dark") for m in ("no-preference", "reduce")],
}
IGNORE = [re.compile(p) for p in (r"favicon\.ico", r"Download the React DevTools")]


def slug(path: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", path).strip("-") or "home"


def check(page, url: str, wait: float) -> dict:
    errors, failed = [], []
    page.on("console", lambda m: m.type in ("error", "warning") and not any(i.search(m.text) for i in IGNORE) and errors.append(f"{m.type}: {m.text[:300]}"))
    page.on("pageerror", lambda e: errors.append(f"pageerror: {str(e)[:300]}"))
    page.on("requestfailed", lambda r: failed.append(f"{r.url} {r.failure}"))
    page.on("response", lambda r: r.status >= 400 and failed.append(f"{r.status} {r.url}"))
    page.goto(url, wait_until="load", timeout=60000)
    page.wait_for_timeout(int(wait * 1000))
    overflow = page.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
    return {"errors": errors, "failed": [f for f in failed if "ERR_ABORTED" not in f and not f.startswith("node:")], "overflow": overflow}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("out")
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--pages")
    ap.add_argument("--shots", action="store_true")
    ap.add_argument("--variants", default="quick", choices=VARIANTS)
    ap.add_argument("--wait", type=float, default=2.0)
    a = ap.parse_args(argv)
    paths = list(a.paths) + ([l.strip() for l in Path(a.pages).read_text().splitlines() if l.strip() and not l.startswith("#")] if a.pages else [])
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    report, bad = [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=["--no-proxy-server"])
        for path in paths:
            for w, scheme, motion in VARIANTS[a.variants]:
                ctx = browser.new_context(viewport={"width": w, "height": 900 if w > 800 else 812}, device_scale_factor=2,
                                          color_scheme=scheme, reduced_motion=motion)
                page = ctx.new_page()
                try:
                    r = check(page, a.base.rstrip("/") + "/" + path.lstrip("/"), a.wait)
                except Exception as e:  # a page that cannot load is a failure, reported with its reason
                    r = {"errors": [f"load: {e}"[:300]], "failed": [], "overflow": 0}
                name = f"{slug(path)}-{w}-{scheme}-{'rm' if motion == 'reduce' else 'mo'}"
                if a.shots:
                    try:
                        page.screenshot(path=str(out / f"{name}.png"))
                    except Exception as e:
                        r["errors"].append(f"screenshot: {e}"[:200])
                r.update(page=path, width=w, scheme=scheme, motion=motion, shot=f"{name}.png" if a.shots else None)
                n = len(r["errors"]) + len(r["failed"]) + (1 if r["overflow"] > 1 else 0)
                bad += n > 0
                print(f"{'FAIL' if n else 'ok  '} {name}: {len(r['errors'])} console, {len(r['failed'])} requests, overflow {r['overflow']}")
                for x in (r["errors"] + r["failed"])[:6]:
                    print("      ", x)
                report.append(r)
                ctx.close()
        browser.close()
    (out / "report.json").write_text(json.dumps(report, indent=1))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
