"""Contracts for the October 2026 edition of the six philosophy papers and the spine foreword."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from tools.render_papers import PAPERS

ROOT = Path(__file__).resolve().parents[1]


def test_each_page_matches_its_approved_source() -> None:
    result = subprocess.run([sys.executable, "tools/render_papers.py", "--check"], cwd=ROOT,
                            capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr


def test_each_page_shows_its_registers_and_a_dated_revision_note() -> None:
    for name, spec in PAPERS.items():
        page = (ROOT / name).read_text(encoding="utf-8")
        for kind in ("plain", "steelman", "open"):
            assert f'class="register register--{kind}"' in page, (name, kind)
        assert '<aside class="revision-note" id="revision">' in page and "Revised 3 October 2026." in page, name
        assert (ROOT / spec["pdf"]).is_file(), name
        if "prior" in spec:
            assert f'https://doi.org/{spec["prior"][0]}' in page, name


def test_sources_carry_no_drafting_scaffolding_or_dashes() -> None:
    for spec in PAPERS.values():
        text = (ROOT / spec["source"]).read_text(encoding="utf-8")
        for marker in ("[AUTHOR", "[PROPOSED", "(Q1", "(Q2", "(U2", "APPROVAL-v3", "REGISTER-MAP", "CONTEXT.md",
                       "Draft v3", "\u2014", "\u2013"):
            assert marker not in text, (spec["source"], marker)


def test_spine_foreword_sits_above_the_unchanged_deposit() -> None:
    page = (ROOT / "witnessing-spine.html").read_text(encoding="utf-8")
    assert page.index('<section id="foreword"') < page.index("Three traditions that never met")
    assert "and I approved it paragraph by paragraph." in page
