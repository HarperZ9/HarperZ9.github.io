// One training run of the lab's tiny transformer, step by step, with the readings the page draws:
// loss, held-out loss, copy accuracy, timing, and the attention maps and predictions on a probe.
// The same code runs in a worker (lab-worker.mjs) and, where module workers are missing, on the
// page itself, so the numbers on screen are this computation's, wherever it runs.
import { createModel, createTrainer, evaluate, attentionOn, FLOPS, DEFAULT_CONFIG } from "./tinyformer.mjs";
import { heldOut, PROBES, unigramCrossEntropy, makeBatch } from "./corpus.mjs";
import { rng } from "./tinyformer-ops.mjs";

export const LAB = Object.freeze({ steps: 1500, batch: 16, lr: 1e-2, held: 64, evalEvery: 25 });
export const MODES = Object.freeze({ normal: "attention on", self: "each word sees only itself", uniform: "even light, no choosing" });

// Unigram baseline on the held-out rows: the loss of a model that knows only word frequencies.
export function baseline(held) {
  return unigramCrossEntropy(makeBatch(rng(12345), 256, DEFAULT_CONFIG.ctx), held);
}

export function createRun({ seed = 1, mode = "normal", probe = 0 } = {}) {
  const model = createModel({ attnMode: mode }, seed);
  const trainer = createTrainer(model, { batch: LAB.batch, lr: LAB.lr, seed: seed + 1000 });
  const held = heldOut(LAB.held, model.config.ctx);
  const run = {
    seed, mode, probe, model, held, step: 0, curve: [], losses: [], msTotal: 0,
    flops: FLOPS(model.config, LAB.batch, model.config.ctx), nParams: model.nParams, unigram: baseline(held),
    get done() { return run.step >= LAB.steps; },
    // Run steps until `budgetMs` has passed, `maxSteps` are done, or the run ends.
    advance(budgetMs = 30, maxSteps = Infinity) {
      const out = [], t0 = performance.now();
      while (!run.done && out.length < maxSteps && (out.length === 0 || performance.now() - t0 < budgetMs)) {
        const r = trainer.step();
        run.step = r.step; run.msTotal += r.ms;
        out.push({ step: r.step, loss: r.loss, ms: r.ms, gradNorm: r.gradNorm });
        if (r.step % LAB.evalEvery === 0 || r.step === LAB.steps) run.curve.push(run.measure());
      }
      run.losses.push(...out.map((o) => [o.step, o.loss]));
      return out;
    },
    // Held-out loss, accuracy split by look-back and local targets, and per-head source attention.
    measure() {
      const e = evaluate(model, held);
      return { step: run.step, heldOut: e.loss, copy: e.copyAccuracy, local: e.localAccuracy, source: e.sourceAttention };
    },
    // Attention maps and the top predictions on the chosen probe.
    look() {
      const p = PROBES[run.probe], a = attentionOn(model, p.words);
      return { probe: p, layers: a.layers, top5: a.top5[p.query] };
    },
  };
  run.curve.push(run.measure());
  return run;
}

// A plain snapshot of a run for postMessage: numbers only.
export function snapshot(run) {
  const last = run.curve[run.curve.length - 1];
  return { step: run.step, done: run.done, mode: run.mode, seed: run.seed, probe: run.probe, nParams: run.nParams, flops: run.flops,
    unigram: run.unigram, msPerStep: run.step ? run.msTotal / run.step : 0, last, curve: run.curve.map((c) => ({ step: c.step, heldOut: c.heldOut, copy: c.copy, local: c.local })),
    losses: run.losses.filter((_, i) => i % 5 === 0), look: run.look() };
}
