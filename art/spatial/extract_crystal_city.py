#!/usr/bin/env python3
"""Extract the Crystal City hybrid scene from the v1.3 standalone proof and
repackage it as a certified world package for the site's spatial engine.

The standalone (Crystal_City_Hybrid_Proof_v1.3_Standalone.html, produced by the
ZentropyLabs spatial session) embeds every asset as base64 inside
window.__CRYSTAL_INLINE_ASSETS__. This script decodes those exact bytes and
writes the site-servable package:

  crystal-city/source.png          canonical 1024x1280 RGB, lossless
  crystal-city/support.jpg         invented disocclusion fill (derived, q95)
  crystal-city/backdrop.jpg        authored coverage backdrop (derived, q95)
  crystal-city/atmosphere.jpg      atmosphere color field (derived, q95)
  crystal-city/fields.png          512x(640*20) grayscale atlas:
                                   9 masks + 10 depths + 1 confidence
  crystal-city/splats.bin          18,500 forty-byte selective splat records,
                                   byte-identical to the standalone
  crystal-city/crystal-city.world.json   manifest with SHA-256 receipts

The canonical source stays lossless. The derived rasters (support, backdrop,
atmosphere) may be JPEG: they are invented or blurred material by construction
and their manifest receipts hash the files actually served.

Usage: python extract_crystal_city.py <path-to-standalone.html> [--out DIR]
"""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import re
import struct
from pathlib import Path

from PIL import Image

WIDTH, HEIGHT = 1024, 1280
MASK_W, MASK_H = 512, 640
LAYERS = ["deep_sky", "haze", "celestials", "portal", "city", "membrane", "beam", "water", "witness"]
COLOR_ORDER = ["deep_sky", "haze", "portal", "city", "celestials", "membrane", "beam", "water", "witness"]
STRUCTURAL = ["portal", "city", "celestials", "membrane", "water", "witness"]
FIELD_ORDER = [f"mask/{n}" for n in LAYERS] + [f"depth/{n}" for n in LAYERS + ["support"]] + ["confidence"]
MARKER = "window.__CRYSTAL_INLINE_ASSETS__="


def load_assets(standalone: Path) -> dict[str, bytes]:
    text = standalone.read_text(encoding="utf-8", errors="strict")
    start = text.index(MARKER) + len(MARKER)
    payload, _ = json.JSONDecoder().raw_decode(text, start)
    return {name: base64.b64decode(data) for name, data in payload.items()}


def rgb_image(raw: bytes) -> Image.Image:
    assert len(raw) == WIDTH * HEIGHT * 3, f"RGB byte mismatch {len(raw)}"
    return Image.frombytes("RGB", (WIDTH, HEIGHT), raw)


def luma(raw: bytes) -> bytes:
    assert len(raw) == MASK_W * MASK_H, f"luma byte mismatch {len(raw)}"
    return raw


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("standalone", help="path to Crystal_City_Hybrid_Proof_v1.3_Standalone.html")
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent / "crystal-city"))
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    assets = load_assets(Path(args.standalone))
    source_raw = assets["assets/source.rgb"]

    rgb_image(source_raw).save(out / "source.png", optimize=True)
    rgb_image(assets["assets/support.rgb"]).save(out / "support.jpg", quality=95)
    rgb_image(assets["assets/backdrop.rgb"]).save(out / "backdrop.jpg", quality=95)
    rgb_image(assets["assets/atmosphere.rgb"]).save(out / "atmosphere.jpg", quality=95)

    atlas = Image.new("L", (MASK_W, MASK_H * len(FIELD_ORDER)))
    for i, field in enumerate(FIELD_ORDER):
        if field == "confidence":
            raw = luma(assets["assets/support-confidence.r8"])
        elif field.startswith("mask/"):
            raw = luma(assets[f"assets/masks/{field.split('/')[1]}.r8"])
        else:
            raw = luma(assets[f"assets/depth/{field.split('/')[1]}.r8"])
        atlas.paste(Image.frombytes("L", (MASK_W, MASK_H), raw), (0, i * MASK_H))
    atlas.save(out / "fields.png", optimize=True)

    splats = assets["assets/selective-splats.f32"]
    assert len(splats) % 40 == 0, "splat block is torn"
    for offset in range(0, min(len(splats), 40 * 200), 40):
        struct.unpack_from("<10f", splats, offset)
    (out / "splats.bin").write_bytes(splats)

    def sha(path: Path) -> str:
        return hashlib.sha256(path.read_bytes()).hexdigest()

    manifest = {
        "schema": "zentropy.world-package/v1",
        "lane": "reconstruction",
        "mode": "textured-hybrid",
        "title": "Crystal City of Light and Wonder",
        "seed": "crystal_city_of_light_and_wonder.png",
        "published": "2026-08-03",
        "disclosure": (
            "A generated spatial interpretation of one canonical 2D artwork, not a "
            "scan or measured reconstruction. Semantic depth meshes carry the "
            "composition; Gaussian primitives carry only atmosphere, beam energy, "
            "water, sparks, bokeh, and glints. Newly exposed regions use a "
            "deterministic support fill that is invented material and is labeled "
            "as such. Extracted byte-exact from Crystal City Hybrid Proof v1.3."
        ),
        "source_receipt": {
            "artwork": "crystal_city_of_light_and_wonder.png",
            "embedded_rgb_sha256": hashlib.sha256(source_raw).hexdigest(),
            "dimensions": {"width": WIDTH, "height": HEIGHT},
        },
        "camera": {"maxX": 0.045, "maxY": 0.030, "maxDolly": 0.12},
        "layers": [
            {"name": name, "depth": round(index / (len(COLOR_ORDER) - 1), 3)}
            for index, name in enumerate(reversed(COLOR_ORDER))
        ],
        "textured": {
            "width": WIDTH, "height": HEIGHT,
            "mask_width": MASK_W, "mask_height": MASK_H,
            "color_order": COLOR_ORDER,
            "structural": STRUCTURAL,
            "field_order": FIELD_ORDER,
            "rasters": {
                "source": "source.png",
                "support": "support.jpg",
                "backdrop": "backdrop.jpg",
                "atmosphere": "atmosphere.jpg",
                "fields": "fields.png",
            },
            "defaults": {
                "parallax": 0.70, "skyCurve": 0.24, "atmosphereDensity": 0.88,
                "hazeOpacity": 0.34, "atmosphereFlow": 0.28, "bokehScale": 1.05,
                "beamFlow": 0.36, "glow": 0.52, "waterFlow": 0.20,
            },
            "water_horizon": 0.61,
        },
        "splats": {
            "count": len(splats) // 40,
            "kinds": ["dust", "beam", "water", "stars", "spark", "bokeh", "haze", "glint"],
            "kind_semantics": {
                "0": "city glints", "1": "beam energy", "2": "water", "3": "deep-sky volume",
                "4": "structural sparks (membrane, witness)", "5": "bokeh", "6": "haze dust",
                "7": "celestial glints",
            },
            "record_bytes": 40,
            "sidecar": "splats.bin",
        },
        "provenance": {
            "session": "ZentropyLabs spatial session, Crystal City Hybrid Proof v1.0 to v1.3",
            "standalone": "Crystal_City_Hybrid_Proof_v1.3_Standalone.html",
            "extractor": "art/spatial/extract_crystal_city.py",
        },
        "receipts": {
            "source.png": sha(out / "source.png"),
            "support.jpg": sha(out / "support.jpg"),
            "backdrop.jpg": sha(out / "backdrop.jpg"),
            "atmosphere.jpg": sha(out / "atmosphere.jpg"),
            "fields.png": sha(out / "fields.png"),
            "splats.bin": sha(out / "splats.bin"),
        },
    }
    (out / "crystal-city.world.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8",
    )
    total = sum((out / n).stat().st_size for n in
                ["source.png", "support.jpg", "backdrop.jpg", "atmosphere.jpg", "fields.png", "splats.bin"])
    print(f"{manifest['splats']['count']} splats, package {total/1e6:.2f} MB")
    for name, digest in manifest["receipts"].items():
        print(f"  {name}: {(out / name).stat().st_size:>9} bytes  {digest[:16]}…")


if __name__ == "__main__":
    main()
