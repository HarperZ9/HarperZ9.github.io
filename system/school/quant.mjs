// Lesson S18, "Quantisation: fewer bits per number". Pure ES module, no DOM
// and no dependencies: the lab page, a worker and the Node fill script share
// it.
//
// The attention lab's trained model (media/school/attention/model.json,
// 20,864 float32 numbers) has its weight matrices stored in fewer bits and
// read back (dequantised), then scored on held-out rows:
//   - symmetric round to nearest (RTN): a value w becomes the integer code
//     q = round(w / s), clamped to [-qmax, qmax] with qmax = 2^(bits-1) - 1,
//     and is read back as q * s. The scale s is max |w| / qmax over a block
//     of values and is stored in float32;
//   - three block choices: one scale per tensor (Jacob and others 2018 use
//     one set of parameters per weights array), one per output channel, and
//     one per group of 32 consecutive inputs of one output channel;
//   - only the 11 weight matrices are quantised (20,096 numbers); the 768
//     biases and layer-norm gains and shifts stay float32, as do all
//     activations: nothing here quantises what flows between layers.
// GPTQ (Frantar and others 2023) is in quant-gptq.mjs.

import { createModel } from "./tinyformer-model.mjs";
import { scoreItems, unitsOf, scoreOf, bootstrapInterval, diffInterval } from "./errorbars.mjs";

export const BITS = Object.freeze([8, 6, 4, 3, 2]);
export const SCHEMES = Object.freeze(["tensor", "channel", "group"]);
export const GROUP = 32, F32 = 4;
export const qmax = (bits) => 2 ** (bits - 1) - 1;

// The matrices, in the order the forward pass uses them. axis is the output
// channel: embeddings are looked up by row (one row per word or position),
// dense weights are [inputs, outputs] row-major, so a channel is a column.
export function matrices(config) {
  const { vocab: V, ctx, dModel: d, dFF: f, nLayers } = config, out = [["wte", V, d, "row"], ["wpe", ctx, d, "row"]];
  for (let l = 0; l < nLayers; l++) out.push([`l${l}.wqkv`, d, 3 * d, "col"], [`l${l}.wo`, d, d, "col"], [`l${l}.w1`, d, f, "col"], [`l${l}.w2`, f, d, "col"]);
  out.push(["wout", d, V, "col"]);
  return out.map(([name, rows, cols, axis]) => ({ name, rows, cols, axis }));
}

// Group id of every element, and the number of groups. A group of the
// "group" scheme is GROUP consecutive inputs of one channel (for an
// embedding row of 32 numbers that is the whole row, the same as channel).
export function groupMap(spec, scheme, gs = GROUP) {
  const { rows: R, cols: C, axis } = spec, g = new Int32Array(R * C);
  let count = 1;
  if (scheme === "channel") count = axis === "row" ? R : C;
  if (scheme === "group") count = axis === "row" ? R * Math.ceil(C / gs) : C * Math.ceil(R / gs);
  if (scheme !== "tensor") for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
    const i = r * C + c;
    if (scheme === "channel") g[i] = axis === "row" ? r : c;
    else g[i] = axis === "row" ? r * Math.ceil(C / gs) + Math.floor(c / gs) : c * Math.ceil(R / gs) + Math.floor(r / gs);
  }
  return { g, count };
}

export const roundHalfAway = (v) => (v < 0 ? -Math.round(-v) : Math.round(v));
export const code = (w, s, Q) => (s > 0 ? Math.max(-Q, Math.min(Q, roundHalfAway(w / s))) : 0);

// RTN on one tensor. dequantScale (a control only) multiplies the scale the
// reader uses: a quantiser whose writer and reader disagree on the scale.
export function quantizeTensor(w, spec, { bits, scheme = "tensor", gs = GROUP, dequantScale = 1 } = {}) {
  const Q = qmax(bits), { g, count } = groupMap(spec, scheme, gs), mx = new Float64Array(count);
  for (let i = 0; i < w.length; i++) mx[g[i]] = Math.max(mx[g[i]], Math.abs(w[i]));
  const scales = Float32Array.from(mx, (m) => m / Q), q = new Int8Array(w.length), deq = new Float32Array(w.length);
  if (bits > 8) return quantizeWide(w, g, scales, Q, dequantScale);
  for (let i = 0; i < w.length; i++) { q[i] = code(w[i], scales[g[i]], Q); deq[i] = q[i] * scales[g[i]] * dequantScale; }
  return { bits, scheme, q, scales, g, deq };
}

function quantizeWide(w, g, scales, Q, f) {
  const q = new Int32Array(w.length), deq = new Float32Array(w.length);
  for (let i = 0; i < w.length; i++) { q[i] = code(w[i], scales[g[i]], Q); deq[i] = q[i] * scales[g[i]] * f; }
  return { bits: Math.log2(Q + 1) + 1, q, scales, g, deq };
}

// The checker: every code in range and every read-back value within half a
// step of the original, |w - q s| <= s / 2 (RTN never clips, since s comes
// from the block's own maximum), plus the float32 rounding of q s itself
// (2^-23 |q s|, which matters at 16 bits, where a step is near float32's).
export function checkQuant(w, res) {
  const Q = qmax(res.bits);
  let outOfRange = 0, overHalf = 0, worst = 0;
  for (let i = 0; i < w.length; i++) {
    const s = res.scales[res.g[i]], e = Math.abs(w[i] - res.deq[i]), half = s / 2;
    if (Math.abs(res.q[i]) > Q) outOfRange++;
    const ratio = half > 0 ? e / half : e > 0 ? Infinity : 0;
    if (e > half + Math.abs(res.deq[i]) * 2 ** -23) overHalf++;
    if (ratio > worst) worst = ratio;
  }
  return { ok: outOfRange === 0 && overHalf === 0, outOfRange, overHalf, worstOverHalfStep: worst };
}

// Bytes to store a model: quantised matrices packed at `bits` per number plus
// a float32 scale per block, everything else float32.
export function bytesOf(config, { bits, scheme = "tensor", gs = GROUP, only = null } = {}) {
  let weights = 0, scales = 0, floats = 0;
  for (const s of matrices(config)) {
    if (only && !only.includes(s.name)) { floats += s.rows * s.cols; continue; }
    weights += s.rows * s.cols; scales += groupMap(s, scheme, gs).count;
  }
  const total = createModel(config, 1).nParams, other = total - weights - floats;
  const bytes = { packedWeights: Math.ceil((weights * bits) / 8), scales: scales * F32, floatWeights: floats * F32, otherFloats: other * F32 };
  const sum = bytes.packedWeights + bytes.scales + bytes.floatWeights + bytes.otherFloats;
  return { ...bytes, total: sum, float32: total * F32, ratio: sum / (total * F32), bitsPerWeight: (8 * (bytes.packedWeights + bytes.scales)) / Math.max(1, weights), scaleCount: scales };
}

export function cloneModel(model) {
  const m = createModel(model.config, model.seed);
  for (const n of model.names) m.params[n].set(model.params[n]);
  return m;
}

// A copy of the model with the chosen matrices quantised and read back.
export function quantizeModel(model, { bits, scheme = "tensor", gs = GROUP, only = null, dequantScale = 1 } = {}) {
  const m = cloneModel(model), per = {};
  for (const s of matrices(model.config)) {
    if (only && !only.includes(s.name)) continue;
    const w = model.params[s.name], r = quantizeTensor(w, s, { bits, scheme, gs, dequantScale });
    m.params[s.name].set(r.deq);
    per[s.name] = { ...errorStats(w, r.deq), check: checkQuant(w, r) };
  }
  return { model: m, per, bytes: bytesOf(model.config, { bits, scheme, gs, only }) };
}

// ---- where the damage comes from ----

export function tensorStats(w) {
  let s2 = 0, s4 = 0, mx = 0;
  for (const v of w) { s2 += v * v; s4 += v ** 4; mx = Math.max(mx, Math.abs(v)); }
  const n = w.length, rms = Math.sqrt(s2 / n), sorted = Float64Array.from(w, Math.abs).sort();
  return { n, rms, maxAbs: mx, outlier: mx / rms, kurtosis: s4 / n / (s2 / n) ** 2, medianAbs: sorted[n >> 1], p99Abs: sorted[Math.floor(0.99 * (n - 1))] };
}

export function errorStats(w, deq) {
  let e2 = 0, w2 = 0, mx = 0;
  for (let i = 0; i < w.length; i++) { const e = w[i] - deq[i]; e2 += e * e; w2 += w[i] * w[i]; mx = Math.max(mx, Math.abs(e)); }
  return { rmsErr: Math.sqrt(e2 / w.length), relErr: Math.sqrt(e2 / w2), maxErr: mx };
}

// Histogram of a tensor over [-m, m] and the RTN levels of one scale.
export function histogram(w, bins, m) {
  const h = new Int32Array(bins);
  for (const v of w) h[Math.min(bins - 1, Math.max(0, Math.floor(((v + m) / (2 * m)) * bins)))]++;
  return Array.from(h);
}
export function levels(w, bits) {
  const Q = qmax(bits), s = Math.fround(w.reduce((a, v) => Math.max(a, Math.abs(v)), 0) / Q), counts = new Array(2 * Q + 1).fill(0);
  for (const v of w) counts[code(v, s, Q) + Q]++;
  return { bits, scale: s, values: counts.map((_, k) => Math.fround((k - Q) * s)), counts, used: counts.filter((c) => c > 0).length };
}

// ---- scoring ----

// Per-row units for loss and look-back accuracy on a held-out set.
export function scoreUnits(model, held) {
  const it = scoreItems(model, held);
  return { loss: unitsOf(it, "loss", "row"), lookback: unitsOf(it, "lookback", "row") };
}

// Score, 95 percent row bootstrap interval, and the paired difference from
// the float model's units on the same rows (quantised minus float).
export function summarise(u, base, { resamples = 1000, seed = 1 } = {}) {
  const out = {};
  for (const k of ["loss", "lookback"]) {
    const iv = bootstrapInterval(u[k], { resamples, seed }), d = base ? diffInterval(u[k], base[k], { resamples, seed }) : null;
    out[k] = { value: scoreOf(u[k]), lo: iv.lo, hi: iv.hi, ...(d ? { diff: d.mean, diffLo: d.lo, diffHi: d.hi } : {}) };
  }
  return out;
}

// Step-at-a-time scorer for a page: rowsPerStep held-out rows per step.
export function createScorer(model, held, rowsPerStep = 32) {
  const T = held.ctx, parts = [];
  let at = 0;
  return {
    get done() { return at >= held.batch; },
    step() {
      const z = Math.min(held.batch, at + rowsPerStep), a = at * T, b = z * T;
      parts.push(scoreUnits(model, { x: held.x.subarray(a, b), y: held.y.subarray(a, b), kind: held.kind.subarray(a, b), batch: z - at, ctx: T }));
      at = z;
      return at;
    },
    units() { const cat = (k, f) => Float64Array.from(parts.flatMap((p) => Array.from(p[k][f]))); return { loss: { num: cat("loss", "num"), den: cat("loss", "den") }, lookback: { num: cat("lookback", "num"), den: cat("lookback", "den") } }; },
  };
}
