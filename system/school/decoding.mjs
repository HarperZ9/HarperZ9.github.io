// Lesson L15, "Decoding: temperature, top-k, top-p". Sampling words from the
// attention lab's trained model. Pure ES module, no DOM, no dependencies.
//
//   greedy       always the most likely word
//   temperature  divide the logits by T before the softmax: T < 1 sharpens,
//                T > 1 flattens, T -> 0 becomes greedy
//   top-k        keep the k most likely words, renormalise (Fan et al. 2018
//                sampled from the 10 most likely words)
//   top-p        keep the smallest set of most likely words whose total
//                probability is at least p, renormalise (nucleus sampling,
//                Holtzman et al. 2020)
//   uniform      every word 1/46, the control that ignores the model
//
// Generation uses an incremental forward pass with a key/value cache, which
// gives the same logits as forward() on the whole prefix (a test checks it)
// at a fraction of the cost.

import { VOCAB } from "./corpus.mjs";
import { rng, layerNorm, matmul, gelu } from "./tinyformer-ops.mjs";
import { softmax } from "./nextword.mjs";

export const V = VOCAB.length;

export function createCache(model, B) {
  const c = model.config, F = model.F, d = c.dModel;
  if (c.attnMode !== "normal") throw new Error("the cache supports attnMode normal only");
  const kv = () => Array.from({ length: c.nLayers }, () => new F(B * c.ctx * d));
  return {
    B, pos: 0, k: kv(), v: kv(), h: new F(B * d), ln: new F(B * d), xh: new F(B * d), rs: new F(B),
    qkv: new F(B * 3 * d), ao: new F(B * d), tmp: new F(B * d), f1: new F(B * c.dFF), g1: new F(B * c.dFF),
    att: new F(c.ctx), logits: new F(B * V),
  };
}

// Attention of the newest position (cache.pos) over positions 0..pos.
function attendCached(model, C, l) {
  const c = model.config, d = c.dModel, H = c.nHeads, hd = d / H, scale = 1 / Math.sqrt(hd), pos = C.pos;
  const K = C.k[l], Vc = C.v[l], att = C.att;
  for (let b = 0; b < C.B; b++) {
    const qo = b * 3 * d, row = b * c.ctx;
    for (let i = 0; i < d; i++) { K[(row + pos) * d + i] = C.qkv[qo + d + i]; Vc[(row + pos) * d + i] = C.qkv[qo + 2 * d + i]; }
    for (let h = 0; h < H; h++) {
      let mx = -Infinity;
      for (let j = 0; j <= pos; j++) {
        let s = 0;
        for (let e = 0; e < hd; e++) s += C.qkv[qo + h * hd + e] * K[(row + j) * d + h * hd + e];
        att[j] = s * scale;
        if (att[j] > mx) mx = att[j];
      }
      let sum = 0;
      for (let j = 0; j <= pos; j++) { att[j] = Math.exp(att[j] - mx); sum += att[j]; }
      for (let e = 0; e < hd; e++) {
        let acc = 0;
        for (let j = 0; j <= pos; j++) acc += (att[j] / sum) * Vc[(row + j) * d + h * hd + e];
        C.ao[b * d + h * hd + e] = acc;
      }
    }
  }
}

// Feed one token per row at position cache.pos; returns logits [B, V]
// (a live buffer, overwritten by the next step).
export function stepCache(model, C, tokens) {
  const c = model.config, P = model.params, d = c.dModel, B = C.B;
  if (C.pos >= c.ctx) throw new Error("context full");
  for (let b = 0; b < B; b++) for (let i = 0; i < d; i++) C.h[b * d + i] = P.wte[tokens[b] * d + i] + P.wpe[C.pos * d + i];
  for (let l = 0; l < c.nLayers; l++) {
    layerNorm(C.ln, C.xh, C.rs, C.h, P[`l${l}.ln1_g`], P[`l${l}.ln1_b`], B, d);
    matmul(C.qkv, C.ln, P[`l${l}.wqkv`], P[`l${l}.bqkv`], B, d, 3 * d);
    attendCached(model, C, l);
    matmul(C.tmp, C.ao, P[`l${l}.wo`], P[`l${l}.bo`], B, d, d);
    for (let i = 0; i < B * d; i++) C.h[i] += C.tmp[i];
    layerNorm(C.ln, C.xh, C.rs, C.h, P[`l${l}.ln2_g`], P[`l${l}.ln2_b`], B, d);
    matmul(C.f1, C.ln, P[`l${l}.w1`], P[`l${l}.b1`], B, d, c.dFF);
    gelu(C.g1, C.f1, B * c.dFF);
    matmul(C.tmp, C.g1, P[`l${l}.w2`], P[`l${l}.b2`], B, c.dFF, d);
    for (let i = 0; i < B * d; i++) C.h[i] += C.tmp[i];
  }
  layerNorm(C.ln, C.xh, C.rs, C.h, P.lnf_g, P.lnf_b, B, d);
  matmul(C.logits, C.ln, P.wout, null, B, d, V);
  C.pos += 1;
  return C.logits;
}

// Index of the largest entry, lowest index on ties.
export function argmax(a) {
  let best = 0;
  for (let i = 1; i < a.length; i++) if (a[i] > a[best]) best = i;
  return best;
}

const byProb = (p) => Array.from(p, (_, i) => i).sort((a, b) => p[b] - p[a] || a - b);

// The distribution a setting samples from, given one row of logits.
// setting: { mode: "greedy" } | { mode: "uniform" } | { temperature, topK, topP }.
// Order: temperature, then top-k, then top-p, then renormalise.
export function settingProbs(logits, s = {}) {
  if (s.mode === "uniform") return new Float64Array(V).fill(1 / V);
  if (s.mode === "greedy") { const p = new Float64Array(V); p[argmax(logits)] = 1; return p; }
  const T = s.temperature ?? 1, p = softmax(T === 1 ? logits : Array.from(logits, (v) => v / T));
  if (!s.topK && !(s.topP < 1)) return p;
  const order = byProb(p), keep = new Uint8Array(V);
  let cum = 0, kept = 0;
  for (const i of order) {
    if (s.topK && kept >= s.topK) break;
    keep[i] = 1; kept++; cum += p[i];
    if (s.topP !== undefined && s.topP < 1 && cum >= s.topP) break;
  }
  let tot = 0;
  for (let i = 0; i < V; i++) { if (!keep[i]) p[i] = 0; tot += p[i]; }
  for (let i = 0; i < V; i++) p[i] /= tot;
  return p;
}

export function entropy(p) {
  let h = 0;
  for (const v of p) if (v > 0) h -= v * Math.log(v);
  return h;
}

// Inverse-CDF draw with one uniform number u in [0, 1).
export function sampleIndex(p, u) {
  let c = 0, last = 0;
  for (let i = 0; i < p.length; i++) { if (p[i] <= 0) continue; c += p[i]; last = i; if (u < c) return i; }
  return last;
}

// n continuations of one prompt. Row b draws from its own stream rng(seed + b),
// so row b of a big run equals a one-row run with seed + b. Records the mean
// entropy of the sampled-from distribution, of the model's own (T = 1)
// distribution, and the model's log probability of the chosen words.
export function generate(model, promptIds, setting, { n = 1, maxNew = 8, seed = 1 } = {}) {
  const C = createCache(model, n), rs = Array.from({ length: n }, (_, b) => rng(seed + b));
  const rows = Array.from({ length: n }, () => new Int32Array(maxNew)), tok = new Int32Array(n);
  let logits;
  for (const id of promptIds) { tok.fill(id); logits = stepCache(model, C, tok); }
  let hS = 0, hM = 0, lp = 0;
  for (let s = 0; s < maxNew; s++) {
    for (let b = 0; b < n; b++) {
      const row = logits.subarray(b * V, (b + 1) * V), p = settingProbs(row, setting), m = softmax(row);
      const u = rs[b](), w = sampleIndex(p, u);
      hS += entropy(p); hM += entropy(m); lp += Math.log(m[w]);
      rows[b][s] = w; tok[b] = w;
    }
    if (s + 1 < maxNew) logits = stepCache(model, C, tok);
  }
  const k = n * maxNew;
  return { rows, entropy: hS / k, modelEntropy: hM / k, modelLogProb: lp / k };
}

// Distinct-n: distinct n-grams over all n-grams, pooled across continuations.
export function distinctN(rows, n) {
  const seen = new Set();
  let total = 0;
  for (const r of rows) for (let i = 0; i + n <= r.length; i++) { seen.add(Array.from(r.subarray ? r.subarray(i, i + n) : r.slice(i, i + n)).join(",")); total++; }
  return total ? seen.size / total : 0;
}

// The text ends in a loop: some phrase of length >= minLen repeated at least
// `times` times in a row at the very end (Holtzman et al. 2020, Figure 9, use
// length >= 2 and three repeats).
export function endsInLoop(ids, minLen = 2, times = 3) {
  for (let L = minLen; L * times <= ids.length; L++) {
    let ok = true;
    for (let r = 1; r < times && ok; r++) for (let i = 0; i < L && ok; i++) if (ids[ids.length - 1 - i] !== ids[ids.length - 1 - i - r * L]) ok = false;
    if (ok) return true;
  }
  return false;
}

// The set of word pairs that occur in the training text, from bigram counts
// [V * V] (nextword.mjs countNgrams). A weaker check than the grammar: every
// adjacent pair is one the training text contains.
export function bigramSet(biCounts) {
  const s = new Set();
  for (let i = 0; i < biCounts.length; i++) if (biCounts[i] > 0) s.add(i);
  return s;
}

export function bigramCheck(ids, set) {
  for (let i = 1; i < ids.length; i++) if (!set.has(ids[i - 1] * V + ids[i])) return { ok: false, failAt: i };
  return { ok: true, failAt: -1 };
}

// The model's view of given continuations (teacher forcing through the
// cache): mean log probability per word and mean entropy of its next-word
// distribution. exp(-logProb) is the perplexity the model assigns the text.
export function scoreContinuations(model, promptIds, rows) {
  const n = rows.length, L = rows[0].length, C = createCache(model, n), tok = new Int32Array(n);
  let logits, lp = 0, h = 0;
  for (const id of promptIds) { tok.fill(id); logits = stepCache(model, C, tok); }
  for (let s = 0; s < L; s++) {
    for (let b = 0; b < n; b++) {
      const m = softmax(logits.subarray(b * V, (b + 1) * V));
      lp += Math.log(m[rows[b][s]]); h += entropy(m); tok[b] = rows[b][s];
    }
    if (s + 1 < L) logits = stepCache(model, C, tok);
  }
  return { modelLogProb: lp / (n * L), modelEntropy: h / (n * L) };
}
