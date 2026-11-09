// Lesson K24: the attention lab's model computed in narrow formats. Pure ES
// module shared by the lab, a worker and tools/school/fill_precision.mjs.
//
// An arithmetic context { st, ac } says how numbers are kept:
//   st  rounds every stored number: weights, activations, scores, softmax
//       weights, each layer's output (the format of memory and of a tensor
//       core's inputs);
//   ac  rounds every partial sum of a dot product or a reduction (the
//       accumulator). Each multiply-add is s = ac(s + a * b): the product of
//       two fp16 or bf16 numbers is exact in a double, and the sum is rounded
//       once, as a fused multiply-add does. (When the two terms differ by
//       more than 2^29 in magnitude the double sum itself rounds first, so
//       the last bit can differ from a true single rounding; at this model's
//       sizes that is not reached in practice.)
// The tensor-core pattern is st = fp16 or bf16 with ac = fp32; the naive one
// keeps the accumulator in the narrow format too. Everything elementwise
// (exp, GELU, a residual add, a division) is computed in a double and then
// stored with st: one rounding per stored value.

import { roundTo, FORMATS } from "./precision.mjs";
import { unitsOf } from "./errorbars.mjs";

const id = (x) => x, f = (name) => (name === "fp64" ? id : name === "fp32" ? Math.fround : (x) => roundTo(x, FORMATS[name]));
export const MODES = Object.freeze({
  fp64: ["fp64", "fp64"], fp32: ["fp32", "fp32"],
  fp16acc32: ["fp16", "fp32"], fp16acc16: ["fp16", "fp16"],
  bf16acc32: ["bf16", "fp32"], bf16acc16: ["bf16", "bf16"],
});

// A context that also records the largest magnitude stored and how many
// finite values overflowed to infinity when stored.
export function context(mode) {
  const [s, a] = MODES[mode], st0 = f(s), stats = { maxAbs: 0, overflow: 0, stored: 0 };
  const st = (x) => { const r = st0(x), m = Math.abs(x); stats.stored++; if (m > stats.maxAbs) stats.maxAbs = m; if (r === Infinity || r === -Infinity) { if (Number.isFinite(x)) stats.overflow++; } return r; };
  return { mode, store: s, acc: a, st, ac: f(a), stats };
}

export const roundParams = (params, st) => Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Float64Array.from(v, st)]));

// out[N, M] = a[N, K] . w[K, M] + b (b may be null), in context c.
export function matmulCtx(out, a, w, b, N, K, M, c) {
  const { st, ac } = c;
  for (let n = 0; n < N; n++) for (let m = 0; m < M; m++) {
    let s = b ? b[m] : 0;
    for (let k = 0; k < K; k++) s = ac(s + a[n * K + k] * w[k * M + m]);
    out[n * M + m] = st(s);
  }
}

function layerNormCtx(out, x, g, b, N, D, c) {
  const { st, ac } = c;
  for (let n = 0; n < N; n++) {
    const o = n * D;
    let mean = 0, v = 0;
    for (let i = 0; i < D; i++) mean = ac(mean + x[o + i]);
    mean = ac(mean / D);
    for (let i = 0; i < D; i++) { const d = ac(x[o + i] - mean); v = ac(v + d * d); }
    const r = ac(1 / Math.sqrt(ac(v / D) + 1e-5));
    for (let i = 0; i < D; i++) out[o + i] = st(ac(ac(x[o + i] - mean) * r) * g[i] + b[i]);
  }
}

// Causal attention over one batch row block, heads of width hd.
export function attentionCtx(ao, qkv, B, T, D, H, c) {
  const { st, ac } = c, hd = D / H, scale = 1 / Math.sqrt(hd), D3 = 3 * D, s = new Float64Array(T);
  for (let b = 0; b < B; b++) for (let h = 0; h < H; h++) for (let i = 0; i < T; i++) {
    const qi = (b * T + i) * D3 + h * hd;
    let mx = -Infinity, l = 0;
    for (let j = 0; j <= i; j++) {
      const kj = (b * T + j) * D3 + D + h * hd;
      let t = 0;
      for (let d = 0; d < hd; d++) t = ac(t + qkv[qi + d] * qkv[kj + d]);
      s[j] = st(t * scale);
      if (s[j] > mx) mx = s[j];
    }
    for (let j = 0; j <= i; j++) { s[j] = st(Math.exp(st(s[j] - mx))); l = ac(l + s[j]); }
    const oi = (b * T + i) * D + h * hd;
    for (let d = 0; d < hd; d++) {
      let o = 0;
      for (let j = 0; j <= i; j++) o = ac(o + st(s[j] / l) * qkv[(b * T + j) * D3 + 2 * D + h * hd + d]);
      ao[oi + d] = st(o);
    }
  }
}

const GC = Math.sqrt(2 / Math.PI), GA = 0.044715;

function layerCtx(P, l, h, B, T, cfg, c) {
  const d = cfg.dModel, N = B * T, ff = cfg.dFF, F = Float64Array, st = c.st;
  const ln = new F(N * d), qkv = new F(N * 3 * d), ao = new F(N * d), tmp = new F(N * d), f1 = new F(N * ff);
  layerNormCtx(ln, h, P[`l${l}.ln1_g`], P[`l${l}.ln1_b`], N, d, c);
  matmulCtx(qkv, ln, P[`l${l}.wqkv`], P[`l${l}.bqkv`], N, d, 3 * d, c);
  attentionCtx(ao, qkv, B, T, d, cfg.nHeads, c);
  matmulCtx(tmp, ao, P[`l${l}.wo`], P[`l${l}.bo`], N, d, d, c);
  for (let i = 0; i < N * d; i++) h[i] = st(h[i] + tmp[i]);
  layerNormCtx(ln, h, P[`l${l}.ln2_g`], P[`l${l}.ln2_b`], N, d, c);
  matmulCtx(f1, ln, P[`l${l}.w1`], P[`l${l}.b1`], N, d, ff, c);
  for (let i = 0; i < N * ff; i++) { const v = f1[i]; f1[i] = st(0.5 * v * (1 + Math.tanh(GC * (v + GA * v * v * v)))); }
  matmulCtx(tmp, f1, P[`l${l}.w2`], P[`l${l}.b2`], N, ff, d, c);
  for (let i = 0; i < N * d; i++) h[i] = st(h[i] + tmp[i]);
}

// The whole forward pass in context c, with P = roundParams(model.params, c.st).
export function forwardCtx(P, cfg, x, B, T, c) {
  const d = cfg.dModel, N = B * T, h = new Float64Array(N * d), ln = new Float64Array(N * d), logits = new Float64Array(N * cfg.vocab);
  for (let n = 0; n < N; n++) for (let i = 0; i < d; i++) h[n * d + i] = c.st(P.wte[x[n] * d + i] + P.wpe[(n % T) * d + i]);
  for (let l = 0; l < cfg.nLayers; l++) layerCtx(P, l, h, B, T, cfg, c);
  layerNormCtx(ln, h, P.lnf_g, P.lnf_b, N, d, c);
  matmulCtx(logits, ln, P.wout, null, N, d, cfg.vocab, c);
  return logits;
}

// Per-word loss and top-1 from logits, as errorbars.scoreItems does it.
export function itemsFromLogits(logits, held, V) {
  const { y, kind, batch: B, ctx: T } = held, N = B * T, loss = new Float64Array(N), right = new Uint8Array(N);
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let mx = -Infinity, best = 0, s = 0;
    for (let v = 0; v < V; v++) if (logits[o + v] > mx) { mx = logits[o + v]; best = v; }
    for (let v = 0; v < V; v++) s += Math.exp(logits[o + v] - mx);
    loss[n] = -(logits[o + y[n]] - mx - Math.log(s));
    right[n] = best === y[n] ? 1 : 0;
  }
  return { rows: B, ctx: T, loss, right, kind: Uint8Array.from(kind) };
}

// Step-at-a-time scoring of the model in one mode: rowsPerStep held-out rows
// per step (a lab slice). units() gives per-row loss and look-back units.
export function createPrecisionScorer(model, held, mode, rowsPerStep = 16) {
  const c = context(mode), P = roundParams(model.params, c.st), T = held.ctx, cfg = model.config, parts = [];
  let at = 0;
  return {
    stats: c.stats,
    get done() { return at >= held.batch; },
    step() {
      const z = Math.min(held.batch, at + rowsPerStep), a = at * T, b = z * T;
      const sub = { x: held.x.subarray(a, b), y: held.y.subarray(a, b), kind: held.kind.subarray(a, b), batch: z - at, ctx: T };
      const it = itemsFromLogits(forwardCtx(P, cfg, sub.x, z - at, T, c), sub, cfg.vocab);
      parts.push({ loss: unitsOf(it, "loss", "row"), lookback: unitsOf(it, "lookback", "row") });
      at = z;
      return at;
    },
    units() { const cat = (k, g) => Float64Array.from(parts.flatMap((p) => Array.from(p[k][g]))); return { loss: { num: cat("loss", "num"), den: cat("loss", "den") }, lookback: { num: cat("lookback", "num"), den: cat("lookback", "den") } }; },
  };
}

export function scorePrecision(model, held, mode) {
  const s = createPrecisionScorer(model, held, mode, 64);
  while (!s.done) s.step();
  return { units: s.units(), stats: s.stats };
}

// ---- error against a float64 reference ----

export function errorAgainst(got, ref, mag = null) {
  let e2 = 0, r2 = 0, mx = 0, worst = 0, bad = 0;
  for (let i = 0; i < ref.length; i++) {
    const e = Math.abs(got[i] - ref[i]);
    if (!Number.isFinite(e)) { bad++; continue; }
    e2 += e * e; r2 += ref[i] * ref[i]; mx = Math.max(mx, e);
    if (mag && mag[i] > 0) worst = Math.max(worst, e / mag[i]);
  }
  return { relNorm: Math.sqrt(e2 / r2), maxAbs: mx, ...(mag ? { maxOverMag: worst } : {}), nonFinite: bad };
}

// One dense layer of the model on real activations: a [N, K] times w [K, M]
// (+ b) in every mode. reference: float64 on the original float32 inputs;
// accOnly: float64 on the inputs already rounded to the storage format, so
// the difference is the accumulation's alone. mag = sum_k |a||w| (+ |b|).
export function matmulStudy(a, w, b, N, K, M) {
  const ref = new Float64Array(N * M), mag = new Float64Array(N * M), rows = [];
  matmulCtx(ref, a, w, b, N, K, M, context("fp64"));
  for (let n = 0; n < N; n++) for (let m = 0; m < M; m++) { let s = b ? Math.abs(b[m]) : 0; for (let k = 0; k < K; k++) s += Math.abs(a[n * K + k] * w[k * M + m]); mag[n * M + m] = s; }
  for (const mode of Object.keys(MODES).filter((x) => x !== "fp64")) {
    const c = context(mode), ra = Float64Array.from(a, c.st), rw = Float64Array.from(w, c.st), rb = b ? Float64Array.from(b, c.st) : null;
    const got = new Float64Array(N * M), exactOnRounded = new Float64Array(N * M);
    matmulCtx(got, ra, rw, rb, N, K, M, { ...c, st: c.st });
    matmulCtx(exactOnRounded, ra, rw, rb, N, K, M, { st: c.st, ac: id });
    rows.push({ mode, total: errorAgainst(got, ref, mag), inputsOnly: errorAgainst(exactOnRounded, ref, mag), accOnly: errorAgainst(got, exactOnRounded, mag) });
  }
  return rows;
}

// Dot products of length K of uniform values in [lo, 1): the accumulator's
// error as K grows, for the tensor-core pattern and the narrow one.
export function dotGrowth(K, store, acc, { count = 64, seed = 1, lo = -1 } = {}) {
  let s = seed >>> 0;
  const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const st = f(store), ac = f(acc);
  let worst = 0, mean = 0;
  for (let t = 0; t < count; t++) {
    let exact = 0, mag = 0, sum = 0;
    for (let k = 0; k < K; k++) { const x = st(lo + (1 - lo) * r()), y = st(lo + (1 - lo) * r()); exact += x * y; mag += Math.abs(x * y); sum = ac(sum + x * y); }
    const e = Math.abs(sum - exact) / mag;
    worst = Math.max(worst, e); mean += e / count;
  }
  return { K, store, acc, worstOverMag: worst, meanOverMag: mean, unitRoundoff: acc === "fp64" ? 0 : FORMATS[acc].u };
}

// One attention block of layer l on its real input (the LayerNorm output):
// qkv = x Wqkv + b, causal attention, then Wo + bo, in every mode, against
// float64 on the original float32 inputs and weights.
export function attentionBlockStudy(model, x, B, T, l) {
  const cfg = model.config, d = cfg.dModel, N = B * T, P = model.params, run = (c) => {
    const st = c.st, w = (n) => Float64Array.from(P[`l${l}.${n}`], st), qkv = new Float64Array(N * 3 * d), ao = new Float64Array(N * d), out = new Float64Array(N * d);
    matmulCtx(qkv, Float64Array.from(x, st), w("wqkv"), w("bqkv"), N, d, 3 * d, c);
    attentionCtx(ao, qkv, B, T, d, cfg.nHeads, c);
    matmulCtx(out, ao, w("wo"), w("bo"), N, d, d, c);
    return out;
  };
  const ref = run(context("fp64"));
  return Object.keys(MODES).filter((m) => m !== "fp64").map((mode) => { const c = context(mode), got = run(c); return { mode, ...errorAgainst(got, ref), maxStored: c.stats.maxAbs, overflow: c.stats.overflow }; });
}
