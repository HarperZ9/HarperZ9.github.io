// Tests for lesson S18, "Quantisation: fewer bits per number".
// Run: node --test system/school/quant.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { BITS, SCHEMES, qmax, matrices, groupMap, quantizeTensor, checkQuant, bytesOf, quantizeModel, tensorStats, histogram, levels, scoreUnits, summarise, createScorer, code } from "./quant.mjs";
import { gptqTensor, outputError, layerInputs, calibration, cholesky, spdInverse, hessian } from "./quant-gptq.mjs";
import { fromJSON, rng } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";
import { scoreOf } from "./errorbars.mjs";

const MODEL_URL = new URL("../../media/school/attention/model.json", import.meta.url);
const FACTS_URL = new URL("../../media/school/quant/facts.json", import.meta.url);
const RAW = readFileSync(MODEL_URL), M = JSON.parse(RAW.toString("utf8")), MODEL = fromJSON(M.weights), SPECS = matrices(MODEL.config);
const HELD = heldOut(128, M.config.ctx), BASE = scoreUnits(MODEL, HELD), loss = (m) => scoreOf(scoreUnits(m, HELD).loss);

test("values already on the grid come back exactly; any value comes back within half a step", () => {
  // Row 0 and row 32 hold +qmax in every column, so every block's maximum is
  // qmax steps and its scale is exactly 2^-6.
  const spec = { name: "t", rows: 40, cols: 24, axis: "col" }, r = rng(3);
  for (const bits of [...BITS, 16]) for (const scheme of SCHEMES) {
    const Q = qmax(bits), s = 2 ** -6, w = Float32Array.from({ length: 960 }, (_, i) => (Math.floor(i / 24) % 32 === 0 ? Q : Math.floor(r() * (2 * Q + 1)) - Q) * s);
    const res = quantizeTensor(w, spec, { bits, scheme });
    assert.deepEqual(Array.from(res.deq), Array.from(w), `bits ${bits} ${scheme}: on-grid values are exact`);
    const off = Float32Array.from(w, (v) => v + (r() - 0.5) * s * 0.9), c = checkQuant(off, quantizeTensor(off, spec, { bits, scheme }));
    assert.ok(c.ok && c.worstOverHalfStep <= 1 + 1e-4, `bits ${bits} ${scheme}: worst ${c.worstOverHalfStep}`);
  }
  assert.equal(code(0.5, 1, 7), 1, "ties round away from zero");
  assert.equal(code(-0.5, 1, 7), -1);
  assert.equal(code(100, 1, 7), 7, "codes clamp to qmax");
  assert.equal(qmax(2), 1, "2-bit symmetric has three levels: -1, 0, 1");
});

test("16 bits is within 1e-4 of float; 8 bits within 0.005; a scale off by a factor of 2 is caught by the checker and by the loss", () => {
  const f = scoreOf(BASE.loss);
  for (const scheme of SCHEMES) {
    assert.ok(Math.abs(loss(quantizeModel(MODEL, { bits: 16, scheme }).model) - f) < 1e-4, `16-bit ${scheme}`);
    assert.ok(Math.abs(loss(quantizeModel(MODEL, { bits: 8, scheme }).model) - f) < 5e-3, `8-bit ${scheme}`);
  }
  const good = quantizeModel(MODEL, { bits: 8, scheme: "channel" }), bad = quantizeModel(MODEL, { bits: 8, scheme: "channel", dequantScale: 2 });
  assert.ok(Object.values(good.per).every((p) => p.check.ok));
  assert.ok(Object.values(bad.per).every((p) => !p.check.ok), "every tensor read back with twice the scale fails the half-step check");
  assert.ok(loss(bad.model) > f + 0.05, `and the loss moves (${loss(bad.model)} against ${f})`);
  assert.ok(loss(quantizeModel(MODEL, { bits: 2, scheme: "tensor" }).model) > f + 1, "2 bits per tensor breaks the model: the score can see damage");
});

test("groups and bytes: one scale per tensor, per output channel, per 32 inputs of a channel", () => {
  const by = Object.fromEntries(SPECS.map((s) => [s.name, s]));
  assert.equal(SPECS.length, 11);
  assert.equal(SPECS.reduce((a, s) => a + s.rows * s.cols, 0), 20096);
  assert.equal(groupMap(by["l0.wqkv"], "channel").count, 96);
  assert.equal(groupMap(by["l0.w2"], "group").count, 64, "64 inputs: two groups per channel");
  assert.equal(groupMap(by.wte, "channel").count, 46, "an embedding's channel is a word's row");
  assert.equal(groupMap(by.wte, "group").count, 46, "a 32-number row is one group of 32");
  const b = bytesOf(MODEL.config, { bits: 8, scheme: "tensor" });
  assert.equal(b.float32, 20864 * 4);
  assert.equal(b.total, 20096 + 11 * 4 + 768 * 4);
  assert.equal(bytesOf(MODEL.config, { bits: 3, scheme: "tensor" }).packedWeights, Math.ceil((20096 * 3) / 8));
  const only = bytesOf(MODEL.config, { bits: 4, scheme: "tensor", only: ["wout"] });
  assert.equal(only.floatWeights, (20096 - 32 * 46) * 4);
});

test("GPTQ: equals round to nearest when inputs are uncorrelated; lowers the layer-output error on real inputs", () => {
  const K = 16, Mo = 8, N = 32, X = new Float32Array(N * K), r = rng(9), w = Float32Array.from({ length: K * Mo }, () => r() - 0.5);
  for (let n = 0; n < N; n++) X[n * K + (n % K)] = 1 + (n % 3);
  const spec = { name: "t", rows: K, cols: Mo, axis: "col" };
  for (const scheme of SCHEMES) assert.deepEqual(Array.from(gptqTensor(w, K, Mo, X, N, { bits: 3, scheme }).deq), Array.from(quantizeTensor(w, spec, { bits: 3, scheme }).deq), `diagonal H, ${scheme}`);
  const A = hessian(Float32Array.from({ length: 40 * 6 }, () => r()), 40, 6), inv = spdInverse(A, 6);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { let s = 0; for (let k = 0; k < 6; k++) s += A[i * 6 + k] * inv[k * 6 + j]; assert.ok(Math.abs(s - (i === j ? 1 : 0)) < 1e-8); }
  assert.throws(() => cholesky(Float64Array.from([1, 2, 2, 1]), 2), /positive definite/);
  const cal = calibration(), { inputs, N: NN } = layerInputs(MODEL, cal.x, cal.x.length / 24, 24);
  for (const s of SPECS.filter((x) => x.axis === "col")) {
    const W = MODEL.params[s.name], X2 = inputs[s.name], g = gptqTensor(W, s.rows, s.cols, X2, NN, { bits: 3, scheme: "channel" }).deq, q = quantizeTensor(W, s, { bits: 3, scheme: "channel" }).deq;
    assert.ok(outputError(X2, NN, s.rows, s.cols, W, g) < outputError(X2, NN, s.rows, s.cols, W, q), s.name);
  }
});

test("damage readings: outlier ratio, histogram, levels; step-at-a-time scoring equals one call", () => {
  const st = tensorStats(Float32Array.from([1, -1, 1, -1, 10]));
  assert.ok(Math.abs(st.outlier - 10 / Math.sqrt(104 / 5)) < 1e-12);
  const w = MODEL.params["l0.w1"], h = histogram(w, 32, Math.max(...Array.from(w, Math.abs)));
  assert.equal(h.reduce((a, b) => a + b, 0), w.length);
  const lv = levels(w, 3);
  assert.equal(lv.counts.length, 7);
  assert.equal(lv.counts.reduce((a, b) => a + b, 0), w.length);
  assert.ok(lv.used <= 7 && lv.values[3] === 0);
  const sc = createScorer(MODEL, HELD, 32);
  while (!sc.done) sc.step();
  const u = sc.units();
  assert.ok(Math.abs(scoreOf(u.loss) - scoreOf(BASE.loss)) < 1e-9);
  assert.deepEqual(Array.from(u.lookback.den), Array.from(BASE.lookback.den));
  const s = summarise(BASE, BASE, { resamples: 200 });
  assert.equal(s.loss.diff, 0);
  assert.ok(s.loss.lo < s.loss.value && s.loss.value < s.loss.hi);
});

test("facts.json, when present, was computed from this model file", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  assert.equal(f.modelSha256, createHash("sha256").update(RAW).digest("hex"));
  for (const sec of ["sources", "schemes", "damage", "sensitivity", "banding", "controls", "speed", "film"]) assert.ok(f[sec].about.length > 60, sec);
  assert.ok(Math.abs(f.controls.sixteenBit.maxLossDiff) < 1e-4);
  assert.equal(f.controls.brokenScale.caught, true);
  assert.equal(f.controls.onGrid.exact, true);
});
