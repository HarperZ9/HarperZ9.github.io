"""Track A T7 v2: task value of each layer on the t7v2 corpus (pre-registration 3).

Block-balanced probe (probe.py with blocks), positive controls at several strengths, wrong-image and
shuffled-layer controls judged against a pairing oracle, saturation rule, head-to-head. Scope: in-source only.
Inputs: <work>/index.json, <work>/out/packets.json, <work>/out/tokens.json.
Writes results/t7v2-task-value.json when TELOS_WRITE_RESULTS=1. CLI: python t7v2_analyze.py <work dir>
"""
import itertools
import json
import math
import os
import sys
from collections import Counter

import numpy as np

from probe import cv_correct, derangement, repeated_scores
from t7_analyze import N_GRID, features, l2_block, wilson
from track_common import cluster_boot, prereg_hashes

TASKS = [("PBC", "cell_class"), ("KATHER2016", "tissue_class"), ("BBBC010", "condition"), ("BBBC010", "channel")]
LAYERS = ("L0", "L1", "L2")
QS = (0.5, 0.25, 0.1)
SATURATED = 0.99
RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def blocks_of(F, names):
    return np.concatenate([[i] * F[n].shape[1] for i, n in enumerate(names)])


def oracle(y, partner_labels):
    """Leave-one-out pairing oracle: each image predicted by the majority true class among the other images
    whose partner label tuple matches its own; ties and empty cells go to the global majority class."""
    glob = Counter(y.tolist()).most_common(1)[0][0]
    keys = [tuple(int(v) for v in row) for row in partner_labels]
    cells = {}
    for k, yi in zip(keys, y):
        cells.setdefault(k, Counter())[int(yi)] += 1
    correct = 0
    for k, yi in zip(keys, y):
        c = cells[k].copy()
        c[int(yi)] -= 1
        top = c.most_common()
        top = [t for t in top if t[1] > 0]
        if not top or (len(top) > 1 and top[0][1] == top[1][1]):
            pred = glob
        else:
            pred = top[0][0]
        correct += pred == yi
    return correct / len(y)


def control(name, F, y, groups, strat, k, majority):
    acc, orc = [], []
    for d in range(20):
        if name == "wrong_image":
            rng = np.random.default_rng(2000 + d)
            p = derangement(len(y), rng)
            X = np.hstack([F[c][p] for c in LAYERS])
            partners = y[p][:, None]
        else:
            rng = np.random.default_rng(2100 + d)
            ps = [derangement(len(y), rng) for _ in LAYERS]
            X = np.hstack([F[c][q] for c, q in zip(LAYERS, ps)])
            partners = np.stack([y[q] for q in ps], 1)
        a = float(cv_correct(X, y, groups, 1000 + d, strat, k, blocks=blocks_of(F, LAYERS)).mean())
        acc.append(a)
        orc.append(oracle(y, partners))
    ex = np.array(acc) - np.array(orc)
    m, sd = float(ex.mean()), float(ex.std(ddof=1))
    am, asd = float(np.mean(acc)), float(np.std(acc, ddof=1))
    ub = m + 1.96 * sd / math.sqrt(20)
    return {"draws": acc, "oracle": orc, "excess_mean": m, "excess_sd": sd, "excess_upper": ub, "pass": ub <= 0.02,
            "v1_statistic": {"mean": am, "upper": am + 1.96 * asd / math.sqrt(20), "bound": majority + 0.02,
                             "pass_v1": am + 1.96 * asd / math.sqrt(20) <= majority + 0.02},
            "first_draw_wilson": wilson(round(acc[0] * len(y)), len(y))}


def planted(y, k, q, dilute=False):
    rng = np.random.default_rng(3000 + round(100 * q))
    noisy = np.where(rng.random(len(y)) < 1 - q, rng.integers(0, k, len(y)), y)
    P = np.eye(k)[noisy]
    if dilute:
        P = np.hstack([P, np.random.default_rng(3100).standard_normal((len(y), 64 - k))])
    return P


def run_task(source, field, entries, pks, tok, packets, tok_all):
    classes = sorted({e["labels"][field] for e in entries})
    y = np.array([classes.index(e["labels"][field]) for e in entries])
    groups = [e["group"] for e in entries]
    strat, k = source == "PBC", len(classes)
    F = features(pks)
    score = lambda names, extra=None: repeated_scores(
        np.hstack([F[n] for n in names] + ([extra] if extra is not None else [])), y, groups, strat, k,
        blocks=np.concatenate([blocks_of(F, names), [len(names)] * (extra.shape[1] if extra is not None else 0)]).astype(int))
    majority = float(np.bincount(y).max() / len(y))
    res = {"source": source, "task": field, "scope": "in-source only", "images": len(y), "classes": classes,
           "groups": len(set(groups)), "majority_rate": majority, "configs": {}, "conditional_value": {}}
    scores = {}
    for r in range(1, 4):
        for combo in itertools.combinations(LAYERS, r):
            s = score(list(combo))
            scores["+".join(combo)] = s
            res["configs"]["+".join(combo)] = {"accuracy": float(s.mean())}
    full = scores["L0+L1+L2"]
    sat = float(full.mean()) >= SATURATED
    res["saturated"] = sat
    tmean = {l: float(np.mean([tok[e["name"]][l] for e in entries])) for l in LAYERS}
    for l in LAYERS:
        b = cluster_boot(full - scores["+".join(c for c in LAYERS if c != l)], groups)
        res["conditional_value"][l] = {**b, "carries_value": (b["lo"] > 0) and not sat, "not_estimable": sat,
                                       "tokens_mean": tmean[l], "value_per_100_tokens": b["mean"] / tmean[l] * 100}
    res["controls"] = {n: control(n, F, y, groups, strat, k, majority) for n in ("wrong_image", "shuffled_layer")}
    pos = {}
    for q in QS:
        b = cluster_boot(score(list(LAYERS), planted(y, k, q)) - full, groups)
        pos[f"P_{q}"] = {**b, "detected": b["lo"] > 0}
    b = cluster_boot(score(list(LAYERS), planted(y, k, 0.5, dilute=True)) - full, groups)
    pos["D_0.5"] = {**b, "detected": b["lo"] > 0}
    det = [q for q in QS if pos[f"P_{q}"]["detected"]]
    res["positive_controls"] = {**pos, "smallest_q_detected": min(det) if det else None,
                                "gate": "not applicable (saturated)" if sat else pos["P_0.5"]["detected"]}
    cg = np.array([[int(c[1:][i:i + 2], 16) for row in json.loads(packets["t7"]["colorGrid16"][e["name"]]) for c in row
                    for i in (0, 2, 4)] for e in entries], float)
    cg_tok = float(np.mean([tok_all["colorGrid16"][e["name"]] for e in entries]))
    n_tok = {n: float(np.mean([tok_all["l2ByN"][e["name"]][str(n)] for e in entries])) for n in N_GRID}
    n_match = min(N_GRID, key=lambda n: (abs(n_tok[n] - cg_tok), n))
    one = lambda X: repeated_scores(X, y, groups, strat, k, blocks=np.zeros(X.shape[1], int))
    s_cg = one(cg)
    h2h = {"colorGrid16": {"accuracy": float(s_cg.mean()), "tokens_mean": cg_tok}, "n_match": n_match}
    for n in sorted({32, n_match}):
        s_n = one(l2_block([packets["t7"]["l2ByN"][e["name"]][str(n)] for e in entries]))
        h2h[f"oklab_L2_N{n}"] = {"accuracy": float(s_n.mean()), "tokens_mean": n_tok[n],
                                 "minus_colorGrid16": cluster_boot(s_n - s_cg, groups)}
    res["head_to_head"] = h2h
    return res


def fmt(b):
    return f"{b['mean']:+.3f} [{b['lo']:+.3f}, {b['hi']:+.3f}]"


def main(work):
    index = json.load(open(os.path.join(work, "index.json")))
    packets = json.load(open(os.path.join(work, "out", "packets.json")))
    tok = json.load(open(os.path.join(work, "out", "tokens.json")))
    out = {"result": "t7v2-task-value", **prereg_hashes(("prereg_sha256", "prereg_t4t7_sha256", "amendment_4_sha256", "prereg_t7v2_sha256")),
           "tokenizer_sha256": tok["tokenizer_sha256"], "repeat_identical": packets["repeatIdentical"], "tasks": []}
    for source, field in TASKS:
        entries = [e for e in index["corpora"]["t7v2"] if e["source"] == source]
        pks = [packets["base"]["t7v2"][e["name"]] for e in entries]
        r = run_task(source, field, entries, pks, tok["base"]["t7v2"], packets, tok)
        out["tasks"].append(r)
        print(source, field, "n", r["images"], "groups", r["groups"], "maj", round(r["majority_rate"], 3), "sat", r["saturated"],
              {c: round(v["accuracy"], 3) for c, v in r["configs"].items()}, flush=True)
        print("   value", {l: fmt(v) for l, v in r["conditional_value"].items()})
        print("   controls", {n: (round(c["excess_mean"], 3), round(c["excess_upper"], 3), c["pass"], round(c["v1_statistic"]["upper"], 3))
                              for n, c in r["controls"].items()})
        print("   positive", {n: fmt(v) for n, v in r["positive_controls"].items() if isinstance(v, dict)},
              "smallest q", r["positive_controls"]["smallest_q_detected"], "gate", r["positive_controls"]["gate"])
        h = r["head_to_head"]
        print("   h2h cg", round(h["colorGrid16"]["accuracy"], 3), round(h["colorGrid16"]["tokens_mean"]),
              {kk: (round(v["accuracy"], 3), round(v["tokens_mean"]), fmt(v["minus_colorGrid16"])) for kk, v in h.items() if kk.startswith("oklab")})
    out["gates"] = {}
    for t in out["tasks"]:
        for n, c in t["controls"].items():
            out["gates"][f"{t['source']} {t['task']} {n}"] = c["pass"]
        out["gates"][f"{t['source']} {t['task']} positive P_0.5"] = t["positive_controls"]["gate"]
    print(json.dumps(out["gates"], indent=1))
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t7v2-task-value.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
