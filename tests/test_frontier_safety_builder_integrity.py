"""Transactional integrity contracts for the Frontier Safety builder."""

from __future__ import annotations

import importlib.util
import json
import os
from copy import deepcopy
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
EDITION_PATH = ROOT / "frontier-safety" / "data" / "editions" / "2026-08-24.json"
SOCIAL_PUBLICATION_NOT_POSTED = {
    "x": {"state": "not_posted", "post_url": None},
    "linkedin": {"state": "not_posted", "post_url": None},
}


def load_builder():
    path = ROOT / "tools" / "build_frontier_safety_briefing.py"
    spec = importlib.util.spec_from_file_location("frontier_safety_builder_integrity", path)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def read_edition() -> dict:
    edition = json.loads(EDITION_PATH.read_text(encoding="utf-8"))
    edition["social_publication"] = deepcopy(SOCIAL_PUBLICATION_NOT_POSTED)
    return edition


def write_edition(path: Path, edition: dict) -> Path:
    path.write_text(json.dumps(edition), encoding="utf-8")
    return path


def snapshot_tree(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in root.rglob("*")
        if path.is_file()
    }


def test_same_date_archive_collision_fails_without_mutating_publication(tmp_path: Path) -> None:
    builder = load_builder()
    original = read_edition()
    original_path = write_edition(tmp_path / "original.json", original)
    output_root = tmp_path / "public"
    output_root.mkdir()
    builder.build(original_path, output_root)
    before = snapshot_tree(output_root)

    conflicting = deepcopy(original)
    conflicting["change_summary"] = "A conflicting same-date edition."
    conflicting_path = write_edition(tmp_path / "conflicting.json", conflicting)

    with pytest.raises(builder.EditionError, match="new edition|correction identifier"):
        builder.build(conflicting_path, output_root)

    assert snapshot_tree(output_root) == before


def test_identical_rebuild_is_a_no_op(tmp_path: Path) -> None:
    builder = load_builder()
    edition_path = write_edition(tmp_path / "edition.json", read_edition())
    output_root = tmp_path / "public"
    output_root.mkdir()
    first = builder.build(edition_path, output_root)
    files = [path for path in output_root.rglob("*") if path.is_file()]
    old_timestamp_ns = 1_000_000_000_000_000_000
    for path in files:
        os.utime(path, ns=(old_timestamp_ns, old_timestamp_ns))
    before = snapshot_tree(output_root)
    before_mtimes = {path.relative_to(output_root): path.stat().st_mtime_ns for path in files}

    second = builder.build(edition_path, output_root)

    assert second == first
    assert snapshot_tree(output_root) == before
    assert {
        path.relative_to(output_root): path.stat().st_mtime_ns for path in files
    } == before_mtimes


@pytest.mark.parametrize(
    "relative_path",
    [
        "frontier-safety/data/archive/2026-08-24.json",
        "frontier-safety/archive/2026-08-24.html",
        "frontier-safety/social/2026-08-24-x.txt",
        "frontier-safety/social/2026-08-24-linkedin.txt",
    ],
    ids=["archive-json", "archive-html", "x-copy", "linkedin-copy"],
)
def test_identical_digest_rejects_any_dated_output_byte_mismatch(
    tmp_path: Path, relative_path: str
) -> None:
    builder = load_builder()
    edition_path = write_edition(tmp_path / "edition.json", read_edition())
    output_root = tmp_path / "public"
    output_root.mkdir()
    builder.build(edition_path, output_root)
    dated_path = output_root / relative_path
    dated_path.write_bytes(dated_path.read_bytes() + b"\ncorrupt")
    before = snapshot_tree(output_root)

    with pytest.raises(builder.EditionError, match="archive|dated"):
        builder.build(edition_path, output_root)

    assert snapshot_tree(output_root) == before


def test_identical_archive_reconciles_current_and_history_outputs(tmp_path: Path) -> None:
    builder = load_builder()
    edition_path = write_edition(tmp_path / "edition.json", read_edition())
    output_root = tmp_path / "public"
    output_root.mkdir()
    builder.build(edition_path, output_root)
    expected = snapshot_tree(output_root)

    (output_root / "frontier-safety.html").write_text("corrupt current page\n", encoding="utf-8")
    (output_root / "frontier-safety" / "data" / "current.json").write_text(
        "{}\n", encoding="utf-8"
    )
    history_path = output_root / "frontier-safety" / "data" / "history.json"
    history = json.loads(history_path.read_text(encoding="utf-8"))
    history["editions"][0]["html"] = "corrupt-history-link"
    history_path.write_text(json.dumps(history), encoding="utf-8")

    builder.build(edition_path, output_root)

    assert snapshot_tree(output_root) == expected


def _remove_edition_state(edition: dict) -> None:
    edition.pop("edition_state")


def _remove_controls(edition: dict) -> None:
    edition.pop("controls")


def _remove_open_questions(edition: dict) -> None:
    edition.pop("open_questions")


def _remove_control_sources(edition: dict) -> None:
    edition["controls"][0].pop("sources")


def _malform_corrections(edition: dict) -> None:
    edition["corrections"] = [{"not": "text"}]


def _malform_edition_state_type(edition: dict) -> None:
    edition["edition_state"] = []


def _make_social_publication_required(edition: dict) -> None:
    edition["edition_date"] = "2026-08-25"
    edition["observed_at"] = "2026-08-25T17:58:14Z"


def _remove_social_publication(edition: dict) -> None:
    _make_social_publication_required(edition)
    edition.pop("social_publication")


def _remove_social_publication_channel(edition: dict) -> None:
    _make_social_publication_required(edition)
    edition["social_publication"].pop("linkedin")


def _malform_not_posted_social_publication_url(edition: dict) -> None:
    _make_social_publication_required(edition)
    edition["social_publication"]["x"]["post_url"] = "https://x.com/zentropylabs/status/1"


def _malform_posted_social_publication_url(edition: dict) -> None:
    _make_social_publication_required(edition)
    edition["social_publication"]["linkedin"] = {
        "state": "posted",
        "post_url": "http://linkedin.com/feed/update/1",
    }


def _malform_social_publication_state(edition: dict) -> None:
    _make_social_publication_required(edition)
    edition["social_publication"]["x"]["state"] = "draft"


def _malform_lane_id_type(edition: dict) -> None:
    edition["lanes"][0]["id"] = []


def _malform_item_status_type(edition: dict) -> None:
    edition["lanes"][0]["items"][0]["status"] = []


@pytest.mark.parametrize(
    "malform",
    [
        _remove_edition_state,
        _remove_controls,
        _remove_open_questions,
        _remove_control_sources,
        _malform_corrections,
        _malform_edition_state_type,
        _remove_social_publication,
        _remove_social_publication_channel,
        _malform_not_posted_social_publication_url,
        _malform_posted_social_publication_url,
        _malform_social_publication_state,
        _malform_lane_id_type,
        _malform_item_status_type,
    ],
    ids=[
        "missing-edition-state",
        "missing-controls",
        "missing-open-questions",
        "missing-control-sources",
        "non-text-correction",
        "non-text-edition-state",
        "missing-social-publication",
        "missing-social-publication-channel",
        "not-posted-with-url",
        "posted-with-non-https-url",
        "unknown-social-publication-state",
        "non-text-lane-id",
        "non-text-item-status",
    ],
)
def test_malformed_renderer_schema_fails_before_writes(tmp_path: Path, malform) -> None:
    builder = load_builder()
    edition = read_edition()
    malform(edition)
    edition_path = write_edition(tmp_path / "malformed.json", edition)
    output_root = tmp_path / "public"
    output_root.mkdir()

    with pytest.raises(builder.EditionError):
        builder.build(edition_path, output_root)

    assert snapshot_tree(output_root) == {}


def test_posted_social_publication_requires_https_final_urls(tmp_path: Path) -> None:
    builder = load_builder()
    edition = read_edition()
    edition["social_publication"] = {
        "x": {
            "state": "posted",
            "post_url": "https://x.com/zentropylabs/status/1234567890",
        },
        "linkedin": {
            "state": "posted",
            "post_url": "https://www.linkedin.com/feed/update/urn:li:activity:1234567890/",
        },
    }
    edition_path = write_edition(tmp_path / "posted.json", edition)
    output_root = tmp_path / "public"
    output_root.mkdir()

    result = builder.build(edition_path, output_root)
    current = json.loads(
        (output_root / "frontier-safety" / "data" / "current.json").read_text(
            encoding="utf-8"
        )
    )
    archived = json.loads(
        (
            output_root
            / "frontier-safety"
            / "data"
            / "archive"
            / "2026-08-24.json"
        ).read_text(encoding="utf-8")
    )

    assert result["edition_date"] == "2026-08-24"
    assert current["social_publication"] == edition["social_publication"]
    assert archived["social_publication"] == edition["social_publication"]


def test_late_replace_failure_rolls_back_entire_publication(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    builder = load_builder()
    original = read_edition()
    original_path = write_edition(tmp_path / "original.json", original)
    output_root = tmp_path / "public"
    output_root.mkdir()
    builder.build(original_path, output_root)
    before = snapshot_tree(output_root)

    next_edition = deepcopy(original)
    next_edition["edition_date"] = "2026-08-25"
    next_edition["observed_at"] = "2026-08-25T17:58:14Z"
    next_edition["change_summary"] = "A new edition that must publish as one set."
    next_path = write_edition(tmp_path / "next.json", next_edition)

    real_replace = os.replace
    replace_calls = 0

    def fail_once_late(source, destination) -> None:
        nonlocal replace_calls
        replace_calls += 1
        if replace_calls == 5:
            raise OSError("injected late publication failure")
        real_replace(source, destination)

    monkeypatch.setattr(os, "replace", fail_once_late)

    with pytest.raises(OSError, match="injected late publication failure"):
        builder.build(next_path, output_root)

    assert replace_calls >= 5
    assert snapshot_tree(output_root) == before


def test_restore_failure_retains_transaction_backups_and_reports_path(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    builder = load_builder()
    original = read_edition()
    original_path = write_edition(tmp_path / "original.json", original)
    output_root = tmp_path / "public"
    output_root.mkdir()
    builder.build(original_path, output_root)

    next_edition = deepcopy(original)
    next_edition["edition_date"] = "2026-08-25"
    next_edition["observed_at"] = "2026-08-25T17:58:14Z"
    next_edition["change_summary"] = "A publication with a failed restore."
    next_path = write_edition(tmp_path / "next.json", next_edition)

    real_replace = os.replace
    replace_calls = 0

    def fail_publish_then_restore(source, destination) -> None:
        nonlocal replace_calls
        replace_calls += 1
        if replace_calls in {3, 4}:
            raise OSError(f"injected replace failure {replace_calls}")
        real_replace(source, destination)

    monkeypatch.setattr(os, "replace", fail_publish_then_restore)

    with pytest.raises(RuntimeError, match="rollback was incomplete.*frontier-safety-publish") as exc:
        builder.build(next_path, output_root)

    transactions = list(output_root.glob(".frontier-safety-publish-*"))
    assert len(transactions) == 1
    assert str(transactions[0]) in str(exc.value)
    assert list(transactions[0].glob("backup-*"))


def test_impossible_edition_date_fails_before_writes(tmp_path: Path) -> None:
    builder = load_builder()
    edition = read_edition()
    edition["edition_date"] = "2026-02-30"
    edition_path = write_edition(tmp_path / "edition.json", edition)
    output_root = tmp_path / "public"
    output_root.mkdir()

    with pytest.raises(builder.EditionError, match="edition_date"):
        builder.build(edition_path, output_root)

    assert snapshot_tree(output_root) == {}


@pytest.mark.parametrize(
    "observed_at",
    ["not-a-timestampZ", "2026-08-24T10:58:14-07:00"],
    ids=["malformed", "non-utc"],
)
def test_invalid_observed_at_fails_before_writes(tmp_path: Path, observed_at: str) -> None:
    builder = load_builder()
    edition = read_edition()
    edition["observed_at"] = observed_at
    edition_path = write_edition(tmp_path / "edition.json", edition)
    output_root = tmp_path / "public"
    output_root.mkdir()

    with pytest.raises(builder.EditionError, match="observed_at"):
        builder.build(edition_path, output_root)

    assert snapshot_tree(output_root) == {}


def test_observed_at_accepts_explicit_utc_offset(tmp_path: Path) -> None:
    builder = load_builder()
    edition = read_edition()
    edition["observed_at"] = "2026-08-24T17:58:14+00:00"
    edition_path = write_edition(tmp_path / "edition.json", edition)
    output_root = tmp_path / "public"
    output_root.mkdir()

    result = builder.build(edition_path, output_root)

    assert result["edition_date"] == "2026-08-24"
