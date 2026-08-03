#!/usr/bin/env python3
"""Extract the 27-scene Native Gaussian Splat Atlas (v0.5.0) into site-servable
per-scene packages.

The Atlas standalone embeds everything in globalThis.__SPLAT_ATLAS_INLINE__:
a manifest (27 scenes, NGSF v5 models, scene-family profiles, per-scene
receipts and held-out PSNR numbers) plus base64 assets. This script decodes
the exact bytes, verifies each model against its manifest SHA-256 BEFORE
writing, and emits:

  atlas/scene-NN.ngsf         quantized Gaussian model (NGS5, 32-byte records)
  atlas/scene-NN.jpg          canonical source preview
  atlas/scene-NN.receipt.json the session's own training receipt
  atlas/atlas.world.json      one manifest: scenes, receipts, claim boundary

Usage: python extract_atlas.py <path-to-Atlas-standalone.html> [--out DIR]
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
from pathlib import Path

MARKER = "globalThis.__SPLAT_ATLAS_INLINE__="


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("standalone")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent / "atlas"))
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    text = Path(args.standalone).read_text(encoding="utf-8", errors="strict")
    start = text.index(MARKER) + len(MARKER)
    payload, _ = json.JSONDecoder().raw_decode(text, start)
    manifest = payload["manifest"]
    assets = {**payload.get("binary", {}), **payload.get("images", {}), **payload.get("json", {})}

    def bytes_of(path: str) -> bytes:
        value = assets[path]
        if isinstance(value, str):
            return base64.b64decode(value)
        if isinstance(value, dict) and "base64" in value:
            return base64.b64decode(value["base64"])
        if isinstance(value, dict):
            # Receipt JSON stored as a plain object: canonical re-serialization.
            return (json.dumps(value, indent=2) + "\n").encode("utf-8")
        raise SystemExit(f"{path}: unexpected asset encoding {type(value).__name__}")

    scenes_out = []
    receipts: dict[str, str] = {}
    for scene in manifest["scenes"]:
        sid = scene["id"]
        model = bytes_of(scene["model"])
        actual = hashlib.sha256(model).hexdigest()
        if actual != scene["model_sha256"]:
            raise SystemExit(f"{sid}: embedded model does not match its manifest hash; refusing")
        if model[:4] != b"NGS5":
            raise SystemExit(f"{sid}: bad NGSF magic")
        (out / f"{sid}.ngsf").write_bytes(model)
        receipts[f"{sid}.ngsf"] = actual

        preview = bytes_of(scene["source_preview"])
        pactual = hashlib.sha256(preview).hexdigest()
        if pactual != scene["source_preview_sha256"]:
            raise SystemExit(f"{sid}: source preview does not match its manifest hash; refusing")
        (out / f"{sid}.jpg").write_bytes(preview)
        receipts[f"{sid}.jpg"] = pactual

        receipt_path = scene.get("receipt")
        if receipt_path and receipt_path in assets:
            rbytes = bytes_of(receipt_path)
            (out / f"{sid}.receipt.json").write_bytes(rbytes)
            receipts[f"{sid}.receipt.json"] = hashlib.sha256(rbytes).hexdigest()

        scenes_out.append({
            "id": sid,
            "sequence": scene.get("sequence"),
            "movement": scene.get("movement"),
            "title": scene["title"],
            "alt": scene.get("alt", ""),
            "profile": scene.get("profile"),
            "canonical_source_filename": scene.get("canonical_source_filename"),
            "canonical_source_sha256": scene.get("canonical_source_sha256"),
            "canonical_source_dimensions": scene.get("canonical_source_dimensions"),
            "model": f"{sid}.ngsf",
            "model_bytes": len(model),
            "gaussian_count": scene.get("gaussian_count"),
            "training_views": scene.get("training_views"),
            "held_out_views": scene.get("held_out_views"),
            "mean_psnr_before": scene.get("mean_psnr_before"),
            "mean_psnr_after": scene.get("mean_psnr_after"),
            "source_preview": f"{sid}.jpg",
        })

    world = {
        "schema": "zentropy.world-package/v1",
        "lane": "reconstruction",
        "mode": "ngsf-atlas",
        "title": "The Spatial Atlas",
        "seed": "atlas-v0.5.0-twenty-seven-virtual-angle-fields",
        "published": "2026-08-03",
        "disclosure": (
            "Twenty-seven virtual-angle-trained spatial interpretations, one per "
            "canonical artwork. Each scene is a generated interpretation of one 2D "
            "image, not a scan, recovered 360-degree world, photogrammetric "
            "reconstruction, or independent multi-view observation. The session's "
            "later hybrid review judged the all-splat representation weaker than "
            "the source at the canonical view; these are served as spatial "
            "studies beside their sources, with that critique disclosed. "
            "Extracted byte-exact from Native Gaussian Splat Atlas v0.5.0."
        ),
        "camera": {"maxX": 1.0, "maxY": 0.72, "maxDolly": 1.0},
        "camera_note": "orbit camera: maxX/maxY are yaw/pitch radians x orbit limit, maxDolly is normalized zoom range",
        "layers": [
            {"name": "primary_surface", "depth": 0.5},
            {"name": "disocclusion_shell", "depth": 0.6},
            {"name": "edge_continuation", "depth": 0.7},
            {"name": "highlight_microstructure", "depth": 0.4},
        ],
        "splats": {
            "count": sum(s["gaussian_count"] or 0 for s in scenes_out),
            "kinds": ["glint"],
            "note": "NGSF v5 32-byte records per scene; kinds do not apply, layers do",
            "record_bytes": 32,
            "sidecar": scenes_out[0]["model"],
        },
        "model_format": manifest.get("model_format"),
        "atlas_status": manifest.get("status"),
        "claim_boundary": manifest.get("claim_boundary"),
        "scenes": scenes_out,
        "provenance": {
            "session": "ZentropyLabs spatial session, Native Gaussian Splat Atlas v0.5.0",
            "standalone": Path(args.standalone).name,
            "extractor": "art/spatial/extract_atlas.py",
        },
        "receipts": receipts,
    }
    (out / "atlas.world.json").write_text(json.dumps(world, indent=2) + "\n", encoding="utf-8")
    total = sum((out / n).stat().st_size for n in receipts)
    print(f"{len(scenes_out)} scenes, {len(receipts)} files, {total/1e6:.1f} MB")
    print(f"gaussians total: {world['splats']['count']:,}")


if __name__ == "__main__":
    main()
