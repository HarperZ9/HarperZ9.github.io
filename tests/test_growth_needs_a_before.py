"""Article-specific boundaries for the Growth Needs a Before internal draft."""

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
    return read_json("publications/data/records/growth-needs-a-before.json")


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


def test_internal_draft_keeps_route_category_and_eight_reviewed_sources() -> None:
    payload = record()
    assert payload["route"] == "growth-needs-a-before.html"
    assert payload["category"] == "psychology-recovery"
    assert payload["form"] == "internal evidence draft"

    sources = payload["sources"]
    assert [source["id"] for source in sources] == [f"S{i}" for i in range(1, 9)]
    assert len({source["url"] for source in sources}) == 8
    assert all(urlparse(source["url"]).scheme == "https" for source in sources)
    assert sources[0]["published_at"] == "1996-07-01"
    assert "schema-normalized" in sources[0]["role"]
    assert sources[1]["published_at"] == "2009-06-08"
    assert "219 to 221 raw follow-up returns" in sources[2]["role"]
    assert "214 to 218 full-sample analytic comparisons" in sources[2]["role"]
    assert sources[-1]["published_at"] == "2026-07-15"
    assert "proposed" in sources[-1]["role"]


def test_figure_preserves_raw_and_analytic_denominators_without_pooling() -> None:
    item = figure()
    assert item["id"] == "growth-needs-a-before"
    assert item["provenance"] == ["S2", "S3", "S4", "S7"]
    assert [row[0] for row in item["rows"]] == ["S2", "S3", "S4", "S7"]
    assert [row[1] for row in item["rows"]] == [
        "Two-month prospective study; n=122 event subgroup",
        "Two-wave student study; n=282 baseline; n=219 to 221 raw follow-up; n=214 to 218 full-sample analytic; 66 raw event reports; n=61 to 64 analytic event subset",
        "Stem-cell-transplant study; n=187 first; n=157 second; n=91 third",
        "Three waves over six months; Wave 1 n=804; 32,099 daily assessments",
    ]
    assert "must not be summed" in item["denominator"]
    assert "no pooling" in item["transformation"].lower()
    assert "predict any person's recovery" in item["doesNotProve"]


def test_claims_separate_perceived_growth_change_distress_and_recovery() -> None:
    payload = record()
    claims = {claim["id"]: claim for claim in payload["claims"]}
    assert set(claims) == {f"C{i}" for i in range(1, 12)}
    assert "not significantly related" in claims["C5"]["text"]
    assert "219 to 221 raw follow-up returns" in claims["C5"]["scope"]
    assert "214 to 218 full-sample analytic comparisons" in claims["C5"]["scope"]
    assert "187 first questionnaires, 157 second questionnaires, and 91 third questionnaires" in claims["C6"]["scope"]
    assert "32,099 experience-sampling assessments" in claims["C9"]["scope"]
    assert claims["C10"]["status"] == "verified"
    assert claims["C11"]["status"] == "inferred"
    assert "clinical change" in claims["C11"]["text"]
    assert "diagnoses a person" in claims["C8"]["doesNotProve"]


def test_reader_copy_has_no_unadopted_personal_voice_or_triumph_frame() -> None:
    payload = record()
    copy = narrative_text(payload)
    assert payload["personal_voice_adopted"] is False
    assert re.search(r"\b(i|me|my|mine|we|us|our|ours)\b", copy, re.I) is None
    assert "\u2014" not in json.dumps(payload, ensure_ascii=False)
    assert "trauma makes people stronger" not in copy.lower()
    assert "growth is not an obligation" in copy.lower()


def test_generated_draft_keeps_state_label_svg_alt_and_table_fallback() -> None:
    html = read_text("growth-needs-a-before.html")
    alt = re.escape(figure()["alt"])
    assert "internal evidence draft" in html
    assert "<article>" in html and "</article>" in html
    assert re.search(
        rf'<img src="figures/growth-needs-a-before\.svg" alt="{alt}">', html
    )
    assert '<table class="publication-figure-table">' in html
    assert "A report, a baseline, and a change are different records" in html
    assert '<th scope="row">S2</th>' in html
    assert '<th scope="row">S7</th>' in html
