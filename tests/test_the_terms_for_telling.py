"""Public contracts for the second series piece, The Terms for Telling."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_listings import load_listing

ROOT = Path(__file__).resolve().parents[1]
PAGE = ROOT / "the-terms-for-telling.html"
PLANNED = ("Who Kept the Books", "The Maker Is Part of the Story", "A Check It Cannot Predict")
PLANNED_SLUGS = ("who-kept-the-books.html", "the-maker", "a-check-it-cannot-predict")
NUMBERED = ("routes", "contract", "naming", "category", "cost", "self-review", "recipients",
            "where-it-worked", "ai-record", "supports")


def source() -> str:
    return PAGE.read_text(encoding="utf-8")


def visible_text(value: str) -> str:
    value = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", value, flags=re.I | re.S)
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", value)).split())


def test_listing_validates_and_joins_the_hub_the_series_and_the_feeds() -> None:
    listing, _stored = load_listing(ROOT / "publications/data/listings/the-terms-for-telling.json", ROOT)
    assert listing["route"] == "the-terms-for-telling.html"
    assert listing["published_at"] == listing["updated_at"] == "2026-10-01"
    for hub in ("publications.html", "who-knew-first-series.html", "who-pays-the-referees.html"):
        assert 'href="the-terms-for-telling.html"' in (ROOT / hub).read_text(encoding="utf-8"), hub
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    assert "https://harperz9.github.io/the-terms-for-telling.html" in [item["url"] for item in feed["items"]]
    assert "<loc>https://harperz9.github.io/the-terms-for-telling.html</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert (ROOT / "img/og/the-terms-for-telling.png").is_file()


def test_series_panel_links_the_published_piece_and_names_planned_ones_without_links() -> None:
    page = source()
    panel = re.search(r'<aside class="wpr-series".*?</aside>', page, re.S).group(0)
    for title in PLANNED:
        assert title in panel
    assert panel.count("Planned.") == 3
    assert re.findall(r'href="([^"]+)"', panel) == [
        "who-knew-first.html", "who-pays-the-referees.html", "who-knew-first-series.html"]
    for slug in PLANNED_SLUGS:
        assert slug not in page


def test_every_numbered_section_keeps_labels_and_does_not_prove_lines() -> None:
    page = source()
    sections = re.findall(r'<section id="([a-z-]+)" aria-labelledby=', page)
    assert tuple(sections[:10]) == NUMBERED
    for sid in NUMBERED:
        body = re.search(rf'<section id="{sid}".*?</section>', page, re.S).group(0)
        labels = re.findall(r'<p class="wpr-np tft-label">(.*?)</p>', body, re.S)
        if sid != "supports" and sid != "routes":
            assert labels, sid
        for label in labels:
            assert "Does not prove" in label or "does not prove" in label or "proves nothing" in label, (sid, label[:80])
    text = visible_text(page)
    for label in ("Documented fact", "Contested account", "Inference", "official claim"):
        assert label in text


def test_does_not_claim_list_and_open_threads_travel_with_the_piece() -> None:
    page = source()
    claims = re.search(r'<section id="does-not-claim".*?</section>', page, re.S).group(0)
    assert claims.count("<li>") == 23
    threads = re.search(r'<section id="open-threads".*?</section>', page, re.S).group(0)
    assert threads.count("<li>") >= 6 + 4


def test_public_surface_rules_hold() -> None:
    page = source()
    text = visible_text(page)
    assert "—" not in page and "–" not in page
    assert re.search(r"(?<![A-Za-z0-9+.-])[A-Za-z]:[\/]", re.sub(r"https?://\S+", "", text)) is None
    for internal in ("OPTIONAL AUTHOR PARAGRAPH", "writing-profile", "Draft manuscript", "CARRY-FORWARD", "check2"):
        assert internal not in page
    assert "Claude Opus 5.5" in text and "same-maker check" in text
    assert "a later piece in this series that is not yet published" in text
    assert "600 Black men from Macon County, Alabama" in text


def test_dated_update_and_the_benton_count_correction() -> None:
    page = source()
    update = re.search(r'<aside class="tft-update" id="update-20261001".*?</aside>', page, re.S).group(0)
    assert page.index('id="update-20261001"') < page.index('<section id="routes"')
    labels = re.findall(r'<p class="wpr-np tft-label">(.*?)</p>', update, re.S)
    assert len(labels) == 2 and all("Does not prove" in label for label in labels)
    assert "That timing does not show causation" in update
    assert "are not repeated here" in update
    assert "three of its researchers resigned in public in 2026" in page
    assert "three public resignations in 2026" in page
    assert "and two public resignations in 2026" not in page
    corrections = re.search(r'<section id="corrections".*?</section>', page, re.S).group(0)
    assert "1 October 2026, correction, the Conflict note and section 2" in corrections
    assert "None yet." not in corrections
    assert "Added for the 1 October update" in page
