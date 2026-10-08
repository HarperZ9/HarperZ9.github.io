"""Public contracts for the third series piece, Who Kept the Books."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_listings import load_listing

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "who-kept-the-books.html"
SERIES = json.loads((ROOT / "publications/data/series/who-knew-first.json").read_text(encoding="utf-8"))
NUMBERED = ("count", "remedy", "ledger", "custody", "first-account", "inquiry", "backup", "ai-era",
            "negative-results", "two-answers")


def source() -> str:
    return PAGE.read_text(encoding="utf-8")


def visible_text(value: str) -> str:
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", value, flags=re.I | re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def test_listing_validates_and_joins_the_hub_the_series_and_the_feeds() -> None:
    listing, _stored = load_listing(ROOT / "publications/data/listings/who-kept-the-books.json", ROOT)
    assert listing["route"] == "who-kept-the-books.html"
    assert listing["published_at"] == "2026-10-08"
    for hub in ("publications.html", "who-knew-first-series.html", "who-pays-the-referees.html",
                "the-terms-for-telling.html"):
        assert 'href="who-kept-the-books.html"' in (ROOT / hub).read_text(encoding="utf-8"), hub
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    assert "https://harperz9.github.io/who-kept-the-books.html" in [item["url"] for item in feed["items"]]
    assert "<loc>https://harperz9.github.io/who-kept-the-books.html</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert (ROOT / "img/og/who-kept-the-books.png").is_file()


def test_series_panel_links_published_pieces_and_names_planned_ones_without_links() -> None:
    page = source()
    panel = re.search(r'<aside class="wpr-series".*?</aside>', page, re.S).group(0)
    published = [part["id"] for part in SERIES["parts"] if part["id"] and part["id"] != "who-kept-the-books"]
    planned = [part["title"] for part in SERIES["parts"] if not part["id"]]
    assert panel.count("Planned.") == len(planned)
    assert re.findall(r'href="([^"]+)"', panel) == (
        ["who-knew-first.html"] + [f"{pid}.html" for pid in published] + ["who-knew-first-series.html"])


def test_every_numbered_section_closes_with_what_it_does_not_prove() -> None:
    page = source()
    sections = re.findall(r'<section id="([a-z-]+)" aria-labelledby=', page)
    assert tuple(sections[1:11]) == NUMBERED
    # Section 9 reports two negative results and section 10 states the limits, so neither closes with the line.
    for sid in NUMBERED[:-2]:
        body = re.search(rf'<section id="{sid}".*?</section>', page, re.S).group(0)
        assert "Does not prove:" in visible_text(body), sid
    text = visible_text(page)
    for label in ("documented fact", "contested account", "inference", "official claim"):
        assert label in text.lower()


def test_gate_reads_before_publication_hold() -> None:
    text = visible_text(source())
    # Bartz: the 23 June 2025 order denied summary judgment on the pirated copies; it did not rule them unfair.
    assert "setting that question for trial" in text
    assert "pirated library copies was not." not in text
    # Lumumba: the first account was rejected by a UN inquiry in 1961; only Belgium's part waited forty years.
    assert "stood for forty years, until" not in text
    assert "A United Nations commission of inquiry concluded in 1961" in text
    assert "read through a transcription" not in text


def test_public_surface_rules_hold() -> None:
    page = source()
    text = visible_text(page)
    assert "\u2014" not in page and "\u2013" not in page
    assert re.search(r"(?<![A-Za-z0-9+.-])[A-Za-z]:[\/]", re.sub(r"https?://\S+", "", text)) is None
    for internal in ("OPTIONAL AUTHOR PARAGRAPH", "writing-profile", "editor's note", "CARRY-FORWARD",
                     "Freshness pass", "PUBLICATION-PLAN"):
        assert internal not in page
    assert "Claude Opus 5.5" in text and "None of this is an outside review." in text
    table = re.search(r'<section id="evidence-table".*?</section>', page, re.S).group(0)
    assert table.count("<tr>") == 1 + 18
