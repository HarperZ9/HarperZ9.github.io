"""Every page can be taken away: Markdown, plain text, Word, or print.

The conversion runs in the browser against the live DOM, so these are contract
checks on the wiring rather than on the output. The output itself is verified
by driving a real browser, because that is the only place the code runs.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_the_three_shared_files_ship() -> None:
    for rel in ("system/export.js", "system/export.css", "system/print.css", "system/nav.css"):
        assert (ROOT / rel).is_file(), rel


def test_nav_loads_the_exporter_and_the_stylesheets() -> None:
    nav = read("system/nav.js")
    assert 'import("./export.js?v="' in nav, "no page would offer an export"
    assert '"nav.css"' in nav and '"print.css"' in nav and '"export.css"' in nav
    # These are fetched by nav.js rather than named in the markup, so they need
    # a stamp of their own or a warm cache never sees an update to any of them.
    assert re.search(r'const ASSET_V = "[\w.-]+"', nav)
    assert 'name + "?v=" + ASSET_V' in nav


def test_print_and_export_sheets_load_after_the_page_stylesheets() -> None:
    """A media query adds no specificity, so a print rule loaded before the
    page's own screen rules loses to them and the page prints black on black.
    Order is the whole mechanism; pin it."""
    nav = read("system/nav.js")
    assert re.search(r'addSheet\(doc, "nav\.css", "nav-style", "first"\)', nav)
    for sheet in ("export.css", "print.css"):
        assert re.search(r'addSheet\(doc, "' + re.escape(sheet) + r'", "[a-z-]+", "last"\)', nav), sheet


def test_print_stylesheet_makes_a_document() -> None:
    css = read("system/print.css")
    assert "@media print" in css
    # chrome off the page
    for gone in (".site-nav", ".docnav", "#gl", "#motes", "iframe", "video"):
        assert gone in css, gone
    # white paper, black ink, and it has to win against the screen rules
    assert "background:#fff !important" in css
    assert "color:#000 !important" in css
    # the document pages keep their own tuned print contract
    assert "body:not(.doc)" in css
    # a link is useless on paper without its destination
    assert 'content:" (" attr(href) ")"' in css


def test_shared_data_surfaces_print_as_black_ink_on_white_paper() -> None:
    for rel in ("system/system.css", "system/doc.css", "system/figure.css"):
        css = read(rel)
        print_rules = re.search(r"@media\s+print\s*\{(?P<body>.*?)\n\}", css, re.DOTALL)
        assert print_rules, f"{rel} must define print rules"
        body = print_rules.group("body")
        assert ".data-plate" in body and ".evidence-ledger" in body, rel
        assert "background:#fff!important" in body, rel
        assert "color:#000!important" in body, rel
        assert "border-color:#000!important" in body, rel


def test_exporter_offers_all_four_formats() -> None:
    js = read("system/export.js")
    for fmt in ('"md"', '"txt"', '"docx"', '"print"'):
        assert fmt in js, fmt
    for fn in ("toMarkdown", "toText", "toDocx", "readPage", "exportAs", "mountExport"):
        assert "export function " + fn in js, fn


def test_docx_is_a_conforming_package() -> None:
    """Three schema requirements a lenient reader forgives and a strict one
    does not, each of which was found by opening the output with a real OOXML
    parser rather than by reading the spec."""
    js = read("system/export.js")
    assert "[Content_Types].xml" in js and "_rels/.rels" in js
    assert "word/document.xml" in js and "word/styles.xml" in js
    # a default paragraph style, or every plain paragraph resolves to nothing
    assert 'w:default="1" w:styleId="Normal"' in js
    # a table without a grid throws in a conforming reader
    assert "<w:tblGrid>" in js and "<w:gridCol" in js
    # no reference to a style the styles part does not define. Match the
    # emitted element, not the word: the comment above it says why it is gone.
    assert "<w:tblStyle" not in js
    # the archive is written by hand, so the checksum has to be real
    assert "0xEDB88320" in js and "crc32" in js


def test_export_control_states_no_colours_of_its_own() -> None:
    """It lands on dark document sheets, dark instrument shells, and four
    light paper-coloured sample pages. Reading the page's --ink was what broke
    the nav on a light page; the control inherits currentColor instead."""
    css = read("system/export.css")
    assert "currentColor" in css
    assert not re.search(r"var\(--(ink|void|page|signal|tag)\b", css), \
        "the export control reads a page token whose meaning it cannot check"


def test_export_panel_cannot_be_repositioned_by_a_page() -> None:
    """system.css sets position on every direct child of body on
    generative-host pages, at a specificity of (2,1,1). The panel is parked on
    body, so without this it stopped being fixed and rendered thousands of
    pixels outside the viewport on a long page."""
    css = read("system/export.css")
    assert "position:fixed !important" in css
    assert "inset:auto !important" in css


def test_document_pages_place_the_control_themselves() -> None:
    for name in ("resume.html", "cv.html", "portfolio.html", "cover-letter.html", "dossier.html"):
        assert "data-export-slot" in read(name), name


def test_no_em_dashes_in_the_strings_a_reader_sees() -> None:
    for rel in ("system/export.js", "system/export.css", "system/print.css"):
        assert "—" not in read(rel), rel
