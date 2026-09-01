"""Contracts for the private scheduled-publication inventory."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from tools.build_publication_inventory import build_inventory


def make_fixture_files(root: Path, names: list[str]) -> None:
    root.mkdir(parents=True)
    for index, name in enumerate(names):
        path = root / name
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(f"fixture-{index}\n", encoding="utf-8")


def test_inventory_accounts_for_every_input_file(tmp_path: Path) -> None:
    first = tmp_path / "first"
    second = tmp_path / "second"
    make_fixture_files(first, ["packet.md", "receipts/receipt.md", "source.json"])
    make_fixture_files(second, ["automation.toml", "memory.md"])
    output = tmp_path / "private" / "publication-inventory.json"

    result = build_inventory(
        {"editorial": first, "frontier": second}, output, public_roots=[]
    )

    assert result["summary"]["file_count"] == 5
    assert {
        (item["automation_id"], item["relative_path"])
        for item in result["artifacts"]
    } == {
        ("editorial", "packet.md"),
        ("editorial", "receipts/receipt.md"),
        ("editorial", "source.json"),
        ("frontier", "automation.toml"),
        ("frontier", "memory.md"),
    }
    assert output.exists()


def test_inventory_refuses_public_output(tmp_path: Path) -> None:
    public = tmp_path / "public-site"
    public.mkdir()
    input_root = tmp_path / "input"
    input_root.mkdir()

    with pytest.raises(ValueError, match="outside public repositories"):
        build_inventory(
            {"editorial": input_root}, public / "inventory.json", [public]
        )


def test_inventory_is_metadata_only_and_deterministic(tmp_path: Path) -> None:
    research = tmp_path / "research"
    make_fixture_files(
        research,
        [
            "automation.toml",
            "memory.md",
            "verification-receipt-2026-09-01.md",
            "packet-2026-09-01-reviewed.md",
            "research-notes.md",
            "mirror/site.html",
            "unknown.bin",
        ],
    )
    output = tmp_path / "private" / "publication-inventory.json"

    first = build_inventory({"editorial": research}, output, public_roots=[])
    first_bytes = output.read_bytes()
    second = build_inventory({"editorial": research}, output, public_roots=[])

    assert first == second
    assert first_bytes == output.read_bytes()
    serialized = json.dumps(first, sort_keys=True)
    assert str(research) not in serialized
    assert "fixture-" not in serialized
    assert set(first["artifacts"][0]) == {
        "automation_id",
        "relative_path",
        "sha256",
        "bytes",
        "last_write_time",
        "suffix",
        "classification",
        "editorial_state",
        "public_readiness",
        "hold_reason",
    }
    classifications = {
        item["relative_path"]: item["classification"] for item in first["artifacts"]
    }
    assert classifications["automation.toml"] == "private-control"
    assert classifications["memory.md"] == "private-control"
    assert classifications["verification-receipt-2026-09-01.md"] == "private-evidence"
    assert classifications["packet-2026-09-01-reviewed.md"] == "candidate"
    assert classifications["research-notes.md"] == "review-required"
    assert classifications["mirror/site.html"] == "duplicate-reference"
    assert classifications["unknown.bin"] == "private-hold"
