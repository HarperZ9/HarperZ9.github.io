"""The six published papers ship as direct PDFs and are linked from the
publications index. The seventh (faithfulness-conservation) note is
author-gated and must NOT appear here."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLICATIONS = ROOT / "publications.html"

PAPERS = {
    "papers/emet-integrity-witness.pdf": "10.5281/zenodo.21230267",
    "papers/buildlang-capability-effects.pdf": "10.5281/zenodo.21231253",
    "papers/witnessed-independence.pdf": "10.5281/zenodo.21232206",
    "papers/proof-packets.pdf": "10.5281/zenodo.21231406",
    "papers/personhood-gate-handoff.pdf": "10.5281/zenodo.21234475",
    "papers/re-perceived-effects.pdf": "10.5281/zenodo.21231311",
}


def test_paper_pdfs_exist_and_are_real_pdfs() -> None:
    for rel in PAPERS:
        p = ROOT / rel
        assert p.is_file(), rel
        head = p.read_bytes()[:5]
        assert head == b"%PDF-", rel
        assert p.stat().st_size > 10_000, rel


def test_publications_page_links_every_pdf_next_to_its_doi() -> None:
    html = PUBLICATIONS.read_text(encoding="utf-8")
    for rel, doi in PAPERS.items():
        assert f'href="{rel}"' in html, rel
        assert f'href="https://doi.org/{doi}"' in html, doi


def test_gated_faithfulness_note_is_not_published() -> None:
    html = PUBLICATIONS.read_text(encoding="utf-8")
    for marker in ("faithfulness-conservation", "Conserved Quantity Across Lossy"):
        assert marker not in html
    assert not (ROOT / "papers" / "faithfulness-conservation.pdf").exists()
