"""Research-facing copy must report each repository's measured state separately."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def page(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


def test_chorus_page_names_the_implemented_method_and_current_test_evidence() -> None:
    source = page("chorus.html")

    assert "deterministic hashed-TF-IDF" in source
    assert "English-only" in source
    assert "58 tests passed" in source
    assert "excluded from the deterministic receipt" in source


def test_research_index_keeps_repository_integrity_states_distinct() -> None:
    source = page("research.html")
    lower = source.lower()

    assert "Updated 2026-08-28" in source
    assert "Chorus" in source and "chorus.html" in source
    assert "The Witnessing Spine" in source
    assert "one of seven listed files" in source
    assert "default public branch has a seven-file" in lower
    assert "no executable verifier or test suite" in lower
    assert "eight hermetic tests pass" in source
    assert "16 match, 29 drift, and three are missing" in source
    assert "all 172 listed files re-derive" in source
    assert "pre-proof" in source


def test_publication_corpora_link_their_source_and_disclose_current_seal_state() -> None:
    source = page("publications.html")
    lower = source.lower()

    assert "https://github.com/HarperZ9/senses-and-sensibility" in source
    assert "all 172 listed files currently re-derive" in lower
    assert "https://github.com/HarperZ9/witnessing-spine" in source
    assert "seven-file manifest that currently returns DRIFT" in source
    assert "does not ship an executable verifier" in source
