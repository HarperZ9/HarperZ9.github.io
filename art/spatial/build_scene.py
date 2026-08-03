#!/usr/bin/env python3
"""Deterministic builder for the authored world package "Folded light, inhabited".

Stdlib only. One seed drives everything; running this twice produces identical
bytes, so the committed sidecar and manifest are re-checkable by anyone.

The PRNG mirrors system/spatial-core.js (FNV-1a 32 seed hash + mulberry32)
bit for bit: the browser derives the veil layer fields from the same seed at
runtime, so the committed splat block and the live layers agree on one scene.

Usage: python build_scene.py [--out DIR]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

SEED = "folded-light-inhabited"
TITLE = "Folded light, inhabited"
SCHEMA = "zentropy.world-package/v1"

# Record layout shared with system/engine/world-package.js: ten float32s.
KIND_IDS = {"dust": 0, "beam": 1, "water": 2, "stars": 3, "spark": 4, "bokeh": 5}


def seed_hash(seed: str) -> int:
    h = 0x811C9DC5
    for ch in seed:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def mulberry32(state: int):
    a = state & 0xFFFFFFFF

    def next_float() -> float:
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t = (t ^ ((t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_float


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def beam_point(t: float, fold: float) -> tuple[float, float]:
    """The folded diagonal column: lower left to upper right with a sine fold."""
    x = lerp(-0.78, 0.66, t) + 0.10 * math.sin(t * math.tau * fold)
    y = lerp(-0.62, 0.84, t) + 0.05 * math.sin(t * math.tau * (fold * 0.5) + 1.3)
    return x, y


def build_records(rand) -> list[tuple]:
    """Splat records ordered by visual priority: the budget clamp in
    engine/world-package.js keeps records from the front, so the load-bearing
    material (beam, sparks, water) survives the low tier."""
    records: list[tuple] = []
    fold = 2.0 + rand() * 1.5

    # Beam: the column of folded light. Warm ivory-amber, mid depth.
    for _ in range(1500):
        t = rand()
        x, y = beam_point(t, fold)
        x += (rand() - 0.5) * 0.055
        y += (rand() - 0.5) * 0.055
        z = 0.52 + (rand() - 0.5) * 0.10
        warm = 0.72 + rand() * 0.28
        records.append((x, y, z, warm, warm * (0.82 + rand() * 0.1), 0.58 + rand() * 0.2,
                        1.6 + rand() * 2.6, 0.34 + rand() * 0.30, KIND_IDS["beam"], rand()))

    # Sparks: four-point caustics where the folds cross. Bright, sparse.
    for _ in range(350):
        t = rand()
        x, y = beam_point(t, fold)
        z = 0.50 + (rand() - 0.5) * 0.08
        records.append((x, y, z, 0.98, 0.95, 0.88, 3.2 + rand() * 3.4,
                        0.55 + rand() * 0.35, KIND_IDS["spark"], rand()))

    # Water glints: the reflective lower band. Cool cyan, shallow depth.
    for _ in range(1200):
        x = (rand() * 2 - 1) * 0.96
        y = -0.62 - rand() * 0.34
        z = 0.34 + rand() * 0.08
        cool = 0.45 + rand() * 0.35
        records.append((x, y, z, cool * 0.55, cool * 0.92, cool, 1.2 + rand() * 2.2,
                        0.22 + rand() * 0.26, KIND_IDS["water"], rand()))

    # Dust: the inhabited air. Violet-grey far, warming as it nears.
    for _ in range(6000):
        x = (rand() * 2 - 1) * 1.02
        y = (rand() * 2 - 1) * 1.02
        z = 0.25 + rand() * 0.65
        far = (z - 0.25) / 0.65
        records.append((x, y, z,
                        lerp(0.62, 0.38, far), lerp(0.50, 0.36, far), lerp(0.46, 0.52, far),
                        0.7 + rand() * 1.6, 0.08 + rand() * 0.16, KIND_IDS["dust"], rand()))

    # Bokeh: a few large soft near discs.
    for _ in range(250):
        x = (rand() * 2 - 1) * 0.9
        y = (rand() * 2 - 1) * 0.9
        z = 0.10 + rand() * 0.14
        records.append((x, y, z, 0.86, 0.78, 0.66, 7.0 + rand() * 9.0,
                        0.05 + rand() * 0.09, KIND_IDS["bokeh"], rand()))

    # Stars: the far field, three depth bands like the session's sky work.
    for _ in range(1200):
        x = (rand() * 2 - 1) * 1.05
        y = (rand() * 2 - 1) * 1.05
        band = rand()
        z = 0.92 + band * 0.07
        cool = 0.75 + rand() * 0.25
        records.append((x, y, z, cool * 0.92, cool * 0.95, cool, 0.6 + rand() * 1.1,
                        0.30 + rand() * 0.45, KIND_IDS["stars"], rand()))

    return records


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=str(Path(__file__).resolve().parent))
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    rand = mulberry32(seed_hash(SEED))
    records = build_records(rand)
    blob = b"".join(struct.pack("<10f", *record) for record in records)
    (out / "folded-light.splats.bin").write_bytes(blob)
    sha = hashlib.sha256(blob).hexdigest()

    manifest = {
        "schema": SCHEMA,
        "lane": "authored",
        "title": TITLE,
        "seed": SEED,
        "published": "2026-08-03",
        "disclosure": (
            "Authored spatial scene. Every layer and every Gaussian primitive is "
            "generated from the named seed by this repository's own deterministic "
            "builder; nothing is reconstructed from an image, so nothing hidden "
            "was invented. The camera boundary below is the proof boundary."
        ),
        "camera": {"maxX": 0.045, "maxY": 0.030, "maxDolly": 0.12},
        "layers": [
            {"name": "deep_veil", "depth": 0.95},
            {"name": "far_veil", "depth": 0.75},
            {"name": "mid_veil", "depth": 0.55},
            {"name": "near_veil", "depth": 0.22},
        ],
        "splats": {
            "count": len(records),
            "kinds": ["dust", "beam", "water", "stars", "spark", "bokeh"],
            "record_bytes": 40,
            "priority_order": "beam, spark, water, dust, bokeh, stars",
            "sidecar": "folded-light.splats.bin",
        },
        "temporal": {
            "systems": ["water shimmer", "dust drift", "beam current", "veil breathing"],
            "note": "Motion is material-scoped: veils breathe slowly, structure holds.",
        },
        "builder": "art/spatial/build_scene.py",
        "receipts": {"folded-light.splats.bin": sha},
    }
    (out / "folded-light.world.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8",
    )
    print(f"{len(records)} records, {len(blob)} bytes, sha256 {sha}")


if __name__ == "__main__":
    main()
