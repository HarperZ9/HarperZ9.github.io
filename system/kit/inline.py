"""inline.py: put the one kit (kit.css + kit.js) inside a page, between its site-kit markers.

    python system/kit/inline.py PAGE.html [PAGE.html ...]     rewrite each page in place
    python system/kit/inline.py --check PAGE.html [...]       exit 1 if a page's block is stale
    from inline import inline_kit; html = inline_kit(html, out_path)   for builders

The block sits between <!-- site-kit:begin --> and <!-- site-kit:end -->. A page without the markers gets
them before its first stylesheet, so the page's own rules still win. Font URLs point at the site's own
files in system/fonts and are rewritten relative to the page, so a page opened from disk finds them; if
they cannot load, the Hanken and system stack takes over. When a map.js sits beside the kit, the block
links it, so a workshop copy can carry its own map; the site ships none. Stdlib only.
"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

KIT = Path(__file__).resolve().parent
FONTS = KIT.parent / "fonts"
BEGIN, END = "<!-- site-kit:begin -->", "<!-- site-kit:end -->"
_BLOCK = re.compile(re.escape(BEGIN) + r".*?" + re.escape(END), re.S)
_ANCHOR = re.compile(r"<style|<link[^>]+rel=\"?stylesheet|<script|</head>", re.I)


def _rel(target: Path, page_path: str | os.PathLike) -> str:
    return os.path.relpath(target, Path(page_path).resolve().parent).replace(os.sep, "/")


def kit_block(page_path: str | os.PathLike) -> str:
    """The marker block for a page at page_path, with font URLs relative to it."""
    css = (KIT / "kit.css").read_text(encoding="utf-8")
    js = (KIT / "kit.js").read_text(encoding="utf-8")
    css = css.replace('url("../fonts/', f'url("{_rel(FONTS, page_path)}/')
    map_tag = f'<script src="{_rel(KIT, page_path)}/map.js"></script>\n' if (KIT / "map.js").exists() else ""
    return (f'{BEGIN}\n<style id="site-kit">\n{css}</style>\n{map_tag}'
            f'<script id="site-kit-js">\n{js}</script>\n{END}')


def inline_kit(html: str, page_path: str | os.PathLike) -> str:
    block = kit_block(page_path)
    if BEGIN in html:
        return _BLOCK.sub(lambda _m: block, html, count=1)
    m = _ANCHOR.search(html)
    if not m:
        raise ValueError(f"{page_path}: no <head> anchor for the kit")
    return html[: m.start()] + block + "\n" + html[m.start():]


def main(args: list[str]) -> int:
    check = bool(args) and args[0] == "--check"
    paths = args[1:] if check else args
    if not paths:
        print(__doc__)
        return 2
    stale = 0
    for p in paths:
        page = Path(p)
        html = page.read_text(encoding="utf-8")
        fresh = inline_kit(html, page)
        if check:
            if fresh != html:
                stale += 1
                print(f"stale kit block: {page}")
            continue
        page.write_text(fresh, encoding="utf-8", newline="\n")
        print(f"kit inlined: {page}")
    return 1 if stale else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
