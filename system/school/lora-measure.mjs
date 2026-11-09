// Measurements for lesson S19, "LoRA and fine-tuning": scoring on the new
// task against its exact floor, and the singular values of a weight change
// (Hu et al. 2022 claim the change a fine-tune makes has a low "intrinsic
// rank"; the share of the change held by its top few directions tests that).

import { softmaxXent } from "./tinyformer-ops.mjs";
import { forward } from "./tinyformer-model.mjs";
import { ROLE } from "./lora-task.mjs";

const ROLE_NAMES = Object.fromEntries(Object.entries(ROLE).map(([k, v]) => [v, k]));

// Loss and top-1 accuracy on task rows (with exact odds P), overall and by
// role, plus what the ideal predictor would score: the floor (its loss) and
// its expected accuracy (the mean of its largest probability; a 50/50 word
// counts half).
export function scoreTask(model, set) {
  const { x, y, role, P, batch: B, ctx: T } = set, V = model.config.vocab, N = B * T;
  const { logits } = forward(model, x, B, T), probs = new Float64Array(N * V);
  const loss = softmaxXent(probs, null, logits, y, N, V);
  const acc = {}, add = (k, right, l, f, ia) => { const a = (acc[k] ??= [0, 0, 0, 0, 0]); a[0] += right; a[1] += 1; a[2] += l; a[3] += f; a[4] += ia; };
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let best = 0, top = 0;
    for (let v = 1; v < V; v++) if (probs[o + v] > probs[o + best]) best = v;
    for (let v = 0; v < V; v++) top = Math.max(top, P[o + v]);
    const right = best === y[n] ? 1 : 0, l = -Math.log(Math.max(probs[o + y[n]], 1e-30)), f = -Math.log(P[o + y[n]]);
    add("all", right, l, f, top);
    add(ROLE_NAMES[role[n]], right, l, f, top);
  }
  const out = {};
  for (const [k, [r, c, l, f, ia]] of Object.entries(acc)) out[k] = { n: c, accuracy: r / c, loss: l / c, floor: f / c, excess: l / c - f / c, idealAccuracy: ia / c };
  out.all.lossCheck = loss;
  return out;
}

// Eigen-decomposition of a symmetric n x n matrix (row-major Float64Array)
// by cyclic Jacobi rotations. Returns eigenvalues large to small and, with
// vectors, the matching unit eigenvectors as rows.
export function symmetricEigen(S, n, { sweeps = 60, tol = 1e-22 } = {}) {
  const a = Float64Array.from(S), Q = new Float64Array(n * n);
  for (let i = 0; i < n; i++) Q[i * n + i] = 1;
  for (let sw = 0; sw < sweeps; sw++) {
    let off = 0;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] ** 2;
    if (off < tol) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) rotate(a, Q, n, p, q);
  }
  const order = Array.from({ length: n }, (_, i) => i).sort((u, v) => a[v * n + v] - a[u * n + u]);
  return { values: order.map((i) => a[i * n + i]), vectors: order.map((i) => Float64Array.from({ length: n }, (_, k) => Q[k * n + i])) };
}
export const symmetricEigenvalues = (S, n, o) => symmetricEigen(S, n, o).values;

function rotate(a, Q, n, p, q) {
  const apq = a[p * n + q];
  if (Math.abs(apq) < 1e-300) return;
  const theta = (a[q * n + q] - a[p * n + p]) / (2 * apq);
  const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
  const c = 1 / Math.sqrt(t * t + 1), s = t * c;
  for (let k = 0; k < n; k++) {
    const akp = a[k * n + p], akq = a[k * n + q];
    a[k * n + p] = c * akp - s * akq; a[k * n + q] = s * akp + c * akq;
    const qkp = Q[k * n + p], qkq = Q[k * n + q];
    Q[k * n + p] = c * qkp - s * qkq; Q[k * n + q] = s * qkp + c * qkq;
  }
  for (let k = 0; k < n; k++) {
    const apk = a[p * n + k], aqk = a[q * n + k];
    a[p * n + k] = c * apk - s * aqk; a[q * n + k] = s * apk + c * aqk;
  }
}

// Gram matrix of the smaller side of a K x M matrix: D D^T if K <= M, else D^T D.
function gram(D, K, M) {
  const small = Math.min(K, M), G = new Float64Array(small * small);
  for (let i = 0; i < small; i++) for (let j = i; j < small; j++) {
    let s = 0;
    if (K <= M) for (let m = 0; m < M; m++) s += D[i * M + m] * D[j * M + m];
    else for (let k = 0; k < K; k++) s += D[k * M + i] * D[k * M + j];
    G[i * small + j] = s; G[j * small + i] = s;
  }
  return { G, small };
}

// The best rank-k approximation of D (Eckart-Young): D projected on its top k
// singular directions of the smaller side.
export function truncate(D, K, M, k) {
  const { G, small } = gram(D, K, M), { vectors } = symmetricEigen(G, small), out = new Float64Array(K * M);
  for (const u of vectors.slice(0, k)) {
    if (K <= M) {
      for (let m = 0; m < M; m++) { let c = 0; for (let i = 0; i < K; i++) c += u[i] * D[i * M + m]; for (let i = 0; i < K; i++) out[i * M + m] += u[i] * c; }
    } else {
      for (let i = 0; i < K; i++) { let c = 0; for (let m = 0; m < M; m++) c += D[i * M + m] * u[m]; for (let m = 0; m < M; m++) out[i * M + m] += c * u[m]; }
    }
  }
  return out;
}

// Singular values of a K x M matrix (row-major), from the eigenvalues of the
// smaller Gram matrix (D D^T or D^T D), large to small.
export function singularValues(D, K, M) {
  const { G, small } = gram(D, K, M);
  return symmetricEigenvalues(G, small).map((e) => Math.sqrt(Math.max(e, 0)));
}

// How much of a matrix's squared size (Frobenius norm squared, its "energy")
// its top k directions hold, for each k in ks; and how many directions hold
// 90 percent. A rank-k matrix has share 1 at k.
export function energyShares(sv, ks = [1, 2, 4, 8]) {
  const e = sv.map((s) => s * s), total = e.reduce((a, b) => a + b, 0);
  const share = (k) => (total > 0 ? e.slice(0, k).reduce((a, b) => a + b, 0) / total : 0);
  let cum = 0, k90 = sv.length;
  for (let i = 0; i < e.length; i++) { cum += e[i]; if (cum >= 0.9 * total) { k90 = i + 1; break; } }
  return { dims: sv.length, frobenius: Math.sqrt(total), top: Object.fromEntries(ks.map((k) => [k, share(k)])), for90: k90 };
}

// The weight change of every named matrix between two models, with its
// energy shares. shape(name) gives [K, M].
export function changeSpectra(before, after, names, shape) {
  return names.map((name) => {
    const [K, M] = shape(name), a = before.params[name], b = after.params[name], D = new Float64Array(K * M);
    for (let i = 0; i < D.length; i++) D[i] = b[i] - a[i];
    const sv = singularValues(D, K, M);
    return { name, K, M, singular: sv.slice(0, 8), ...energyShares(sv) };
  });
}

// The same shares for a K x M matrix of independent Gaussian entries: what
// "no low-rank structure" looks like at this shape (the baseline to read the
// shares against). r is a uniform random source.
export function randomShares(K, M, r) {
  const D = new Float64Array(K * M);
  for (let i = 0; i < D.length; i++) { const u = Math.max(r(), 1e-12), v = r(); D[i] = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  return energyShares(singularValues(D, K, M));
}
