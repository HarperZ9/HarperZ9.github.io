"""Each post-effective edition pins its receipt folder, so history.json covers the receipts too.

The review published a 2026-09-24 edition whose changed item cited a baselined source, published
2026-09-25 without that item, then deleted the source from the registry and from source-state.json.
Coverage rejected 2026-09-24 until the same commit added a receipt folder to it: a packet and an
attested receipt for a source id that was never registered, reviewed after the edition was
superseded. Rule 7 skips superseded editions and history.json pinned edition content only, so every
check passed. These tests replay that route and its variants on a copy of the pinned record.
"""

from __future__ import annotations

import copy
from pathlib import Path

import pytest

from test_frontier_safety_receipts import receipts
from test_frontier_safety_record_lifecycle import (  # noqa: F401  (record is a fixture)
    FIRST, NEW_URL, carried, coverage, publish_next, publish_receipted, read, record, set_baseline, write,
)

GHOST = "9" * 64
PINS = "first_observation_receipts"


def publish_baselined_then_superseded(root: Path) -> None:
    """2026-09-24 cites the baselined new-venue source; 2026-09-25 drops that item."""
    set_baseline(root, FIRST)
    editions = root / coverage.EDITIONS_DIR
    edition = carried(read(editions / "2026-09-23.json"), "2026-09-24", "2026-09-24T15:30:00Z", "changed")
    lane = next(lane for lane in edition["lanes"] if lane["id"] == "industry")
    lane["items"].insert(0, {"id": "venue", "title": "A new venue", "status": "changed",
                             "source_role": "developer statement", "published_at": "not shown",
                             "event_time": "not shown", "confidence": "high", "summary": "S.",
                             "does_not_prove": "D.", "sources": [{"title": "Launch", "url": NEW_URL}]})
    write(editions / "2026-09-24.json", edition)
    publish_next(root)
    path = editions / "2026-09-25.json"
    following = read(path)
    for lane in following["lanes"]:
        lane["items"] = [item for item in lane["items"] if item["id"] != "venue"]
    write(path, following)


def retire_by_deletion(root: Path) -> None:
    for relative in (coverage.REGISTRY_PATH, coverage.STATE_PATH):
        payload = read(root / relative)
        payload["sources"] = [s for s in payload["sources"] if s["id"] != "new-venue"]
        write(root / relative, payload)


def plant_ghost_receipt(root: Path) -> None:
    """A receipt drafted against a throwaway registry for an id that was never registered."""
    packet = {"schema_version": 1, "observed_at": "2026-09-24T15:30:00Z", "changed_source_ids": [],
              "error_source_ids": [], "unbaselined_source_ids": ["ghost-venue"],
              "review_required_source_ids": ["ghost-venue"],
              "sources": [{"id": "ghost-venue", "status": "unbaselined", "changed": False, "review_required": True,
                           "url": NEW_URL, "sha256": GHOST, "normalized_characters": 900,
                           "etag": None, "last_modified": None}]}
    throwaway = copy.deepcopy(read(root / coverage.REGISTRY_PATH))
    throwaway["sources"].append({"id": "ghost-venue", "lane": "industry", "url": NEW_URL,
                                 "fingerprint_profile": "openai_news_article"})
    receipt = receipts.draft_receipt(packet, "ghost-venue", "2026-09-24", ["venue"], throwaway)
    receipt["review"] = {"status": "reviewed", "reviewer": "Someone Else", "reviewed_at": "2026-09-26T09:00:00Z",
                         "read_in_full": True, "times_recorded": True}
    folder = root / receipts.RECEIPTS_DIR / "2026-09-24"
    write(folder / receipts.PACKET_NAME, packet)
    write(folder / "ghost-venue.json", receipt)


def test_receipt_added_to_a_superseded_edition_is_rejected(record: Path) -> None:  # noqa: F811
    publish_baselined_then_superseded(record)
    coverage.validate_repository(record)
    retire_by_deletion(record)
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        coverage.validate_repository(record)
    plant_ghost_receipt(record)
    with pytest.raises(receipts.ReceiptError, match=f"edition 2026-09-24 pins .* in {PINS}"):
        coverage.validate_repository(record)


def test_receipt_rewritten_after_its_edition_was_superseded_is_rejected(record: Path) -> None:  # noqa: F811
    publish_receipted(record)
    set_baseline(record, FIRST)
    publish_next(record)
    coverage.validate_repository(record)
    path = record / receipts.RECEIPTS_DIR / "2026-09-24" / "new-venue.json"
    receipt = read(path)
    receipt["review"].update(reviewer="Someone Else", reviewed_at="2026-09-26T09:00:00Z")
    write(path, receipt)
    with pytest.raises(receipts.ReceiptError, match=f"edition 2026-09-24 pins .* in {PINS}"):
        coverage.validate_repository(record)


def test_pinned_receipt_removed_after_its_baseline_was_accepted_is_rejected(record: Path) -> None:  # noqa: F811
    publish_receipted(record)
    set_baseline(record, FIRST)
    publish_next(record)
    (record / receipts.RECEIPTS_DIR / "2026-09-24" / "new-venue.json").unlink()
    with pytest.raises(receipts.ReceiptError, match=f"edition 2026-09-24 pins .* in {PINS}"):
        coverage.validate_repository(record)


def test_newest_edition_must_pin_its_own_receipts(record: Path) -> None:  # noqa: F811
    publish_receipted(record)
    path = record / coverage.EDITIONS_DIR / "2026-09-24.json"
    edition = read(path)
    del edition[PINS]
    write(path, edition)
    with pytest.raises(receipts.ReceiptError, match=f"edition 2026-09-24 pins .* in {PINS}"):
        coverage.validate_repository(record)


def test_checker_packet_without_a_pinned_receipt_is_rejected(record: Path) -> None:  # noqa: F811
    publish_receipted(record)
    set_baseline(record, FIRST)
    publish_next(record)
    packet = read(record / receipts.RECEIPTS_DIR / "2026-09-24" / receipts.PACKET_NAME)
    write(record / receipts.RECEIPTS_DIR / "2026-09-25" / receipts.PACKET_NAME, packet)
    with pytest.raises(receipts.ReceiptError, match="checker packet but no pinned receipt"):
        coverage.validate_repository(record)
