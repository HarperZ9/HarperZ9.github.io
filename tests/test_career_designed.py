"""The designed resumes and CV (BuildTeX press finish) and the published-work inventory.

The designed PDFs are built by tools/build_career_typeset.py from the same reviewed
source as the ATS files. These checks read them with pypdf, a reader that shares no
code with the typesetter, so a passing typeset receipt cannot vouch for itself.
"""
from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path

import fitz  # PyMuPDF, pinned in requirements-career-docs.txt
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE = json.loads((ROOT / "career" / "resume-source.json").read_text(encoding="utf-8"))
DESIGNED = ROOT / "career" / "designed"
INVENTORY = json.loads((ROOT / "career" / "published-work.json").read_text(encoding="utf-8"))


def words(text: str) -> list[str]:
    return re.findall(r"[0-9A-Za-z]+", text)


def fonts(reader: PdfReader) -> dict[str, bool]:
    out = {}
    for page in reader.pages:
        for font in (page["/Resources"].get("/Font") or {}).values():
            font = font.get_object()
            desc = font["/DescendantFonts"][0].get_object()["/FontDescriptor"].get_object()
            out[str(font["/BaseFont"])] = any(k in desc for k in ("/FontFile", "/FontFile2", "/FontFile3"))
    return out


def test_every_document_has_a_designed_pdf_that_passes_its_own_checks() -> None:
    source_sha = hashlib.sha256((ROOT / "career" / "resume-source.json").read_bytes().replace(b"\r\n", b"\n")).hexdigest()
    for doc in SOURCE["documents"]:
        receipt = json.loads((DESIGNED / f"{doc['stem']}.buildtex.json").read_text(encoding="utf-8"))
        pdf = DESIGNED / f"{doc['stem']}.pdf"
        assert receipt["source"]["sha256"] == source_sha, f"{doc['stem']} was built from an older source"
        assert receipt["outputs"][pdf.name] == hashlib.sha256(pdf.read_bytes()).hexdigest()
        assert receipt["failed"] == [], doc["stem"]
        assert receipt["facts"]["overfull"] == [], doc["stem"]
        assert receipt["external_programs"] == [], doc["stem"]


def test_designed_pdfs_read_back_with_an_independent_reader() -> None:
    for doc in SOURCE["documents"]:
        reader = PdfReader(DESIGNED / f"{doc['stem']}.pdf")
        assert len(reader.pages) == doc["page_target"], doc["stem"]
        embedded = fonts(reader)
        assert embedded and all(embedded.values()), (doc["stem"], embedded)
        text = words(" ".join(p.extract_text() for p in reader.pages))
        assert text[:3] == ["Zain", "Dana", "Harper"], doc["stem"]
        joined = " ".join(text)
        for block in doc["blocks"]:
            if block.get("kind") == "h2":
                assert " ".join(words(block["text"])) in joined, (doc["stem"], block["text"])


def test_the_cv_lists_every_inventory_item() -> None:
    cv = (ROOT / "career" / "Zain-Dana-Harper-CV.txt").read_text(encoding="utf-8")
    for repo in INVENTORY["repositories"]:
        assert repo["name"] in cv, repo["name"]
    for paper in INVENTORY["papers"]:
        assert paper["url"].replace("https://", "") in cv, paper["title"]
    for pkg in INVENTORY["packages"]:
        assert f"{pkg['registry']} {pkg['name']} {pkg['version']}" in cv, pkg["name"]
    for page in INVENTORY["site"]:
        if page["kind"] != "briefing":
            assert page["url"].replace("https://", "") in cv, page["title"]


def test_inventory_lists_only_published_sources() -> None:
    assert INVENTORY["schema"] == "harperz9-published-work/v1"
    for page in INVENTORY["site"]:
        assert page["url"].startswith("https://harperz9.github.io/"), page
        assert (ROOT / page["url"].removeprefix("https://harperz9.github.io/")).is_file(), page
    for repo in INVENTORY["repositories"]:
        assert repo["url"] == f"https://github.com/HarperZ9/{repo['name']}"


NAME = "Zain Dana Harper"
AA = 4.5  # WCAG 2.x AA minimum for body-size text; the name is large, so this is the stricter bar


def _linear(v: int) -> float:
    c = v / 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def name_contrast(page: "fitz.Page") -> float:
    """Contrast ratio of the rendered name against its ground, read from pixels, not from the PDF colours.

    Renders the name's box at 200 dpi; the ink is the 5th-percentile luminance, the ground the
    75th percentile, so a relief-only (blind) name, whose darkest pixels are bevel shadow, scores low.
    """
    box = page.search_for(NAME)[0]
    pix = page.get_pixmap(dpi=200, clip=box)
    s, n = pix.samples, pix.n
    lum = sorted(0.2126 * _linear(s[i]) + 0.7152 * _linear(s[i + 1]) + 0.0722 * _linear(s[i + 2])
                 for i in range(0, len(s), n))
    ink, ground = lum[len(lum) // 20], lum[len(lum) * 3 // 4]
    return (ground + 0.05) / (ink + 0.05)


def test_the_name_meets_wcag_aa_contrast_on_every_designed_pdf() -> None:
    for doc in SOURCE["documents"]:
        page = fitz.open(DESIGNED / f"{doc['stem']}.pdf")[0]
        ratio = name_contrast(page)
        assert ratio >= AA, f"{doc['stem']}: name contrast {ratio:.2f}:1 is below {AA}:1"


def test_the_contrast_check_fails_a_faint_name() -> None:
    """Planted control: a name in a pale tint on the paper colour must fail the same measurement."""
    doc = fitz.open()
    page = doc.new_page(width=612, height=792)
    page.draw_rect(page.rect, color=None, fill=(0xF6 / 255, 0xF1 / 255, 0xE3 / 255))
    page.insert_text((54, 100), NAME, fontsize=30, color=(0xC8 / 255, 0xC0 / 255, 0xAE / 255))
    assert name_contrast(page) < AA
