"""run.py: render one showcase scene at one size, grade it, and write a receipt.

  python run.py metals 3840 2160 H:/showcase [--samples 2] [--tile 2048]

Writes <out>/<scene>-<W>x<H>.hdr.npy (linear, float16), .u8.npy (graded sRGB), a 1920 px preview PNG and
<scene>-<W>x<H>.json with wall time, GPU joules (NVML counter), the device and the settings.
"""
import argparse
import hashlib
import json
import platform
import sys
from pathlib import Path

import numpy as np
import torch

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import finish, render  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scene", choices=["metals", "packing", "glass-night"])
    ap.add_argument("W", type=int); ap.add_argument("H", type=int); ap.add_argument("out")
    ap.add_argument("--samples", type=int, default=2); ap.add_argument("--tile", type=int, default=2048)
    a = ap.parse_args()
    if a.scene == "glass-night":
        from glass_night import make_shader
        field = Path(a.out).parent / f"glyph-{a.W}x{a.H}.npy"   # the glyph field at the frame's own size (glyph_field.py)
        shade, grade = make_shader(a.W, a.H, a.samples, str(field)), dict(bloom=0.16, halation=0.35)
    else:
        from metals import make_shader
        shade, grade = make_shader(a.scene, a.samples), dict(bloom=0.12, halation=0.25)
    name = a.scene
    hdr, r1 = render(shade, a.W, a.H, a.out, name, tile=a.tile)
    u8, r2 = finish(hdr, a.out, name, **grade)
    step = max(1, a.W // 1920)
    prev = np.ascontiguousarray(u8[::step, ::step])
    try:
        from PIL import Image
        Image.fromarray(prev).save(Path(a.out) / f"{name}-{a.W}x{a.H}.preview.png")
    except ImportError:
        np.save(Path(a.out) / f"{name}-{a.W}x{a.H}.preview.npy", prev)
    h = hashlib.sha256()
    for y in range(0, a.H, 512):
        h.update(np.ascontiguousarray(u8[y:y + 512]).tobytes())
    rec = {"scene": name, "W": a.W, "H": a.H, "megapixels": round(a.W * a.H / 1e6, 1), "samples_per_pixel": a.samples ** 2,
           "wavelengths": 81, **r1, **r2, "device": torch.cuda.get_device_name(0), "torch": torch.__version__,
           "python": platform.python_version(), "u8_sha256": h.hexdigest()}
    (Path(a.out) / f"{name}-{a.W}x{a.H}.json").write_text(json.dumps(rec, indent=1))
    print(json.dumps(rec))


if __name__ == "__main__":
    main()
