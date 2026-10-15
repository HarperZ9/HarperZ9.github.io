// Train the attention lab's tiny transformer in Node with fixed seeds and
// write everything the explainer film needs to media/school/attention/model.json:
// the loss curves, copy and local accuracy over time, how much weight each
// head puts on the copy source, the probes' attention maps and top-5
// predictions at a few snapshot steps, and the final weights.
//
// Two control runs with the same seeds and steps are trained alongside:
// attention set to "self" (no word can read another) and "uniform" (a bag of
// the words so far, with no notion of where). Their curves are stored so the
// film can show the gap rather than assert it.
//
// Usage: node tools/school/train_film_weights.mjs [steps]
// On one JavaScript engine the output depends only on the code and the
// seeds (the determinism test checks this), not on machine speed.
//
// Weights format: see toJSON in system/school/tinyformer-train.mjs (each
// tensor is base64 of its little-endian Float32Array bytes).

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createModel, createTrainer, evaluate, attentionOn, toJSON, FLOPS } from "../../system/school/tinyformer.mjs";
import { PROBES, heldOut, makeBatch, unigramCrossEntropy, HELD_OUT_SEED } from "../../system/school/corpus.mjs";
import { rng } from "../../system/school/tinyformer-ops.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = resolve(ROOT, "media/school/attention/model.json");

const MODEL_SEED = 7, DATA_SEED = 11, BATCH = 16, LR = 1e-2;
const STEPS = Number(process.argv[2] ?? 2000);
const EVERY = 25; // record curves every EVERY steps
const SNAPSHOTS = [0, 25, 100, 400, 600, 800, 1200, STEPS].filter((s, i, a) => s <= STEPS && a.indexOf(s) === i);
const HELD_ROWS = 256;

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;

// Attention rows are causal, so only the lower triangle is stored:
// row i has i + 1 entries (positions 0..i).
function compactProbe(p, probe) {
  return {
    layers: p.layers.map((heads) => heads.map((rows) => rows.map((row, i) => row.slice(0, i + 1).map(r3)))),
    top5: p.top5.map((list) => list.map(({ word, p: q }) => [word, r3(q)])),
    atQuery: p.top5[probe.query].map(({ word, p: q }) => [word, r3(q)]),
  };
}

function snapshot(model, step) {
  return { step, probes: PROBES.map((probe) => compactProbe(attentionOn(model, probe.words), probe)) };
}

function curvePoint(model, held, step, lossWindow) {
  const e = evaluate(model, held);
  const train = lossWindow.length ? lossWindow.reduce((a, b) => a + b, 0) / lossWindow.length : null;
  return {
    step, train: train === null ? null : r4(train), heldOut: r4(e.loss),
    copyAccuracy: r4(e.copyAccuracy), localAccuracy: r4(e.localAccuracy),
    copyLoss: r4(e.copyLoss), localLoss: r4(e.localLoss),
    sourceAttention: e.sourceAttention.map((hs) => hs.map(r3)),
  };
}

// One full run. Returns curves, snapshots (only when asked) and the model.
function run(attnMode, { withSnapshots }) {
  const model = createModel({ attnMode }, MODEL_SEED);
  const trainer = createTrainer(model, { seed: DATA_SEED, batch: BATCH, lr: LR });
  const held = heldOut(HELD_ROWS, model.config.ctx);
  const curve = [curvePoint(model, held, 0, [])];
  const snaps = withSnapshots && SNAPSHOTS.includes(0) ? [snapshot(model, 0)] : [];
  const gradNorms = [];
  let window = [], ms = 0;
  for (let s = 1; s <= STEPS; s++) {
    const o = trainer.step();
    window.push(o.loss);
    ms += o.ms;
    if (s % EVERY === 0 || s === STEPS) {
      curve.push(curvePoint(model, held, s, window));
      gradNorms.push([s, r4(o.gradNorm)]);
      window = [];
    }
    if (withSnapshots && SNAPSHOTS.includes(s)) snaps.push(snapshot(model, s));
  }
  return { model, curve, snaps, gradNorms, msPerStep: ms / STEPS };
}

function copyChance(held) {
  const counts = new Map();
  let n = 0;
  for (let i = 0; i < held.y.length; i++) {
    if (!held.kind[i]) continue;
    counts.set(held.y[i], (counts.get(held.y[i]) ?? 0) + 1);
    n++;
  }
  return Math.max(...counts.values()) / n;
}

function main() {
  const t0 = Date.now();
  const full = run("normal", { withSnapshots: true });
  const self = run("self", { withSnapshots: false });
  const uniform = run("uniform", { withSnapshots: false });
  const held = heldOut(HELD_ROWS, full.model.config.ctx);
  const unigram = unigramCrossEntropy(makeBatch(rng(99), 2000, full.model.config.ctx), held);
  const config = { ...full.model.config };
  delete config.float64;
  const out = {
    format: "attention-lab-film-v1",
    about: "Tiny decoder-only transformer trained in Node on the guides' corpus. Every number here is computed by system/school/tinyformer.mjs.",
    config, seed: MODEL_SEED, dataSeed: DATA_SEED, heldOutSeed: HELD_OUT_SEED, heldOutRows: HELD_ROWS,
    steps: STEPS, batch: BATCH, lr: LR, curveEvery: EVERY, nParams: full.model.nParams,
    flops: FLOPS(config, BATCH, config.ctx),
    baselines: { unigramLoss: r4(unigram), copyChance: r4(copyChance(held)) },
    curve: full.curve, gradNorms: full.gradNorms,
    controls: [
      { attnMode: "self", note: "each word attends only to itself", curve: self.curve.map(({ step, heldOut: h, copyAccuracy, localAccuracy }) => ({ step, heldOut: h, copyAccuracy, localAccuracy })) },
      { attnMode: "uniform", note: "each word averages all words so far, ignoring position", curve: uniform.curve.map(({ step, heldOut: h, copyAccuracy, localAccuracy }) => ({ step, heldOut: h, copyAccuracy, localAccuracy })) },
    ],
    probes: PROBES,
    snapshots: full.snaps,
    weights: toJSON(full.model),
  };
  mkdirSync(dirname(OUT), { recursive: true });
  const text = JSON.stringify(out);
  writeFileSync(OUT, text);
  summarise(out, text.length, full.msPerStep, (Date.now() - t0) / 1000);
}

function summarise(out, bytes, msPerStep, seconds) {
  const last = out.curve.at(-1);
  const ctl = out.controls.map((c) => `${c.attnMode}: copy ${c.curve.at(-1).copyAccuracy}, held-out ${c.curve.at(-1).heldOut}`);
  const firstGood = out.curve.find((p) => p.copyAccuracy >= 0.9);
  console.log(`wrote ${OUT} (${(bytes / 1024).toFixed(0)} KB) in ${seconds.toFixed(0)} s`);
  console.log(`params ${out.nParams}, ${(out.flops.step / 1e6).toFixed(1)} MFLOP per step, ${msPerStep.toFixed(1)} ms per step`);
  console.log(`unigram baseline ${out.baselines.unigramLoss}, copy chance ${out.baselines.copyChance}`);
  console.log(`attention: held-out ${last.heldOut}, copy ${last.copyAccuracy}, local ${last.localAccuracy} after ${last.step} steps`);
  console.log(`copy accuracy first >= 0.9 at step ${firstGood ? firstGood.step : "never"}`);
  console.log(`controls: ${ctl.join("; ")}`);
  console.log(`source attention per layer/head at the end: ${JSON.stringify(last.sourceAttention)}`);
  for (const [i, probe] of out.probes.entries()) {
    const top = out.snapshots.at(-1).probes[i].atQuery[0];
    console.log(`probe ${i}: want "${probe.answer}", top "${top[0]}" p=${top[1]}`);
  }
}

main();
