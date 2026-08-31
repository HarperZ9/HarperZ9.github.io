"""Editorial-front-door and publication-lane contracts."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(rel: str) -> str:
    return (ROOT / rel).read_text(encoding="utf-8")


def test_publications_is_an_editorial_front_door_before_a_catalog() -> None:
    page = read("publications.html")
    text = " ".join(re.sub(r"<[^>]+>", "", page).split())

    assert "A field journal for evidence, systems, and human consequence." in text
    assert page.index('id="reading-paths"') < page.index('id="publication-index"')
    assert page.index('id="publication-index"') < page.index('id="research-records"')
    assert 'href="#reading-paths"' in page
    assert 'href="#publication-index"' in page
    assert 'href="#research-records"' in page


def test_reading_paths_cover_the_requested_interests_without_fake_posts() -> None:
    page = read("publications.html")
    paths = {
        "ai-frontier": "published",
        "psychology-trauma": "published-adjacent",
        "education-access": "open",
        "tools-systems": "published",
        "music-listening": "open",
        "abstract-art": "published-adjacent",
    }
    for path_id, state in paths.items():
        match = re.search(
            rf'<article[^>]*data-path="{path_id}"[^>]*data-state="{state}"[^>]*>',
            page,
        )
        assert match, f"missing truth-bounded reading path: {path_id} / {state}"

    assert "No dedicated essay is published in this lane yet." in page
    assert "not a clinical or diagnostic claim" in page
    assert "visual work, not a claimed essay archive" in page


def test_published_index_has_current_briefings_and_existing_essays() -> None:
    page = read("publications.html")
    for href in (
        "frontier-safety.html",
        "/briefings/2026-08-26-openai-hugging-face-incident/",
        "models-propose-oracles-dispose.html",
        "no-receipt-no-accept.html",
        "pick-the-lock-for-everyone.html",
        "the-summary-is-not-the-record.html",
        "writing.html#verified",
        "writing.html#conferred",
    ):
        assert f'href="{href}"' in page, href

    assert page.count("data-publication-entry") >= 8


def test_search_and_filter_are_secondary_progressive_enhancement() -> None:
    page = read("publications.html")
    script = read("system/publications.js")

    assert '<details class="publication-tools">' in page
    assert '<label for="publication-search">' in page
    assert 'type="search"' in page
    assert 'data-publication-filter="all"' in page
    assert '<script src="system/publications.js' in page
    assert "data-publication-entry" in script
    assert "hidden" in script
    assert "aria-pressed" in script
    assert 'data-publication-result-count' in page
    assert 'role="status"' in page
    assert 'aria-live="polite"' in page
    assert "resultCount.textContent" in script
    assert "No published item matches" in page


def test_publication_visual_system_has_accessibility_fallbacks() -> None:
    page = read("publications.html")
    writing = read("writing.html")
    css = read("system/publications.css")

    assert "system/fonts/conso-regular.woff2" in page
    assert "system/fonts/kilon.woff2" not in page
    assert "system/fonts/conso-regular.woff2" in writing
    assert "system/fonts/kilon.woff2" not in writing
    assert 'class="publication-spectrum"' in page
    assert "This is an orientation map, not a quantitative chart" in page
    assert "data-specimen" not in page
    for contract in (
        "@media (max-width: 52rem)",
        "@media (prefers-reduced-motion: reduce)",
        "@media (forced-colors: active)",
        "@media print",
        "min-block-size: 44px",
    ):
        assert contract in css
