"""POST HOC diagnostic after the pre-registered T7 v2 controls failed on both BBBC010 tasks (not a
pre-registered result; changes no verdict).

Question: is the failure a leak, or a bias of the leave-one-out pairing oracle? On a binary task with nearly
balanced cells, removing an image from its own cell tips the cell majority against that image, so the
leave-one-out oracle falls below chance and the excess (accuracy minus oracle) rises without any leak. This
script regenerates the same derangements (same seeds as t7v2_analyze.py) and recomputes, per draw, (a) the
pre-registered leave-one-out oracle, (b) the in-sample cell-majority oracle (no image removed), and (c) the
excess of the recorded accuracy over each.
Writes results/t7v2-oracle-posthoc.json when TELOS_WRITE_RESULTS=1. CLI: python t7v2_oracle_posthoc.py <work>
"""
import json
import math
import os
import sys
from collections import Counter

import numpy as np

from probe import derangement
from t7v2_analyze import LAYERS, TASKS, oracle

RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def in_sample(y, partners):
    keys = [tuple(int(v) for v in r) for r in partners]
    cells = {}
    for k, yi in zip(keys, y):
        cells.setdefault(k, Counter())[int(yi)] += 1
    return sum(cells[k].most_common(1)[0][0] == yi for k, yi in zip(keys, y)) / len(y)


def main(work):
    index = json.load(open(os.path.join(work, "index.json")))
    rec = json.load(open(os.path.join(RESULTS, "t7v2-task-value.json")))
    out = {"result": "t7v2-oracle-posthoc", "label": "post hoc diagnostic; changes no pre-registered verdict", "tasks": []}
    for (source, field), t in zip(TASKS, rec["tasks"]):
        entries = [e for e in index["corpora"]["t7v2"] if e["source"] == source]
        classes = sorted({e["labels"][field] for e in entries})
        y = np.array([classes.index(e["labels"][field]) for e in entries])
        r = {"source": source, "task": field}
        for name in ("wrong_image", "shuffled_layer"):
            loo, ins = [], []
            for d in range(20):
                if name == "wrong_image":
                    p = derangement(len(y), np.random.default_rng(2000 + d))
                    partners = y[p][:, None]
                else:
                    rng = np.random.default_rng(2100 + d)
                    partners = np.stack([y[derangement(len(y), rng)] for _ in LAYERS], 1)
                loo.append(oracle(y, partners))
                ins.append(in_sample(y, partners))
            acc = np.array(t["controls"][name]["draws"])
            assert np.allclose(loo, t["controls"][name]["oracle"]), "derangements do not reproduce the recorded oracle"
            ex = acc - np.array(ins)
            r[name] = {"mean_accuracy": float(acc.mean()), "loo_oracle_mean": float(np.mean(loo)),
                       "in_sample_oracle_mean": float(np.mean(ins)), "excess_in_sample_mean": float(ex.mean()),
                       "excess_in_sample_upper": float(ex.mean() + 1.96 * ex.std(ddof=1) / math.sqrt(20))}
        out["tasks"].append(r)
        print(source, field, json.dumps({k: {kk: round(vv, 4) for kk, vv in v.items()} for k, v in r.items() if isinstance(v, dict)}))
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t7v2-oracle-posthoc.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
