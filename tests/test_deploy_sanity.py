"""Deploy-target sanity. The full content contracts run upstream in
HarperZ9/telos-v2 CI against the built dist BEFORE it is deployed here;
this repo receives build output, so its own gate checks only that the
deploy is structurally intact."""

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


# 2026-10-26: the React home moved to workshop.html when the home became the world's entrance (index.html).
def test_home_shell_is_intact() -> None:
    src = (ROOT / "workshop.html").read_text(encoding="utf-8")
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
        "system/fonts/hanken-grotesk.woff2", "system/fonts/conso-regular.woff2",
    ):
        assert (ROOT / rel).is_file(), rel


# 4 October 2026: the author retired Kilon and Telos Display, the face built from
# it, because viewers found them hard to read. The canon allows Hanken Grotesk and
# Conso only, so neither file nor its build tool ships, and no page, stylesheet or
# script names either face.
RETIRED_FONT_FILES = (
    "system/fonts/kilon.woff", "system/fonts/kilon.woff2",
    "system/fonts/telos-display.ttf", "system/fonts/telos-display.woff2",
    "tools/fonts/build_telos_display.py",
)


def test_retired_display_faces_do_not_ship() -> None:
    for rel in RETIRED_FONT_FILES:
        assert not (ROOT / rel).exists(), rel
    pattern = re.compile(r"kilon|telos[ -]display", re.IGNORECASE)
    offenders = []
    for path in ROOT.rglob("*"):
        if path.suffix not in {".html", ".css", ".js", ".mjs"} or not path.is_file():
            continue
        rel = path.relative_to(ROOT).as_posix()
        if rel.startswith(("docs/", "tests/", ".git/", "node_modules/")) or ".test." in rel:
            continue
        text = path.read_text(encoding="utf-8", errors="ignore")
        # Dated notes may name the retired faces; declarations and stacks may not.
        text = re.sub(r"/\*.*?\*/", "", text, flags=re.DOTALL)
        text = re.sub(r"(?m)^\s*//.*$", "", text)
        if pattern.search(text):
            offenders.append(rel)
    assert offenders == [], offenders


def test_papers_shipped_as_pdfs() -> None:
    papers = list((ROOT / "papers").glob("*.pdf"))
    assert len(papers) >= 6
    for p in papers:
        assert p.read_bytes()[:5] == b"%PDF-", p.name


def test_key_pages_exist() -> None:
    for page in (
        "overview.html", "studio.html", "gallery.html", "catalog.html",
        "guide.html", "research.html", "publications.html",
        "demo-index.html", "cv.html", "typeface.html", "why.html",
        "frontier-safety.html",
    ):
        assert (ROOT / page).is_file(), page


def test_legacy_engines_route_points_to_current_systems_catalog() -> None:
    # engines.html was a redirect page until 15 November 2026; the address ledger now carries it as a moved row
    # and 404.html sends the reader on
    rows = json.loads((ROOT / "site-src/world/addresses.json").read_text(encoding="utf-8"))["rows"]
    row = next(r for r in rows if r["path"] == "/engines.html")
    assert row["kind"] == "moved" and row["to"] == "/overview.html"
    assert not (ROOT / "engines.html").exists()
    assert (ROOT / "overview.html").is_file()
    assert '<code>/engines.html</code> is now at <a href="/overview.html">' in (ROOT / "404.html").read_text(encoding="utf-8")
