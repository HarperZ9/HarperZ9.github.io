"""First-observation receipts for Frontier Safety editions.

A normal edition rests on a reviewed-baseline fingerprint delta. A newly
registered source has no baseline, so it cannot produce a delta. A
first-observation receipt is the substitute evidence: a checker-produced
fingerprint of the new source, bound to one error-free checker run, one named
reviewer's read, one edition and the items it supports. Repository-wide rules
(edition chain, archive pins, source coverage) live in
frontier_safety_coverage.py. The contract is documented in
docs/frontier-safety-operations.md.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REGISTRY_PATH = Path("project-docs/zentropy-import/2026-08-24-source-register.json")
RECEIPTS_DIR = Path("frontier-safety/data/receipts")
PACKET_NAME = "checker-packet.json"

MAX_FIRST_OBSERVATIONS_PER_EDITION = 3
PLACEHOLDER_REVIEWERS = {
    "", "pending", "todo", "tbd", "reviewer", "unknown", "none", "null", "n/a", "na", "anon",
    "anonymous", "x", "test", "dry run",
}
SHA256 = re.compile(r"[0-9a-f]{64}")
DATE = re.compile(r"\d{4}-\d{2}-\d{2}")


class ReceiptError(ValueError):
    """Raised when an edition's first-observation evidence breaks the contract."""


def canonical_sha256(payload: object) -> str:
    """Hash parsed JSON so line endings and indentation cannot change the digest."""
    data = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _utc(value: object, context: str) -> datetime:
    if not isinstance(value, str) or not value.endswith("Z"):
        raise ReceiptError(f"{context} must be a UTC timestamp ending in Z")
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ReceiptError(f"{context} is not an ISO timestamp") from exc


def same_url(left: str, right: str) -> bool:
    return left.rstrip("/") == right.rstrip("/")


def edition_items(edition: dict) -> dict[str, tuple[str, dict]]:
    items: dict[str, tuple[str, dict]] = {}
    for lane in edition["lanes"]:
        for item in lane["items"]:
            if item["id"] in items:
                raise ReceiptError(f"duplicate item id: {item['id']}")
            items[item["id"]] = (lane["id"], item)
    return items


def _check_shape(receipt: dict, context: str) -> None:
    if receipt.get("schema_version") != 1 or receipt.get("kind") != "first-observation":
        raise ReceiptError(f"{context} must be a schema 1 first-observation receipt")
    for key in ("source_id", "url", "fingerprint_profile", "lane", "does_not_prove"):
        if not isinstance(receipt.get(key), str) or not receipt[key].strip():
            raise ReceiptError(f"{context}.{key} must be non-empty text")
    for key in ("fingerprint_sha256", "checker_packet_sha256"):
        if not isinstance(receipt.get(key), str) or not SHA256.fullmatch(receipt[key]):
            raise ReceiptError(f"{context}.{key} must be a lowercase SHA-256")
    if not isinstance(receipt.get("edition_date"), str) or not DATE.fullmatch(receipt["edition_date"]):
        raise ReceiptError(f"{context}.edition_date must be YYYY-MM-DD")
    items = receipt.get("supports_item_ids")
    if not isinstance(items, list) or not items or not all(isinstance(i, str) and i for i in items):
        raise ReceiptError(f"{context}.supports_item_ids must list at least one item id")


def _check_review(receipt: dict, edition: dict, context: str) -> None:
    review = receipt.get("review")
    if not isinstance(review, dict) or review.get("status") != "reviewed":
        raise ReceiptError(f"{context}.review must be attested by a reviewer before publication")
    reviewer = review.get("reviewer")
    if (not isinstance(reviewer, str) or reviewer.strip().lower() in PLACEHOLDER_REVIEWERS
            or len(re.findall(r"[^\W\d_]", reviewer)) < 2):
        raise ReceiptError(f"{context}.review.reviewer must name the reviewer")
    if review.get("read_in_full") is not True or review.get("times_recorded") is not True:
        raise ReceiptError(f"{context}.review must attest a full read and separately recorded times")
    observed = _utc(receipt.get("checker_observed_at"), f"{context}.checker_observed_at")
    if _utc(review.get("reviewed_at"), f"{context}.review.reviewed_at") < observed:
        raise ReceiptError(f"{context}.review.reviewed_at precedes the observation it reviews")
    if receipt.get("checker_observed_at") != edition.get("observed_at"):
        raise ReceiptError(f"{context} must come from the edition's own observation run")


def _check_packet_binding(receipt: dict, packet: dict, context: str) -> None:
    if canonical_sha256(packet) != receipt["checker_packet_sha256"]:
        raise ReceiptError(f"{context} does not match the committed checker packet")
    if packet.get("observed_at") != receipt.get("checker_observed_at"):
        raise ReceiptError(f"{context}.checker_observed_at differs from the packet")
    if packet.get("error_source_ids"):
        raise ReceiptError(f"{context} rests on a checker run with fetch errors")
    observed = next((s for s in packet.get("sources", []) if s.get("id") == receipt["source_id"]), None)
    if observed is None or observed.get("status") != "unbaselined":
        raise ReceiptError(f"{context} source is not an unbaselined observation in the packet")
    if observed.get("sha256") != receipt["fingerprint_sha256"]:
        raise ReceiptError(f"{context} fingerprint differs from the packet observation")
    if not same_url(observed.get("url", ""), receipt["url"]):
        raise ReceiptError(f"{context} URL differs from the packet observation")


def _check_current_record(receipt: dict, registry: dict, state: dict, context: str) -> None:
    """Bindings to the live registry and baseline; enforced on the newest edition only."""
    source = next((s for s in registry["sources"] if s["id"] == receipt["source_id"]), None)
    if source is None or source.get("status") != "available":
        raise ReceiptError(f"{context} source must be registered with status available")
    if not same_url(source["url"], receipt["url"]) or source.get("fingerprint_profile") != receipt["fingerprint_profile"]:
        raise ReceiptError(f"{context} URL or fingerprint profile differs from the registry")
    if source.get("lane") != receipt["lane"]:
        raise ReceiptError(f"{context} lane differs from the registry")
    baseline = next((s for s in state.get("sources", []) if s.get("id") == receipt["source_id"]), {})
    if baseline.get("sha256") and baseline["sha256"] != receipt["fingerprint_sha256"]:
        raise ReceiptError(f"{context} source already has a different reviewed baseline; use the delta path")


def _check_items(receipt: dict, items: dict, context: str) -> None:
    for item_id in receipt["supports_item_ids"]:
        if item_id not in items:
            raise ReceiptError(f"{context} supports an item absent from the edition: {item_id}")
        lane_id, item = items[item_id]
        if item.get("status") != "changed":
            raise ReceiptError(f"{context} may support only changed items: {item_id}")
        if lane_id != receipt["lane"]:
            raise ReceiptError(f"{context} source lane differs from item lane: {item_id}")
        if not any(same_url(s["url"], receipt["url"]) for s in item.get("sources", [])):
            raise ReceiptError(f"{context} supported item does not cite the source: {item_id}")


def validate_receipts(edition, registry, state, receipts, packet, prior_receipt_ids=frozenset(), *, newest=True) -> None:
    """Check every first-observation receipt an edition carries.

    Immutable bindings are checked on every edition. Bindings to the live
    registry and baseline are checked only on the newest edition, so accepting
    a baseline or tuning a profile later does not invalidate published history.
    """
    if not receipts:
        return
    if edition.get("edition_state") != "changed":
        raise ReceiptError("first-observation receipts are allowed only on normal changed editions")
    if len(receipts) > MAX_FIRST_OBSERVATIONS_PER_EDITION:
        raise ReceiptError(f"an edition may carry at most {MAX_FIRST_OBSERVATIONS_PER_EDITION} first observations")
    if packet is None:
        raise ReceiptError("first-observation receipts require the committed checker packet")
    items, seen = edition_items(edition), set()
    for receipt in receipts:
        context = f"receipt[{receipt.get('source_id')}]"
        _check_shape(receipt, context)
        if receipt["source_id"] in seen or receipt["source_id"] in prior_receipt_ids:
            raise ReceiptError(f"{context} is not single-use")
        seen.add(receipt["source_id"])
        if receipt["edition_date"] != edition.get("edition_date"):
            raise ReceiptError(f"{context} belongs to a different edition")
        _check_packet_binding(receipt, packet, context)
        _check_review(receipt, edition, context)
        _check_items(receipt, items, context)
        if newest:
            _check_current_record(receipt, registry, state, context)


def draft_receipt(report: dict, source_id: str, edition_date: str, item_ids: list[str], registry: dict) -> dict:
    """Draft an unattested receipt from a checker report; a reviewer must attest it."""
    observed = next((s for s in report.get("sources", []) if s.get("id") == source_id), None)
    source = next((s for s in registry["sources"] if s["id"] == source_id), None)
    if observed is None or source is None or observed.get("status") != "unbaselined":
        raise ReceiptError(f"{source_id} is not a registered unbaselined observation in the report")
    return {
        "schema_version": 1, "kind": "first-observation", "edition_date": edition_date,
        "source_id": source_id, "url": source["url"], "lane": source["lane"],
        "fingerprint_profile": source["fingerprint_profile"],
        "checker_observed_at": report["observed_at"], "fingerprint_sha256": observed["sha256"],
        "normalized_characters": observed.get("normalized_characters"),
        "checker_packet_sha256": canonical_sha256(report),
        "review": {"status": "draft", "reviewer": None, "reviewed_at": None,
                   "read_in_full": False, "times_recorded": False},
        "supports_item_ids": item_ids,
        "does_not_prove": "A receipt shows that one checker run fingerprinted this page and a named reviewer "
        "attested reading it. It does not prove the page's claims, that the reviewer's attestation is "
        "authentic beyond git history, that the packet came from a real fetch, or that the page is "
        "unchanged after the observation.",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    check = sub.add_parser("validate", help="validate every committed edition, receipt and archive pin")
    check.add_argument("--root", type=Path, default=ROOT, help="repository root to validate")
    draft = sub.add_parser("draft", help="draft an unattested receipt and commit-ready packet")
    draft.add_argument("--report", type=Path, required=True)
    draft.add_argument("--source-id", required=True)
    draft.add_argument("--edition-date", required=True)
    draft.add_argument("--item", action="append", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "validate":
            sys.path.insert(0, str(Path(__file__).resolve().parent))
            import frontier_safety_coverage

            frontier_safety_coverage.validate_repository(args.root)
            print("First-observation and source-coverage contract satisfied for every committed edition.")
            return 0
        report = json.loads(args.report.read_text(encoding="utf-8"))
        registry = json.loads((ROOT / REGISTRY_PATH).read_text(encoding="utf-8"))
        receipt = draft_receipt(report, args.source_id, args.edition_date, args.item, registry)
        folder = ROOT / RECEIPTS_DIR / args.edition_date
        folder.mkdir(parents=True, exist_ok=True)
        for path, payload in ((folder / PACKET_NAME, report), (folder / f"{args.source_id}.json", receipt)):
            path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
        print(f"Drafted unattested receipt {folder / (args.source_id + '.json')}; a reviewer must attest it.")
        return 0
    except ValueError as exc:
        # Run as a script, this module is __main__ and the coverage module raises a second copy of
        # ReceiptError; both copies, and the checker's validators, raise ValueError subclasses.
        print(f"First-observation contract rejected: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
