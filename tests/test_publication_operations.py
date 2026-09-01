"""Public contracts for guarded publication operations."""

from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_general_publication_operations_define_one_canonical_repository() -> None:
    operations = (ROOT / "docs" / "publications-operations.md").read_text(
        encoding="utf-8"
    )

    for phrase in (
        "HarperZ9/HarperZ9.github.io",
        "HarperZ9/HarperZ9",
        "HarperZ9/telos-v2",
        "private publication inventory",
        "idempotency key",
        "current main",
        "independent review",
        "live SHA-256",
        "No-change runs remain silent",
    ):
        assert phrase in operations


def test_frontier_operations_define_guarded_per_refresh_authority() -> None:
    operations = (ROOT / "docs" / "frontier-safety-operations.md").read_text(
        encoding="utf-8"
    )

    assert "Frontier Safety automation exclusively owns" in operations
    assert "general editorial automation must not publish or amend" in operations
    assert "one edition or amendment per calendar day" in operations
    assert "without another action-time approval" in operations
    assert "Social posting remains outside" in operations
