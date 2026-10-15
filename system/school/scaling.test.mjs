// Tests for lesson L14, "Scaling: bigger, longer, how much".
// Run: node --test system/school/scaling.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { gridConfig, paramCounts, computeOf, fitPowerLaw, predict, frontier, bestAtBudget, logBudgets, spread, checkpoints, excess } from "./scaling.mjs";
import { createModel, FLOPS, rng } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { trainCurve, freshSource } from "./data.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/scaling/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL);

test("parameter counts match the model's own tensors across the grid", () => {
  for (const d of [8, 16, 32, 64]) for (const L of [1, 2, 3]) {
    const c = gridConfig(d, L), m = createModel(c, 1), p = paramCounts(c);
    assert.equal(p.total, m.nParams, `d${d} L${L}`);
    const emb = m.params.wte.length + m.params.wpe.length + m.params.wout.length;
    assert.equal(p.embedding, emb);
  }
  assert.equal(paramCounts({}).total, 20864, "the lesson model has 20,864 parameters");
  assert.notEqual(paramCounts(gridConfig(32, 3)).total, createModel(gridConfig(32, 2), 1).nParams, "control: another depth counts differently");
});

test("compute is FLOPS per step times steps, and 6ND uses non-embedding parameters", () => {
  const c = gridConfig(16, 2), k = computeOf(c, 100);
  assert.equal(k.flops, FLOPS(c, 16, 24).step * 100);
  assert.equal(k.sixND, 6 * paramCounts(c).nonEmbedding * 100 * 384);
  assert.ok(computeOf(c, 200).flops === 2 * k.flops);
});

test("fitPowerLaw recovers a known exponent; scattered points fit badly (control)", () => {
  const xs = [1e3, 3e3, 1e4, 3e4, 1e5], ys = xs.map((x) => 5 * x ** -0.3);
  const f = fitPowerLaw(xs, ys);
  assert.ok(Math.abs(f.slope + 0.3) < 1e-12 && f.r2 > 0.999999);
  assert.ok(Math.abs(predict(f, 2e4) - 5 * 2e4 ** -0.3) < 1e-9);
  const r = rng(9), noise = xs.map(() => 10 ** (r() * 2));
  assert.ok(fitPowerLaw(xs, noise).r2 < 0.9);
});

test("frontier keeps only points no cheaper point beats", () => {
  const pts = [{ compute: 1, loss: 3 }, { compute: 2, loss: 2.5 }, { compute: 3, loss: 2.8 }, { compute: 4, loss: 2 }, { compute: 4, loss: 2.2 }];
  const f = frontier(pts);
  assert.deepEqual(f.map((p) => p.compute), [1, 2, 4]);
  assert.ok(!f.some((p) => p.loss === 2.8), "control: the dominated point is dropped");
  const b = bestAtBudget(pts, [0.5, 2.5, 10]);
  assert.equal(b[0].best, null);
  assert.equal(b[1].best.loss, 2.5);
  assert.equal(b[2].best.loss, 2);
  assert.deepEqual(logBudgets(1, 100, 1), [1, 10, 100]);
});

test("helpers: spread, checkpoints, excess", () => {
  const s = spread([1, 2, 3]);
  assert.equal(s.mean, 2);
  assert.equal(s.sd, 1);
  assert.deepEqual(checkpoints(500), [25, 50, 100, 200, 300, 500]);
  assert.equal(excess(0.6, 0.6585), null);
  assert.ok(Math.abs(excess(0.7, 0.6585) - 0.0415) < 1e-12);
});

test("a short run of the smallest grid model learns; lr 0 is a control that does not", () => {
  const held = heldOut(32, 24), c = gridConfig(8, 1);
  const a = trainCurve(createModel(c, 7), held, { steps: 200, at: checkpoints(200), source: freshSource({ seed: 11 }) });
  assert.ok(a.curve.at(-1).heldOut < a.curve[0].heldOut - 1.5, `${a.curve[0].heldOut} -> ${a.curve.at(-1).heldOut}`);
  assert.deepEqual(a.curve.map((p) => p.step), [0, 25, 50, 100, 200]);
  const z = trainCurve(createModel(c, 7), held, { steps: 50, source: freshSource({ seed: 11 }), lr: 0 });
  assert.equal(z.curve.at(-1).heldOut, z.curve[0].heldOut);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["grid", "fits", "frontier", "noise", "papers"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(f.grid.runs.length >= 8);
  for (const r of f.grid.runs) assert.equal(r.params.total, createModel(r.config, 1).nParams);
});
