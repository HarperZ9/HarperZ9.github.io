// Tests for lesson S17, "Distillation: a big teacher, a small student".
// Run: node --test system/school/distill.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { STUDENTS, studentSize, softmaxT, powerT, kdHead, teacherTargets, oracleTargets, heldReference, distillRun, oddsAfter } from "./distill.mjs";
import { createModel, createTrainer, evaluate, forward, lossAndGrad, fromJSON, rng } from "./tinyformer.mjs";
import { gauss, softmaxXent } from "./tinyformer-ops.mjs";
import { makeBatch, heldOut, unigramCrossEntropy } from "./corpus.mjs";
import { freshSource, poolSource } from "./data.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/distill/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8"));
const TEACHER = fromJSON(M.weights), V = M.config.vocab;
const TINY = { dModel: 8, nHeads: 2, nLayers: 2, dFF: 16, ctx: 6, float64: true };

function scrambled(config, seed) {
  const m = createModel(config, seed), r = rng(seed + 1000);
  for (const name of m.names) { const p = m.params[name], g = /_g$/.test(name); for (let i = 0; i < p.length; i++) p[i] = (g ? 1 : 0) + 0.4 * gauss(r); }
  return m;
}

// Central finite differences of the soft-target loss for every entry of
// every tensor; tensor-level relative error |num - ana| / (|num| + |ana|).
function kdGradCheck(model, head, eps = 1e-5) {
  const B = 2, T = model.config.ctx, { x, y } = makeBatch(rng(5), B, T), N = B * T;
  const { grads } = lossAndGrad(model, x, y, B, T, { lossHead: head });
  const ana = Object.fromEntries(model.names.map((n) => [n, Float64Array.from(grads[n])]));
  const lossAt = () => { const { logits } = forward(model, x, B, T); return head({ logits, probs: new Float64Array(N * V), dlogits: new Float64Array(N * V), y, N, V }); };
  const errors = {};
  for (const name of model.names) {
    const p = model.params[name];
    let diff = 0, sum = 0;
    for (let i = 0; i < p.length; i++) {
      const keep = p[i];
      p[i] = keep + eps; const lp = lossAt();
      p[i] = keep - eps; const lm = lossAt();
      p[i] = keep;
      const num = (lp - lm) / (2 * eps);
      diff += (num - ana[name][i]) ** 2; sum += num * num + ana[name][i] ** 2;
    }
    errors[name] = Math.sqrt(diff) / Math.max(Math.sqrt(sum), 1e-30);
  }
  return errors;
}
const worst = (e) => Math.max(...Object.values(e));
const randomTarget = (N, seed) => { const r = rng(seed), p = new Float64Array(N * V); for (let n = 0; n < N; n++) { let s = 0; for (let v = 0; v < V; v++) { p[n * V + v] = r() ** 3; s += p[n * V + v]; } for (let v = 0; v < V; v++) p[n * V + v] /= s; } return p; };

test("the lossHead hook leaves the default path unchanged: 25 steps reproduce the stored curve", () => {
  const m = createModel({}, M.seed), tr = createTrainer(m, { seed: M.dataSeed, batch: M.batch, lr: M.lr });
  for (let s = 0; s < 25; s++) tr.step();
  const e = evaluate(m, heldOut(M.heldOutRows, M.config.ctx)), stored = M.curve.find((p) => p.step === 25);
  assert.equal(Math.round(e.loss * 1e4) / 1e4, stored.heldOut);
  const a = createModel({}, 3), b = createModel({}, 3), { x, y } = makeBatch(rng(2), 4, 24);
  const ga = lossAndGrad(a, x, y, 4, 24), la = ga.loss, wa = Float64Array.from(ga.grads.wout);
  const head = ({ logits, probs, dlogits, y: yy, N, V: vv }) => softmaxXent(probs, dlogits, logits, yy, N, vv);
  const gb = lossAndGrad(b, x, y, 4, 24, { lossHead: head });
  assert.equal(gb.loss, la);
  assert.deepEqual(Array.from(gb.grads.wout), Array.from(wa), "a head that is plain cross-entropy gives the same gradient bit for bit");
});

test("soft targets at T 1 from one-hot labels equal ordinary cross-entropy", () => {
  const m = createModel({ float64: true }, 4), { x, y } = makeBatch(rng(9), 2, 24), N = 48;
  const onehot = new Float64Array(N * V);
  for (let n = 0; n < N; n++) onehot[n * V + y[n]] = 1;
  const hard = lossAndGrad(m, x, y, 2, 24), lh = hard.loss, gh = Float64Array.from(hard.grads.wte);
  const soft = lossAndGrad(m, x, y, 2, 24, { lossHead: kdHead(onehot, { T: 1 }) });
  assert.ok(Math.abs(soft.loss - lh) < 1e-12);
  for (let i = 0; i < gh.length; i++) assert.ok(Math.abs(soft.grads.wte[i] - gh[i]) < 1e-12);
});

test("gradient check of the soft-target loss passes for every tensor; a backward without the 1/T fails", () => {
  const N = 2 * TINY.ctx, target = randomTarget(N, 3);
  const ok = kdGradCheck(scrambled(TINY, 3), kdHead(target, { T: 2, alpha: 0.7 }));
  assert.ok(worst(ok) < 1e-6, `soft-target gradient error ${worst(ok)}`);
  const pure = kdGradCheck(scrambled(TINY, 4), kdHead(target, { T: 4, alpha: 1 }));
  assert.ok(worst(pure) < 1e-6, `pure soft-target gradient error ${worst(pure)}`);
  const bad = kdGradCheck(scrambled(TINY, 3), kdHead(target, { T: 2, alpha: 0.7, broken: true }));
  assert.ok(worst(bad) > 1e-2, `the broken backward must be caught (${worst(bad)})`);
});

test("temperature: softmaxT and powerT keep the top word and spread the rest; powerT keeps zeros", () => {
  const P = Float64Array.from([0.7, 0.2, 0.1, 0, ...new Array(V - 4).fill(0)]);
  const p2 = powerT(P, 1, V, 2), p8 = powerT(P, 1, V, 8);
  assert.ok(p2[0] < 0.7 && p8[0] < p2[0] && p8[0] > p8[1]);
  assert.equal(p8[3], 0);
  const z = Float64Array.from({ length: V }, (_, i) => -i * 0.5), q1 = softmaxT(new Float64Array(V), z, 1, V, 1), q4 = softmaxT(new Float64Array(V), z, 1, V, 4);
  assert.ok(q4[0] < q1[0] && q4[V - 1] > q1[V - 1]);
  const o = oracleTargets(heldOut(2, 24).x, 24, V, 1);
  for (let n = 0; n < 48; n++) { let s = 0; for (let v = 0; v < V; v++) s += o[n * V + v]; assert.ok(Math.abs(s - 1) < 1e-9); }
});

test("dark knowledge: after 'rerun knocked' the generator says on or twice, half each, and the teacher has learned the split", () => {
  const odds = oddsAfter(TEACHER, ["rerun", "knocked"]);
  assert.deepEqual(odds.slice(0, 2).map((o) => o.word).sort(), ["on", "twice"]);
  for (const o of odds.slice(0, 2)) { assert.ok(Math.abs(o.generator - 0.5) < 1e-9); assert.ok(o.teacher > 0.3 && o.teacher < 0.7); }
  const t = teacherTargets(TEACHER, Int32Array.from([0, 0]), 1, 2, 1);
  assert.ok(Math.abs(t.slice(0, V).reduce((a, b) => a + b, 0) - 1) < 1e-9);
});

test("students are smaller than the teacher", () => {
  assert.ok(studentSize(STUDENTS.d16x1) < studentSize(STUDENTS.d16x2));
  assert.ok(studentSize(STUDENTS.d16x2) < M.nParams / 3);
});

test("soft targets teach a student; an untrained teacher's soft targets are a control that fails", () => {
  const ref = heldReference(TEACHER, heldOut(64, 24)), unigram = unigramCrossEntropy(makeBatch(rng(3), 64, 24), ref.held);
  const run = (teacher) => distillRun({ config: STUDENTS.d16x1, seed: 1, teacher, arm: { kind: "soft", T: 2 }, source: freshSource({ seed: 101 }), ref, steps: 150 }).end;
  const good = run(TEACHER), bad = run(createModel(M.config, M.seed));
  assert.ok(good.heldOut < 1.6, `a trained teacher's soft targets should teach (${good.heldOut})`);
  assert.ok(bad.heldOut > unigram, `an untrained teacher must not teach past word counts (${bad.heldOut} vs ${unigram})`);
});

test("low data: on a fixed pool of 32 rows soft targets beat the hard labels on held-out loss", () => {
  const ref = heldReference(TEACHER, heldOut(64, 24));
  const run = (kind) => distillRun({ config: STUDENTS.d16x1, seed: 1, teacher: TEACHER, arm: { kind, T: 2 }, source: poolSource({ rows: 32, seed: 201 }), ref, steps: 400 }).end;
  const hard = run("hard"), soft = run("soft");
  assert.ok(soft.heldOut < hard.heldOut - 0.5, `soft ${soft.heldOut} vs hard ${hard.heldOut}`);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["teacher", "students", "darkKnowledge", "fullData", "temperature", "lowData", "controls", "speed"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(f.controls.untrainedTeacher.heldOut.mean > f.controls.unigramLoss, "an untrained teacher must not teach");
  assert.ok(f.controls.gradCheck.broken > 1e-2 && f.controls.gradCheck.ok < 1e-6);
});
