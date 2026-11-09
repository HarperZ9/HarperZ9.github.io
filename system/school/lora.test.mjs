// Tests for lesson S19, "LoRA and fine-tuning".
// Run: node --test system/school/lora.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createLora, applyLora, loraLossAndGrad, loraLoss, createFinetuner, mergeLora, adapterPathGap, targetSet, shapeOf, cloneModel } from "./lora.mjs";
import { taskBatch, taskHeld, taskSource, taskFloor, FILLERS, ROLE } from "./lora-task.mjs";
import { scoreTask, singularValues, energyShares, symmetricEigenvalues, truncate } from "./lora-measure.mjs";
import { createModel, forward, fromJSON, toJSON, rng } from "./tinyformer.mjs";
import { gauss } from "./tinyformer-ops.mjs";
import { grammarCheck } from "./corpus-grammar.mjs";
import { decode } from "./corpus.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/lora/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8"));
const BASE = fromJSON(M.weights);
const TINY = { dModel: 8, nHeads: 2, nLayers: 2, dFF: 16, ctx: 6, float64: true };

function scrambled(config, seed) {
  const m = createModel(config, seed), r = rng(seed + 1000);
  for (const name of m.names) { const p = m.params[name], g = /_g$/.test(name); for (let i = 0; i < p.length; i++) p[i] = (g ? 1 : 0) + 0.4 * gauss(r); }
  return m;
}

// Finite differences of the loss in every entry of every A and B, against
// the analytic adapter gradient; worst tensor-level relative error.
function adapterGradCheck(opts, eps = 1e-6) {
  const ad = createLora(scrambled(TINY, 3), { targets: "all", rank: 2, alpha: 4, seed: 5 }), r = rng(8);
  for (const m of ad.mats) for (let i = 0; i < m.B.length; i++) m.B[i] = 0.3 * gauss(r);
  const { x, y } = taskBatch(rng(4), 2, TINY.ctx);
  const { grads } = loraLossAndGrad(ad, x, y, 2, TINY.ctx, opts);
  let worst = 0;
  for (const name of ad.view.names) {
    const p = ad.view.params[name], ana = Float64Array.from(grads[name]);
    let diff = 0, sum = 0;
    for (let i = 0; i < p.length; i++) {
      const keep = p[i];
      p[i] = keep + eps; const lp = loraLoss(ad, x, y, 2, TINY.ctx);
      p[i] = keep - eps; const lm = loraLoss(ad, x, y, 2, TINY.ctx);
      p[i] = keep;
      const num = (lp - lm) / (2 * eps);
      diff += (num - ana[i]) ** 2; sum += num * num + ana[i] ** 2;
    }
    worst = Math.max(worst, Math.sqrt(diff) / Math.max(Math.sqrt(sum), 1e-30));
  }
  return worst;
}

test("task rows: exact odds sum to 1, the word that came always has odds above 0, and the answer repeats the look", () => {
  const set = taskHeld(32), V = 46;
  for (let n = 0; n < set.y.length; n++) {
    let s = 0;
    for (let v = 0; v < V; v++) s += set.P[n * V + v];
    assert.ok(Math.abs(s - 1) < 1e-12, `row sums to ${s}`);
    assert.ok(set.P[n * V + set.y[n]] > 0);
    if (set.role[n] === ROLE.answer) { const b = Math.floor(n / 24); assert.equal(set.y[n], set.x[b * 24 + set.src[n]], "the answer copies the first look"); }
  }
  assert.ok(taskFloor(set) > 0.3 && taskFloor(set) < 0.8);
  assert.equal(FILLERS.length, 5);
});

test("the exact odds match the generator's frequencies (control: a wrong table does not)", () => {
  const set = taskBatch(rng(12), 400, 24, { withOdds: true }), V = 46;
  // After "the <t> was <a> ." the repeat comes at once a third of the time.
  let starts = 0, repeats = 0, predicted = 0;
  for (let n = 0; n < set.y.length; n++) if (set.role[n] === ROLE.repeatStart || set.role[n] === ROLE.filler) {
    const p = set.P[n * V + 2]; // id of "the"
    if (p > 0 && p < 1 && set.x[n] === 0) { starts++; repeats += set.y[n] === 2 ? 1 : 0; predicted += p; }
  }
  assert.ok(starts > 300);
  assert.ok(Math.abs(repeats / starts - predicted / starts) < 0.05, `${repeats / starts} vs ${predicted / starts}`);
  assert.ok(Math.abs(repeats / starts - 0.9) > 0.3, "control: a table that said 0.9 would be caught");
});

test("the base model never saw the rule: the corpus grammar cannot write a task episode", () => {
  const set = taskBatch(rng(1), 1, 24), words = decode(set.x.subarray(0, 24));
  const g = grammarCheck(words);
  assert.equal(g.ok, false, `the corpus generator should not write: ${words.join(" ")}`);
});

test("at step 0 the adapted model equals the base bit for bit (B is zero); a nonzero B is the control", () => {
  const set = taskHeld(4), base = forward(cloneModel(BASE), set.x, 4, 24).logits.slice();
  for (const targets of ["attn", "all"]) for (const rank of [1, 8]) {
    const ad = createLora(BASE, { targets, rank, seed: 3 }), out = forward(ad.model, set.x, 4, 24).logits;
    assert.deepEqual(Array.from(out), Array.from(base), `${targets} r${rank}`);
  }
  const ad = createLora(BASE, { targets: "attn", rank: 1, seed: 3 });
  ad.mats[0].B[0] = 0.01;
  applyLora(ad);
  assert.notDeepEqual(Array.from(forward(ad.model, set.x, 4, 24).logits), Array.from(base));
});

test("finite differences agree with dA and dB for every adapter tensor; a wrong transpose in dA is caught", () => {
  const ok = adapterGradCheck({});
  assert.ok(ok < 1e-6, `adapter gradient error ${ok}`);
  const bad = adapterGradCheck({ brokenTranspose: true });
  assert.ok(bad > 1e-2, `the wrong transpose must be caught (${bad})`);
});

test("after training, the merged weights give the adapter path's outputs and logits", () => {
  const ft = createFinetuner(BASE, { kind: "lora", targets: "all", rank: 4, seed: 2 }, taskSource({ seed: 9 }), { lr: 1e-2 });
  for (let s = 0; s < 40; s++) ft.step();
  const set = taskHeld(4), gap = adapterPathGap(ft.adapter, BASE, set.x, 4, 24);
  assert.ok(gap < 1e-4, `x W + s (x A) B against x (W + s A B): ${gap}`);
  assert.ok(ft.adapter.mats.some((m) => m.B.some((v) => v !== 0)), "training moved B");
  const merged = fromJSON(toJSON(mergeLora(ft.adapter))), a = forward(ft.model, set.x, 4, 24).logits.slice(), b = forward(merged, set.x, 4, 24).logits;
  let worst = 0;
  for (let i = 0; i < a.length; i++) worst = Math.max(worst, Math.abs(a[i] - b[i]));
  assert.ok(worst < 1e-4, `merged and shipped as float32: ${worst}`);
});

test("trained numbers: LoRA counts r (K + M) per matrix, the readout only wout, full every number", () => {
  const c = BASE.config, ad = createLora(BASE, { targets: "attn", rank: 2 });
  const want = targetSet(c, "attn").reduce((a, n) => { const [K, Mm] = shapeOf(c, n); return a + 2 * (K + Mm); }, 0);
  assert.equal(ad.trained, want);
  assert.equal(createFinetuner(BASE, { kind: "readout" }, taskSource()).trained, c.dModel * c.vocab);
  assert.equal(createFinetuner(BASE, { kind: "full" }, taskSource()).trained, M.nParams);
});

test("a rank-1 adapter learns some of the task in 150 steps; a rank-0 adapter cannot learn at all", () => {
  const held = taskHeld(32), start = scoreTask(BASE, held).all.loss;
  const run = (rank) => { const ft = createFinetuner(BASE, { kind: "lora", targets: "attn", rank, seed: 1 }, taskSource({ seed: 7 }), { lr: 1e-2 }); for (let s = 0; s < 150; s++) ft.step(); return scoreTask(ft.model, held).all.loss; };
  const r1 = run(1), r0 = run(0);
  assert.ok(r1 < start - 0.4, `rank 1 should learn (${start} -> ${r1})`);
  assert.equal(r0, start, "rank 0 has nothing to train, so the loss must not move");
});

test("singular values: a rank-2 matrix has all its energy in 2 directions; eigenvalues of a diagonal matrix", () => {
  const K = 6, Mm = 9, r = rng(4), u = Array.from({ length: 2 * K }, () => gauss(r)), v = Array.from({ length: 2 * Mm }, () => gauss(r));
  const D = new Float64Array(K * Mm);
  for (let k = 0; k < K; k++) for (let m = 0; m < Mm; m++) D[k * Mm + m] = u[k] * v[m] + u[K + k] * v[Mm + m];
  const e = energyShares(singularValues(D, K, Mm));
  assert.ok(e.top[2] > 1 - 1e-9 && e.top[1] < 0.999);
  const rand = new Float64Array(K * Mm).map(() => gauss(r));
  assert.ok(energyShares(singularValues(rand, K, Mm)).top[2] < 0.95, "control: a random matrix is not rank 2");
  assert.deepEqual(symmetricEigenvalues(Float64Array.from([2, 0, 0, 5]), 2), [5, 2]);
  for (const [k, m] of [[K, Mm], [Mm, K]]) {
    const R = new Float64Array(k * m).map(() => gauss(r)), t1 = truncate(R, k, m, 1), all = truncate(R, k, m, Math.min(k, m));
    assert.ok(energyShares(singularValues(t1, k, m)).top[1] > 1 - 1e-9, "a rank-1 truncation has rank 1");
    assert.ok(Math.abs(singularValues(t1, k, m)[0] - singularValues(R, k, m)[0]) < 1e-9, "and keeps the top singular value");
    assert.ok(all.every((v, i) => Math.abs(v - R[i]) < 1e-9), "full-rank truncation gives the matrix back");
  }
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["task", "base", "methods", "forgetting", "rank", "controls", "speed", "film"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(f.controls.gradCheck.broken > 1e-2 && f.controls.gradCheck.ok < 1e-6);
  assert.ok(f.controls.stepZero.bitEqual);
});
