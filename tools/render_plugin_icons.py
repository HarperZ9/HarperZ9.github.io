"""Render the plugin icon SVG masters to PNG and record a manifest.

Usage:
  python tools/render_plugin_icons.py              # render every PNG, write plugins/icons/icons.json
  python tools/render_plugin_icons.py --sheet OUT  # also write a contact sheet PNG for review

Needs Playwright with Chromium (pip install playwright; playwright install chromium).
The SVG masters come from tools/build_plugin_support_pages.py; run that first.
The manifest pins each PNG to the SHA-256 of the SVG it came from, so a test
fails when an SVG changes and its PNGs are not re-rendered.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import sys
from pathlib import Path

if __package__ in {None, ""}:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tools import plugin_support_sources as sources  # noqa: E402
from tools.plugin_icons import png_jobs  # noqa: E402

ROOT = sources.ROOT
MANIFEST = "plugins/icons/icons.json"


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def svg_bytes(path: Path) -> bytes:
    """SVG bytes with LF line ends, so a CRLF checkout hashes the same."""
    return path.read_bytes().replace(b"\r\n", b"\n")


def page_for(svg: bytes, size: int, ground: str = "transparent") -> str:
    src = "data:image/svg+xml;base64," + base64.b64encode(svg).decode()
    return (f'<html><body style="margin:0;background:{ground}">'
            f'<img src="{src}" width="{size}" height="{size}" style="display:block"></body></html>')


def render(page, svg: bytes, size: int, out: Path) -> None:
    page.set_viewport_size({"width": size, "height": size})
    page.set_content(page_for(svg, size))
    page.wait_for_load_state("load")
    out.parent.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(out), omit_background=True, clip={"x": 0, "y": 0, "width": size, "height": size})


def contact_sheet(page, jobs: list[tuple[str, str, int]], out: Path) -> None:
    cells = []
    for _, png, size in jobs:
        data = base64.b64encode((ROOT / png).read_bytes()).decode()
        ground = "#f4f3ef" if "glyph-" in png and "dark" not in png else "#1a1622"
        cells.append(f'<div style="display:inline-block;margin:6px;padding:6px;background:{ground};'
                     f'vertical-align:top"><img src="data:image/png;base64,{data}" width="{size}" '
                     f'height="{size}" style="image-rendering:pixelated"></div>')
    page.set_viewport_size({"width": 2400, "height": 800})
    page.set_content('<html><body style="margin:0;background:#888;width:2400px">' + "".join(cells) + "</body></html>")
    page.screenshot(path=str(out), full_page=True)


def png_size(data: bytes) -> tuple[int, int]:
    if data[:8] != bytes([137, 80, 78, 71, 13, 10, 26, 10]) or data[12:16] != b"IHDR":
        raise ValueError("not a PNG")
    return int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")


def verify(manifest: dict) -> list[str]:
    """Problems with the rendered PNGs: drift from their SVG, wrong size, missing files."""
    problems, seen = [], set()
    for entry in manifest["icons"]:
        png, svg = ROOT / entry["png"], ROOT / entry["source"]
        seen.add(entry["png"])
        if not png.is_file() or not svg.is_file():
            problems.append(f"{entry['png']}: file or source missing")
            continue
        if sha(svg_bytes(svg)) != entry["source_sha256"]:
            problems.append(f"{entry['png']}: {entry['source']} changed; re-render")
        data = png.read_bytes()
        if sha(data) != entry["sha256"]:
            problems.append(f"{entry['png']}: bytes differ from the manifest")
        if png_size(data) != (entry["size"], entry["size"]):
            problems.append(f"{entry['png']}: not {entry['size']}x{entry['size']}")
    slugs = [tool["slug"] for tool in sources.load_spec()["tools"]]
    expected = {png for slug in slugs for _, png, _ in png_jobs(slug)}
    problems += [f"{rel}: not rendered" for rel in sorted(expected - seen)]
    return problems


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--sheet", type=Path)
    args = parser.parse_args(argv)
    from playwright.sync_api import sync_playwright

    slugs = [tool["slug"] for tool in sources.load_spec()["tools"]]
    entries, all_jobs = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        for slug in slugs:
            for svg_rel, png_rel, size in png_jobs(slug):
                svg = svg_bytes(ROOT / svg_rel)
                render(page, svg, size, ROOT / png_rel)
                entries.append({"png": png_rel, "size": size, "source": svg_rel,
                                "source_sha256": sha(svg), "sha256": sha((ROOT / png_rel).read_bytes())})
                all_jobs.append((svg_rel, png_rel, size))
        if args.sheet:
            contact_sheet(page, all_jobs, args.sheet)
        browser.close()
    manifest = {"schema": "plugin-icons/1", "renderer": "Chromium via Playwright", "icons": entries}
    (ROOT / MANIFEST).write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"rendered {len(entries)} PNGs")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
