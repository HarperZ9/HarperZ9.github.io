"""POST HOC exploration after the pre-registered T7 positive control failed (not a pre-registered result).

The same probe, folds, repeats and bootstrap as t7_analyze.py, with one change: after z-scoring, every
layer block (and the planted block P) is scaled to equal total variance, and the penalty grid is scaled by
the number of blocks instead of the number of features. It asks one question: does a block-balanced
probe detect the planted block? Its numbers change no pre-registered verdict.
Writes results/t7-explore-posthoc.json when TELOS_WRITE_RESULTS=1. CLI: python t7_explore.py <work dir>
"""
import json
import os
import sys

import numpy as np

from probe import repeated_scores
from t7_analyze import LAYERS, TASKS, features
from track_common import cluster_boot, prereg_hashes

RESULTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "results")


def main(work):
    index = json.load(open(os.path.join(work, "index.json")))
    packets = json.load(open(os.path.join(work, "out", "packets.json")))
    out = {"result": "t7-explore-posthoc", "label": "post hoc exploration; not a pre-registered result",
           **prereg_hashes(("prereg_sha256", "prereg_t4t7_sha256", "amendment_4_sha256")), "tasks": []}
    for source, field in TASKS:
        entries = [e for e in index["corpora"]["s0"] if e["source"] == source]
        F = features([packets["base"]["s0"][e["name"]] for e in entries])
        classes = sorted({e["labels"][field] for e in entries})
        y = np.array([classes.index(e["labels"][field]) for e in entries])
        groups = [e["group"] for e in entries]
        k, strat = len(classes), source == "PBC"
        rng = np.random.default_rng(3000)
        noisy = np.where(rng.random(len(y)) < 0.5, rng.integers(0, k, len(y)), y)
        F["P"] = np.eye(k)[noisy]

        def score(names):
            X = np.hstack([F[n] for n in names])
            blocks = np.concatenate([[i] * F[n].shape[1] for i, n in enumerate(names)])
            return repeated_scores(X, y, groups, strat, k, blocks=blocks)
        full = score(LAYERS)
        r = {"source": source, "task": field, "full_accuracy": float(full.mean()), "conditional_value": {}}
        for l in LAYERS:
            r["conditional_value"][l] = cluster_boot(full - score([c for c in LAYERS if c != l]), groups)
        r["positive_control"] = cluster_boot(score(list(LAYERS) + ["P"]) - full, groups)
        out["tasks"].append(r)
        print(source, field, round(r["full_accuracy"], 3), {l: f"{v['mean']:+.3f} [{v['lo']:+.3f}, {v['hi']:+.3f}]" for l, v in r["conditional_value"].items()},
              "P", f"{r['positive_control']['mean']:+.3f} [{r['positive_control']['lo']:+.3f}, {r['positive_control']['hi']:+.3f}]")
    if os.environ.get("TELOS_WRITE_RESULTS") == "1":
        json.dump(out, open(os.path.join(RESULTS, "t7-explore-posthoc.json"), "w"), indent=1)


if __name__ == "__main__":
    main(sys.argv[1])
