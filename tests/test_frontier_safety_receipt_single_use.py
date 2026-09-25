"""A receipt is single-use across the committed record, not only within one edition.

The unit test in test_frontier_safety_receipts.py hands validate_receipts its prior receipt ids
directly, so it never reaches the wiring in validate_repository that collects those ids from the
other editions' receipt folders. Review found that replacing that wiring with an empty set kept
every test green. The route it opens: leave a new source unbaselined after its receipted edition,
then receipt it again in the next edition, which skips the baseline acceptance step entirely.
This test replays that route on a copy of the pinned record.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from test_frontier_safety_receipts import receipts
from test_frontier_safety_record_lifecycle import (  # noqa: F401  (record is a fixture)
    NEW_URL, SECOND, coverage, publish_next, publish_receipted, read, record, write,
)

LATER, LATER_OBSERVED = "2026-09-25", "2026-09-25T15:30:00Z"


def receipt_again_in_the_next_edition(root: Path) -> tuple[dict, list[dict], dict]:
    """2026-09-25 rewords the venue item and carries a second receipt for the still-unbaselined source."""
    path = root / coverage.EDITIONS_DIR / f"{LATER}.json"
    edition = read(path)
    edition["edition_state"] = "changed"
    venue = next(item for lane in edition["lanes"] for item in lane["items"] if item["id"] == "venue")
    venue.update(status="changed", summary="S2.")
    packet = {"schema_version": 1, "observed_at": LATER_OBSERVED, "changed_source_ids": [],
              "error_source_ids": [], "unbaselined_source_ids": ["new-venue"],
              "review_required_source_ids": ["new-venue"],
              "sources": [{"id": "new-venue", "status": "unbaselined", "changed": False, "review_required": True,
                           "url": NEW_URL, "sha256": SECOND, "normalized_characters": 900,
                           "etag": None, "last_modified": None}]}
    receipt = receipts.draft_receipt(packet, "new-venue", LATER, ["venue"], read(root / coverage.REGISTRY_PATH))
    receipt["review"] = {"status": "reviewed", "reviewer": "Zain Dana Harper",
                         "reviewed_at": "2026-09-25T16:00:00Z", "read_in_full": True, "times_recorded": True}
    edition[coverage.RECEIPT_PINS] = {"new-venue": receipts.canonical_sha256(receipt)}
    write(path, edition)
    folder = root / receipts.RECEIPTS_DIR / LATER
    write(folder / receipts.PACKET_NAME, packet)
    write(folder / "new-venue.json", receipt)
    return edition, [receipt], packet


def test_receipt_is_single_use_across_committed_editions(record: Path) -> None:  # noqa: F811
    publish_receipted(record)
    publish_next(record)
    # Without an accepted baseline the next edition cannot carry the venue item, which is the pressure
    # to receipt the source a second time instead.
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        coverage.validate_repository(record)
    edition, later_receipts, packet = receipt_again_in_the_next_edition(record)
    # Control: each edition's receipt is valid on its own, so only the cross-edition rule can refuse it.
    registry, state = read(record / coverage.REGISTRY_PATH), read(record / coverage.STATE_PATH)
    receipts.validate_receipts(edition, registry, state, later_receipts, packet, frozenset(), newest=True)
    coverage.validate_source_coverage(edition, registry, state, later_receipts,
                                      read(record / coverage.EDITIONS_DIR / "2026-09-24.json"))
    with pytest.raises(receipts.ReceiptError, match=r"receipt\[new-venue\] is not single-use"):
        coverage.validate_repository(record)
