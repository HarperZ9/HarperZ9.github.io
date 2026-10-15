// Tests for lesson F6 (overfitting and the held-out set).
// Run: node --test system/school/heldout.test.mjs
// Every claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { samples, design, lstsqQR, lstsqCholesky, residualCheck, fitAndScore, polyStudy, spiralRun, attentionGap, trainingBatches, TRUTH } from "./heldout.mjs";
import { createModel, createTrainer, lossOnly } from "./tinyformer.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/heldout/facts.json", import.meta.url);
const TINY = { dModel: 8, nHeads: 2, nLayers: 1, dFF: 16, ctx: 6, float64: true };

test("QR least squares recovers a noise-free cubic and passes the residual check; a transposed system fails it", () => {
  const x = Array.from({ length: 12 }, (_, i) => -1 + (2 * i) / 11), want = [0.3, -1, 0.5, 2];
  const y = x.map((v) => want[0] + want[1] * v + want[2] * v * v + want[3] * v ** 3);
  const A = design(x, 3), { c } = lstsqQR(A, y, 12, 4);
  want.forEach((w, j) => assert.ok(Math.abs(c[j] - w) < 1e-12, `c${j} ${c[j]}`));
  assert.ok(residualCheck(A, y, 12, 4, c) < 1e-15);
  // Square noisy system (degree 15, 16 points): the right solve passes, the transposed one fails.
  const s = samples(16, 21), S = design(s.x, 15), T = new Float64Array(256);
  for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) T[i * 16 + j] = S[j * 16 + i];
  const good = lstsqQR(S, s.y, 16, 16).c, bad = lstsqQR(T, s.y, 16, 16).c;
  assert.ok(residualCheck(S, s.y, 16, 16, good) < 1e-14, `QR residual ${residualCheck(S, s.y, 16, 16, good)}`);
  assert.ok(residualCheck(S, s.y, 16, 16, bad) > 1e-3, `transposed control must fail, got ${residualCheck(S, s.y, 16, 16, bad)}`);
});

test("ridge by stacked QR solves the same normal equations as Cholesky; coefficients shrink as lambda grows", () => {
  const s = samples(16, 21), A = design(s.x, 15);
  for (const lam of [1e-2, 1]) {
    const q = lstsqQR(A, s.y, 16, 16, lam).c, ch = lstsqCholesky(A, s.y, 16, 16, lam).c;
    const d = Math.max(...q.map((v, i) => Math.abs(v - ch[i]))), scale = Math.max(...q.map(Math.abs));
    assert.ok(d / scale < 1e-8, `lambda ${lam}: QR and Cholesky differ by ${d / scale}`);
    assert.ok(residualCheck(A, s.y, 16, 16, q, lam) < 1e-14);
    assert.ok(residualCheck(A, s.y, 16, 16, q, 0) > 1e-6, "the ridge solution is not the plain least-squares solution");
  }
  const st = polyStudy();
  for (let i = 1; i < st.ridge.length; i++) assert.ok(st.ridge[i].coefNorm < st.ridge[i - 1].coefNorm, `norm at lambda ${st.ridge[i].lambda}`);
});

test("degree 15 fits its 16 points to rounding but misses held-out points badly; degree 3 does not", () => {
  const st = polyStudy(), d3 = st.degrees[3], d15 = st.degrees[15];
  assert.ok(d15.trainRmse < 1e-8, `degree-15 train RMSE ${d15.trainRmse}`);
  assert.ok(d15.heldRmse > 100 * d3.heldRmse, `degree-15 held-out ${d15.heldRmse} vs degree 3 ${d3.heldRmse}`);
  assert.ok(d3.heldRmse < 2 * TRUTH.sigma, `degree 3 is near the noise floor: ${d3.heldRmse}`);
  // Training error alone never picks the right degree: it only goes down.
  for (let d = 1; d <= 15; d++) assert.ok(st.degrees[d].trainRmse <= st.degrees[d - 1].trainRmse + 1e-12);
  assert.ok(st.bestDegree < 8, `held-out picks a low degree, got ${st.bestDegree}`);
  const strong = fitAndScore(st.train, st.held, 15, 1e-2);
  assert.ok(strong.heldRmse < d15.heldRmse / 1000 && strong.heldRmse < 1.5 * d3.heldRmse, `ridge 1e-2 rescues degree 15: ${strong.heldRmse}`);
});

test("spiral net: 40 points are memorised and held-out accuracy stays low; the 400-point control generalises", () => {
  const small = spiralRun(40, { steps: 4000, every: 500 }), full = spiralRun(400, { steps: 4000, every: 500 });
  assert.equal(small.final.accuracy, 1);
  assert.ok(small.final.heldAccuracy < 0.9, `40-point held-out ${small.final.heldAccuracy}`);
  assert.ok(small.final.heldLoss > 1.5 * small.heldLossMinimum.heldLoss, "held-out loss climbs back up after its minimum");
  assert.ok(full.final.heldAccuracy > 0.98, `400-point held-out ${full.final.heldAccuracy}`);
  assert.ok(small.accuracyGap > 10 * Math.max(full.accuracyGap, 0.005));
});

test("trainingBatches regenerates the lab trainer's own stream: the first step's loss matches", () => {
  const m = createModel(TINY, 5), copy = createModel(TINY, 5);
  const b = trainingBatches(13, 4, TINY.ctx, [1, 2]);
  const tr = createTrainer(m, { seed: 13, batch: 4 });
  const first = tr.step().loss;
  const n = 4 * TINY.ctx, l = lossOnly(copy, b.x.subarray(0, n), b.y.subarray(0, n), 4, TINY.ctx);
  assert.ok(Math.abs(first - l) < 1e-12, `${first} vs ${l}`);
  const wrong = trainingBatches(14, 4, TINY.ctx, [1]);
  assert.ok(Math.abs(lossOnly(copy, wrong.x, wrong.y, 4, TINY.ctx) - first) > 1e-6, "another seed's batch (control) must differ");
});

test("model.json's own curves: the gap is read, and facts.json is current with no em dash", () => {
  const bytes = readFileSync(MODEL_URL), M = JSON.parse(bytes.toString("utf8")), g = attentionGap(M);
  assert.equal(g.gaps.at(-1).step, M.steps);
  assert.ok(Math.abs(g.gaps.at(-1).gap - (M.curve.at(-1).heldOut - M.curve.at(-1).train)) < 1e-12);
  const raw = readFileSync(FACTS_URL, "utf8"), facts = JSON.parse(raw);
  assert.equal(facts.modelJsonSha256, createHash("sha256").update(bytes).digest("hex"), "re-run tools/school/fill_heldout.mjs");
  assert.ok(!raw.includes("—"), "no em dashes");
  for (const k of ["poly", "spiral", "attention"]) assert.equal(typeof facts[k].about, "string");
});
