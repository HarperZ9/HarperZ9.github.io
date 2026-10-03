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


def test_receipts_cover_all_fifteen_papers_and_the_essay() -> None:
    # 3 October 2026: the essay No Receipt, No Accept joins the LaTeX path, so sixteen receipts.
    names = {path.stem for path in RECEIPTS}
    expected = ({Path(spec["pdf"]).stem for spec in PAPERS.values()} | set(build_latex_papers.RESEARCH)
                | set(build_latex_papers.CORPORA) | set(build_latex_papers.ESSAYS))
    assert len(expected) == 16
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


def test_corpus_receipts_pin_the_public_source_and_the_site_additions() -> None:
    """A corpus PDF adds a foreword and dated corrections to a deposit that lives in its
    own repository. Its receipt names that repository, commit and file hash, and the hash
    of every site file the PDF adds, so a changed foreword or correction fails the check."""
    for name, (page, repo, file) in build_latex_papers.CORPORA.items():
        receipt = json.loads((ROOT / "papers" / "receipts" / f"{name}.json").read_text(encoding="utf-8"))
        source = receipt["source"]
        assert source["repository"] == f"github.com/HarperZ9/{repo}" and source["path"] == file
        assert re.fullmatch(r"[0-9a-f]{40}", source["commit"])
        assert source["page"] == page
        assert source["site_inputs"] == build_latex_papers.corpus_inputs(page)
        tex = (ROOT / source["tex"]).read_text(encoding="utf-8")
        assert source["sha256"] in tex, f"{name}: the .tex does not carry its source hash"
        assert f'href="papers/{name}.pdf"' in (ROOT / page).read_text(encoding="utf-8")
    spine = (ROOT / "papers" / "tex" / "witnessing-spine.tex").read_text(encoding="utf-8")
    assert r"\section*{Foreword, 2 October 2026}" in spine
    assert spine.count("A dated correction to this passage") == 2


def test_corpus_converter_sets_right_to_left_words_and_missing_signs() -> None:
    from tools.corpus_latex import inline

    out = inline("emet (truth, \u05d0\u05de\u05ea), kun (\u0643\u0646), the Prophet (\ufdfa), \u2205 \u2260 \u2205")
    assert "\\HE{\u05d0\u05de\u05ea}" in out and "\\AR{\u0643\u0646}" in out
    # No pinned font has the U+FDFA glyph, so it is set as its compatibility decomposition.
    assert "\ufdfa" not in out and "\\AR{\u0635\u0644\u0649" in out
    assert r"\ensuremath{\emptyset}" in out and r"\ensuremath{\neq}" in out


def test_converter_escapes_specials_and_keeps_register_marks() -> None:
    from tools.paper_latex import inline

    out = inline('**[PLAIN]** 5% of A^-1 & "quoted" *emphasis* https://doi.org/10.1/x_y.')
    assert r"\register{[PLAIN]}" in out
    assert r"5\%" in out and r"\textasciicircum{}" in out and r"\&" in out
    assert "``quoted''" in out and r"\emph{emphasis}" in out
    assert r"\url{https://doi.org/10.1/x_y}." in out


def test_essay_pdf_is_typeset_from_the_text_its_page_renders() -> None:
    """3 October 2026: the essay PDF is typeset from the single-file source, which carries the
    approved revision of 25 September 2026 and the corrections of 3 October 2026. It replaces the
    Chromium print of 28 July 2026, which stays in the repository history."""
    for name, essay in build_latex_papers.ESSAYS.items():
        receipt = json.loads((ROOT / "papers" / "receipts" / f"{name}.json").read_text(encoding="utf-8"))
        assert receipt["paper"] == essay["pdf"]
        assert receipt["source"]["path"] == essay["source"]
        tex = (ROOT / receipt["source"]["tex"]).read_text(encoding="utf-8")
        assert receipt["source"]["sha256"] in tex
        page = (ROOT / essay["page"]).read_text(encoding="utf-8")
        assert f'href="{essay["pdf"]}"' in page and f'href="papers/receipts/{name}.json"' in page
        assert "keeps the text first published on 28 July 2026" not in page
