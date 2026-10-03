"""Track A T5 v2 (pre-registration 3): the L1 budget of 160 tokens on every corpus plus a constructed worst
case, and prefix rebuilds with nearest-cell and bilinear upsampling on the fresh t7v2 images, per source.
Inputs: <v1 work>/out/tokens.json (audit and slice 0), <t7v2 work>/index.json, base/, out/packets.json,
out/tokens.json. Writes results/t5v2-budget-upsampler.json when TELOS_WRITE_RESULTS=1.
CLI: python t5v2_analyze.py <v1 work dir> <t7v2 work dir>   (run t5v2_worst_case.py first, with `tokenizers`)
"""
import json
import os
import sys

import numpy as np

from t5_analyze import CEILING, MARGIN
from track_common import (bilinear, cluster_boot, de2000, linear_to_lab, luma_linear, oklab_grids, oklab_to_linear,
                          parse_layer, prereg_hashes, srgb_to_linear, ssim)

L1_BUDGET = 160
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def nearest(grid, h, w):
    rows, cols = grid.shape[:2]
    iy = np.minimum(rows - 1, ((np.arange(h) + 0.5) * rows / h).astype(int))
    ix = np.minimum(cols - 1, ((np.arange(w) + 0.5) * cols / w).astype(int))
    return grid[np.ix_(iy, ix)]


def rebuild(grids, h, w, up):
    L, a, b = (up(g[..., None], h, w)[..., 0] for g in grids)
    return np.clip(oklab_to_linear(np.stack([L, a, b], -1)), 0.0, 1.0)


def terms(px, pk, up):
    h, w = px.shape[:2]
    lin = srgb_to_linear(px)
    lab, luma = linear_to_lab(lin), luma_linear(lin)
    l0, l1, l2 = parse_layer(pk["L0"]), parse_layer(pk["L1"]), parse_layer(pk["L2"])
    flat = np.clip(oklab_to_linear(np.array([l0["p"][1] / 255.0, 0.0, 0.0])), 0, 1)
    recs = [np.broadcast_to(flat, lin.shape), rebuild(oklab_grids(l1), h, w, up), rebuild(oklab_grids(l2, l1), h, w, up)]
    return [(float(de2000(lab, linear_to_lab(r)).mean()), ssim(luma, luma_linear(r))) for r in recs]


def steps(rows, clusters):
    out = {}
    for step, (a, b) in (("R0->R1", (0, 1)), ("R1->R2", (1, 2))):
        dl = np.array([r["de2000"][b] - r["de2000"][a] for r in rows])
        sl = np.array([r["ssim"][a] - r["ssim"][b] for r in rows])
        bd, bs = cluster_boot(dl, clusters), cluster_boot(sl, clusters)
        over_d = [r["name"] for r, v in zip(rows, dl) if v > CEILING["de2000"]]
        over_s = [r["name"] for r, v in zip(rows, sl) if v > CEILING["ssim"]]
        out[step] = {"de2000_loss": bd, "ssim_loss": bs, "max_de2000_loss": float(dl.max()), "max_ssim_loss": float(sl.max()),
                     "images_over_ceiling": {"de2000": len(over_d), "ssim": len(over_s)}, "over_ceiling_names": {"de2000": over_d[:20], "ssim": over_s[:20]},
                     "pass": bd["hi"] <= MARGIN["de2000"] and bs["hi"] <= MARGIN["ssim"] and not over_d and not over_s}
    return out


def main(v1, work):
    wc = json.load(open(os.path.join(work, "out", "l1_worst_case.json")))  # written by t5v2_worst_case.py
    t1 = json.load(open(os.path.join(v1, "out", "tokens.json")))
    t2 = json.load(open(os.path.join(work, "out", "tokens.json")))
    index = json.load(open(os.path.join(work, "index.json")))
    packets = json.load(open(os.path.join(work, "out", "packets.json")))
    out = {"result": "t5v2-budget-upsampler", **prereg_hashes(("prereg_t4t7_sha256", "prereg_t7v2_sha256")),
           "tokenizer_sha256": t2["tokenizer_sha256"], "l1_budget": L1_BUDGET, "budget": {}, "rebuild": {}}
    for name, tk in (("audit", t1["base"]["audit"]), ("s0", t1["base"]["s0"]), ("t7v2", t2["base"]["t7v2"])):
        v = [d["L1"] for d in tk.values()]
        out["budget"][name] = {"n": len(v), "max": max(v), "mean": float(np.mean(v)), "over": sum(x > L1_BUDGET for x in v)}
    out["budget"]["worst_case"] = wc
    out["budget"]["pass"] = all(out["budget"][c]["over"] == 0 for c in ("audit", "s0", "t7v2")) and out["budget"]["worst_case"]["tokens"] <= L1_BUDGET
    fresh = [e for e in index["corpora"]["t7v2"] if e["fresh"]]
    for up_name, up in (("nearest", nearest), ("bilinear", bilinear)):
        out["rebuild"][up_name] = {}
        for src in ("KATHER2016", "PBC", "BBBC010"):
            rows = []
            for e in (x for x in fresh if x["source"] == src):
                px = np.fromfile(os.path.join(work, "base", "t7v2", e["name"] + ".rgba"), np.uint8).reshape(e["h"], e["w"], 4)[..., :3]
                r = terms(px, packets["base"]["t7v2"][e["name"]], up)
                rows.append({"name": e["name"], "cluster": e["group"], "de2000": [x[0] for x in r], "ssim": [x[1] for x in r]})
            out["rebuild"][up_name][src] = {"images": len(rows), "steps": steps(rows, [r["cluster"] for r in rows])}
            s = out["rebuild"][up_name][src]["steps"]
            print(up_name, src, len(rows), {k: (round(v["ssim_loss"]["mean"], 4), round(v["ssim_loss"]["hi"], 4), round(v["max_ssim_loss"], 3),
                                               round(v["de2000_loss"]["hi"], 3), round(v["max_de2000_loss"], 3), v["images_over_ceiling"], v["pass"]) for k, v in s.items()}, flush=True)
    out["gates"] = {"L1 budget 160": out["budget"]["pass"]}
    for src in ("KATHER2016", "PBC", "BBBC010"):
        for step in ("R0->R1", "R1->R2"):
            out["gates"][f"nearest {src} {step}"] = out["rebuild"]["nearest"][src]["steps"][step]["pass"]
    print(json.dumps(out["budget"], indent=1))
    print(json.dumps(out["gates"], indent=1))
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t5v2-budget-upsampler.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
