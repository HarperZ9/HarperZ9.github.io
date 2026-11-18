"""Score runs.json: reproduction check, old rank rule, fixed-target rank (successes, then aRT), intervals, clipping variants.

Run: python -I analyse.py. Writes analysis.json beside this file.
"""
import json
from pathlib import Path

import numpy as np
from scipy.stats import rankdata

HERE = Path(__file__).resolve().parent
O4B = HERE.parent / "rerun-result.json"  # the published copy of the 31 October rerun result
BASE = ["random", "lbfgs", "de", "cmaes", "sma", "gwo", "pso", "abc", "acor", "iwo"]
NB, ALPHA = 2000, 0.05


def load():
    data = json.loads((HERE / "runs.json").read_text(encoding="utf8"))
    meta, runs = data["meta"], data["runs"]
    funcs = list(dict.fromkeys(r["f"] for r in runs))
    meths = list(dict.fromkeys(r["m"] for r in runs))
    R = meta["reps"]
    best = {f: {m: np.full(R, np.nan) for m in meths} for f in funcs}
    rt = {f: {m: np.zeros(R) for m in meths} for f in funcs}
    ok = {f: {m: np.zeros(R, bool) for m in meths} for f in funcs}
    for r in runs:
        best[r["f"]][r["m"]][r["r"]] = r["best"]
        ok[r["f"]][r["m"]][r["r"]] = r["hit"] is not None
        rt[r["f"]][r["m"]][r["r"]] = r["hit"] if r["hit"] is not None else r["used"]
    return meta, runs, funcs, meths, best, rt, ok


def art(rt, ok):
    n = ok.sum()
    return float(rt.sum() / n) if n else float("inf")


def old_rank(best, funcs, meths, idx=None):
    """units.ranks: rank of rounded log10 median error floored at 1e-12, mean over functions."""
    out = {m: [] for m in meths}
    for f in funcs:
        med = [np.median(best[f][m] if idx is None else best[f][m][idx]) for m in meths]
        for m, x in zip(meths, rankdata(np.round(np.log10(np.maximum(med, 1e-12)), 2))):
            out[m].append(float(x))
    return {m: float(np.mean(v)) for m, v in out.items()}


def new_rank(rt, ok, funcs, meths, idx=None):
    """Per function: more successes first, then smaller aRT; equal (successes, aRT) pairs share the average rank."""
    out = {m: [] for m in meths}
    for f in funcs:
        keys = []
        for m in meths:
            r, o = (rt[f][m], ok[f][m]) if idx is None else (rt[f][m][idx], ok[f][m][idx])
            keys.append((-int(o.sum()), art(r, o)))
        order = sorted(set(keys))
        pos = {k: i for i, k in enumerate(order)}
        cnt = {k: keys.count(k) for k in order}
        start = {}
        acc = 1
        for k in order:
            start[k] = acc
            acc += cnt[k]
        for m, k in zip(meths, keys):
            out[m].append(start[k] + (cnt[k] - 1) / 2)
    return {m: float(np.mean(v)) for m, v in out.items()}


def wilson(k, n, z=1.959964):
    p = k / n
    c = (p + z * z / (2 * n)) / (1 + z * z / n)
    h = z * np.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / (1 + z * z / n)
    return [float(c - h), float(c + h)]


def boot(fn, R, seed):
    rng = np.random.default_rng(seed)
    return [fn(rng.integers(0, R, R)) for _ in range(NB)]


def ci(vals):
    a = np.array(vals, float)
    return [float(np.quantile(a, ALPHA / 2, method="lower")), float(np.quantile(a, 1 - ALPHA / 2, method="higher"))]  # no interpolation, so infinite aRT stays inf


def rank_block(meths, rt, ok, best, funcs, R, seed):
    pt_new, pt_old = new_rank(rt, ok, funcs, meths), old_rank(best, funcs, meths)
    bn = boot(lambda i: new_rank(rt, ok, funcs, meths, i), R, seed)
    bo = boot(lambda i: old_rank(best, funcs, meths, i), R, seed + 1)
    first = {m: float(np.mean([min(b, key=b.get) == m for b in bn])) for m in meths}
    return {"new": pt_new, "new_ci": {m: ci([b[m] for b in bn]) for m in meths},
            "old": pt_old, "old_ci": {m: ci([b[m] for b in bo]) for m in meths}, "p_first_new": first}


def main():
    meta, runs, funcs, meths, best, rt, ok = load()
    R = meta["reps"]
    o4b = json.loads(O4B.read_text(encoding="utf8"))["analysis"]
    rel = [abs(np.median(best[f][m]) - v) / max(abs(v), 1e-300) for f, row in o4b["median_shifted"].items() for m, v in row.items() if v != 0]
    zero_ok = all(np.median(best[f][m]) == 0 for f, row in o4b["median_shifted"].items() for m, v in row.items() if v == 0)
    repro = {"max_rel_diff_median": float(max(rel)), "zeros_match": bool(zero_ok),
             "old_rule_ranks": old_rank(best, funcs, BASE), "o4b_ranks": o4b["rank_shifted"]}
    repro["ranks_match"] = all(abs(repro["old_rule_ranks"][m] - o4b["rank_shifted"][m]) < 1e-9 for m in BASE)
    cells = {f: {m: {"succ": int(ok[f][m].sum()), "succ_ci": wilson(int(ok[f][m].sum()), R), "aRT": art(rt[f][m], ok[f][m]),
                     "aRT_ci": ci(boot(lambda i: art(rt[f][m][i], ok[f][m][i]), R, 7)),
                     "median_rt_succ": float(np.median(rt[f][m][ok[f][m]])) if ok[f][m].any() else None,
                     "median_best": float(np.median(best[f][m]))} for m in meths} for f in funcs}
    blocks = {"A_as_o4b": rank_block(BASE, rt, ok, best, funcs, R, 11)}
    for v in ("cmaes_B_repair", "cmaes_C_evalraw"):
        sub = [v if m == "cmaes" else m for m in BASE]
        b = rank_block(sub, rt, ok, best, funcs, R, 11)
        blocks[v] = {k: {("cmaes" if m == v else m): x for m, x in d.items()} for k, d in b.items()}
    clip = {}
    for v in ("cmaes", "cmaes_B_repair", "cmaes_C_evalraw"):
        rr = [r for r in runs if r["m"] == v]
        clip[v] = {"frac_samples_outside_box": sum(r["nout"] for r in rr) / sum(r["nsamp"] for r in rr),
                   "runs_best_outside_box": sum(not r["best_in_box"] for r in rr),
                   "per_function_outside": {f: sum(r["nout"] for r in rr if r["f"] == f) / sum(r["nsamp"] for r in rr if r["f"] == f) for f in funcs}}
    out = {"meta": meta, "reproduction": repro, "cells": cells, "ranks": blocks, "clip": clip, "bootstrap": {"n": NB, "level": 1 - ALPHA}}
    (HERE / "analysis.json").write_text(json.dumps(out, indent=1), encoding="utf8")
    print(json.dumps({"repro": repro, "A": blocks["A_as_o4b"], "clip": clip}, indent=1))


if __name__ == "__main__":
    main()
