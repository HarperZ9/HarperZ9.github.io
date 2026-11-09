// Lesson F3 on a real network: the attention lab's tiny transformer (see
// tinyformer-model.mjs). Three readings, all from the model's own forward
// and hand-written backward pass:
//
//  1. A 2D slice of the held-out loss around a set of weights, along two
//     random directions with filter-wise normalisation, after
//       H. Li, Z. Xu, G. Taylor, C. Studer, T. Goldstein, "Visualizing the
//       Loss Landscape of Neural Nets", NeurIPS 2018.
//     Each direction is Gaussian, then every filter (one output unit of a
//     dense layer, one row of an embedding table) is rescaled to the norm of
//     the same filter in the weights. One-dimensional parameters (biases,
//     LayerNorm gains and shifts) get a zero direction, as Li et al. do for
//     biases and batch-norm parameters. The rescaling makes "one unit along
//     the direction" mean the same relative change in every layer, so slices
//     of differently scaled weights can be compared.
//  2. The true gradient norm, from lossAndGrad.
//  3. A one-parameter descent: every weight fixed except one scalar s that
//     multiplies the readout matrix wout, so logits = s * (LNf(h) . wout).
//     dL/ds = sum_ij dL/dW_ij * W0_ij by the chain rule, with dL/dW taken from
//     the real backward pass at W = s * W0.

import { createModel, lossAndGrad, lossOnly } from "./tinyformer-model.mjs";
import { rng, gauss } from "./tinyformer-ops.mjs";

export const SLICE_NOTE = "A 2D slice shows the loss on one flat sheet through a space with thousands of dimensions. " +
  "It can show whether the trained point sits in a basin along these two directions, how wide that basin is relative to the weights' own size, " +
  "and how the trained point differs from the starting point. It cannot show the loss along any other direction, so a slice that looks like a bowl " +
  "does not prove the point is a minimum, and a smooth slice does not rule out sharp directions elsewhere. Two random directions in high dimension " +
  "are nearly at right angles to each other and to the gradient, so the slice usually misses the steepest way down.";

// [rows, cols, filter axis] per parameter. A filter is one output unit: a
// column of a [K, M] dense weight, a row of an embedding table.
function layout(name, c) {
  const d = c.dModel, f = c.dFF;
  if (name === "wte") return [c.vocab, d, "row"];
  if (name === "wpe") return [c.ctx, d, "row"];
  if (name === "wout") return [d, c.vocab, "col"];
  if (name.endsWith(".wqkv")) return [d, 3 * d, "col"];
  if (name.endsWith(".wo")) return [d, d, "col"];
  if (name.endsWith(".w1")) return [d, f, "col"];
  if (name.endsWith(".w2")) return [f, d, "col"];
  return null; // 1D: biases and LayerNorm parameters
}

// A filter-normalised Gaussian direction, one Float64Array per tensor.
export function filterNormalizedDirection(model, seed) {
  const r = rng(seed), c = model.config, dir = {};
  for (const name of model.names) {
    const p = model.params[name], d = new Float64Array(p.length), lay = layout(name, c);
    dir[name] = d;
    if (!lay) continue;
    for (let i = 0; i < d.length; i++) d[i] = gauss(r);
    const [R, C, axis] = lay, nF = axis === "row" ? R : C, len = axis === "row" ? C : R;
    const at = axis === "row" ? (f, k) => f * C + k : (f, k) => k * C + f;
    for (let fi = 0; fi < nF; fi++) {
      let nd = 0, nw = 0;
      for (let k = 0; k < len; k++) { const i = at(fi, k); nd += d[i] * d[i]; nw += p[i] * p[i]; }
      const s = nd > 0 ? Math.sqrt(nw / nd) : 0;
      for (let k = 0; k < len; k++) d[at(fi, k)] *= s;
    }
  }
  return dir;
}

function dot(model, a, b) {
  let s = 0;
  for (const n of model.names) { const u = a[n], v = b[n]; for (let i = 0; i < u.length; i++) s += u[i] * v[i]; }
  return s;
}

function snapshot(model) {
  return Object.fromEntries(model.names.map((n) => [n, Float64Array.from(model.params[n])]));
}

function restore(model, base) {
  for (const n of model.names) model.params[n].set(base[n]);
}

// Held-out loss on an n x n grid of theta + a * d1 + b * d2 for a, b in
// [-span, span]. values[j][i] has b = alphas[j], a = alphas[i]. The model's
// weights are restored afterwards.
export function landscapeSlice(model, held, { n = 21, span = 1, seed = 101 } = {}) {
  const base = snapshot(model), d1 = filterNormalizedDirection(model, seed), d2 = filterNormalizedDirection(model, seed + 1);
  const { x, y, batch: B, ctx: T } = held;
  const alphas = Array.from({ length: n }, (_, i) => -span + 2 * span * i / (n - 1));
  const values = [];
  let lo = Infinity, hi = -Infinity, argmin = [0, 0];
  for (let j = 0; j < n; j++) {
    const row = [];
    for (let i = 0; i < n; i++) {
      const a = alphas[i], b = alphas[j];
      for (const name of model.names) {
        const p = model.params[name], w = base[name], u = d1[name], v = d2[name];
        for (let k = 0; k < p.length; k++) p[k] = w[k] + a * u[k] + b * v[k];
      }
      const L = lossOnly(model, x, y, B, T);
      row.push(L);
      if (L < lo) { lo = L; argmin = [a, b]; }
      hi = Math.max(hi, L);
    }
    values.push(row);
  }
  restore(model, base);
  const center = lossOnly(model, x, y, B, T);
  const g = gradNorm(model, held, [d1, d2]);
  const n1 = Math.sqrt(dot(model, d1, d1)), n2 = Math.sqrt(dot(model, d2, d2));
  const wn = Math.sqrt(dot(model, base, base));
  return {
    n, span, alphas, values, min: lo, max: hi, argmin, center,
    // Slopes of the slice at its centre: exact, from the backward pass
    // (grad . d), and by central differences with h = 0.01 along each
    // direction. The grid itself is too coarse to read a slope from.
    slopeBackward: g.directional,
    slopeFiniteDiff: [centralSlope(model, held, base, d1), centralSlope(model, held, base, d2)],
    directionNorms: [n1, n2], weightNorm: wn, cosine: dot(model, d1, d2) / (n1 * n2),
    gradientCosines: [g.directional[0] / (g.norm * n1), g.directional[1] / (g.norm * n2)],
  };
}

function centralSlope(model, held, base, d, h = 0.01) {
  const { x, y, batch: B, ctx: T } = held, L = [];
  for (const t of [h, -h]) {
    for (const n of model.names) { const p = model.params[n], w = base[n], u = d[n]; for (let k = 0; k < p.length; k++) p[k] = w[k] + t * u[k]; }
    L.push(lossOnly(model, x, y, B, T));
  }
  restore(model, base);
  return (L[0] - L[1]) / (2 * h);
}

// Global L2 norm of the gradient of the held-out loss, per-tensor norms, and
// optionally the directional derivatives grad . d for given directions.
export function gradNorm(model, held, directions = []) {
  const { x, y, batch: B, ctx: T } = held;
  const { loss, grads } = lossAndGrad(model, x, y, B, T);
  let sq = 0;
  const perTensor = {};
  for (const n of model.names) {
    let s = 0;
    for (const g of grads[n]) s += g * g;
    perTensor[n] = Math.sqrt(s); sq += s;
  }
  const directional = directions.map((d) => dot(model, grads, d));
  return { loss, norm: Math.sqrt(sq), perTensor, directional };
}

// Loss and dL/ds with wout replaced by s * w0 (w0 = the weights' own wout).
export function readoutScale(model, held, s, w0 = Float64Array.from(model.params.wout)) {
  const { x, y, batch: B, ctx: T } = held, p = model.params.wout;
  for (let i = 0; i < p.length; i++) p[i] = s * w0[i];
  const { loss, grads } = lossAndGrad(model, x, y, B, T);
  let dLds = 0;
  for (let i = 0; i < p.length; i++) dLds += grads.wout[i] * w0[i];
  p.set(w0);
  return { s, loss, dLds };
}

// Gradient descent on s alone. Returns the path [s, loss, dL/ds] per step.
// opts.flipSign is the control: it climbs instead of descending.
export function scaleDescent(model, held, { start = 0.05, step = 0.5, steps = 30, flipSign = false } = {}) {
  const w0 = Float64Array.from(model.params.wout), path = [];
  let s = start;
  for (let k = 0; k <= steps; k++) {
    const r = readoutScale(model, held, s, w0);
    path.push([s, r.loss, r.dLds]);
    if (k < steps) s -= step * (flipSign ? -r.dLds : r.dLds);
  }
  return { path, end: s, loss: path[path.length - 1][1] };
}

// A model built from config and seed, exactly as training starts it.
export function initialModel(config, seed) {
  return createModel(config, seed);
}
