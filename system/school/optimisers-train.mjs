// Training loops for lesson F5 (and F6): the spiral network of backprop.mjs
// and the attention lab's transformer, each driven by the pure step
// functions of optimisers.mjs over one flat parameter vector.
//
// trainNet draws minibatches exactly as backprop.mjs train() does (same rng,
// same order), so with SGD at the same step it reproduces that function bit
// for bit; the tests check this. trainTransformer uses the same batch
// stream, warmup and global-norm clipping as tinyformer-train.mjs
// createTrainer, and swaps only the update rule.

import { rng } from "./tinyformer-ops.mjs";
import { lossAndGrad, lossOnly, accuracy } from "./backprop.mjs";
import { lossAndGrad as tfLossAndGrad } from "./tinyformer-model.mjs";
import { makeBatch } from "./corpus.mjs";
import { OPTIMISERS } from "./optimisers.mjs";

// Concatenate named tensors into one Float64Array, in `names` order.
export function flatten(tensors, names) {
  let n = 0;
  for (const k of names) n += tensors[k].length;
  const out = new Float64Array(n);
  let o = 0;
  for (const k of names) { out.set(tensors[k], o); o += tensors[k].length; }
  return out;
}

export function unflattenInto(tensors, names, theta) {
  let o = 0;
  for (const k of names) { const t = tensors[k]; for (let i = 0; i < t.length; i++) t[i] = theta[o + i]; o += t.length; }
}

// Global L2 norm clipping factor, as in tinyformer-train.mjs adam().
export function clipScale(g, clip) {
  let sq = 0;
  for (let i = 0; i < g.length; i++) sq += g[i] * g[i];
  const norm = Math.sqrt(sq);
  return { norm, k: clip && norm > clip ? clip / norm : 1 };
}

// Train the spiral net with any optimiser. hp.lr is the peak step; the
// optional schedule(t) multiplies it at update t (1-based). Curve points
// every `every` updates: mean loss and accuracy on the training and held-out
// sets (and on `valid`, when given, for choosing settings without touching
// the held-out set). `fullBatch` uses every training point each step.
export function trainNet(net, data, held, { optimiser = "sgd", hp = { lr: 0.3 }, schedule = null, steps = 4000, batch = 32, seed = 5, every = 100, fullBatch = false, valid = null } = {}) {
  const r = rng(seed), n = data.X.length, curve = [], step = OPTIMISERS[optimiser];
  const point = (s) => {
    const p = { step: s, loss: lossOnly(net, data.X, data.Y), heldLoss: lossOnly(net, held.X, held.Y),
      accuracy: accuracy(net, data.X, data.Y), heldAccuracy: accuracy(net, held.X, held.Y) };
    if (valid) { p.validLoss = lossOnly(net, valid.X, valid.Y); p.validAccuracy = accuracy(net, valid.X, valid.Y); }
    curve.push(p);
  };
  point(0);
  let theta = flatten(net.P, net.names), state = null;
  for (let s = 1; s <= steps; s++) {
    let bx = data.X, by = data.Y;
    if (!fullBatch) {
      bx = []; by = [];
      for (let i = 0; i < batch; i++) { const j = Math.floor(r() * n); bx.push(data.X[j]); by.push(data.Y[j]); }
    }
    const { grads } = lossAndGrad(net, bx, by);
    const lr = hp.lr * (schedule ? schedule(s) : 1);
    ({ theta, state } = step(theta, flatten(grads, net.names), state, { ...hp, lr }));
    unflattenInto(net.P, net.names, theta);
    if (s % every === 0) point(s);
  }
  return curve;
}

// Train the transformer with a step function from optimisers.mjs. Same data
// stream (rng(seed), makeBatch per step), linear warmup
// lr_t = lr * min(1, t / warmup) and clipping to global norm `clip` as the
// lab's trainer. Parameters are kept in the model's own float type (float32
// by default): each update is computed in float64 and stored back, which
// rounds exactly as the in-place loop of tinyformer-train.mjs would.
// onStep({ step, loss, gradNorm, lr }) is called after every update.
export function trainTransformer(model, { optimiser = "sgd", hp = { lr: 0.3 }, steps = 400, batch = 16, seed = 1, warmup = 30, clip = 1, onStep } = {}) {
  const ctx = model.config.ctx, data = rng(seed), step = OPTIMISERS[optimiser], names = model.names;
  const decayMask = new Uint8Array(flatten(model.params, names).length);
  { let o = 0; for (const k of names) { if (model.decay[k]) decayMask.fill(1, o, o + model.params[k].length); o += model.params[k].length; } }
  let state = null;
  for (let s = 1; s <= steps; s++) {
    const { x, y } = makeBatch(data, batch, ctx);
    const { loss, grads } = tfLossAndGrad(model, x, y, batch, ctx);
    const g = flatten(grads, names), { norm, k } = clipScale(g, clip);
    if (k !== 1) for (let i = 0; i < g.length; i++) g[i] *= k;
    const lr = hp.lr * Math.min(1, s / Math.max(1, warmup));
    const out = step(flatten(model.params, names), g, state, { ...hp, lr, decayMask });
    state = out.state;
    unflattenInto(model.params, names, out.theta);
    if (onStep) onStep({ step: s, loss, gradNorm: norm, lr });
  }
}
