"""Verify all 4 tailored Wave 16E-2 cover letters (all formats, 1-page PDFs, clean copy)."""
from __future__ import annotations

from pathlib import Path
import re

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
V2 = ROOT / "career" / "v2"
TEMPLATE = ROOT / "career" / "cover-letter-evaluation-template.md"
TRACKS = [
    "Zain-Dana-Harper-Cover-Letter-Government-Policy",
    "Zain-Dana-Harper-Cover-Letter-Forestry-Trades-Lead",
    "Zain-Dana-Harper-Cover-Letter-AI-Eval-Systems-Direction",
    "Zain-Dana-Harper-Cover-Letter-Academic-Fellowship",
]


def test_cover_letter_v2_tracks_exist_in_all_formats_and_fit_one_page() -> None:
    for stem in TRACKS:
        for ext in ("_ATS.pdf", "_Designed.pdf", ".docx", ".md", ".txt"):
            fp = V2 / f"{stem}{ext}"
            assert fp.is_file() and fp.stat().st_size > 500, f"Missing {fp.name}"
        for suffix in ("_ATS.pdf", "_Designed.pdf"):
            reader = PdfReader(V2 / f"{stem}{suffix}")
            assert len(reader.pages) == 1, f"{stem}{suffix} exceeded 1 page"
            extracted = reader.pages[0].extract_text() or ""
            assert "Zain Dana Harper" in extracted, f"{stem}{suffix} missing name"
        txt = (V2 / f"{stem}.txt").read_text(encoding="utf-8")
        assert "\u2014" not in txt and "[COMPANY]" not in txt and "[ROLE]" not in txt
        for banned in ("weak point", "not yet held", "no paid software", "Dear reviewer"):
            assert banned.lower() not in txt.lower(), f"{stem}: found '{banned}'"
        assert not re.search(r"\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}", txt), f"phone in {stem}"


def test_cover_letter_page_mounts_all_four_tracks() -> None:
    page = (ROOT / "cover-letter.html").read_text(encoding="utf-8")
    for tid in ("government-policy", "forestry-trades", "ai-eval-systems", "academic-fellowship"):
        assert f'data-tab="{tid}"' in page and f'id="{tid}"' in page
    assert "not yet held" not in page.lower()


def test_placeholders_live_only_in_the_template() -> None:
    template = TEMPLATE.read_text(encoding="utf-8")
    assert "[COMPANY]" in template and "[ROLE]" in template
    for page in ROOT.glob("*.html"):
        source = page.read_text(encoding="utf-8", errors="replace")
        assert "[COMPANY]" not in source and "[ROLE]" not in source, page.name
