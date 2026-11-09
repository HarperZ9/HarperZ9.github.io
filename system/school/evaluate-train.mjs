// Lesson L16: training runs for the evaluation lesson. Pure ES module.
//
// The trainer is tinyformer's createTrainer step for step (same data stream,
// warmup, AdamW and clip; the test checks the weights match bit for bit), with
// one addition: a contaminating schedule that writes rows of a test set into
// the training batches (Sainz and others 2023, "NLP Evaluation in trouble":
// a model trained on a benchmark's test split and then scored on it). The
// clean rows are drawn first, so the data stream underneath is the clean
// run's stream; the leaked rows replace the last rows of a batch.

import { rng } from "./tinyformer-ops.mjs";
import { makeBatch } from "./corpus.mjs";
import { createModel, lossAndGrad } from "./tinyformer-model.mjs";
import { createAdamState, adam, CLIP_NORM } from "./tinyformer-train.mjs";

// Training seeds: seed 1 is model.json's own recipe (model seed and data
// seed as stored); seed s shifts both by s - 1.
export const recipeSeeds = (M, s) => ({ model: M.seed + s - 1, data: M.dataSeed + s - 1 });

// Which test rows go into which step: `repeats` shuffled passes over the
// set's rows, spread evenly over `steps` steps. Returns step -> [row, ...].
export function leakSchedule(rows, repeats, steps, shuffleSeed = 4242) {
  const r = rng(shuffleSeed), slots = [];
  for (let p = 0; p < repeats; p++) {
    const ord = Array.from({ length: rows }, (_, i) => i);
    for (let i = rows - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ord[i], ord[j]] = [ord[j], ord[i]]; }
    slots.push(...ord);
  }
  const plan = new Map();
  slots.forEach((row, j) => { const s = Math.floor((j * steps) / slots.length); if (!plan.has(s)) plan.set(s, []); plan.get(s).push(row); });
  return plan;
}

export function createEvalTrainer(model, { seed = 1, batch = 16, lr = 1e-2, warmup = 30, weightDecay = 0.01, clip = CLIP_NORM, leak = null } = {}) {
  const ctx = model.config.ctx, data = rng(seed), state = createAdamState(model);
  const plan = leak ? leakSchedule(leak.set.rows, leak.repeats, leak.steps, leak.shuffleSeed) : null;
  let step = 0, leaked = 0;
  return {
    get stepCount() { return step; }, get leaked() { return leaked; },
    step() {
      const { x, y } = makeBatch(data, batch, ctx), rows = plan?.get(step) ?? [];
      if (rows.length > batch) throw new Error("more leaked rows than a batch holds");
      rows.forEach((row, k) => {
        const at = (batch - 1 - k) * ctx;
        x.set(leak.set.x.subarray(row * ctx, (row + 1) * ctx), at);
        y.set(leak.set.y.subarray(row * ctx, (row + 1) * ctx), at);
      });
      leaked += rows.length;
      const { loss, grads } = lossAndGrad(model, x, y, batch, ctx);
      adam(model, grads, state, { lr: lr * Math.min(1, (step + 1) / Math.max(1, warmup)), weightDecay, clip });
      step += 1;
      return { step, loss, leaked: rows.length };
    },
  };
}

// Train a fresh model with M's recipe and seed s, calling at(step, model) at
// each step listed in `marks` (and at step 0 when listed).
export function trainRecipe(M, s, { steps = M.steps, marks = [], leak = null, onMark } = {}) {
  const sd = recipeSeeds(M, s), model = createModel(M.config, sd.model);
  const tr = createEvalTrainer(model, { seed: sd.data, batch: M.batch, lr: M.lr, leak: leak && { ...leak, steps } });
  const want = new Set(marks);
  if (want.has(0) && onMark) onMark(0, model);
  let ms = 0;
  for (let k = 1; k <= steps; k++) {
    const t0 = performance.now();
    tr.step();
    ms += performance.now() - t0;
    if (want.has(k) && onMark) onMark(k, model);
  }
  return { model, leaked: tr.leaked, msPerStep: ms / steps };
}

// How many rows of an eval set occur, word for word (24 inputs and the last
// target), among the rows of a clean training run: chance overlap.
export function naturalOverlap(set, dataSeed, steps, batch = 16) {
  const T = set.ctx, key = (x, y, b) => Array.from(x.subarray(b * T, (b + 1) * T)).join(",") + "|" + y[(b + 1) * T - 1];
  const want = new Set();
  for (let b = 0; b < set.rows; b++) want.add(key(set.x, set.y, b));
  const r = rng(dataSeed), hit = new Set();
  for (let s = 0; s < steps; s++) {
    const bt = makeBatch(r, batch, T);
    for (let b = 0; b < batch; b++) { const k = key(bt.x, bt.y, b); if (want.has(k)) hit.add(k); }
  }
  return { rows: set.rows, seenInTraining: hit.size, trainingRows: steps * batch };
}
