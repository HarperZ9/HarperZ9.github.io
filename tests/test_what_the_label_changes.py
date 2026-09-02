"""Article-specific boundaries for What the Label Changes."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse


ROOT = Path(__file__).resolve().parents[1]


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def read_text(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def record() -> dict:
    return read_json("publications/data/records/what-the-label-changes.json")


def figure() -> dict:
    return record()["figures"][0]


def narrative_text(payload: dict) -> str:
    parts = [
        payload["title"],
        payload["summary"],
        payload["thesis"],
        *payload["opening"].values(),
    ]
    for section in payload["sections"]:
        parts.append(section["heading"])
        parts.extend(section["paragraphs"])
    return " ".join(parts)


def test_record_keeps_route_category_and_seven_peer_reviewed_https_sources() -> None:
    payload = record()
    assert payload["route"] == "what-the-label-changes.html"
    assert payload["category"] == "art-perception"

    sources = payload["sources"]
    assert [source["id"] for source in sources] == [f"S{i}" for i in range(1, 8)]
    assert len({source["url"] for source in sources}) == 7
    assert all(urlparse(source["url"]).scheme == "https" for source in sources)
    assert sources[-1] == {
        "id": "S7",
        "publisher": "Visitor Studies",
        "title": "We See as We Are Told? How Exhibit Labels Shape Art Perception in the Museum",
        "url": "https://www.tandfonline.com/doi/full/10.1080/10645578.2026.2662812",
        "role": "current peer-reviewed museum field study of label length, content, reading, viewing, and visitor agency",
        "published_at": "2026-07-29",
        "observed_at": "2026-09-02",
    }


def test_numerical_matrix_preserves_denominators_and_excludes_s7() -> None:
    item = figure()
    assert item["id"] == "label-is-a-lens"
    assert item["provenance"] == ["S1", "S2", "S3", "S4", "S5", "S6"]
    assert [row[0] for row in item["rows"]] == ["S1", "S2", "S3", "S4", "S5", "S6"]
    assert [row[1] for row in item["rows"]] == [
        "30 viewers; 30 works, 15 abstract and 15 figurative",
        "214 viewers; 31 Pollock works in Experiment 1",
        "30 viewers; eight museum paintings; 20 experimental and 10 control",
        "60 enrolled viewers; 49 usable physiological records; eight digital paintings",
        "127 viewers; 40 contemporary works",
        "52 viewers across two experiments; 30 abstract works",
    ]
    assert item["rows"][0][3] == (
        "Semantic context increased abstract understanding and salient-region exploration; "
        "aesthetic-process context reduced overall looking time for abstract work"
    )
    assert "S7" not in item["provenance"]
    assert "S7" not in {row[0] for row in item["rows"]}
    assert (
        item["limitations"]
        == "The 2026 field study is discussed in prose but excluded from the matrix because its naturalistic, bundled between-condition intervention and selected 80-participant subset are not directly comparable to the six controlled rows."
    )


def test_claims_keep_exact_non_proof_boundaries() -> None:
    payload = record()
    assert {claim["id"] for claim in payload["claims"]} == {f"C{i}" for i in range(1, 9)}
    assert {claim["id"]: claim["doesNotProve"] for claim in payload["claims"]} == {
        "C1": "A universal benefit or harm from contextual information",
        "C2": "That biography alone improves perception or that the effect is large",
        "C3": "That more looking means more liking or that arousal is pleasure",
        "C4": "Durable learning or equivalence with free museum behavior",
        "C5": "That title-consistent looking is correct interpretation",
        "C6": "That richer descriptive or semantic labels cannot affect looking or interpretation",
        "C7": "One ideal label length or content pattern for every visitor",
        "C8": "Label quality, durable learning, correct interpretation, agreement, or artistic value",
    }
    s1_claim = next(claim for claim in payload["claims"] if claim["id"] == "C1")
    assert (
        s1_claim["text"]
        == "Semantic context increased reported understanding and salient-region exploration for abstract work in one controlled study, while aesthetic-process context produced lower abstract-art appreciation than semantic context and less overall looking time than both semantic and title-only context."
    )
    s7_claim = next(claim for claim in payload["claims"] if claim["id"] == "C7")
    assert s7_claim["source_ids"] == ["S7"]
    assert (
        s7_claim["scope"]
        == "Two hundred twelve museum visitors enrolled across two conditions; the paper used a selected mobile-eye-tracking subset of eighty, forty per condition"
    )
    assert (
        s7_claim["uncertainty"]
        == "Naturalistic field setting, bundled label changes, and a selected 80-participant subset; excluded from the numerical matrix to preserve cross-study comparability"
    )
    assert (
        figure()["doesNotProve"]
        == "The matrix does not establish label quality, one correct interpretation, durable learning, visitor agreement, or artistic value."
    )


def test_public_copy_has_no_personal_voice_or_em_dash() -> None:
    payload = record()
    copy = narrative_text(payload)
    assert payload["personal_voice_adopted"] is False
    assert re.search(r"\b(i|me|my|mine|we|us|our|ours)\b", copy, re.I) is None
    assert "\u2014" not in json.dumps(payload, ensure_ascii=False)
    assert "\u2014" not in read_text("what-the-label-changes.html")


def test_generated_html_keeps_article_metadata_svg_alt_and_table_fallback() -> None:
    html = read_text("what-the-label-changes.html")
    alt = re.escape(figure()["alt"])
    assert "<article>" in html and "</article>" in html
    assert (
        '<meta property="og:image" content="https://harperz9.github.io/img/og/what-the-label-changes.png">'
        in html
    )
    assert re.search(rf'<img src="figures/label-is-a-lens\.svg" alt="{alt}">', html)
    assert '<table class="publication-figure-table">' in html
    assert "<caption>Figure 1. The label is a lens, not a verdict." in html
    assert '<th scope="col">Source</th>' in html
    assert '<th scope="row">S1</th>' in html
    assert '<th scope="row">S6</th>' in html
    assert '<th scope="row">S7</th>' not in html
