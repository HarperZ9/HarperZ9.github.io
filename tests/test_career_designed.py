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
