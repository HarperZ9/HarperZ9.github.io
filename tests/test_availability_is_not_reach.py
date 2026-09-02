"""Article-specific boundaries for Availability Is Not Reach."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def test_availability_and_reach_are_not_rendered_as_a_funnel() -> None:
    record = read_json("publications/data/records/availability-is-not-reach.json")
    figure = next(
        item for item in record["figures"] if item["id"] == "availability-is-not-reach"
    )
    assert figure["type"] == "separate-panels"
    assert [row[1] for row in figure["rows"]] == ["85%", "42%", "8%", "25%"]
    assert "June 2025" in json.dumps(figure)
    assert "October 2024" in json.dumps(figure)
    assert "not a sequential funnel" in figure["doesNotProve"]


def test_scale_estimates_keep_their_analysis_conditions() -> None:
    text = json.dumps(
        read_json("publications/data/records/availability-is-not-reach.json"),
        ensure_ascii=False,
    )
    for value in ("0.288", "0.40", "0.22", "0.16"):
        assert value in text
    assert "wide prediction intervals" in text
    assert "fixed penalty" in text


def test_availability_article_uses_the_approved_nine_section_path() -> None:
    record = read_json("publications/data/records/availability-is-not-reach.json")
    assert [section["id"] for section in record["sections"]] == [
        "ordinary-budgets",
        "what-works-means",
        "scale-changes-claim",
        "availability-is-not-reach",
        "measure-delivery",
        "preserve-denominator",
        "independent-outcome",
        "funding-boundary",
        "public-claim",
    ]
    text = json.dumps(record, ensure_ascii=False).lower()
    assert "editorial accountability design" in text
    assert "not a federal standard" in text
