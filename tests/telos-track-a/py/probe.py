"""Linear probe for Track A T7 (pre-registration 2, section T7): one-vs-rest ridge classifier.

z-scored features (training-fold statistics, zero-variance features dropped), one-hot targets with an
unpenalised intercept, penalty lambda = c p chosen inside the training fold from C_GRID by leave-one-out
accuracy through the ridge hat-matrix identity (exact for the fit given the fold's scaling; the scaling
itself is not re-estimated per left-out row), ties to the larger c. Outer loop: 5-fold group
cross-validation, repeated with seeds 1 to 10.
"""
import numpy as np

C_GRID = (1e-3, 1e-2, 1e-1, 1.0, 10.0, 100.0)


def _standardize(Xtr, Xte, blocks=None):
    mu, sd = Xtr.mean(0), Xtr.std(0)
    keep = sd > 0
    Ztr, Zte = (Xtr[:, keep] - mu[keep]) / sd[keep], (Xte[:, keep] - mu[keep]) / sd[keep]
    if blocks is not None:  # post hoc exploration only: each block scaled to equal total variance
        b = np.asarray(blocks)[keep]
        scale = np.array([1.0 / np.sqrt((b == v).sum()) for v in b])
        Ztr, Zte = Ztr * scale, Zte * scale
    return Ztr, Zte


def fit_predict(Xtr, ytr, Xte, n_classes, blocks=None):
    """Return predicted class indices for Xte."""
    Ztr, Zte = _standardize(Xtr, Xte, blocks)
    n, p = Ztr.shape
    Y = np.eye(n_classes)[ytr]
    ybar = Y.mean(0)
    Yc = Y - ybar
    if p == 0:
        return np.full(len(Xte), int(np.argmax(ybar)))
    K = Ztr @ Ztr.T
    evals, U = np.linalg.eigh(K)
    evals = np.clip(evals, 0, None)
    UtY = U.T @ Yc
    best = None
    p_pen = len(set(np.asarray(blocks).tolist())) if blocks is not None else p  # exploration: total variance = blocks
    for c in C_GRID:
        lam = c * p_pen
        shrink = evals / (evals + lam)
        Hc = (U * shrink) @ U.T
        fitted = Hc @ Yc + ybar
        hdiag = np.diag(Hc) + 1.0 / n
        loo = Y - (Y - fitted) / (1.0 - hdiag)[:, None]
        acc = float((loo.argmax(1) == ytr).mean())
        if best is None or acc >= best[0]:
            best = (acc, lam)
    lam = best[1]
    alpha = U @ (UtY / (evals + lam)[:, None])
    scores = (Zte @ Ztr.T) @ alpha + ybar
    return scores.argmax(1)


def folds(groups, labels, seed, k=5, stratify=False):
    """Fold index per row. Groups go to folds by a seeded shuffle, dealt round-robin. With stratify (rows
    are their own groups), rows are dealt round-robin within each class."""
    rng = np.random.default_rng(seed)
    f = np.empty(len(groups), int)
    if stratify:
        for cls in sorted(set(labels)):
            idx = np.array([i for i, y in enumerate(labels) if y == cls])
            idx = idx[rng.permutation(len(idx))]
            start = rng.integers(0, k)
            for j, i in enumerate(idx):
                f[i] = (start + j) % k
        return f
    keys = sorted(set(groups))
    order = [keys[i] for i in rng.permutation(len(keys))]
    gf = {g: j % k for j, g in enumerate(order)}
    return np.array([gf[g] for g in groups])


def cv_correct(X, y, groups, seed, stratify, n_classes, blocks=None):
    """Correctness (0/1) of every row under one outer 5-fold cross-validation."""
    f = folds(groups, y, seed, stratify=stratify)
    correct = np.zeros(len(y))
    for k in range(5):
        te, tr = f == k, f != k
        if te.sum() == 0:
            continue
        correct[te] = fit_predict(X[tr], y[tr], X[te], n_classes, blocks) == y[te]
    return correct


def repeated_scores(X, y, groups, stratify, n_classes, seeds=range(1, 11), blocks=None):
    """Each row's mean correctness over the repeats."""
    return np.mean([cv_correct(X, y, groups, s, stratify, n_classes, blocks) for s in seeds], axis=0)


def derangement(n, rng):
    while True:
        p = rng.permutation(n)
        if not np.any(p == np.arange(n)):
            return p
