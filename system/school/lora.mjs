// Lesson S19, "LoRA and fine-tuning". Pure ES module, no DOM and no
// dependencies, so the lab page, a worker and the Node fill script share it.
//
// LoRA (Hu et al. 2022, "LoRA: Low-Rank Adaptation of Large Language
// Models") freezes a pretrained weight W and learns a low-rank change:
//   W_eff = W + s * Delta,  Delta of rank r,  s = alpha / r.
// In the paper's column-vector notation Delta = B A with A [r, d_in] random
// and B [d_out, r] zero at the start. This model stores a dense weight as
// [K, M] = [inputs, outputs] and computes rows x . W (tinyformer-dense.mjs),
// so here Delta = A . B with A [K, r] (the paper's A transposed: it reads the
// input) and B [r, M] (the paper's B transposed: it writes the output). B
// starts at zero, so the adapted model starts exactly at the base.
//
// Exact gradients without touching the model: the forward pass is linear in
// each weight matrix, so with G = dLoss/dW_eff (what lossAndGrad returns for
// the matrix when it holds W_eff),
//   dA = s * G . B^T   [K, r]        dB = s * A^T . G   [r, M]
// (in the paper's notation: dA = s B^T G and dB = s G A^T).

import { rng } from "./tinyformer-ops.mjs";
import { createModel, forward, lossAndGrad, lossOnly } from "./tinyformer-model.mjs";
import { createAdamState, adam } from "./tinyformer-train.mjs";
import { DEFAULTS, lrAt } from "./trainloop.mjs";

// Which matrices get an adapter. "attn": the attention projections (fused
// query/key/value and output) of both layers. "all": every dense matrix
// (attention, feed-forward and the readout). The embedding tables are left
// out in both: they are lookups, and the paper adapts dense layers.
export function targetSet(config, which) {
  const out = [];
  for (let l = 0; l < config.nLayers; l++) {
    out.push(`l${l}.wqkv`, `l${l}.wo`);
    if (which === "all") out.push(`l${l}.w1`, `l${l}.w2`);
  }
  if (which === "all") out.push("wout");
  return out;
}

// [K, M] of a dense matrix.
export function shapeOf(config, name) {
  const d = config.dModel, f = config.dFF, base = name.replace(/^l\d+\./, "");
  return { wqkv: [d, 3 * d], wo: [d, d], w1: [d, f], w2: [f, d], wout: [d, config.vocab] }[base];
}

// A copy of a model (same config and seed, weights copied).
export function cloneModel(m) {
  const c = createModel(m.config, m.seed);
  for (const n of m.names) c.params[n].set(m.params[n]);
  return c;
}

// An adapter on a copy of `base`. A is drawn uniform in [-1/sqrt(K), 1/sqrt(K)]
// (the reference implementation's Kaiming-uniform bound), B is zero.
export function createLora(base, { targets = "attn", rank = 4, alpha = 8, seed = 1 } = {}) {
  const model = cloneModel(base), r = rng(seed), F = model.F, s = rank > 0 ? alpha / rank : 0;
  const names = Array.isArray(targets) ? targets : targetSet(base.config, targets);
  const mats = names.map((name) => {
    const [K, M] = shapeOf(base.config, name), bound = 1 / Math.sqrt(K);
    const A = new F(K * rank), B = new F(rank * M);
    for (let i = 0; i < A.length; i++) A[i] = (2 * r() - 1) * bound;
    return { name, K, M, A, B, W: Float64Array.from(base.params[name]) };
  });
  const view = { names: [], params: {}, grads: {}, decay: {}, F };
  for (const m of mats) for (const [k, t] of [["A", m.A], ["B", m.B]]) {
    const key = `${m.name}.${k}`;
    view.names.push(key); view.params[key] = t; view.grads[key] = new F(t.length); view.decay[key] = false;
  }
  const ad = { model, mats, rank, alpha, s, view, trained: mats.reduce((a, m) => a + m.A.length + m.B.length, 0) };
  applyLora(ad);
  return ad;
}

// Write W_eff = W + s * A . B into the model's matrices.
export function applyLora(ad) {
  const { s, rank } = ad;
  for (const { name, K, M, A, B, W } of ad.mats) {
    const P = ad.model.params[name];
    for (let k = 0; k < K; k++) {
      for (let m = 0; m < M; m++) {
        let d = 0;
        for (let j = 0; j < rank; j++) d += A[k * rank + j] * B[j * M + m];
        P[k * M + m] = W[k * M + m] + s * d;
      }
    }
  }
}

// dA = s * G . B^T and dB = s * A^T . G from G = model.grads[name].
// brokenTranspose reads B as if it were stored [M, r]: a gradient-check
// control, never used in training.
export function loraGrads(ad, grads, { brokenTranspose = false } = {}) {
  const { s, rank, view } = ad;
  for (const { name, K, M, A, B } of ad.mats) {
    const G = grads[name], dA = view.grads[`${name}.A`], dB = view.grads[`${name}.B`];
    const bAt = brokenTranspose ? (j, m) => B[m * rank + j] : (j, m) => B[j * M + m];
    for (let k = 0; k < K; k++) for (let j = 0; j < rank; j++) {
      let v = 0;
      for (let m = 0; m < M; m++) v += G[k * M + m] * bAt(j, m);
      dA[k * rank + j] = s * v;
    }
    for (let j = 0; j < rank; j++) for (let m = 0; m < M; m++) {
      let v = 0;
      for (let k = 0; k < K; k++) v += A[k * rank + j] * G[k * M + m];
      dB[j * M + m] = s * v;
    }
  }
  return view.grads;
}

// Loss and adapter gradients for one batch.
export function loraLossAndGrad(ad, x, y, B, T, opts = {}) {
  applyLora(ad);
  const { loss, grads } = lossAndGrad(ad.model, x, y, B, T);
  return { loss, grads: loraGrads(ad, grads, opts) };
}

// Loss of the adapted model only (for finite differences).
export function loraLoss(ad, x, y, B, T) {
  applyLora(ad);
  return lossOnly(ad.model, x, y, B, T);
}

// An optimiser view of some of a model's tensors: adam() then trains only them.
export function subsetView(model, names) {
  return { names, params: model.params, grads: model.grads, decay: model.decay, F: model.F };
}

// A fine-tuning method on a copy of base. method:
//   { kind: "full" }                      every number
//   { kind: "readout" }                   the readout matrix wout only
//   { kind: "lastLayer" }                 layer 2's block, the final norm and wout
//   { kind: "lora", targets, rank, alpha, seed }
export function createMethod(base, method) {
  if (method.kind === "lora") {
    const ad = createLora(base, method);
    return { model: ad.model, adapter: ad, view: ad.view, trained: ad.trained, lossAndGrad: (x, y, B, T) => loraLossAndGrad(ad, x, y, B, T) };
  }
  const model = cloneModel(base), last = model.config.nLayers - 1;
  const names = method.kind === "full" ? model.names
    : method.kind === "readout" ? ["wout"]
    : model.names.filter((n) => n.startsWith(`l${last}.`) || n === "lnf_g" || n === "lnf_b" || n === "wout");
  const view = subsetView(model, names);
  return { model, view, trained: names.reduce((a, n) => a + model.params[n].length, 0), lossAndGrad: (x, y, B, T) => lossAndGrad(model, x, y, B, T) };
}

const now = () => (globalThis.performance ? performance.now() : Date.now());

// Step-at-a-time fine-tuner. Same AdamW, warmup and clipping as the attention
// lab, with weight decay 0 by default: decay would pull every weight towards
// zero and add a full-rank shrink to the weight change this lesson measures.
export function createFinetuner(base, method, source, opts = {}) {
  const o = { ...DEFAULTS, weightDecay: 0, ...opts }, run = createMethod(base, method);
  const state = createAdamState(run.view), ctx = base.config.ctx;
  let step = 0;
  return {
    ...run, opts: o,
    get stepCount() { return step; },
    step() {
      const t0 = now(), { x, y } = source.next();
      const { loss, grads } = run.lossAndGrad(x, y, o.batch, ctx);
      const gradNorm = adam({ ...run.view, grads }, grads, state, { lr: lrAt(step, o.lr, o.warmup), weightDecay: o.weightDecay, clip: o.clip });
      step += 1;
      if (run.adapter) applyLora(run.adapter);
      return { step, loss, gradNorm, ms: now() - t0 };
    },
  };
}

// The merged model: a plain model whose matrices hold W + s * A . B.
export function mergeLora(ad) {
  applyLora(ad);
  return cloneModel(ad.model);
}

// The adapter path as the paper writes it, h = x W + s (x A) B, for every
// adapted matrix on its real inputs from a forward pass of the base, against
// the merged weight x (W + s A B). Returns the largest absolute difference.
export function adapterPathGap(ad, base, x, Bn, T) {
  const fw = forward(cloneModel(base), x, Bn, T, { keep: true }).work, N = Bn * T;
  const inputs = (name) => {
    const m = /^l(\d+)\.(\w+)$/.exec(name);
    if (!m) return fw.lnf;
    const L = fw.layers[Number(m[1])];
    return { wqkv: L.ln1, wo: L.ao, w1: L.ln2, w2: L.g1 }[m[2]];
  };
  applyLora(ad);
  let worst = 0;
  for (const { name, K, M, A, B, W } of ad.mats) {
    const X = Float64Array.from(inputs(name)), Weff = ad.model.params[name];
    for (let n = 0; n < N; n++) {
      const xa = new Float64Array(ad.rank);
      for (let j = 0; j < ad.rank; j++) for (let k = 0; k < K; k++) xa[j] += X[n * K + k] * A[k * ad.rank + j];
      for (let m = 0; m < M; m++) {
        let viaW = 0, merged = 0, low = 0;
        for (let k = 0; k < K; k++) { viaW += X[n * K + k] * W[k * M + m]; merged += X[n * K + k] * Weff[k * M + m]; }
        for (let j = 0; j < ad.rank; j++) low += xa[j] * B[j * M + m];
        worst = Math.max(worst, Math.abs(viaW + ad.s * low - merged));
      }
    }
  }
  return worst;
}


// Finite-difference check of the adapter gradient: central differences of
// the loss in every entry of every A and B against loraGrads. Returns the
// worst tensor-level relative error |num - ana| / (|num| + |ana|) (L2 norms).
export function adapterGradError(ad, x, y, B, T, opts = {}, eps = 1e-6) {
  const { grads } = loraLossAndGrad(ad, x, y, B, T, opts);
  let worst = 0;
  for (const name of ad.view.names) {
    const p = ad.view.params[name], ana = Float64Array.from(grads[name]);
    let diff = 0, sum = 0;
    for (let i = 0; i < p.length; i++) {
      const keep = p[i];
      p[i] = keep + eps; const lp = loraLoss(ad, x, y, B, T);
      p[i] = keep - eps; const lm = loraLoss(ad, x, y, B, T);
      p[i] = keep;
      const num = (lp - lm) / (2 * eps);
      diff += (num - ana[i]) ** 2; sum += num * num + ana[i] ** 2;
    }
    worst = Math.max(worst, Math.sqrt(diff) / Math.max(Math.sqrt(sum), 1e-30));
  }
  return worst;
}
