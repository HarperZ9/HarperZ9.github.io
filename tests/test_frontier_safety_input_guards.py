"""Input guards that a deletion pass removed while every other Frontier Safety test stayed green.

Three guards turn a value of the wrong type into one ReceiptError line. Without them the code
raises AttributeError or TypeError, and the CLI, which reports only ValueError as a rejection,
prints a traceback. The fourth keeps `validate` checking the source register and source state
against the monitor's own schema.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from test_frontier_safety_receipts import check, edition, item, packet, receipt, receipts, registry, state
from test_frontier_safety_record_lifecycle import (  # noqa: F401  (record is a fixture)
    coverage, read, record, write,
)

OLD_URL = "https://old.example/post"


@pytest.mark.parametrize("reviewer", [None, 42, ["Zain Dana Harper"]], ids=["null", "number", "list"])
def test_a_reviewer_that_is_not_text_is_rejected_as_unnamed(reviewer: object) -> None:
    bad = receipt()
    bad["review"]["reviewer"] = reviewer
    with pytest.raises(receipts.ReceiptError, match="name the reviewer"):
        check(rs=[bad])


@pytest.mark.parametrize("source", [123, None, {"url": OLD_URL}], ids=["number", "null", "object"])
def test_a_control_source_that_is_not_a_url_string_is_outside_the_reviewed_record(source: object) -> None:
    ed = edition(item(url=OLD_URL))
    ed["controls"] = [{"claim": "A vendor says a control is live.", "sources": [source]}]
    with pytest.raises(receipts.ReceiptError, match=r"controls\[0\] cites a source outside the reviewed record"):
        coverage.validate_source_coverage(ed, registry(), state(), [], None)


def test_draft_refuses_a_reported_source_that_the_registry_lacks() -> None:
    report = packet()
    report["sources"].append({"id": "ghost", "status": "unbaselined", "url": "https://ghost.example/",
                              "sha256": "c" * 64})
    with pytest.raises(receipts.ReceiptError, match="ghost is not a registered unbaselined observation"):
        receipts.draft_receipt(report, "ghost", "2026-09-24", ["venue"], registry())


def _duplicate_first(sources: list) -> None:
    sources.append(dict(sources[0]))


def _insecure_first(sources: list) -> None:
    sources[0]["url"] = "http://insecure.example/page"


def _unknown_status_first(sources: list) -> None:
    sources[0]["status"] = "retired"


@pytest.mark.parametrize("path,mutate,message", [
    (coverage.REGISTRY_PATH, _duplicate_first, "registry contains duplicate source id"),
    (coverage.REGISTRY_PATH, _insecure_first, r"registry\.sources\[0\]\.url must be an absolute HTTPS URL"),
    (coverage.REGISTRY_PATH, _unknown_status_first, r"registry\.sources\[0\]\.status must be one of"),
    (coverage.STATE_PATH, _duplicate_first, "state contains duplicate source id"),
    (coverage.STATE_PATH, _insecure_first, r"state\.sources\[0\]\.url must be an absolute HTTPS URL"),
    (coverage.STATE_PATH, _unknown_status_first, r"state\.sources\[0\]\.status must be one of"),
], ids=["registry-duplicate", "registry-http", "registry-status", "state-duplicate", "state-http", "state-status"])
def test_validate_checks_the_register_and_source_state_against_the_monitor_schema(
    record: Path, path: Path, mutate, message: str
) -> None:
    coverage.validate_repository(record)
    payload = read(record / path)
    mutate(payload["sources"])
    write(record / path, payload)
    with pytest.raises(ValueError, match=message):
        coverage.validate_repository(record)
