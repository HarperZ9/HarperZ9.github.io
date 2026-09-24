"""Source-coverage and edition-chain contracts, with each attack the review reproduced as a rejected control."""

from __future__ import annotations

import pytest

from test_frontier_safety_receipts import (
    URL, edition, item, load_module, receipt, receipts, registry, state,
)

coverage = load_module("frontier_safety_coverage")
OLD_URL = "https://old.example/post"


def previous(*items: dict) -> dict:
    return edition(*items, date="2026-09-23")


def cover(ed: dict, rs=None, prev=None) -> None:
    coverage.validate_source_coverage(ed, registry(), state(), rs or [], prev or previous(item("carried", url=OLD_URL)))


def test_changed_item_citing_a_baselined_registered_source_is_covered() -> None:
    cover(edition(item(url=OLD_URL)))


def test_changed_item_citing_an_unregistered_source_is_rejected() -> None:
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(item(url="https://unregistered.example/page")))


def test_registered_but_unbaselined_source_needs_a_receipt() -> None:
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(item()))
    cover(edition(item()), rs=[receipt()])


def test_baseline_whose_url_differs_from_the_registry_does_not_count() -> None:
    repointed = {"sources": [{"id": "old", "status": "available", "url": "https://elsewhere.example/",
                              "sha256": "a" * 64}]}
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        coverage.validate_source_coverage(edition(item(url=OLD_URL)), registry(), repointed, [], previous())


def test_receipt_covers_only_the_items_it_names() -> None:
    with pytest.raises(receipts.ReceiptError, match=r"item\[other\]"):
        cover(edition(item(), item("other")), rs=[receipt()])


def test_self_route_is_exempt_only_for_publication_notices() -> None:
    notice = item("notice", url="https://harperz9.github.io/briefings/x/")
    notice["source_role"] = "publication notice"
    cover(edition(notice))
    notice["source_role"] = "developer statement"
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(notice))


def test_correction_items_are_held_to_the_same_coverage() -> None:
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(item(status="correction", url="https://unregistered.example/page")))


def test_unchanged_item_must_match_its_previous_edition() -> None:
    cover(edition(item("carried", status="unchanged", url=OLD_URL)))
    with pytest.raises(receipts.ReceiptError, match="marked unchanged but differs"):
        cover(edition(item("carried", status="unchanged", url="https://unregistered.example/page")))
    with pytest.raises(receipts.ReceiptError, match="marked unchanged but differs"):
        cover(edition(item("brand-new", status="unchanged", url=OLD_URL)))


def test_control_sources_are_held_to_coverage() -> None:
    ed = edition(item(url=OLD_URL))
    ed["controls"] = [{"claim": "A vendor says a control is live.", "sources": [OLD_URL]}]
    cover(ed)
    ed["controls"][0]["sources"] = ["https://unregistered.example/page"]
    with pytest.raises(receipts.ReceiptError, match=r"controls\[0\]"):
        cover(ed)


def test_unchanged_item_citing_an_unreviewed_source_is_rejected_even_when_identical() -> None:
    unreviewed = "https://unregistered.example/page"
    prev = previous(item("carried", url=unreviewed))
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(item("carried", status="unchanged", url=unreviewed)), prev=prev)


def test_grandfathered_citation_holds_only_on_its_item_while_unchanged() -> None:
    rsp = "https://www.anthropic.com/responsible-scaling-policy"
    risk = "anthropic-2026-08-14-risk-report"
    cover(edition(item(risk, status="unchanged", url=rsp)), prev=previous(item(risk, url=rsp)))
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(item(risk, status="changed", url=rsp)), prev=previous(item(risk, url=rsp)))
    with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
        cover(edition(item("other", status="unchanged", url=rsp)), prev=previous(item("other", url=rsp)))


def test_controls_cannot_borrow_a_grandfathered_item_citation() -> None:
    rsp = "https://www.anthropic.com/responsible-scaling-policy"
    risk = "anthropic-2026-08-14-risk-report"
    ed = edition(item(risk, status="unchanged", url=rsp))
    ed["controls"] = [{"claim": "A new claim row.", "sources": [rsp]}]
    with pytest.raises(receipts.ReceiptError, match=r"controls\[0\]"):
        cover(ed, prev=previous(item(risk, url=rsp)))


def test_state_entry_without_a_valid_hash_does_not_count_as_baselined() -> None:
    for entry in ({"id": "old", "status": "pending", "url": OLD_URL},
                  {"id": "old", "status": "available", "url": OLD_URL, "sha256": "A" * 64}):
        with pytest.raises(receipts.ReceiptError, match="outside the reviewed record"):
            coverage.validate_source_coverage(edition(item(url=OLD_URL)), registry(), {"sources": [entry]}, [], previous())


def chain(**overrides) -> dict:
    editions = {d: {"edition_date": d, "previous_edition": p} for d, p in
                [("2026-09-16", None), ("2026-09-23", "2026-09-16"), ("2026-09-24", "2026-09-23")]}
    editions["2026-09-24"].update(overrides)
    return editions


def test_chain_accepts_real_predecessors() -> None:
    coverage.check_chain(chain())


@pytest.mark.parametrize("pointer", ["2026-09-24", "../archive/2026-09-24", "2026-09-16", None, "2026-9-23"])
def test_chain_rejects_self_reference_traversal_skip_back_and_missing(pointer) -> None:
    with pytest.raises(receipts.ReceiptError, match="previous_edition"):
        coverage.check_chain(chain(previous_edition=pointer))


def test_chain_rejects_a_file_whose_date_field_disagrees_with_its_name() -> None:
    with pytest.raises(receipts.ReceiptError, match="must carry edition_date"):
        coverage.check_chain(chain(edition_date="2026-09-30"))


def test_chain_rejects_an_edition_file_that_is_not_named_for_a_date() -> None:
    editions = chain()
    editions["latest"] = {"edition_date": "latest", "previous_edition": "2026-09-24"}
    with pytest.raises(receipts.ReceiptError, match="must carry edition_date"):
        coverage.check_chain(editions)


def test_backdated_insertion_breaks_the_successor_chain() -> None:
    editions = chain()
    editions["2026-09-20"] = {"edition_date": "2026-09-20", "previous_edition": "2026-09-16"}
    with pytest.raises(receipts.ReceiptError, match="2026-09-23 must name 2026-09-20"):
        coverage.check_chain(editions)
