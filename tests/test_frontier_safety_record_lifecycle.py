"""Whole-record contracts on a copy of the real committed record.

The lifecycle test replays the sequence the adversarial review found dead-ended:
publish a receipted edition, accept its baseline, publish the next edition,
then re-baseline the source. Every step must stay valid, and each attack must
still be rejected.
"""

from __future__ import annotations

import copy
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

from test_frontier_safety_receipts import load_module, receipts

coverage = load_module("frontier_safety_coverage")
ROOT = Path(__file__).resolve().parents[1]
NEW_URL = "https://institute.example/essays/launch/"
FIRST, SECOND = "f" * 64, "e" * 64


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")


def sitemap_for(dates) -> str:
    """A sitemap listing the briefing and one archive route per date, as the real sitemap does."""
    routes = ["frontier-safety.html", *(f"frontier-safety/archive/{date}.html" for date in dates)]
    return "<urlset>\n" + "".join(f"  <url><loc>https://harperz9.github.io/{r}</loc></url>\n" for r in routes) + "</urlset>\n"


@pytest.fixture
def record(tmp_path: Path) -> Path:
    """A copy of the pinned archive only, so later live editions cannot change these tests."""
    for relative in ("frontier-safety/data/source-state.json",
                     "project-docs/zentropy-import/2026-08-24-source-register.json"):
        (tmp_path / relative).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(ROOT / relative, tmp_path / relative)
    editions = tmp_path / coverage.EDITIONS_DIR
    editions.mkdir(parents=True)
    for date in coverage.PINNED_ARCHIVE:
        shutil.copy(ROOT / coverage.EDITIONS_DIR / f"{date}.json", editions / f"{date}.json")
    history = read(ROOT / coverage.HISTORY_PATH)
    history["editions"] = [e for e in history["editions"] if e["date"] in coverage.PINNED_ARCHIVE]
    write(tmp_path / coverage.HISTORY_PATH, history)
    (tmp_path / "sitemap.xml").write_text(sitemap_for(coverage.PINNED_ARCHIVE), encoding="utf-8")
    registry_path = tmp_path / coverage.REGISTRY_PATH
    registry = read(registry_path)
    registry["sources"].append({
        "id": "new-venue", "lane": "industry", "title": "Launch essay", "url": NEW_URL,
        "published_at": "not shown on the page", "role": "developer statement", "status": "available",
        "fingerprint_profile": "openai_news_article", "does_not_prove": "The page describes a venue."})
    write(registry_path, registry)
    return tmp_path


def carried(previous: dict, date: str, observed: str, state_name: str) -> dict:
    edition = copy.deepcopy(previous)
    edition.pop("first_observation_receipts", None)  # pins belong to the edition that carries the receipts
    edition.update(edition_date=date, previous_edition=previous["edition_date"], observed_at=observed,
                   edition_state=state_name)
    for lane in edition["lanes"]:
        for item in lane["items"]:
            item["status"] = "unchanged"
    return edition


def publish_receipted(root: Path) -> None:
    editions = root / coverage.EDITIONS_DIR
    edition = carried(read(editions / "2026-09-23.json"), "2026-09-24", "2026-09-24T15:30:00Z", "changed")
    lane = next(lane for lane in edition["lanes"] if lane["id"] == "industry")
    lane["items"].insert(0, {"id": "venue", "title": "A new venue", "status": "changed",
                             "source_role": "developer statement", "published_at": "not shown",
                             "event_time": "not shown", "confidence": "high", "summary": "S.",
                             "does_not_prove": "D.", "sources": [{"title": "Launch", "url": NEW_URL}]})
    packet = {"schema_version": 1, "observed_at": edition["observed_at"], "changed_source_ids": [],
              "error_source_ids": [], "unbaselined_source_ids": ["new-venue"],
              "review_required_source_ids": ["new-venue"],
              "sources": [{"id": "new-venue", "status": "unbaselined", "changed": False, "review_required": True,
                           "url": NEW_URL, "sha256": FIRST, "normalized_characters": 900,
                           "etag": None, "last_modified": None}]}
    receipt = receipts.draft_receipt(packet, "new-venue", "2026-09-24", ["venue"], read(root / coverage.REGISTRY_PATH))
    receipt["review"] = {"status": "reviewed", "reviewer": "Zain Dana Harper",
                         "reviewed_at": "2026-09-24T16:00:00Z", "read_in_full": True, "times_recorded": True}
    edition["first_observation_receipts"] = {"new-venue": receipts.canonical_sha256(receipt)}
    write(editions / "2026-09-24.json", edition)
    folder = root / receipts.RECEIPTS_DIR / "2026-09-24"
    write(folder / receipts.PACKET_NAME, packet)
    write(folder / "new-venue.json", receipt)


def set_baseline(root: Path, sha: str) -> None:
    path = root / coverage.STATE_PATH
    state = read(path)
    state["sources"] = [s for s in state["sources"] if s["id"] != "new-venue"] + [{
        "id": "new-venue", "status": "available", "changed": False, "url": NEW_URL, "sha256": sha,
        "normalized_characters": 900, "etag": None, "last_modified": None}]
    write(path, state)


def publish_next(root: Path) -> None:
    editions = root / coverage.EDITIONS_DIR
    previous = read(editions / "2026-09-24.json")
    write(editions / "2026-09-25.json", carried(previous, "2026-09-25", "2026-09-25T15:30:00Z", "unchanged"))
    history_path = root / coverage.HISTORY_PATH
    history = read(history_path)
    history["editions"].append({"date": "2026-09-24", "sha256": coverage.edition_digest(previous), "state": "changed"})
    write(history_path, history)


def test_the_committed_record_satisfies_the_contract() -> None:
    coverage.validate_repository(ROOT)


def test_full_lifecycle_stays_valid(record: Path) -> None:
    publish_receipted(record)
    coverage.validate_repository(record)
    set_baseline(record, FIRST)
    coverage.validate_repository(record)
    publish_next(record)
    coverage.validate_repository(record)
    set_baseline(record, SECOND)
    coverage.validate_repository(record)


def test_new_source_without_a_receipt_is_rejected(record: Path) -> None:
    publish_receipted(record)
    shutil.rmtree(record / receipts.RECEIPTS_DIR)
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        coverage.validate_repository(record)


def test_self_referencing_previous_edition_is_rejected(record: Path) -> None:
    publish_receipted(record)
    path = record / coverage.EDITIONS_DIR / "2026-09-24.json"
    edition = read(path)
    edition["previous_edition"] = "2026-09-24"
    write(path, edition)
    with pytest.raises(receipts.ReceiptError, match="previous_edition"):
        coverage.validate_repository(record)


def test_in_place_rewrite_of_a_pinned_edition_is_rejected(record: Path) -> None:
    path = record / coverage.EDITIONS_DIR / "2026-09-16.json"
    edition = read(path)
    edition["lanes"][0]["items"][0]["summary"] += " Rewritten."
    write(path, edition)
    with pytest.raises(receipts.ReceiptError, match="pinned archive edition 2026-09-16 was modified"):
        coverage.validate_repository(record)


def test_deleting_a_pinned_edition_with_its_history_entry_is_rejected(record: Path) -> None:
    (record / coverage.EDITIONS_DIR / "2026-09-23.json").unlink()
    history_path = record / coverage.HISTORY_PATH
    history = read(history_path)
    history["editions"] = [e for e in history["editions"] if e["date"] != "2026-09-23"]
    write(history_path, history)
    with pytest.raises(receipts.ReceiptError, match="exactly the pinned archive"):
        coverage.validate_repository(record)


def test_superseded_edition_missing_from_history_is_rejected(record: Path) -> None:
    publish_receipted(record)
    editions = record / coverage.EDITIONS_DIR
    write(editions / "2026-09-25.json", carried(read(editions / "2026-09-24.json"), "2026-09-25",
                                                  "2026-09-25T15:30:00Z", "unchanged"))
    with pytest.raises(receipts.ReceiptError, match="absent from history.json"):
        coverage.validate_repository(record)


def test_backdated_new_edition_is_rejected(record: Path) -> None:
    editions = record / coverage.EDITIONS_DIR
    write(editions / "2026-09-20.json", carried(read(editions / "2026-09-16.json"), "2026-09-20",
                                                  "2026-09-20T15:30:00Z", "unchanged"))
    with pytest.raises(receipts.ReceiptError):
        coverage.validate_repository(record)


def test_historical_edition_that_drifts_from_history_is_rejected(record: Path) -> None:
    publish_receipted(record)
    publish_next(record)
    path = record / coverage.EDITIONS_DIR / "2026-09-24.json"
    edition = read(path)
    edition["change_summary"] = "Rewritten after publication."
    write(path, edition)
    with pytest.raises(receipts.ReceiptError, match="differs from its history.json digest"):
        coverage.validate_repository(record)


def test_receipt_file_must_be_named_for_its_source(record: Path) -> None:
    publish_receipted(record)
    folder = record / receipts.RECEIPTS_DIR / "2026-09-24"
    (folder / "new-venue.json").rename(folder / "other-name.json")
    with pytest.raises(receipts.ReceiptError, match="named for its source_id"):
        coverage.validate_repository(record)


def test_a_record_with_no_editions_is_rejected(record: Path) -> None:
    shutil.rmtree(record / coverage.EDITIONS_DIR)
    (record / coverage.EDITIONS_DIR).mkdir()
    with pytest.raises(receipts.ReceiptError, match="expected committed editions"):
        coverage.validate_repository(record)


def test_history_entry_without_a_committed_edition_is_rejected(record: Path) -> None:
    history_path = record / coverage.HISTORY_PATH
    history = read(history_path)
    history["editions"].append({"date": "2026-09-20", "sha256": "0" * 64, "state": "changed"})
    write(history_path, history)
    with pytest.raises(receipts.ReceiptError, match="no committed file"):
        coverage.validate_repository(record)


def run_tool(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run([sys.executable, *args], capture_output=True, text=True, check=False)


def test_baseline_accepted_from_the_committed_packet_keeps_the_record_valid(record: Path) -> None:
    publish_receipted(record)
    packet = record / receipts.RECEIPTS_DIR / "2026-09-24" / receipts.PACKET_NAME
    result = run_tool(str(ROOT / "tools" / "check_frontier_safety_sources.py"),
                      "--registry", str(record / coverage.REGISTRY_PATH), "--state", str(record / coverage.STATE_PATH),
                      "--accept-from-report", str(packet), "--accept-reviewed", "new-venue")
    assert result.returncode == 0, result.stderr
    baseline = next(s for s in read(record / coverage.STATE_PATH)["sources"] if s["id"] == "new-venue")
    assert baseline["sha256"] == FIRST and baseline["status"] == "available"
    coverage.validate_repository(record)


def test_validate_cli_prints_one_rejection_line_without_a_traceback(record: Path) -> None:
    publish_receipted(record)
    shutil.rmtree(record / receipts.RECEIPTS_DIR)
    result = run_tool(str(ROOT / "tools" / "frontier_safety_receipts.py"), "validate", "--root", str(record))
    assert result.returncode == 1
    assert result.stderr.startswith("First-observation contract rejected:")
    assert "Traceback" not in result.stderr
    ok = run_tool(str(ROOT / "tools" / "frontier_safety_receipts.py"), "validate", "--root", str(ROOT))
    assert ok.returncode == 0, ok.stderr


def test_receipts_for_a_date_without_an_edition_are_rejected(record: Path) -> None:
    write(record / receipts.RECEIPTS_DIR / "2026-09-30" / "x.json", {"source_id": "x"})
    with pytest.raises(receipts.ReceiptError, match="not post-effective editions"):
        coverage.validate_repository(record)
