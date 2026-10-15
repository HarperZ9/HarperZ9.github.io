// Tests for lesson L12, "The training loop".
// Run: node --test system/school/trainloop.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createLoop, runCurve, compareCurves, summarise, normStats, lrAt, paramDistance, stepAnatomy } from "./trainloop.mjs";
import { createModel, createTrainer, evaluate, toJSON, CLIP_NORM } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/trainloop/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8"));
const HELD = heldOut(64, M.config.ctx);
const fresh = () => createModel({}, M.seed);

test("createLoop with default knobs reproduces createTrainer bit for bit", () => {
  const a = fresh(), b = fresh();
  const ta = createLoop(a, { seed: M.dataSeed }), tb = createTrainer(b, { seed: M.dataSeed });
  for (let s = 0; s < 15; s++) {
    const ra = ta.step(), rb = tb.step();
    assert.equal(ra.loss, rb.loss);
    assert.equal(ra.gradNorm, rb.gradNorm);
    assert.equal(ra.lr, rb.lr);
  }
  assert.deepEqual(toJSON(a).params, toJSON(b).params);
});

test("control: a different data seed does not reproduce the same weights", () => {
  const a = fresh(), b = fresh();
  const ta = createLoop(a, { seed: M.dataSeed }), tb = createLoop(b, { seed: M.dataSeed + 1 });
  for (let s = 0; s < 3; s++) { ta.step(); tb.step(); }
  assert.ok(paramDistance(a, b).l2 > 0);
});

test("warmup ramps the learning rate linearly over 30 steps, then holds", () => {
  assert.equal(lrAt(0, 1e-2, 30), 1e-2 / 30);
  assert.equal(lrAt(29, 1e-2, 30), 1e-2);
  assert.equal(lrAt(500, 1e-2, 30), 1e-2);
});

test("clipping flag: fires exactly when the pre-clip norm exceeds the threshold; never without a clip", () => {
  const m = fresh(), loop = createLoop(m, { seed: 3 });
  for (let s = 0; s < 10; s++) { const r = loop.step(); assert.equal(r.clipped, r.gradNorm > CLIP_NORM); }
  const u = createLoop(fresh(), { seed: 3, clip: Infinity });
  for (let s = 0; s < 10; s++) assert.equal(u.step().clipped, false);
  assert.equal(normStats([0.5, 2, 3, 0.1], 1).clipped, 2);
});

test("learning: 120 normal steps cut held-out loss; lr 0 and the flipped gradient are controls that fail to learn", () => {
  const start = evaluate(fresh(), HELD).loss;
  const ok = summarise(runCurve(fresh(), HELD, { steps: 120, every: 60, seed: 5 }).curve);
  assert.ok(ok.heldOut < start - 1.5, `normal training should learn (${start} -> ${ok.heldOut})`);
  const frozen = fresh(), before = toJSON(frozen).params;
  const z = summarise(runCurve(frozen, HELD, { steps: 60, every: 60, seed: 5, lr: 0 }).curve);
  assert.deepEqual(toJSON(frozen).params, before, "lr 0 leaves every weight unchanged");
  assert.equal(z.heldOut, start);
  const up = summarise(runCurve(fresh(), HELD, { steps: 120, every: 60, seed: 5, gradSign: -1 }).curve);
  assert.ok(!(up.heldOut < start), `walking uphill must not lower the loss (${start} -> ${up.heldOut})`);
});

test("compareCurves counts exact matches after rounding and reports the worst gap", () => {
  const a = [{ step: 0, train: null, heldOut: 1.23456, copyAccuracy: 0.5, localAccuracy: 0.25 }, { step: 25, train: 2, heldOut: 1.1, copyAccuracy: 0.5, localAccuracy: 0.25 }];
  const b = [{ step: 0, train: null, heldOut: 1.2346, copyAccuracy: 0.5, localAccuracy: 0.25 }, { step: 25, train: 2, heldOut: 1.2, copyAccuracy: 0.5, localAccuracy: 0.25 }];
  const r = compareCurves(a, b);
  assert.equal(r.points, 2);
  assert.equal(r.equal, 1);
  assert.ok(Math.abs(r.worstAbsDiff - 0.1) < 1e-12);
});

test("step anatomy times each phase and backward costs more than forward", () => {
  const a = stepAnatomy(fresh(), { n: 6 });
  for (const v of Object.values(a.ms)) assert.ok(v >= 0);
  assert.ok(a.ms.forwardBackward > a.ms.forward);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["recipe", "reproduce", "gradients", "variants", "controls", "speed"]) assert.ok(f[sec].about.length > 40, sec);
  assert.ok(f.controls.runs.every((r) => !(r.end.heldOut < f.controls.startLoss - 0.1)), "controls must fail to learn");
});
