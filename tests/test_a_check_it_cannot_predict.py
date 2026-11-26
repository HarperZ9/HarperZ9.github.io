"""Public contracts for the fifth series piece, A Check It Cannot Predict."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_listings import load_listing

ROOT = Path(__file__).resolve().parents[1]
SLUG = "a-check-it-cannot-predict"
PAGE = ROOT / f"{SLUG}.html"
SERIES = json.loads((ROOT / "publications/data/series/who-knew-first.json").read_text(encoding="utf-8"))
NUMBERED = ("question", "mechanism", "people", "models", "institutions", "watchers", "the-test")


def source() -> str:
    return PAGE.read_text(encoding="utf-8")


def visible_text(value: str) -> str:
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", value, flags=re.I | re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def test_listing_validates_and_joins_the_hub_the_series_and_the_feeds() -> None:
    listing, _stored = load_listing(ROOT / f"publications/data/listings/{SLUG}.json", ROOT)
    assert listing["route"] == f"{SLUG}.html"
    assert listing["published_at"] == "2026-10-08"
    for hub in ("publications.html", "who-knew-first-series.html", "who-pays-the-referees.html",
                "the-terms-for-telling.html", "who-kept-the-books.html", "the-maker-is-part-of-the-story.html"):
        assert f'href="{SLUG}.html"' in (ROOT / hub).read_text(encoding="utf-8"), hub
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    assert f"https://harperz9.github.io/{SLUG}.html" in [item["url"] for item in feed["items"]]
    assert f"<loc>https://harperz9.github.io/{SLUG}.html</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert (ROOT / f"img/og/{SLUG}.png").is_file()


def test_series_panel_links_published_pieces_and_names_planned_ones_without_links() -> None:
    panel = re.search(r'<aside class="wpr-series".*?</aside>', source(), re.S).group(0)
    published = [part["id"] for part in SERIES["parts"] if part["id"] and part["id"] != SLUG]
    planned = [part["title"] for part in SERIES["parts"] if not part["id"]]
    assert panel.count("Planned.") == len(planned)
    assert re.findall(r'href="([^"]+)"', panel) == (
        ["who-knew-first.html"] + [f"{pid}.html" for pid in published] + ["who-knew-first-series.html"])


def test_sections_and_limits_travel_with_the_piece() -> None:
    page = source()
    sections = re.findall(r'<section id="([a-z-]+)" aria-labelledby=', page)
    assert tuple(sections[:7]) == NUMBERED
    for sid in ("mechanism", "people", "models", "institutions", "watchers"):
        body = re.search(rf'<section id="{sid}".*?</section>', page, re.S).group(0)
        assert "Does not prove:" in visible_text(body), sid
    text = visible_text(page)
    for label in ("documented fact", "official claim", "inference"):
        assert label in text.lower()


def test_a_design_with_no_result_and_held_passages_held() -> None:
    text = visible_text(source())
    assert "No part of the test has run." in text
    assert "These controls have not been executed." in text
    assert "No experiment has run." in text
    # Held: the golem passage (a link only), the turning points, the hardware fail-safe, Applegate's memo text.
    assert "fail-safe" not in text.lower()
    assert "is held until readers from the communities" in text
    assert "was not read, so whether it does is unknown" in text
    # The accord paragraph follows the AP's quotation of the text.
    assert "answers to each company's own board" not in text


def test_public_surface_rules_hold() -> None:
    page = source()
    text = visible_text(page)
    assert "\u2014" not in page and "\u2013" not in page
    assert re.search(r"(?<![A-Za-z0-9+.-])[A-Za-z]:[\/]", re.sub(r"https?://\S+", "", text)) is None
    for internal in ("OPTIONAL AUTHOR PARAGRAPH", "manuscript:", "Editor notes", "CARRY-FORWARD", "Freshness pass"):
        assert internal not in page
    assert "Claude Opus 5.5" in text and "none of this is an outside review" in text
