"""Track A T6: nuisance invariance (pre-registration 2 section T6, amendment 2 for overlays).

Inputs: <work>/index.json and <work>/out/packets.json (Node). Writes results/t6-invariance.json when
TELOS_WRITE_RESULTS=1; prints the gates. CLI: python t6_analyze.py <work dir>
"""
import json
import math
import os
import sys

import numpy as np

from track_common import oklab_grids, on_grid, parse_layer, prereg_hashes

NUISANCES = ["jpeg75", "jpeg85", "jpeg95", "x0.5", "x0.75", "x1.5", "x2", "shift1"]
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def l0_vec(pk):
    p = parse_layer(pk["L0"])
    return np.array([p["p"][0] / 255, p["p"][1] / 255, p["p"][2] / 255, p["chroma_milli"] / 1000])


def grid32(pk, layer):
    l1 = parse_layer(pk["L1"])
    p = l1 if layer == "L1" else parse_layer(pk["L2"])
    return np.stack([on_grid(g) for g in oklab_grids(p, l1)], -1)


def distance(a, b, layer):
    if layer == "L0":
        return float(np.abs(l0_vec(a) - l0_vec(b)).mean())
    return float(np.linalg.norm(grid32(a, layer) - grid32(b, layer), axis=-1).mean())


def ratio(dn, dc):
    if dc == 0:
        return 0.0 if dn == 0 else math.inf
    return dn / dc


def main(work):
    index = json.load(open(os.path.join(work, "index.json")))
    packets = json.load(open(os.path.join(work, "out", "packets.json")))
    out = {"result": "t6-invariance", **prereg_hashes(), "pil": index["pil"], "corpora": {}, "gates": {}}
    for corpus, base_key in (("art", "audit"), ("s0", "s0")):
        names = [e["name"] for e in index["corpora"][corpus]]
        res = {"images": len(names), "layers": {}}
        for layer in ("L0", "L1", "L2"):
            per = {}
            for nz in NUISANCES:
                ratios, dns, dcs, zero_c2 = [], [], [], 0
                for n in names:
                    clean = packets["base"][base_key][n]
                    var = packets["variants"][corpus][n]
                    dn, dc = distance(clean, var[nz], layer), distance(clean, var["c2"], layer)
                    zero_c2 += dc == 0
                    ratios.append(ratio(dn, dc)); dns.append(dn); dcs.append(dc)
                med = float(np.median(ratios))
                per[nz] = {"median_ratio": med, "p90_ratio": float(np.percentile(ratios, 90)), "median_nuisance": float(np.median(dns)),
                           "median_c2": float(np.median(dcs)), "c2_zero": int(zero_c2), "pass": med <= 0.25}
                out["gates"][f"{corpus} {layer} {nz}"] = per[nz]["pass"]
            res["layers"][layer] = per
        flips = {nz: sum(packets["variants"][corpus][n][nz]["achromatic"] != packets["base"][base_key][n]["achromatic"] for n in names)
                 for nz in NUISANCES + ["c2"]}
        res["flag_flips"] = flips
        out["corpora"][corpus] = res
    ov = packets["overlays"]
    rows = ov.get("rows", [])
    summary = {"cases": len(rows)}
    for f in (0.02, 0.1):
        rr = [r for r in rows if r["fraction"] == f]
        summary[str(f)] = {"cases": len(rr), "flag_kept_outside_mask": sum(r["drawnFlagOutsideMask"] == r["cleanFlag"] for r in rr),
                           "clean_text_equal": sum(r["cleanTextEqual"] for r in rr), "l3_exact": sum(r["l3Equal"] for r in rr),
                           "flag_kept_without_mask": sum(r["flagNoMask"] == r["cleanFlag"] for r in rr),
                           "share_min": min(r["share"] for r in rr), "share_max": max(r["share"] for r in rr)}
        for k in ("flag_kept_outside_mask", "clean_text_equal", "l3_exact"):
            out["gates"][f"overlay {f} {k}"] = summary[str(f)][k] == len(rr) and len(rr) > 0
    out["overlays"] = {"summary": summary, "rows": rows}
    print(json.dumps({k: v for k, v in out["gates"].items() if not v}, indent=1))
    print(json.dumps(summary, indent=1))
    for c in ("art", "s0"):
        print(c, "flips", out["corpora"][c]["flag_flips"])
        for layer, per in out["corpora"][c]["layers"].items():
            print(c, layer, " ".join(f"{nz}:{v['median_ratio']:.3f}" for nz, v in per.items()), "c2med", round(per["jpeg75"]["median_c2"], 4))
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t6-invariance.json"), "w"), indent=1, default=str)


if __name__ == "__main__":
    main(sys.argv[1])
