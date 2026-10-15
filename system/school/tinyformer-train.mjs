// Training, evaluation, probing and serialisation for the tiny transformer.

import { VOCAB, encode, makeBatch } from "./corpus.mjs";
import { rng, softmaxXent, bytesToBase64, base64ToBytes } from "./tinyformer-ops.mjs";
import { createModel, forward, lossAndGrad } from "./tinyformer-model.mjs";

// Gradient clipping threshold on the global L2 norm of all gradients. At 1.0
// an unlucky batch early in training cannot throw the weights far; later in
// training the norm sits well under 1 and the clip does nothing.
export const CLIP_NORM = 1.0;

export function createAdamState(model) {
  const m = {}, v = {};
  for (const name of model.names) { m[name] = new model.F(model.params[name].length); v[name] = new model.F(model.params[name].length); }
  return { m, v, t: 0 };
}

// AdamW step with global-norm clipping. Weight decay is decoupled (applied
// to the weight directly, not through the gradient) and only touches the
// matrices and embeddings, never gains or biases. Returns the gradient norm
// before clipping, which the lab plots.
export function adam(model, grads, state, { lr = 3e-3, beta1 = 0.9, beta2 = 0.99, eps = 1e-8, weightDecay = 0.01, clip = CLIP_NORM } = {}) {
  let sq = 0;
  for (const name of model.names) { const g = grads[name]; for (let i = 0; i < g.length; i++) sq += g[i] * g[i]; }
  const norm = Math.sqrt(sq);
  const k = norm > clip ? clip / norm : 1;
  state.t += 1;
  const bc1 = 1 - Math.pow(beta1, state.t), bc2 = 1 - Math.pow(beta2, state.t);
  for (const name of model.names) {
    const p = model.params[name], g = grads[name], m = state.m[name], v = state.v[name];
    const wd = model.decay[name] ? weightDecay : 0;
    for (let i = 0; i < p.length; i++) {
      const gi = g[i] * k;
      m[i] = beta1 * m[i] + (1 - beta1) * gi;
      v[i] = beta2 * v[i] + (1 - beta2) * gi * gi;
      p[i] -= lr * ((m[i] / bc1) / (Math.sqrt(v[i] / bc2) + eps) + wd * p[i]);
    }
  }
  return norm;
}

const now = () => (globalThis.performance ? performance.now() : Date.now());

// Step-at-a-time trainer, so a page can run one step per animation frame or
// a worker can run them in a loop and post results. The data stream has its
// own seed; with the same model seed and data seed the run is bit-identical.
// Learning rate: linear warmup over `warmup` steps, then constant. The 1e-2
// default was picked by measurement (2026-10-14): at 3e-3 the copy skill
// appears near step 900, at 1e-2 near step 750, with no instability.
export function createTrainer(model, opts = {}) {
  const o = { batch: 16, lr: 1e-2, seed: 1, warmup: 30, weightDecay: 0.01, clip: CLIP_NORM, ...opts };
  const ctx = o.ctx ?? model.config.ctx;
  const data = rng(o.seed);
  const state = createAdamState(model);
  let step = 0;
  return {
    opts: o,
    state,
    get stepCount() { return step; },
    step() {
      const t0 = now();
      const { x, y } = makeBatch(data, o.batch, ctx);
      const { loss, grads } = lossAndGrad(model, x, y, o.batch, ctx);
      const lr = o.lr * Math.min(1, (step + 1) / Math.max(1, o.warmup));
      const gradNorm = adam(model, grads, state, { lr, weightDecay: o.weightDecay, clip: o.clip });
      step += 1;
      return { step, loss, gradNorm, lr, ms: now() - t0 };
    },
  };
}

// Blocking loop over createTrainer, for Node scripts and tests. A page
// should call trainer.step() itself so the frame never stalls.
export function train(model, { steps = 100, onStep, ...opts } = {}) {
  const trainer = createTrainer(model, opts);
  let last = null;
  for (let s = 0; s < steps; s++) {
    last = trainer.step();
    if (onStep) onStep(last);
  }
  return last;
}

// Held-out loss and accuracy, split into look-back ("copy") targets and
// local targets as labelled by the corpus. sourceAttention[l][h] is the mean
// weight head h of layer l puts on the copy source word, over copy targets:
// a direct reading of whether a head has learned to look back.
export function evaluate(model, held) {
  const { x, y, kind, src, batch: B, ctx: T } = held;
  const c = model.config, V = c.vocab, N = B * T;
  const fw = forward(model, x, B, T, { keep: true });
  const w = fw.work;
  const loss = softmaxXent(w.probs, null, w.logits, y, N, V);
  const acc = { copy: [0, 0, 0], local: [0, 0, 0] }; // [right, count, loss]
  const srcAtt = fw.attention.map(() => new Float64Array(c.nHeads));
  for (let n = 0; n < N; n++) {
    const o = n * V;
    let best = 0;
    for (let v = 1; v < V; v++) if (w.probs[o + v] > w.probs[o + best]) best = v;
    const bucket = kind[n] ? acc.copy : acc.local;
    bucket[0] += best === y[n] ? 1 : 0;
    bucket[1] += 1;
    bucket[2] -= Math.log(Math.max(w.probs[o + y[n]], 1e-30));
    if (kind[n]) addSourceAttention(srcAtt, fw.attention, n, src[n], T, c.nHeads);
  }
  const nc = Math.max(1, acc.copy[1]);
  return {
    loss,
    accuracy: (acc.copy[0] + acc.local[0]) / N,
    copyAccuracy: acc.copy[0] / nc, copyLoss: acc.copy[2] / nc, nCopy: acc.copy[1],
    localAccuracy: acc.local[0] / Math.max(1, acc.local[1]), localLoss: acc.local[2] / Math.max(1, acc.local[1]), nLocal: acc.local[1],
    sourceAttention: srcAtt.map((a) => Array.from(a, (s) => s / nc)),
  };
}

function addSourceAttention(out, attention, n, s, T, H) {
  const b = Math.floor(n / T), i = n % T;
  for (let l = 0; l < attention.length; l++) {
    for (let h = 0; h < H; h++) out[l][h] += attention[l][((b * H + h) * T + i) * T + s];
  }
}

// Attention maps and predictions for one word sequence (a probe).
// layers[l][h] is a T x T array of rows (row i: where position i looks);
// top5[i] lists the five most likely next words after position i.
export function attentionOn(model, words) {
  const x = encode(words), T = x.length, V = model.config.vocab, H = model.config.nHeads;
  const fw = forward(model, x, 1, T, { keep: true });
  const probs = new Float64Array(T * V);
  softmaxXent(probs, null, fw.logits, new Int32Array(T), T, V);
  const layers = fw.attention.map((att) => {
    const heads = [];
    for (let h = 0; h < H; h++) {
      const rows = [];
      for (let i = 0; i < T; i++) rows.push(Array.from(att.subarray((h * T + i) * T, (h * T + i + 1) * T)));
      heads.push(rows);
    }
    return heads;
  });
  const top5 = [];
  for (let i = 0; i < T; i++) {
    const row = Array.from(probs.subarray(i * V, (i + 1) * V), (p, id) => ({ word: VOCAB[id], p }));
    row.sort((a, b) => b.p - a.p);
    top5.push(row.slice(0, 5));
  }
  return { words: words.slice(), layers, top5 };
}

// Weights as JSON: each tensor is base64 of its little-endian Float32Array
// bytes. Float32 round-trips bit for bit. A float64 model is narrowed to
// float32 on save (the format has one width).
export function toJSON(model) {
  const params = {};
  for (const name of model.names) {
    const f = Float32Array.from(model.params[name]);
    params[name] = bytesToBase64(new Uint8Array(f.buffer));
  }
  const config = { ...model.config };
  delete config.float64;
  return { format: "tinyformer-v1", encoding: "base64-float32-le", config, seed: model.seed, nParams: model.nParams, params };
}

export function fromJSON(obj) {
  if (obj.format !== "tinyformer-v1") throw new Error("unknown weights format: " + obj.format);
  const model = createModel(obj.config, obj.seed);
  for (const name of model.names) {
    const bytes = base64ToBytes(obj.params[name]);
    const f = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
    if (f.length !== model.params[name].length) throw new Error("shape mismatch for " + name);
    model.params[name].set(f);
  }
  return model;
}
