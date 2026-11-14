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


def test_general_letter_is_short_plain_and_states_the_weak_point() -> None:
    text = LETTER.read_text(encoding="utf-8")
    body = text[text.index("Dear hiring team"):text.rindex("Zain Dana Harper")]
    assert len(body.split()) < 300
    assert "no professional programming experience" in body
    assert "no paid red-team engagement" in body
    assert "merged, not yet released" in body
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
