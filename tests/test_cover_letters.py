"""The cover letter files come from their sources, and placeholders stay in the template."""
from __future__ import annotations

from pathlib import Path
import re
import subprocess
import sys

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
LETTER = ROOT / "career" / "cover-letter-evaluation.md"
TEMPLATE = ROOT / "career" / "cover-letter-evaluation-template.md"
PDF = ROOT / "career" / "Zain-Dana-Harper-Cover-Letter-Evaluation.pdf"


def test_committed_cover_letter_files_match_a_fresh_build() -> None:
    proc = subprocess.run([sys.executable, "tools/build_cover_letters.py", "--check"],
                          cwd=ROOT, capture_output=True, text=True)
    assert proc.returncode == 0, proc.stdout + proc.stderr


def test_general_letter_is_short_and_opens_with_a_result() -> None:
    """Result first, then why the role, then the plain background, then what he wants to do."""
    text = LETTER.read_text(encoding="utf-8")
    body = text[text.index("Dear hiring team"):text.rindex("Zain Dana Harper")]
    assert len(body.split()) < 300
    paragraphs = [p for p in body.split("\n\n") if p.strip()][1:]
    assert len(paragraphs) == 4
    assert "64 of 66" in paragraphs[0] and "merged, not yet released" in paragraphs[0]
    for lack in ("weak point", "not yet held", "no professional", "no paid"):
        assert lack not in paragraphs[0] and lack not in paragraphs[1], lack
    assert "about thirteen years" in paragraphs[2]
    assert "I have not yet held a paid software role or a paid red-team engagement." in paragraphs[2]
    assert body.count("not yet held") == 1
    assert "relocate" not in body
    page = (ROOT / "cover-letter.html").read_text(encoding="utf-8")
    opening = page.split("<p>Dear reviewer,</p>", 1)[1].split("</p>", 1)[0]
    assert "have merged" in opening and "not yet held" not in opening
    assert page.count("I have not yet held a paid software role.") == 1
    for banned in ("—", "@", "[COMPANY]", "[ROLE]"):
        assert banned not in text, banned
    assert not re.search(r"\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}", text), "a phone number is in the letter"


def test_letter_pdf_is_one_page_and_carries_the_letter() -> None:
    reader = PdfReader(PDF)
    assert len(reader.pages) == 1
    words = lambda s: re.findall(r"[A-Za-z0-9]+", s)
    assert words(reader.pages[0].extract_text()) == words(LETTER.read_text(encoding="utf-8").lstrip("# "))


def test_placeholders_live_only_in_the_template() -> None:
    template = TEMPLATE.read_text(encoding="utf-8")
    assert "[COMPANY]" in template and "[ROLE]" in template
    for page in ROOT.glob("*.html"):
        source = page.read_text(encoding="utf-8", errors="replace")
        assert "[COMPANY]" not in source and "[ROLE]" not in source, page.name
