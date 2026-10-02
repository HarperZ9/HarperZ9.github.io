"""Prepare the images for Track A steps T5 to T7 (pre-registration 2): decoded RGBA files and the
Python-made nuisance variants (JPEG re-encodes and the C2 lightness probe).

Inputs (environment): TELOS_SLICE0_STORE (store_v2 with images/), TELOS_SLICE0_RECORDS (records_clean.jsonl
of build run3a), TELOS_AUDIT_FRAMES (index.json and .rgba frames).
Output directory layout (argv[1]):
  index.json                       corpora, images, labels, groups, check counts
  base/<corpus>/<name>.rgba        decoded RGBA, alpha 255
  var/<corpus>/<name>.<v>.rgba     v in jpeg75, jpeg85, jpeg95, c2  (corpora art and s0)
The slice 0 pixel check follows the store's own hash convention (pixel_sha256 in the slice 0 pipeline:
SHA-256 of "<dtype>|<h>x<w>[x<c>]|" + the decoded array bytes).
Run with the system Python (numpy, PIL, scipy). CPU only.
"""
import hashlib
import io
import json
import os
import sys

import numpy as np
from PIL import Image
import PIL

# Ottosson matrices as in exp-resolution/colour.py (float64).
M1 = np.array([[0.4122214708, 0.5363325363, 0.0514459929],
               [0.2119034982, 0.6806995451, 0.1073969566],
               [0.0883024619, 0.2817188376, 0.6299787005]])
M2 = np.array([[0.2104542553, 0.7936177850, -0.0040720468],
               [1.9779984951, -2.4285922050, 0.4505937099],
               [0.0259040371, 0.7827717662, -0.8086757660]])
M1I, M2I = np.linalg.inv(M1), np.linalg.inv(M2)
TASKS = {"PBC": ["cell_class"], "KATHER2016": ["tissue_class"], "BBBC010": ["condition", "channel"]}


def store_pixel_sha256(arr):
    a = np.ascontiguousarray(arr)
    head = f"{a.dtype.str}|{'x'.join(map(str, a.shape))}|".encode()
    return hashlib.sha256(head + a.tobytes()).hexdigest()


def c2_probe(rgb):
    """Every pixel's float OKLab L lowered by 0.04, back to sRGB bytes (clip, round half to even)."""
    c = rgb.astype(np.float64) / 255.0
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    lab = np.cbrt(lin @ M1.T) @ M2.T
    lab[..., 0] -= 0.04
    lin2 = np.clip(((lab @ M2I.T) ** 3) @ M1I.T, 0.0, 1.0)
    s = np.where(lin2 <= 0.0031308, 12.92 * lin2, 1.055 * lin2 ** (1 / 2.4) - 0.055) * 255.0
    return np.clip(np.round(s), 0, 255).astype(np.uint8)


def jpeg(rgb, q):
    buf = io.BytesIO()
    Image.fromarray(rgb, "RGB").save(buf, "JPEG", quality=q)
    return np.asarray(Image.open(io.BytesIO(buf.getvalue())).convert("RGB"))


def rgba_bytes(rgb):
    h, w = rgb.shape[:2]
    out = np.empty((h, w, 4), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = 255
    return out.tobytes()


def put(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(data)


def main(out):
    store, recs_path, frames = (os.environ[k] for k in ("TELOS_SLICE0_STORE", "TELOS_SLICE0_RECORDS", "TELOS_AUDIT_FRAMES"))
    index = {"pil": PIL.__version__, "numpy": np.__version__, "corpora": {"audit": [], "art": [], "s0": []}, "checks": {}}
    for f in json.load(open(os.path.join(frames, "index.json"))):
        px = np.fromfile(os.path.join(frames, f["name"] + ".rgba"), np.uint8).reshape(f["h"], f["w"], 4)
        entry = {"name": f["name"], "w": f["w"], "h": f["h"], "group": f["group"]}
        put(os.path.join(out, "base", "audit", f["name"] + ".rgba"), rgba_bytes(px[..., :3]))
        index["corpora"]["audit"].append(entry)
        if f["group"] == "art":
            index["corpora"]["art"].append(entry)
            put(os.path.join(out, "base", "art", f["name"] + ".rgba"), rgba_bytes(px[..., :3]))
    ok = 0
    for line in open(recs_path, encoding="utf-8"):
        r = json.loads(line)
        arr = np.asarray(Image.open(os.path.join(store, r["image_path"])))
        if store_pixel_sha256(arr) != r["pixel_sha256"]:
            raise SystemExit(f"pixel hash mismatch on {r['row_id']}")
        ok += 1
        rgb = np.asarray(Image.open(os.path.join(store, r["image_path"])).convert("RGB"))
        h, w = rgb.shape[:2]
        labels = {t: r["nodes"][t][0] for t in TASKS[r["source_id"]]}
        group = r["group"] if r["group"] is not None else r["row_id"]
        index["corpora"]["s0"].append({"name": r["row_id"], "w": w, "h": h, "source": r["source_id"], "group": group, "labels": labels})
        put(os.path.join(out, "base", "s0", r["row_id"] + ".rgba"), rgba_bytes(rgb))
    index["checks"]["s0_pixel_sha256_ok"] = ok
    for corpus in ("art", "s0"):
        for e in index["corpora"][corpus]:
            px = np.fromfile(os.path.join(out, "base", corpus, e["name"] + ".rgba"), np.uint8).reshape(e["h"], e["w"], 4)[..., :3]
            variants = {f"jpeg{q}": jpeg(px, q) for q in (75, 85, 95)}
            variants["c2"] = c2_probe(px)
            for v, img in variants.items():
                put(os.path.join(out, "var", corpus, f"{e['name']}.{v}.rgba"), rgba_bytes(img))
    json.dump(index, open(os.path.join(out, "index.json"), "w"), indent=1)
    print(json.dumps({k: len(v) for k, v in index["corpora"].items()}), ok)


if __name__ == "__main__":
    main(sys.argv[1])
