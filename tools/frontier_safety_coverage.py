"""Repository-wide rules for the Frontier Safety record.

These rules hold the committed editions together: an edition chain derived
from the files (never trusted from an edition's own fields), a frozen archive
of editions published before the contract, integrity against history.json, and
source coverage so no edition from the effective date on cites a source outside
the reviewed record. Receipt rules live in frontier_safety_receipts.py.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import check_frontier_safety_sources as checker  # noqa: E402
from frontier_safety_receipts import (  # noqa: E402
    DATE, PACKET_NAME, RECEIPTS_DIR, REGISTRY_PATH, SHA256, ReceiptError, canonical_sha256,
    edition_items, same_url, validate_receipts,
)

EDITIONS_DIR = Path("frontier-safety/data/editions")
STATE_PATH = Path("frontier-safety/data/source-state.json")
HISTORY_PATH = Path("frontier-safety/data/history.json")
CONTRACT_EFFECTIVE_EDITION_DATE = "2026-09-24"
SELF_ROUTE_HOSTS = {"harperz9.github.io"}
SELF_ROUTE_ROLE = "publication notice"
# Unregistered citations already published before the contract. Each is allowed only on its own
# item and only while that item is carried forward unchanged; rewording the item needs the source
# registered and baselined, or dropped.
GRANDFATHERED_CITATIONS = {
    ("anthropic-2026-08-14-risk-report", "https://www.anthropic.com/responsible-scaling-policy"),
}
# Canonical digests of every edition published before the contract, equal to history.json at 14ee035.
PINNED_ARCHIVE = {
    "2026-08-24": "c8ca79052d804290c7143e014fbdba03a89263d3babbc5e248f73d0359054fa4",
    "2026-08-25": "0034b2bcf37697e96bee6c271057b15820c23ef4f8f52746bd630b933f07fe2d",
    "2026-08-27": "f587cc7c074b5dcf93b5bbcf03a525cec69b9c29b0524b45b1548a5624374b3e",
    "2026-09-09": "3a1be40374f220802c3c9ea5274b97114841d20e5eaf3844b8c21558289ed14e",
    "2026-09-16": "9d77d2eac4059f6e0b0bbada716b438510344d67ecc338cfb8c1f2aa8402eba1",
    "2026-09-23": "1567981150b0acc5ccf330b95b01b624ee44653756733d490e5096450284c90a",
}


def _host(url: str) -> str:
    return re.sub(r"^https://([^/]+).*$", r"\1", url)


def edition_digest(edition: dict) -> str:
    """The builder's edition_sha256: canonical JSON without the digest field itself."""
    return canonical_sha256({k: v for k, v in edition.items() if k != "edition_sha256"})


def baselined_urls(registry: dict, state: dict) -> set[str]:
    """Registered URLs whose reviewed baseline has a valid hash and the registry's own URL."""
    urls = {}
    for source in registry["sources"]:
        urls[source["id"]] = source["url"]
    covered = set()
    for entry in state.get("sources", []):
        url = urls.get(entry.get("id"))
        sha = entry.get("sha256")
        if url and isinstance(sha, str) and SHA256.fullmatch(sha) and same_url(entry.get("url", ""), url):
            covered.add(url.rstrip("/"))
    return covered


def check_chain(editions: dict[str, dict]) -> None:
    """Each edition names its real predecessor: the greatest earlier committed edition."""
    dates = sorted(editions)
    for index, date in enumerate(dates):
        edition = editions[date]
        if not DATE.fullmatch(date) or edition.get("edition_date") != date:
            raise ReceiptError(f"edition file {date}.json must carry edition_date {date}")
        expected = dates[index - 1] if index else None
        if edition.get("previous_edition") != expected:
            raise ReceiptError(f"edition {date} must name {expected} as previous_edition")


def check_archive(editions: dict[str, dict], history: dict) -> None:
    """Editions before the contract are frozen; every published edition matches history.json."""
    earlier = {d for d in editions if d < CONTRACT_EFFECTIVE_EDITION_DATE}
    if earlier != set(PINNED_ARCHIVE):
        raise ReceiptError("editions before the effective date must be exactly the pinned archive")
    for date in earlier:
        if edition_digest(editions[date]) != PINNED_ARCHIVE[date]:
            raise ReceiptError(f"pinned archive edition {date} was modified")
    newest = max(editions)
    recorded = {entry["date"]: entry["sha256"] for entry in history.get("editions", [])}
    for date, edition in editions.items():
        if date not in recorded and date != newest:
            raise ReceiptError(f"edition {date} is committed but absent from history.json")
        if date in recorded and recorded[date] != edition_digest(edition):
            raise ReceiptError(f"edition {date} differs from its history.json digest")
    missing = set(recorded) - set(editions)
    if missing:
        raise ReceiptError(f"history.json lists editions with no committed file: {sorted(missing)}")


def validate_source_coverage(edition, registry, state, receipts, previous) -> None:
    """No item or control may cite a source outside the reviewed record."""
    covered = baselined_urls(registry, state)
    receipted = {(r["url"].rstrip("/"), item_id) for r in receipts for item_id in r["supports_item_ids"]}
    grandfathered = {(item_id, url.rstrip("/")) for item_id, url in GRANDFATHERED_CITATIONS}
    prior = edition_items(previous) if previous else {}
    for item_id, (_, item) in edition_items(edition).items():
        unchanged = item.get("status") == "unchanged"
        if unchanged:
            earlier = prior.get(item_id, (None, None))[1]
            if earlier is None or {k: v for k, v in item.items() if k != "status"} != {
                k: v for k, v in earlier.items() if k != "status"
            }:
                raise ReceiptError(f"item[{item_id}] is marked unchanged but differs from the previous edition")
        for source in item.get("sources", []):
            url = source["url"].rstrip("/")
            self_route = _host(url) in SELF_ROUTE_HOSTS and item.get("source_role") == SELF_ROUTE_ROLE
            carried = unchanged and (item_id, url) in grandfathered
            if url not in covered and (url, item_id) not in receipted and not self_route and not carried:
                raise ReceiptError(f"item[{item_id}] cites a source outside the reviewed record: {url}")
    allowed = covered | {url for url, _ in receipted}
    for index, control in enumerate(edition.get("controls", [])):
        for url in control.get("sources", []):
            if not isinstance(url, str) or url.rstrip("/") not in allowed:
                raise ReceiptError(f"controls[{index}] cites a source outside the reviewed record: {url}")


def _read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _receipt_folders(root: Path) -> dict[str, tuple[list[dict], dict | None]]:
    folders = {}
    base = root / RECEIPTS_DIR
    for folder in sorted(base.glob("*")) if base.is_dir() else []:
        receipts = []
        for path in sorted(folder.glob("*.json")):
            if path.name == PACKET_NAME:
                continue
            receipt = _read(path)
            if receipt.get("source_id") != path.stem:
                raise ReceiptError(f"receipt file {path.name} must be named for its source_id")
            receipts.append(receipt)
        packet_path = folder / PACKET_NAME
        folders[folder.name] = (receipts, _read(packet_path) if packet_path.exists() else None)
    return folders


def validate_repository(root: Path) -> None:
    """Validate the whole committed record: chain, archive, receipts and coverage."""
    editions = {path.stem: _read(path) for path in sorted((root / EDITIONS_DIR).glob("*.json"))}
    if not editions:
        raise ReceiptError("expected committed editions")
    registry = checker.validate_registry(_read(root / REGISTRY_PATH))
    state = checker.validate_state(_read(root / STATE_PATH))
    check_chain(editions)
    check_archive(editions, _read(root / HISTORY_PATH))
    folders = _receipt_folders(root)
    post = [d for d in sorted(editions) if d >= CONTRACT_EFFECTIVE_EDITION_DATE]
    stray = set(folders) - set(post)
    if stray:
        raise ReceiptError(f"receipts exist for dates that are not post-effective editions: {sorted(stray)}")
    newest = max(editions)
    for date in post:
        receipts, packet = folders.get(date, ([], None))
        prior = {r["source_id"] for other, (rs, _) in folders.items() if other != date for r in rs}
        validate_receipts(editions[date], registry, state, receipts, packet, prior, newest=date == newest)
        validate_source_coverage(editions[date], registry, state, receipts, editions.get(editions[date]["previous_edition"]))
