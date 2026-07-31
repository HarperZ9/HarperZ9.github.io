#!/usr/bin/env python3
"""Validate the file-level receipt for a Gaussian Splat Lab output.

This helper proves only that a non-empty .spz file exists and reports its
byte length and SHA-256 digest. It does not prove that the scene has useful
parallax, correct occlusion, or faithful geometry; those remain separate
visual review requirements recorded in the run observations.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("scene", type=Path, help="Path to the generated .spz file")
    parser.add_argument("--pilot", required=True, help="Pilot id from manifest.json")
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path(__file__).with_name("manifest.json"),
        help="Path to the lab manifest",
    )
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    pilots = {item["id"]: item for item in manifest["sources"]}
    if args.pilot not in pilots:
        parser.error(f"unknown pilot id: {args.pilot}")

    if args.scene.suffix.lower() != ".spz":
        parser.error("scene must use the .spz extension")
    if not args.scene.is_file():
        parser.error(f"scene does not exist: {args.scene}")
    if args.scene.stat().st_size <= 0:
        parser.error("scene is empty")

    receipt = {
        "status": "FILE_RECEIPT_ONLY",
        "pilot": args.pilot,
        "source_sha256": pilots[args.pilot]["sha256"],
        "scene_path": str(args.scene),
        "scene_bytes": args.scene.stat().st_size,
        "scene_sha256": sha256(args.scene),
        "visual_review_required": [
            "meaningful camera-dependent parallax",
            "depth-dependent occlusion or changing spatial relation",
            "source shown beside scene",
            "inferred geometry and visible failures disclosed",
        ],
    }
    print(json.dumps(receipt, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
