// Lesson L8, "Embeddings: every token gets coordinates". A small skip-gram
// with negative sampling (Mikolov, Sutskever, Chen, Corrado, Dean 2013,
// "Distributed Representations of Words and Phrases and their
// Compositionality", NeurIPS; equation 4) trained on the guides' corpus.
//
// Each word w owns two rows: an input vector v_w (the embedding, the row the
// lesson charts) and an output vector u_w. For a centre word i, a context
// word o within the window, and k noise words n_1..n_k drawn from the
// unigram distribution raised to the 3/4 power, the loss is
//   L = -log s(u_o . v_i) - sum_j log s(-u_nj . v_i),   s(x) = 1 / (1 + e^-x)
// and its gradient, written by hand:
//   dL/dv_i  = (s(u_o . v_i) - 1) u_o + sum_j s(u_nj . v_i) u_nj
//   dL/du_o  = (s(u_o . v_i) - 1) v_i
//   dL/du_nj = s(u_nj . v_i) v_i
// gradCheck compares this with central finite differences.
//
// Training follows the reference word2vec recipe where the paper is silent:
// input rows start uniform in [-0.5/d, 0.5/d], output rows at zero; the
// window size is drawn from 1..c per centre word; a noise draw equal to the
// context word is skipped; plain SGD with the rate falling linearly to
// 1e-4 of its start. No subsampling of frequent words (the corpus has 46
// words, so the paper's 1e-5 threshold would throw away nearly every token).
//
// Plain ES module, no dependencies, Node and browser.

import { rng } from "./tinyformer-ops.mjs";
import { VOCAB, sampleSentence, encode, HELD_OUT_SEED } from "./corpus.mjs";

const sig = (x) => 1 / (1 + Math.exp(-x));

// Word ids of `n` whole episodes from corpus.mjs, one after another.
export function tokenStream(n, seed) {
  const r = rng(seed), out = [];
  for (let e = 0; e < n; e++) for (const id of encode(sampleSentence(r))) out.push(id);
  return Int32Array.from(out);
}

export function createSGNS(V, D, seed, { outInit = 0 } = {}) {
  const r = rng(seed), win = new Float64Array(V * D), wout = new Float64Array(V * D);
  for (let i = 0; i < win.length; i++) win[i] = (r() - 0.5) / D;
  if (outInit) for (let i = 0; i < wout.length; i++) wout[i] = (r() - 0.5) * outInit;
  return { V, D, win, wout };
}

// Cumulative noise distribution: unigram counts to the power 3/4.
export function noiseCdf(ids, V, power = 0.75) {
  const c = new Float64Array(V);
  for (const id of ids) c[id]++;
  let s = 0;
  const cdf = new Float64Array(V);
  for (let w = 0; w < V; w++) { s += c[w] ** power; cdf[w] = s; }
  for (let w = 0; w < V; w++) cdf[w] /= s;
  return cdf;
}
export function sampleCdf(cdf, r) {
  const u = r();
  let lo = 0, hi = cdf.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < u) lo = m + 1; else hi = m; }
  return lo;
}

const dotRows = (A, a, B, b, D) => { let s = 0; for (let k = 0; k < D; k++) s += A[a * D + k] * B[b * D + k]; return s; };

// Loss of one (centre, context, noise words) triple.
export function tripleLoss(m, i, o, negs) {
  let L = -Math.log(sig(dotRows(m.wout, o, m.win, i, m.D)));
  for (const n of negs) L -= Math.log(sig(-dotRows(m.wout, n, m.win, i, m.D)));
  return L;
}

// The hand-written gradient of one triple, ADDED into full-size gIn, gOut.
// `drop` names a term to leave out, for the control: "negInInput" drops the
// noise words' part of dL/dv_i.
export function tripleGrad(m, i, o, negs, gIn, gOut, drop = null) {
  const D = m.D, so = sig(dotRows(m.wout, o, m.win, i, D)) - 1;
  for (let k = 0; k < D; k++) { gIn[i * D + k] += so * m.wout[o * D + k]; gOut[o * D + k] += so * m.win[i * D + k]; }
  for (const n of negs) {
    const sn = sig(dotRows(m.wout, n, m.win, i, D));
    for (let k = 0; k < D; k++) {
      if (drop !== "negInInput") gIn[i * D + k] += sn * m.wout[n * D + k];
      gOut[n * D + k] += sn * m.win[i * D + k];
    }
  }
}

export function batchLoss(m, triples) {
  let L = 0;
  for (const t of triples) L += tripleLoss(m, t.i, t.o, t.negs);
  return L / triples.length;
}
export function batchGrad(m, triples, drop = null) {
  const gIn = new Float64Array(m.win.length), gOut = new Float64Array(m.wout.length);
  for (const t of triples) tripleGrad(m, t.i, t.o, t.negs, gIn, gOut, drop);
  for (let k = 0; k < gIn.length; k++) { gIn[k] /= triples.length; gOut[k] /= triples.length; }
  return { gIn, gOut };
}

// Central differences on every coordinate the triples touch. Returns the
// largest relative error max|a - f| / max(1e-8, |a| + |f|) and the count.
export function gradCheck(m, triples, { drop = null, eps = 1e-5 } = {}) {
  const { gIn, gOut } = batchGrad(m, triples, drop);
  let worst = 0, checked = 0;
  for (const [table, g] of [[m.win, gIn], [m.wout, gOut]]) {
    const rows = new Set(triples.flatMap((t) => (table === m.win ? [t.i] : [t.o, ...t.negs])));
    for (const row of rows) for (let k = 0; k < m.D; k++) {
      const p = row * m.D + k, keep = table[p];
      table[p] = keep + eps; const up = batchLoss(m, triples);
      table[p] = keep - eps; const dn = batchLoss(m, triples);
      table[p] = keep;
      const f = (up - dn) / (2 * eps), a = g[p];
      worst = Math.max(worst, Math.abs(a - f) / Math.max(1e-8, Math.abs(a) + Math.abs(f)));
      checked++;
    }
  }
  return { worst, checked };
}

// Draw `count` training triples from a stream: dynamic window, k noise words.
export function drawTriples(ids, cdf, r, count, { window = 2, negatives = 5 } = {}) {
  const out = [];
  while (out.length < count) {
    const p = Math.floor(r() * ids.length), b = 1 + Math.floor(r() * window);
    const q = p + (r() < 0.5 ? -1 : 1) * (1 + Math.floor(r() * b));
    if (q < 0 || q >= ids.length) continue;
    out.push({ i: ids[p], o: ids[q], negs: noiseFor(cdf, r, ids[q], negatives) });
  }
  return out;
}
function noiseFor(cdf, r, o, k) {
  const negs = [];
  for (let j = 0; j < k; j++) { const n = sampleCdf(cdf, r); if (n !== o) negs.push(n); }
  return negs;
}

export const table = (m, which = "win") => Array.from({ length: m.V }, (_, w) => Array.from(m[which].subarray(w * m.D, (w + 1) * m.D)));

export const TRAIN_DEFAULTS = Object.freeze({ episodes: 3000, streamSeed: 7, seed: 1, D: 32, window: 2, negatives: 5, epochs: 5, lr0: 0.025,
  snapshotAt: [0, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.35, 0.5, 0.75, 1] });

// Train with SGD, one triple at a time. snapshotAt lists fractions of all
// centre positions (over every epoch) at which onSnapshot gets the tables,
// the fraction, the triples seen, and the mean training loss since the last
// snapshot. Returns the model and the snapshots' bookkeeping.
export function trainSGNS(opts = {}, onSnapshot = () => {}) {
  const o = { ...TRAIN_DEFAULTS, ...opts };
  const ids = o.ids ?? tokenStream(o.episodes, o.streamSeed);
  const V = VOCAB.length, D = o.D, m = createSGNS(V, D, o.seed), r = rng(o.seed + 7919), cdf = noiseCdf(ids, V);
  const total = ids.length * o.epochs, marks = o.snapshotAt.map((f) => Math.round(f * total));
  const gIn = new Float64Array(D), uo = new Float64Array(D);
  let pos = 0, seen = 0, lossSum = 0, lossN = 0, next = 0;
  const snap = () => { while (next < marks.length && marks[next] <= pos) { onSnapshot(m, { fraction: o.snapshotAt[next], positions: pos, triples: seen, loss: lossN ? lossSum / lossN : null }); lossSum = 0; lossN = 0; next++; } };
  snap();
  for (let ep = 0; ep < o.epochs; ep++) {
    for (let p = 0; p < ids.length; p++) {
      const lr = o.lr0 * Math.max(1e-4, 1 - pos / total), b = 1 + Math.floor(r() * o.window), i = ids[p];
      for (let q = p - b; q <= p + b; q++) {
        if (q === p || q < 0 || q >= ids.length) continue;
        const ctx = ids[q], negs = noiseFor(cdf, r, ctx, o.negatives);
        lossSum += tripleLoss(m, i, ctx, negs); lossN++; seen++;
        // One SGD step on this triple. As in the word2vec code, each output row
        // moves at once and the centre row moves after all its terms are summed.
        gIn.fill(0);
        const step = (w, label) => {
          const s = sig(dotRows(m.wout, w, m.win, i, D)) - label;
          for (let k = 0; k < D; k++) { gIn[k] += s * m.wout[w * D + k]; uo[k] = m.win[i * D + k]; }
          for (let k = 0; k < D; k++) m.wout[w * D + k] -= lr * s * uo[k];
        };
        step(ctx, 1);
        for (const n of negs) step(n, 0);
        for (let k = 0; k < D; k++) m.win[i * D + k] -= lr * gIn[k];
      }
      pos++;
      snap();
    }
  }
  return { model: m, ids, total };
}

// A fixed set of held-out triples, from the corpus's held-out seed.
export function heldTriples(count = 4000, trainIds) {
  const ids = tokenStream(400, HELD_OUT_SEED), r = rng(HELD_OUT_SEED + 1);
  return drawTriples(ids, noiseCdf(trainIds ?? ids, VOCAB.length), r, count);
}

// Mean overlap of top-k neighbour lists between two tables over the same
// words: |A_w and B_w| / k averaged over words.
export function neighbourOverlap(A, B, k, nearestFn) {
  let s = 0;
  for (let w = 0; w < A.length; w++) {
    const a = new Set(nearestFn(A, w, k).map((n) => n.index));
    s += nearestFn(B, w, k).filter((n) => a.has(n.index)).length / k;
  }
  return s / A.length;
}
