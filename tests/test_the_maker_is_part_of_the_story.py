"""Public contracts for the fourth series piece, The Maker Is Part of the Story."""

from __future__ import annotations

import html
import json
import re
from pathlib import Path

from tools.publication_listings import load_listing

ROOT = Path(__file__).resolve().parents[1]
SLUG = "the-maker-is-part-of-the-story"
PAGE = ROOT / f"{SLUG}.html"
SERIES = json.loads((ROOT / "publications/data/series/who-knew-first.json").read_text(encoding="utf-8"))
NUMBERED = ("mechanism", "frankenstein", "pinocchio", "fifth-element", "critic", "connects")


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
                "the-terms-for-telling.html", "who-kept-the-books.html"):
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
    assert tuple(sections[:6]) == NUMBERED
    for sid in NUMBERED[:4]:
        body = re.search(rf'<section id="{sid}".*?</section>', page, re.S).group(0)
        assert "Does not prove:" in visible_text(body), sid
    text = visible_text(page)
    for label in ("documented fact", "official claim", "inference"):
        assert label in text.lower()


def test_gate_reads_before_publication_hold() -> None:
    text = visible_text(source())
    # Hugging Face's live timeline says "We believe"; the word "likely" is not on the page.
    assert "carries their words \"we believe\"" in text
    assert "reads the goal as likely" not in text
    # Netflix's ending page: the Creature finds Harlander's abandoned photographs of the corpse.
    assert "Harlander photographed the experiment" not in text
    # Held items stay held: the studio quote and The Fifth Element's test scene.
    assert "is the studio" not in text
    assert "held from this piece" in text


def test_public_surface_rules_hold() -> None:
    page = source()
    text = visible_text(page)
    assert "\u2014" not in page and "\u2013" not in page
    assert re.search(r"(?<![A-Za-z0-9+.-])[A-Za-z]:[\/]", re.sub(r"https?://\S+", "", text)) is None
    for internal in ("OPTIONAL AUTHOR PARAGRAPH", "writing-profile", "Articulate check", "CARRY-FORWARD", "MAKER T1"):
        assert internal not in page
    assert "Claude Opus 5.5" in text and "That is not an outside review." in text
