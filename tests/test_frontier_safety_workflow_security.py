"""Executable security contracts for the Frontier Safety publication workflow."""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest
import yaml


ROOT = Path(__file__).resolve().parents[1]
WORKFLOW_PATH = ROOT / ".github" / "workflows" / "frontier-safety-daily.yml"
CI_WORKFLOW_PATH = ROOT / ".github" / "workflows" / "ci.yml"


def load_workflow() -> dict:
    return yaml.load(WORKFLOW_PATH.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)


def named_step(job: dict, name: str) -> dict:
    return next(step for step in job["steps"] if step.get("name") == name)


def extract_python_heredoc(run_script: str) -> str:
    lines = run_script.splitlines()
    start = lines.index("python - <<'PY'") + 1
    end = lines.index("PY", start)
    return textwrap.dedent("\n".join(lines[start:end]))


def write_gate_edition(workspace: Path, *, state: str, corrections: list[str]) -> Path:
    edition = workspace / "frontier-safety" / "data" / "editions" / "test.json"
    edition.parent.mkdir(parents=True)
    edition.write_text(
        json.dumps({"edition_state": state, "corrections": corrections}) + "\n",
        encoding="utf-8",
    )
    return edition


def run_monitor_result_step(tmp_path: Path, report: dict) -> dict[str, str]:
    monitor = load_workflow()["jobs"]["monitor"]
    script = extract_python_heredoc(named_step(monitor, "Read source-check result")["run"])
    runner_temp = tmp_path / "runner-temp"
    runner_temp.mkdir()
    (runner_temp / "frontier-safety-source-check.json").write_text(
        json.dumps(report) + "\n", encoding="utf-8"
    )
    output_path = tmp_path / "github-output.txt"
    result = subprocess.run(
        [sys.executable, "-c", script],
        env={**os.environ, "RUNNER_TEMP": str(runner_temp), "GITHUB_OUTPUT": str(output_path)},
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, (result.stdout, result.stderr)
    return dict(line.split("=", 1) for line in output_path.read_text(encoding="utf-8").splitlines())


def review_packet_condition_matches(outputs: dict[str, int]) -> bool:
    monitor = load_workflow()["jobs"]["monitor"]
    condition = named_step(monitor, "Preserve a source-review packet")["if"]
    clauses = [clause.strip() for clause in condition.split("||")]
    parsed = []
    for clause in clauses:
        match = re.fullmatch(r"steps\.source_check\.outputs\.([a-z_]+) != '([0-9]+)'", clause)
        assert match, clause
        parsed.append((match.group(1), match.group(2)))
    return any(str(outputs.get(name, 0)) != expected for name, expected in parsed)


def run_publication_gate(
    tmp_path: Path,
    *,
    mode: str,
    changed: int,
    errors: int,
    unbaselined: int = 0,
    review_required: int | None = None,
    reason: str = "",
    edition_state: str = "changed",
    corrections: list[str] | None = None,
) -> subprocess.CompletedProcess[str]:
    workflow = load_workflow()
    gate = named_step(workflow["jobs"]["publish"], "Enforce publication gate")
    script = extract_python_heredoc(gate["run"])
    write_gate_edition(tmp_path, state=edition_state, corrections=corrections or [])
    runner_temp = tmp_path / "runner-temp"
    runner_temp.mkdir()
    env = {
        **os.environ,
        "GITHUB_WORKSPACE": str(tmp_path),
        "RUNNER_TEMP": str(runner_temp),
        "EDITION_INPUT": "frontier-safety/data/editions/test.json",
        "SOURCE_CHANGED": str(changed),
        "SOURCE_ERRORS": str(errors),
        "SOURCE_UNBASELINED": str(unbaselined),
        "SOURCE_REVIEW_REQUIRED": str(
            changed + unbaselined if review_required is None else review_required
        ),
        "PUBLICATION_MODE": mode,
        "CORRECTION_REASON": reason,
    }
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_monitoring_and_publication_have_separate_minimal_permissions() -> None:
    workflow = load_workflow()
    jobs = workflow["jobs"]

    assert workflow["permissions"] == {"contents": "read"}
    assert jobs["monitor"]["permissions"] == {"contents": "read"}
    assert jobs["publish"]["permissions"] == {"contents": "write"}
    assert jobs["publish"]["needs"] == "monitor"
    assert "workflow_dispatch" in jobs["publish"]["if"]


def test_monitor_exports_every_review_decision_count(tmp_path: Path) -> None:
    report = {
        "changed_source_ids": ["changed"],
        "error_source_ids": ["error"],
        "unbaselined_source_ids": ["new"],
        "review_required_source_ids": ["changed", "new"],
    }

    outputs = run_monitor_result_step(tmp_path, report)
    declared = load_workflow()["jobs"]["monitor"]["outputs"]

    assert outputs == {
        "changed": "1",
        "errors": "1",
        "unbaselined": "1",
        "review_required": "2",
    }
    assert set(declared) == {"changed", "errors", "unbaselined", "review_required"}


@pytest.mark.parametrize("signal", ["changed", "errors", "unbaselined", "review_required"])
def test_monitor_preserves_review_packet_for_every_review_signal(signal: str) -> None:
    outputs = {"changed": 0, "errors": 0, "unbaselined": 0, "review_required": 0}
    outputs[signal] = 1

    assert review_packet_condition_matches(outputs)


def test_monitor_does_not_preserve_packet_when_no_review_signal_exists() -> None:
    assert not review_packet_condition_matches(
        {"changed": 0, "errors": 0, "unbaselined": 0, "review_required": 0}
    )


def test_actions_are_immutable_and_checkout_never_persists_credentials() -> None:
    workflow = load_workflow()
    action_steps = [
        step
        for job in workflow["jobs"].values()
        for step in job["steps"]
        if "uses" in step
    ]

    assert action_steps
    for step in action_steps:
        assert re.fullmatch(r"actions/[a-z-]+@[0-9a-f]{40}", step["uses"]), step["uses"]
        if step["uses"].startswith("actions/checkout@"):
            assert step.get("with", {}).get("persist-credentials") == "false"

    install = named_step(workflow["jobs"]["publish"], "Install pinned test dependencies")
    assert "pytest==" in install["run"]
    assert not re.search(r"\bpytest(?:\s|$)", install["run"].replace("pytest==", ""))


def test_primary_ci_installs_the_workflow_test_parser_at_a_pinned_version() -> None:
    workflow = yaml.load(CI_WORKFLOW_PATH.read_text(encoding="utf-8"), Loader=yaml.BaseLoader)
    install = named_step(workflow["jobs"]["static-site"], "Install test dependencies")

    assert "pytest==8.4.2" in install["run"]
    assert "PyYAML==6.0.2" in install["run"]


def test_publication_scans_input_and_staged_outputs_before_commit() -> None:
    publish = load_workflow()["jobs"]["publish"]
    names = [step.get("name") for step in publish["steps"]]

    assert names.index("Scan reviewed publication input") < names.index("Render reviewed edition")
    assert names.index("Stage generated public artifacts") < names.index("Scan staged public artifacts")
    assert names.index("Scan staged public artifacts") < names.index("Commit reviewed edition")
    input_scan = named_step(publish, "Scan reviewed publication input")["run"]
    staged_scan = named_step(publish, "Scan staged public artifacts")["run"]
    assert "check_frontier_safety_public_artifacts.py" in input_scan
    assert "EDITION_INPUT" in input_scan and "CORRECTION_REASON_FILE" in input_scan
    assert "git diff --cached --name-only" in staged_scan
    assert "check_frontier_safety_public_artifacts.py" in staged_scan


@pytest.mark.parametrize(
    ("changed", "errors"),
    [(0, 0), (1, 1), (2, 3)],
)
def test_normal_publication_requires_changes_and_zero_fetch_errors(
    tmp_path: Path, changed: int, errors: int
) -> None:
    result = run_publication_gate(tmp_path, mode="normal", changed=changed, errors=errors)

    assert result.returncode != 0, (result.stdout, result.stderr)


def test_normal_publication_gate_accepts_changed_error_free_source_check(tmp_path: Path) -> None:
    result = run_publication_gate(tmp_path, mode="normal", changed=1, errors=0)

    assert result.returncode == 0, (result.stdout, result.stderr)
    message = (tmp_path / "runner-temp" / "frontier-safety-commit-message.txt").read_text(
        encoding="utf-8"
    )
    assert message == "research: publish reviewed frontier safety edition\n"


def test_normal_publication_rejects_changed_run_with_unbaselined_source(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path,
        mode="normal",
        changed=1,
        errors=0,
        unbaselined=1,
        review_required=2,
    )

    assert result.returncode != 0, (result.stdout, result.stderr)


def test_normal_publication_rejects_unaccounted_review_required_source(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path,
        mode="normal",
        changed=1,
        errors=0,
        unbaselined=0,
        review_required=2,
    )

    assert result.returncode != 0, (result.stdout, result.stderr)


def test_correction_edition_cannot_bypass_explicit_correction_mode(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path,
        mode="normal",
        changed=1,
        errors=0,
        edition_state="correction",
        corrections=["Recorded correction."],
    )

    assert result.returncode != 0, (result.stdout, result.stderr)


def test_correction_mode_requires_public_correction_and_records_reason(tmp_path: Path) -> None:
    reason = "Correct the previously reported event time after first-party clarification."
    result = run_publication_gate(
        tmp_path,
        mode="correction",
        changed=0,
        errors=2,
        reason=reason,
        edition_state="correction",
        corrections=["The prior event time was replaced with the clarified timestamp."],
    )

    assert result.returncode == 0, (result.stdout, result.stderr)
    runner_temp = tmp_path / "runner-temp"
    assert (runner_temp / "frontier-safety-correction-reason.txt").read_text(
        encoding="utf-8"
    ) == f"{reason}\n"
    assert reason in (runner_temp / "frontier-safety-commit-message.txt").read_text(encoding="utf-8")


@pytest.mark.parametrize(
    ("reason", "state", "corrections"),
    [
        ("", "correction", ["Recorded correction."]),
        ("Required reason", "changed", ["Recorded correction."]),
        ("Required reason", "correction", []),
    ],
)
def test_correction_mode_rejects_incomplete_correction_record(
    tmp_path: Path, reason: str, state: str, corrections: list[str]
) -> None:
    result = run_publication_gate(
        tmp_path,
        mode="correction",
        changed=0,
        errors=0,
        reason=reason,
        edition_state=state,
        corrections=corrections,
    )

    assert result.returncode != 0, (result.stdout, result.stderr)


def test_write_token_is_exposed_only_to_the_final_push_step() -> None:
    publish = load_workflow()["jobs"]["publish"]
    push = named_step(publish, "Push reviewed edition")

    assert push["env"] == {"GITHUB_TOKEN": "${{ github.token }}"}
    assert "credential.helper" in push["run"]
    for step in publish["steps"]:
        if step is push:
            continue
        assert "GITHUB_TOKEN" not in step.get("env", {})
        assert "github.token" not in step.get("run", "")
