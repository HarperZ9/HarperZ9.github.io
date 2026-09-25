"""First-observation receipt contracts: one ordinary success, then each way it must fail."""

from __future__ import annotations

import copy
import importlib.util
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


def load_module(name: str):
    path = ROOT / "tools" / f"{name}.py"
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


receipts = load_module("frontier_safety_receipts")
URL = "https://new.example/essays/launch/"
OBSERVED = "2026-09-24T15:30:00Z"
NEW_SHA, OLD_SHA = "b" * 64, "a" * 64


def registry(status: str = "available") -> dict:
    return {"sources": [
        {"id": "old", "lane": "industry", "url": "https://old.example/post", "status": "available",
         "fingerprint_profile": "openai_news_article"},
        {"id": "new", "lane": "industry", "url": URL, "status": status,
         "fingerprint_profile": "openai_news_article"},
    ]}


def state(*extra: dict) -> dict:
    return {"sources": [{"id": "old", "status": "available", "url": "https://old.example/post",
                         "sha256": OLD_SHA}, *extra]}


def packet() -> dict:
    return {"observed_at": OBSERVED, "error_source_ids": [], "sources": [
        {"id": "old", "status": "available", "url": "https://old.example/post", "sha256": OLD_SHA},
        {"id": "new", "status": "unbaselined", "url": URL, "sha256": NEW_SHA},
    ]}


def item(item_id: str = "venue", status: str = "changed", url: str = URL) -> dict:
    return {"id": item_id, "status": status, "source_role": "developer statement",
            "sources": [{"title": "Launch", "url": url}]}


def edition(*items: dict, state_name: str = "changed", date: str = "2026-09-24") -> dict:
    return {"edition_date": date, "observed_at": OBSERVED, "edition_state": state_name,
            "previous_edition": "2026-09-23",
            "lanes": [{"id": "industry", "items": list(items) or [item()]}]}


def receipt(**overrides) -> dict:
    drafted = receipts.draft_receipt(packet(), "new", "2026-09-24", ["venue"], registry())
    drafted["review"] = {"status": "reviewed", "reviewer": "Zain Dana Harper",
                         "reviewed_at": "2026-09-24T16:00:00Z", "read_in_full": True, "times_recorded": True}
    drafted.update(overrides)
    return drafted


def check(ed=None, rs=None, pk="default", prior=frozenset(), reg=None, st=None, newest=True) -> None:
    receipts.validate_receipts(ed or edition(), reg or registry(), st or state(),
                               [receipt()] if rs is None else rs, packet() if pk == "default" else pk,
                               prior, newest=newest)


def test_ordinary_success_a_reviewed_receipt_is_accepted() -> None:
    check()


def test_draft_receipt_is_unattested_and_rejected_until_reviewed() -> None:
    draft = receipts.draft_receipt(packet(), "new", "2026-09-24", ["venue"], registry())
    assert draft["review"]["status"] == "draft" and draft["lane"] == "industry"
    with pytest.raises(receipts.ReceiptError, match="attested"):
        check(rs=[draft])


@pytest.mark.parametrize("name", ["", "TBD", "pending", "  Reviewer ", "N/A", "x", "-", "?", "x1", "DRY RUN"])
def test_placeholder_reviewer_is_rejected(name: str) -> None:
    bad = receipt()
    bad["review"]["reviewer"] = name
    with pytest.raises(receipts.ReceiptError, match="name the reviewer"):
        check(rs=[bad])


@pytest.mark.parametrize("field", ["read_in_full", "times_recorded"])
def test_review_must_attest_full_read_and_recorded_times(field: str) -> None:
    bad = receipt()
    bad["review"][field] = False
    with pytest.raises(receipts.ReceiptError, match="full read"):
        check(rs=[bad])


def test_review_cannot_precede_the_observation() -> None:
    bad = receipt()
    bad["review"]["reviewed_at"] = "2026-09-24T15:00:00Z"
    with pytest.raises(receipts.ReceiptError, match="precedes"):
        check(rs=[bad])


def test_a_stateless_checker_run_cannot_launder_a_baselined_source() -> None:
    stateless = packet()
    stateless["sources"][0].update(status="unbaselined", sha256="d" * 64)
    laundered = receipt(source_id="old", url="https://old.example/post", fingerprint_sha256="d" * 64,
                        checker_packet_sha256=receipts.canonical_sha256(stateless))
    with pytest.raises(receipts.ReceiptError, match="different reviewed baseline"):
        check(ed=edition(item(url="https://old.example/post")), rs=[laundered], pk=stateless)


def test_baseline_accepted_from_the_receipt_keeps_the_edition_valid() -> None:
    accepted = {"id": "new", "status": "available", "url": URL, "sha256": NEW_SHA}
    check(st=state(accepted))
    drifted = dict(accepted, sha256="e" * 64)
    with pytest.raises(receipts.ReceiptError, match="different reviewed baseline"):
        check(st=state(drifted))
    check(st=state(drifted), newest=False)


def test_historical_editions_skip_live_registry_bindings_but_keep_immutable_ones() -> None:
    check(reg=registry(status="pending"), newest=False)
    with pytest.raises(receipts.ReceiptError, match="fingerprint differs"):
        check(rs=[receipt(fingerprint_sha256="c" * 64)], newest=False)


@pytest.mark.parametrize("status", ["context-only", "pending"])
def test_newest_edition_requires_an_available_registration(status: str) -> None:
    with pytest.raises(receipts.ReceiptError, match="status available"):
        check(reg=registry(status=status))


def test_fingerprint_must_match_the_packet_observation() -> None:
    with pytest.raises(receipts.ReceiptError, match="fingerprint differs"):
        check(rs=[receipt(fingerprint_sha256="c" * 64)])


def _repacked(mutate) -> tuple[dict, dict]:
    pk = packet()
    mutate(pk)
    return pk, receipt(checker_packet_sha256=receipts.canonical_sha256(pk))


def test_packet_url_must_match_even_when_the_fingerprint_matches() -> None:
    pk, rc = _repacked(lambda p: p["sources"][1].update(url="https://elsewhere.example/"))
    with pytest.raises(receipts.ReceiptError, match="URL differs from the packet"):
        check(rs=[rc], pk=pk)


def test_packet_must_report_the_source_as_unbaselined() -> None:
    pk, rc = _repacked(lambda p: p["sources"][1].update(status="available"))
    with pytest.raises(receipts.ReceiptError, match="not an unbaselined observation"):
        check(rs=[rc], pk=pk)


def test_packet_observation_time_must_match_the_receipt() -> None:
    pk, rc = _repacked(lambda p: p.update(observed_at="2026-09-24T15:31:00Z"))
    with pytest.raises(receipts.ReceiptError, match="differs from the packet"):
        check(rs=[rc], pk=pk)


def test_edited_packet_breaks_the_receipt_binding() -> None:
    edited = packet()
    edited["sources"][1]["sha256"] = "c" * 64
    with pytest.raises(receipts.ReceiptError, match="committed checker packet"):
        check(pk=edited)


def test_missing_packet_is_rejected() -> None:
    with pytest.raises(receipts.ReceiptError, match="require the committed checker packet"):
        check(pk=None)


def test_packet_with_fetch_errors_is_rejected_even_with_a_matching_hash() -> None:
    pk, rc = _repacked(lambda p: p.update(error_source_ids=["old"]))
    with pytest.raises(receipts.ReceiptError, match="fetch errors"):
        check(rs=[rc], pk=pk)


def test_receipt_must_come_from_the_edition_observation_run() -> None:
    later = edition()
    later["observed_at"] = "2026-09-25T15:30:00Z"
    with pytest.raises(receipts.ReceiptError, match="own observation run"):
        check(ed=later)


@pytest.mark.parametrize("state_name", ["correction", "baseline", "unchanged"])
def test_receipts_are_refused_outside_normal_changed_editions(state_name: str) -> None:
    with pytest.raises(receipts.ReceiptError, match="normal changed editions"):
        check(ed=edition(state_name=state_name))


def test_receipt_for_another_edition_is_rejected() -> None:
    with pytest.raises(receipts.ReceiptError, match="different edition"):
        check(rs=[receipt(edition_date="2026-09-25")])


def test_receipt_is_single_use_across_and_within_editions() -> None:
    with pytest.raises(receipts.ReceiptError, match="single-use"):
        check(prior=frozenset({"new"}))
    with pytest.raises(receipts.ReceiptError, match="single-use"):
        check(rs=[receipt(), receipt()])


def test_more_than_the_limit_of_first_observations_is_rejected() -> None:
    many = [receipt(source_id=f"s{i}") for i in range(receipts.MAX_FIRST_OBSERVATIONS_PER_EDITION + 1)]
    with pytest.raises(receipts.ReceiptError, match="at most"):
        check(rs=many)


@pytest.mark.parametrize("field,value", [("url", "https://new.example/other"),
                                          ("fingerprint_profile", "metr_blog_article"),
                                          ("source_id", "unregistered"),
                                          ("lane", "anthropic")])
def test_receipt_must_match_the_registry(field: str, value: str) -> None:
    with pytest.raises(receipts.ReceiptError):
        check(rs=[receipt(**{field: value})])


def test_receipt_may_support_only_changed_items_that_cite_it() -> None:
    with pytest.raises(receipts.ReceiptError, match="only changed items"):
        check(ed=edition(item(status="unchanged")))
    with pytest.raises(receipts.ReceiptError, match="does not cite"):
        check(ed=edition(item(url="https://old.example/post")))
    with pytest.raises(receipts.ReceiptError, match="absent from the edition"):
        check(rs=[receipt(supports_item_ids=["missing"])])


def test_receipt_lane_must_match_the_item_lane() -> None:
    other_lane = edition()
    other_lane["lanes"][0]["id"] = "anthropic"
    with pytest.raises(receipts.ReceiptError, match="lane differs from item lane"):
        check(ed=other_lane)


def test_receipt_lane_must_match_the_registry_even_when_the_item_agrees() -> None:
    moved = edition()
    moved["lanes"][0]["id"] = "anthropic"
    with pytest.raises(receipts.ReceiptError, match="lane differs from the registry"):
        check(ed=moved, rs=[receipt(lane="anthropic")])


def test_duplicate_item_ids_are_rejected() -> None:
    with pytest.raises(receipts.ReceiptError, match="duplicate item id"):
        check(ed=edition(item(), item()))


def test_canonical_hash_ignores_line_endings_and_indentation() -> None:
    compact = json.loads(json.dumps(packet()))
    crlf = json.loads(json.dumps(packet(), indent=2).replace("\n", "\r\n"))
    assert receipts.canonical_sha256(compact) == receipts.canonical_sha256(crlf)
    changed = copy.deepcopy(compact)
    changed["observed_at"] = "2026-09-24T15:30:01Z"
    assert receipts.canonical_sha256(changed) != receipts.canonical_sha256(compact)
