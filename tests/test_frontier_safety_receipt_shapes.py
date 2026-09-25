"""Receipt shape, timestamp and live-registry guards, each isolated so deleting it fails a test."""

from __future__ import annotations

import pytest

from test_frontier_safety_receipts import check, receipt, receipts, registry


@pytest.mark.parametrize("field,value,message", [
    ("schema_version", 2, "schema 1 first-observation"),
    ("kind", "delta", "schema 1 first-observation"),
    ("source_id", " ", "source_id must be non-empty"),
    ("url", "", "url must be non-empty"),
    ("fingerprint_profile", None, "fingerprint_profile must be non-empty"),
    ("lane", "", "lane must be non-empty"),
    ("does_not_prove", "", "does_not_prove must be non-empty"),
    ("fingerprint_sha256", "B" * 64, "fingerprint_sha256 must be a lowercase SHA-256"),
    ("checker_packet_sha256", "abc", "checker_packet_sha256 must be a lowercase SHA-256"),
    ("edition_date", "2026-9-24", "edition_date must be YYYY-MM-DD"),
    ("supports_item_ids", "venue", "supports_item_ids must list"),
    ("supports_item_ids", [], "supports_item_ids must list"),
])
def test_malformed_receipts_are_rejected(field, value, message) -> None:
    with pytest.raises(receipts.ReceiptError, match=message):
        check(rs=[receipt(**{field: value})])


def test_timestamps_must_parse_as_iso() -> None:
    bad = receipt()
    bad["review"]["reviewed_at"] = "yesterdayZ"
    with pytest.raises(receipts.ReceiptError, match="not an ISO timestamp"):
        check(rs=[bad])


def test_draft_refuses_a_source_that_is_not_a_registered_unbaselined_observation() -> None:
    from test_frontier_safety_receipts import packet
    for source_id in ("old", "unregistered"):
        with pytest.raises(receipts.ReceiptError, match="not a registered unbaselined observation"):
            receipts.draft_receipt(packet(), source_id, "2026-09-24", ["venue"], registry())


def test_timestamps_must_be_utc_with_a_z_suffix() -> None:
    bad = receipt()
    bad["review"]["reviewed_at"] = "2026-09-24T16:00:00+00:00"
    with pytest.raises(receipts.ReceiptError, match="UTC timestamp ending in Z"):
        check(rs=[bad])


def test_newest_edition_registry_url_must_match_even_when_packet_and_receipt_agree() -> None:
    moved = registry()
    moved["sources"][1]["url"] = "https://new.example/essays/renamed/"
    with pytest.raises(receipts.ReceiptError, match="differs from the registry"):
        check(reg=moved)
