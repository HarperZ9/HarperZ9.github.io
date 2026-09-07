from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def read(relative: str) -> str:
    return (ROOT / relative).read_text(encoding="utf-8")


def registry_record(system_id: str) -> dict[str, object]:
    registry = json.loads(read("system/systems.json"))
    for record in registry["systems"]:
        if record["id"] == system_id:
            return record
    raise AssertionError(system_id)


def route_hrefs(relative: str) -> set[str]:
    source = read(relative)
    match = re.search(r'ROUTE_REGISTRY_JSON = ("(?:[^"\\]|\\.)*");', source)
    assert match, relative
    registry = json.loads(json.loads(match.group(1)))
    return {route["href"] for family in registry["families"] for route in family["routes"]}


def evidence_by_id(record: dict[str, object]) -> dict[str, dict[str, object]]:
    return {item["id"]: item for item in record["evidence"]}


def test_canon_is_discoverable_with_github_release_and_no_pypi_claim() -> None:
    canon = registry_record("canon")
    evidence = evidence_by_id(canon)

    assert canon["href"] == "canon.html"
    assert canon["accessMode"] == "install"
    assert canon["releaseState"] == "GitHub release v0.1.0 verified; no PyPI release claimed"
    assert "canon --json preview" in canon["entryCommand"]
    assert "canon --json export" in canon["verificationCommand"]
    assert canon["runGuide"]["href"].endswith("/README.md#L133-L145")
    assert "records.jsonl and atoms.jsonl" in read("canon.html")
    assert evidence["canon-release-v0-1-0"]["href"].endswith("/releases/tag/v0.1.0")
    assert "939639e91414bfe163c43ea689f1a5ddf348254c1989fa54b08c5f2b3849246f" in evidence[
        "canon-release-v0-1-0"
    ]["summary"]
    assert "no PyPI release is claimed" in json.dumps(canon)
    assert evidence["canon-source-0-1-0"]["status"] == "verified"
    assert evidence["canon-preview-export-source"]["href"].endswith("/README.md#L133-L145")

    assert "canon.html" in route_hrefs("system/routes.js")
    assert "canon.html" in route_hrefs("home/src/site-routes.ts")
    assert "https://harperz9.github.io/canon.html" in read("sitemap.xml")


def test_chorus_names_github_release_source_change_gate_and_no_pypi_claim() -> None:
    chorus = registry_record("chorus")
    evidence = evidence_by_id(chorus)

    assert chorus["releaseState"] == "GitHub release v0.3.0 verified; no PyPI release claimed"
    assert "chorus decision <current> --reference <reference>" in chorus["entryCommand"]
    assert evidence["chorus-release-v0-3-0"]["href"].endswith("/releases/tag/v0.3.0")
    assert "1997b649ac381fdcb7a13ec4f5d2d686c9e6306dfe4c58405a7e5b9921c70f2a" in evidence[
        "chorus-release-v0-3-0"
    ]["summary"]
    assert "no PyPI release is claimed" in json.dumps(chorus)
    assert evidence["chorus-source-change-gate-v0-3-0-source"]["status"] == "verified"
    assert "UNVERIFIABLE" in evidence["chorus-source-change-gate-v0-3-0-source"]["summary"]


def test_public_surface_sweeper_013_uses_verified_download_channels_separately() -> None:
    sweeper = registry_record("public-surface-sweeper")
    evidence = evidence_by_id(sweeper)

    assert sweeper["releaseState"] == "v0.1.3 on GitHub and PyPI"
    assert "public-surface-sweeper==0.1.3" in sweeper["entryCommand"]
    assert "linked-worktree release checks" in sweeper["useCases"]
    assert evidence["public-surface-sweeper-release-v0-1-3"]["href"].endswith("/releases/tag/v0.1.3")
    assert "e8f926a6fc8e595d89a42fff936fc32f8c65ad2241d95feafe331c2cb7b7cb99" in evidence[
        "public-surface-sweeper-release-v0-1-3"
    ]["summary"]
    assert evidence["public-surface-sweeper-pypi-v0-1-3"]["href"].endswith(
        "/project/public-surface-sweeper/0.1.3/"
    )
    assert "9dc327e990f5017d7984db969bd259959bfe9b3bac3ea5d76d589b178dcbe286" in evidence[
        "public-surface-sweeper-pypi-v0-1-3"
    ]["summary"]
    sample = read("public-surface-sweeper-sample.html")
    assert "GitHub release v0.1.3" in sample
    assert "public-surface-sweeper==0.1.3" in sample
    assert "public-surface-sweeper &lt;workspace&gt; --workspace --json" in sample
