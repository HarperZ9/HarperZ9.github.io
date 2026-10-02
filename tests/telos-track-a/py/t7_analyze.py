"""Track A T7: task value of each layer on the slice 0 images (pre-registration 2 section T7, amendment 4).

Scope: in-source only. Inputs: <work>/index.json, <work>/out/packets.json, <work>/out/tokens.json.
Writes results/t7-task-value.json when TELOS_WRITE_RESULTS=1. CLI: python t7_analyze.py <work dir>
"""
import itertools
import json
import math
import os
import sys

import numpy as np

from probe import cv_correct, derangement, repeated_scores
from track_common import cluster_boot, encode_layer, parse_layer, prereg_hashes

TASKS = [("PBC", "cell_class"), ("KATHER2016", "tissue_class"), ("BBBC010", "condition"), ("BBBC010", "channel")]
LAYERS = ("L0", "L1", "L2")
N_GRID = [8, 12, 16, 20, 24, 28, 32, 40, 48]
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def l2_block(texts):
    """L2 features for a list of L2 texts; mixed branches give zero-filled blocks (amendment 4)."""
    parsed = [parse_layer(t) for t in texts]
    kinds = {p["kind"] for p in parsed}
    chrom = next((p for p in parsed if p["kind"] == "chromatic"), None)
    achro = next((p for p in parsed if p["kind"] == "achromatic"), None)
    cl = chrom["L"].size + chrom["A"].size + chrom["B"].size if chrom else 0
    al = achro["L"].size if achro else 0
    rows = []
    for p in parsed:
        c = np.concatenate([p["L"].ravel(), p["A"].ravel(), p["B"].ravel()]) if p["kind"] == "chromatic" else np.zeros(cl)
        a = p["L"].ravel() if p["kind"] == "achromatic" else np.zeros(al)
        rows.append(np.concatenate([c if "chromatic" in kinds else [], a if "achromatic" in kinds else []]))
    return np.array(rows, float)


def features(pks):
    l0 = np.array([[*parse_layer(p["L0"])["p"], parse_layer(p["L0"])["chroma_milli"], parse_layer(p["L0"])["achromatic"]] for p in pks], float)
    l1 = np.array([np.concatenate([q["L"].ravel(), q["A"].ravel(), q["B"].ravel()]) for q in (parse_layer(p["L1"]) for p in pks)], float)
    return {"L0": l0, "L1": l1, "L2": l2_block([p["L2"] for p in pks])}


def wilson(k, n, z=1.96):
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    h = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d
    return [c - h, c + h]


def run_task(source, field, entries, pks, tokens, packets):
    y_names = [e["labels"][field] for e in entries]
    classes = sorted(set(y_names))
    y = np.array([classes.index(v) for v in y_names])
    groups = [e["group"] for e in entries]
    strat = source == "PBC"
    F = features(pks)
    k = len(classes)
    score = lambda X, seeds=range(1, 11): repeated_scores(X, y, groups, strat, k, seeds)
    majority = float(np.bincount(y).max() / len(y))
    res = {"source": source, "task": field, "scope": "in-source only", "images": len(y), "classes": k, "groups": len(set(groups)),
           "majority_rate": majority, "configs": {}, "conditional_value": {}}
    full = None
    for r in range(1, 4):
        for combo in itertools.combinations(LAYERS, r):
            s = score(np.hstack([F[c] for c in combo]))
            res["configs"]["+".join(combo)] = {"accuracy": float(s.mean())}
            if r == 3:
                full = s
            res.setdefault("_scores", {})["+".join(combo)] = s
    tok_mean = {l: float(np.mean([tokens[e["name"]][l] for e in entries])) for l in LAYERS}
    for l in LAYERS:
        rest = "+".join(c for c in LAYERS if c != l)
        b = cluster_boot(full - res["_scores"][rest], groups)
        res["conditional_value"][l] = {**b, "carries_value": b["lo"] > 0, "tokens_mean": tok_mean[l], "value_per_100_tokens": b["mean"] / tok_mean[l] * 100}
    Xfull = np.hstack([F[c] for c in LAYERS])
    ctrl = {}
    for name in ("wrong_image", "shuffled_layer"):
        accs = []
        for d in range(20):
            rng = np.random.default_rng(2000 + d)
            if name == "wrong_image":
                X = Xfull[derangement(len(y), rng)]
            else:
                X = np.hstack([F[c][derangement(len(y), rng)] for c in LAYERS])
            accs.append(float(cv_correct(X, y, groups, 1000 + d, strat, k).mean()))
        m, sd = float(np.mean(accs)), float(np.std(accs, ddof=1))
        ub = m + 1.96 * sd / math.sqrt(20)
        ctrl[name] = {"mean": m, "sd": sd, "upper": ub, "bound": majority + 0.02, "pass": ub <= majority + 0.02,
                      "first_draw_wilson": wilson(round(accs[0] * len(y)), len(y)), "draws": accs}
    res["controls"] = ctrl
    rng = np.random.default_rng(3000)
    noisy = np.where(rng.random(len(y)) < 0.5, rng.integers(0, k, len(y)), y)
    P = np.eye(k)[noisy]
    sp = score(np.hstack([Xfull, P]))
    bp = cluster_boot(sp - full, groups)
    res["positive_control"] = {**bp, "pass": bp["lo"] > 0}
    cg = np.array([[int(c[1:][i:i + 2], 16) for row in json.loads(packets["t7"]["colorGrid16"][e["name"]]) for c in row for i in (0, 2, 4)] for e in entries], float)
    cg_tok = float(np.mean([tokens_cg[e["name"]] for e in entries]))
    n_tok = {n: float(np.mean([tokens_n[e["name"]][str(n)] for e in entries])) for n in N_GRID}
    n_match = min(N_GRID, key=lambda n: (abs(n_tok[n] - cg_tok), n))
    s_cg = score(cg)
    h2h = {"colorGrid16": {"accuracy": float(s_cg.mean()), "tokens_mean": cg_tok}}
    for n in sorted({32, n_match}):
        s_n = score(l2_block([packets["t7"]["l2ByN"][e["name"]][str(n)] for e in entries]))
        h2h[f"oklab_L2_N{n}"] = {"accuracy": float(s_n.mean()), "tokens_mean": n_tok[n], "minus_colorGrid16": cluster_boot(s_n - s_cg, groups)}
    h2h["n_match"] = n_match
    res["head_to_head"] = h2h
    del res["_scores"]
    return res


def main(work):
    global tokens_cg, tokens_n
    index = json.load(open(os.path.join(work, "index.json")))
    packets = json.load(open(os.path.join(work, "out", "packets.json")))
    tok = json.load(open(os.path.join(work, "out", "tokens.json")))
    tokens_cg, tokens_n = tok["colorGrid16"], tok["l2ByN"]
    out = {"result": "t7-task-value", **prereg_hashes(("prereg_sha256", "prereg_t4t7_sha256", "amendment_4_sha256")),
           "tokenizer_sha256": tok["tokenizer_sha256"], "tasks": [], "parser_roundtrip": {}}
    same = total = 0
    for name, pk in packets["base"]["s0"].items():
        for l in LAYERS:
            total += 1
            same += encode_layer(parse_layer(pk[l])) == pk[l]
    out["parser_roundtrip"] = {"same": same, "of": total}
    for source, field in TASKS:
        entries = [e for e in index["corpora"]["s0"] if e["source"] == source]
        pks = [packets["base"]["s0"][e["name"]] for e in entries]
        r = run_task(source, field, entries, pks, tok["base"]["s0"], packets)
        out["tasks"].append(r)
        cv = {l: f"{v['mean']:+.3f} [{v['lo']:+.3f}, {v['hi']:+.3f}]" for l, v in r["conditional_value"].items()}
        print(source, field, "maj", round(r["majority_rate"], 3), {k: round(v["accuracy"], 3) for k, v in r["configs"].items()})
        print("   value", cv)
        print("   controls", {k: (round(v["mean"], 3), round(v["upper"], 3), v["pass"]) for k, v in r["controls"].items()},
              "positive", (round(r["positive_control"]["lo"], 3), r["positive_control"]["pass"]))
        print("   h2h", json.dumps({k: (v if not isinstance(v, dict) else {kk: (round(vv, 3) if isinstance(vv, float) else
                                     {a: round(b, 3) for a, b in vv.items() if a in ("mean", "lo", "hi")}) for kk, vv in v.items()}) for k, v in r["head_to_head"].items()}))
    out["gates"] = {f"{t['source']} {t['task']} {c}": t["controls"][c]["pass"] for t in out["tasks"] for c in t["controls"]}
    out["gates"].update({f"{t['source']} {t['task']} positive": t["positive_control"]["pass"] for t in out["tasks"]})
    print(json.dumps(out["parser_roundtrip"]), json.dumps({k: v for k, v in out["gates"].items() if not v}))
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t7-task-value.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
