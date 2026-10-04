"""Public release contracts for the October Atlas essay The Number Has a Vintage."""

from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

from tools.publication_model import validate_record


ROOT = Path(__file__).resolve().parents[1]
SLUG = "the-number-has-a-vintage"
BASE_URL = "https://harperz9.github.io/"


def record() -> dict:
    return json.loads(
        (ROOT / "publications/data/records" / f"{SLUG}.json").read_text(encoding="utf-8")
    )


def paragraphs(payload: dict) -> list[str]:
    return [paragraph for section in payload["sections"] for paragraph in section["paragraphs"]]


def claim(payload: dict, claim_id: str) -> dict:
    return next(item for item in payload["claims"] if item["id"] == claim_id)


def figure(payload: dict, figure_id: str) -> dict:
    return next(item for item in payload["figures"] if item["id"] == figure_id)


def visible_text(source: str) -> str:
    without_scripts = re.sub(
        r"<(script|style)\b[^>]*>.*?</\1>", " ", source, flags=re.I | re.S
    )
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", without_scripts)).split())


def test_record_validates_without_unadopted_personal_voice() -> None:
    payload = record()
    validate_record(payload)
    assert payload["route"] == f"{SLUG}.html"
    assert payload["personal_voice_adopted"] is False
    assert re.search(r"\b(i|me|my|mine|we|our|ours)\b", " ".join(paragraphs(payload)), re.I) is None
    assert all(item["doesNotProve"].strip() for item in payload["claims"])
    assert all(item["doesNotProve"].strip() for item in payload["figures"])


def test_march_2026_example_stays_preliminary_and_names_its_final_date() -> None:
    payload = record()
    copy = " ".join(paragraphs(payload))
    preview = claim(payload, "march-2026-preview")
    assert "minus 79,000, or minus 0.1 percent" in copy
    assert "left unchanged by this preview" in copy
    assert "scheduled for February 2027" in copy
    assert "A loss of 79,000 jobs in any month" in preview["doesNotProve"]
    sources = {item["id"]: item for item in payload["sources"]}
    assert preview["source_ids"] == ["prebmk-2026"]
    assert sources["prebmk-2026"]["url"] == "https://www.bls.gov/news.release/archives/prebmk_08282026.htm"
    assert sources["prebmk-2026"]["published_at"] == "2026-08-28"


def test_march_2025_keeps_both_not_seasonally_adjusted_figures_apart() -> None:
    # The benchmark revision after the banking reconstruction is -861,000; the total
    # revision against the previously published estimate is -862,000. Neither may
    # silently replace the other, and the seasonally adjusted -898,000 stays separate.
    payload = record()
    copy = " ".join(paragraphs(payload))
    assert "911,000 below the survey's not seasonally adjusted estimate" in copy
    assert "put that gap at 861,000, or 0.5 percent" in copy
    assert "the total not seasonally adjusted revision was minus 862,000" in copy
    assert "fell by 898,000 in the revision, or 0.6 percent" in copy
    assert "reconstruction of two banking series" in copy
    rows = {row[0]: row for row in figure(payload, "vintage-benchmark-records")["rows"]}
    assert rows["March 2025 preliminary benchmark"][3] == "minus 911,000 (minus 0.6 percent)"
    assert rows["March 2025 final benchmark revision"][3] == "minus 861,000 (minus 0.5 percent)"
    assert rows["March 2025 total revision against the previously published estimate"][3] == (
        "minus 862,000 (minus 0.5 percent)"
    )
    assert rows["March 2025 final revision"][2] == "Seasonally adjusted"
    assert rows["March 2026 preliminary benchmark"][4].startswith("No.")
    assert "minus 861,000 less minus 911,000" in figure(payload, "vintage-benchmark-records")["transformation"]


def test_inferred_claims_keep_their_label_and_unread_source_is_disclosed() -> None:
    payload = record()
    for claim_id in ("real-time-versus-latest", "revision-not-motive", "six-field-check"):
        assert claim(payload, claim_id)["status"] == "inferred"
    assert "has not been tested with readers" in " ".join(paragraphs(payload))
    assert "BLS has not adopted it" in " ".join(paragraphs(payload))
    croushore = next(item for item in payload["sources"] if item["id"] == "croushore-stark")
    assert "was not read" in croushore["role"]


def test_generated_page_has_full_nojs_body_sources_figures_and_share_metadata() -> None:
    payload = record()
    source = (ROOT / payload["route"]).read_text(encoding="utf-8")
    article = re.search(r"<article\b[^>]*>(.*?)</article>", source, re.S)
    assert article is not None
    text = visible_text(article.group(1))
    for paragraph in paragraphs(payload):
        assert " ".join(paragraph.split()) in text
    for item in payload["sources"]:
        assert f'href="{html.escape(item["url"], quote=True)}"' in source
    for item in payload["claims"]:
        assert item["doesNotProve"] in text
    for item in payload["figures"]:
        assert item["title"] in text
        for row in item["rows"]:
            assert row[0] in text
        assert (ROOT / "figures" / f"{item['id']}.svg").is_file()
        assert (ROOT / "figures" / f"{item['id']}.html").is_file()
    assert f'<link rel="canonical" href="{BASE_URL}{SLUG}.html">' in source
    assert f'property="og:image" content="{BASE_URL}img/og/p/{SLUG}.jpg?v=' in source
    assert (ROOT / "img/og/p" / f"{SLUG}.jpg").is_file()


def test_released_route_is_discoverable_in_feeds_listings_and_site_index() -> None:
    payload = record()
    url = BASE_URL + payload["route"]
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    items = [item for item in feed["items"] if item["url"] == url]
    assert len(items) == 1 and items[0]["title"] == payload["title"]
    atom = ET.parse(ROOT / "feed.xml")
    ns = {"a": "http://www.w3.org/2005/Atom"}
    entries = [item for item in atom.findall("a:entry", ns) if item.findtext("a:id", namespaces=ns) == url]
    assert len(entries) == 1
    for listing in ("publications.html", "writing.html", "site-index.html"):
        assert f'href="{SLUG}.html"' in (ROOT / listing).read_text(encoding="utf-8")
    assert f"<loc>{url}</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
