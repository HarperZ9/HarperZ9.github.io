"""Bio-inspired against plain optimisers with known optima, shifted and rotated, plus a shuffled no-free-lunch landscape and a centre-cheat dummy."""
import numpy as np
from scipy.optimize import minimize

LB, UB = -100.0, 100.0


# ---- objectives on z = R(x - s). All have optimum value 0 at x = s.
def sphere(z):
    return (z ** 2).sum(-1)


def ellipsoid(z):
    d = z.shape[-1]
    return ((10 ** (6 * np.arange(d) / (d - 1))) * z ** 2).sum(-1)


def rosenbrock(z):
    z = z + 1
    return (100 * (z[..., 1:] - z[..., :-1] ** 2) ** 2 + (z[..., :-1] - 1) ** 2).sum(-1)


def rastrigin(z):
    z = z * 0.0512
    return (z ** 2 - 10 * np.cos(2 * np.pi * z) + 10).sum(-1)


def ackley(z):
    z = z * 0.32
    d = z.shape[-1]
    return -20 * np.exp(-0.2 * np.sqrt((z ** 2).sum(-1) / d)) - np.exp(np.cos(2 * np.pi * z).sum(-1) / d) + 20 + np.e


def griewank(z):
    z = z * 6
    i = np.sqrt(np.arange(1, z.shape[-1] + 1))
    return (z ** 2).sum(-1) / 4000 - np.cos(z / i).prod(-1) + 1


def schaffer(z):
    s = (z ** 2).sum(-1) ** 0.5
    return s ** 0.5 * (1 + np.sin(50 * s ** 0.2) ** 2) * 0 + (s ** 0.5) * (1 + np.sin(50 * (s + 1e-300) ** 0.2) ** 2)


FUNCS = {"sphere": sphere, "ellipsoid": ellipsoid, "rosenbrock": rosenbrock, "rastrigin": rastrigin, "ackley": ackley, "griewank": griewank, "schaffer": schaffer}


class Problem:
    def __init__(self, name, d, budget, rng, shifted):
        self.f, self.d, self.left = FUNCS[name], d, budget
        self.best = np.inf
        self.s = rng.uniform(-70, 70, d) if shifted else np.zeros(d)
        self.R = np.linalg.qr(rng.normal(size=(d, d)))[0] if shifted else np.eye(d)
        self.bx = None

    def __call__(self, X):
        X = np.clip(np.atleast_2d(X), LB, UB)
        if self.left <= 0:
            return np.full(len(X), np.inf)
        n = len(X)
        X = X[: self.left]
        self.left -= len(X)
        v = self.f((X - self.s) @ self.R.T)
        i = int(np.argmin(v))
        if v[i] < self.best:
            self.best, self.bx = float(v[i]), X[i].copy()
        return np.r_[v, np.full(n - len(v), np.inf)]


class Hash(Problem):
    """Shuffled landscape: each cell of a coarse grid gets an independent value, no structure to exploit. Optimum unknown; only ties are the test."""
    def __init__(self, d, budget, rng):
        self.d, self.left, self.best, self.bx = d, budget, np.inf, None
        self.key = rng.integers(1, 2 ** 31, d)
        self.seen = {}

    def __call__(self, X):
        X = np.clip(np.atleast_2d(X), LB, UB)
        if self.left <= 0:
            return np.full(len(X), np.inf)
        n = len(X)
        X = X[: self.left]
        self.left -= len(X)
        c = np.floor(X).astype(np.int64)
        h = (c * self.key).sum(-1) % 2147483647
        v = ((h * 48271) % 2147483647) / 2147483647
        self.best = min(self.best, float(v.min()))
        for ci, vi in zip(map(tuple, c.tolist()), v.tolist()):
            self.seen.setdefault(ci, vi)
        return np.r_[v, np.full(n - len(v), np.inf)]


# ---- plain methods
def random_search(p, rng):
    while p.left > 0:
        p(rng.uniform(LB, UB, (min(200, p.left), p.d)))


def lbfgs_restart(p, rng):
    def fun(x):
        v = p(x)[0]
        return float(v) if np.isfinite(v) else 1e300
    while p.left > 0:
        minimize(fun, rng.uniform(LB, UB, p.d), method="L-BFGS-B", bounds=[(LB, UB)] * p.d, options={"maxfun": p.left + 1, "maxiter": 10000})


def de(p, rng, np_=None):
    n = np_ or 10 * p.d
    X = rng.uniform(LB, UB, (n, p.d))
    f = p(X)
    while p.left > 0:
        a, b, c = [rng.permuted(np.arange(n)) for _ in range(3)]
        V = np.clip(X[a] + 0.5 * (X[b] - X[c]), LB, UB)
        m = rng.random((n, p.d)) < 0.9
        m[np.arange(n), rng.integers(0, p.d, n)] = True
        U = np.where(m, V, X)
        fu = p(U)
        k = fu < f
        X[k], f[k] = U[k], fu[k]


def cmaes(p, rng):
    d = p.d
    while p.left > 0:  # IPOP-free restarts
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
            X = m + s * Y
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


# ---- bio-labelled methods, from the published update rules
def sma(p, rng, n=30, z=0.03):
    """Slime mould algorithm, Li et al. 2020, eqs 2.1 to 2.7 as read."""
    X = rng.uniform(LB, UB, (n, p.d))
    T = max(1, p.left // n)
    t = 0
    bx, bf = X[0].copy(), np.inf
    while p.left > 0:
        t += 1
        S = p(X)
        if not np.isfinite(S).all():
            break
        i = int(np.argmin(S))
        if S[i] < bf:
            bf, bx = float(S[i]), X[i].copy()
        o = np.argsort(S)
        bF, wF = S[o[0]], S[o[-1]]
        rat = (bF - S) / (bF - wF - 1e-300)
        W = np.zeros((n, p.d))
        r = rng.random((n, p.d))
        L = np.log10(rat + 1)[:, None]
        top = np.zeros(n, bool)
        top[o[: n // 2]] = True
        W[top] = 1 + (r * L)[top]
        W[~top] = 1 - (r * L)[~top]
        a = np.arctanh(np.clip(1 - t / (T + 1), 1e-9, 1 - 1e-9))
        b = 1 - t / (T + 1)
        pp = np.tanh(np.abs(S - bf))
        Y = np.zeros_like(X)
        for k in range(n):
            if rng.random() < z:
                Y[k] = rng.uniform(LB, UB, p.d)
                continue
            A, B = rng.integers(0, n, 2)
            vb = rng.uniform(-a, a, p.d)
            vc = rng.uniform(-b, b, p.d)
            Y[k] = np.where(rng.random(p.d) < pp[k], bx + vb * (W[k] * X[A] - W[k] * X[B]), vc * X[k])
        X = np.clip(Y, LB, UB)


def gwo(p, rng, n=30):
    """Grey wolf optimizer, Mirjalili 2014. Niu 2019 reports a defect at the origin."""
    X = rng.uniform(LB, UB, (n, p.d))
    T = max(1, p.left // n)
    t = 0
    while p.left > 0:
        t += 1
        f = p(X)
        if not np.isfinite(f).all():
            break
        o = np.argsort(f)[:3]
        lead = X[o].copy()
        a = 2 * (1 - t / T)
        Y = 0
        for L in lead:
            A = 2 * a * rng.random((n, p.d)) - a
            Cc = 2 * rng.random((n, p.d))
            Y = Y + (L - A * np.abs(Cc * L - X))
        X = np.clip(Y / 3, LB, UB)


def pso(p, rng, n=40):
    X = rng.uniform(LB, UB, (n, p.d))
    V = rng.uniform(-20, 20, (n, p.d))
    P, fP = X.copy(), p(X)
    while p.left > 0:
        g = P[np.argmin(fP)]
        V = 0.729 * V + 1.494 * rng.random((n, p.d)) * (P - X) + 1.494 * rng.random((n, p.d)) * (g - X)
        X = np.clip(X + V, LB, UB)
        f = p(X)
        k = f < fP
        P[k], fP[k] = X[k], f[k]


def abc(p, rng, n=25, lim=None):
    """Artificial bee colony, Karaboga and Basturk 2007."""
    lim = lim or n * p.d
    X = rng.uniform(LB, UB, (n, p.d))
    f = p(X)
    tr = np.zeros(n)

    def step(idx):
        for i in idx:
            if p.left <= 0:
                return
            j, k = rng.integers(p.d), rng.integers(n)
            Y = X[i].copy()
            Y[j] = np.clip(Y[j] + rng.uniform(-1, 1) * (X[i, j] - X[k, j]), LB, UB)
            v = p(Y)[0]
            if v < f[i]:
                X[i], f[i], tr[i] = Y, v, 0
            else:
                tr[i] += 1
    while p.left > 0:
        step(range(n))
        w = 1 / (1 + f - f.min())
        step(rng.choice(n, n, p=w / w.sum()))
        for i in np.where(tr > lim)[0]:
            if p.left > 0:
                X[i] = rng.uniform(LB, UB, p.d)
                f[i], tr[i] = p(X[i])[0], 0


def acor(p, rng, k=50, m=10, q=0.1, xi=0.85):
    """Ant colony for continuous domains, Socha and Dorigo 2008."""
    X = rng.uniform(LB, UB, (k, p.d))
    f = p(X)
    w = np.exp(-np.arange(k) ** 2 / (2 * (q * k) ** 2))
    w /= w.sum()
    while p.left > 0:
        o = np.argsort(f)
        X, f = X[o], f[o]
        l = rng.choice(k, m, p=w)
        s = xi * np.abs(X[None] - X[l][:, None]).sum(1) / (k - 1)
        Y = np.clip(X[l] + s * rng.normal(size=(m, p.d)), LB, UB)
        fy = p(Y)
        A = np.vstack([X, Y])
        F = np.r_[f, fy]
        o = np.argsort(F)[:k]
        X, f = A[o], F[o]


def iwo(p, rng, n0=10, nmax=30, smin=0, smax=5, e=3.0):
    """Invasive weed optimization, Mehrabian and Lucas 2006: the plant growth and seeding method."""
    X = rng.uniform(LB, UB, (n0, p.d))
    f = p(X)
    T = max(1, p.left // (nmax * 3))
    t = 0
    while p.left > 0:
        t += 1
        sd = ((max(T - t, 0) / T) ** e) * (0.5 * (UB - LB) - 0.001) + 0.001
        rg = f.max() - f.min() + 1e-300
        ns = np.floor(smin + (smax - smin) * (f.max() - f) / rg).astype(int)
        S = np.clip(np.repeat(X, ns, axis=0) + rng.normal(0, sd, (ns.sum(), p.d)), LB, UB)
        if not len(S):
            S = np.clip(X + rng.normal(0, sd, X.shape), LB, UB)
        fs = p(S)
        A, F = np.vstack([X, S]), np.r_[f, fs]
        o = np.argsort(F)[:nmax]
        X, f = A[o], F[o]


def centre_cheat(p, rng):
    """Control. Samples only near the box centre. It finds an origin optimum at once, and nothing else."""
    while p.left > 0:
        p(rng.normal(0, 1e-3, (min(200, p.left), p.d)))


PLAIN = {"random": random_search, "lbfgs": lbfgs_restart, "de": de, "cmaes": cmaes}
BIO = {"sma": sma, "gwo": gwo, "pso": pso, "abc": abc, "acor": acor, "iwo": iwo}


def run_grid(rng, d, budget, reps, shifted, methods, funcs=FUNCS):
    out = {f: {m: [] for m in methods} for f in funcs}
    for f in funcs:
        for r in range(reps):
            s0 = int(rng.integers(1, 2 ** 31))
            for m, fn in methods.items():
                # same shift and rotation for every method within a repetition
                prng = np.random.default_rng(s0)
                pb = Problem(f, d, budget, prng, shifted)
                fn(pb, np.random.default_rng(s0 + 1 + abs(hash(m)) % 1000 if False else s0 + 1))
                out[f][m].append(pb.best)
    return out


def ranks(table, methods):
    """Mean rank of each method per function, ties averaged, on medians."""
    from scipy.stats import rankdata
    res = {m: [] for m in methods}
    for f, row in table.items():
        med = [np.median(row[m]) for m in methods]
        rk = rankdata(np.round(np.log10(np.maximum(med, 1e-12)), 2))
        for m, x in zip(methods, rk):
            res[m].append(float(x))
    return {m: float(np.mean(v)) for m, v in res.items()}


def analysis(ctx):
    P = ctx["params"]
    rng = ctx["rng"]
    allm = {**PLAIN, **BIO}
    names = list(allm)
    d, B, reps = P["d"], P["budget"], P["reps"]
    sh = run_grid(rng, d, B, reps, True, allm)
    un = run_grid(rng, d, B, reps, False, {**allm, "centre_cheat": centre_cheat})
    cheat_sh = run_grid(rng, d, B, reps, True, {"centre_cheat": centre_cheat})
    rk_sh, rk_un = ranks(sh, names), ranks({f: {m: un[f][m] for m in names} for f in un}, names)
    plain_rank, bio_rank = float(np.mean([rk_sh[m] for m in PLAIN])), float(np.mean([rk_sh[m] for m in BIO]))
    best_plain_excl = float(min(rk_sh[m] for m in ("de", "cmaes", "lbfgs")))
    best_bio = min(BIO, key=lambda m: rk_sh[m])
    # wins of each bio method over best plain per function, by median
    wins = {m: sum(np.median(sh[f][m]) < min(np.median(sh[f][k]) for k in PLAIN) * 0.99 and min(np.median(sh[f][k]) for k in PLAIN) > 1e-10 for f in sh) for m in BIO}
    ctx["state"].update(sh=sh, rk_sh=rk_sh)
    bias = {m: float(np.median([np.log10(max(np.median(sh[f][m]), 1e-12)) - np.log10(max(np.median(un[f][m]), 1e-12)) for f in sh])) for m in names}
    # planted: sphere must reach near zero with cmaes, de on the shifted problem
    planted = {"cmaes_sphere": float(np.median(sh["sphere"]["cmaes"])), "cheat_unshifted_sphere": float(np.median(un["sphere"]["centre_cheat"])),
               "cheat_shifted_sphere_log10": float(np.log10(np.median(cheat_sh["sphere"]["centre_cheat"])))}
    # no-free-lunch shuffled landscape
    nfl = {m: [] for m in names}
    nfl_d, nfl_n = {m: [] for m in names}, {m: [] for m in names}
    for r in range(P["nfl_reps"]):
        s0 = int(rng.integers(1, 2 ** 31))
        for m, fn in allm.items():
            pb = Hash(d, P["nfl_budget"], np.random.default_rng(s0))
            fn(pb, np.random.default_rng(s0 + 1))
            nfl[m].append(pb.best)
            first = list(pb.seen.values())[: P["nfl_distinct"]]
            nfl_d[m].append(min(first))
            nfl_n[m].append(len(pb.seen))
    nfl_med = {m: float(np.median(v)) for m, v in nfl.items()}
    from scipy.stats import kruskal
    kw = kruskal(*[nfl[m] for m in names if m != "lbfgs"])
    kw2 = kruskal(*[nfl_d[m] for m in names if m != "lbfgs"])
    excl = [m for m in PLAIN if m != "random"]
    plain_nr = float(np.mean([rk_sh[m] for m in excl]))
    return {"nfl_distinct_kw_p": float(kw2.pvalue), "nfl_distinct_cells": {m: float(np.median(v)) for m, v in nfl_n.items()}, "plain_no_random_rank": plain_nr, "gap_plain_nr_minus_bio": bio_rank - plain_nr, "cma_rank": rk_sh["cmaes"], "pso_rank": rk_sh["pso"], "rank_shifted": rk_sh, "rank_unshifted": rk_un, "plain_mean_rank": plain_rank, "bio_mean_rank": bio_rank, "best_bio": best_bio, "best_bio_rank": rk_sh[best_bio],
            "best_plain_rank": best_plain_excl, "bio_wins_per_function": wins, "bio_wins_max": max(wins.values()), "shift_penalty_log10": bias, "sma_penalty": bias["sma"], "gwo_penalty": bias["gwo"],
            "cmaes_penalty": bias["cmaes"], "de_penalty": bias["de"], "planted": planted,
            "median_shifted": {f: {m: float(np.median(sh[f][m])) for m in names} for f in sh}, "median_unshifted": {f: {m: float(np.median(un[f][m])) for m in names} for f in un},
            "nfl_median": nfl_med, "nfl_kw_p": float(kw.pvalue), "gap_plain_minus_bio_rank": bio_rank - plain_rank, "gap_bestplain_bestbio": rk_sh[best_bio] - best_plain_excl}


def shuffle_labels(ctx, a):
    """Method labels permuted within each function on shifted medians: what bio minus plain mean rank looks like by chance."""
    rng = ctx["rng"]
    from scipy.stats import rankdata
    sh = ctx["state"]["sh"]
    names = list(next(iter(sh.values())))
    R = np.array([rankdata(np.round(np.log10(np.maximum([np.median(sh[f][m]) for m in names], 1e-12)), 2)) for f in sh])
    bio = [i for i, m in enumerate(names) if m in BIO]
    pl = [i for i, m in enumerate(names) if m in PLAIN]
    out = []
    for _ in range(int(ctx["params"]["n"])):
        Q = np.array([rng.permutation(r) for r in R])
        out.append(float(Q[:, bio].mean() - Q[:, pl].mean()))
    return out
