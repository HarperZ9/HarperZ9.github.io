"""Public release contracts for the four September Atlas essays."""

from __future__ import annotations

import html
import json
import re
import xml.etree.ElementTree as ET
from pathlib import Path

import pytest

from tools.publication_model import validate_record


ROOT = Path(__file__).resolve().parents[1]
SLUGS = (
    "support-has-more-than-one-record",
    "what-the-formula-counts",
    "the-scene-the-song-did-not-tell-you",
    "the-timestamp-is-not-the-order",
)
BASE_URL = "https://harperz9.github.io/"


def record(slug: str) -> dict:
    return json.loads(
        (ROOT / "publications/data/records" / f"{slug}.json").read_text(encoding="utf-8")
    )


def paragraphs(payload: dict) -> list[str]:
    return [paragraph for section in payload["sections"] for paragraph in section["paragraphs"]]


def claim(payload: dict, claim_id: str) -> dict:
    return next(item for item in payload["claims"] if item["id"] == claim_id)


def visible_text(source: str) -> str:
    without_scripts = re.sub(
        r"<(script|style)\b[^>]*>.*?</\1>", " ", source, flags=re.I | re.S
    )
    return " ".join(html.unescape(re.sub(r"<[^>]+>", " ", without_scripts)).split())


@pytest.mark.parametrize("slug", SLUGS)
def test_release_records_validate_without_unadopted_personal_voice(slug: str) -> None:
    payload = record(slug)
    validate_record(payload)
    assert payload["route"] == f"{slug}.html"
    assert payload["personal_voice_adopted"] is False
    assert re.search(r"\b(i|me|my|mine|we|our|ours)\b", " ".join(paragraphs(payload)), re.I) is None
    assert payload["sources"] and payload["claims"]
    assert all(item["doesNotProve"].strip() for item in payload["claims"])


@pytest.mark.parametrize(
    ("slug", "claim_id", "source_urls"),
    (
        (SLUGS[0], "bounded-experiment", {"https://pubmed.ncbi.nlm.nih.gov/17352603/"}),
        (SLUGS[1], "trial-null", {"https://pmc.ncbi.nlm.nih.gov/articles/PMC12119439/"}),
        (
            SLUGS[2],
            "imagery-consistency",
            {
                "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0293412",
                "https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0317174",
            },
        ),
        (SLUGS[3], "representation", {"https://www.rfc-editor.org/rfc/rfc3339.html"}),
    ),
)
def test_central_claim_links_to_its_supporting_source_not_merely_a_valid_id(
    slug: str, claim_id: str, source_urls: set[str]
) -> None:
    payload = record(slug)
    sources = {item["id"]: item["url"] for item in payload["sources"]}
    assert {sources[key] for key in claim(payload, claim_id)["source_ids"]} == source_urls


def test_support_retains_sample_task_and_clinical_limit() -> None:
    payload = record(SLUGS[0])
    copy = " ".join(paragraphs(payload))
    experiment = claim(payload, "bounded-experiment")
    assert "three experiments with 257 women" in copy
    assert "expected to give a stressful speech" in copy
    assert "the recipient does not report receiving help" in copy
    assert "257 women across three experiments" in experiment["scope"]
    assert "general clinical recommendation" in experiment["doesNotProve"]
    assert claim(payload, "interpretation-standard")["status"] == "inferred"


def test_readability_distinguishes_analyzed_responses_from_randomized_adults() -> None:
    payload = record(SLUGS[1])
    copy = " ".join(paragraphs(payload))
    trial = claim(payload, "trial-null")
    assert "2,235 complete, valid responses" in copy
    assert "2,235 complete, valid analyzed responses from 2,639 randomized" in trial["scope"]
    assert "two health topics" in trial["scope"]
    assert "Immediate outcomes" in trial["uncertainty"]
    assert "grade-eight lower boundary" in trial["uncertainty"]
    assert "Equivalence" in trial["doesNotProve"]
    assert "A document can pass a formula check and still fall short of the wider standard" in copy


def test_music_retains_eligible_report_boundary_and_omits_unresolved_study() -> None:
    payload = record(SLUGS[2])
    copy = " ".join(paragraphs(payload))
    consistency = claim(payload, "imagery-consistency")
    assert "353 initial participants, 254 repeated the survey" in copy
    assert "Among the reports eligible for the consistency analysis, the coded themes" in copy
    assert "recruitment counts, not one denominator for every consistency analysis" in consistency["scope"]
    assert "absent or vague imagery were excluded" in consistency["uncertainty"]
    assert "creative-insight task was excluded" in claim(payload, "convergent-boundary")["scope"]
    # The unresolved Wu study must not return as an extra source or a prose claim.
    assert re.search(r"\bwu\b", json.dumps(payload), re.I) is None
    assert {item["id"] for item in payload["sources"]} == {
        "margulis", "hashim", "hashim-correction", "ritter", "threadgold"
    }


def test_timestamp_example_stays_synthetic_and_separate_from_measurement() -> None:
    payload = record(SLUGS[3])
    copy = " ".join(paragraphs(payload))
    example = claim(payload, "constructed-example")
    assert "The values are invented to explain the point; they measure no real system and represent no typical clock error" in copy
    assert "displayed times are 10.220 and 10.080 seconds" in copy
    assert "10.100 seconds plus 0.120 gives 10.220" in example["scope"]
    assert "10.160 minus 0.080 gives 10.080" in example["scope"]
    assert example["status"] == "inferred"
    assert "A real incident, typical clock errors or a prevalence estimate" in example["doesNotProve"]
    assert "overlapping intervals alone cannot settle order" in claim(payload, "interval-rule")["uncertainty"]


@pytest.mark.parametrize("slug", SLUGS)
def test_generated_page_has_full_nojs_body_sources_and_share_metadata(slug: str) -> None:
    payload = record(slug)
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
    assert f'<link rel="canonical" href="{BASE_URL}{slug}.html">' in source
    assert f'property="og:url" content="{BASE_URL}{slug}.html"' in source
    assert f'property="og:title" content="{html.escape(payload["title"], quote=True)}"' in source
    assert f'property="og:image" content="{BASE_URL}img/og/{slug}.png"' in source


@pytest.mark.parametrize("slug", SLUGS)
def test_released_route_is_discoverable_in_both_feeds_and_public_listings(slug: str) -> None:
    payload = record(slug)
    url = BASE_URL + payload["route"]
    feed = json.loads((ROOT / "feed.json").read_text(encoding="utf-8"))
    items = [item for item in feed["items"] if item["url"] == url]
    assert len(items) == 1
    assert items[0]["title"] == payload["title"]
    atom = ET.parse(ROOT / "feed.xml")
    ns = {"a": "http://www.w3.org/2005/Atom"}
    entries = [item for item in atom.findall("a:entry", ns) if item.findtext("a:id", namespaces=ns) == url]
    assert len(entries) == 1
    assert entries[0].findtext("a:title", namespaces=ns) == payload["title"]
    for listing in ("publications.html", "writing.html"):
        assert f'href="{slug}.html"' in (ROOT / listing).read_text(encoding="utf-8")
    assert f"<loc>{url}</loc>" in (ROOT / "sitemap.xml").read_text(encoding="utf-8")
