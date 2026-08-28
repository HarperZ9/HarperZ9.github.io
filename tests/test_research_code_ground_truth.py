"""Research-facing copy must report each repository's measured state separately."""

from html.parser import HTMLParser
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def page(name: str) -> str:
    return (ROOT / name).read_text(encoding="utf-8")


class _ResearchOpening(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.in_opening = False
        self.depth = 0
        self.text: list[str] = []
        self.links: set[str] = set()
        self.has_canvas = False

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attributes = dict(attrs)
        classes = (attributes.get("class") or "").split()
        if tag == "header" and "research-opening" in classes:
            self.in_opening = True
            self.depth = 1
            return
        if not self.in_opening:
            return
        self.depth += 1
        if tag == "a" and attributes.get("href"):
            self.links.add(attributes["href"])
        if tag == "canvas":
            self.has_canvas = True

    def handle_endtag(self, tag: str) -> None:
        if not self.in_opening:
            return
        self.depth -= 1
        if self.depth == 0:
            self.in_opening = False

    def handle_data(self, data: str) -> None:
        if self.in_opening and data.strip():
            self.text.append(data.strip())


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


def test_research_opening_routes_to_current_public_artifacts_before_the_index() -> None:
    source = page("research.html")
    opening = _ResearchOpening()
    opening.feed(source)
    text = " ".join(opening.text)

    assert source.index('class="research-opening"') < source.index("<section")
    assert not opening.has_canvas
    assert {
        "chorus.html",
        "https://github.com/HarperZ9/faithful-transpile",
        "witnessing-spine.html",
        "https://github.com/HarperZ9/senses-and-sensibility",
    } <= opening.links
    assert "Chorus" in text and "58 tests pass" in text
    assert "faithful-transpile" in text and "eight hermetic tests pass" in text
    assert "The Witnessing Spine" in text and "one of seven listed files does not re-derive" in text
    assert "Senses and Sensibility" in text and "all 172 listed files re-derive" in text
    assert "pre-proof" in text and "six index targets missing" in text


def test_publication_corpora_link_their_source_and_disclose_current_seal_state() -> None:
    source = page("publications.html")
    lower = source.lower()

    assert "https://github.com/HarperZ9/senses-and-sensibility" in source
    assert "all 172 listed files currently re-derive" in lower
    assert "https://github.com/HarperZ9/witnessing-spine" in source
    assert "seven-file manifest that currently returns DRIFT" in source
    assert "does not ship an executable verifier" in source
