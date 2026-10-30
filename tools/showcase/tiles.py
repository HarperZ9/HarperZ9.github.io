"""tiles.py: a graded render into a deep-zoom tile pyramid (Deep Zoom layout: <name>_files/<level>/<col>_<row>.<ext>,
level L is the image halved max_level - L times, a .dzi descriptor beside it), with AVIF tiles and JPEG fallbacks,
plus manifest.json for the site's viewer. Pillow only.

  python tiles.py <render.u8.npy> <out_dir> <name> [--tile 512] [--avif-q 60] [--jpeg-q 82]
"""
import argparse
import json
import math
import time
from pathlib import Path

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src"); ap.add_argument("out"); ap.add_argument("name")
    ap.add_argument("--tile", type=int, default=512); ap.add_argument("--avif-q", type=int, default=60); ap.add_argument("--jpeg-q", type=int, default=82)
    a = ap.parse_args()
    arr = np.load(a.src, mmap_mode="r")
    H, W, _ = arr.shape
    T, out = a.tile, Path(a.out)
    top = math.ceil(math.log2(max(W, H)))
    root = out / f"{a.name}_files"
    t0 = time.perf_counter()
    img = Image.fromarray(np.ascontiguousarray(arr))
    stats = {"avif": 0, "jpg": 0, "tiles": 0}
    levels = []
    for L in range(top, -1, -1):
        w, h = img.size
        cols, rows = math.ceil(w / T), math.ceil(h / T)
        d = root / str(L); d.mkdir(parents=True, exist_ok=True)
        for r in range(rows):
            for c in range(cols):
                tile = img.crop((c * T, r * T, min(w, (c + 1) * T), min(h, (r + 1) * T)))
                pa, pj = d / f"{c}_{r}.avif", d / f"{c}_{r}.jpg"
                tile.save(pa, quality=a.avif_q, speed=8)
                tile.save(pj, quality=a.jpeg_q, optimize=True, progressive=True)
                stats["avif"] += pa.stat().st_size; stats["jpg"] += pj.stat().st_size; stats["tiles"] += 1
        levels.append({"level": L, "w": w, "h": h, "cols": cols, "rows": rows})
        if L:
            img = img.reduce(2) if (w > 1 and h > 1) else img
    (out / f"{a.name}.dzi").write_text(
        f'<?xml version="1.0" encoding="UTF-8"?>\n<Image xmlns="http://schemas.microsoft.com/deepzoom/2008" TileSize="{T}" Overlap="0" Format="avif">'
        f'<Size Width="{W}" Height="{H}"/></Image>\n')
    man = {"name": a.name, "width": W, "height": H, "tileSize": T, "overlap": 0, "maxLevel": top, "formats": ["avif", "jpg"],
           "tiles": stats["tiles"], "bytes": {"avif": stats["avif"], "jpg": stats["jpg"]}, "encode_s": round(time.perf_counter() - t0, 1),
           "levels": levels[::-1]}
    (out / f"{a.name}.json").write_text(json.dumps(man, indent=1))
    print(json.dumps({k: man[k] for k in ("name", "width", "height", "tiles", "bytes", "encode_s")}))


if __name__ == "__main__":
    main()
