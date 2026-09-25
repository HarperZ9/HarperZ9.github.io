"""Guards on the checker's --accept-from-report path.

The path accepts a baseline from a committed checker report without fetching
again. A fetch-error report must never become reviewed state, and a file that
is not a checker report must be refused on one line. In every refusal the
state file stays byte-identical.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

from test_frontier_safety_source_checker import (
    load_checker,
    registry_payload,
    state_payload,
    valid_state_source,
    write_json,
)

REFUSAL = "--accept-from-report needs an error-free checker report"
GOOD_SHA = "b" * 64


def checker_report(error_source_ids: list[str]) -> dict:
    """A report where `good` is a new source and `x` failed to fetch."""
    return {
        "schema_version": 1,
        "observed_at": "2026-09-24T15:30:00Z",
        "sources": [
            {"id": "good", "url": "https://example.test/good", "status": "unbaselined", "sha256": GOOD_SHA,
             "changed": False, "review_required": True},
            {"id": "x", "url": "https://example.test/x", "status": "fetch_error", "changed": False,
             "error": "URLError: unavailable"},
        ],
        "changed_source_ids": [],
        "error_source_ids": error_source_ids,
        "unbaselined_source_ids": ["good"],
        "review_required_source_ids": ["good"],
    }


def prepare(tmp_path: Path, monkeypatch, report) -> Path:
    """Write a registry, a prior state and `report`, and point the CLI at them. Return the state path."""
    registry_path, state_path, report_path = (tmp_path / name for name in ("registry.json", "state.json", "report.json"))
    write_json(registry_path, registry_payload([]))
    write_json(state_path, state_payload([valid_state_source("retained")]))
    report_path.write_text(json.dumps(report), encoding="utf-8")
    monkeypatch.setattr(sys, "argv", [
        "check_frontier_safety_sources.py", "--registry", str(registry_path), "--state", str(state_path),
        "--accept-from-report", str(report_path), "--accept-reviewed", "good"])
    return state_path


def assert_refused(tmp_path: Path, monkeypatch, capsys, report) -> None:
    state_path = prepare(tmp_path, monkeypatch, report)
    before = state_path.read_bytes()
    with pytest.raises(SystemExit) as exited:
        load_checker().main()
    assert exited.value.code == 2
    assert REFUSAL in capsys.readouterr().err
    assert state_path.read_bytes() == before


def test_accept_from_report_refuses_a_report_with_fetch_errors(tmp_path: Path, monkeypatch, capsys) -> None:
    assert_refused(tmp_path, monkeypatch, capsys, checker_report(["x"]))


@pytest.mark.parametrize(
    "report",
    [
        pytest.param(checker_report([])["sources"], id="json-list"),
        pytest.param({k: v for k, v in checker_report([]).items() if k != "sources"}, id="no-sources-key"),
        pytest.param({**checker_report([]), "sources": {"good": {"sha256": GOOD_SHA}}}, id="sources-not-a-list"),
    ],
)
def test_accept_from_report_refuses_a_file_that_is_not_a_checker_report(
    tmp_path: Path, monkeypatch, capsys, report
) -> None:
    assert_refused(tmp_path, monkeypatch, capsys, report)


@pytest.mark.parametrize("dropped", ["--accept-reviewed", "--state"])
def test_accept_from_report_refuses_to_run_without_a_source_to_accept_or_a_state(
    tmp_path: Path, monkeypatch, capsys, dropped: str
) -> None:
    """Without both flags the path would load the report and exit 0 having accepted nothing."""
    state_path = prepare(tmp_path, monkeypatch, checker_report([]))
    argv = sys.argv[:]
    index = argv.index(dropped)
    monkeypatch.setattr(sys, "argv", argv[:index] + argv[index + 2:])
    before = state_path.read_bytes()
    with pytest.raises(SystemExit) as exited:
        load_checker().main()
    assert exited.value.code == 2
    assert "--accept-from-report requires --accept-reviewed and --state" in capsys.readouterr().err
    assert state_path.read_bytes() == before


@pytest.mark.parametrize("args,message", [
    ([], "--report is required unless --accept-from-report is used"),
    (["--report", "REPORT", "--accept-reviewed", "good"], "--accept-reviewed requires --state"),
])
def test_fetch_path_refuses_incomplete_arguments(tmp_path: Path, monkeypatch, capsys, args, message) -> None:
    """The fetch path needs somewhere to write its report, and acceptance needs a state file."""
    registry_path = tmp_path / "registry.json"
    write_json(registry_path, registry_payload([]))
    argv = [str(tmp_path / "report.json") if a == "REPORT" else a for a in args]
    monkeypatch.setattr(sys, "argv", ["check_frontier_safety_sources.py", "--registry", str(registry_path), *argv])
    with pytest.raises(SystemExit) as exited:
        load_checker().main()
    assert exited.value.code == 2
    assert message in capsys.readouterr().err


def test_the_same_report_without_fetch_errors_is_accepted(tmp_path: Path, monkeypatch) -> None:
    """Control: the refusals above come from the guard, not from a fixture the merge would reject anyway."""
    state_path = prepare(tmp_path, monkeypatch, checker_report([]))
    assert load_checker().main() == 0
    saved = json.loads(state_path.read_text(encoding="utf-8"))
    by_id = {item["id"]: item for item in saved["sources"]}
    assert set(by_id) == {"retained", "good"}
    assert by_id["good"]["sha256"] == GOOD_SHA and by_id["good"]["status"] == "available"
    assert saved["error_source_ids"] == []
