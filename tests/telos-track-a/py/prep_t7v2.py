"""Prepare the "t7v2" corpus (pre-registration 3): decoded RGBA files and an index with labels, groups and the
"fresh" flag. Decode rules follow the slice 0 ingest. Inputs (environment): TELOS_SLICE0_EXTRACTED (the
extracted source trees), TELOS_SLICE0_RECORDS (records_clean.jsonl of build run3a, to exclude and mark slice 0
rows). Output (argv[1]): index.json and base/t7v2/<name>.rgba. Needs numpy, PIL and tifffile. CPU only.
"""
import hashlib
import json
import os
import re
import sys

import numpy as np
import tifffile
from PIL import Image

SEED = 20261012
PER_CLASS = 125
MAX_EDGE = 512
KATHER = "Kather_texture_2016_image_tiles_5000"
PBC = "PBC_dataset_normal_DIB"
BBBC = "BBBC010_v2_images"
PBC_RE = re.compile(r"^[A-Za-z]+_\d+\.jpg$")
BBBC_RE = re.compile(r"_(?P<well>[A-P]\d{2})_(?P<ch>w[12])_")
PATIENT_RE = re.compile(r"(CRC-Prim-HE-\d{2})")
# Confirmed TIFF-header mapping (operator decision, evening of 2026-10-02).
CHANNEL = {"w1": "fluorescence TRITC (Sytox Orange)", "w2": "transmitted light"}
PBC_LABEL = {"platelet": "thrombocyte", "ig": "immature granulocyte"}


def out_size(w, h):
    s = min(1.0, MAX_EDGE / max(w, h))
    return (w, h) if s == 1.0 else (int(round(w * s)), int(round(h * s)))


def decode(path, source):
    if source == "BBBC010":
        a = np.clip(tifffile.imread(path).astype(np.uint32) >> 4, 0, 255).astype(np.uint8)
        a = np.stack([a, a, a], -1)
    else:
        with Image.open(path) as im:
            a = np.asarray(im.convert("RGB"))
    h, w = a.shape[:2]
    ow, oh = out_size(w, h)
    if (ow, oh) != (w, h):
        a = np.asarray(Image.fromarray(a).resize((ow, oh), Image.Resampling.LANCZOS))
    return a


def condition(well):
    col = int(well[1:])
    return "positive control" if 1 <= col <= 12 else "negative control"


def put_rgba(path, rgb):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    h, w = rgb.shape[:2]
    out = np.empty((h, w, 4), np.uint8)
    out[..., :3] = rgb
    out[..., 3] = 255
    out.tofile(path)


def main(out):
    ext, recs = os.environ["TELOS_SLICE0_EXTRACTED"], os.environ["TELOS_SLICE0_RECORDS"]
    clean = {json.loads(l)["source_path"] for l in open(recs, encoding="utf-8")}
    rng = np.random.default_rng(SEED)
    picks = []
    for top, src in ((KATHER, "KATHER2016"), (PBC, "PBC")):
        for folder in sorted(os.listdir(os.path.join(ext, top))):
            d = os.path.join(ext, top, folder)
            if not os.path.isdir(d):
                continue
            files = sorted(f for f in os.listdir(d) if f"{top}/{folder}/{f}" not in clean
                           and (src != "PBC" or PBC_RE.match(f)))
            chosen = sorted(rng.choice(len(files), PER_CLASS, replace=False).tolist())
            for i in chosen:
                rel = f"{top}/{folder}/{files[i]}"
                if src == "KATHER2016":
                    lab = {"tissue_class": folder.split("_", 1)[1].lower()}
                    group = PATIENT_RE.search(files[i]).group(1)
                else:
                    lab = {"cell_class": PBC_LABEL.get(folder, folder)}
                    group = rel
                picks.append((src, rel, lab, group))
    for f in sorted(os.listdir(os.path.join(ext, BBBC))):
        m = BBBC_RE.search(f)
        if not m or not f.endswith(".tif"):
            continue
        rel = f"{BBBC}/{f}"
        picks.append(("BBBC010", rel, {"condition": condition(m["well"]), "channel": CHANNEL[m["ch"]]}, m["well"]))
    index = {"corpus": "t7v2", "seed": SEED, "corpora": {"t7v2": []}}
    for src, rel, lab, group in picks:
        rgb = decode(os.path.join(ext, rel), src)
        name = hashlib.sha256(rel.encode()).hexdigest()[:12]
        h, w = rgb.shape[:2]
        put_rgba(os.path.join(out, "base", "t7v2", name + ".rgba"), rgb)
        index["corpora"]["t7v2"].append({"name": name, "w": w, "h": h, "source": src, "group": group, "labels": lab,
                                         "source_path": rel, "fresh": rel not in clean})
    json.dump(index, open(os.path.join(out, "index.json"), "w"), indent=1)
    e = index["corpora"]["t7v2"]
    print(len(e), {s: sum(x["source"] == s for x in e) for s in ("KATHER2016", "PBC", "BBBC010")},
          "fresh", sum(x["fresh"] for x in e))


if __name__ == "__main__":
    main(sys.argv[1])
