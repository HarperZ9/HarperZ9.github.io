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


def test_flywheel_060_release_discovery_keeps_acceptance_limits_visible() -> None:
    flywheel = registry_record("flywheel")
    evidence = evidence_by_id(flywheel)
    payload = json.dumps(flywheel)
    page = read("flywheel.html")
    catalog = read("catalog.html")
    home_projection = read("home/site/evidence-stream.json")
    home_registry = read("home/src/system-registry.ts")

    release = evidence["flywheel-release-v0-6-0"]
    pypi = evidence["flywheel-pypi-v0-6-0"]
    assert flywheel["releaseState"] == "stable v0.6.0; PyPI and GitHub release assets published; clean-VM and mobile acceptance not claimed"
    assert flywheel["evidence"][0]["id"] == "flywheel-release-v0-6-0"
    assert release["type"] == "release"
    assert release["status"] == "verified"
    assert release["href"] == "https://github.com/HarperZ9/flywheel/releases/tag/v0.6.0"
    assert pypi["href"] == "https://pypi.org/project/flywheel-verify/0.6.0/"

    for required in (
        "published at 2026-09-08T21:24:15Z",
        "source commit d8c1623a3d0fee2d1ae7f3dfddb50cebdfdad599",
        "Flywheel-Setup-0.6.0-x64.exe",
        "25,587,795 bytes",
        "d762838c865f6b287ba30b8b576cb179500241904401fd8a01a2bb99d625d173",
        "frozen-gateway-smoke.json",
        "8a4a843221d5775b23cbc3e3873c1d859721cdbe80af9144aafbc4d2479ef139",
        "SHA256SUMS.txt",
        "f45205042bc879d549038f9a2ee9cb815eab55a7b4758bc64ccaef3074ad8bd6",
        "Windows tag-candidate acceptance attempt 2 passed",
        "34279017788",
        "cab370affa52ec180f2613fff131eb8f84424afae189c53f8f4f323a4729f685",
        "Continue with agent",
        "Evidence Journey",
        "durable Index workspace-map jobs",
        "manual Update snapshot refresh",
        "retained local Ollama token and timing usage",
        "Index 2.12 or newer remains a separate requirement",
    ):
        assert required in release["summary"]

    for required in (
        "PyPI serves flywheel-verify 0.6.0",
        "592 Python source files",
        "601 wheel RECORD entries",
        "bfde77d6215b62283b72f873f598b0d25761e76c303eb5208f2324ab701c3bf3",
        "f94bb7bdfdb597306071df289505ae9616ed64f92cfb90066a24a55f58bb2b0a",
        "No installed runtime check",
        "Windows installer acceptance is recorded separately",
    ):
        assert required in pypi["summary"]

    for bounded_claim in (
        "clean-machine installation",
        "physical Android/mobile acceptance",
        "provider-native session migration",
        "general model uplift",
        "arbitrary provider-native resume",
    ):
        assert bounded_claim in release["summary"]

    release_section = page[page.index('<section class="mv" id="next-release"'):]
    release_section = release_section[: release_section.index("</section>")]
    assert 'href="#next-release">0.6.0 release</a>' in page
    assert "0.6 candidate" not in page
    assert "Use v0.6.0 when you want the desktop surface to continue with an agent from an approved Evidence Journey item" in release_section
    assert release_section.index("Continue with agent") < release_section.index("GitHub release was published")
    assert "Windows tag-candidate acceptance attempt 2 passed" in release_section
    assert release_section.index("34279017788") > release_section.index("<details")
    assert "pip install flywheel-verify==0.6.0" in page
    assert "Flywheel-Setup-0.6.0-x64.exe" in page
    assert "d762838c865f6b287ba30b8b576cb179500241904401fd8a01a2bb99d625d173" in page
    assert "Flywheel v0.6.0" in catalog
    assert "flywheel-release-v0-6-0" in home_projection
    assert "flywheel-pypi-v0-6-0" in home_projection
    assert "Flywheel v0.6.0" in home_registry

    for source in (payload, page, catalog, home_projection, home_registry):
        assert "clean-machine installation passed" not in source
        assert "physical Android acceptance passed" not in source
        assert "mobile acceptance passed" not in source
        assert "general model uplift passed" not in source.lower()
        assert "general model uplift verified" not in source.lower()


def test_relay_020_github_release_discovery_avoids_pypi_relay_agent() -> None:
    relay = registry_record("relay")
    evidence = evidence_by_id(relay)
    payload = json.dumps(relay)
    page = read("systems/relay.html")
    catalog = read("catalog.html")
    home_projection = read("home/site/evidence-stream.json")
    home_registry = read("home/src/system-registry.ts")

    release = evidence["relay-release-v0-2-0"]
    assert relay["releaseState"] == "GitHub release v0.2.0 verified; no PyPI release claimed"
    assert relay["evidence"][0]["id"] == "relay-release-v0-2-0"
    assert release["type"] == "release"
    assert release["status"] == "verified"
    assert release["href"] == "https://github.com/HarperZ9/relay/releases/tag/v0.2.0"

    for required in (
        "Relay 0.2.0 GitHub release",
        "9efdd82a6ea47ea37b4771315529aa4a8b04de1b",
        "relay_agent-0.2.0-py3-none-any.whl",
        "111,430 bytes",
        "7b7f04ee9f393df2ec520110799ecd662033251b9dfcfaf1dad1d5727c717cee",
        "relay_agent-0.2.0.tar.gz",
        "188,381 bytes",
        "202c8ad1028eb1b2b45aa28801717246254ad837e7a5b1e37b26f1dc92d006c3",
        "clean --no-index wheel install",
        "MCP synthetic controls",
        "No PyPI publication or install is claimed",
    ):
        assert required in release["summary"]

    assert "GitHub release v0.2.0 verified; no PyPI release claimed" in catalog
    assert "https://github.com/HarperZ9/relay/releases/download/v0.2.0/relay_agent-0.2.0-py3-none-any.whl" in page
    assert "relay-release-v0-2-0" in home_projection
    assert "Relay 0.2.0 GitHub release" in home_registry

    for source in (payload, page, catalog, home_projection, home_registry):
        assert "https://pypi.org/project/relay-agent" not in source
        assert "pip install relay-agent" not in source
        assert "relay-agent 0.2.0 on PyPI" not in source

    for bounded_claim in (
        "clean-machine installation",
        "physical Android acceptance",
        "provider-native session migration",
        "model uplift",
        "arbitrary provider-native resume",
    ):
        assert bounded_claim not in release["summary"]


def test_gather_170_release_discovery_keeps_context_boundaries_visible() -> None:
    gather = registry_record("gather")
    evidence = evidence_by_id(gather)
    payload = json.dumps(gather)
    page = read("gather.html")
    catalog = read("catalog.html")
    home_projection = read("home/site/evidence-stream.json")
    home_registry = read("home/src/system-registry.ts")

    release = evidence["gather-release-v1-7-0"]
    pypi = evidence["gather-pypi-v1-7-0"]
    assert gather["releaseState"] == "stable v1.7.0; GitHub and PyPI release verified"
    assert gather["entryCommand"] == "pip install gather-engine==1.7.0; gather docs sample.txt --store corpus"
    assert gather["evidence"][0]["id"] == "gather-release-v1-7-0"
    assert release["type"] == "release"
    assert release["status"] == "verified"
    assert release["href"] == "https://github.com/HarperZ9/gather/releases/tag/v1.7.0"
    assert pypi["href"] == "https://pypi.org/project/gather-engine/1.7.0/"

    for required in (
        "Gather v1.7.0 GitHub release",
        "published at 2026-09-08T21:38:40Z",
        "source commit 25b1f65bc9c8146f60eef0eccc8116360842a508",
        "gather_engine-1.7.0-py3-none-any.whl",
        "180,485 bytes",
        "69fdea1aee67c6dd8a0d93c40bcb51476edb26c0163e6e7e25f4c86c1bb7b0c6",
        "gather_engine-1.7.0.tar.gz",
        "244,569 bytes",
        "1d946c31dbc9b7adf51ea1c7fa503f863e1303a620e41b8627e8c915218536b7",
        "SHA256SUMS.txt",
        "878f51ff23216717a1f6bfc50a0c077d3573f376555c78f801e430ebafc3a34d",
        "readable corpus context selection",
    ):
        assert required in release["summary"]

    for required in (
        "PyPI serves gather-engine 1.7.0",
        "64 Python modules",
        "clean no-index wheel install",
        "CLI and MCP context selection",
        "tamper selection was refused",
        "does not prove source truth",
        "claim support",
        "completeness",
        "downstream model use",
        "absence of sensitive material",
    ):
        assert required in pypi["summary"]

    assert "stable v1.7.0; GitHub and PyPI release verified" in catalog
    assert "https://github.com/HarperZ9/gather/releases/tag/v1.7.0" in page
    assert "https://pypi.org/project/gather-engine/1.7.0/" in page
    assert "pip install gather-engine==1.7.0" in page
    sample_fixture = (
        "Offline quickstart: Gather keeps acquired context separate from conclusions."
        "\nDecision fact: the release can select useful text from a stored corpus."
    )
    assert "sample.txt body" in page
    assert sample_fixture in page
    assert "replace ROW_REF and CORPUS_DIGEST with the values from the inspect JSON" in page
    assert "0:76 selects the first line of this fixture" in page
    assert page.index("sample.txt body") < page.index("gather docs sample.txt --store corpus --json")
    assert "gather docs sample.txt --store corpus --json" in page
    assert "gather corpus context corpus --json --excerpt-chars 90" in page
    assert "gather corpus context corpus --json --select ROW_REF:0:76 --expect-digest CORPUS_DIGEST" in page
    command_block = page[page.index("gather docs sample.txt --store corpus --json"):]
    command_block = command_block[: command_block.index("</pre>")]
    assert "Sample selected text" not in command_block
    assert "Sample selected text" in page
    assert "Offline quickstart: Gather keeps acquired context separate from conclusions." in page
    assert "gather-release-v1-7-0" in home_projection
    assert "gather-pypi-v1-7-0" in home_projection
    assert "Gather v1.7.0 GitHub release" in home_registry

    for source in (payload, page, catalog, home_projection, home_registry):
        assert "E2E compiler released" not in source
        assert "end-to-end compiler released" not in source
        assert "new product scope released" not in source
        assert "source truth verified" not in source
        assert "complete gathered coverage" not in source
        assert "example.com/article" not in source
