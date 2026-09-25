"""Wiring contracts between the monitor job's outputs and the publication gate.

The gate-script tests build the gate's environment in the test harness, so they
pass even when the workflow stops passing a monitor output to the gate. These
tests read the wiring from the workflow itself. Deleting or misspelling any
gate env entry that carries a monitor output must turn one of them red.
"""

from __future__ import annotations

import json
import os
import re
import subprocess
import sys
from pathlib import Path

from test_frontier_safety_workflow_security import (
    extract_python_heredoc,
    load_workflow,
    named_step,
    run_monitor_result_step,
    write_gate_edition,
)

NEW = "b" * 64
OTHER = "c" * 64
EXPRESSION = re.compile(r"\$\{\{\s*([A-Za-z0-9_.-]+)\s*\}\}")
MONITOR_OUTPUT = re.compile(r"needs\.monitor\.outputs\.([A-Za-z0-9_-]+)")
ENV_READ = re.compile(r"os\.environ(?:\.get\(|\[)\"([A-Z_]+)\"")
RUNNER_SET = {"GITHUB_WORKSPACE", "RUNNER_TEMP"}


def gate_step() -> dict:
    return named_step(load_workflow()["jobs"]["publish"], "Enforce publication gate")


def resolve(value: str, context: dict[str, str]) -> str:
    """Substitute expressions the way GitHub Actions does: an unknown name is empty."""
    return EXPRESSION.sub(lambda match: context.get(match.group(1), ""), value)


def test_gate_env_reads_each_monitor_decision_from_its_matching_output() -> None:
    carried = {
        key: value for key, value in gate_step()["env"].items() if "needs.monitor" in value
    }

    assert carried == {
        "SOURCE_CHANGED": "${{ needs.monitor.outputs.changed }}",
        "SOURCE_ERRORS": "${{ needs.monitor.outputs.errors }}",
        "SOURCE_UNBASELINED": "${{ needs.monitor.outputs.unbaselined }}",
        "SOURCE_REVIEW_REQUIRED": "${{ needs.monitor.outputs.review_required }}",
        "SOURCE_UNBASELINED_FINGERPRINTS": "${{ needs.monitor.outputs.unbaselined_fingerprints }}",
    }


def test_every_monitor_output_the_publish_job_references_is_declared() -> None:
    workflow = load_workflow()
    declared = set(workflow["jobs"]["monitor"]["outputs"])
    referenced = set(MONITOR_OUTPUT.findall(json.dumps(workflow["jobs"]["publish"])))

    assert referenced
    assert referenced <= declared, sorted(referenced - declared)


def test_gate_script_reads_only_env_the_step_declares_or_the_runner_sets() -> None:
    step = gate_step()
    reads = set(ENV_READ.findall(extract_python_heredoc(step["run"])))

    assert "SOURCE_UNBASELINED_FINGERPRINTS" in reads
    assert reads <= set(step["env"]) | RUNNER_SET, sorted(reads - set(step["env"]) - RUNNER_SET)


def run_gate_through_declared_wiring(
    tmp_path: Path, *, observed: str, receipted: str
) -> subprocess.CompletedProcess[str]:
    """Carry a monitor result to the gate using only the keys the workflow declares."""
    workflow = load_workflow()
    report = {
        "sources": [{"id": "new-source", "status": "unbaselined", "sha256": observed}],
        "changed_source_ids": [],
        "error_source_ids": [],
        "unbaselined_source_ids": ["new-source"],
        "review_required_source_ids": ["new-source"],
    }
    step_outputs = run_monitor_result_step(tmp_path, report)
    context = {f"steps.source_check.outputs.{k}": v for k, v in step_outputs.items()}
    for name, expression in workflow["jobs"]["monitor"]["outputs"].items():
        context[f"needs.monitor.outputs.{name}"] = resolve(expression, context)
    context.update(
        {
            "inputs.edition": "frontier-safety/data/editions/test.json",
            "inputs.publication_mode": "normal",
            "inputs.correction_reason": "",
        }
    )
    write_gate_edition(tmp_path, state="changed", corrections=[], receipts={"new-source": receipted})
    step = gate_step()
    script = extract_python_heredoc(step["run"])
    inherited = {k: v for k, v in os.environ.items() if k not in set(ENV_READ.findall(script))}
    env = {
        **inherited,
        "GITHUB_WORKSPACE": str(tmp_path),
        "RUNNER_TEMP": str(tmp_path / "runner-temp"),
        **{key: resolve(value, context) for key, value in step["env"].items()},
    }
    return subprocess.run(
        [sys.executable, "-c", script],
        cwd=tmp_path,
        env=env,
        capture_output=True,
        text=True,
        check=False,
    )


def test_receipted_first_observation_passes_the_gate_through_the_declared_wiring(
    tmp_path: Path,
) -> None:
    result = run_gate_through_declared_wiring(tmp_path, observed=NEW, receipted=NEW)

    assert result.returncode == 0, (result.stdout, result.stderr)
    assert "Publication gate accepted normal mode" in result.stdout


def test_declared_wiring_carries_the_observed_fingerprint_not_an_empty_map(
    tmp_path: Path,
) -> None:
    result = run_gate_through_declared_wiring(tmp_path, observed=OTHER, receipted=NEW)

    assert result.returncode != 0
    assert "changed after its receipt was reviewed" in result.stderr
