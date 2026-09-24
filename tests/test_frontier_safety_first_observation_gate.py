"""Publication-gate contracts for first-observation receipts.

The gate admits an unbaselined source only when a receipt covers exactly that
source with the fingerprint this run observed. Each acceptance test has a
false-success control that must be rejected.
"""

from __future__ import annotations

from pathlib import Path

from test_frontier_safety_workflow_security import run_publication_gate

NEW = "b" * 64
OTHER = "c" * 64


def test_gate_accepts_a_receipted_first_observation_without_a_delta(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="normal", changed=0, errors=0, unbaselined=1,
        fingerprints={"new-source": NEW}, receipts={"new-source": NEW},
    )

    assert result.returncode == 0, (result.stdout, result.stderr)


def test_gate_rejects_an_unbaselined_source_without_a_receipt(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="normal", changed=1, errors=0, unbaselined=1,
        fingerprints={"new-source": NEW},
    )

    assert result.returncode != 0
    assert "first-observation receipt for exactly each unbaselined source" in result.stderr


def test_gate_rejects_a_page_that_changed_after_its_receipt(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="normal", changed=0, errors=0, unbaselined=1,
        fingerprints={"new-source": OTHER}, receipts={"new-source": NEW},
    )

    assert result.returncode != 0
    assert "changed after its receipt was reviewed" in result.stderr


def test_gate_rejects_a_receipt_for_a_source_this_run_did_not_observe_as_new(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="normal", changed=1, errors=0, unbaselined=0,
        receipts={"existing-source": NEW},
    )

    assert result.returncode != 0
    assert "first-observation receipt for exactly each unbaselined source" in result.stderr


def test_gate_rejects_counts_that_disagree_with_exported_fingerprints(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="normal", changed=0, errors=0, unbaselined=2,
        fingerprints={"new-source": NEW}, receipts={"new-source": NEW},
    )

    assert result.returncode != 0
    assert "exported fingerprints disagree" in result.stderr


def test_gate_still_rejects_fetch_errors_alongside_a_receipt(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="normal", changed=0, errors=1, unbaselined=1,
        fingerprints={"new-source": NEW}, receipts={"new-source": NEW},
    )

    assert result.returncode != 0
    assert "zero fetch errors" in result.stderr


def test_gate_rejects_an_unsupported_publication_mode(tmp_path: Path) -> None:
    result = run_publication_gate(tmp_path, mode="first-observation", changed=0, errors=0)

    assert result.returncode != 0
    assert "unsupported publication mode" in result.stderr


def test_correction_mode_cannot_carry_a_receipt(tmp_path: Path) -> None:
    result = run_publication_gate(
        tmp_path, mode="correction", changed=0, errors=0, reason="fix a date",
        edition_state="correction", corrections=["Corrected a date."],
        receipts={"new-source": NEW},
    )

    assert result.returncode != 0
    assert "correction mode cannot carry first-observation receipts" in result.stderr
