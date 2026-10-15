// Tests for lesson F3 (gradients). Run: node --test system/school/gradients.test.mjs
// Every claim the lesson makes has a control that must fail, and the test
// asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { makeBowl, ROSENBROCK, TWO_VALLEYS, SURFACES, numericGrad, checkGrad, hessian, descend, sampleGrid, stepStudy,
  landscapeSlice, filterNormalizedDirection, gradNorm, readoutScale, scaleDescent } from "./gradients.mjs";
import { createModel, lossOnly, fromJSON } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";

const POINTS = [[0.3, -0.7], [-1.2, 1], [1.5, 0.2], [-0.4, -1.1]];
const TINY = { dModel: 8, nHeads: 2, nLayers: 1, dFF: 16, ctx: 6, float64: true };
const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);

test("exact gradients match finite differences; a sign-flipped or swapped gradient fails", () => {
  for (const s of SURFACES) {
    assert.ok(checkGrad(s, POINTS) < 1e-8, `${s.id} exact gradient error ${checkGrad(s, POINTS)}`);
    const flipped = checkGrad(s, POINTS, (x, y) => s.grad(x, y).map((v) => -v));
    const swapped = checkGrad(s, POINTS, (x, y) => s.grad(x, y).reverse());
    assert.ok(flipped > 0.5, `${s.id} sign-flipped control must fail, got ${flipped}`);
    assert.ok(swapped > 0.1, `${s.id} swapped control must fail, got ${swapped}`);
  }
  const [gx, gy] = numericGrad(ROSENBROCK.f, 1, 1);
  assert.ok(Math.abs(gx) < 1e-6 && Math.abs(gy) < 1e-6, "Rosenbrock is flat at its minimum");
});

test("bowl: curvatures from the Hessian, and the stable-step bound measured on real runs", () => {
  const bowl = makeBowl();
  const { curvatures } = hessian(bowl, 0.2, -0.4);
  assert.ok(Math.abs(curvatures[0] - 4) < 1e-6 && Math.abs(curvatures[1] - 0.5) < 1e-6, `curvatures ${curvatures}`);
  const st = stepStudy(bowl);
  assert.ok(Math.abs(st.predictedBound - 0.5) < 1e-8);
  assert.ok(st.relativeGap < 1e-6, `measured bound ${st.measuredBound} vs predicted ${st.predictedBound}`);
  const by = Object.fromEntries(st.runs.map((r) => [r.multiple, r]));
  assert.equal(by[0.5].outcome, "converges");
  assert.match(by[0.99].outcome, /^converges slowly/);
  assert.ok(by[0.99].finalLoss < by[0.99].startLoss);
  // Control: just above the bound the same run diverges.
  assert.match(by[1.01].outcome, /^diverges/);
  assert.ok(by[1.01].finalLoss > by[1.01].startLoss);
  assert.match(by[2].outcome, /^diverges/);
  // On a quadratic the steep direction is scaled by (1 - step * kMax) = 1 - 2m per step.
  for (const m of [0.99, 1.01, 2]) assert.ok(Math.abs(by[m].perStepFactor - Math.abs(1 - 2 * m)) < 1e-6, `factor at ${m}: ${by[m].perStepFactor}`);
  assert.ok(Math.abs(by[0.5].perStepFactor - (1 - 0.25 * 0.5)) < 1e-6, "at 0.5x the flat direction sets the pace");
});

test("descent goes downhill; the sign-flipped control climbs", () => {
  const down = descend(ROSENBROCK, [-1.2, 1], { step: 1e-3, steps: 20000 });
  assert.ok(Math.hypot(down.end[0] - 1, down.end[1] - 1) < 1e-3, `Rosenbrock end ${down.end}`);
  const up = descend(ROSENBROCK, [-1.2, 1], { step: 1e-3, steps: 50, gradFn: (x, y) => ROSENBROCK.grad(x, y).map((v) => -v) });
  assert.ok(up.f > ROSENBROCK.f(-1.2, 1), "following +gradient must raise the loss");
  const k = hessian(ROSENBROCK, 1, 1).curvatures[0];
  assert.ok(Math.abs(k - 1001.6) < 0.1, `Rosenbrock top curvature at the minimum ${k}`);
});

test("two valleys: the start decides the valley, and the left one is deeper", () => {
  const a = descend(TWO_VALLEYS, [-0.3, 0], { step: 0.05, steps: 2000, tol: 1e-9 });
  const b = descend(TWO_VALLEYS, [0.3, 0], { step: 0.05, steps: 2000, tol: 1e-9 });
  assert.ok(a.end[0] < -0.9 && b.end[0] > 0.9, `ends ${a.end} ${b.end}`);
  assert.ok(a.f < b.f, "left valley deeper");
  assert.ok(a.gradNorm < 1e-9 && b.gradNorm < 1e-9, "both are true stationary points");
  const g = sampleGrid(TWO_VALLEYS, 11);
  assert.equal(g.values.length, 11);
  assert.ok(g.min <= a.f + 0.5 && g.max > g.min);
});

test("filter-wise normalisation: each filter has its weight filter's norm; 1D parameters get zero", () => {
  const m = createModel(TINY, 3), d = filterNormalizedDirection(m, 5), D = m.config.dModel, C = 3 * D;
  const w = m.params["l0.wqkv"], u = d["l0.wqkv"];
  for (const col of [0, 7, C - 1]) {
    let nw = 0, nd = 0;
    for (let k = 0; k < D; k++) { nw += w[k * C + col] ** 2; nd += u[k * C + col] ** 2; }
    assert.ok(Math.abs(Math.sqrt(nw) - Math.sqrt(nd)) < 1e-12, `column ${col}`);
  }
  for (const n of ["l0.bqkv", "l0.ln1_g", "lnf_b"]) assert.ok(d[n].every((v) => v === 0), `${n} direction is zero`);
});

test("loss slice: centre equals the loss, weights are restored, slopes match the backward pass", () => {
  const m = createModel(TINY, 3), held = heldOut(4, TINY.ctx);
  const before = Float64Array.from(m.params["l0.w1"]);
  const s = landscapeSlice(m, held, { n: 5, span: 0.5, seed: 9 });
  assert.deepEqual(m.params["l0.w1"], before, "weights restored");
  assert.ok(Math.abs(s.values[2][2] - s.center) < 1e-12 && Math.abs(s.center - lossOnly(m, held.x, held.y, 4, TINY.ctx)) < 1e-12);
  for (let i = 0; i < 2; i++) {
    const rel = Math.abs(s.slopeBackward[i] - s.slopeFiniteDiff[i]) / (Math.abs(s.slopeBackward[i]) + Math.abs(s.slopeFiniteDiff[i]));
    assert.ok(rel < 1e-3, `slope ${i}: ${s.slopeBackward[i]} vs ${s.slopeFiniteDiff[i]}`);
    // Control: the opposite sign is far off.
    const ctl = Math.abs(-s.slopeBackward[i] - s.slopeFiniteDiff[i]) / (Math.abs(s.slopeBackward[i]) + Math.abs(s.slopeFiniteDiff[i]));
    assert.ok(ctl > 0.5, "sign-flipped slope must disagree");
  }
  assert.ok(Math.abs(s.cosine) < 0.5, "random directions are far from parallel");
});

test("one number: dL/ds matches finite differences; descent lowers the loss, the climb control raises it", () => {
  const m = createModel(TINY, 4), held = heldOut(4, TINY.ctx);
  for (const s of [0.5, 2]) {
    const r = readoutScale(m, held, s), h = 1e-5;
    const num = (readoutScale(m, held, s + h).loss - readoutScale(m, held, s - h).loss) / (2 * h);
    assert.ok(Math.abs(num - r.dLds) / (Math.abs(num) + Math.abs(r.dLds) + 1e-12) < 1e-6, `dL/ds at ${s}: ${r.dLds} vs ${num}`);
  }
  const start = readoutScale(m, held, 5).loss;
  const down = scaleDescent(m, held, { start: 5, step: 2, steps: 20 });
  const up = scaleDescent(m, held, { start: 5, step: 2, steps: 20, flipSign: true });
  assert.ok(down.loss < start, `descent ${start} -> ${down.loss}`);
  assert.ok(up.loss > start, `climb control ${start} -> ${up.loss}`);
});

test("trained attention model: smaller gradient than at initialisation; facts.json is from this model.json", () => {
  const bytes = readFileSync(MODEL_URL), M = JSON.parse(bytes.toString("utf8"));
  const held = heldOut(16, M.config.ctx);
  const trained = gradNorm(fromJSON(M.weights), held), init = gradNorm(createModel(M.config, M.seed), held);
  assert.ok(trained.loss < 1.0 && init.loss > 3.5, `losses ${trained.loss} ${init.loss}`);
  assert.ok(trained.norm < 0.5 * init.norm, `gradient norms ${trained.norm} vs ${init.norm}`);
  const facts = JSON.parse(readFileSync(new URL("../../media/school/gradients/facts.json", import.meta.url), "utf8"));
  assert.equal(facts.modelJsonSha256, createHash("sha256").update(bytes).digest("hex"), "re-run tools/school/fill_gradients.mjs");
  assert.ok(facts.landscape.trained.max > facts.landscape.trained.center && facts.landscape.trained.values.length === 21);
});
