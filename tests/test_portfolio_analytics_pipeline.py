"""Focused contract tests for the offline portfolio analytics pipeline."""

from __future__ import annotations

import json
import os
import hashlib
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CAPTURE = ROOT / "scripts" / "capture-portfolio-analytics.py"
RENDER = ROOT / "scripts" / "render-portfolio-analytics.mjs"
BASELINE_PLAN = ROOT / "analytics" / "market-baseline-plan.json"
ANALYTICS_DATASET = ROOT / "analytics" / "portfolio-analytics.json"


def run(*args: str, cwd: Path | None = None) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=cwd,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )


def git(repo: Path, *args: str) -> str:
    return run("git", *args, cwd=repo).stdout.strip()


def make_repo(root: Path, name: str, remote: str) -> Path:
    repo = root / name
    repo.mkdir()
    git(repo, "init", "-q")
    git(repo, "config", "user.email", "analytics@example.invalid")
    git(repo, "config", "user.name", "Analytics fixture")
    git(repo, "remote", "add", "origin", remote)
    return repo


def commit_all(repo: Path) -> str:
    git(repo, "add", ".")
    git(repo, "commit", "-q", "-m", "fixture")
    return git(repo, "rev-parse", "HEAD")


def test_capture_uses_public_registry_and_head_blobs_without_local_paths(tmp_path: Path) -> None:
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    # The real workspace is an unlisted umbrella Git repository containing
    # independently versioned public repositories. Discovery must traverse it.
    git(workspace, "init", "-q")
    git(workspace, "remote", "add", "origin", "https://github.com/Example/workspace")
    auxiliary = make_repo(workspace, ".wt-public-tool", "git@github.com:Example/public-tool.git")
    (auxiliary / "old.py").write_text("OLD = True\n", encoding="utf-8")
    auxiliary_commit = commit_all(auxiliary)
    scratch_root = workspace / ".scratch"
    scratch_root.mkdir()
    scratch = make_repo(scratch_root, "public-tool-preserved", "git@github.com:Example/public-tool.git")
    (scratch / "older.py").write_text("OLDER = True\n", encoding="utf-8")
    scratch_commit = commit_all(scratch)
    public = make_repo(workspace, "public-tool", "git@github.com:Example/public-tool.git")
    (public / "src").mkdir()
    (public / "tests").mkdir()
    (public / "vendor").mkdir()
    (public / "src" / "tool.py").write_text("def one():\n    return 1\n", encoding="utf-8")
    (public / "tests" / "test_tool.py").write_text(
        "def test_one():\n    assert True\n\nclass TestTwo:\n    def test_two(self):\n        assert True\n",
        encoding="utf-8",
    )
    (public / "README.md").write_text("not code\n" * 100, encoding="utf-8")
    (public / "vendor" / "ignored.py").write_text("ignored = True\n" * 50, encoding="utf-8")
    (public / "benchmarks").mkdir()
    (public / "benchmarks" / "shared-scorecard.json").write_text(
        json.dumps(
            {
                "schema": "harness.cross-harness-task-scorecard/v1",
                "task_set_id": "shared-v1",
                "metric_schema": "agentic-v1",
                "execution_policy": "same-policy-v1",
                "captured_at": "2026-08-28T12:00:00Z",
                "environment": {
                    "environment_id": "fixture-windows-cpu",
                    "hardware": "fixture CPU; 16 GiB RAM",
                    "operating_system": "Windows fixture",
                    "runtime": "Python 3.12",
                },
                "confidence": {"level": "fixture", "basis": "complete one-task receipts"},
                "limitations": ["One synthetic task is not a general benchmark."],
                "rows": [
                    {
                        "run_id": "codex-run",
                        "task_id": "task-1",
                        "raw_prompt_sha256": "a" * 64,
                        "harness_id": "codex",
                        "model_id": "model-a",
                        "tool_name": "Codex",
                        "tool_version": "1.0.0-fixture",
                        "configuration_id": "codex-config-a",
                        "raw_artifact_url": "https://github.com/Example/public-tool/blob/fixture/codex-task-1.json",
                        "status": "completed",
                        "failure_class": "none",
                        "metrics": {"task_completion": 1, "quality": 0.8, "latency_ms": 100, "tool_use_success": 1, "reproducibility": 1},
                    },
                    {
                        "run_id": "flywheel-run",
                        "task_id": "task-1",
                        "raw_prompt_sha256": "a" * 64,
                        "harness_id": "flywheel",
                        "model_id": "model-a",
                        "tool_name": "Flywheel",
                        "tool_version": "1.0.0-fixture",
                        "configuration_id": "flywheel-config-a",
                        "raw_artifact_url": "https://github.com/Example/public-tool/blob/fixture/flywheel-task-1.json",
                        "status": "completed",
                        "failure_class": "none",
                        "metrics": {"task_completion": 1, "quality": 0.9, "latency_ms": 80, "tool_use_success": 1, "reproducibility": 1},
                    },
                ],
            }
        ),
        encoding="utf-8-sig",
    )
    (public / "benchmarks" / "cross-harness-contract.json").write_text(
        json.dumps(
            {
                "schema": "harness.cross-harness-adapter-contract/v2",
                "provider_roles": [
                    {"provider_role": "codex_harness", "harness_id": "codex", "model_display_name": "Model A", "adapter_state": "contract_only"},
                    {"provider_role": "flywheel_harness", "harness_id": "flywheel", "model_display_name": "Model A", "adapter_state": "contract_only"},
                ],
            }
        ),
        encoding="utf-8",
    )
    commit = commit_all(public)

    # A Git repository absent from the publication registry must never be captured.
    private = make_repo(workspace, "private-tool", "git@github.com:Example/private-tool.git")
    (private / "secret.py").write_text("SECRET = 'not published'\n", encoding="utf-8")
    commit_all(private)

    registry = tmp_path / "systems.json"
    registry.write_text(
        json.dumps(
            {
                "schema": "harperz9-systems/v4",
                "systems": [
                    {
                        "id": "public-tool",
                        "name": "Public Tool",
                        "sourceHref": "https://github.com/Example/public-tool",
                    },
                    {
                        "id": "missing-tool",
                        "name": "Missing Tool",
                        "sourceHref": "https://github.com/Example/missing-tool",
                    },
                    {
                        "id": "not-a-public-git-source",
                        "name": "No Source",
                        "sourceHref": "https://example.invalid/private",
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    output = tmp_path / "capture.json"

    run(
        sys.executable,
        str(CAPTURE),
        "--workspace-root",
        str(workspace),
        "--registry",
        str(registry),
        "--output",
        str(output),
        "--as-of-date",
        "2026-08-28",
    )

    payload = json.loads(output.read_text(encoding="utf-8"))
    by_id = {project["projectId"]: project for project in payload["projects"]}
    assert set(by_id) == {"missing-tool", "public-tool"}
    measured = by_id["public-tool"]
    assert measured["repositoryUrl"] == "https://github.com/Example/public-tool"
    assert measured["commit"]["value"] == commit
    assert measured["commit"]["value"] != auxiliary_commit
    assert measured["commit"]["value"] != scratch_commit
    assert measured["sourceFiles"] == {"status": "measured", "unit": "tracked files", "value": 1}
    assert measured["testFiles"] == {"status": "measured", "unit": "tracked files", "value": 1}
    assert measured["sourceLoc"] == {"status": "measured", "unit": "physical lines", "value": 2}
    assert measured["testLoc"] == {"status": "measured", "unit": "physical lines", "value": 6}
    assert measured["testCollectionCount"]["status"] == "measured"
    assert measured["testCollectionCount"]["value"] == 2
    assert measured["testCollectionCount"]["method"] == "static-python-ast"
    assert measured["extensions"] == [
        {
            "extension": ".py",
            "language": "Python",
            "loc": 8,
            "sourceFiles": 1,
            "sourceLoc": 2,
            "testFiles": 1,
            "testLoc": 6,
        }
    ]

    missing = by_id["missing-tool"]
    assert missing["commit"] == {"status": "unknown", "reason": "local_checkout_not_found"}
    assert missing["testCollectionCount"] == {
        "status": "unknown",
        "reason": "local_checkout_not_found",
        "unit": "statically recognized test definitions",
    }
    serialized = output.read_text(encoding="utf-8")
    assert str(tmp_path) not in serialized
    assert "private-tool" not in serialized
    assert payload["method"]["snapshot"] == "git HEAD blobs only"
    assert "vendor" in payload["method"]["excludedPathSegments"]
    assert payload["doesNotProve"]
    benchmark = payload["benchmarkEvidence"]
    assert benchmark["status"] == "measured"
    assert len(benchmark["comparisonGroups"]) == 1
    group = benchmark["comparisonGroups"][0]
    assert group["taskSetId"] == "shared-v1"
    assert group["taskCount"] == 1
    assert group["environment"]["hardware"] == "fixture CPU; 16 GiB RAM"
    assert group["capturedAt"] == "2026-08-28T12:00:00Z"
    assert group["confidence"]["level"] == "fixture"
    assert {run["harnessId"] for run in group["runs"]} == {"codex", "flywheel"}
    assert {run["toolName"] for run in group["runs"]} == {"Codex", "Flywheel"}
    assert all(run["rawArtifactLinks"] for run in group["runs"])
    assert all(run["metrics"]["latencyMs"]["status"] == "measured" for run in group["runs"])
    assert {target["status"] for target in benchmark["baselineTargets"]} == {"NOT_MEASURED"}


def test_renderer_centers_comparable_benchmark_evidence_and_keeps_source_inventory_tabular(tmp_path: Path) -> None:
    dataset = {
        "schema": "harperz9-portfolio-analytics/v1",
        "capturedAt": "2026-08-28",
        "method": {
            "snapshot": "git HEAD blobs only",
            "lineCount": "physical lines including comments and blanks",
            "testCollection": "static recognition; repository code was not executed",
            "excludedPathSegments": ["vendor", "node_modules"],
        },
        "doesNotProve": "File and line counts do not establish software quality, adoption, security, or completeness.",
        "benchmarkDoesNotProve": "A same-task-set comparison does not establish general model quality, production reliability, or independent validation.",
        "projects": [
            {
                "projectId": "measured",
                "name": "Measured",
                "repositoryUrl": "https://github.com/Example/measured",
                "commit": {"status": "measured", "value": "abc123"},
                "commitDate": {"status": "measured", "value": "2026-08-27T12:00:00+00:00"},
                "sourceFiles": {"status": "measured", "value": 4, "unit": "tracked files"},
                "testFiles": {"status": "measured", "value": 2, "unit": "tracked files"},
                "sourceLoc": {"status": "measured", "value": 120, "unit": "physical lines"},
                "testLoc": {"status": "measured", "value": 40, "unit": "physical lines"},
                "testCollectionCount": {
                    "status": "measured",
                    "value": 7,
                    "unit": "statically recognized test definitions",
                    "method": "static-python-ast",
                },
                "extensions": [
                    {
                        "extension": ".py",
                        "language": "Python",
                        "loc": 160,
                        "sourceFiles": 4,
                        "sourceLoc": 120,
                        "testFiles": 2,
                        "testLoc": 40,
                    }
                ],
            },
            {
                "projectId": "unknown",
                "name": "Unknown",
                "repositoryUrl": "https://github.com/Example/unknown",
                "commit": {"status": "unknown", "reason": "local_checkout_not_found"},
                "commitDate": {"status": "unknown", "reason": "local_checkout_not_found"},
                "sourceFiles": {"status": "unknown", "reason": "local_checkout_not_found", "unit": "tracked files"},
                "testFiles": {"status": "unknown", "reason": "local_checkout_not_found", "unit": "tracked files"},
                "sourceLoc": {"status": "unknown", "reason": "local_checkout_not_found", "unit": "physical lines"},
                "testLoc": {"status": "unknown", "reason": "local_checkout_not_found", "unit": "physical lines"},
                "testCollectionCount": {
                    "status": "unknown",
                    "reason": "local_checkout_not_found",
                    "unit": "statically recognized test definitions",
                },
                "extensions": [],
            },
        ],
        "benchmarkEvidence": {
            "status": "measured",
            "unit": "same-task-set comparison groups",
            "comparisonGroups": [
                {
                    "groupId": "shared-v1-agentic-v1-same-policy-v1",
                    "taskSetId": "shared-v1",
                    "metricSchema": "agentic-v1",
                    "executionPolicy": "same-policy-v1",
                    "taskSetFingerprint": "f" * 64,
                    "taskCount": 1,
                    "capturedAt": "2026-08-28T12:00:00Z",
                    "environment": {"environmentId": "same-host", "hardware": "Fixture CPU", "operatingSystem": "Fixture OS", "runtime": "Node fixture"},
                    "confidence": {"level": "fixture", "basis": "complete one-task receipts"},
                    "limitations": ["One fixture task."],
                    "sourceProjectId": "measured",
                    "repositoryUrl": "https://github.com/Example/measured",
                    "commit": "abc123",
                    "trackedPath": "benchmarks/shared-scorecard.json",
                    "runs": [
                        {
                            "runId": "codex-run",
                            "harnessId": "codex",
                            "modelId": "model-a",
                            "toolName": "Codex",
                            "toolVersion": "1.0.0",
                            "configurationId": "codex-a",
                            "rawArtifactLinks": ["https://github.com/Example/measured/blob/abc123/codex.json"],
                            "executedTaskCount": 1,
                            "failureModes": {"none": 1},
                            "metrics": {
                                "taskCompletion": {"status": "measured", "value": 1, "unit": "ratio"},
                                "quality": {"status": "measured", "value": 0.8, "unit": "score ratio"},
                                "latencyMs": {"status": "measured", "value": 100, "unit": "milliseconds"},
                                "toolUseSuccess": {"status": "measured", "value": 1, "unit": "ratio"},
                                "reproducibility": {"status": "measured", "value": 1, "unit": "ratio"},
                                "resourceUse": {"status": "unknown", "reason": "not_reported"},
                                "costUsd": {"status": "unknown", "reason": "not_reported", "unit": "USD"},
                            },
                        },
                        {
                            "runId": "flywheel-run",
                            "harnessId": "flywheel",
                            "modelId": "model-a",
                            "toolName": "Flywheel",
                            "toolVersion": "1.0.0",
                            "configurationId": "flywheel-a",
                            "rawArtifactLinks": ["https://github.com/Example/measured/blob/abc123/flywheel.json"],
                            "executedTaskCount": 1,
                            "failureModes": {"none": 1},
                            "metrics": {
                                "taskCompletion": {"status": "measured", "value": 1, "unit": "ratio"},
                                "quality": {"status": "measured", "value": 0.9, "unit": "score ratio"},
                                "latencyMs": {"status": "measured", "value": 80, "unit": "milliseconds"},
                                "toolUseSuccess": {"status": "measured", "value": 1, "unit": "ratio"},
                                "reproducibility": {"status": "measured", "value": 1, "unit": "ratio"},
                                "resourceUse": {"status": "unknown", "reason": "not_reported"},
                                "costUsd": {"status": "unknown", "reason": "not_reported", "unit": "USD"},
                            },
                        },
                    ],
                }
            ],
            "excludedCandidates": [],
            "baselineTargets": [],
        },
    }
    source = tmp_path / "analytics.json"
    source.write_text(json.dumps(dataset), encoding="utf-8")
    out = tmp_path / "figures"

    run("node", str(RENDER), "--input", str(source), "--output-dir", str(out))

    figure_id = "portfolio-benchmark-comparison"
    html = (out / f"{figure_id}.html").read_text(encoding="utf-8")
    svg = (out / f"{figure_id}.svg").read_text(encoding="utf-8")
    companion = json.loads((out / f"{figure_id}.json").read_text(encoding="utf-8"))
    assert "<title" in svg and "<desc" in svg
    assert 'tabindex="0"' in svg
    assert "Text equivalent" in html
    assert "2026-08-28" in html
    assert "same task set" in html.lower()
    assert "task completion" in html.lower()
    assert "latency" in html.lower()
    assert "tool-use success" in html.lower()
    assert "failure modes" in html.lower()
    assert "resource use" in html.lower() and "Unknown" in html
    assert companion["figure"]["doesNotProve"] == dataset["benchmarkDoesNotProve"]
    assert companion["figure"]["retrievedAt"] == "2026-08-28"

    inventory = (out / "portfolio-source-inventory.html").read_text(encoding="utf-8")
    assert "supporting inventory" in inventory.lower()
    assert "physical lines" in inventory
    assert "local_checkout_not_found" in inventory
    assert not (out / "portfolio-source-inventory.svg").exists()
    serialized = "".join(path.read_text(encoding="utf-8") for path in out.iterdir())
    assert str(tmp_path) not in serialized


def test_renderer_withholds_benchmark_chart_without_comparable_group(tmp_path: Path) -> None:
    dataset = {
        "schema": "harperz9-portfolio-analytics/v1",
        "capturedAt": "2026-08-28",
        "method": {"excludedPathSegments": []},
        "uncertainty": "No comparable scorecard was found.",
        "doesNotProve": "Inventory does not prove quality.",
        "benchmarkDoesNotProve": "No benchmark conclusion is available.",
        "projects": [],
        "benchmarkEvidence": {
            "status": "unknown",
            "reason": "no_valid_comparable_scorecards_found",
            "unit": "same-task-set comparison groups",
            "comparisonGroups": [],
            "baselineTargets": [
                {"targetId": "claude_code", "toolName": "Claude Code", "modelName": "configured by operator", "status": "NOT_MEASURED", "reason": "needs_adapter"}
            ],
            "excludedCandidates": [
                {"projectId": "flywheel", "trackedPath": "artifacts_legacy.json", "reason": "missing_task_set_identity"}
            ],
        },
    }
    source = tmp_path / "analytics.json"
    source.write_text(json.dumps(dataset), encoding="utf-8")
    out = tmp_path / "figures"

    run("node", str(RENDER), "--input", str(source), "--output-dir", str(out))

    assert not (out / "portfolio-benchmark-comparison.svg").exists()
    assert not (out / "portfolio-benchmark-comparison.html").exists()
    status = (out / "benchmark-evidence-status.html").read_text(encoding="utf-8")
    assert "no_valid_comparable_scorecards_found" in status
    assert "artifacts_legacy.json" in status


def test_renderer_publishes_current_cross_harness_integration_failure_profile(tmp_path: Path) -> None:
    out = tmp_path / "figures"
    run("node", str(RENDER), "--input", str(ANALYTICS_DATASET), "--output-dir", str(out))

    html = (out / "current-cross-harness-pilot.html").read_text(encoding="utf-8")
    svg = (out / "current-cross-harness-pilot.svg").read_text(encoding="utf-8")
    companion = json.loads((out / "current-cross-harness-pilot.json").read_text(encoding="utf-8"))
    source_record_path = ROOT / "analytics" / "source" / "current-cross-harness-pilot-source.json"
    source_record = json.loads(source_record_path.read_text(encoding="utf-8"))

    assert companion["schema"] == "zentropy-current-cross-harness-pilot/v1"
    assert companion["classification"] == "integration-failure-profile"
    assert companion["sourceCommit"] == "09f4d3730f5f81d88b0aba130a1067979d0a7d07"
    assert companion["sourceCommitUrl"] == "https://github.com/HarperZ9/flywheel/commit/09f4d3730f5f81d88b0aba130a1067979d0a7d07"
    assert companion["sourceEvidence"] == {
        "href": "source/current-cross-harness-pilot-source.json",
        "sha256": hashlib.sha256(source_record_path.read_bytes()).hexdigest(),
        "availability": "operator-local-hash-only",
    }
    assert source_record["schema"] == "zentropy-current-cross-harness-pilot-source/v1"
    assert companion["parity"] == {
        "prompt": "byte-identical",
        "runtimeContext": "byte-identical",
    }
    assert companion["receipts"]["verified"] == 4
    assert companion["receipts"]["attempts"] == 4
    assert len(companion["receipts"]["records"]) == 4
    assert all(record["state"] == "verified" for record in companion["receipts"]["records"])
    assert all(len(record["receiptSha256"]) == 64 for record in companion["receipts"]["records"])
    assert all(len(record["receiptSubjectSha256"]) == 64 for record in companion["receipts"]["records"])
    assert companion["validComparableTaskOutcomes"] == 0
    assert [attempt["latencyMs"] for attempt in companion["attempts"]] == [35357, 5664, 2028, 2043]
    assert [attempt["execution"] for attempt in companion["attempts"]] == [
        "returned", "internal_error", "malformed", "malformed",
    ]
    assert [attempt["oracle"] for attempt in companion["attempts"]] == [
        "fail", "not_run", "not_run", "not_run",
    ]
    assert all(attempt["receipt"] == "verified" for attempt in companion["attempts"])
    assert companion["observations"] == {
        "costUsd": None,
        "resourceUse": None,
        "observedModelIdentity": None,
    }
    assert set(companion["artifactHashes"]) == {
        "manifest", "runtimeMatrix", "runRecord", "comparisonInput", "artifactIndex",
    }
    assert companion["limitations"]
    assert companion["doesNotProve"]
    assert "integration-failure profile" in html.lower()
    assert "not market performance" in html.lower()
    assert "not a quality ranking" in html.lower()
    assert "4/4" in html and "0 valid comparable task outcomes" in html
    assert "byte-identical" in html
    assert "35,357 ms" in html and "5,664 ms" in html
    assert "2,028 ms" in html and "2,043 ms" in html
    assert "Unknown" in html and "What this does not prove" in html
    assert 'href="source/current-cross-harness-pilot-source.json"' in html
    assert "operator-local-hash-only" in html
    assert '<div id="site-nav" class="site-nav"></div>' in html
    assert 'src="../system/nav.js?v=20260902-creative-chassis"' in html
    assert "<title" in svg and "<desc" in svg
    assert "4/4 verified receipts" in svg and "0 valid comparable task outcomes" in svg
    serialized = html + svg + json.dumps(companion)
    assert "C:/dev" not in serialized and "C:\\dev" not in serialized and ".scratch" not in serialized


def test_sitemap_promotes_current_evidence_and_source_inventory() -> None:
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    assert "https://harperz9.github.io/analytics/current-cross-harness-pilot.html" in sitemap
    assert "https://harperz9.github.io/analytics/portfolio-source-inventory.html" in sitemap


def test_generated_analytics_keep_mobile_overflow_inside_keyboard_scrollers(tmp_path: Path) -> None:
    import pytest

    playwright = pytest.importorskip(
        "playwright.sync_api",
        reason="responsive contract requires the optional Playwright dependency",
    )
    chrome_candidates = [
        Path(os.environ.get("PROGRAMFILES", "C:/Program Files")) / "Google/Chrome/Application/chrome.exe",
        Path(os.environ.get("PROGRAMFILES(X86)", "C:/Program Files (x86)")) / "Microsoft/Edge/Application/msedge.exe",
    ]
    browser_path = next((path for path in chrome_candidates if path.exists()), None)
    if browser_path is None:
        pytest.skip("responsive contract requires a local Chromium browser")

    out = tmp_path / "figures"
    run("node", str(RENDER), "--input", str(ANALYTICS_DATASET), "--output-dir", str(out))
    with playwright.sync_playwright() as runtime:
        browser = runtime.chromium.launch(executable_path=str(browser_path), headless=True)
        page = browser.new_page(viewport={"width": 390, "height": 844})
        page.goto((out / "exploratory-stack-comparison.html").as_uri())
        widths = page.evaluate(
            "() => ({ client: document.documentElement.clientWidth, scroll: document.documentElement.scrollWidth })"
        )
        scrollers = page.evaluate(
            """() => [...document.querySelectorAll('.figure-scroll, .table-wrap')].map((element) => ({
              className: element.className,
              tabIndex: element.tabIndex,
              clientWidth: element.clientWidth,
              scrollWidth: element.scrollWidth,
              overflowX: getComputedStyle(element).overflowX,
            }))"""
        )
        browser.close()

    assert widths == {"client": 390, "scroll": 390}
    assert scrollers
    assert all(scroller["tabIndex"] == 0 for scroller in scrollers)
    assert all(scroller["overflowX"] == "auto" for scroller in scrollers)
    assert any(scroller["scrollWidth"] > scroller["clientWidth"] for scroller in scrollers)


def test_site_owned_market_baseline_plan_is_explicitly_not_measured() -> None:
    plan = json.loads(BASELINE_PLAN.read_text(encoding="utf-8"))
    assert plan["schema"] == "zentropy-market-baseline-plan/v1"
    assert {target["name"] for target in plan["targets"]} == {
        "Aider",
        "Claude Code",
        "Cline",
        "OpenAI Codex",
        "OpenCode",
        "OpenHands",
    }
    assert {target["status"] for target in plan["targets"]} == {"NOT_MEASURED"}
    for target in plan["targets"]:
        assert target["officialUrl"].startswith("https://")
        assert target["version"] == "captured_at_execution"
        assert target["configuration"] == "captured_at_execution"
        assert target["environment"] == "shared_environment_captured_at_execution"


def test_actual_benchmark_artifacts_are_source_hashed_and_unavailable_rows_are_not_zeroes(tmp_path: Path) -> None:
    matrix = tmp_path / "matrix.json"
    matrix.write_text(
        json.dumps(
            {
                "schema": "m7-source-mined-scorecard/v1",
                "timestamp_utc": "2026-07-09T02:44:35Z",
                "case_ids": [f"case-{index}" for index in range(7)],
                "rows": [
                    {
                        "provider": "serve", "backend_name": "serve", "requested_model": "14b-cpt-adapter",
                        "case_count": 7, "passed_cases": 4, "pass_rate": 0.571, "mean_latency_ms": 30926.429,
                        "operational": True, "skipped": False,
                        "aggregate_metrics": {"mean_quality_score": 0.639, "error_rate": 0.0, "failure_class_counts": {"none": 7}},
                    },
                    {
                        "provider": "ollama", "backend_name": "ollama:qwen2.5:7b", "requested_model": "qwen2.5:7b",
                        "case_count": 7, "passed_cases": 5, "pass_rate": 0.714, "mean_latency_ms": 1361.571,
                        "operational": True, "skipped": False,
                        "aggregate_metrics": {"mean_quality_score": 0.623, "error_rate": 0.0, "failure_class_counts": {"none": 7}},
                    },
                    {
                        "provider": "codex", "backend_name": "codex-plan", "requested_model": "gpt-5.3-codex-spark",
                        "case_count": 7, "passed_cases": 0, "pass_rate": 0.0, "mean_latency_ms": 84466.286,
                        "operational": True, "skipped": False,
                        "aggregate_metrics": {"mean_quality_score": 0.284, "error_rate": 0.0, "failure_class_counts": {"low_task_focus": 5, "none": 2}},
                    },
                    {
                        "provider": "claude", "backend_name": "claude-plan", "requested_model": "wrong-model",
                        "case_count": 7, "passed_cases": 0, "pass_rate": 0.0, "mean_latency_ms": 3,
                        "operational": False, "skipped": False,
                        "aggregate_metrics": {"mean_quality_score": 0.0, "error_rate": 1.0, "failure_class_counts": {"quota_or_rate_limit": 7}},
                    },
                    {
                        "provider": "opencode", "backend_name": "", "case_count": 0, "passed_cases": 0,
                        "pass_rate": 0.0, "mean_latency_ms": 0.0, "operational": False, "skipped": True,
                        "aggregate_metrics": {"mean_quality_score": 0.0, "error_rate": 0.0, "failure_class_counts": {}},
                    },
                ],
            }
        ),
        encoding="utf-8",
    )
    base = tmp_path / "he.json"
    base.write_text(
        json.dumps(
            {
                "schema": "flywheel.he-base-comparison/v1",
                "benchmark": "code-completion suite (164 tasks), pass@1 greedy temp0, same harness",
                "base": {"model_ref": "ollama:qwen2.5-coder:14b-instruct-q4_K_M", "passed": 141, "n": 164, "pass_at_1": 0.8598},
                "flywheel": {"model_ref": "ollama:flywheel-local-coder-14b", "passed": 136, "n": 164, "pass_at_1": 0.8293},
                "delta_points": -0.0305,
                "paired": {"regressions_flywheel_fail_base_pass": 14, "gains_flywheel_pass_base_fail": 9, "both_pass": 127, "both_fail": 14},
                "mcnemar": {"chi2_cc": 0.696, "p_value": 0.404, "significant_0.05": False},
            }
        ),
        encoding="utf-8",
    )
    registry = tmp_path / "systems.json"
    registry.write_text('{"schema":"harperz9-systems/v4","systems":[]}', encoding="utf-8")
    output = tmp_path / "analytics.json"
    run(
        sys.executable, str(CAPTURE), "--workspace-root", str(tmp_path), "--registry", str(registry),
        "--output", str(output), "--exploratory-matrix", str(matrix), "--he-base-comparison", str(base),
        "--as-of-date", "2026-08-28",
    )
    payload = json.loads(output.read_text(encoding="utf-8"))
    actual = payload["benchmarkEvidence"]["actualComparisons"]
    exploratory = actual["exploratoryStackMatrix"]
    assert exploratory["sourceSha256"]
    assert exploratory["denominator"] == 7
    assert {row["providerId"] for row in exploratory["measuredRows"]} == {"serve", "ollama", "codex"}
    assert all("passRate" not in row for row in exploratory["unavailableRows"])
    assert {row["providerId"] for row in exploratory["unavailableRows"]} == {"claude", "opencode"}
    assert actual["modelComparison"]["mcnemar"]["pValue"] == 0.404
    assert actual["modelComparison"]["sourceSha256"]
    assert str(tmp_path) not in output.read_text(encoding="utf-8")

    figures = tmp_path / "figures"
    run("node", str(RENDER), "--input", str(output), "--output-dir", str(figures))
    for stem in ("exploratory-stack-comparison", "model-pass-at-1-comparison"):
        svg = (figures / f"{stem}.svg").read_text(encoding="utf-8")
        html = (figures / f"{stem}.html").read_text(encoding="utf-8")
        companion = json.loads((figures / f"{stem}.json").read_text(encoding="utf-8"))
        assert "<title" in svg and "<desc" in svg and 'tabindex="0"' in svg
        assert "Text equivalent" in html
        assert companion["figure"]["sourceSha256"]
    exploratory_html = (figures / "exploratory-stack-comparison.html").read_text(encoding="utf-8")
    assert "Claude" in exploratory_html and "NOT OPERATIONAL" in exploratory_html
    assert "OpenCode" in exploratory_html and "SKIPPED" in exploratory_html
    assert "different models" in exploratory_html.lower()
