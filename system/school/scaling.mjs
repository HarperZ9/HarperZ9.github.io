// Lesson L14, "Scaling: bigger, longer, how much". Pure ES module, no DOM and
// no dependencies, so a lab page, a worker and the Node fill script share it.
//
// The attention lab's model at other widths and depths, trained for several
// lengths, and the arithmetic to read the grid: parameter counts (total, and
// without the embedding tables, as Kaplan et al. 2020 count them), training
// compute, a straight-line fit on log-log axes, and the compute frontier.
//
// "Excess loss" is held-out loss minus the generator's own floor on the same
// rows (the loss no model can beat on average). Power laws are fitted to the
// excess, the same move as the constant term E in Hoffmann et al. 2022.

import { DEFAULT_CONFIG, FLOPS } from "./tinyformer-model.mjs";

// The grid's shape rule: feed-forward width twice the model width, two heads.
export function gridConfig(dModel, nLayers, nHeads = 2) {
  return { dModel, nLayers, nHeads, dFF: 2 * dModel };
}

// Parameter counts read off the model's tensor list (tinyformer-model.mjs).
// embedding: the token table wte, the position table wpe and the readout wout
// (untied here, so it is a second vocabulary table). nonEmbedding: the rest,
// the attention and feed-forward blocks with their norms, plus the final norm.
export function paramCounts(config = {}) {
  const c = { ...DEFAULT_CONFIG, ...config }, d = c.dModel, f = c.dFF;
  const perLayer = 2 * d + (d * 3 * d + 3 * d) + (d * d + d) + 2 * d + (d * f + f) + (f * d + d);
  const embedding = c.vocab * d + c.ctx * d + d * c.vocab;
  const nonEmbedding = c.nLayers * perLayer + 2 * d;
  return { total: embedding + nonEmbedding, nonEmbedding, embedding, perLayer };
}

// Training compute of `steps` steps: the model's FLOPS count (3 x forward,
// attention included) and the 6 N D rule with N non-embedding parameters and
// D target tokens, the rule Kaplan et al. use for C.
export function computeOf(config, steps, batch = 16, ctx = 24) {
  const f = FLOPS(config, batch, ctx), tokens = steps * batch * ctx;
  return { flops: f.step * steps, sixND: 6 * paramCounts(config).nonEmbedding * tokens, tokens };
}

// Least squares on log10 x against log10 y. slope is the power-law exponent;
// se its standard error from the residuals (n - 2 degrees of freedom).
export function fitPowerLaw(xs, ys) {
  const pts = xs.map((x, i) => [Math.log10(x), Math.log10(ys[i])]).filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  const n = pts.length;
  if (n < 2) return { n, slope: null, intercept: null, r2: null, se: null };
  const mx = pts.reduce((s, p) => s + p[0], 0) / n, my = pts.reduce((s, p) => s + p[1], 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const [a, b] of pts) { sxx += (a - mx) ** 2; sxy += (a - mx) * (b - my); syy += (b - my) ** 2; }
  const slope = sxy / sxx, intercept = my - slope * mx;
  let sse = 0;
  for (const [a, b] of pts) sse += (b - intercept - slope * a) ** 2;
  return {
    n, slope, intercept, r2: syy > 0 ? 1 - sse / syy : 1, se: n > 2 ? Math.sqrt(sse / (n - 2) / sxx) : null,
    xRange: [10 ** Math.min(...pts.map((p) => p[0])), 10 ** Math.max(...pts.map((p) => p[0]))],
  };
}

export const predict = (fit, x) => 10 ** (fit.intercept + fit.slope * Math.log10(x));

// The compute frontier: walking up in compute, keep each point whose loss is
// lower than every point that cost the same or less. Points: { compute, loss }.
export function frontier(points, key = "loss") {
  const s = points.slice().sort((a, b) => a.compute - b.compute || a[key] - b[key]);
  const out = [];
  let best = Infinity;
  for (const p of s) if (p[key] < best) { out.push(p); best = p[key]; }
  return out;
}

// For each compute budget in `budgets`, the lowest loss any point reached at
// that budget or below, and which point it was (null when none fits).
export function bestAtBudget(points, budgets, key = "loss") {
  return budgets.map((c) => {
    let best = null;
    for (const p of points) if (p.compute <= c && (!best || p[key] < best[key])) best = p;
    return { budget: c, best };
  });
}

// Log-spaced budgets from lo to hi, `perDecade` per factor of ten.
export function logBudgets(lo, hi, perDecade = 4) {
  const out = [], a = Math.log10(lo), b = Math.log10(hi);
  for (let k = Math.ceil(a * perDecade); k <= Math.floor(b * perDecade); k++) out.push(10 ** (k / perDecade));
  return out;
}

// Mean, sample standard deviation and range of a few repeat runs.
export function spread(values) {
  const n = values.length, mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean, sd, min: Math.min(...values), max: Math.max(...values) };
}

// Log-spaced checkpoint steps up to `steps` (always including `steps`).
export function checkpoints(steps, list = [25, 50, 100, 200, 300, 500, 750, 1000, 1500, 2000, 3000, 4000, 6000, 8000]) {
  const out = list.filter((s) => s < steps);
  out.push(steps);
  return out;
}

// Excess loss over a floor, guarded: a point at or under the floor (possible
// on a finite held-out set) cannot go on a log axis and is returned as null.
export const excess = (loss, floor) => (loss - floor > 0 ? loss - floor : null);
