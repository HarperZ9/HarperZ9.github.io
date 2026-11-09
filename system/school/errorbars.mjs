// Lesson E23, "Error bars: how sure is the number". Pure ES module, no DOM
// and no dependencies, so the lab page, a worker and the Node fill script
// share it.
//
// A held-out score is a mean over items, and a different draw of items gives
// a different mean. This file measures how much:
//   - per-item scores of a model (loss per next word, top-1 right or not,
//     and the look-back subset), kept per row so rows can be the unit;
//   - the bootstrap (Efron 1979): resample units with replacement, recompute
//     the score, read the 2.5th and 97.5th percentiles (type 7 quantiles);
//   - the normal interval: mean plus or minus 1.96 standard errors, with the
//     ratio (clustered) standard error so a row of 24 words counts as one
//     unit when rows are the unit (Miller 2024, "Adding Error Bars to Evals");
//   - paired against unpaired comparisons of two models on the same rows;
//   - the coverage check: on the corpus generator, whose expected loss is
//     known exactly (generatorExpectedLoss below), how often a 95 percent
//     interval contains the truth.
// Every resampler is seeded (mulberry32), so every interval is reproducible.

import { rng } from "./tinyformer-ops.mjs";
import { forward } from "./tinyformer-model.mjs";
import { makeBatch } from "./corpus.mjs";
import { trueTable, startParse, advance, nextWordProbs } from "./corpus-grammar.mjs";

export const Z95 = 1.959963984540054;

// Per-word scores on a held-out set: loss (nats), right (top-1, ties to the
// lowest id, as evaluate() does), kind (1 for a look-back target).
export function scoreItems(model, held) {
  const { x, y, kind, batch: B, ctx: T } = held, V = model.config.vocab, N = B * T;
  const { logits } = forward(model, x, B, T), loss = new Float64Array(N), right = new Uint8Array(N);
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

// The first n rows of an item set (heldOut(m) starts with heldOut(n)'s rows).
export function firstRows(items, n) {
  const k = n * items.ctx;
  return { rows: n, ctx: items.ctx, loss: items.loss.slice(0, k), right: items.right.slice(0, k), kind: items.kind.slice(0, k) };
}

// Units for resampling. metric: "loss" | "accuracy" | "lookback"; level:
// "row" (one unit per row: num = sum over its words, den = its word count)
// or "word" (one unit per word, den 1). The score is sum(num) / sum(den).
export function unitsOf(items, metric, level) {
  const { rows, ctx } = items, val = metric === "loss" ? items.loss : items.right;
  const keep = (n) => metric !== "lookback" || items.kind[n] === 1;
  if (level === "word") {
    const num = [];
    for (let n = 0; n < rows * ctx; n++) if (keep(n)) num.push(val[n]);
    return { num: Float64Array.from(num), den: new Float64Array(num.length).fill(1) };
  }
  const num = new Float64Array(rows), den = new Float64Array(rows);
  for (let b = 0; b < rows; b++) for (let t = 0; t < ctx; t++) { const n = b * ctx + t; if (keep(n)) { num[b] += val[n]; den[b] += 1; } }
  return { num, den };
}

const sum = (a) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i]; return s; };
export const scoreOf = (u) => sum(u.num) / sum(u.den);

// Type 7 quantile of a sorted array.
export function quantile(sorted, p) {
  const h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.min(lo + 1, sorted.length - 1);
  return sorted[lo] + (h - lo) * (sorted[hi] - sorted[lo]);
}

// Ratio standard error with the n / (n - 1) small-sample factor: for den 1 it
// is the ordinary sd / sqrt(n); for whole rows it treats each row as one draw.
export function ratioSE(u) {
  const n = u.num.length, r = scoreOf(u), D = sum(u.den);
  let s = 0;
  for (let i = 0; i < n; i++) s += (u.num[i] - r * u.den[i]) ** 2;
  return Math.sqrt((n / (n - 1)) * s) / D;
}

export function normalInterval(u) {
  const mean = scoreOf(u), se = ratioSE(u);
  return { mean, se, lo: mean - Z95 * se, hi: mean + Z95 * se, width: 2 * Z95 * se };
}

// Step-at-a-time bootstrap (a page runs a few hundred resamples per slice).
// draw(r) returns one resampled score; stats keeps them in order.
function createDrawer(draw, seed) {
  const r = rng(seed), stats = [];
  return {
    stats,
    step(k = 1) { for (let i = 0; i < k; i++) { const s = draw(r); if (Number.isFinite(s)) stats.push(s); } return stats.length; },
    interval(point) {
      const s = Float64Array.from(stats).sort(), lo = quantile(s, 0.025), hi = quantile(s, 0.975);
      return { mean: point, lo, hi, width: hi - lo, se: sd(stats), resamples: stats.length };
    },
  };
}
const sd = (a) => { const m = sum(a) / a.length; let s = 0; for (const v of a) s += (v - m) ** 2; return Math.sqrt(s / (a.length - 1)); };

function resampleSum(u, r, n, idx) {
  let sn = 0, sd2 = 0;
  for (let i = 0; i < n; i++) { const j = idx ? idx[i] : Math.floor(r() * n); sn += u.num[j]; sd2 += u.den[j]; }
  return sn / sd2;
}

export function createBootstrap(u, seed = 1) {
  const n = u.num.length, d = createDrawer((r) => resampleSum(u, r, n), seed);
  return { ...d, interval: () => d.interval(scoreOf(u)) };
}

export function bootstrapInterval(u, { resamples = 1000, seed = 1 } = {}) {
  const b = createBootstrap(u, seed);
  b.step(resamples);
  return b.interval();
}

// Difference of two models' scores (a minus b) on the same rows. mode
// "paired" resamples row indices once for both; "unpaired" draws a and b's
// rows independently, as if the two scores came from different rows.
export function createDiffBootstrap(a, b, mode = "paired", seed = 1) {
  const n = a.num.length, idx = new Int32Array(n);
  const draw = (r) => {
    for (let i = 0; i < n; i++) idx[i] = Math.floor(r() * n);
    const sa = resampleSum(a, r, n, idx);
    if (mode === "unpaired") for (let i = 0; i < n; i++) idx[i] = Math.floor(r() * n);
    return sa - resampleSum(b, r, n, idx);
  };
  const d = createDrawer(draw, seed);
  return { ...d, interval: () => d.interval(scoreOf(a) - scoreOf(b)) };
}

export function diffInterval(a, b, { mode = "paired", resamples = 1000, seed = 1 } = {}) {
  const d = createDiffBootstrap(a, b, mode, seed);
  d.step(resamples);
  return d.interval();
}

// Normal intervals for a difference: paired uses the per-row differences
// (rows must have the same denominators); unpaired adds the two variances.
export function diffNormal(a, b, mode = "paired") {
  const mean = scoreOf(a) - scoreOf(b);
  const se = mode === "paired" ? ratioSE({ num: a.num.map((v, i) => v - b.num[i]), den: a.den }) : Math.hypot(ratioSE(a), ratioSE(b));
  return { mean, se, lo: mean - Z95 * se, hi: mean + Z95 * se, width: 2 * Z95 * se };
}

// The units in a seeded random order: the broken-pairing control.
export function permuteUnits(u, seed) {
  const r = rng(seed), n = u.num.length, ord = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
  return { num: Float64Array.from(ord, (i) => u.num[i]), den: Float64Array.from(ord, (i) => u.den[i]) };
}

// Design effect: how much larger the row-level variance of the mean is than
// the word-level one, and the implied correlation of words inside a row
// (deff = 1 + (m - 1) rho for rows of m words).
export function designEffect(items, metric = "loss") {
  const r = ratioSE(unitsOf(items, metric, "row")), w = ratioSE(unitsOf(items, metric, "word")), deff = (r / w) ** 2;
  return { rowSE: r, wordSE: w, deff, rho: (deff - 1) / (items.ctx - 1) };
}

// ---- the generator, where the truth is known ----

// The generator's own loss on every word of a set: -log P(word | the words
// before it), from its exact odds. Same item layout as scoreItems.
export function generatorItems(set) {
  const V = 46, P = trueTable(set, V), N = set.y.length, loss = new Float64Array(N);
  for (let n = 0; n < N; n++) loss[n] = -Math.log(P[n * V + set.y[n]]);
  return { rows: set.batch, ctx: set.ctx, loss, right: new Uint8Array(N), kind: Uint8Array.from(set.kind) };
}
export { generatorExpectedLoss } from "./errorbars-truth.mjs";

// Every row of an item set repeated k times in a row: an eval set whose
// rows are not independent draws (k scores share one source each).
export function repeatRows(items, k) {
  const L = items.rows * items.ctx, rep = (a) => { const o = new a.constructor(L * k); for (let c = 0; c < k; c++) o.set(a, c * L); return o; };
  return { rows: items.rows * k, ctx: items.ctx, loss: rep(items.loss), right: rep(items.right), kind: rep(items.kind) };
}

function judge(iv, truth) {
  return { lo: iv.lo, hi: iv.hi, hit: iv.lo <= truth && truth <= iv.hi, width: iv.width, miss: iv.hi < truth ? "low" : iv.lo > truth ? "high" : "" };
}

// One coverage trial: a fresh set of `rows` rows from the generator, 95
// percent intervals for its mean loss, and whether each holds the truth.
// row and word resample the set's rows or words. With copies k > 1 the set
// holds each drawn row k times; row and word then treat the copies as
// independent, and cluster resamples the distinct rows.
export function coverageTrial(r, rows, ctx, truth, { resamples = 1000, seed = 1, copies = 1 } = {}) {
  const items = generatorItems(makeBatch(r, rows, ctx)), set = copies > 1 ? repeatRows(items, copies) : items, out = {};
  const levels = [["row", set, "row"], ["word", set, "word"], ...(copies > 1 ? [["cluster", items, "row"]] : [])];
  for (const [name, its, level] of levels) {
    const u = unitsOf(its, "loss", level);
    out[`${name}Pct`] = judge(bootstrapInterval(u, { resamples, seed }), truth);
    out[`${name}Normal`] = judge(normalInterval(u), truth);
  }
  out.mean = scoreOf(unitsOf(items, "loss", "row"));
  return out;
}

// Step-at-a-time coverage run: one trial per step (a page fits one 16-row or
// 64-row trial in a 40 ms slice). Sets come from data seed `seed`; each
// trial's bootstrap seed comes from a second stream.
export function createCoverage({ rows, ctx = 24, truth, seed = 1, resamples = 1000, copies = 1 }) {
  const r = rng(seed), bs = rng(seed + 0x9e3779b9), trials = [];
  return {
    trials,
    step() { trials.push(coverageTrial(r, rows, ctx, truth, { resamples, copies, seed: Math.floor(bs() * 2 ** 31) })); return trials.length; },
    summary() { return summariseCoverage(trials); },
  };
}

export function summariseCoverage(trials) {
  const n = trials.length, out = { trials: n, meanOfMeans: sum(trials.map((t) => t.mean)) / n };
  for (const k of Object.keys(trials[0]).filter((key) => key !== "mean")) {
    const hits = trials.filter((t) => t[k].hit).length, p = hits / n;
    out[k] = { coverage: p, se: Math.sqrt((p * (1 - p)) / n), hits, missLow: trials.filter((t) => t[k].miss === "low").length, missHigh: trials.filter((t) => t[k].miss === "high").length, meanWidth: sum(trials.map((t) => t[k].width)) / n };
  }
  return out;
}
