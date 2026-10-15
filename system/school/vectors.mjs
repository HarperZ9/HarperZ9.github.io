// Lesson F1, "Vectors: a list of numbers is a place". The arithmetic of
// vectors (dot, length, cosine, distance, nearest neighbours), the trained
// attention model's word tables as the worked example, a measurement of
// whether nearby words in those tables belong together, and a 2D picture.
//
// Plain ES module, no dependencies, Node and browser. Nothing here reads
// files: callers pass the parsed media/school/attention/model.json object.

import { VOCAB, GUIDES, THINGS, VERBS, ADJS, heldOut } from "./corpus.mjs";
import { fromJSON, forward, rng } from "./tinyformer.mjs";

// ---- the arithmetic -------------------------------------------------------

export function dot(a, b) {
  if (a.length !== b.length) throw new Error("dot: lengths differ");
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}
export const length = (a) => Math.sqrt(dot(a, a));
export function cosine(a, b, dotFn = dot) {
  const den = Math.sqrt(dotFn(a, a) * dotFn(b, b));
  return den > 0 ? dotFn(a, b) / den : 0;
}
export function distance(a, b) {
  if (a.length !== b.length) throw new Error("distance: lengths differ");
  let s = 0;
  for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2;
  return Math.sqrt(s);
}

// The k rows of `table` closest to row i, itself left out. metric "cosine"
// ranks by largest cosine, "distance" by smallest Euclidean distance. Ties
// break toward the lower index, so the order is deterministic.
export function nearest(table, i, k = 3, metric = "cosine") {
  const out = [];
  for (let j = 0; j < table.length; j++) {
    if (j === i) continue;
    out.push({ index: j, score: metric === "distance" ? distance(table[i], table[j]) : cosine(table[i], table[j]) });
  }
  const sign = metric === "distance" ? 1 : -1;
  out.sort((a, b) => sign * (a.score - b.score) || a.index - b.index);
  return out.slice(0, k);
}

// ---- the trained model's tables ----------------------------------------------

// wte is [vocab, d] row-major: row w is the vector a word enters with.
// wout is [d, vocab] row-major: column w is the vector the final hidden
// state is dotted with to score word w. Both come back as vocab rows of d.
export function loadTables(modelJson) {
  const model = fromJSON(modelJson.weights ?? modelJson);
  const { vocab: V, dModel: D } = model.config;
  const wte = [], wout = [];
  for (let w = 0; w < V; w++) {
    wte.push(Array.from(model.params.wte.subarray(w * D, (w + 1) * D)));
    const col = new Array(D);
    for (let i = 0; i < D; i++) col[i] = model.params.wout[i * V + w];
    wout.push(col);
  }
  return { model, words: VOCAB.slice(), wte, wout };
}

// The residual stream after `layers` transformer layers (1 = after the first
// layer), averaged over every position where a word is the input, over the
// corpus's fixed held-out rows. Words never seen as input get a zero row.
export function hiddenByWord(model, layers = 1, rows = 256) {
  const { vocab: V, dModel: D } = model.config;
  const held = heldOut(rows, model.config.ctx);
  const res = forward(model, held.x, held.batch, held.ctx).work.res[layers];
  const sum = Array.from({ length: V }, () => new Float64Array(D)), count = new Array(V).fill(0);
  for (let n = 0; n < held.x.length; n++) {
    const w = held.x[n];
    count[w]++;
    for (let i = 0; i < D; i++) sum[w][i] += res[n * D + i];
  }
  return { table: sum.map((s, w) => Array.from(s, (v) => (count[w] ? v / count[w] : 0))), count };
}

// ---- word categories ----------------------------------------------------------

// Chosen by reading corpus.mjs, by the role each word plays in its sentences:
//   guide        the three names
//   noun         things that are found, carried or named as places: THINGS, plus cone, dock, tide
//   verb         every verb form: VERBS (the who-did-it verbs) and found, put, was, lit, kept,
//                knocked, watched, stood, rang, came
//   adjective    ADJS, used only in "the <thing> was <adj> ."
//   function     the, a, who, on, in, twice (articles, the question word, prepositions, the adverb)
//   punctuation  . and ?
export const CATEGORIES = Object.freeze({
  guide: [...GUIDES],
  noun: [...THINGS, "cone", "dock", "tide"],
  verb: [...VERBS, "found", "put", "was", "lit", "kept", "knocked", "watched", "stood", "rang", "came"],
  adjective: [...ADJS],
  function: ["the", "a", "who", "on", "in", "twice"],
  punctuation: [".", "?"],
});

export function categoryOf(words = VOCAB) {
  const map = new Map();
  for (const [cat, ws] of Object.entries(CATEGORIES)) for (const w of ws) map.set(w, cat);
  return words.map((w) => {
    if (!map.has(w)) throw new Error("word has no category: " + w);
    return map.get(w);
  });
}

// ---- the measurement ----------------------------------------------------------

// Share of top-1 neighbours, and of top-k neighbours, that sit in the same
// category as the word itself, averaged over every word.
export function neighbourShare(table, labels, k = 3, metric = "cosine") {
  let top1 = 0, topk = 0;
  for (let i = 0; i < table.length; i++) {
    const nb = nearest(table, i, k, metric);
    if (labels[nb[0].index] === labels[i]) top1++;
    topk += nb.filter((n) => labels[n.index] === labels[i]).length / k;
  }
  return { top1: top1 / table.length, topk: topk / table.length };
}

// Seeded Fisher-Yates permutation of 0..n-1.
export function permutation(n, seed) {
  const r = rng(seed), p = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  return p;
}

// The control: the same vectors, but word w now owns the vector of word p[w].
// Geometry is untouched; only the link between a word and its place is cut.
export const shuffled = (table, seed) => permutation(table.length, seed).map((j) => table[j]);

const quantile = (sorted, q) => {
  const x = q * (sorted.length - 1), lo = Math.floor(x), hi = Math.ceil(x);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (x - lo);
};
function summary(values, observed) {
  const s = values.slice().sort((a, b) => a - b);
  const mean = s.reduce((a, b) => a + b, 0) / s.length;
  // One-sided permutation p-value with the +1 correction: the share of
  // shuffles at least as good as the real table.
  const atLeast = s.filter((v) => v >= observed - 1e-12).length;
  return { mean, lo95: quantile(s, 0.025), hi95: quantile(s, 0.975), p: (atLeast + 1) / (s.length + 1) };
}

// The full comparison for one table: observed shares, the shuffle control
// over `seeds` seeds (mean and 95% interval of the control distribution),
// and whether the observed share sits above that interval.
export function measureTable(table, labels, { k = 3, seeds = 1000, seed0 = 1, metric = "cosine" } = {}) {
  const obs = neighbourShare(table, labels, k, metric);
  const c1 = [], ck = [];
  for (let s = 0; s < seeds; s++) {
    const m = neighbourShare(shuffled(table, seed0 + s), labels, k, metric);
    c1.push(m.top1); ck.push(m.topk);
  }
  const t1 = summary(c1, obs.top1), tk = summary(ck, obs.topk);
  return {
    top1: obs.top1, topk: obs.topk, k, seeds,
    control: { top1: t1, topk: tk },
    beatsControl: { top1: obs.top1 > t1.hi95, topk: obs.topk > tk.hi95 },
  };
}

// Same-category share expected by chance for a uniformly random other word.
export function chanceShare(labels) {
  const n = labels.length, counts = {};
  for (const l of labels) counts[l] = (counts[l] || 0) + 1;
  return Object.values(counts).reduce((s, c) => s + c * (c - 1) / (n - 1), 0) / n;
}

// ---- the 2D picture ---------------------------------------------------------

// PCA to two axes by power iteration on the covariance matrix, with
// deflation. Deterministic: fixed start vector, fixed iteration count, and
// each axis signed so its largest-magnitude entry is positive.
export function pca2(table, iters = 500) {
  const n = table.length, d = table[0].length;
  const mean = new Array(d).fill(0);
  for (const r of table) for (let i = 0; i < d; i++) mean[i] += r[i] / n;
  const X = table.map((r) => r.map((v, i) => v - mean[i]));
  const C = Array.from({ length: d }, () => new Array(d).fill(0));
  for (const r of X) for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] += r[i] * r[j] / n;
  let trace = 0;
  for (let i = 0; i < d; i++) trace += C[i][i];
  const axes = [], values = [];
  for (let a = 0; a < 2; a++) {
    let v = Array.from({ length: d }, (_, i) => 1 + i / d);
    let lambda = 0;
    for (let t = 0; t < iters; t++) {
      const w = C.map((row) => dot(row, v));
      lambda = length(w);
      if (lambda === 0) break;
      v = w.map((x) => x / lambda);
    }
    let big = 0;
    for (let i = 1; i < d; i++) if (Math.abs(v[i]) > Math.abs(v[big])) big = i;
    if (v[big] < 0) v = v.map((x) => -x);
    axes.push(v); values.push(lambda);
    for (let i = 0; i < d; i++) for (let j = 0; j < d; j++) C[i][j] -= lambda * v[i] * v[j];
  }
  return {
    coords: X.map((r) => [dot(r, axes[0]), dot(r, axes[1])]),
    axes, variance: values, varianceShare: trace > 0 ? (values[0] + values[1]) / trace : 0,
    axisShare: values.map((l) => (trace > 0 ? l / trace : 0)),
  };
}
