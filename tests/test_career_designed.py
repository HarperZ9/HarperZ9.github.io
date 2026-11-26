"""The designed resumes and CV meet the same standards as the plain editions.

The designed PDFs (BuildTeX, press-resume finish) are built by tools/build_career_typeset.py
from the same reviewed source as the plain PDF and DOCX. The checks in
tools/career_pdf_checks.py read them with PyMuPDF and pypdf, which share no code with the
typesetter. Each check has a planted control below that must fail, so a check that cannot
fail does not pass for one that works. Standards: MARKET-GUIDANCE notes summarized in the PR.
"""
from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path

import fitz  # PyMuPDF, pinned in requirements-career-docs.txt
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "career" / "resume-source.json").read_text(encoding="utf-8"))
DESIGNED = ROOT / "career" / "designed"
INVENTORY = json.loads((ROOT / "career" / "published-work.json").read_text(encoding="utf-8"))
_spec = importlib.util.spec_from_file_location("career_pdf_checks", ROOT / "tools" / "career_pdf_checks.py")
checks = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(checks)


def designed(doc: dict) -> Path:
    return DESIGNED / f"{doc['stem']}.pdf"


def plain(doc: dict) -> Path:
    return ROOT / "career" / f"{doc['stem']}.pdf"


def test_every_document_has_a_designed_pdf_built_from_the_current_source() -> None:
    source_sha = hashlib.sha256((ROOT / "career" / "resume-source.json").read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    for doc in SOURCE["documents"]:
        receipt = json.loads((DESIGNED / f"{doc['stem']}.buildtex.json").read_text(encoding="utf-8"))
        assert receipt["source"]["sha256"] == source_sha, f"{doc['stem']} was built from an older source"
        assert receipt["outputs"][designed(doc).name] == hashlib.sha256(designed(doc).read_bytes()).hexdigest()
        assert receipt["failed"] == [], doc["stem"]
        assert receipt["external_programs"] == [], doc["stem"]


def test_designed_and_plain_parse_to_the_same_fields_in_the_same_order() -> None:
    for doc in SOURCE["documents"]:
        for reader in ("pypdf", "pymupdf"):
            a, b = checks.tokens(designed(doc), reader), checks.tokens(plain(doc), reader)
            assert a == b, f"{doc['stem']} ({reader}): {checks.first_difference(a, b)}"


def test_page_counts_and_file_sizes() -> None:
    for doc in SOURCE["documents"]:
        assert len(PdfReader(designed(doc)).pages) == len(PdfReader(plain(doc)).pages) == doc["page_target"], doc["stem"]
        assert designed(doc).stat().st_size < checks.MAX_BYTES, doc["stem"]


def test_every_font_is_embedded() -> None:
    for doc in SOURCE["documents"]:
        for page in PdfReader(designed(doc)).pages:
            for font in (page["/Resources"].get("/Font") or {}).values():
                font = font.get_object()
                desc = font["/DescendantFonts"][0].get_object()["/FontDescriptor"].get_object()
                assert any(k in desc for k in ("/FontFile", "/FontFile2", "/FontFile3")), font["/BaseFont"]


def test_all_text_meets_wcag_aa_contrast_on_the_render() -> None:
    for doc in SOURCE["documents"]:
        low, where = checks.contrast(designed(doc))
        assert low >= checks.AA, f"{doc['stem']}: {low:.2f}:1 on {where!r}"


def test_greyscale_print_and_fax_stay_clean() -> None:
    for doc in SOURCE["documents"]:
        assert checks.fax_dark_share(designed(doc)) <= checks.FAX_DARK_SHARE, doc["stem"]


def test_decoration_never_meets_body_text() -> None:
    for doc in SOURCE["documents"]:
        heading = next(b["text"] for b in doc["blocks"] if b.get("kind") == "h2")
        assert checks.decorations_clear_of_body(designed(doc), heading) == [], doc["stem"]


def test_decoration_is_marked_as_artifact() -> None:
    for doc in SOURCE["documents"]:
        page = fitz.open(designed(doc))[0]
        content = b"".join(page.read_contents().split())
        assert b"/ArtifactBMC" in content, doc["stem"]


def test_the_published_work_page_lists_every_inventory_item() -> None:
    page = (ROOT / "published-work.html").read_text(encoding="utf-8")
    for repo in INVENTORY["repositories"]:
        assert repo["name"] in page, repo["name"]
    for paper in INVENTORY["papers"]:
        assert paper["url"].replace("https://", "") in page, paper["title"]
    for pkg in INVENTORY["packages"]:
        assert f"{pkg['registry']} {pkg['name']} {pkg['version']}" in page, pkg["name"]
    for doc in SOURCE["documents"]:
        assert "harperz9.github.io/published-work.html" in (ROOT / "career" / f"{doc['stem']}.txt").read_text(encoding="utf-8")


def test_inventory_lists_only_published_sources() -> None:
    assert INVENTORY["schema"] == "harperz9-published-work/v1"
    for page in INVENTORY["site"]:
        assert (ROOT / page["url"].removeprefix("https://harperz9.github.io/")).is_file(), page


# Planted controls: each check must fail on a case built to fail it.

def _page(tmp_path: Path, *, ink, box=None) -> Path:
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.draw_rect(page.rect, color=None, fill=(0xF6 / 255, 0xF1 / 255, 0xE3 / 255))
    page.insert_text((54, 100), "Summary", fontsize=11, color=ink)
    page.insert_text((54, 120), "A line of body text for the control.", fontsize=10, color=ink)
    if box:
        page.draw_rect(fitz.Rect(*box), color=None, fill=(0.2, 0.2, 0.2))
    path = tmp_path / "control.pdf"
    doc.save(path)
    return path


def test_controls_fail(tmp_path: Path) -> None:
    faint = _page(tmp_path, ink=(0xC8 / 255, 0xC0 / 255, 0xAE / 255))
    assert checks.contrast(faint)[0] < checks.AA
    dark_margin = _page(tmp_path, ink=(0, 0, 0), box=(300, 300, 560, 700))
    assert checks.fax_dark_share(dark_margin) > checks.FAX_DARK_SHARE
    behind = _page(tmp_path, ink=(0, 0, 0), box=(50, 110, 300, 125))
    assert checks.decorations_clear_of_body(behind, "Summary") != []
    a = checks.tokens(faint, "pymupdf")
    assert checks.first_difference(a, a[1:] + a[:1]) != ""


def test_every_credential_is_on_the_published_work_page_with_its_result() -> None:
    creds = json.loads((ROOT / "career" / "credentials.json").read_text(encoding="utf-8"))
    source_ids = {c["id"] for c in SOURCE["credentials"]}
    assert {c["id"] for c in creds["credentials"]} == source_ids
    assert creds["total"] == len(source_ids) == sum(creds["counts"].values())
    page = (ROOT / "published-work.html").read_text(encoding="utf-8")
    assert f"Certifications and credentials | {creds['total']}" in page
    for c in creds["credentials"]:
        assert c["result"] in {"verified", "link dead", "no public record"}, c["id"]
        assert c["title"].replace("&", "&amp;") in page, c["id"]
        if c["result"] == "verified":
            assert c["verification_url"] and c["method"], c["id"]
