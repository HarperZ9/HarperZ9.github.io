// Lesson L12, "The training loop". Pure ES module, no DOM and no
// dependencies, so the lab page, a worker and the Node fill script share it.
//
// One step of the attention lab's trainer (tinyformer-train.mjs):
//   1. batch      draw 16 rows of 24 words from the seeded corpus stream
//   2. forward    run the model, get next-word scores at every position
//   3. loss       mean cross-entropy against the words that came
//   4. backward   gradient of the loss for every parameter
//   5. clip       if the gradient's global L2 norm is over CLIP_NORM, scale
//                 the whole gradient down to that norm
//   6. step       AdamW: Adam's moment estimates, bias-corrected, plus
//                 decoupled weight decay on matrices and embeddings
// Learning rate: linear warmup over 30 steps, then constant (no decay).
//
// createLoop is createTrainer with the knobs a lesson needs exposed and two
// deliberate faults for controls: gradSign -1 (walk uphill) and lr 0. With
// default options it reproduces createTrainer bit for bit (the tests check).

import { rng } from "./tinyformer-ops.mjs";
import { makeBatch } from "./corpus.mjs";
import { forward, lossAndGrad } from "./tinyformer-model.mjs";
import { CLIP_NORM, createAdamState, adam, evaluate } from "./tinyformer-train.mjs";

export const DEFAULTS = Object.freeze({ batch: 16, lr: 1e-2, seed: 1, warmup: 30, weightDecay: 0.01, clip: CLIP_NORM, gradSign: 1 });

// The learning rate used at step `step` (0-based), as createTrainer sets it.
export function lrAt(step, lr, warmup) {
  return lr * Math.min(1, (step + 1) / Math.max(1, warmup));
}

const now = () => (globalThis.performance ? performance.now() : Date.now());

export function createLoop(model, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const ctx = o.ctx ?? model.config.ctx, data = rng(o.seed), state = createAdamState(model);
  let step = 0;
  return {
    opts: o, state,
    get stepCount() { return step; },
    step() {
      const t0 = now();
      const { x, y } = makeBatch(data, o.batch, ctx);
      const { loss, grads } = lossAndGrad(model, x, y, o.batch, ctx);
      if (o.gradSign !== 1) for (const n of model.names) { const g = grads[n]; for (let i = 0; i < g.length; i++) g[i] *= o.gradSign; }
      const lr = lrAt(step, o.lr, o.warmup);
      const gradNorm = adam(model, grads, state, { lr, weightDecay: o.weightDecay, clip: o.clip });
      step += 1;
      return { step, loss, gradNorm, clipped: gradNorm > o.clip, lr, ms: now() - t0 };
    },
  };
}

// Train for `steps`, scoring the held-out rows every `every` steps (and at
// step 0). 'train' at a point is the mean loss of the batches since the last
// point, each measured before its update, as model.json records it.
export function runCurve(model, held, { steps, every = 25, ...opts }) {
  const loop = createLoop(model, opts);
  const point = (step, win) => {
    const e = evaluate(model, held);
    return {
      step, train: win.length ? win.reduce((a, b) => a + b, 0) / win.length : null,
      heldOut: e.loss, copyAccuracy: e.copyAccuracy, localAccuracy: e.localAccuracy, copyLoss: e.copyLoss, localLoss: e.localLoss,
    };
  };
  const curve = [point(0, [])], gradNorms = new Float64Array(steps);
  let win = [], clipped = 0, ms = 0;
  for (let s = 1; s <= steps; s++) {
    const r = loop.step();
    win.push(r.loss);
    gradNorms[s - 1] = r.gradNorm;
    clipped += r.clipped ? 1 : 0;
    ms += r.ms;
    if (s % every === 0 || s === steps) { curve.push(point(s, win)); win = []; }
  }
  return { curve, gradNorms, clipped, msPerStep: ms / steps, tokensPerStep: loop.opts.batch * model.config.ctx, opts: loop.opts };
}

// Compare two curves at the steps both have, after rounding to `digits`.
// Returns how many points match exactly and the largest absolute difference.
export function compareCurves(a, b, keys = ["train", "heldOut", "copyAccuracy", "localAccuracy"], digits = 4) {
  const at = new Map(b.map((p) => [p.step, p])), k = 10 ** digits, rd = (v) => Math.round(v * k) / k;
  let points = 0, equal = 0, worst = 0;
  for (const p of a) {
    const q = at.get(p.step);
    if (!q) continue;
    points += 1;
    let ok = true;
    for (const key of keys) {
      if (p[key] === null || q[key] === null) { ok = ok && p[key] === q[key]; continue; }
      const d = Math.abs(rd(p[key]) - q[key]);
      worst = Math.max(worst, d);
      if (d !== 0) ok = false;
    }
    equal += ok ? 1 : 0;
  }
  return { points, equal, worstAbsDiff: worst };
}

// Headline numbers of a curve: the end point, the lowest held-out loss, and
// the first step where copy accuracy reached `copyAt`.
export function summarise(curve, copyAt = 0.9) {
  const end = curve.at(-1);
  let best = curve[0];
  for (const p of curve) if (p.heldOut < best.heldOut) best = p;
  const first = curve.find((p) => p.copyAccuracy >= copyAt);
  return {
    endStep: end.step, heldOut: end.heldOut, copyAccuracy: end.copyAccuracy, localAccuracy: end.localAccuracy,
    bestHeldOut: best.heldOut, bestStep: best.step, firstCopyStep: first ? first.step : null, diverged: !Number.isFinite(end.heldOut),
  };
}

// Gradient-norm statistics: quantiles and how often the clip fired.
export function normStats(norms, clip = CLIP_NORM) {
  const s = Float64Array.from(norms).sort(), q = (f) => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  let over = 0;
  for (const v of norms) over += v > clip ? 1 : 0;
  return { n: norms.length, min: s[0], p10: q(0.1), median: q(0.5), p90: q(0.9), max: s.at(-1), clipped: over, clipShare: over / norms.length };
}

// Where the time of one step goes: batch drawing, a forward pass alone,
// forward plus backward, and the optimiser update, each timed over `n`
// repetitions on a copy of the stream (the model is changed by the updates).
export function stepAnatomy(model, { n = 40, ...opts } = {}) {
  const o = { ...DEFAULTS, ...opts }, ctx = model.config.ctx, data = rng(o.seed), state = createAdamState(model);
  const t = { batch: 0, forward: 0, forwardBackward: 0, update: 0 };
  for (let i = 0; i < n; i++) {
    let t0 = now();
    const { x, y } = makeBatch(data, o.batch, ctx);
    t.batch += now() - t0; t0 = now();
    forward(model, x, o.batch, ctx);
    t.forward += now() - t0; t0 = now();
    const { grads } = lossAndGrad(model, x, y, o.batch, ctx);
    t.forwardBackward += now() - t0; t0 = now();
    adam(model, grads, state, { lr: lrAt(i, o.lr, o.warmup), weightDecay: o.weightDecay, clip: o.clip });
    t.update += now() - t0;
  }
  const ms = Object.fromEntries(Object.entries(t).map(([k, v]) => [k, v / n]));
  return { n, batch: o.batch, ctx, ms, backwardOnly: ms.forwardBackward - ms.forward };
}

// Parameter distance between two models (L2 over every tensor), and the
// largest single change, to show what a step or a run moves.
export function paramDistance(a, b) {
  let sq = 0, worst = 0;
  for (const n of a.names) {
    const p = a.params[n], q = b.params[n];
    for (let i = 0; i < p.length; i++) { const d = p[i] - q[i]; sq += d * d; worst = Math.max(worst, Math.abs(d)); }
  }
  return { l2: Math.sqrt(sq), maxAbs: worst };
}
