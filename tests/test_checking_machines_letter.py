"""Release checks for the September 2026 open-letter revision."""
from __future__ import annotations

import hashlib
import json
import re
import zipfile
from pathlib import Path
from urllib.parse import urlsplit, unquote
from xml.etree import ElementTree as ET

from docx import Document
from pypdf import PdfReader
from tools.render_legacy_essays import render_page

ROOT = Path(__file__).resolve().parents[1]
FOLDER = ROOT / "writing/checking-the-machines"
STEM = "An-Open-Letter-on-Checking-the-Machines"
NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}


def normalize(text):
    return re.sub(r"\s+", "", text).replace("\u00ad", "")


def visible(text):
    return re.sub(r"\[([^\]]+)\]\(https?://[^\s)]+\)", r"\1", text).strip("# ")


def test_letter_is_exact_static_render():
    page = ROOT / "checking-the-machines.html"
    assert page.read_bytes() == render_page(page, (Path("writing/checking-the-machines/01.md"),), "essay")
    html = page.read_text()
    assert '<link rel="canonical" href="https://harperz9.github.io/checking-the-machines.html">' in html
    assert 'Revised <time datetime="2026-09-20">' in html
    assert "essay-loader" not in html
    assert "A person should be able to question a machine" in html
    assert "Editorial candidate" not in html
    assert "ChatGPT assisted" in html


def test_letter_references_and_downloads_resolve():
    page = (ROOT / "checking-the-machines.html").read_text()
    anchors = set(re.findall(r'\bid="([^"]+)"', page))
    for href in re.findall(r'href="([^"]+)"', page):
        url = urlsplit(href)
        if url.netloc and url.netloc != "harperz9.github.io":
            continue
        path = ROOT / unquote(url.path.lstrip("/")) if url.path else ROOT / "checking-the-machines.html"
        if path.is_dir():
            path /= "index.html"
        assert path.exists(), href
        if url.fragment and path.suffix == ".html":
            assert re.search(rf'\bid="{re.escape(url.fragment)}"', path.read_text()), href
    assert {f"note-{i}" for i in range(1, 14)} <= anchors
    assert len(re.findall(r'aria-label="Download this letter"', page)) == 1


def test_letter_source_and_disclosure_ledger_match():
    source = (FOLDER / "01.md").read_bytes()
    notes = json.loads((FOLDER / "source-notes.json").read_text())
    assert notes["source_sha256"] == hashlib.sha256(source).hexdigest()
    assert len(notes["claims"]) == 13
    assert all(c["sources"] and c["supports"] for c in notes["claims"])
    assert notes["author_approval"]["state"] == "publication authorized"
    assert notes["unpinned_references"] == []
    assert "too strong, and I withdraw it" in source.decode()
    assert "has not been run" in source.decode()


def test_pdf_and_docx_contain_the_complete_source():
    source = (FOLDER / "01.md").read_text()
    pdf = PdfReader(FOLDER / f"downloads/{STEM}.pdf")
    assert 6 <= len(pdf.pages) <= 12
    pdf_text = normalize(" ".join(re.sub(r"Zain Dana Harper \| \d+", "", page.extract_text()) for page in pdf.pages))
    with zipfile.ZipFile(FOLDER / f"downloads/{STEM}.docx") as z:
        tree = ET.fromstring(z.read("word/document.xml"))
        docx_text = normalize(" ".join(e.text or "" for e in tree.findall(".//w:t", NS)))
        assert not tree.findall(".//w:tbl", NS)
        assert not tree.findall(".//w:txbxContent", NS)
        assert not tree.findall(".//w:vanish", NS)
    for block in source.strip().split("\n\n"):
        if block.strip() == "---":
            continue
        text = normalize(visible(block))
        assert text in pdf_text, f"PDF omission: {text[:90]}"
        assert text in docx_text, f"Word omission: {text[:90]}"
    links = [a.get_object() for page in pdf.pages for a in page.get("/Annots", [])]
    assert sum(a.get("/Subtype") == "/Link" for a in links) >= 25


def test_download_hashes_match_build_record():
    record = json.loads((FOLDER / "build.json").read_text())
    for output in record["outputs"]:
        assert hashlib.sha256((ROOT / output["path"]).read_bytes()).hexdigest() == output["sha256"]


def test_letter_word_layout_and_typography():
    doc = Document(FOLDER / f"downloads/{STEM}.docx")
    assert doc.styles["Normal"].font.name == "Times New Roman"
    assert doc.styles["Normal"].font.size.pt == 11.5
    for name in ("01.md", "reading-and-revision-note.md"):
        text = (FOLDER / name).read_text()
        assert "\u2014" not in text
        assert "\ue200" not in text
        assert "/mnt/data" not in text
