"""F183 rerun (O4b addendum A1): same seeds and budgets, every evaluation counted, success at f_opt + 1e-8.

Loads the original units.py read-only. Run: python -I rerun.py [workers]. Writes runs.json beside this file.
"""
import os

os.environ.setdefault("OMP_NUM_THREADS", "1")
os.environ.setdefault("OPENBLAS_NUM_THREADS", "1")
os.environ.setdefault("MKL_NUM_THREADS", "1")

import hashlib
import importlib.util
import json
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
UNITS = HERE / "units.py"  # the O4b units.py, published beside this file
UNITS_SHA = "4d84c04e68709f3bf77e3fea7c713681b569b08a7308979fb9bc403b25b7f798"
SEED, D, BUDGET, REPS, TARGET = 20261054, 10, 20000, 15, 1e-8


def load_units():
    got = hashlib.sha256(UNITS.read_bytes()).hexdigest()
    if got != UNITS_SHA:
        raise RuntimeError(f"units.py hash {got} differs from the O4b run")
    spec = importlib.util.spec_from_file_location("o4b_units", UNITS)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


U = load_units()


class Traced(U.Problem):
    """units.Problem with an evaluation counter. clip_eval=False evaluates the unclipped point (variant C)."""

    def __init__(self, name, d, budget, rng, shifted, clip_eval=True):
        super().__init__(name, d, budget, rng, shifted)
        self.budget, self.clip_eval = budget, clip_eval
        self.hit, self.nsamp, self.nout = None, 0, 0

    def __call__(self, X):
        X = np.atleast_2d(X)
        Xe = np.clip(X, U.LB, U.UB) if self.clip_eval else X
        if self.left <= 0:
            return np.full(len(X), np.inf)
        n = len(X)
        used = self.budget - self.left
        Xe, Xr = Xe[: self.left], X[: self.left]
        self.left -= len(Xe)
        self.nsamp += len(Xr)
        self.nout += int((np.abs(Xr) > U.UB).any(1).sum())
        v = self.f((Xe - self.s) @ self.R.T)
        i = int(np.argmin(v))
        if v[i] < self.best:
            self.best, self.bx = float(v[i]), Xe[i].copy()
        if self.hit is None:
            k = np.nonzero(v <= TARGET)[0]
            if len(k):
                self.hit = used + int(k[0]) + 1
        return np.r_[v, np.full(n - len(v), np.inf)]


def cmaes_repair(p, rng):
    """Variant B: units.cmaes with the sample repaired (clipped) before evaluation and update. Only the marked lines differ."""
    d = p.d
    LB, UB = U.LB, U.UB
    while p.left > 0:
        lam = 4 + int(3 * np.log(d))
        mu = lam // 2
        w = np.log(mu + 0.5) - np.log(np.arange(1, mu + 1))
        w /= w.sum()
        me = 1 / (w ** 2).sum()
        cc, cs = (4 + me / d) / (d + 4 + 2 * me / d), (me + 2) / (d + me + 5)
        c1 = 2 / ((d + 1.3) ** 2 + me)
        cm = min(1 - c1, 2 * (me - 2 + 1 / me) / ((d + 2) ** 2 + me))
        ds = 1 + 2 * max(0, np.sqrt((me - 1) / (d + 1)) - 1) + cs
        chi = np.sqrt(d) * (1 - 1 / (4 * d) + 1 / (21 * d * d))
        m, s = rng.uniform(LB, UB, d), 60.0
        pc, ps, C = np.zeros(d), np.zeros(d), np.eye(d)
        g = 0
        while p.left > 0 and s > 1e-11 and g < 100000:
            g += 1
            D2, B = np.linalg.eigh((C + C.T) / 2)
            D = np.sqrt(np.maximum(D2, 1e-20))
            Z = rng.normal(size=(lam, d))
            Y = (Z * D) @ B.T
            X = np.clip(m + s * Y, LB, UB)  # changed: repair
            Y = (X - m) / s  # changed: update with the repaired step
            f = p(X)
            if len(f) < lam or not np.isfinite(f).all():
                break
            f = f + 1e4 * (np.maximum(np.abs(X) - UB, 0) ** 2).sum(1) * (1 + np.abs(f))
            o = np.argsort(f)[:mu]
            yw = w @ Y[o]
            m = m + s * yw
            ps = (1 - cs) * ps + np.sqrt(cs * (2 - cs) * me) * (B @ ((B.T @ yw) / D))
            hs = np.linalg.norm(ps) / np.sqrt(1 - (1 - cs) ** (2 * g)) / chi < 1.4 + 2 / (d + 1)
            pc = (1 - cc) * pc + hs * np.sqrt(cc * (2 - cc) * me) * yw
            C = (1 - c1 - cm) * C + c1 * (np.outer(pc, pc) + (not hs) * cc * (2 - cc) * C) + cm * (Y[o].T * w) @ Y[o]
            s *= np.exp((cs / ds) * (np.linalg.norm(ps) / chi - 1))
            s = min(s, 1e3)
            if f.max() - f.min() < 1e-14:
                break


METHODS = {**U.PLAIN, **U.BIO}
VARIANTS = {"cmaes_B_repair": (cmaes_repair, True), "cmaes_C_evalraw": (U.cmaes, False)}


def job(args):
    f, r, s0, m = args
    fn, clip = (METHODS[m], True) if m in METHODS else VARIANTS[m]
    pb = Traced(f, D, BUDGET, np.random.default_rng(s0), True, clip_eval=clip)
    t = time.perf_counter()
    fn(pb, np.random.default_rng(s0 + 1))
    inbox = bool(pb.bx is not None and (np.abs(pb.bx) <= U.UB).all())
    return {"f": f, "r": r, "s0": s0, "m": m, "best": pb.best, "hit": pb.hit, "used": pb.budget - pb.left,
            "nsamp": pb.nsamp, "nout": pb.nout, "best_in_box": inbox, "sec": time.perf_counter() - t}


def jobs():
    rng = np.random.default_rng(SEED)  # same draw order as units.run_grid on the shifted grid
    out = []
    for f in U.FUNCS:
        for r in range(REPS):
            s0 = int(rng.integers(1, 2 ** 31))
            out += [(f, r, s0, m) for m in [*METHODS, *VARIANTS]]
    return out


def main():
    workers = int(sys.argv[1]) if len(sys.argv) > 1 else 8
    J = jobs()
    t = time.perf_counter()
    with ProcessPoolExecutor(max_workers=workers) as ex:
        res = list(ex.map(job, J, chunksize=4))
    meta = {"units_sha256": UNITS_SHA, "seed": SEED, "d": D, "budget": BUDGET, "reps": REPS, "target": TARGET,
            "workers": workers, "wall_s": time.perf_counter() - t, "numpy": np.__version__}
    (HERE / "runs.json").write_text(json.dumps({"meta": meta, "runs": res}, indent=0), encoding="utf8")
    print(f"{len(res)} runs in {meta['wall_s']:.0f} s")


if __name__ == "__main__":
    main()
