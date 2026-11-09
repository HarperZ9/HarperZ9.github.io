"""Render only the link cards that do not exist yet, and add their receipts to the folder's receipts.json.

    python -m tools.repo_art.render_missing
    python -m tools.repo_art.site_cards stamp

The full render (site_cards render) redraws every card; a new batch of pages (the world's, 2026-10-26) needs
only its own. Existing cards and their receipts are left byte for byte as they are.
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from playwright.sync_api import sync_playwright  # noqa: E402

from tools.repo_art import render as R  # noqa: E402
from tools.repo_art.site_cards import OUT, plan  # noqa: E402


def main() -> int:
    cards = [c for c in plan() if not (OUT / f"{c['slug']}.jpg").is_file()]
    if not cards:
        print("every sitemap page has its card")
        return 0
    repos = json.loads((R.HERE / "repos.json").read_text("utf-8"))["repos"]
    fonts = R.font_receipts(R.FACES)
    book_path = OUT / "receipts.json"
    book = json.loads(book_path.read_text("utf-8")) if book_path.is_file() else {"schema": "harperz9.repo-art.receipts/1", "receipts": {}}
    with sync_playwright() as pw, tempfile.TemporaryDirectory() as tmp:
        browser = pw.chromium.launch(channel="chrome", args=R.CHROME_ARGS)
        backend = f"chrome-{browser.version}-skia"
        page = browser.new_page(device_scale_factor=1)
        for card in cards:
            try:
                svg, scene = R.card_svg(card, repos)
            except ValueError as e:  # a title glyph the card faces lack (a Greek capital): drawn without it, said so
                print(f"{card['slug']}: {e}; drawing the title in the faces' own letters")
                card = {**card, "title": "".join(ch for ch in card["title"] if ord(ch) < 0x0250).strip() or card["slug"]}
                svg, scene = R.card_svg(card, repos)
            scene["fonts"] = fonts
            svg_path = Path(tmp) / f"{card['slug']}.svg"
            svg_path.write_bytes(svg.encode("utf-8"))
            jpg = R.to_jpeg(R.raster(page, svg_path, None, False))
            name = f"{card['slug']}.jpg"
            (OUT / name).write_bytes(jpg)
            book["receipts"][name] = R.receipt(scene, jpg, {svg_path.name: R.sha(svg.encode("utf-8")), name: R.sha(jpg)}, backend)
        browser.close()
    book_path.write_text(json.dumps(book, indent=1, sort_keys=True) + "\n", "utf-8", newline="\n")
    print(len(cards), "cards rendered")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
