"""Article-specific boundaries for Growth Needs a Before."""

from __future__ import annotations

import json
import re
from pathlib import Path
from urllib.parse import urlparse

from tools.publication_model import validate_record


ROOT = Path(__file__).resolve().parents[1]


def read_json(relative: str) -> dict:
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


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


def test_record_is_public_ready_with_original_observation_boundary() -> None:
    payload = record()
    validate_record(payload)

    assert payload["route"] == "growth-needs-a-before.html"
    assert payload["category"] == "psychology-recovery"
    assert payload["form"] == "evidence essay"
    assert payload["published_at"] == "2026-09-05"
    assert payload["updated_at"] == "2026-09-05"
    assert payload["observed_at"] == "2026-09-04T18:16:18Z"
    assert payload["thesis"] == (
        "Feeling changed after trauma and measuring lasting change are different "
        "questions. The studies here show why a before-and-after comparison matters."
    )
    assert "clear limits on what the score can prove" in payload["summary"]
    assert "internal evidence draft" not in json.dumps(payload).lower()
    assert "reviewed and accepts responsibility" not in payload["ai_assistance"]
    assert "AI-assisted research and editing" in payload["ai_assistance"]
    assert "source dates, denominators, claim limits" in payload["ai_assistance"]


def test_sources_keep_exact_dates_denominators_and_fresh_observation() -> None:
    sources = record()["sources"]

    assert [source["id"] for source in sources] == [f"S{i}" for i in range(1, 9)]
    assert len({source["url"] for source in sources}) == 8
    assert all(urlparse(source["url"]).scheme == "https" for source in sources)
    assert all(source["observed_at"] == "2026-09-05" for source in sources)
    assert sources[0]["published_at"] == "1996-07-01"
    assert "not an exact publication day" in sources[0]["role"]
    assert sources[1]["published_at"] == "2009-06-08"
    assert "SAGE lists Article first published online July 1, 2009" in sources[1]["role"]
    assert "219 to 221 raw follow-up returns" in sources[2]["role"]
    assert "214 to 218 full-sample analytic comparisons" in sources[2]["role"]
    assert sources[4]["published_at"] == "2022-04-21"
    assert sources[-1]["published_at"] == "2026-07-15"
    assert "not a validated standard" in sources[-1]["role"]


def test_claims_separate_perceived_ptg_change_distress_and_recovery() -> None:
    payload = record()
    claims = {claim["id"]: claim for claim in payload["claims"]}

    assert set(claims) == {f"C{i}" for i in range(1, 12)}
    assert "PTGI scores were generally unrelated" in claims["C3"]["text"]
    assert "perceived PTG, not perceived general growth" in claims["C5"]["text"]
    assert "219 to 221 raw follow-up returns" in claims["C5"]["scope"]
    assert "214 to 218 full-sample analytic comparisons" in claims["C5"]["scope"]
    assert (
        "187 first questionnaires, 157 second questionnaires, and 91 third questionnaires"
        in claims["C6"]["scope"]
    )
    assert claims["C7"]["scope"] == "47 studies and 66 separately coded effects"
    assert "6,776 participants" in claims["C8"]["scope"]
    assert "n=6,766" in claims["C8"]["uncertainty"]
    assert "32,099 experience-sampling assessments" in claims["C9"]["scope"]
    assert claims["C10"]["status"] == "verified"
    assert claims["C11"]["status"] == "inferred"
    assert "clinical change" in claims["C11"]["text"]
    assert "diagnoses a person" in claims["C8"]["doesNotProve"]


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
    assert item["rows"][1][2] == (
        "Perceived PTG, perceived general growth, and measured pre-to-post change"
    )
    assert "must not be summed" in item["denominator"]
    assert "no pooling" in item["transformation"].lower()
    assert "observed 2026-09-05" in item["date"]
    assert "predict any person's recovery" in item["doesNotProve"]


def test_reader_copy_has_no_unadopted_personal_voice_or_advice_posture() -> None:
    payload = record()
    copy = narrative_text(payload)

    assert payload["personal_voice_adopted"] is False
    assert re.search(r"\b(i|me|my|mine|we|us|our|ours)\b", copy, re.I) is None
    assert "\u2014" not in json.dumps(payload, ensure_ascii=False)
    assert "trauma makes people stronger" not in copy.lower()
    assert "you should" not in copy.lower()
    assert "growth is not an obligation" in copy.lower()
    assert "does not determine whether a particular person's account is accurate" in copy
    assert "provide diagnosis or treatment guidance" in copy
