#!/usr/bin/env python3
"""Assemble the artwork corpus inventory with receipts.

Matches original files (by SHA-256) against the published records:
the 17-work manifest on main, the 27-work manifest from the open
high-resolution coda PR, and the Gaussian Splat Lab pilots. Files whose
hashes match no record are listed as unpublished waves by mtime. The output
is art/spatial/corpus.json: one entry per distinct artwork, deduplicated by
hash, with identity, dimensions, provenance status, and the local source path.

Usage: python corpus_inventory.py --downloads DIR [--manifest27 PATH] [--out PATH]
"""
from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path

from PIL import Image

PATTERNS = ("10001192*.png", "10001194*.jpg", "10001189*.jpg", "10001169*.jpg",
            "crystal_city*.png", "ChatGPT Image*.png", "*.png")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--downloads", required=True)
    parser.add_argument("--manifest27", default=None,
                        help="path to the 27-work manifest JSON (from the coda PR branch)")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent / "corpus.json"))
    args = parser.parse_args()
    downloads = Path(args.downloads)
    root = Path(__file__).resolve().parents[2]

    known: dict[str, dict] = {}
    main17 = json.loads((root / "art" / "current-story" / "manifest.json").read_text(encoding="utf-8"))
    for img in main17["images"]:
        known[img["source_sha256"]] = {
            "identity": f"current-story-{img['sequence']:02d}",
            "status": "published_17",
            "sequence": img["sequence"],
            "alt": img.get("alt", ""),
        }
    if args.manifest27:
        m27 = json.loads(Path(args.manifest27).read_text(encoding="utf-8"))
        for img in m27["images"]:
            entry = known.setdefault(img["source_sha256"], {})
            entry.update({
                "identity": f"current-story-{img['sequence']:02d}",
                "status": entry.get("status", "pr79_pending"),
                "sequence": img["sequence"],
                "alt": img.get("alt", ""),
            })
    lab = json.loads((root / "art" / "gaussian-splats" / "manifest.json").read_text(encoding="utf-8"))
    for src in lab["sources"]:
        if src["sha256"] in known:
            known[src["sha256"]]["splat_pilot"] = src["id"]

    seen: dict[str, dict] = {}
    candidates: list[Path] = []
    for pattern in PATTERNS:
        candidates.extend(downloads.glob(pattern))
    for path in sorted(set(candidates)):
        if not path.is_file():
            continue
        digest = sha256(path)
        if digest in seen:
            continue
        try:
            with Image.open(path) as im:
                width, height = im.size
        except Exception:
            continue
        record = known.get(digest)
        mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
        entry = {
            "sha256": digest,
            "file": path.name,
            "bytes": path.stat().st_size,
            "dimensions": {"width": width, "height": height},
            "mtime_utc": mtime.strftime("%Y-%m-%d"),
        }
        if record:
            entry.update(record)
        elif path.name.startswith("10001194"):
            entry.update({"identity": f"wave3-{path.stem}", "status": "unpublished_wave3"})
        elif path.name.startswith("crystal_city"):
            entry.update({"identity": "crystal-city", "status": "spatial_directed"})
        else:
            entry.update({"identity": path.stem, "status": "candidate"})
        seen[digest] = entry

    matched = [e for e in seen.values() if e["status"] != "candidate"]
    candidates_only = [e for e in seen.values() if e["status"] == "candidate"]
    corpus = {
        "schema": "zentropy.artwork-corpus/v1",
        "assembled": "2026-08-03",
        "note": (
            "Deduplicated by SHA-256. published_17 is live on main; pr79_pending is "
            "recorded in the open high-resolution coda PR; unpublished_wave3 is the "
            "2026-07-27 batch with no public record yet; candidates matched a filename "
            "pattern but no record and need the operator's confirmation before use."
        ),
        "works": sorted(matched, key=lambda e: (e["status"], e.get("sequence", 99), e["file"])),
        "unmatched_candidates": len(candidates_only),
    }
    Path(args.out).write_text(json.dumps(corpus, indent=2) + "\n", encoding="utf-8")
    by_status: dict[str, int] = {}
    for e in matched:
        by_status[e["status"]] = by_status.get(e["status"], 0) + 1
    print(f"works: {len(matched)}  candidates: {len(candidates_only)}")
    for status, count in sorted(by_status.items()):
        print(f"  {status}: {count}")


if __name__ == "__main__":
    main()
