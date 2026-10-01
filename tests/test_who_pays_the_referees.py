"""Public contracts for the first series piece, Who Pays the Referees."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_listings import load_listing

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "who-pays-the-referees.html"
PLANNED = ("The Terms for Telling", "Who Kept the Books", "The Maker Is Part of the Story", "A Check It Cannot Predict")
PLANNED_SLUGS = ("the-terms-for-telling", "who-kept-the-books", "the-maker", "a-check-it-cannot-predict")


def source() -> str:
    return PAGE.read_text(encoding="utf-8")


def visible_text(value: str) -> str:
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", value, flags=re.I | re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def test_listing_validates_and_joins_both_hubs() -> None:
    listing, stored = load_listing(ROOT / "publications/data/listings/who-pays-the-referees.json", ROOT)
    assert listing["route"] == "who-pays-the-referees.html"
    assert stored["hubs"] == ["publications", "writing"]
    assert listing["published_at"] == listing["updated_at"] == "2026-10-01"
    for hub in ("publications.html", "writing.html"):
        assert 'href="who-pays-the-referees.html"' in (ROOT / hub).read_text(encoding="utf-8")
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    assert "https://harperz9.github.io/who-pays-the-referees.html" in [item["url"] for item in feed["items"]]
    assert "<loc>https://harperz9.github.io/who-pays-the-referees.html</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")


def test_series_panel_names_planned_pieces_without_linking_them() -> None:
    page = source()
    panel = re.search(r'<aside class="wpr-series".*?</aside>', page, re.S).group(0)
    for title in PLANNED:
        assert title in panel
    assert panel.count("Planned.") == 4
    assert re.findall(r'href="([^"]+)"', panel) == ["who-knew-first.html"]
    for slug in PLANNED_SLUGS:
        assert slug not in page


def test_every_section_keeps_its_does_not_prove_line_and_labels() -> None:
    page = source()
    sections = re.findall(r'<section id="([a-z-]+)" aria-labelledby=.*?</section>', page, re.S)
    numbered = sections[:10]
    assert numbered[0] == "mechanism" and numbered[-1] == "the-test"
    for body in re.findall(r'<section id="(?:mechanism|access|publication|money|naming|governments|people|money-above|older-checkers|the-test)".*?</section>', page, re.S):
        assert '<p class="wpr-np"><strong>Does not prove.</strong>' in body
    assert page.count('class="wpr-label"') >= 60
    text = visible_text(page)
    for label in ("Documented fact", "Official claim", "Contested account", "Inference"):
        assert label in text


def test_ledger_lists_anthropic_first_and_carries_no_private_row_ids() -> None:
    page = source()
    labs = re.search(r'aria-labelledby="ledger-labs">(.*?)</table>', page, re.S).group(1)
    rows = re.findall(r'<th scope="row"[^>]*>([^<]+)</th>', labs)
    assert rows[:2] == ["Anthropic", "OpenAI"]
    assert re.search(r"\[[A-Z]{1,2}\d", page) is None
    assert "[court record]" in page and "[The Intercept]" in page


def test_public_surface_rules_hold() -> None:
    page = source()
    text = visible_text(page)
    assert "\u2014" not in page and "\u2013" not in page
    assert re.search(r"(?<![A-Za-z0-9+.-])[A-Za-z]:[\/]", re.sub(r"https?://\S+", "", text)) is None
    for internal in ("OPTIONAL AUTHOR PARAGRAPH", "Author to confirm", "row IDs", "1 October follow-up", "writing-profile"):
        assert internal not in page
    assert "Claude Opus 5.5" in text and "same-maker check" in text
    assert "not yet on that page" in text
