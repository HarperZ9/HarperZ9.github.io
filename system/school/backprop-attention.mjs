// The link from lesson F4 to the attention lab: the same check that guards
// the tiny MLP, run on the trained transformer. Central finite differences
// of the held-out loss against the hand-written backward pass in
// tinyformer-model.mjs, entry by entry, on chosen parameters.
//
// The trained weights are float32. The check copies them into a float64
// model of the same shape (the values are identical, only the arithmetic is
// wider), so the difference quotient is not drowned by float32 rounding.
// A float32 pass with a wider step is also reported, as the lab runs it.

import { createModel, lossAndGrad, lossOnly } from "./tinyformer-model.mjs";
import { rng } from "./tinyformer-ops.mjs";

export const CHECK_TENSORS = Object.freeze(["wout", "lnf_g", "l1.w2", "l1.w1", "l1.wqkv", "l0.wo", "l0.wqkv", "wte", "wpe"]);

// Which entries: per tensor, the `top` entries with the largest analytic
// gradient (where a wrong backward would show most), plus `random` entries
// drawn with a fixed seed among those with a non-zero gradient.
function pickEntries(grads, names, top, random, seed) {
  const r = rng(seed), picks = [];
  for (const name of names) {
    const g = grads[name], idx = Array.from(g.keys()).filter((i) => g[i] !== 0);
    idx.sort((a, b) => Math.abs(g[b]) - Math.abs(g[a]));
    const chosen = new Set(idx.slice(0, top));
    const rest = idx.slice(top);
    for (let k = 0; k < random && rest.length; k++) chosen.add(rest.splice(Math.floor(r() * rest.length), 1)[0]);
    for (const i of chosen) picks.push([name, i]);
  }
  return picks;
}

function widen(model) {
  const m = createModel({ ...model.config, float64: true }, model.seed);
  for (const n of m.names) m.params[n].set(model.params[n]);
  return m;
}

function checkOn(model, held, picks, eps, opts) {
  const { x, y, batch: B, ctx: T } = held;
  const { grads } = lossAndGrad(model, x, y, B, T, opts);
  const ana = picks.map(([n, i]) => grads[n][i]);
  return picks.map(([name, i], k) => {
    const p = model.params[name], keep = p[i];
    p[i] = keep + eps; const lp = lossOnly(model, x, y, B, T);
    p[i] = keep - eps; const lm = lossOnly(model, x, y, B, T);
    p[i] = keep;
    const num = (lp - lm) / (2 * eps);
    return { tensor: name, index: i, analytic: ana[k], numeric: num, relErr: Math.abs(num - ana[k]) / Math.max(Math.abs(num) + Math.abs(ana[k]), 1e-12) };
  });
}

// held: a held-out batch ({x, y, batch, ctx}); a couple of rows is enough.
// Returns float64 and float32 results and the worst relative error of each.
// opts.brokenSoftmax runs the control backward (see tinyformer-attn.mjs).
export function attentionGradCheck(model, held, { tensors = CHECK_TENSORS, top = 2, random = 2, seed = 17, brokenSoftmax = false } = {}) {
  const m64 = widen(model);
  const { grads } = lossAndGrad(m64, held.x, held.y, held.batch, held.ctx);
  const picks = pickEntries(grads, tensors, top, random, seed);
  const f64 = checkOn(m64, held, picks, 1e-5, { brokenSoftmax });
  const f32 = brokenSoftmax ? null : checkOn(model, held, picks, 1e-2, {});
  const worst = (rows) => rows.reduce((a, b) => (b.relErr > a.relErr ? b : a));
  return {
    entries: picks.length, float64: { eps: 1e-5, rows: f64, worst: worst(f64) },
    float32: f32 && { eps: 1e-2, rows: f32, worst: worst(f32) },
  };
}
