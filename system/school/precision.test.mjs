// Tests for lesson K24, "fp16, bf16 and tensor cores".
// Run: node --test system/school/precision.test.mjs
// Each claim has a control that must fail, and the test asserts that it does.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { setPriority } from "node:os";
import { FORMATS, roundTo, round16, roundBf16, f16Bits, f16FromBits, bf16Bits, bf16FromBits, KNOWN, errorSweep, spacing, precisionNear, bitsNeeded, longSum, rint } from "./precision.mjs";
import { context, roundParams, forwardCtx, createPrecisionScorer, matmulStudy, dotGrowth, MODES } from "./precision-model.mjs";
import { fromJSON, createModel, forward, rng } from "./tinyformer.mjs";
import { heldOut } from "./corpus.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const FACTS_URL = new URL("../../media/school/precision/facts.json", import.meta.url);
const M = JSON.parse(readFileSync(new URL("../../media/school/attention/model.json", import.meta.url), "utf8")), MODEL = fromJSON(M.weights);
const { fp16, bf16 } = FORMATS, W = new Uint32Array(1), F = new Float32Array(W.buffer);
const randomFloat32 = (r) => { W[0] = Math.floor(r() * 2 ** 32); return F[0]; };

test("known bit patterns: ties to even, subnormals, overflow to infinity; truncation fails them", () => {
  for (const [x, h, b] of KNOWN) {
    assert.equal(f16Bits(x), h, `fp16 bits of ${x}`);
    assert.equal(bf16Bits(x), b, `bf16 bits of ${x}`);
    assert.ok(Object.is(f16FromBits(h), round16(x)), `fp16 value of ${x}`);
    assert.ok(Object.is(bf16FromBits(b), roundBf16(x)), `bf16 value of ${x}`);
  }
  const wrong16 = KNOWN.filter(([x, h]) => f16Bits(x, "truncate") !== h).length, wrongBf = KNOWN.filter(([x, , b]) => bf16Bits(x, "truncate") !== b).length;
  assert.ok(wrong16 >= 3 && wrongBf >= 3, `truncation is caught: ${wrong16} fp16 and ${wrongBf} bf16 patterns differ`);
  assert.equal(roundTo(65520, fp16, "truncate"), 65504, "truncation never reaches infinity");
  assert.equal(fp16.max, 65504);
  assert.equal(fp16.minSub, 2 ** -24);
  assert.equal(bf16.max, Math.fround(3.3895313892515355e38), "bf16's largest value is a float32");
  assert.equal(rint(2.5), 2); assert.equal(rint(3.5), 4); assert.equal(rint(-2.5), -2);
});

test("value-level and bit-level rounding agree on 200,000 random float32 patterns, and with Math.f16round", () => {
  const r = rng(11), native = typeof Math.f16round === "function";
  let disagree = 0, nativeDisagree = 0, truncDisagree = 0;
  for (let i = 0; i < 200000; i++) {
    const x = randomFloat32(r);
    if (Number.isNaN(x)) { assert.ok(Number.isNaN(f16FromBits(f16Bits(x)))); continue; }
    const v = round16(x);
    if (!Object.is(v, f16FromBits(f16Bits(x))) || !Object.is(roundBf16(x), bf16FromBits(bf16Bits(x)))) disagree++;
    if (native && !Object.is(v, Math.f16round(x))) nativeDisagree++;
    if (!Object.is(v, f16FromBits(f16Bits(x, "truncate")))) truncDisagree++;
  }
  assert.equal(disagree, 0);
  if (native) assert.equal(nativeDisagree, 0, "Math.f16round (ECMAScript 2025) is a third, independent implementation");
  assert.ok(truncDisagree > 50000, `truncation differs on ${truncDisagree} values`);
});

test("round trips: every fp16 and every bf16 pattern decodes to a value that rounds back to itself", () => {
  for (let h = 0; h < 65536; h++) {
    const a = f16FromBits(h), b = bf16FromBits(h);
    if (!Number.isNaN(a)) { assert.equal(f16Bits(a), h); assert.ok(Object.is(round16(a), a)); }
    if (!Number.isNaN(b)) { assert.equal(bf16Bits(b), h); assert.ok(Object.is(roundBf16(b), b)); }
  }
});

test("error against magnitude: at most 2^-11 (fp16) and 2^-8 (bf16) in the normal range; worse in fp16 subnormals; spacing near 110", () => {
  const s16 = errorSweep(fp16), sbf = errorSweep(bf16);
  for (const row of s16) {
    if (row.octave >= -14 && row.octave <= 15) assert.ok(row.maxRel <= fp16.u, `fp16 octave ${row.octave}: ${row.maxRel}`);
    if (row.octave >= 16) assert.equal(row.overflow, 1031, "every value from 65536 up overflows");
  }
  assert.ok(s16.find((x) => x.octave === -22).maxRel > 100 * fp16.u, "subnormals lose relative precision");
  assert.ok(sbf.every((row) => row.maxRel <= bf16.u && row.overflow === 0), "bf16 keeps float32's range");
  assert.ok(Math.max(...s16.filter((x) => x.octave >= -14 && x.octave <= 15).map((x) => x.maxRel)) > 0.9 * fp16.u, "the bound is nearly reached");
  assert.equal(spacing(110, fp16), 2 ** -4);
  assert.equal(spacing(110, bf16), 2 ** -1);
  const p = precisionNear(110, fp16);
  assert.ok(Math.abs(p.spacingRel - 0.0625 / 110) < 1e-15 && Math.abs(p.worstRel - 0.03125 / 110) < 1e-15);
  assert.equal(bitsNeeded(110, 1e-4), 13, "a 13-bit significand is the first whose half-spacing near 110 is under 1e-4 of it");
});

test("long sums stagnate in the narrow format: adding 1 stops at 2048 in fp16 and 256 in bf16; float32 keeps counting", () => {
  assert.equal(longSum(1, 5000, fp16).stuckAt, 2048);
  assert.equal(longSum(1, 5000, bf16).stuckAt, 256);
  assert.equal(longSum(1, 5000, FORMATS.fp32).stuckAt, null);
  assert.equal(longSum(1, 5000, FORMATS.fp32).sum, 5000);
  const small = longSum(0.01, 10000, fp16);
  assert.ok(small.stuckAt !== null && small.sum < 50, `0.01 added 10,000 times stops at ${small.sum}`);
  assert.ok(small.spacingAtStuck / 2 >= small.stepStored, "it stops where half a spacing reaches the step");
});

test("the context forward: no rounding equals the model's float64 forward; float32 is close to the model's own forward", () => {
  const x = heldOut(4, 24).x, cfg = MODEL.config, m64 = createModel({ ...cfg, float64: true }, MODEL.seed);
  for (const n of MODEL.names) m64.params[n].set(MODEL.params[n]);
  const want = forward(m64, x, 4, 24).logits, got = forwardCtx(roundParams(MODEL.params, (v) => v), cfg, x, 4, 24, context("fp64"));
  got.forEach((v, i) => assert.ok(Math.abs(v - want[i]) <= 1e-12 * (1 + Math.abs(want[i])), `logit ${i}`));
  const f32 = forwardCtx(roundParams(MODEL.params, Math.fround), cfg, x, 4, 24, context("fp32")), own = forward(MODEL, x, 4, 24).logits;
  f32.forEach((v, i) => assert.ok(Math.abs(v - own[i]) < 1e-3, `float32 logit ${i}`));
  const c = context("fp16acc16"), low = forwardCtx(roundParams(MODEL.params, c.st), cfg, x, 4, 24, c);
  assert.ok(low.every(Number.isFinite));
  assert.ok(low.some((v, i) => Math.abs(v - want[i]) > 1e-3), "fp16 storage changes the logits: the context is not a no-op");
});

test("step-at-a-time scoring equals one pass; every mode has a scorer", () => {
  const held = heldOut(8, 24), a = createPrecisionScorer(MODEL, held, "bf16acc32", 3), b = createPrecisionScorer(MODEL, held, "bf16acc32", 8);
  while (!a.done) a.step();
  while (!b.done) b.step();
  assert.deepEqual(Array.from(a.units().loss.num), Array.from(b.units().loss.num));
  assert.equal(Object.keys(MODES).length, 6);
});

test("accumulation: fp32 accumulators add almost nothing to input rounding; narrow ones add error that grows with length", () => {
  const r = rng(5), N = 16, K = 64, Mo = 32, a = Float32Array.from({ length: N * K }, () => 2 * r() - 1), w = Float32Array.from({ length: K * Mo }, () => (2 * r() - 1) * 0.2);
  const rows = Object.fromEntries(matmulStudy(a, w, null, N, K, Mo).map((x) => [x.mode, x]));
  assert.ok(rows.fp16acc32.accOnly.maxOverMag <= 2 * 64 * 2 ** -24, "fp32 accumulation over 64 terms stays within gamma_64 of float32");
  assert.ok(rows.fp16acc16.accOnly.maxOverMag > 10 * rows.fp16acc32.accOnly.maxOverMag);
  assert.ok(rows.bf16acc16.total.relNorm > rows.bf16acc32.total.relNorm);
  const g16 = [256, 4096].map((k) => dotGrowth(k, "fp16", "fp16", { lo: 0, count: 8 })), g32 = [256, 4096].map((k) => dotGrowth(k, "fp16", "fp32", { lo: 0, count: 8 }));
  assert.ok(g16[1].worstOverMag > 4 * g16[0].worstOverMag, "narrow accumulation error grows with length");
  assert.ok(g32[1].worstOverMag < 1e-4, "fp32 accumulation of 4,096 positive products stays small");
});

test("facts.json, when present, carries every block and agrees with the code", { skip: !existsSync(FACTS_URL) }, () => {
  const f = JSON.parse(readFileSync(FACTS_URL, "utf8"));
  for (const sec of ["sources", "formats", "bits", "sweep", "matmul", "attention", "model", "stagnation", "near110", "controls", "speed", "film"]) assert.ok(f[sec].about.length > 60, sec);
  assert.equal(f.near110.fp16.spacing, 0.0625);
  assert.ok(f.bits.rows.every((x) => x.f16ok && x.bf16ok));
  assert.equal(f.controls.truncation.caught, true);
});
