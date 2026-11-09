// Lesson S18: GPTQ (Frantar, Ashkboos, Hoefler and Alistarh, "GPTQ: Accurate
// Post-Training Quantization for Generative Pre-trained Transformers", ICLR
// 2023, arXiv:2210.17323), Algorithm 1, on the tiny model. Pure ES module.
//
// For a dense weight W [K inputs, M outputs] and calibration inputs X
// [N, K], GPTQ quantises the K input rows of W one after another, in a fixed
// order, and after each row moves the not-yet-quantised rows to cancel the
// error that row made on X W. It uses H = 2 X^T X with 1 percent of the mean
// diagonal added (the paper's dampening), and the upper Cholesky factor U of
// H^-1: err = (w_i - q_i) / U_ii, then w_j -= err * U_ij for j > i.
// The paper processes rows in lazy blocks of B = 128 for speed; every matrix
// here has at most 64 input rows, so one block holds them all and the loop
// below is the algorithm as written. As in the paper's experiments, layers
// are quantised in forward order and each layer's calibration inputs come
// from the partially quantised model. Differences from the paper: the grid
// is the symmetric one of quant.mjs (the paper uses an asymmetric grid with
// a zero point); the embeddings are looked up, not multiplied, so they get
// round to nearest; calibration is rows of the training distribution.

import { forward } from "./tinyformer-model.mjs";
import { makeBatch } from "./corpus.mjs";
import { rng } from "./tinyformer-ops.mjs";
import { matrices, quantizeTensor, cloneModel, code, qmax, errorStats, GROUP } from "./quant.mjs";

export const DAMP = 0.01;

// H = 2 X^T X, K x K, float64.
export function hessian(X, N, K) {
  const H = new Float64Array(K * K);
  for (let n = 0; n < N; n++) { const o = n * K; for (let i = 0; i < K; i++) { const xi = X[o + i]; if (xi === 0) continue; for (let j = i; j < K; j++) H[i * K + j] += 2 * xi * X[o + j]; } }
  for (let i = 0; i < K; i++) for (let j = 0; j < i; j++) H[i * K + j] = H[j * K + i];
  return H;
}

// Lower Cholesky factor of a symmetric positive definite K x K matrix.
export function cholesky(A, K) {
  const L = new Float64Array(K * K);
  for (let i = 0; i < K; i++) for (let j = 0; j <= i; j++) {
    let s = A[i * K + j];
    for (let k = 0; k < j; k++) s -= L[i * K + k] * L[j * K + k];
    if (i === j) { if (!(s > 0)) throw new Error("matrix is not positive definite"); L[i * K + i] = Math.sqrt(s); } else L[i * K + j] = s / L[j * K + j];
  }
  return L;
}

// Inverse of an SPD matrix from its Cholesky factor.
export function spdInverse(A, K) {
  const L = cholesky(A, K), Li = new Float64Array(K * K), inv = new Float64Array(K * K);
  for (let c = 0; c < K; c++) for (let i = c; i < K; i++) {
    let s = i === c ? 1 : 0;
    for (let k = c; k < i; k++) s -= L[i * K + k] * Li[k * K + c];
    Li[i * K + c] = s / L[i * K + i];
  }
  for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) { let s = 0; for (let k = Math.max(i, j); k < K; k++) s += Li[k * K + i] * Li[k * K + j]; inv[i * K + j] = s; }
  return inv;
}

// The upper factor U of H^-1 = U^T U after dead inputs and dampening.
function inverseFactor(H, K, W, M, damp) {
  let mean = 0;
  for (let i = 0; i < K; i++) mean += H[i * K + i] / K;
  for (let i = 0; i < K; i++) {
    if (H[i * K + i] === 0) { H[i * K + i] = 1; W.fill(0, i * M, (i + 1) * M); }
    H[i * K + i] += damp * mean;
  }
  const L = cholesky(spdInverse(H, K), K), U = new Float64Array(K * K);
  for (let i = 0; i < K; i++) for (let j = i; j < K; j++) U[i * K + j] = L[j * K + i];
  return U;
}

// Per-column scales: one for the tensor or one per column from the starting
// weights; for groups, from the current (already updated) rows at the start
// of each group of `gs` rows, as the paper describes for grouping.
function scalesFor(W, K, M, Q, scheme, i0, gs) {
  const s = new Float64Array(M), to = scheme === "group" ? Math.min(K, i0 + gs) : K;
  for (let c = 0; c < M; c++) { let m = 0; for (let i = i0; i < to; i++) m = Math.max(m, Math.abs(W[i * M + c])); s[c] = m; }
  if (scheme === "tensor") { const m = Math.max(...s); s.fill(m); }
  return Float32Array.from(s, (m) => m / Q);
}

// GPTQ on one dense weight w [K, M] given calibration inputs X [N, K].
export function gptqTensor(w, K, M, X, N, { bits, scheme = "channel", gs = GROUP, damp = DAMP } = {}) {
  const Q = qmax(bits), W = Float64Array.from(w), deq = new Float32Array(K * M), q = new Int8Array(K * M);
  const U = inverseFactor(hessian(X, N, K), K, W, M, damp), err = new Float64Array(M);
  let s = scheme === "group" ? null : scalesFor(W, K, M, Q, scheme, 0, gs);
  const scales = [];
  if (s) scales.push(s);
  for (let i = 0; i < K; i++) {
    if (scheme === "group" && i % gs === 0) { s = scalesFor(W, K, M, Q, scheme, i, gs); scales.push(s); }
    const d = U[i * K + i];
    for (let c = 0; c < M; c++) { q[i * M + c] = code(W[i * M + c], s[c], Q); deq[i * M + c] = q[i * M + c] * s[c]; err[c] = (W[i * M + c] - deq[i * M + c]) / d; }
    for (let j = i + 1; j < K; j++) { const u = U[i * K + j]; if (u === 0) continue; const o = j * M; for (let c = 0; c < M; c++) W[o + c] -= err[c] * u; }
  }
  return { deq, q, scales, scaleCount: scheme === "tensor" ? 1 : scales.length * M };
}

// ||X w - X v||^2 / N: the layer-output error GPTQ minimises (bias left out).
export function outputError(X, N, K, M, w, v) {
  let e = 0;
  const r = new Float64Array(M);
  for (let n = 0; n < N; n++) {
    r.fill(0);
    for (let k = 0; k < K; k++) { const x = X[n * K + k]; if (x === 0) continue; for (let c = 0; c < M; c++) r[c] += x * (w[k * M + c] - v[k * M + c]); }
    for (let c = 0; c < M; c++) e += r[c] * r[c];
  }
  return e / N;
}

// The input each dense matrix sees in a forward pass on (x, B, T), copied.
export function layerInputs(model, x, B, T) {
  const w = forward(model, x, B, T).work, c = model.config, out = { wout: Float32Array.from(w.lnf) };
  w.layers.forEach((L, l) => { out[`l${l}.wqkv`] = Float32Array.from(L.ln1); out[`l${l}.wo`] = Float32Array.from(L.ao); out[`l${l}.w1`] = Float32Array.from(L.ln2); out[`l${l}.w2`] = Float32Array.from(L.g1); });
  return { inputs: out, N: B * T, ctx: c.ctx };
}

export const calibration = (seed = 31337, rows = 128, ctx = 24) => makeBatch(rng(seed), rows, ctx);

// GPTQ on every dense matrix in forward order (embeddings by RTN). Each
// matrix's inputs are recomputed on the model as quantised so far. per holds
// the layer-output error on the calibration rows for RTN and for GPTQ.
export function gptqModel(model, { bits, scheme = "channel", gs = GROUP, calib = calibration(), damp = DAMP } = {}) {
  const m = cloneModel(model), per = {}, T = model.config.ctx, B = calib.x.length / T;
  for (const s of matrices(model.config)) {
    const w = model.params[s.name];
    if (s.axis === "row") { m.params[s.name].set(quantizeTensor(w, s, { bits, scheme, gs }).deq); per[s.name] = { method: "rtn", ...errorStats(w, m.params[s.name]) }; continue; }
    const { inputs, N } = layerInputs(m, calib.x, B, T), X = inputs[s.name];
    const g = gptqTensor(w, s.rows, s.cols, X, N, { bits, scheme, gs, damp }), rtn = quantizeTensor(w, s, { bits, scheme, gs }).deq;
    per[s.name] = { method: "gptq", ...errorStats(w, g.deq), outputErrGptq: outputError(X, N, s.rows, s.cols, w, g.deq), outputErrRtn: outputError(X, N, s.rows, s.cols, w, rtn) };
    m.params[s.name].set(g.deq);
  }
  return { model: m, per };
}
