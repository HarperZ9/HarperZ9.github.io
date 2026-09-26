"""Listing records put hand-authored works into the dated index without rendering their pages."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from tools.publication_listings import load_listing, resolve_date_source
from tools.publication_model import PublicationError

ROOT = Path(__file__).resolve().parents[1]
LISTINGS = sorted((ROOT / "publications" / "data" / "listings").glob("*.json"))


def _generated(text: str, marker: str) -> str:
    return text.split(f"<!-- BEGIN {marker} -->", 1)[1].split(f"<!-- END {marker} -->", 1)[0]


def test_every_listing_validates_and_points_at_a_real_page() -> None:
    assert {path.stem for path in LISTINGS} == {
        "who-knew-first", "checking-the-machines", "frontier-safety",
        "openai-hugging-face-incident", "a-witness-should-not-become-a-ruler",
    }
    for path in LISTINGS:
        listing, stored = load_listing(path, ROOT)
        assert listing["id"] == path.stem
        assert stored["schema_version"] == 1


def test_briefing_listing_reads_its_date_from_the_current_edition() -> None:
    listing, stored = load_listing(ROOT / "publications/data/listings/frontier-safety.json", ROOT)
    current = json.loads((ROOT / "frontier-safety/data/current.json").read_text(encoding="utf-8"))
    assert stored["date_source"] == "frontier-safety/data/current.json#edition_date"
    assert listing["updated_at"] == current["edition_date"]


def test_listings_join_the_hubs_they_name_and_stay_out_of_the_sitemap_block() -> None:
    publications = _generated((ROOT / "publications.html").read_text(encoding="utf-8"), "GENERATED EDITORIAL PUBLICATIONS")
    writing = _generated((ROOT / "writing.html").read_text(encoding="utf-8"), "GENERATED EDITORIAL ESSAYS")
    sitemap = _generated((ROOT / "sitemap.xml").read_text(encoding="utf-8"), "GENERATED EDITORIAL ROUTES")
    for path in LISTINGS:
        listing, _stored = load_listing(path, ROOT)
        href = f'href="{listing["route"]}"'
        assert (href in publications) == ("publications" in listing["hubs"])
        assert (href in writing) == ("writing" in listing["hubs"])
        assert listing["route"].lstrip("/") not in sitemap


def test_publications_index_leads_with_the_newest_work() -> None:
    publications = _generated((ROOT / "publications.html").read_text(encoding="utf-8"), "GENERATED EDITORIAL PUBLICATIONS")
    dates = re.findall(r'class="publication-meta">[^<]*· (\d{4}-\d{2}-\d{2})</p>', publications)
    assert dates and dates == sorted(dates, reverse=True)
    assert publications.index('href="who-knew-first.html"') < publications.index('href="checking-the-machines.html"')


def test_feeds_carry_listings_once() -> None:
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    urls = [item["url"] for item in feed["items"]]
    assert len(urls) == len(set(urls))
    for path in LISTINGS:
        listing, _stored = load_listing(path, ROOT)
        assert "https://harperz9.github.io/" + listing["route"].lstrip("/") in urls


def _write(tmp_path: Path, **changes) -> Path:
    data = json.loads((ROOT / "publications/data/listings/checking-the-machines.json").read_text(encoding="utf-8"))
    data.update(changes)
    path = tmp_path / "listing.json"
    path.write_text(json.dumps(data), encoding="utf-8")
    return path


@pytest.mark.parametrize("changes, message", [
    ({"summary": "An em dash — here."}, "em dash"),
    ({"route": "no-such-page.html"}, "does not exist"),
    ({"hubs": ["elsewhere"]}, "hubs"),
    ({"updated_at": "2026-09-01"}, "precedes"),
    ({"extra": 1}, "exactly the listing fields"),
])
def test_invalid_listings_are_refused(tmp_path: Path, changes: dict, message: str) -> None:
    with pytest.raises(PublicationError, match=message):
        load_listing(_write(tmp_path, **changes), ROOT)


def test_date_source_must_name_a_real_field() -> None:
    with pytest.raises(PublicationError, match="field is missing"):
        resolve_date_source(ROOT, "frontier-safety/data/current.json#no_such_field", "listing test")
