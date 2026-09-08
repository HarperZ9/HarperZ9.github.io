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


def test_index_212_release_discovery_names_durable_jobs_and_cross_channel_wheel_drift() -> None:
    index = registry_record("index")
    evidence = evidence_by_id(index)
    payload = json.dumps(index)
    page = read("index-graph.html")
    home_projection = read("home/site/evidence-stream.json")

    assert index["releaseState"] == "GitHub and PyPI release 2.12.0 verified; PyPI wheel container hash differs while payload bytes match"
    assert "index-graph==2.12.0" in index["entryCommand"]
    for command in ("index router-job start", "index router-job status", "index router-job result"):
        assert command in index["entryCommand"]
    for tool in ("index.router.job.start", "index.router.job.status", "index.router.job.result"):
        assert tool in index["entryCommand"]
        assert tool in page

    assert evidence["index-release-v2-12-0"]["href"].endswith("/releases/tag/v2.12.0")
    assert "d895196f8ecca84a043f19fec7b49d94b1dd3bdb" in evidence["index-release-v2-12-0"]["summary"]
    assert "dabd4c253804d1791755941fe695c85a1c32087d15b744ef370a092dbf8fe9b6" in evidence["index-release-v2-12-0"]["summary"]
    assert "9451351820f6e779de3a3e567f0a9c4cf59edcee1de7bda9997d3ac6dda46445" in evidence["index-release-v2-12-0"]["summary"]
    assert evidence["index-pypi-v2-12-0"]["href"].endswith("/project/index-graph/2.12.0/")
    assert "1825b12a1a9413fadba7d0f786852ac0ef17515389ab19e267732e2aecbca683" in evidence["index-pypi-v2-12-0"]["summary"]
    assert "ZIP create_system metadata differs" in evidence["index-pypi-v2-12-0"]["summary"]
    assert "extracted file sets and file bytes match" in evidence["index-pypi-v2-12-0"]["summary"]
    old_cross_channel_claim = "their SHA-256 digests match " + "the GitHub release assets"
    assert old_cross_channel_claim not in payload

    router_summary = evidence["index-router-job-v2-12-0"]["summary"]
    assert "22 MCP tools" in router_summary
    assert "703 of 703 repositories" in router_summary
    assert "430 s cold" in router_summary
    assert "493 s warm" in router_summary
    assert "not a controlled speedup" in router_summary
    assert "not a controlled speedup or maturity claim" in router_summary
    market_space_claim = "market " + "maturity"
    market_hyphen_claim = "market-" + "maturity"
    assert market_space_claim not in payload.lower()
    assert market_hyphen_claim not in payload.lower()

    assert "index-release-v2-12-0" in home_projection
    assert "index-pypi-v2-12-0" in home_projection
    assert "https://github.com/HarperZ9/index/releases/tag/v2.12.0" in page
    assert "https://pypi.org/project/index-graph/2.12.0/" in page
    assert "index-graph 2.11.0" not in page



def test_forum_route_preflight_skill_release_is_live_and_nonexecuting() -> None:
    forum = registry_record("forum")
    evidence = evidence_by_id(forum)
    payload = json.dumps(forum)
    page = read("forum.html")
    catalog = read("catalog.html")
    home_projection = read("home/site/evidence-stream.json")
    home_registry = read("home/src/system-registry.ts")

    skill = evidence["forum-route-preflight-skill-v0-1-0"]
    assert forum["releaseState"] == "stable engine v1.13.0; standalone route-preflight skill v0.1.0"
    assert "forum-engine==1.13.0" in forum["entryCommand"]
    assert "forum-route-preflight-skill-20260907-final.zip" in forum["entryCommand"]
    assert forum["runGuide"]["href"].endswith(
        "/releases/download/forum-route-preflight-v0.1.0/forum-route-preflight-skill-20260907-final.zip"
    )
    assert "Forum CLI or source checkout" in forum["runGuide"]["summary"]
    assert "host skill loader" in forum["runGuide"]["summary"]
    assert "safe_to_submit is false" in forum["verificationCommand"]
    assert "route-preflight checks before model execution" in forum["useCases"]
    assert "standalone host skill" in payload
    assert "not a marketplace approval" in payload
    assert "not a Forum engine version bump" in payload
    assert "safe_to_submit=false" in payload

    assert skill["href"] == "https://github.com/HarperZ9/forum/releases/tag/forum-route-preflight-v0.1.0"
    assert skill["status"] == "verified"
    assert "9,573-byte" in skill["summary"]
    assert "1827a9673414e73722ba7bd74be15316534bb6c66fc55ecc26845a5e5c953450" in skill["summary"]
    assert "afa5b4a94a3904e4afb1f441206d98a665757e0fa770049e4925020a94b0b390" in skill["summary"]
    assert "Download-back verification matched" in skill["summary"]

    for source in (page, home_projection, home_registry):
        assert "forum-route-preflight-v0.1.0" in source
        assert "forum-route-preflight-skill-20260907-final.zip" in source
        assert "1827a9673414e73722ba7bd74be15316534bb6c66fc55ecc26845a5e5c953450" in source
        assert "coming soon" not in source.lower()

    assert "Forum route-preflight skill 0.1.0" in catalog
    assert "https://github.com/HarperZ9/forum/releases/tag/forum-route-preflight-v0.1.0" in catalog
    assert "coming soon" not in catalog.lower()
    assert "safe_to_submit=false" in page
    assert "not a marketplace approval" in page
    assert "https://github.com/HarperZ9/forum/releases/tag/forum-route-preflight-v0.1.0" in page
    assert "https://github.com/HarperZ9/forum/releases/download/forum-route-preflight-v0.1.0/forum-route-preflight-skill-20260907-final.zip" in page
