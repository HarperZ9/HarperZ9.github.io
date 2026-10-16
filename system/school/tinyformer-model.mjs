// The tiny decoder-only transformer: parameters, forward pass, and the
// hand-written backward pass. Architecture (GPT-2 style, scaled down):
//
//   h0 = wte[token] + wpe[position]              learned positional embeddings
//   per layer:  h += Wo . attn(LN1(h) . Wqkv)    pre-LayerNorm, causal attention
//               h += W2 . gelu(LN2(h) . W1)      GELU MLP
//   logits = LNf(h) . wout                       final LayerNorm, untied readout
//
// The readout wout is untied from wte: the lab can then show "what a word
// looks like going in" and "what it takes to predict a word" as separate
// tables. The cost is vocab * dModel extra parameters (about 1.5 k).

import { VOCAB } from "./corpus.mjs";
import { rng, gauss, matmul, matmulBackward, layerNorm, layerNormBackward, gelu, geluBackward, softmaxXent } from "./tinyformer-ops.mjs";
import { attnForward, attnBackward } from "./tinyformer-attn.mjs";

export const DEFAULT_CONFIG = Object.freeze({
  vocab: VOCAB.length, ctx: 24, dModel: 32, nHeads: 2, nLayers: 2, dFF: 64,
  attnMode: "normal", // "normal" | "self" | "uniform", see tinyformer-attn.mjs
  float64: false,     // tests only: run every buffer in Float64Array
});

// [name, length, init std, weight-decayed?]. Residual output projections
// (wo, w2) start smaller by 1/sqrt(2 * nLayers) so the residual stream does
// not grow with depth at initialisation.
function paramSpecs(c) {
  const d = c.dModel, f = c.dFF, s = 0.02, sr = 0.02 / Math.sqrt(2 * c.nLayers);
  const specs = [["wte", c.vocab * d, s, true], ["wpe", c.ctx * d, s, true]];
  for (let l = 0; l < c.nLayers; l++) {
    specs.push(
      [`l${l}.ln1_g`, d, "one", false], [`l${l}.ln1_b`, d, 0, false],
      [`l${l}.wqkv`, d * 3 * d, s, true], [`l${l}.bqkv`, 3 * d, 0, false],
      [`l${l}.wo`, d * d, sr, true], [`l${l}.bo`, d, 0, false],
      [`l${l}.ln2_g`, d, "one", false], [`l${l}.ln2_b`, d, 0, false],
      [`l${l}.w1`, d * f, s, true], [`l${l}.b1`, f, 0, false],
      [`l${l}.w2`, f * d, sr, true], [`l${l}.b2`, d, 0, false]);
  }
  specs.push(["lnf_g", d, "one", false], ["lnf_b", d, 0, false], ["wout", d * c.vocab, s, true]);
  return specs;
}

export function createModel(config = {}, seed = 1) {
  const c = { ...DEFAULT_CONFIG, ...config };
  if (c.dModel % c.nHeads !== 0) throw new Error("dModel must divide by nHeads");
  const F = c.float64 ? Float64Array : Float32Array;
  const r = rng(seed);
  const params = {}, grads = {}, decay = {};
  let nParams = 0;
  for (const [name, n, std, wd] of paramSpecs(c)) {
    const p = new F(n);
    if (std === "one") p.fill(1);
    else if (std > 0) for (let i = 0; i < n; i++) p[i] = gauss(r) * std;
    params[name] = p;
    grads[name] = new F(n);
    decay[name] = wd;
    nParams += n;
  }
  return { config: c, seed, params, grads, decay, names: Object.keys(params), nParams, F, work: new Map() };
}

// Activation buffers for one (batch, ctx) shape, allocated once and reused
// so a training loop makes no garbage. The newest few shapes are kept.
function workspace(model, B, T) {
  const key = B + "x" + T;
  let w = model.work.get(key);
  if (w) return w;
  const { F, config: c } = model;
  const N = B * T, d = c.dModel, A = B * c.nHeads * T * T;
  const layers = [];
  for (let l = 0; l < c.nLayers; l++) {
    layers.push({
      ln1: new F(N * d), xh1: new F(N * d), rs1: new F(N), qkv: new F(N * 3 * d),
      att: new F(A), scores: new F(A), ao: new F(N * d),
      ln2: new F(N * d), xh2: new F(N * d), rs2: new F(N), f1: new F(N * c.dFF), g1: new F(N * c.dFF),
    });
  }
  w = {
    N, layers, res: Array.from({ length: c.nLayers + 1 }, () => new F(N * d)),
    lnf: new F(N * d), xhf: new F(N * d), rsf: new F(N), tmp: new F(N * d),
    logits: new F(N * c.vocab), probs: new F(N * c.vocab), dlogits: new F(N * c.vocab),
    dres: new F(N * d), dln: new F(N * d), dao: new F(N * d), dqkv: new F(N * 3 * d),
    dg1: new F(N * c.dFF), df1: new F(N * c.dFF), drow: new F(T),
  };
  if (model.work.size >= 4) model.work.delete(model.work.keys().next().value);
  model.work.set(key, w);
  return w;
}

function embed(model, w, x, B, T) {
  const { wte, wpe } = model.params, d = model.config.dModel, h = w.res[0];
  for (let b = 0; b < B; b++) {
    for (let t = 0; t < T; t++) {
      const n = b * T + t, o = n * d, e = x[n] * d, p = t * d;
      for (let i = 0; i < d; i++) h[o + i] = wte[e + i] + wpe[p + i];
    }
  }
}

function layerForward(model, w, l, B, T) {
  const c = model.config, P = model.params, L = w.layers[l], N = w.N, d = c.dModel;
  const xin = w.res[l], xout = w.res[l + 1], tmp = w.tmp;
  layerNorm(L.ln1, L.xh1, L.rs1, xin, P[`l${l}.ln1_g`], P[`l${l}.ln1_b`], N, d);
  matmul(L.qkv, L.ln1, P[`l${l}.wqkv`], P[`l${l}.bqkv`], N, d, 3 * d);
  attnForward(L.ao, L.att, L.scores, L.qkv, B, T, d, c.nHeads, c.attnMode);
  matmul(tmp, L.ao, P[`l${l}.wo`], P[`l${l}.bo`], N, d, d);
  for (let i = 0; i < N * d; i++) xout[i] = xin[i] + tmp[i];
  // xout now holds the mid-layer residual; the MLP adds onto it in place.
  layerNorm(L.ln2, L.xh2, L.rs2, xout, P[`l${l}.ln2_g`], P[`l${l}.ln2_b`], N, d);
  matmul(L.f1, L.ln2, P[`l${l}.w1`], P[`l${l}.b1`], N, d, c.dFF);
  gelu(L.g1, L.f1, N * c.dFF);
  matmul(tmp, L.g1, P[`l${l}.w2`], P[`l${l}.b2`], N, c.dFF, d);
  for (let i = 0; i < N * d; i++) xout[i] += tmp[i];
}

// Forward pass. Returns logits [B*T, vocab]. With keep, also returns the
// per-layer attention weights (after softmax) and pre-softmax scores as
// [B, H, T, T] arrays. All returned arrays are live workspace buffers: they
// are overwritten by the next call with the same shape, so copy what you keep.
export function forward(model, x, B, T, { keep = false } = {}) {
  const c = model.config;
  if (T > c.ctx) throw new Error(`sequence length ${T} exceeds ctx ${c.ctx}`);
  const w = workspace(model, B, T);
  embed(model, w, x, B, T);
  for (let l = 0; l < c.nLayers; l++) layerForward(model, w, l, B, T);
  const P = model.params, d = c.dModel;
  layerNorm(w.lnf, w.xhf, w.rsf, w.res[c.nLayers], P.lnf_g, P.lnf_b, w.N, d);
  matmul(w.logits, w.lnf, P.wout, null, w.N, d, c.vocab);
  const out = { logits: w.logits, work: w };
  if (keep) {
    out.attention = w.layers.map((L) => L.att);
    out.scores = w.layers.map((L) => L.scores);
  }
  return out;
}

function layerBackward(model, w, l, B, T, broken) {
  const c = model.config, P = model.params, G = model.grads, L = w.layers[l], N = w.N, d = c.dModel;
  const dres = w.dres; // gradient of the layer output; becomes gradient of its input
  // MLP branch: xout = xmid + W2 . gelu(W1 . LN2(xmid))
  matmulBackward(w.dg1, G[`l${l}.w2`], G[`l${l}.b2`], dres, L.g1, P[`l${l}.w2`], N, c.dFF, d);
  geluBackward(w.df1, w.dg1, L.f1, N * c.dFF);
  matmulBackward(w.dln, G[`l${l}.w1`], G[`l${l}.b1`], w.df1, L.ln2, P[`l${l}.w1`], N, d, c.dFF);
  layerNormBackward(dres, G[`l${l}.ln2_g`], G[`l${l}.ln2_b`], w.dln, L.xh2, L.rs2, P[`l${l}.ln2_g`], N, d);
  // Attention branch: xmid = xin + Wo . attn(LN1(xin) . Wqkv)
  matmulBackward(w.dao, G[`l${l}.wo`], G[`l${l}.bo`], dres, L.ao, P[`l${l}.wo`], N, d, d);
  attnBackward(w.dqkv, w.dao, L.att, L.qkv, B, T, d, c.nHeads, c.attnMode, w.drow, broken);
  matmulBackward(w.dln, G[`l${l}.wqkv`], G[`l${l}.bqkv`], w.dqkv, L.ln1, P[`l${l}.wqkv`], N, d, 3 * d);
  layerNormBackward(dres, G[`l${l}.ln1_g`], G[`l${l}.ln1_b`], w.dln, L.xh1, L.rs1, P[`l${l}.ln1_g`], N, d);
}

// Mean next-token cross-entropy and its gradient for every parameter.
// grads are model.grads (reused buffers, valid until the next call).
// opts.brokenSoftmax is the gradient-check control, never used in training.
// opts.lossHead (optional) replaces the cross-entropy head: it is called as
// lossHead({ logits, probs, dlogits, y, N, V }), must fill dlogits with
// d(loss)/d(logits) and return the loss (distillation's soft targets use it).
// Without it the default path below runs unchanged.
export function lossAndGrad(model, x, y, B, T, opts = {}) {
  const c = model.config, P = model.params, G = model.grads, d = c.dModel;
  const fw = forward(model, x, B, T, { keep: true });
  const w = fw.work, N = w.N;
  const loss = opts.lossHead
    ? opts.lossHead({ logits: w.logits, probs: w.probs, dlogits: w.dlogits, y, N, V: c.vocab })
    : softmaxXent(w.probs, w.dlogits, w.logits, y, N, c.vocab);
  for (const name of model.names) G[name].fill(0);
  matmulBackward(w.dln, G.wout, null, w.dlogits, w.lnf, P.wout, N, d, c.vocab);
  w.dres.fill(0);
  layerNormBackward(w.dres, G.lnf_g, G.lnf_b, w.dln, w.xhf, w.rsf, P.lnf_g, N, d);
  for (let l = c.nLayers - 1; l >= 0; l--) layerBackward(model, w, l, B, T, !!opts.brokenSoftmax);
  for (let b = 0; b < B; b++) {
    for (let t = 0; t < T; t++) {
      const n = b * T + t, o = n * d, e = x[n] * d, p = t * d;
      for (let i = 0; i < d; i++) { G.wte[e + i] += w.dres[o + i]; G.wpe[p + i] += w.dres[o + i]; }
    }
  }
  return { loss, grads: G, attention: fw.attention, probs: w.probs };
}

// Mean loss only (no gradient), used by the finite-difference check.
export function lossOnly(model, x, y, B, T) {
  const w = forward(model, x, B, T).work;
  return softmaxXent(w.probs, null, w.logits, y, w.N, model.config.vocab);
}

// Floating-point operations for one training step (multiply and add count
// as two). Dense layers cost 2 * tokens * (inputs * outputs); attention
// costs 2 * hd per (query, key) pair for the scores and the same again for
// mixing values, with B * H * T(T+1)/2 causal pairs. Softmax, norms and GELU
// are left out (a few percent at this size). A training step is counted as
// three forward passes: the backward pass of a dense layer is two matmuls of
// the same size as its forward one.
export function FLOPS(config = {}, batch = 16, ctx = 24) {
  const c = { ...DEFAULT_CONFIG, ...config }, d = c.dModel, N = batch * ctx;
  const perLayerDense = d * 3 * d + d * d + d * c.dFF + c.dFF * d;
  const dense = 2 * N * (c.nLayers * perLayerDense + d * c.vocab);
  const pairs = batch * c.nHeads * ctx * (ctx + 1) / 2;
  const attn = c.nLayers * pairs * 4 * (d / c.nHeads);
  const forwardFlops = dense + attn;
  return { forward: forwardFlops, step: 3 * forwardFlops };
}
