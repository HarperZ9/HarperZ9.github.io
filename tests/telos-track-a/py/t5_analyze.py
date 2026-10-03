"""Track A T5: declared token budgets and prefix-rebuild non-inferiority (pre-registration 2, section T5).

Inputs: <work>/index.json, <work>/base/, <work>/out/packets.json (Node), <work>/out/tokens.json, and
optionally <work>/out/py_packets_full.json (the Python twin's packet text, for the noise floor).
Writes tests/telos-track-a/results/t5-budgets.json when TELOS_WRITE_RESULTS=1; prints the gates.
CLI: python t5_analyze.py <work dir>
"""
import json
import os
import sys

import numpy as np

from track_common import (bilinear, cluster_boot, de2000, dq, linear_to_lab, luma_linear, oklab_grids,
                          oklab_to_linear, parse_layer, prereg_hashes, srgb_to_linear, ssim)

BUDGET = {"L0": 80, "L1": 100, "L2:chromatic": 1300, "L2:achromatic": 650}
MARGIN = {"de2000": 0.5, "ssim": 0.02}
CEILING = {"de2000": 2.0, "ssim": 0.05}
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def rebuild(lab_grids, h, w):
    L, a, b = (bilinear(g[..., None], h, w)[..., 0] for g in lab_grids)
    return np.clip(oklab_to_linear(np.stack([L, a, b], -1)), 0.0, 1.0)


def terms(px, pk):
    h, w = px.shape[:2]
    lin = srgb_to_linear(px)
    lab, luma = linear_to_lab(lin), luma_linear(lin)
    l0, l1, l2 = parse_layer(pk["L0"]), parse_layer(pk["L1"]), parse_layer(pk["L2"])
    flat = np.clip(oklab_to_linear(np.array([l0["p"][1] / 255.0, 0.0, 0.0])), 0, 1)
    recs = [np.broadcast_to(flat, lin.shape), rebuild(oklab_grids(l1), h, w), rebuild(oklab_grids(l2, l1), h, w)]
    return [(float(de2000(lab, linear_to_lab(r)).mean()), ssim(luma, luma_linear(r))) for r in recs]


def main(work):
    index = json.load(open(os.path.join(work, "index.json")))
    packets = json.load(open(os.path.join(work, "out", "packets.json")))
    tokens = json.load(open(os.path.join(work, "out", "tokens.json")))
    out = {"result": "t5-budgets", **prereg_hashes(), "tokenizer_sha256": tokens["tokenizer_sha256"], "budgets": BUDGET,
           "corpora": {}, "noise_floor": {"node_repeat_identical": packets["repeatIdentical"]}}
    pyp = os.path.join(work, "out", "py_packets_full.json")
    if os.path.exists(pyp):
        twin = json.load(open(pyp, encoding="utf-8"))
        same = sum(1 for k, t in twin.items() if t == "\n".join(packets["base"][k.split("/")[0]][k.split("/")[1]][x] for x in ("L0", "L1", "L2")) + "\n")
        out["noise_floor"]["python_twin_identical"] = {"same": same, "of": len(twin)}
    gates = []
    for corpus in ("audit", "s0"):
        entries = index["corpora"][corpus]
        tok = tokens["base"][corpus]
        layer_tokens = {"L0": [], "L1": [], "L2:chromatic": [], "L2:achromatic": []}
        over = {k: [] for k in layer_tokens}
        rows = []
        for e in entries:
            pk = packets["base"][corpus][e["name"]]
            t = tok[e["name"]]
            br = "L2:achromatic" if pk["achromatic"] else "L2:chromatic"
            for key, val in (("L0", t["L0"]), ("L1", t["L1"]), (br, t["L2"])):
                layer_tokens[key].append(val)
                if val > BUDGET[key]:
                    over[key].append([e["name"], val])
            px = np.fromfile(os.path.join(work, "base", corpus, e["name"] + ".rgba"), np.uint8).reshape(e["h"], e["w"], 4)[..., :3]
            r = terms(px, pk)
            rows.append({"name": e["name"], "cluster": e.get("group", e["name"]) if corpus == "s0" else e["name"],
                         "source": e.get("source", e["group"]), "branch": br, "tokens": t,
                         "de2000": [x[0] for x in r], "ssim": [x[1] for x in r]})
        res = {"images": len(entries), "tokens": {k: {"n": len(v), "max": max(v) if v else None, "mean": float(np.mean(v)) if v else None,
                                                       "over_budget": over[k]} for k, v in layer_tokens.items()}, "steps": {}}
        clusters = [r["cluster"] for r in rows]
        for step, (a, b) in (("R0->R1", (0, 1)), ("R1->R2", (1, 2))):
            dl = np.array([r["de2000"][b] - r["de2000"][a] for r in rows])
            sl = np.array([r["ssim"][a] - r["ssim"][b] for r in rows])
            bd, bs = cluster_boot(dl, clusters), cluster_boot(sl, clusters)
            worst_d, worst_s = int(np.argmax(dl)), int(np.argmax(sl))
            res["steps"][step] = {"de2000_loss": bd, "ssim_loss": bs,
                                  "worst_de2000": [rows[worst_d]["name"], float(dl[worst_d])], "worst_ssim": [rows[worst_s]["name"], float(sl[worst_s])],
                                  "images_over_ceiling": {"de2000": [r["name"] for r, v in zip(rows, dl) if v > CEILING["de2000"]],
                                                          "ssim": [r["name"] for r, v in zip(rows, sl) if v > CEILING["ssim"]]},
                                  "pass": bd["hi"] <= MARGIN["de2000"] and bs["hi"] <= MARGIN["ssim"]
                                  and float(dl.max()) <= CEILING["de2000"] and float(sl.max()) <= CEILING["ssim"]}
            gates.append((f"{corpus} {step}", res["steps"][step]["pass"]))
        budget_ok = all(not v for v in over.values())
        gates.append((f"{corpus} budgets", budget_ok))
        res["budget_pass"] = budget_ok
        res["per_image"] = rows
        out["corpora"][corpus] = res
    out["gates"] = dict(gates)
    print(json.dumps(out["gates"], indent=1))
    for c in ("audit", "s0"):
        print(c, json.dumps({k: {kk: v[kk] for kk in ("n", "max", "mean")} for k, v in out["corpora"][c]["tokens"].items()}))
        for s, v in out["corpora"][c]["steps"].items():
            print(c, s, "dE", {k: round(v["de2000_loss"][k], 3) for k in ("mean", "lo", "hi")}, "ssim", {k: round(v["ssim_loss"][k], 4) for k in ("mean", "lo", "hi")},
                  "worst", v["worst_de2000"], v["worst_ssim"])
    print(json.dumps(out["noise_floor"]))
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t5-budgets.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
