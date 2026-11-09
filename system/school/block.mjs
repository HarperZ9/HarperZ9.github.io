// Lesson L11, "The transformer block". Pure ES module, no DOM and no
// dependencies, so the lab page, a worker and the Node fill script share it.
//
// One block of the attention lab's model (pre-norm, the GPT-2 arrangement):
//   mid = h   + Attn(LN1(h))        attention reads the normalised stream
//   out = mid + MLP(LN2(mid))       the feed-forward net does the same
// The stream h itself is never normalised in place: each sub-layer reads a
// normalised copy and adds its output back. The final layer norm and the
// output matrix turn the last stream into next-word scores.
//
// hookedForward re-runs tinyformer-model.mjs's forward with the same kernels
// in the same order (bit-identical logits when nothing is changed, which the
// tests check) and lets a caller record the stream at every sub-step or
// knock out one part:
//   part "attn" | "mlp"   the whole sub-layer output (after its bias)
//   part "head"           one head's slice of the attention output, before
//                         the output projection (the projection bias stays)
//   mode "zero"           replace with zeros
//   mode "mean"           replace with its mean over every held-out position
//   mode "shuffle"        replace with the same position's value from the
//                         next row (row b takes row b+1's): real activations,
//                         wrong context
//   mode "replace"        no residual: the stream becomes the sub-layer
//                         output instead of stream + output (attn, mlp only)

import { matmul, layerNorm, gelu, softmaxXent } from "./tinyformer-ops.mjs";
import { attnForward } from "./tinyformer-attn.mjs";

// Parameter counts by part of the network.
export function paramCounts(model) {
  const parts = { embeddings: 0, attention: 0, mlp: 0, norms: 0, output: 0 };
  for (const name of model.names) {
    const n = model.params[name].length;
    if (name === "wte" || name === "wpe") parts.embeddings += n;
    else if (name === "wout") parts.output += n;
    else if (/ln/.test(name)) parts.norms += n;
    else if (/(wqkv|bqkv|wo|bo)$/.test(name)) parts.attention += n;
    else if (/(w1|b1|w2|b2)$/.test(name)) parts.mlp += n;
    else throw new Error("unclassified parameter " + name);
  }
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { ...parts, total };
}

function bufs(model, N, B, T) {
  const c = model.config, F = model.F, d = c.dModel;
  return {
    ln: new F(N * d), xh: new F(N * d), rs: new F(N), qkv: new F(N * 3 * d),
    att: new F(B * c.nHeads * T * T), scores: new F(B * c.nHeads * T * T),
    ao: new F(N * d), tmp: new F(N * d), f1: new F(N * c.dFF), g1: new F(N * c.dFF),
  };
}

// Overwrite slice [lo, hi) of every d-wide row of `a` per the knockout.
function knock(a, src, k, N, width, lo, hi, T) {
  const mean = k.mode === "mean" ? src.means : null;
  for (let n = 0; n < N; n++) {
    const o = n * width, from = k.mode === "shuffle" ? ((n + T) % N) * width : -1;
    for (let i = lo; i < hi; i++) {
      a[o + i] = k.mode === "zero" ? 0 : mean ? mean[i] : src.values[from + i];
    }
  }
}

function findKnock(ko, layer, part) {
  return ko.find((k) => k.layer === layer && k.part === part) || null;
}

function attnSub(model, b, h, l, B, T, ko, cache) {
  const c = model.config, P = model.params, N = B * T, d = c.dModel, hd = d / c.nHeads;
  layerNorm(b.ln, b.xh, b.rs, h, P[`l${l}.ln1_g`], P[`l${l}.ln1_b`], N, d);
  matmul(b.qkv, b.ln, P[`l${l}.wqkv`], P[`l${l}.bqkv`], N, d, 3 * d);
  attnForward(b.ao, b.att, b.scores, b.qkv, B, T, d, c.nHeads, c.attnMode);
  if (cache.record) cache.record[`ao${l}`] = b.ao.slice();
  for (const k of ko) {
    if (k.layer === l && k.part === "head") knock(b.ao, cache.src[`ao${l}`], k, N, d, k.head * hd, (k.head + 1) * hd, T);
  }
  matmul(b.tmp, b.ao, P[`l${l}.wo`], P[`l${l}.bo`], N, d, d);
}

function mlpSub(model, b, h, l, N) {
  const c = model.config, P = model.params, d = c.dModel;
  layerNorm(b.ln, b.xh, b.rs, h, P[`l${l}.ln2_g`], P[`l${l}.ln2_b`], N, d);
  matmul(b.f1, b.ln, P[`l${l}.w1`], P[`l${l}.b1`], N, d, c.dFF);
  gelu(b.g1, b.f1, N * c.dFF);
  matmul(b.tmp, b.g1, P[`l${l}.w2`], P[`l${l}.b2`], N, c.dFF, d);
}

// Join a sub-layer output (b.tmp) to the stream h, after any knockout.
function join(h, b, k, key, N, d, T, cache) {
  if (cache.record) cache.record[key] = b.tmp.slice();
  if (k && k.mode !== "replace") knock(b.tmp, cache.src[key], k, N, d, 0, d, T);
  if (k && k.mode === "replace") for (let i = 0; i < N * d; i++) h[i] = b.tmp[i];
  else for (let i = 0; i < N * d; i++) h[i] = h[i] + b.tmp[i];
}

// Forward pass with recording and knockouts. Returns logits (a fresh
// Float32 array), the stream after every sub-step when `streams` is set
// (embed, then mid and out per layer), and `record` (sub-layer outputs and
// per-layer head outputs) when `record` is set, for building mean and
// shuffle knockouts.
export function hookedForward(model, x, B, T, { knockouts = [], src = {}, streams = false, record = false } = {}) {
  const c = model.config, P = model.params, d = c.dModel, N = B * T;
  const b = bufs(model, N, B, T), h = new model.F(N * d), cache = { src, record: record ? {} : null };
  for (let n = 0; n < N; n++) {
    const e = x[n] * d, p = (n % T) * d;
    for (let i = 0; i < d; i++) h[n * d + i] = P.wte[e + i] + P.wpe[p + i];
  }
  const kept = streams ? [{ at: "embed", h: h.slice() }] : null;
  for (let l = 0; l < c.nLayers; l++) {
    attnSub(model, b, h, l, B, T, knockouts, cache);
    join(h, b, findKnock(knockouts, l, "attn"), `attn${l}`, N, d, T, cache);
    if (kept) kept.push({ at: `l${l}.attn`, h: h.slice() });
    mlpSub(model, b, h, l, N);
    join(h, b, findKnock(knockouts, l, "mlp"), `mlp${l}`, N, d, T, cache);
    if (kept) kept.push({ at: `l${l}.mlp`, h: h.slice() });
  }
  return { logits: readout(model, h, N), streams: kept, record: cache.record };
}

// Final layer norm and output matrix applied to any stream. With
// normOnly, the norm's learned gain and bias are skipped (centre and scale
// only), a variant of the logit lens.
export function readout(model, h, N, { normOnly = false } = {}) {
  const c = model.config, P = model.params, d = c.dModel, F = model.F;
  const ln = new F(N * d), xh = new F(N * d), rs = new F(N), logits = new F(N * c.vocab);
  const g = normOnly ? new F(d).fill(1) : P.lnf_g, bias = normOnly ? new F(d) : P.lnf_b;
  layerNorm(ln, xh, rs, h, g, bias, N, d);
  matmul(logits, ln, P.wout, null, N, d, c.vocab);
  return logits;
}

// Means over all positions of every recorded tensor, for mean knockouts.
export function sourcesFrom(record, d) {
  const src = {};
  for (const [key, values] of Object.entries(record)) {
    const N = values.length / d, means = new Float64Array(d);
    for (let n = 0; n < N; n++) for (let i = 0; i < d; i++) means[i] += values[n * d + i];
    for (let i = 0; i < d; i++) means[i] /= N;
    src[key] = { values, means };
  }
  return src;
}

// Loss, top-1 accuracy and the copy / local split, the same way
// tinyformer-train.mjs evaluate() scores (Float32 softmax, first argmax).
export function score(model, logits, held) {
  const V = model.config.vocab, N = held.y.length, probs = new model.F(N * V);
  const loss = softmaxXent(probs, null, logits, held.y, N, V);
  const s = { copy: [0, 0, 0], local: [0, 0, 0] };
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let best = 0;
    for (let v = 1; v < V; v++) if (probs[o + v] > probs[o + best]) best = v;
    const k = held.kind[n] ? s.copy : s.local;
    k[0] += best === held.y[n] ? 1 : 0;
    k[1] += 1;
    k[2] -= Math.log(Math.max(probs[o + held.y[n]], 1e-30));
  }
  return {
    loss, top1: (s.copy[0] + s.local[0]) / N,
    copyAccuracy: s.copy[0] / Math.max(1, s.copy[1]), copyLoss: s.copy[2] / Math.max(1, s.copy[1]),
    localAccuracy: s.local[0] / Math.max(1, s.local[1]), localLoss: s.local[2] / Math.max(1, s.local[1]),
  };
}

const rowNorm = (a, n, d) => { let s = 0; for (let i = 0; i < d; i++) s += a[n * d + i] ** 2; return Math.sqrt(s); };

// Size of the stream after every sub-step and of each sub-layer's added
// output: mean over positions of the L2 norm, and the mean per-position
// ratio of the added output's norm to the norm of the stream it joins.
export function streamStats(model, held) {
  const d = model.config.dModel, N = held.y.length;
  const fw = hookedForward(model, held.x, held.batch, held.ctx, { streams: true, record: true });
  const meanNorm = (a) => { let s = 0; for (let n = 0; n < N; n++) s += rowNorm(a, n, d); return s / N; };
  const steps = fw.streams.map((s) => ({ at: s.at, norm: meanNorm(s.h) }));
  const adds = [];
  for (let k = 1; k < fw.streams.length; k++) {
    const before = fw.streams[k - 1].h, key = fw.streams[k].at.replace(/^l(\d+)\.(attn|mlp)$/, "$2$1");
    const add = fw.record[key];
    let ratio = 0, cos = 0;
    for (let n = 0; n < N; n++) {
      const a = rowNorm(add, n, d), s = rowNorm(before, n, d);
      let dot = 0;
      for (let i = 0; i < d; i++) dot += add[n * d + i] * before[n * d + i];
      ratio += a / s; cos += dot / (a * s);
    }
    adds.push({ at: fw.streams[k].at, addNorm: meanNorm(add), ratioToStream: ratio / N, cosineWithStream: cos / N });
  }
  return { steps, adds };
}

// Logit lens: the final norm and output matrix applied to the stream after
// every sub-step, scored on the held-out rows.
export function logitLens(model, held, { normOnly = false } = {}) {
  const fw = hookedForward(model, held.x, held.batch, held.ctx, { streams: true });
  return fw.streams.map((s) => ({ at: s.at, ...score(model, readout(model, s.h, held.y.length, { normOnly }), held) }));
}

// Every single knockout of the lesson, in one list.
export function knockoutList(model, modes = ["zero", "mean", "shuffle"]) {
  const c = model.config, list = [];
  for (let l = 0; l < c.nLayers; l++) {
    for (const mode of modes) {
      list.push({ name: `l${l}.attn`, knockouts: [{ layer: l, part: "attn", mode }], mode });
      for (let h = 0; h < c.nHeads; h++) list.push({ name: `l${l}.h${h}`, knockouts: [{ layer: l, part: "head", head: h, mode }], mode });
      list.push({ name: `l${l}.mlp`, knockouts: [{ layer: l, part: "mlp", mode }], mode });
    }
    for (const part of ["attn", "mlp"]) list.push({ name: `l${l}.${part}`, knockouts: [{ layer: l, part, mode: "replace" }], mode: "replace" });
  }
  for (const mode of modes) {
    for (const part of ["attn", "mlp"]) {
      list.push({ name: `all.${part}`, knockouts: Array.from({ length: c.nLayers }, (_, l) => ({ layer: l, part, mode })), mode });
    }
  }
  return list;
}

// Score the intact model and every knockout on the held-out rows.
export function ablations(model, held, list = knockoutList(model)) {
  const clean = hookedForward(model, held.x, held.batch, held.ctx, { record: true });
  const src = sourcesFrom(clean.record, model.config.dModel);
  const base = score(model, clean.logits, held);
  const rows = list.map(({ name, knockouts, mode }) => {
    const s = score(model, hookedForward(model, held.x, held.batch, held.ctx, { knockouts, src }).logits, held);
    return { name, mode, ...s, dLoss: s.loss - base.loss };
  });
  return { base, rows };
}
