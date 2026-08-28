#!/usr/bin/env python3
"""Capture reproducible, commit-backed analytics for public portfolio projects.

The publication registry is the allow-list. The script never inventories an
unlisted repository and never executes repository code. Measurements are read
from Git ``HEAD`` blobs so local edits, untracked files, and ignored files do
not enter the output.
"""

from __future__ import annotations

import argparse
import ast
import hashlib
import json
import os
import re
import subprocess
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path, PurePosixPath
from typing import Any
from urllib.parse import urlparse


SITE_ROOT = Path(__file__).resolve().parents[1]
SCHEMA = "harperz9-portfolio-analytics/v1"

LANGUAGES = {
    ".c": "C",
    ".cc": "C++",
    ".clj": "Clojure",
    ".cljs": "ClojureScript",
    ".cpp": "C++",
    ".cs": "C#",
    ".cxx": "C++",
    ".dart": "Dart",
    ".ex": "Elixir",
    ".exs": "Elixir",
    ".fs": "F#",
    ".fsx": "F#",
    ".go": "Go",
    ".h": "C/C++ header",
    ".hh": "C++ header",
    ".hpp": "C++ header",
    ".hxx": "C++ header",
    ".java": "Java",
    ".js": "JavaScript",
    ".jsx": "JavaScript JSX",
    ".kt": "Kotlin",
    ".kts": "Kotlin",
    ".lua": "Lua",
    ".m": "Objective-C",
    ".mm": "Objective-C++",
    ".php": "PHP",
    ".ps1": "PowerShell",
    ".py": "Python",
    ".r": "R",
    ".rb": "Ruby",
    ".rs": "Rust",
    ".scala": "Scala",
    ".sh": "Shell",
    ".sol": "Solidity",
    ".swift": "Swift",
    ".ts": "TypeScript",
    ".tsx": "TypeScript JSX",
    ".vb": "Visual Basic",
    ".zig": "Zig",
}

# These paths are intentionally outside the project-authored code denominator.
EXCLUDED_PATH_SEGMENTS = {
    ".git",
    ".pytest_cache",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "external",
    "generated",
    "node_modules",
    "target",
    "third_party",
    "vendor",
    "venv",
}

# Never traverse these workspace areas while looking for registry-listed repos.
DISCOVERY_EXCLUSIONS = EXCLUDED_PATH_SEGMENTS | {
    ".scratch",
    ".worktrees",
    "protected",
    "secret",
    "secrets",
    "scratch",
    "tmp",
    "temp",
}

SUPPORTED_STATIC_TEST_EXTENSIONS = {
    ".c",
    ".cc",
    ".cpp",
    ".cxx",
    ".go",
    ".h",
    ".hh",
    ".hpp",
    ".hxx",
    ".java",
    ".js",
    ".jsx",
    ".py",
    ".rs",
    ".ts",
    ".tsx",
}


def git(repo: Path, *args: str, text: bool = True) -> str | bytes:
    completed = subprocess.run(
        ["git", "-C", str(repo), *args],
        check=True,
        capture_output=True,
        text=text,
        encoding="utf-8" if text else None,
        errors="replace" if text else None,
    )
    return completed.stdout


def public_github_url(value: Any) -> str | None:
    """Return a canonical GitHub repository URL, or None for other sources."""
    if not isinstance(value, str):
        return None
    raw = value.strip()
    if raw.startswith("git@github.com:"):
        path = raw.split(":", 1)[1]
    elif raw.startswith("ssh://git@github.com/"):
        path = raw.removeprefix("ssh://git@github.com/")
    else:
        parsed = urlparse(raw)
        if parsed.scheme != "https" or parsed.netloc.lower() != "github.com":
            return None
        path = parsed.path.lstrip("/")
    parts = [part for part in path.split("/") if part]
    if len(parts) < 2:
        return None
    owner, repository = parts[0], parts[1].removesuffix(".git")
    if not re.fullmatch(r"[A-Za-z0-9_.-]+", owner) or not re.fullmatch(r"[A-Za-z0-9_.-]+", repository):
        return None
    return f"https://github.com/{owner}/{repository}"


def repository_key(url: str) -> str:
    return url.removesuffix(".git").rstrip("/").lower()


def discover_public_checkouts(workspace_root: Path, allowed_urls: set[str]) -> dict[str, Path]:
    """Find local checkouts whose origin matches the public registry allow-list."""
    found: dict[str, Path] = {}
    for current, directories, files in os.walk(workspace_root):
        has_git_marker = ".git" in directories or ".git" in files
        directories[:] = sorted(
            directory
            for directory in directories
            if directory.lower() not in DISCOVERY_EXCLUSIONS
            and not directory.lower().startswith(".wt-")
            and not directory.lower().startswith("_fw")
            and "worktree" not in directory.lower()
        )
        current_path = Path(current)
        if not has_git_marker:
            continue
        try:
            remote = str(git(current_path, "remote", "get-url", "origin")).strip()
        except (OSError, subprocess.CalledProcessError):
            continue
        canonical = public_github_url(remote)
        if canonical is None:
            continue
        key = repository_key(canonical)
        if key in allowed_urls and key not in found:
            found[key] = current_path
            # Once an allow-listed repository is found, nested dependencies or
            # worktrees cannot contribute a second public project measurement.
            directories[:] = []
    return found


def measured(value: int | str, unit: str | None = None, **extra: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"status": "measured", "value": value}
    if unit:
        result["unit"] = unit
    result.update(extra)
    return result


def unknown(reason: str, unit: str | None = None) -> dict[str, Any]:
    result: dict[str, Any] = {"status": "unknown", "reason": reason}
    if unit:
        result["unit"] = unit
    return result


def physical_lines(blob: bytes) -> int:
    if not blob:
        return 0
    return blob.count(b"\n") + (0 if blob.endswith(b"\n") else 1)


def git_head_blobs(repo: Path, paths: list[str]) -> dict[str, bytes]:
    """Read many HEAD blobs through one Git process.

    Newlines in Git path names are deliberately rejected because the batch
    protocol uses line-delimited object expressions. Such a repository remains
    measurable for all ordinary paths but the exceptional file is excluded.
    """
    safe_paths = [path for path in paths if "\n" not in path and "\r" not in path]
    if not safe_paths:
        return {}
    query = "".join(f"HEAD:{path}\n" for path in safe_paths).encode("utf-8")
    completed = subprocess.run(
        ["git", "-C", str(repo), "cat-file", "--batch"],
        input=query,
        check=True,
        capture_output=True,
    )
    output = completed.stdout
    offset = 0
    blobs: dict[str, bytes] = {}
    for path in safe_paths:
        header_end = output.find(b"\n", offset)
        if header_end < 0:
            raise subprocess.CalledProcessError(1, "git cat-file --batch", output=output)
        header = output[offset:header_end].decode("ascii", errors="replace").split()
        if len(header) != 3 or header[1] != "blob":
            raise subprocess.CalledProcessError(1, "git cat-file --batch", output=output)
        size = int(header[2])
        start = header_end + 1
        end = start + size
        blobs[path] = output[start:end]
        offset = end + 1
    return blobs


def is_excluded(path: str) -> bool:
    return any(part.lower() in EXCLUDED_PATH_SEGMENTS for part in PurePosixPath(path).parts)


def is_test_path(path: str) -> bool:
    pure = PurePosixPath(path)
    parts = [part.lower() for part in pure.parts[:-1]]
    name = pure.name.lower()
    stem = pure.stem.lower()
    return (
        any(part in {"test", "tests", "__tests__", "spec", "specs"} for part in parts)
        or stem.startswith("test_")
        or stem.endswith("_test")
        or ".test." in name
        or ".spec." in name
    )


def static_python_tests(text: str) -> int:
    tree = ast.parse(text)
    count = 0
    for node in tree.body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name.startswith("test_"):
            count += 1
        elif isinstance(node, ast.ClassDef) and node.name.startswith("Test"):
            count += sum(
                isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef)) and child.name.startswith("test_")
                for child in node.body
            )
    return count


def static_test_count(extension: str, blob: bytes) -> int:
    text = blob.decode("utf-8", errors="replace")
    if extension == ".py":
        return static_python_tests(text)
    if extension in {".js", ".jsx", ".ts", ".tsx"}:
        return len(re.findall(r"(?<![.\w])(?:test|it)\s*\(", text))
    if extension == ".rs":
        return len(re.findall(r"#\s*\[\s*(?:(?:tokio|async_std)::)?test(?:\s*\([^]]*\))?\s*\]", text))
    if extension == ".go":
        return len(re.findall(r"(?m)^\s*func\s+Test[A-Z_]\w*\s*\(", text))
    if extension == ".java":
        return len(re.findall(r"(?m)^\s*@(?:org\.junit\.[\w.]+\.)?Test\b", text))
    if extension in {".c", ".cc", ".cpp", ".cxx", ".h", ".hh", ".hpp", ".hxx"}:
        return len(re.findall(r"\b(?:TEST|TEST_F|TEST_P|TEST_CASE)\s*\(", text))
    raise ValueError(f"unsupported static test extension: {extension}")


def measure_repository(project: dict[str, Any], repository_url: str, repo: Path) -> dict[str, Any]:
    try:
        commit = str(git(repo, "rev-parse", "HEAD")).strip()
        commit_date = str(git(repo, "show", "-s", "--format=%cI", "HEAD")).strip()
        names_raw = git(repo, "ls-tree", "-r", "--name-only", "-z", "HEAD", text=False)
        assert isinstance(names_raw, bytes)
        tracked_paths = sorted(path.decode("utf-8", errors="replace") for path in names_raw.split(b"\0") if path)
    except (OSError, subprocess.CalledProcessError):
        return unknown_project(project, repository_url, "git_snapshot_unavailable")

    code_paths = [
        path
        for path in tracked_paths
        if PurePosixPath(path).suffix.lower() in LANGUAGES and not is_excluded(path)
    ]
    try:
        blobs = git_head_blobs(repo, code_paths)
    except (OSError, subprocess.CalledProcessError, ValueError):
        return unknown_project(project, repository_url, "git_blob_unavailable")

    extension_rows: dict[str, dict[str, int | str]] = defaultdict(
        lambda: {
            "sourceFiles": 0,
            "sourceLoc": 0,
            "testFiles": 0,
            "testLoc": 0,
        }
    )
    test_blobs: list[tuple[str, bytes]] = []
    source_files = test_files = source_loc = test_loc = 0
    for path in code_paths:
        extension = PurePosixPath(path).suffix.lower()
        if path not in blobs:
            continue
        blob = blobs[path]
        lines = physical_lines(blob)
        row = extension_rows[extension]
        if is_test_path(path):
            test_files += 1
            test_loc += lines
            row["testFiles"] = int(row["testFiles"]) + 1
            row["testLoc"] = int(row["testLoc"]) + lines
            test_blobs.append((extension, blob))
        else:
            source_files += 1
            source_loc += lines
            row["sourceFiles"] = int(row["sourceFiles"]) + 1
            row["sourceLoc"] = int(row["sourceLoc"]) + lines

    unsupported = sorted({extension for extension, _ in test_blobs if extension not in SUPPORTED_STATIC_TEST_EXTENSIONS})
    if unsupported:
        collection = unknown(
            f"unsupported_test_file_extensions:{','.join(unsupported)}",
            "statically recognized test definitions",
        )
    else:
        try:
            test_count = sum(static_test_count(extension, blob) for extension, blob in test_blobs)
        except (SyntaxError, ValueError):
            collection = unknown("static_test_parse_failed", "statically recognized test definitions")
        else:
            method_by_extension = {
                ".py": "static-python-ast",
                ".js": "static-javascript-patterns",
                ".jsx": "static-javascript-patterns",
                ".ts": "static-javascript-patterns",
                ".tsx": "static-javascript-patterns",
                ".rs": "static-rust-attributes",
                ".go": "static-go-functions",
                ".java": "static-java-annotations",
                ".c": "static-c-family-macros",
                ".cc": "static-c-family-macros",
                ".cpp": "static-c-family-macros",
                ".cxx": "static-c-family-macros",
                ".h": "static-c-family-macros",
                ".hh": "static-c-family-macros",
                ".hpp": "static-c-family-macros",
                ".hxx": "static-c-family-macros",
            }
            methods = sorted({method_by_extension[extension] for extension, _ in test_blobs})
            method = methods[0] if len(methods) == 1 else "static-multi-language"
            if not test_blobs:
                method = "static-no-test-files"
            collection = measured(
                test_count,
                "statically recognized test definitions",
                method=method,
            )

    extensions = []
    for extension in sorted(extension_rows):
        row = extension_rows[extension]
        extensions.append(
            {
                "extension": extension,
                "language": LANGUAGES[extension],
                "loc": int(row["sourceLoc"]) + int(row["testLoc"]),
                "sourceFiles": row["sourceFiles"],
                "sourceLoc": row["sourceLoc"],
                "testFiles": row["testFiles"],
                "testLoc": row["testLoc"],
            }
        )

    return {
        "projectId": project["id"],
        "name": project.get("name", project["id"]),
        "repositoryUrl": repository_url,
        "commit": measured(commit),
        "commitDate": measured(commit_date),
        "sourceFiles": measured(source_files, "tracked files"),
        "testFiles": measured(test_files, "tracked files"),
        "sourceLoc": measured(source_loc, "physical lines"),
        "testLoc": measured(test_loc, "physical lines"),
        "testCollectionCount": collection,
        "extensions": extensions,
    }


def unknown_project(project: dict[str, Any], repository_url: str, reason: str) -> dict[str, Any]:
    return {
        "projectId": project["id"],
        "name": project.get("name", project["id"]),
        "repositoryUrl": repository_url,
        "commit": unknown(reason),
        "commitDate": unknown(reason),
        "sourceFiles": unknown(reason, "tracked files"),
        "testFiles": unknown(reason, "tracked files"),
        "sourceLoc": unknown(reason, "physical lines"),
        "testLoc": unknown(reason, "physical lines"),
        "testCollectionCount": unknown(reason, "statically recognized test definitions"),
        "extensions": [],
    }


def is_benchmark_candidate(path: str) -> bool:
    lower = path.lower()
    name = PurePosixPath(lower).name
    return (
        lower.endswith(".json")
        and (
            "benchmark" in lower
            or "scorecard" in lower
            or name.startswith("artifacts_")
            or name.endswith("_scorecard.json")
        )
        and not is_excluded(path)
    )


def average(values: list[float]) -> float:
    return sum(values) / len(values)


def numeric_metric(rows: list[dict[str, Any]], key: str, unit: str) -> dict[str, Any]:
    values = [row.get("metrics", {}).get(key) for row in rows]
    if not values or not all(isinstance(value, (int, float)) and not isinstance(value, bool) for value in values):
        return unknown("not_reported_for_every_task", unit)
    return measured(average([float(value) for value in values]), unit, aggregation="arithmetic mean")


def parse_comparable_scorecard(
    payload: dict[str, Any],
    *,
    project_id: str,
    repository_url: str,
    commit: str,
    tracked_path: str,
) -> tuple[dict[str, Any] | None, str | None]:
    required_header = ("task_set_id", "metric_schema", "execution_policy")
    if not all(isinstance(payload.get(key), str) and payload[key] for key in required_header):
        return None, "missing_task_set_metric_schema_or_execution_policy"
    rows = payload.get("rows")
    if not isinstance(rows, list) or len(rows) < 2:
        return None, "insufficient_scorecard_rows"

    captured_at = payload.get("captured_at")
    environment = payload.get("environment")
    confidence = payload.get("confidence")
    limitations = payload.get("limitations")
    required_environment = ("environment_id", "hardware", "operating_system", "runtime")
    if not isinstance(captured_at, str) or not captured_at:
        return None, "missing_capture_date"
    if not isinstance(environment, dict) or not all(
        isinstance(environment.get(key), str) and environment[key] for key in required_environment
    ):
        return None, "missing_environment_hardware_or_runtime_identity"
    if not isinstance(confidence, dict) or not isinstance(confidence.get("level"), str) or not isinstance(confidence.get("basis"), str):
        return None, "missing_confidence_statement"
    if not isinstance(limitations, list) or not limitations or not all(isinstance(item, str) and item for item in limitations):
        return None, "missing_limitations"

    required_row = (
        "run_id",
        "task_id",
        "raw_prompt_sha256",
        "harness_id",
        "model_id",
        "tool_name",
        "tool_version",
        "configuration_id",
        "raw_artifact_url",
        "status",
        "metrics",
    )
    if not all(isinstance(row, dict) and all(key in row for key in required_row) for row in rows):
        return None, "missing_required_scorecard_row_fields"
    if any(row["status"] != "completed" for row in rows):
        return None, "non_completed_rows_present"
    if any(
        not all(isinstance(row[key], str) and row[key] for key in ("tool_name", "tool_version", "configuration_id"))
        or public_github_url(row["raw_artifact_url"]) is None
        for row in rows
    ):
        return None, "missing_tool_version_configuration_or_public_raw_artifact_link"
    required_metrics = ("task_completion", "quality", "latency_ms", "tool_use_success", "reproducibility")
    if any(
        not isinstance(row["metrics"], dict)
        or any(
            not isinstance(row["metrics"].get(metric), (int, float))
            or isinstance(row["metrics"].get(metric), bool)
            for metric in required_metrics
        )
        for row in rows
    ):
        return None, "missing_required_comparison_metrics"

    by_run: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        by_run[str(row["run_id"])].append(row)
    if len(by_run) < 2:
        return None, "fewer_than_two_runs"

    signatures: dict[str, list[tuple[str, str]]] = {}
    identities: set[tuple[str, str]] = set()
    for run_id, run_rows in by_run.items():
        harnesses = {str(row["harness_id"]) for row in run_rows}
        models = {str(row["model_id"]) for row in run_rows}
        tools = {str(row["tool_name"]) for row in run_rows}
        versions = {str(row["tool_version"]) for row in run_rows}
        configurations = {str(row["configuration_id"]) for row in run_rows}
        if any(len(values) != 1 for values in (harnesses, models, tools, versions, configurations)):
            return None, "run_identity_changes_across_tasks"
        identities.add((next(iter(harnesses)), next(iter(models))))
        signatures[run_id] = sorted((str(row["task_id"]), str(row["raw_prompt_sha256"])) for row in run_rows)
    first_signature = next(iter(signatures.values()))
    if any(signature != first_signature for signature in signatures.values()):
        return None, "task_or_prompt_set_differs_between_runs"
    if len(identities) < 2:
        return None, "fewer_than_two_harness_model_identities"

    fingerprint = hashlib.sha256(
        json.dumps(first_signature, separators=(",", ":"), ensure_ascii=True).encode("utf-8")
    ).hexdigest()
    runs = []
    for run_id in sorted(by_run):
        run_rows = by_run[run_id]
        failure_modes: dict[str, int] = defaultdict(int)
        for row in run_rows:
            failure_modes[str(row.get("failure_class") or "not_reported")] += 1
        runs.append(
            {
                "runId": run_id,
                "harnessId": str(run_rows[0]["harness_id"]),
                "modelId": str(run_rows[0]["model_id"]),
                "toolName": str(run_rows[0]["tool_name"]),
                "toolVersion": str(run_rows[0]["tool_version"]),
                "configurationId": str(run_rows[0]["configuration_id"]),
                "rawArtifactLinks": sorted({str(row["raw_artifact_url"]) for row in run_rows}),
                "executedTaskCount": len(run_rows),
                "failureModes": dict(sorted(failure_modes.items())),
                "metrics": {
                    "taskCompletion": numeric_metric(run_rows, "task_completion", "ratio"),
                    "quality": numeric_metric(run_rows, "quality", "score ratio"),
                    "latencyMs": numeric_metric(run_rows, "latency_ms", "milliseconds"),
                    "toolUseSuccess": numeric_metric(run_rows, "tool_use_success", "ratio"),
                    "reproducibility": numeric_metric(run_rows, "reproducibility", "ratio"),
                    "resourceUse": numeric_metric(run_rows, "resource_use", "reported resource units"),
                    "costUsd": numeric_metric(run_rows, "cost_usd", "USD"),
                },
            }
        )
    group_seed = f"{project_id}:{tracked_path}:{payload['task_set_id']}:{fingerprint}"
    group_id = hashlib.sha256(group_seed.encode("utf-8")).hexdigest()[:16]
    return {
        "groupId": group_id,
        "taskSetId": payload["task_set_id"],
        "metricSchema": payload["metric_schema"],
        "executionPolicy": payload["execution_policy"],
        "taskSetFingerprint": fingerprint,
        "taskCount": len(first_signature),
        "capturedAt": captured_at,
        "environment": {
            "environmentId": environment["environment_id"],
            "hardware": environment["hardware"],
            "operatingSystem": environment["operating_system"],
            "runtime": environment["runtime"],
        },
        "confidence": confidence,
        "limitations": limitations,
        "sourceProjectId": project_id,
        "repositoryUrl": repository_url,
        "commit": commit,
        "trackedPath": tracked_path,
        "runs": runs,
    }, None


def capture_benchmark_evidence(
    public_projects: list[tuple[dict[str, Any], str]],
    checkouts: dict[str, Path],
) -> dict[str, Any]:
    groups: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    baseline_targets: list[dict[str, Any]] = []
    for project, repository_url in public_projects:
        checkout = checkouts.get(repository_key(repository_url))
        if checkout is None:
            continue
        try:
            commit = str(git(checkout, "rev-parse", "HEAD")).strip()
            names_raw = git(checkout, "ls-tree", "-r", "--name-only", "-z", "HEAD", text=False)
            assert isinstance(names_raw, bytes)
        except (OSError, subprocess.CalledProcessError):
            continue
        tracked_paths = sorted(path.decode("utf-8", errors="replace") for path in names_raw.split(b"\0") if path)
        for path in (path for path in tracked_paths if is_benchmark_candidate(path)):
            record = {
                "projectId": project["id"],
                "repositoryUrl": repository_url,
                "commit": commit,
                "trackedPath": path,
            }
            try:
                blob = git(checkout, "show", f"HEAD:{path}", text=False)
                assert isinstance(blob, bytes)
                payload = json.loads(blob.decode("utf-8-sig"))
            except (OSError, subprocess.CalledProcessError, UnicodeDecodeError, json.JSONDecodeError):
                excluded.append({**record, "reason": "unreadable_json_candidate"})
                continue
            schema = payload.get("schema") if isinstance(payload, dict) else None
            if schema == "harness.cross-harness-adapter-contract/v2" and isinstance(payload.get("provider_roles"), list):
                tool_labels = {
                    "codex": "Codex",
                    "flywheel": "Flywheel",
                    "claude_code": "Claude Code",
                    "opencode": "OpenCode",
                    "local_endpoint": "Local model endpoint",
                    "dry_null": "Dry/null control",
                }
                for provider in payload["provider_roles"]:
                    if not isinstance(provider, dict) or provider.get("harness_id") == "dry_null":
                        continue
                    harness_id = str(provider.get("harness_id") or provider.get("provider_role") or "unknown")
                    model_name = str(provider.get("model_display_name") or provider.get("model_id") or "not specified")
                    baseline_targets.append(
                        {
                            "targetId": str(provider.get("provider_role") or harness_id),
                            "toolName": tool_labels.get(harness_id, harness_id.replace("_", " ").title()),
                            "modelName": model_name,
                            "status": "NOT_MEASURED",
                            "reason": str(provider.get("adapter_state") or "contract_only_no_executed_scorecard"),
                            "sourceProjectId": project["id"],
                            "repositoryUrl": repository_url,
                            "commit": commit,
                            "trackedPath": path,
                        }
                    )
            if schema != "harness.cross-harness-task-scorecard/v1":
                if isinstance(payload, dict) and "arms" in payload and "meta" in payload:
                    reason = "legacy_summary_missing_task_set_and_execution_identity"
                elif isinstance(schema, str) and ("plan" in schema or "contract" in schema or "adapter" in schema):
                    reason = "planning_or_contract_artifact_not_results"
                else:
                    reason = "unsupported_benchmark_result_schema"
                excluded.append({**record, "schema": schema or "unknown", "reason": reason})
                continue
            group, reason = parse_comparable_scorecard(
                payload,
                project_id=project["id"],
                repository_url=repository_url,
                commit=commit,
                tracked_path=path,
            )
            if group is None:
                excluded.append({**record, "schema": schema, "reason": reason})
            else:
                groups.append(group)

    groups.sort(key=lambda group: (group["taskSetId"], group["sourceProjectId"], group["trackedPath"]))
    excluded.sort(key=lambda record: (record["projectId"], record["trackedPath"]))
    deduplicated_targets: dict[tuple[str, str], dict[str, Any]] = {}
    for target in baseline_targets:
        deduplicated_targets[(target["targetId"], target["modelName"])] = target
    targets = sorted(deduplicated_targets.values(), key=lambda target: (target["toolName"], target["modelName"]))
    result: dict[str, Any] = {
        "status": "measured" if groups else "unknown",
        "unit": "same-task-set comparison groups",
        "comparisonGroups": groups,
        "excludedCandidates": excluded,
        "baselineTargets": targets,
    }
    if not groups:
        result["reason"] = "no_valid_comparable_scorecards_found"
    return result


def default_capture_date() -> str:
    epoch = os.environ.get("SOURCE_DATE_EPOCH")
    if epoch:
        return datetime.fromtimestamp(int(epoch), timezone.utc).date().isoformat()
    return date.today().isoformat()


def merge_site_baseline_plan(evidence: dict[str, Any], plan: dict[str, Any]) -> None:
    if plan.get("schema") != "zentropy-market-baseline-plan/v1":
        raise ValueError("unsupported market baseline plan schema")
    planned: list[dict[str, Any]] = []
    for target in plan.get("targets", []):
        if target.get("status") != "NOT_MEASURED":
            raise ValueError("market baseline plan targets must remain NOT_MEASURED")
        planned.append(
            {
                "targetId": target["id"],
                "toolName": target["name"],
                "modelName": "captured at execution",
                "status": "NOT_MEASURED",
                "reason": target["reason"],
                "officialUrl": target["officialUrl"],
                "sourceUrl": target.get("sourceUrl"),
                "version": target["version"],
                "configuration": target["configuration"],
                "environment": target["environment"],
            }
        )
    evidence["contractTargets"] = evidence.get("baselineTargets", [])
    evidence["baselineTargets"] = sorted(planned, key=lambda target: target["toolName"])
    evidence["baselinePlan"] = {
        "schema": plan["schema"],
        "status": plan["status"],
        "lastVerified": plan["lastVerified"],
        "executionRequirements": plan["executionRequirements"],
    }


def artifact_sha256(blob: bytes) -> str:
    return hashlib.sha256(blob).hexdigest()


def capture_exploratory_matrix(path: Path) -> dict[str, Any]:
    blob = path.read_bytes()
    payload = json.loads(blob.decode("utf-8-sig"))
    if payload.get("schema") != "m7-source-mined-scorecard/v1":
        raise ValueError("unsupported exploratory matrix schema")
    case_ids = payload.get("case_ids")
    rows = payload.get("rows")
    if not isinstance(case_ids, list) or not case_ids or len(set(case_ids)) != len(case_ids):
        raise ValueError("exploratory matrix needs a non-empty unique case set")
    if not isinstance(rows, list):
        raise ValueError("exploratory matrix rows are missing")
    measured_rows = []
    unavailable_rows = []
    labels = {"serve": "Flywheel serve", "ollama": "Ollama", "codex": "OpenAI Codex", "claude": "Claude Code", "opencode": "OpenCode"}
    for row in rows:
        provider = row.get("provider")
        if provider not in labels:
            continue
        if row.get("skipped") or not row.get("operational"):
            unavailable_rows.append(
                {
                    "providerId": provider,
                    "label": labels[provider],
                    "status": "SKIPPED" if row.get("skipped") else "NOT OPERATIONAL",
                    "reason": row.get("skip_reason") or (
                        "quota_or_rate_limit; requested-model metadata is not treated as valid"
                        if provider == "claude" else "not operational"
                    ),
                }
            )
            continue
        if provider == "serve" or provider == "ollama" or provider == "codex":
            aggregate = row.get("aggregate_metrics") or {}
            required = ("case_count", "passed_cases", "pass_rate", "mean_latency_ms")
            if not all(isinstance(row.get(key), (int, float)) and not isinstance(row.get(key), bool) for key in required):
                raise ValueError(f"missing numeric exploratory metrics for {provider}")
            if int(row["case_count"]) != len(case_ids):
                raise ValueError(f"case denominator mismatch for {provider}")
            if not isinstance(aggregate.get("mean_quality_score"), (int, float)):
                raise ValueError(f"quality metric missing for {provider}")
            measured_rows.append(
                {
                    "providerId": provider,
                    "label": labels[provider],
                    "backend": str(row.get("backend_name") or "not recorded"),
                    "model": str(row.get("requested_model") or "not recorded"),
                    "passed": int(row["passed_cases"]),
                    "denominator": int(row["case_count"]),
                    "passRate": float(row["pass_rate"]),
                    "meanQuality": float(aggregate["mean_quality_score"]),
                    "meanLatencyMs": float(row["mean_latency_ms"]),
                    "errorRate": float(aggregate.get("error_rate", 0.0)),
                    "failureClasses": aggregate.get("failure_class_counts") or {},
                }
            )
    if {row["providerId"] for row in measured_rows} != {"serve", "ollama", "codex"}:
        raise ValueError("exploratory matrix lacks the reviewed operational rows")
    return {
        "schema": payload["schema"],
        "status": "EXPLORATORY_MEASURED",
        "capturedAt": payload.get("timestamp_utc") or "unknown",
        "sourceSha256": artifact_sha256(blob),
        "sourceAvailability": "operator-local artifact; content hash published; no public raw-artifact link",
        "taskSetId": "m7-source-mined-adversarial-pressure-v1",
        "denominator": len(case_ids),
        "caseIds": case_ids,
        "measuredRows": measured_rows,
        "unavailableRows": unavailable_rows,
        "environment": "not recorded in source artifact",
        "method": "Same seven cases and scoring fields; different harness stacks and different requested models.",
        "limitations": [
            "Exploratory single-run matrix with seven custom cases.",
            "The compared rows use different models and stack configurations; this is not a same-model harness attribution test.",
            "Hardware, runtime versions, cost, and resource use are not recorded in the source artifact.",
            "Claude was nonoperational and OpenCode was skipped, so neither is plotted or scored as zero.",
        ],
        "doesNotProve": "This matrix does not prove general model or harness quality, market leadership, causal Flywheel advantage, production reliability, or independent validation.",
    }


def capture_he_base_comparison(path: Path) -> dict[str, Any]:
    blob = path.read_bytes()
    payload = json.loads(blob.decode("utf-8-sig"))
    if payload.get("schema") != "flywheel.he-base-comparison/v1":
        raise ValueError("unsupported model comparison schema")
    base = payload.get("base") or {}
    flywheel = payload.get("flywheel") or {}
    if base.get("n") != flywheel.get("n") or not isinstance(base.get("n"), int) or base["n"] <= 0:
        raise ValueError("model comparison denominator mismatch")
    n = base["n"]
    paired = payload.get("paired") or {}
    paired_total = sum(int(paired.get(key, -n)) for key in (
        "regressions_flywheel_fail_base_pass", "gains_flywheel_pass_base_fail", "both_pass", "both_fail"
    ))
    if paired_total != n:
        raise ValueError("paired outcome counts do not sum to denominator")
    mcnemar = payload.get("mcnemar") or {}
    return {
        "schema": payload["schema"],
        "status": "MEASURED",
        "sourceSha256": artifact_sha256(blob),
        "sourceAvailability": "tracked Flywheel release artifact; public commit link supplied when the checkout is registry-resolved",
        "benchmark": str(payload.get("benchmark") or "not recorded"),
        "denominator": n,
        "executionPolicy": "same harness; pass@1; greedy; temperature 0",
        "models": [
            {"role": "Base Qwen 14B", "modelRef": str(base.get("model_ref")), "passed": int(base.get("passed")), "passAt1": float(base.get("pass_at_1"))},
            {"role": "Flywheel 14B", "modelRef": str(flywheel.get("model_ref")), "passed": int(flywheel.get("passed")), "passAt1": float(flywheel.get("pass_at_1"))},
        ],
        "deltaPercentagePoints": float(payload.get("delta_points")) * 100,
        "paired": paired,
        "mcnemar": {
            "chiSquareContinuityCorrected": float(mcnemar.get("chi2_cc")),
            "pValue": float(mcnemar.get("p_value")),
            "significantAt005": bool(mcnemar.get("significant_0.05")),
        },
        "limitations": [
            "The base artifact digest is not pinned in this result file.",
            "The result covers one 164-task code-completion suite and does not measure agentic tool use.",
            "Hardware, runtime version, latency, cost, and resource use are not recorded in this result file.",
        ],
        "doesNotProve": "This result does not show a statistically significant improvement, general coding superiority, agentic reliability, production readiness, or independent validation.",
    }


def attach_public_artifact_provenance(
    result: dict[str, Any],
    artifact: Path,
    public_projects: list[tuple[dict[str, Any], str]],
    checkouts: dict[str, Path],
) -> None:
    artifact_resolved = artifact.resolve()
    for project, repository_url in public_projects:
        checkout = checkouts.get(repository_key(repository_url))
        if checkout is None:
            continue
        try:
            relative = artifact_resolved.relative_to(checkout.resolve()).as_posix()
            commit = str(git(checkout, "rev-parse", "HEAD")).strip()
            tracked = str(git(checkout, "ls-files", "--error-unmatch", relative)).strip()
            subprocess.run(
                ["git", "-C", str(checkout), "diff", "--quiet", "--", relative],
                check=True,
                capture_output=True,
            )
            head_blob = git(checkout, "cat-file", "blob", f"HEAD:{relative}", text=False)
            assert isinstance(head_blob, bytes)
        except (ValueError, OSError, subprocess.CalledProcessError):
            continue
        if tracked != relative:
            continue
        encoded_path = "/".join(part for part in relative.split("/"))
        result.update(
            {
                "sourceAvailability": "public tracked artifact at the captured commit",
                "sourceProjectId": project["id"],
                "sourceRepositoryUrl": repository_url,
                "sourceCommit": commit,
                "sourceTrackedPath": relative,
                "sourcePublicUrl": f"{repository_url}/blob/{commit}/{encoded_path}",
                "sourceTrackedBlobSha256": artifact_sha256(head_blob),
            }
        )
        return


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--workspace-root", required=True, type=Path)
    parser.add_argument("--registry", type=Path, default=SITE_ROOT / "system" / "systems.json")
    parser.add_argument("--output", type=Path, default=SITE_ROOT / "analytics" / "portfolio-analytics.json")
    parser.add_argument("--baseline-plan", type=Path, default=SITE_ROOT / "analytics" / "market-baseline-plan.json")
    parser.add_argument("--exploratory-matrix", type=Path)
    parser.add_argument("--he-base-comparison", type=Path)
    parser.add_argument("--as-of-date", default=default_capture_date())
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    captured_at = date.fromisoformat(args.as_of_date).isoformat()
    registry = json.loads(args.registry.read_text(encoding="utf-8"))
    public_projects: list[tuple[dict[str, Any], str]] = []
    for project in registry.get("systems", []):
        repository_url = public_github_url(project.get("sourceHref"))
        if repository_url:
            public_projects.append((project, repository_url))
    public_projects.sort(key=lambda item: item[0]["id"])

    allowed = {repository_key(url) for _, url in public_projects}
    checkouts = discover_public_checkouts(args.workspace_root.resolve(), allowed)
    projects = []
    for project, repository_url in public_projects:
        checkout = checkouts.get(repository_key(repository_url))
        projects.append(
            measure_repository(project, repository_url, checkout)
            if checkout
            else unknown_project(project, repository_url, "local_checkout_not_found")
        )

    benchmark_evidence = capture_benchmark_evidence(public_projects, checkouts)
    if args.baseline_plan.is_file():
        merge_site_baseline_plan(
            benchmark_evidence,
            json.loads(args.baseline_plan.read_text(encoding="utf-8")),
        )
    actual_comparisons: dict[str, Any] = {}
    if args.exploratory_matrix:
        actual_comparisons["exploratoryStackMatrix"] = capture_exploratory_matrix(args.exploratory_matrix)
    if args.he_base_comparison:
        model_comparison = capture_he_base_comparison(args.he_base_comparison)
        attach_public_artifact_provenance(model_comparison, args.he_base_comparison, public_projects, checkouts)
        actual_comparisons["modelComparison"] = model_comparison
    benchmark_evidence["actualComparisons"] = actual_comparisons

    payload = {
        "schema": SCHEMA,
        "capturedAt": captured_at,
        "selection": {
            "unit": "public registry-listed GitHub repositories",
            "denominator": len(public_projects),
            "measured": sum(project["commit"]["status"] == "measured" for project in projects),
            "unknown": sum(project["commit"]["status"] == "unknown" for project in projects),
        },
        "method": {
            "projectSelection": "systems.json records whose sourceHref normalizes to a public GitHub repository URL; no unlisted repository is inspected",
            "snapshot": "git HEAD blobs only",
            "lineCount": "physical lines including comments and blank lines",
            "sourceTestSplit": "tracked code files are tests when their path or filename follows an enumerated test/spec convention; other tracked code files are source",
            "testCollection": "static source recognition for supported languages; repository code, build scripts, test hooks, and plugins are not executed",
            "benchmarkSelection": "tracked JSON only; figures require cross-harness scorecard v1, identical task and prompt sets, identical metric schema and execution policy, completed rows, and at least two harness/model identities",
            "excludedPathSegments": sorted(EXCLUDED_PATH_SEGMENTS),
        },
        "uncertainty": "The offline capture trusts the reviewed public registry as its publication allow-list and does not revalidate current GitHub visibility. Unsupported or unavailable measurements remain unknown.",
        "doesNotProve": "File, line, language, and static test-definition counts do not establish software quality, runtime test success, coverage, security, adoption, maintenance activity, or completeness.",
        "benchmarkDoesNotProve": "A same-task-set comparison does not establish general model quality, production reliability, causal harness advantage, security, adoption, or independent validation. Results remain scoped to the recorded tasks, prompts, policy, models, harnesses, commit, and metric schema.",
        "projects": projects,
        "benchmarkEvidence": benchmark_evidence,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(
        f"captured {payload['selection']['measured']} measured and "
        f"{payload['selection']['unknown']} unknown public registry projects"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
