"""Article-specific boundaries for The Second Hearing."""

from __future__ import annotations

import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


def figure_record(record_name: str, figure_id: str) -> dict:
    record = read_json(f"publications/data/records/{record_name}")
    return next(item for item in record["figures"] if item["id"] == figure_id)


def test_second_hearing_keeps_distinct_constructs_and_limits() -> None:
    record = read_json("publications/data/records/the-second-hearing.json")
    assert record["route"] == "the-second-hearing.html"
    assert {source["id"] for source in record["sources"]} == {
        f"S{i}" for i in range(1, 8)
    }
    assert {claim["id"] for claim in record["claims"]} == {
        f"C{i}" for i in range(1, 9)
    }
    text = json.dumps(record, ensure_ascii=False)
    for term in (
        "piece familiarity",
        "style familiarity",
        "within-piece repetition",
        "across-hearing repetition",
    ):
        assert term in text
    assert "replay count" in text.lower()
    assert "universal exposure curve" in text.lower()


def test_second_hearing_figure_refuses_cross_study_magnitude_comparison() -> None:
    figure = figure_record(
        "the-second-hearing.json", "the-second-hearing-evidence-map"
    )
    assert len(figure["rows"]) == 4
    assert {row[0] for row in figure["rows"]} == {"S2", "S4", "S5", "S6"}
    assert "not a meta-analysis" in figure["limitations"].lower()
    assert "not comparable" in figure["limitations"].lower()


def test_second_hearing_uses_the_approved_nine_section_path() -> None:
    record = read_json("publications/data/records/the-second-hearing.json")
    assert [section["id"] for section in record["sections"]] == [
        "second-hearing",
        "four-familiarities",
        "liking-trajectories",
        "attention-is-not-liking",
        "memory-without-preference",
        "listener-in-measurement",
        "replay-count-limits",
        "listening-card",
        "honest-measurement",
    ]
    text = json.dumps(record, ensure_ascii=False).lower()
    assert "editorial exercise" in text
    assert "tested intervention" in text
