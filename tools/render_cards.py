"""Render the social cards that pages are missing.

img/og/_card.html is the card design and img/og/cards-data.js holds an entry
per key. Eight real pages had neither a card nor an og:image, so sharing the
gallery, the retro engine, or the loom produced a bare link with no picture.
This renders any key whose PNG is absent and leaves existing cards alone, so
running it is safe and repeatable.

    python tools/render_cards.py            # render what is missing
    python tools/render_cards.py --force    # re-render every key in the data

The card waits for data-ready, which the template sets once its fonts have
loaded and the halftone orb has been drawn. Screenshotting before that gives a
card with fallback type and an empty background, which is the sort of thing
that looks fine in a directory listing and wrong in a link preview.
"""

from __future__ import annotations

import argparse
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OG = ROOT / "img" / "og"


def keys() -> list[str]:
    src = (OG / "cards-data.js").read_text(encoding="utf-8")
    body = re.search(r"window\.CARD_DATA\s*=\s*(\{.*\});\s*$", src, re.S)
    if not body:
        raise SystemExit("cards-data.js does not parse")
    return list(json.loads(body.group(1)))


def launch_browser(chromium):
    """Use Playwright's browser, then the installed Chrome channel if absent."""
    try:
        return chromium.launch()
    except Exception as exc:
        if "Executable doesn't exist" not in str(exc):
            raise
        return chromium.launch(channel="chrome")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--force", action="store_true", help="re-render cards that already exist")
    ap.add_argument("only", nargs="*", help="specific keys to render")
    args = ap.parse_args()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("playwright is not installed; skipping card generation", file=sys.stderr)
        return 2

    wanted = args.only or keys()
    todo = [k for k in wanted if args.force or not (OG / f"{k}.png").exists()]
    if not todo:
        print("every card already exists; nothing to render")
        return 0

    with sync_playwright() as p:
        browser = launch_browser(p.chromium)
        page = browser.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        for key in todo:
            page.goto((OG / "_card.html").as_uri() + f"?f={key}")
            page.wait_for_selector("html[data-ready='1']", timeout=15000)
            page.wait_for_timeout(200)
            word = page.inner_text("#word").strip()
            out = OG / f"{key}.png"
            page.screenshot(path=str(out))
            print(f"  {out.name:34} {out.stat().st_size / 1024:>6.0f} kB   \"{word}\"")
        browser.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
