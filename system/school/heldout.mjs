// Lesson F6, "Overfitting and the held-out set". Pylon memorises one harbour
// so well she cannot find her way in another.
//
// Part one fits polynomials of degree 0 to 15 by least squares to sixteen
// noisy samples of a known smooth curve, and scores each fit on the points
// it was fitted to and on a larger held-out draw from the same source.
//
// The solver is Householder QR on the design matrix, never forming A^T A:
//   G. H. Golub, "Numerical methods for solving linear least squares
//   problems", Numerische Mathematik 7 (1965), 206-216;
//   G. H. Golub, C. F. Van Loan, Matrix Computations, 4th ed. (2013), 5.3.
// Ridge regularisation (A. E. Hoerl, R. W. Kennard, Technometrics 12 (1970),
// 55-67) minimises |A c - y|^2 + lambda |P c|^2, where P leaves the constant
// term unpenalised. It is solved by the same QR on A stacked over
// sqrt(lambda) P, which solves the ridge normal equations
//   (A^T A + lambda P^T P) c = A^T y
// without forming them. Forming A^T A squares the condition number, so the
// Cholesky route on the normal equations is kept only as a comparison.
// residualCheck() measures how well a solution satisfies those normal
// equations; it is the test every solve here must pass.
//
// Part two (spiral network on 40 points against 400) and part three (the
// attention model's own curves) are below. Plain ES module, Node and browser.

import { rng, gauss } from "./tinyformer-ops.mjs";
import { twoSpirals, createNet } from "./backprop.mjs";
import { trainNet } from "./optimisers-train.mjs";
import { makeBatch } from "./corpus.mjs";

// --- data ---------------------------------------------------------------------
// The smooth curve the samples come from, and the noise on each sample.
export const TRUTH = Object.freeze({ f: (x) => Math.sin(Math.PI * x), label: "sin(pi x) on [-1, 1]", sigma: 0.2 });

export function samples(n, seed, { sigma = TRUTH.sigma, f = TRUTH.f } = {}) {
  const r = rng(seed), x = [], y = [];
  for (let i = 0; i < n; i++) { const xi = -1 + 2 * r(); x.push(xi); y.push(f(xi) + sigma * gauss(r)); }
  return { x, y };
}

// Design matrix, row-major m x (degree + 1): columns 1, x, x^2, ...
export function design(x, degree) {
  const n = degree + 1, A = new Float64Array(x.length * n);
  for (let i = 0; i < x.length; i++) { let p = 1; for (let j = 0; j < n; j++) { A[i * n + j] = p; p *= x[i]; } }
  return A;
}

export function polyval(c, x) { let s = 0; for (let j = c.length - 1; j >= 0; j--) s = s * x + c[j]; return s; }

// --- solvers ------------------------------------------------------------------
// Least squares by Householder QR. A is m x n row-major (m >= n after
// stacking), y length m. lambda > 0 stacks sqrt(lambda) on the diagonal of
// rows for columns 1..n-1 (the constant is not penalised). Returns the
// coefficients and the ratio max|R_jj| / min|R_jj|, a lower bound on the
// condition number of the (stacked) matrix.
export function lstsqQR(A, y, m, n, lambda = 0) {
  const extra = lambda > 0 ? n - 1 : 0, M = m + extra;
  const R = new Float64Array(M * n), b = new Float64Array(M);
  R.set(A.subarray(0, m * n)); b.set(y.slice(0, m));
  for (let j = 1; j <= extra; j++) R[(m + j - 1) * n + j] = Math.sqrt(lambda);
  for (let k = 0; k < n; k++) {
    let norm = 0;
    for (let i = k; i < M; i++) norm += R[i * n + k] ** 2;
    norm = Math.sqrt(norm);
    if (norm === 0) continue;
    const alpha = R[k * n + k] > 0 ? -norm : norm, v = new Float64Array(M - k);
    for (let i = k; i < M; i++) v[i - k] = R[i * n + k];
    v[0] -= alpha;
    const vv = v.reduce((s, t) => s + t * t, 0);
    if (vv === 0) continue;
    for (let j = k; j < n; j++) {
      let d = 0;
      for (let i = k; i < M; i++) d += v[i - k] * R[i * n + j];
      const f = 2 * d / vv;
      for (let i = k; i < M; i++) R[i * n + j] -= f * v[i - k];
    }
    let d = 0;
    for (let i = k; i < M; i++) d += v[i - k] * b[i];
    const f = 2 * d / vv;
    for (let i = k; i < M; i++) b[i] -= f * v[i - k];
  }
  const c = new Float64Array(n);
  for (let k = n - 1; k >= 0; k--) {
    let s = b[k];
    for (let j = k + 1; j < n; j++) s -= R[k * n + j] * c[j];
    c[k] = s / R[k * n + k];
  }
  const diag = Array.from({ length: n }, (_, k) => Math.abs(R[k * n + k]));
  return { c, rDiagRatio: Math.max(...diag) / Math.min(...diag) };
}

// The comparison route: form A^T A + lambda P^T P and A^T y, then Cholesky.
export function lstsqCholesky(A, y, m, n, lambda = 0) {
  const G = new Float64Array(n * n), r = new Float64Array(n);
  for (let i = 0; i < m; i++) for (let a = 0; a < n; a++) { r[a] += A[i * n + a] * y[i]; for (let b = 0; b < n; b++) G[a * n + b] += A[i * n + a] * A[i * n + b]; }
  for (let j = 1; j < n; j++) G[j * n + j] += lambda;
  const L = new Float64Array(n * n);
  for (let j = 0; j < n; j++) {
    let s = G[j * n + j];
    for (let k = 0; k < j; k++) s -= L[j * n + k] ** 2;
    if (!(s > 0)) return { c: new Float64Array(n).fill(NaN), failed: true };
    L[j * n + j] = Math.sqrt(s);
    for (let i = j + 1; i < n; i++) { let t = G[i * n + j]; for (let k = 0; k < j; k++) t -= L[i * n + k] * L[j * n + k]; L[i * n + j] = t / L[j * n + j]; }
  }
  const z = new Float64Array(n), c = new Float64Array(n);
  for (let i = 0; i < n; i++) { let s = r[i]; for (let k = 0; k < i; k++) s -= L[i * n + k] * z[k]; z[i] = s / L[i * n + i]; }
  for (let i = n - 1; i >= 0; i--) { let s = z[i]; for (let k = i + 1; k < n; k++) s -= L[k * n + i] * c[k]; c[i] = s / L[i * n + i]; }
  return { c, failed: false };
}

// How far c is from satisfying (A^T A + lambda P^T P) c = A^T y, relative to
// the size of the terms: |A^T (A c - y) + lambda P c| / (|A|_F (|A|_F |c| + |y|)).
// A backward-stable solve gives a number near machine epsilon times a modest
// factor; a wrong system gives a number near 1.
export function residualCheck(A, y, m, n, c, lambda = 0) {
  const res = new Float64Array(m);
  let fro = 0, ny = 0, nc = 0;
  for (let i = 0; i < m; i++) { let s = -y[i]; for (let j = 0; j < n; j++) { s += A[i * n + j] * c[j]; fro += A[i * n + j] ** 2; } res[i] = s; ny += y[i] ** 2; }
  for (let j = 0; j < n; j++) nc += c[j] ** 2;
  let g = 0;
  for (let j = 0; j < n; j++) { let s = j > 0 ? lambda * c[j] : 0; for (let i = 0; i < m; i++) s += A[i * n + j] * res[i]; g += s * s; }
  fro = Math.sqrt(fro);
  return Math.sqrt(g) / (fro * (fro * Math.sqrt(nc) + Math.sqrt(ny)));
}

export function rmse(c, x, y) { let s = 0; for (let i = 0; i < x.length; i++) s += (polyval(c, x[i]) - y[i]) ** 2; return Math.sqrt(s / x.length); }

// Fit one degree (and ridge strength) and score it: train RMSE, held-out
// RMSE, and RMSE against the noise-free curve on a 401-point grid.
export function fitAndScore(train, held, degree, lambda = 0, { solver = "qr" } = {}) {
  const n = degree + 1, m = train.x.length, A = design(train.x, degree);
  const sol = solver === "qr" ? lstsqQR(A, train.y, m, n, lambda) : lstsqCholesky(A, train.y, m, n, lambda);
  const gx = Array.from({ length: 401 }, (_, i) => -1 + i / 200);
  return { degree, lambda, c: Array.from(sol.c), rDiagRatio: sol.rDiagRatio ?? null,
    residual: residualCheck(A, train.y, m, n, sol.c, lambda),
    trainRmse: rmse(sol.c, train.x, train.y), heldRmse: rmse(sol.c, held.x, held.y), truthRmse: rmse(sol.c, gx, gx.map(TRUTH.f)),
    coefNorm: Math.hypot(...sol.c) };
}

export const POLY = Object.freeze({ nTrain: 16, nHeld: 500, trainSeed: 21, heldSeed: 22, maxDegree: 15, lambdas: [0, 1e-8, 1e-6, 1e-4, 1e-2, 1, 100] });

// Train and held-out error for every degree 0..maxDegree, and the ridge sweep
// at the top degree.
export function polyStudy({ nTrain = POLY.nTrain, nHeld = POLY.nHeld, trainSeed = POLY.trainSeed, heldSeed = POLY.heldSeed, maxDegree = POLY.maxDegree, lambdas = POLY.lambdas } = {}) {
  const train = samples(nTrain, trainSeed), held = samples(nHeld, heldSeed);
  const degrees = Array.from({ length: maxDegree + 1 }, (_, d) => fitAndScore(train, held, d));
  const ridge = lambdas.map((l) => fitAndScore(train, held, maxDegree, l));
  const best = degrees.reduce((a, b) => (b.heldRmse < a.heldRmse ? b : a));
  return { train, held, degrees, ridge, bestDegree: best.degree };
}

// Spread over training draws: for each seed a fresh 16-point training set
// (the held-out set fixed), the held-out RMSE at the given degrees and the
// degree that does best on held-out data.
export function polySpread(seeds, { degrees = [3, POLY.maxDegree] } = {}) {
  const held = samples(POLY.nHeld, POLY.heldSeed);
  return seeds.map((s) => {
    const train = samples(POLY.nTrain, s);
    const all = Array.from({ length: POLY.maxDegree + 1 }, (_, d) => fitAndScore(train, held, d));
    const best = all.reduce((a, b) => (b.heldRmse < a.heldRmse ? b : a));
    return { seed: s, bestDegree: best.degree, held: Object.fromEntries(degrees.map((d) => [d, all[d].heldRmse])), train: Object.fromEntries(degrees.map((d) => [d, all[d].trainRmse])) };
  });
}

export function quantile(xs, q) { const s = [...xs].sort((a, b) => a - b), p = (s.length - 1) * q, lo = Math.floor(p); return s[lo] + (s[Math.ceil(p)] - s[lo]) * (p - lo); }

// --- the spiral network on a small training set -------------------------------
// twoSpirals(40, 1) is exactly the first 40 points of twoSpirals(400, 1)
// (each point uses the same draws in order), so the small run sees a subset
// of the control's data. Same net seed, same batch seed, same optimiser.
export const SPIRAL = Object.freeze({ small: 40, full: 400, trainSeed: 1, heldSeed: 2, netSeed: 3, batchSeed: 5, steps: 10000, lr: 0.3, batch: 32, every: 100 });

export function spiralRun(nTrain, { trainSeed = SPIRAL.trainSeed, netSeed = SPIRAL.netSeed, batchSeed = SPIRAL.batchSeed, steps = SPIRAL.steps, every = SPIRAL.every } = {}) {
  const data = twoSpirals(nTrain, trainSeed), held = twoSpirals(SPIRAL.full, SPIRAL.heldSeed);
  const curve = trainNet(createNet(netSeed), data, held, { optimiser: "sgd", hp: { lr: SPIRAL.lr }, steps, batch: SPIRAL.batch, seed: batchSeed, every });
  const minHeld = curve.reduce((a, b) => (b.heldLoss < a.heldLoss ? b : a));
  const last = curve[curve.length - 1];
  return { nTrain, curve, final: last, heldLossMinimum: { step: minHeld.step, heldLoss: minHeld.heldLoss, heldAccuracy: minHeld.heldAccuracy },
    accuracyGap: last.accuracy - last.heldAccuracy, lossGap: last.heldLoss - last.loss };
}

// --- the attention model's own curves ------------------------------------------
// model.json's curve has, every 25 steps, `train` (the mean loss of the
// training batches of the previous 25 steps, each measured just before its
// update) and `heldOut` (loss on 256 fixed held-out rows after the step).
// The trainer draws a fresh batch from the generator every step. The generator
// can make the same row twice by chance (its grammar is small), so some rows do
// repeat; repeatStats below counts them. (Corrected after the fact-check of
// 15 October 2026, which found the earlier "no row is shown twice" untrue.)
export function attentionGap(M, { tail = 8 } = {}) {
  const pts = M.curve.filter((p) => p.train !== null);
  const gaps = pts.map((p) => ({ step: p.step, train: p.train, heldOut: p.heldOut, gap: p.heldOut - p.train }));
  const last = gaps.slice(-tail), mean = last.reduce((s, p) => s + p.gap, 0) / last.length;
  return { gaps, tail, tailMeanGap: mean, tailMinGap: Math.min(...last.map((p) => p.gap)), tailMaxGap: Math.max(...last.map((p) => p.gap)) };
}

// Seen against unseen rows for the trained attention model: regenerate the
// trainer's own batch stream (rng(dataSeed), one makeBatch per step), keep
// the batches of the given steps, and score the final model on them as on
// any held-out set. Rows from the first steps were seen once, long ago; rows
// from the last steps were seen once, just before the end.
export function trainingBatches(dataSeed, batch, ctx, steps) {
  const r = rng(dataSeed), want = new Set(steps), out = [], last = Math.max(...steps);
  for (let s = 1; s <= last; s++) { const b = makeBatch(r, batch, ctx); if (want.has(s)) out.push(b); }
  return concatBatches(out);
}

export function concatBatches(list) {
  const n = list.reduce((s, b) => s + b.x.length, 0), out = { x: new Int32Array(n), y: new Int32Array(n), kind: new Uint8Array(n), src: new Int32Array(n), batch: 0, ctx: list[0].ctx };
  let o = 0;
  for (const b of list) { out.x.set(b.x, o); out.y.set(b.y, o); out.kind.set(b.kind, o); out.src.set(b.src, o); out.batch += b.batch; o += b.x.length; }
  return out;
}

// How often the trainer's stream repeats a row exactly (tokens and targets), how many times the
// most repeated row came round, and how many rows of other sets also occur in the stream.
export function repeatStats(dataSeed, batch, ctx, steps, others = {}) {
  const r = rng(dataSeed), seen = new Map();
  let rows = 0, repeats = 0;
  const key = (b, i) => `${Array.from(b.x.subarray(i * b.ctx, (i + 1) * b.ctx)).join(",")}|${Array.from(b.y.subarray(i * b.ctx, (i + 1) * b.ctx)).join(",")}`;
  for (let s = 1; s <= steps; s++) {
    const b = makeBatch(r, batch, ctx);
    for (let i = 0; i < b.batch; i++) { const k = key(b, i), n = seen.get(k) || 0; if (n) repeats++; seen.set(k, n + 1); rows++; }
  }
  const overlap = {};
  for (const [name, b] of Object.entries(others)) { let hit = 0; for (let i = 0; i < b.batch; i++) if (seen.has(key(b, i))) hit++; overlap[name] = { rows: b.batch, alsoInTraining: hit }; }
  return { rows, repeats, distinct: seen.size, maxCount: Math.max(...seen.values()), overlap };
}
