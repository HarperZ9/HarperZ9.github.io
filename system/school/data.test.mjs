// Tests for lesson L13, "Data: what goes in comes out".
// Run: node --test system/school/data.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { mixBatch, makeSpec, lookbackMix, DEFAULT_SPEC, EP, freshSource, noisySource, poolSource, scoreSet, trainCurve, noisyFloor, distinctRows } from "./data.mjs";
import { makeBatch, heldOut, HELD_OUT_SEED, VOCAB } from "./corpus.mjs";
import { createModel, rng, evaluate, toJSON } from "./tinyformer.mjs";
import { createLoop } from "./trainloop.mjs";
import { trueTable } from "./corpus-grammar.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/data/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8"));
const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const small = { dModel: 16, dFF: 32 };

test("mixBatch with the default spec equals corpus.makeBatch bit for bit; held-out rows too", () => {
  for (const seed of [1, 11, 12345]) {
    const a = mixBatch(rng(seed), 16, 24), b = makeBatch(rng(seed), 16, 24);
    for (const k of ["x", "y", "kind", "src"]) assert.ok(same(a[k], b[k]), `${k} seed ${seed}`);
  }
  const h = mixBatch(rng(HELD_OUT_SEED), 64, 24), c = heldOut(64, 24);
  for (const k of ["x", "y", "kind", "src"]) assert.ok(same(h[k], c[k]), k);
});

test("control: another mix draws different rows from the same seed", () => {
  const a = mixBatch(rng(11), 16, 24, makeSpec({ mix: { copy: 0.5, who: 0.3, plain: 0.2 } })), b = makeBatch(rng(11), 16, 24);
  assert.ok(!same(a.x, b.x));
});

test("look-back share 0 leaves no look-back targets; doers without rerun never answer rerun", () => {
  const z = mixBatch(rng(3), 64, 24, makeSpec({ mix: lookbackMix(0) }));
  assert.equal(z.kind.reduce((a, b) => a + b, 0), 0);
  assert.ok(z.ep.every((e) => e === EP.plain));
  const d = mixBatch(rng(3), 200, 24, makeSpec({ doers: ["tallow", "pylon"] })), rerun = VOCAB.indexOf("rerun");
  let answers = 0;
  for (let i = 0; i < d.y.length; i++) if (d.kind[i] && d.ep[i] === EP.who && d.y[i] === rerun) answers++;
  assert.equal(answers, 0);
  const all = mixBatch(rng(3), 200, 24);
  let ctl = 0;
  for (let i = 0; i < all.y.length; i++) if (all.kind[i] && all.ep[i] === EP.who && all.y[i] === rerun) ctl++;
  assert.ok(ctl > 10, "control: with every guide allowed, rerun does answer");
});

test("trainCurve on the fresh source reproduces createLoop bit for bit", () => {
  const a = createModel({}, M.seed), b = createModel({}, M.seed), held = heldOut(16, 24);
  trainCurve(a, held, { steps: 12, source: freshSource({ seed: M.dataSeed }), seed: M.dataSeed });
  const lp = createLoop(b, { seed: M.dataSeed });
  for (let s = 0; s < 12; s++) lp.step();
  assert.deepEqual(toJSON(a).params, toJSON(b).params);
  const c = createModel({}, M.seed);
  trainCurve(c, held, { steps: 12, source: freshSource({ seed: M.dataSeed + 1 }) });
  assert.notDeepEqual(toJSON(c).params, toJSON(b).params, "control: another data seed gives other weights");
});

test("label noise changes about share x 45/46 of targets and never the inputs; share 0 changes nothing", () => {
  const base = freshSource({ seed: 5 }), clean = freshSource({ seed: 5 }), noisy = noisySource(base, 0.3, 7);
  for (let s = 0; s < 40; s++) {
    const a = noisy.next(), b = clean.next();
    assert.ok(same(a.x, b.x));
  }
  const rate = noisy.info.changed / noisy.info.targets;
  assert.ok(Math.abs(rate - 0.3 * 45 / 46) < 0.02, `changed share ${rate}`);
  const n0 = noisySource(freshSource({ seed: 5 }), 0, 7), c0 = freshSource({ seed: 5 });
  for (let s = 0; s < 5; s++) assert.ok(same(n0.next().y, c0.next().y));
});

test("a pool source repeats its rows; a fresh source does not", () => {
  const p = poolSource({ rows: 32, seed: 2 }), f = freshSource({ seed: 2 });
  const grab = (src) => { const xs = []; for (let s = 0; s < 20; s++) xs.push(src.next().x); const x = new Int32Array(20 * 16 * 24); xs.forEach((a, i) => x.set(a, i * 384)); return { x, ctx: 24 }; };
  assert.ok(distinctRows(grab(p)) <= 32);
  assert.ok(distinctRows(grab(f)) > 250);
  assert.equal(p.passes, 10, "320 rows from a pool of 32 is 10 full passes");
});

test("scoreSet agrees with evaluate and its splits add up", () => {
  const m = createModel({}, M.seed), held = mixBatch(rng(HELD_OUT_SEED), 32, 24), e = evaluate(m, held), s = scoreSet(m, held);
  assert.ok(Math.abs(s.all.loss - e.loss) < 1e-5);
  assert.ok(Math.abs(s.lookback.accuracy - e.copyAccuracy) < 1e-9);
  const parts = Object.entries(s).filter(([k]) => k.includes(".")).reduce((a, [, v]) => a + v.n, 0);
  assert.equal(parts, s.all.n);
});

test("noisyFloor: e 0 is the generator floor; noise raises it", () => {
  const held = heldOut(16, 24), P = trueTable(held);
  const f0 = noisyFloor(P, held.y, 0), f1 = noisyFloor(P, held.y, 0.1), f3 = noisyFloor(P, held.y, 0.3);
  assert.ok(f0 > 0.3 && f0 < 1.0, `floor ${f0}`);
  assert.ok(f0 < f1 && f1 < f3);
});

test("memorising: a tiny pool trains far below its held-out loss; fresh rows are the control", () => {
  const held = heldOut(32, 24), run = (source) => {
    const m = createModel(small, 3), pool = source.pool;
    trainCurve(m, held, { steps: 300, source, seed: 1 });
    return { trainLoss: scoreSet(m, pool ?? mixBatch(rng(77), 16, 24)).all.loss, held: evaluate(m, held).loss };
  };
  const p = run(poolSource({ rows: 8, seed: 4 })), f = run(freshSource({ seed: 4 }));
  assert.ok(p.held - p.trainLoss > 0.8, `pool gap ${p.held - p.trainLoss}`);
  assert.ok(Math.abs(f.held - f.trainLoss) < 0.4, `fresh gap ${f.held - f.trainLoss}`);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["reproduce", "noise", "lookback", "noCopy", "labelNoise", "duplication", "shift"]) assert.ok(f[sec].about.length > 60, sec);
  assert.equal(f.reproduce.pointsEqual, f.reproduce.points, "the default recipe must reproduce the model's curve");
  const zero = f.lookback.runs.find((r) => r.lookbackShare === 0);
  assert.ok(zero.summary.copyAccuracy < 0.3, "a model that never saw look-back episodes must fail to copy");
});
