// Tests for lesson F5 (optimisers). Run: node --test system/school/optimisers.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { sgd, heavyBall, adam, adamw, adamL2, ADAM_DEFAULTS, warmupCosine, warmupLinear, warmupConstant, run2d, race, momentumStudy,
  flatten, unflattenInto, trainNet, trainTransformer } from "./optimisers.mjs";
import { makeBowl, ROSENBROCK } from "./gradients.mjs";
import { twoSpirals, createNet, train as backpropTrain } from "./backprop.mjs";
import { createModel, lossAndGrad, adam as labAdam, createAdamState, lossOnly } from "./tinyformer.mjs";
import { makeBatch, heldOut } from "./corpus.mjs";
import { rng } from "./tinyformer-ops.mjs";

const TINY = { dModel: 8, nHeads: 2, nLayers: 1, dFF: 16, ctx: 6, float64: true };
const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/optimisers/facts.json", import.meta.url);

test("Adam: with bias correction the first step is alpha per coordinate; without it, 3.16 alpha (the control differs)", () => {
  const theta = Float64Array.from([1, 0.1, -2]), g = [0.5, -0.002, 30];
  const a = adam(theta, g, null, {}), b = adam(theta, g, null, { biasCorrection: false });
  const ratio = (1 - ADAM_DEFAULTS.beta1) / Math.sqrt(1 - ADAM_DEFAULTS.beta2);
  for (let i = 0; i < 3; i++) {
    const da = Math.abs(a.theta[i] - theta[i]), db = Math.abs(b.theta[i] - theta[i]);
    assert.ok(Math.abs(da - ADAM_DEFAULTS.lr) < 1e-8, `corrected first step ${da}`);
    assert.ok(Math.abs(db / da - ratio) < 1e-3 * ratio, `uncorrected / corrected ${db / da}, predicted ${ratio}`);
  }
  assert.ok(ratio > 3, "the control must differ by a large factor");
  // With a constant gradient both forget their start: by t = 20000 they agree to 1e-3.
  let sa = null, sb = null, ta = theta, tb = theta, la = 0, lb = 0;
  for (let t = 0; t < 20000; t++) { const ra = adam(ta, g, sa, {}), rb = adam(tb, g, sb, { biasCorrection: false }); la = Math.abs(ra.theta[0] - ta[0]); lb = Math.abs(rb.theta[0] - tb[0]); ta = ra.theta; sa = ra.state; tb = rb.theta; sb = rb.state; }
  assert.ok(Math.abs(lb / la - 1) < 1e-3, `late steps agree, ratio ${lb / la}`);
  assert.equal(theta[0], 1, "inputs are not mutated");
});

test("AdamW matches the lab trainer's own adam (decay mask, clipping, warmup lr) on a float64 model; Adam with L2 does not", () => {
  const m1 = createModel(TINY, 3), m2 = createModel(TINY, 3), names = m1.names, st = createAdamState(m1), r = rng(9);
  const mask = new Uint8Array(flatten(m1.params, names).length);
  { let o = 0; for (const k of names) { if (m1.decay[k]) mask.fill(1, o, o + m1.params[k].length); o += m1.params[k].length; } }
  let state = null, worst = 0;
  for (let s = 1; s <= 6; s++) {
    const { x, y } = makeBatch(r, 4, TINY.ctx), lr = 1e-2 * Math.min(1, s / 3), clip = 0.05;
    const g1 = lossAndGrad(m1, x, y, 4, TINY.ctx).grads;
    const gflat = flatten(g1, names);
    labAdam(m1, g1, st, { lr, weightDecay: 0.01, clip });
    let sq = 0; for (const v of gflat) sq += v * v;
    const k = Math.sqrt(sq) > clip ? clip / Math.sqrt(sq) : 1;
    const out = adamw(flatten(m2.params, names), gflat.map((v) => v * k), state, { lr: 1e-2, eta: lr / 1e-2, weightDecay: 1e-2 * 0.01, beta2: 0.99, decayMask: mask });
    state = out.state; unflattenInto(m2.params, names, out.theta);
    const a = flatten(m1.params, names);
    for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - out.theta[i]));
  }
  assert.ok(worst < 1e-12, `largest difference ${worst}`);
  const theta = Float64Array.from([1, 0.1]);
  let w = { theta, state: null }, l = { theta, state: null };
  for (let s = 0; s < 3; s++) { w = adamw(w.theta, [0, 0], w.state, { weightDecay: 0.1 }); l = adamL2(l.theta, [0, 0], l.state, { weightDecay: 0.1 }); }
  assert.ok(Math.abs(w.theta[0] - 0.9 ** 3) < 1e-15 && Math.abs(w.theta[1] - 0.1 * 0.9 ** 3) < 1e-15, `AdamW decays by 1 - lambda: ${w.theta}`);
  assert.ok(Math.abs(l.theta[0] - (1 - 3e-3)) < 1e-6 && Math.abs(l.theta[1] - (0.1 - 3e-3)) < 1e-5, `L2 under Adam moves alpha per step: ${l.theta}`);
});

test("heavy ball: step one is plain descent, the two-step form equals the velocity form", () => {
  const bowl = makeBowl(), hp = { lr: 0.1, beta: 0.9 };
  let x = Float64Array.from([-2, 2]), st = null;
  const a = heavyBall(x, bowl.grad(...x), null, hp), b = sgd(x, bowl.grad(...x), null, hp);
  assert.deepEqual(Array.from(a.theta), Array.from(b.theta));
  let v = [0, 0], y = [-2, 2], worst = 0;
  for (let k = 0; k < 50; k++) {
    ({ theta: x, state: st } = heavyBall(x, bowl.grad(x[0], x[1]), st, hp));
    const g = bowl.grad(y[0], y[1]); v = v.map((vi, i) => hp.beta * vi - hp.lr * g[i]); y = y.map((yi, i) => yi + v[i]);
    worst = Math.max(worst, Math.abs(x[0] - y[0]), Math.abs(x[1] - y[1]));
  }
  assert.ok(worst < 1e-12, `forms differ by ${worst}`);
});

test("above plain descent's edge: SGD diverges (control), momentum and Adam converge; both edges measured", () => {
  const s = momentumStudy();
  assert.ok(Math.abs(s.plainBound.measured - 0.5) < 1e-6 && Math.abs(s.momentumBound.measured - 0.95) < 1e-6, JSON.stringify([s.plainBound, s.momentumBound]));
  assert.equal(s.runs.sgd.outcome, "diverges");
  assert.equal(s.runs.momentum.outcome, "converges");
  assert.equal(s.runs.adam.outcome, "converges");
});

test("races: momentum settles first on Rosenbrock, plain descent first on the bowl; a dip that climbs back out does not count", () => {
  const ros = race("rosenbrock"), bowl = race("bowl");
  assert.ok(ros.momentum.run.stepsToThreshold < ros.sgd.run.stepsToThreshold / 5, `${ros.momentum.run.stepsToThreshold} vs ${ros.sgd.run.stepsToThreshold}`);
  assert.ok(bowl.sgd.run.stepsToThreshold < bowl.momentum.run.stepsToThreshold, "on a mildly tilted bowl beta 0.9 overshoots and plain descent wins");
  const edge = run2d(ROSENBROCK, [-1.2, 1], "sgd", { lr: 2e-3 }, { steps: 20000, threshold: 1e-4, keepPath: false });
  assert.ok(edge.firstBelow !== null && edge.stepsToThreshold === null, `step 2e-3 dips under at ${edge.firstBelow} but must not count as settled`);
});

test("schedules: warmup reaches the peak, cosine and linear end at the floor, the lab's warmup is the flat case", () => {
  const o = { warmup: 200, total: 4000 };
  assert.equal(warmupCosine(100, o), 0.5);
  assert.equal(warmupCosine(200, o), 1);
  assert.ok(Math.abs(warmupCosine(4000, o)) < 1e-15 && Math.abs(warmupLinear(4000, o)) < 1e-15);
  assert.ok(Math.abs(warmupCosine(2100, o) - 0.5) < 1e-12 && Math.abs(warmupLinear(2100, o) - 0.5) < 1e-12, "both are half way at the midpoint");
  for (let t = 201; t <= 4000; t += 37) assert.ok(warmupCosine(t, o) <= warmupCosine(t - 1, o));
  for (let step = 0; step < 50; step++) assert.equal(warmupConstant(step + 1, { warmup: 30 }), Math.min(1, (step + 1) / 30));
});

test("trainNet with SGD reproduces backprop.mjs train() bit for bit; momentum (control) does not", () => {
  const data = twoSpirals(80, 1), held = twoSpirals(80, 2);
  const a = backpropTrain(createNet(3), data, held, { steps: 300, lr: 0.3, batch: 16, seed: 5, every: 100 });
  const b = trainNet(createNet(3), data, held, { optimiser: "sgd", hp: { lr: 0.3 }, steps: 300, batch: 16, seed: 5, every: 100 });
  assert.deepEqual(b, a);
  const c = trainNet(createNet(3), data, held, { optimiser: "momentum", hp: { lr: 0.3, beta: 0.9 }, steps: 300, batch: 16, seed: 5, every: 100 });
  assert.notDeepEqual(c, a);
});

test("trainTransformer: lr 0 leaves weights alone; SGD lowers held-out loss on a tiny model", () => {
  const m0 = createModel(TINY, 4), before = flatten(m0.params, m0.names);
  trainTransformer(m0, { optimiser: "sgd", hp: { lr: 0 }, steps: 3, batch: 4, seed: 2 });
  assert.deepEqual(flatten(m0.params, m0.names), before);
  const m = createModel(TINY, 4), h = heldOut(16, TINY.ctx), l0 = lossOnly(m, h.x, h.y, 16, TINY.ctx);
  trainTransformer(m, { optimiser: "sgd", hp: { lr: 0.5 }, steps: 60, batch: 8, seed: 2 });
  const l1 = lossOnly(m, h.x, h.y, 16, TINY.ctx);
  assert.ok(l1 < l0 - 0.3, `held-out loss ${l0} -> ${l1}`);
});

test("facts.json is current for model.json, the AdamW arm reproduces the published run, and the text has no em dash", () => {
  const bytes = readFileSync(MODEL_URL), raw = readFileSync(FACTS_URL, "utf8"), facts = JSON.parse(raw);
  assert.equal(facts.modelJsonSha256, createHash("sha256").update(bytes).digest("hex"), "re-run tools/school/fill_optimisers.mjs");
  assert.equal(facts.transformer.reproducesModelJson, true);
  assert.ok(!raw.includes("—"), "no em dashes");
  for (const k of ["rules", "schedules", "races", "aboveEdge", "valleys", "spiral", "transformer"]) assert.equal(typeof facts[k].about, "string", `${k} has an about`);
});
