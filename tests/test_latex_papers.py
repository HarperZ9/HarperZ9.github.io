"""The LaTeX paper PDFs match their build receipts, and the receipts match their sources.

tools/build_latex_papers.py needs Tectonic to build; this test needs nothing beyond the
repository. It fails when a paper source, a generated .tex file or a PDF changes without a
rebuild, so a PDF can never claim a receipt it no longer matches.
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from tools import build_latex_papers
from tools.render_papers import PAPERS

ROOT = Path(__file__).resolve().parents[1]
RECEIPTS = sorted((ROOT / "papers" / "receipts").glob("*.json"))


def test_every_receipt_matches_its_source_tex_and_pdf() -> None:
    assert build_latex_papers.check() == 0


def test_receipts_cover_all_thirteen_latex_papers() -> None:
    names = {path.stem for path in RECEIPTS}
    expected = {Path(spec["pdf"]).stem for spec in PAPERS.values()} | set(build_latex_papers.RESEARCH)
    assert names == expected


def test_receipts_record_two_identical_runs_and_no_local_paths() -> None:
    for path in RECEIPTS:
        text = path.read_text(encoding="utf-8")
        receipt = json.loads(text)
        assert receipt["schema"] == "paper-build-receipt/v1"
        assert receipt["runs"] == 2 and receipt["rebuild_identical"] is True, path.name
        assert receipt["engine"]["name"].startswith("Tectonic "), path.name
        assert receipt["bundle"]["digest"] == build_latex_papers.BUNDLE["digest"], path.name
        assert re.fullmatch(r"[0-9a-f]{64}", receipt["source"]["sha256"]), path.name
        assert receipt["does_not_prove"], path.name
        assert not re.search(r"[A-Za-z]:[\\/]|/Users/|AppData", text), f"{path.name} names a local path"


def test_paper_pages_link_their_tex_and_receipt() -> None:
    for page, spec in PAPERS.items():
        stem = Path(spec["pdf"]).stem
        html = (ROOT / page).read_text(encoding="utf-8")
        assert f'href="papers/receipts/{stem}.json"' in html, page
        assert f'href="papers/tex/{stem}.tex"' in html, page


def test_converter_escapes_specials_and_keeps_register_marks() -> None:
    from tools.paper_latex import inline

    out = inline('**[PLAIN]** 5% of A^-1 & "quoted" *emphasis* https://doi.org/10.1/x_y.')
    assert r"\register{[PLAIN]}" in out
    assert r"5\%" in out and r"\textasciicircum{}" in out and r"\&" in out
    assert "``quoted''" in out and r"\emph{emphasis}" in out
    assert r"\url{https://doi.org/10.1/x_y}." in out
