"""Deploy-target sanity. The full content contracts run upstream in
HarperZ9/telos-v2 CI against the built dist BEFORE it is deployed here;
this repo receives build output, so its own gate checks only that the
deploy is structurally intact."""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_home_shell_is_intact() -> None:
    src = (ROOT / "index.html").read_text(encoding="utf-8")
    assert '<div id="root"></div>' in src
    js = re.search(r'src="(/assets/index-[^"]+\.js)"', src)
    css = re.search(r'href="(/assets/index-[^"]+\.css)"', src)
    assert js and css
    assert (ROOT / js.group(1).lstrip("/")).is_file()
    assert (ROOT / css.group(1).lstrip("/")).is_file()


def test_shared_system_and_fonts_shipped() -> None:
    for rel in (
        "system/system.css", "system/doc.css", "system/nav.js",
        "system/generative-field.js", "system/home-readable.css",
        "system/fonts/kilon.woff2", "system/fonts/telos-display.woff2",
        "system/fonts/hanken-grotesk.woff2",
    ):
        assert (ROOT / rel).is_file(), rel


def test_papers_shipped_as_pdfs() -> None:
    papers = list((ROOT / "papers").glob("*.pdf"))
    assert len(papers) >= 6
    for p in papers:
        assert p.read_bytes()[:5] == b"%PDF-", p.name


def test_key_pages_exist() -> None:
    for page in (
        "overview.html", "studio.html", "gallery.html", "catalog.html",
        "guide.html", "research.html", "publications.html", "writing.html",
        "demo-index.html", "cv.html", "typeface.html", "why.html",
    ):
        assert (ROOT / page).is_file(), page
