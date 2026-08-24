#!/usr/bin/env python3
"""Fetch curated Frontier Safety sources and compare normalized fingerprints."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from html import unescape
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


USER_AGENT = "ZentropyLabs-Frontier-Safety-Briefing/1.0 (+https://harperz9.github.io/frontier-safety.html)"
MAX_BYTES = 3_000_000


def normalize_html(raw: bytes) -> str:
    text = raw.decode("utf-8", errors="replace")
    text = re.sub(r"<script\b[^>]*>.*?</script>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<style\b[^>]*>.*?</style>", " ", text, flags=re.I | re.S)
    text = re.sub(r"<!--.*?-->", " ", text, flags=re.S)
    text = re.sub(r"<[^>]+>", " ", text)
    text = unescape(text)
    return re.sub(r"\s+", " ", text).strip()


def fetch(url: str, timeout: float) -> dict:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    with urlopen(request, timeout=timeout) as response:
        raw = response.read(MAX_BYTES + 1)
        if len(raw) > MAX_BYTES:
            raise ValueError(f"response exceeded {MAX_BYTES} bytes")
        normalized = normalize_html(raw)
        return {
            "url": response.geturl(),
            "sha256": hashlib.sha256(normalized.encode("utf-8")).hexdigest(),
            "normalized_characters": len(normalized),
            "etag": response.headers.get("ETag"),
            "last_modified": response.headers.get("Last-Modified"),
        }


def check(registry_path: Path, state_path: Path | None, timeout: float) -> dict:
    registry = json.loads(registry_path.read_text(encoding="utf-8"))
    prior = {item["id"]: item for item in json.loads(state_path.read_text(encoding="utf-8")).get("sources", [])} if state_path and state_path.exists() else {}
    observed_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
    results = []
    cache: dict[str, dict] = {}
    for source in registry["sources"]:
        if source["status"] == "pending":
            results.append({"id": source["id"], "url": source["url"], "status": "pending", "changed": False})
            continue
        try:
            fetched = cache.get(source["url"])
            if fetched is None:
                fetched = fetch(source["url"], timeout)
                cache[source["url"]] = fetched
            previous = prior.get(source["id"], {})
            results.append({
                "id": source["id"],
                "status": "available",
                "changed": bool(previous.get("sha256") and previous["sha256"] != fetched["sha256"]),
                **fetched,
            })
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            results.append({
                "id": source["id"],
                "url": source["url"],
                "status": "fetch_error",
                "changed": False,
                "error": f"{type(exc).__name__}: {exc}",
            })
    return {
        "schema_version": 1,
        "observed_at": observed_at,
        "sources": results,
        "changed_source_ids": [item["id"] for item in results if item.get("changed")],
        "error_source_ids": [item["id"] for item in results if item["status"] == "fetch_error"],
    }


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--registry", type=Path, required=True)
    parser.add_argument("--state", type=Path)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--write-state", action="store_true")
    parser.add_argument("--timeout", type=float, default=20.0)
    parser.add_argument("--fail-on-error", action="store_true")
    args = parser.parse_args()
    report = check(args.registry, args.state, args.timeout)
    write_json(args.report, report)
    if args.write_state and args.state:
        write_json(args.state, report)
    print(json.dumps({
        "changed": len(report["changed_source_ids"]),
        "errors": len(report["error_source_ids"]),
        "report": str(args.report),
    }, sort_keys=True))
    return 2 if args.fail_on_error and report["error_source_ids"] else 0


if __name__ == "__main__":
    sys.exit(main())
