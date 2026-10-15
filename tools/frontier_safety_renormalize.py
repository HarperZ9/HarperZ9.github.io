#!/usr/bin/env python3
"""Move stored HTML source baselines to the link-target normalizer, one source at a time.

A baseline moves only when the live page's text-only fingerprint still equals the stored
one, so the reviewed words are unchanged. The new record keeps the old value in
renormalized_from_sha256. Link targets were never recorded before, so the new link part is
a first observation, not a reviewed fact. Sources whose words changed stay as they are and
go through the normal review path.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

sys.path.insert(0, str(Path(__file__).resolve().parent))
import check_frontier_safety_sources as checker  # noqa: E402


def fetch_raw(url: str, timeout: float) -> tuple[bytes, dict]:
    request = Request(url, headers={"User-Agent": checker.USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(request, timeout=timeout) as response:
        raw = response.read(checker.MAX_BYTES + 1)
        if len(raw) > checker.MAX_BYTES:
            raise ValueError(f"response exceeded {checker.MAX_BYTES} bytes")
        headers = {"etag": response.headers.get("ETag"), "last_modified": response.headers.get("Last-Modified")}
    return raw, headers


def _move(record: dict, current: str, headers: dict, now: str) -> dict:
    moved = dict(record)
    moved.update({
        "sha256": hashlib.sha256(current.encode("utf-8")).hexdigest(),
        "normalized_characters": len(current),
        "normalizer": checker.HTML_NORMALIZER,
        "renormalized_from_sha256": record["sha256"],
        "renormalized_at": now,
        **headers,
    })
    return moved


def renormalize(registry: dict, state: dict, fetch=fetch_raw, timeout: float = 20.0,
                now: str | None = None) -> tuple[dict, list[dict]]:
    now = now or datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    by_id = {item["id"]: item for item in registry["sources"]}
    outcomes: list[dict] = []
    sources: list[dict] = []
    for record in state["sources"]:
        source = by_id.get(record["id"], {})
        profile = source.get("fingerprint_profile")
        if (profile not in checker.HTML_FINGERPRINT_PROFILES or record.get("status") != "available"
                or record.get("normalizer") == checker.HTML_NORMALIZER):
            sources.append(record)
            continue
        url = source.get("fingerprint_url", source.get("url", record["url"]))
        try:
            raw, headers = fetch(url, timeout)
            legacy = checker.normalize_html(raw, profile=profile, link_targets=False)
            current = checker.normalize_html(raw, profile=profile)
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            outcomes.append({"id": record["id"], "outcome": "fetch_error", "error": f"{type(exc).__name__}: {exc}"})
            sources.append(record)
            continue
        legacy_sha = hashlib.sha256(legacy.encode("utf-8")).hexdigest()
        if legacy_sha != record["sha256"]:
            outcomes.append({"id": record["id"], "outcome": "words_changed",
                             "stored": record["sha256"], "live_text_only": legacy_sha})
            sources.append(record)
            continue
        moved = _move(record, current, headers, now)
        outcomes.append({"id": record["id"], "outcome": "renormalized", "from": record["sha256"], "to": moved["sha256"]})
        sources.append(moved)
    updated = dict(state)
    updated["sources"] = sources
    return updated, outcomes


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--state", type=Path, required=True)
    parser.add_argument("--timeout", type=float, default=20.0)
    args = parser.parse_args()
    registry = checker.validate_registry(json.loads(args.registry.read_text(encoding="utf-8")))
    state = checker.validate_state(json.loads(args.state.read_text(encoding="utf-8")))
    updated, outcomes = renormalize(registry, state, timeout=args.timeout)
    checker.validate_state(updated)
    checker.write_state_json(args.state, updated)
    print(json.dumps(outcomes, indent=2))
    return 0 if all(o["outcome"] == "renormalized" for o in outcomes) else 1


if __name__ == "__main__":
    sys.exit(main())
