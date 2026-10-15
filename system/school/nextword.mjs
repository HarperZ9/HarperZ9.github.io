// Lesson L9, "Next-word prediction and the loss". Pure ES module, no DOM and
// no dependencies, so the lab page, a worker and the Node fill script share it.
//
//   logits      the model's last vector times the readout: one score per word
//   softmax     scores to probabilities (shift by the max first, then exp/sum)
//   loss        cross-entropy: minus the log probability of the word that came
//   perplexity  exp(mean loss): "how many words the model is torn between"
//
// The n-gram baselines (unigram, bigram, trigram) count the same training
// tokens the attention model saw and are scored on the same held-out rows,
// so the gap between them is what context buys.

import { VOCAB, encode } from "./corpus.mjs";
import { forward } from "./tinyformer.mjs";

export const V = VOCAB.length;

// Stable softmax of a plain array or typed array; returns Float64Array.
export function softmax(logits) {
  let mx = -Infinity;
  for (const v of logits) if (v > mx) mx = v;
  const p = Float64Array.from(logits, (v) => Math.exp(v - mx));
  let s = 0;
  for (const v of p) s += v;
  for (let i = 0; i < p.length; i++) p[i] /= s;
  return p;
}

// Cross-entropy in nats: -log p[target], computed as logsumexp - logit so a
// very unlikely word does not underflow to log 0.
export function crossEntropy(logits, target) {
  let mx = -Infinity;
  for (const v of logits) if (v > mx) mx = v;
  let s = 0;
  for (const v of logits) s += Math.exp(v - mx);
  return mx + Math.log(s) - logits[target];
}

// d loss / d logits = p - onehot(target). `broken` drops the minus one: the
// control that a finite-difference check must reject.
export function xentGrad(logits, target, { broken = false } = {}) {
  const g = softmax(logits);
  if (!broken) g[target] -= 1;
  return g;
}

// Central finite differences of crossEntropy with respect to each logit.
export function finiteDiff(logits, target, eps = 1e-5) {
  return Array.from(logits, (_, i) => {
    const up = Array.from(logits), dn = Array.from(logits);
    up[i] += eps; dn[i] -= eps;
    return (crossEntropy(up, target) - crossEntropy(dn, target)) / (2 * eps);
  });
}

// Worst relative error between an analytic and a numeric gradient. The
// denominator has a floor of 1e-4, so entries near zero (where a finite
// difference has only rounding noise to offer) are judged on absolute error.
export function relError(a, f) {
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - f[i]) / Math.max(1e-4, Math.abs(a[i]) + Math.abs(f[i])));
  return worst;
}

// The hand-checkable example: four words, four scores, one right answer.
export function workedExample(logits = [2, 1, 0, -1], target = 0, words = ["lamp", "map", "net", "bell"]) {
  const p = softmax(logits), loss = crossEntropy(logits, target);
  const grad = xentGrad(logits, target), bad = xentGrad(logits, target, { broken: true }), fd = finiteDiff(logits, target);
  return {
    words, logits: Array.from(logits), target, answer: words[target],
    exp: Array.from(logits, Math.exp), probs: Array.from(p), loss, perplexity: Math.exp(loss),
    grad: Array.from(grad), finiteDiff: fd, gradError: relError(grad, fd),
    brokenGrad: Array.from(bad), brokenError: relError(bad, fd),
    shiftInvariant: relError(softmax(logits.map((v) => v + 100)), p),
  };
}

// Probabilities for every position of a [B, T] batch (Float64Array B*T*V).
export function batchProbs(model, x, B, T) {
  const { logits } = forward(model, x, B, T);
  const out = new Float64Array(B * T * V);
  for (let n = 0; n < B * T; n++) out.set(softmax(logits.subarray(n * V, (n + 1) * V)), n * V);
  return out;
}

// The k most likely words in one probability row.
export function topK(row, k = 5) {
  return Array.from(row, (p, id) => ({ word: VOCAB[id], id, p })).sort((a, b) => b.p - a.p || a.id - b.id).slice(0, k);
}

// Rank of the target (0 = top-1) in a row; ties broken by lower id first.
export function rankOf(row, target) {
  let r = 0;
  for (let v = 0; v < row.length; v++) if (row[v] > row[target] || (row[v] === row[target] && v < target)) r++;
  return r;
}

// One probe: the prediction at its query position, and the mean loss over
// every position of the probe whose next word the probe itself contains.
export function probeReport(model, probe) {
  const x = encode(probe.words), T = x.length, P = batchProbs(model, x, 1, T);
  const row = P.subarray(probe.query * V, (probe.query + 1) * V), ans = VOCAB.indexOf(probe.answer);
  let inside = 0;
  for (let t = 0; t < T - 1; t++) inside -= Math.log(P[t * V + x[t + 1]]);
  return {
    words: probe.words, query: probe.query, answer: probe.answer, kind: probe.kind,
    top5: topK(row, 5), pAnswer: row[ans], loss: -Math.log(row[ans]), rank: rankOf(row, ans),
    meanLossInside: T > 1 ? inside / (T - 1) : null, positionsInside: T - 1,
  };
}

// Chance that the target lands in the top k when ties are ordered at random:
// g words score strictly higher, e words (the target included) score the same.
export function topKCredit(row, target, k) {
  let g = 0, e = 0;
  for (let v = 0; v < row.length; v++) { if (row[v] > row[target]) g++; else if (row[v] === row[target]) e++; }
  return Math.min(1, Math.max(0, (k - g) / e));
}

// Loss, perplexity and top-1 / top-5 share of a probability table P on a
// held-out batch, overall and split by the corpus's copy / local labels.
// Ties count fractionally (topKCredit), so the uniform guess scores 1/46.
export function scoreTable(P, held) {
  const acc = { all: [0, 0, 0, 0], copy: [0, 0, 0, 0], local: [0, 0, 0, 0] }; // loss, n, top1, top5
  for (let n = 0; n < held.y.length; n++) {
    const row = P.subarray(n * V, (n + 1) * V), y = held.y[n], l = -Math.log(Math.max(row[y], 1e-300));
    const t1 = topKCredit(row, y, 1), t5 = topKCredit(row, y, 5);
    for (const k of ["all", held.kind[n] ? "copy" : "local"]) { acc[k][0] += l; acc[k][1]++; acc[k][2] += t1; acc[k][3] += t5; }
  }
  const out = {};
  for (const [k, [l, n, t1, t5]] of Object.entries(acc)) out[k] = { n, loss: l / n, perplexity: Math.exp(l / n), top1: t1 / n, top5: t5 / n };
  return out;
}

export function scoreModel(model, held) {
  return scoreTable(batchProbs(model, held.x, held.batch, held.ctx), held);
}

// The uniform guess as a table, the floor every control is read against.
export function uniformTable(n) {
  return new Float64Array(n * V).fill(1 / V);
}

// N-gram counts over training batches. order 1: counts of y; order 2: counts
// of (x_t, y_t); order 3: counts of (x_{t-1}, x_t, y_t) inside a row, with the
// first position of a row counted in the bigram table only.
export function countNgrams(batches) {
  const uni = new Float64Array(V), bi = new Float64Array(V * V), tri = new Float64Array(V * V * V);
  let tokens = 0;
  for (const b of batches) {
    for (let n = 0; n < b.y.length; n++) {
      const t = n % b.ctx, y = b.y[n], x = b.x[n];
      uni[y]++; bi[x * V + y]++; tokens++;
      if (t > 0) tri[(b.x[n - 1] * V + x) * V + y]++;
    }
  }
  return { uni, bi, tri, tokens };
}

// Add-alpha smoothed n-gram probability table for a held-out batch. order 3
// backs off to the bigram at a row's first position (no earlier word).
export function ngramTable(counts, held, order, alpha = 1) {
  const P = new Float64Array(held.y.length * V);
  for (let n = 0; n < held.y.length; n++) {
    const t = n % held.ctx, x = held.x[n];
    let src, off;
    if (order === 1) { src = counts.uni; off = 0; }
    else if (order === 2 || t === 0) { src = counts.bi; off = x * V; }
    else { src = counts.tri; off = (held.x[n - 1] * V + x) * V; }
    let tot = 0;
    for (let v = 0; v < V; v++) tot += src[off + v] + alpha;
    for (let v = 0; v < V; v++) P[n * V + v] = (src[off + v] + alpha) / tot;
  }
  return P;
}

// Loss at each held-out position, averaged by position in the row: shows
// that the first few positions (little context) cost more.
export function lossByPosition(P, held) {
  const sum = new Float64Array(held.ctx), cnt = new Float64Array(held.ctx);
  for (let n = 0; n < held.y.length; n++) { const t = n % held.ctx; sum[t] -= Math.log(P[n * V + held.y[n]]); cnt[t]++; }
  return Array.from(sum, (s, t) => s / cnt[t]);
}
