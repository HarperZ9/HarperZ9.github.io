// Tests for lesson K25, "Case study: the denoiser's tensor-core parity".
// Run: node --test system/school/denoiser.test.mjs
// The re-creation is synthetic (see denoiser.mjs); these tests check its
// arithmetic, that it shows the miss only with a firefly, and that the bound
// is raw-native's 1e-2 everywhere. Controls that must fail are asserted to.
import test from "node:test";
import assert from "node:assert/strict";
import { setPriority } from "node:os";
import { FORMATS, roundTo, spacing } from "./precision.mjs";
import { PARITY, NOTE_CASE, Q, VARIANTS, linear, makeImage, makeNet, scoreImage, scoreFirefly, filterPixel, sweep } from "./denoiser.mjs";

try { setPriority(10); } catch (e) { console.error("could not lower priority:", e.message); }
const CASE = 1, IMG = makeImage(CASE), NET = makeNet(CASE, IMG), CTL = makeImage(CASE, { firefly: false });
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);

test("rounding is precision.mjs's, bit for bit, and fp16 or bf16 products are exact in fp32", () => {
  let s = 0x2545f491;
  const W = new Uint32Array(1), F = new Float32Array(W.buffer);
  for (let i = 0; i < 20000; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0; W[0] = s;
    const x = F[0];
    if (!Number.isFinite(x)) continue;
    assert.ok(Object.is(Q.fp16(x), roundTo(x, FORMATS.fp16)), `fp16 of ${x}`);
    assert.ok(Object.is(Q.bf16(x), roundTo(x, FORMATS.bf16)), `bf16 of ${x}`);
    if (typeof Math.f16round === "function") assert.ok(Object.is(Q.fp16(x), Math.f16round(x)), `Math.f16round of ${x}`);
    const y = Q.fp16(F[0] / 3 + 0.5), z = Q.fp16(x);
    if (Number.isFinite(y * z)) assert.equal(Math.fround(y * z), y * z, "an fp16 x fp16 product needs at most 22 significand bits");
  }
  assert.equal(Q.fp16(110), 110);
  assert.equal(spacing(110, FORMATS.fp16), 0.0625, "K24's spacing near 110");
  const lf = Math.log1p(Math.fround(NOTE_CASE.fireflyRadiance / Math.fround(0.05)));
  assert.equal(spacing(lf, FORMATS.fp16), 2 ** -7, "log1p of the demodulated firefly lies in [8, 16)");
  assert.ok(Math.abs(Q.fp16(lf) - lf) <= 2 ** -8);
});

test("the sum order is modelled: tensor-core path adds the bias after the sum, the scalar path starts from it", () => {
  const W = Float32Array.of(1, 1, 1), x = [2 ** -25, 2 ** -25, 2 ** -25], b = Float32Array.of(1);
  const tc = linear(W, b, x, 1, 3, { w: "fp32", x: "fp32", acc: "tc32" })[0], sq = linear(W, b, x, 1, 3, { w: "fp32", x: "fp32", acc: "seq32" })[0];
  assert.equal(sq, 1, "each 2^-25 is under half an ulp of 1 and is lost");
  assert.equal(tc, 1 + 2 ** -23, "1.5 x 2^-24 summed first rounds 1 up by one ulp");
});

test("the case is built to the note's magnitudes", () => {
  const { x, y } = IMG.firefly, i = (y * IMG.w + x) * 3;
  assert.ok(Math.abs(IMG.demod[i] - 21740) < 1, `demodulated firefly ${IMG.demod[i]}, the note's about 21,700`);
  const r = scoreFirefly(IMG, NET, "WA");
  assert.ok(r.ref[0] > 105 && r.ref[0] < 115, `filtered value ${r.ref[0]}, the note's about 110`);
  assert.ok(r.fireflyWeight > 0.004 && r.fireflyWeight < 0.006, `firefly weight ${r.fireflyWeight}`);
  assert.ok(r.sensitivity > 100 && r.sensitivity < 115, `d out / d logit at the firefly ${r.sensitivity}`);
});

test("the reference and the fp32 scalar path pass the bound, with and without a firefly", () => {
  for (const img of [IMG, CTL]) {
    const s = scoreImage(img, NET, "scalar");
    assert.equal(s.bound, 1e-2);
    assert.ok(s.within && s.maxAbs < 1e-3, `scalar max ${s.maxAbs}`);
  }
  const ref = filterPixel(IMG, NET, IMG.firefly.x, IMG.firefly.y, "reference").out, again = filterPixel(IMG, NET, IMG.firefly.x, IMG.firefly.y, "reference").out;
  assert.deepEqual(ref, again, "the reference is deterministic");
});

test("the tensor-core arithmetic misses the bound at the firefly by the right order, and the linear prediction explains it", () => {
  const r = scoreFirefly(IMG, NET, "WA");
  assert.ok(!r.within && r.maxAbs > 0.02 && r.maxAbs < 0.5, `WA at the firefly ${r.maxAbs} (the RTX's 0.107)`);
  assert.ok(Math.abs(r.predicted - r.maxAbs) / r.maxAbs < 0.05, `prediction ${r.predicted} against ${r.maxAbs}`);
  assert.ok(Math.abs(r.dzFirefly) > 1e-4 && Math.abs(r.dzFirefly) < 1e-2, `logit move at the firefly ${r.dzFirefly}`);
  const sw = sweep(SEEDS, ["scalar", "WA"]);
  assert.equal(sw.perPath.scalar.over, 0);
  assert.ok(sw.perPath.WA.over >= 0.6 * SEEDS.length, `WA misses on ${sw.perPath.WA.over} of ${SEEDS.length} seeded cases`);
  assert.ok(sw.perPath.WA.median > 0.02 && sw.perPath.WA.median < 0.3, `median ${sw.perPath.WA.median}`);
});

test("without the firefly every variant passes: the miss needs the firefly", () => {
  for (const p of Object.keys(VARIANTS)) {
    const s = scoreImage(CTL, NET, p);
    assert.ok(s.within && s.maxAbs < 2e-3, `${p} on the control image: ${s.maxAbs}`);
  }
  const sw = sweep(SEEDS, Object.keys(VARIANTS), false);
  for (const p of Object.keys(VARIANTS)) assert.equal(sw.perPath[p].over, 0, `${p} control over the bound`);
});

test("the control that must fail: the scalar path with the first layer's weights scaled by 1.01 exceeds the bound", () => {
  const bad = { ...NET, W1: NET.W1.map((v) => Math.fround(v * 1.01)) };
  const ref = filterPixel(IMG, NET, IMG.firefly.x, IMG.firefly.y, "reference").out, out = filterPixel(IMG, bad, IMG.firefly.x, IMG.firefly.y, "scalar").out;
  const d = Math.max(...out.map((v, c) => Math.abs(v - ref[c])));
  assert.ok(d > PARITY.bound, `perturbed scalar ${d}`);
});

test("the bound is 1e-2 for every variant and cannot be altered", () => {
  assert.ok(Object.isFrozen(PARITY) && Object.isFrozen(VARIANTS));
  assert.throws(() => { PARITY.bound = 0.2; }, TypeError);
  assert.equal(PARITY.bound, 1e-2);
  for (const p of Object.keys(VARIANTS)) {
    assert.ok(Object.isFrozen(VARIANTS[p]));
    for (const r of [scoreFirefly(IMG, NET, p), scoreImage(IMG, NET, p), scoreImage(CTL, NET, p)]) {
      assert.equal(r.bound, 1e-2, `${p} reports bound ${r.bound}`);
      assert.equal(r.within, r.maxAbs <= 1e-2, `${p}'s verdict follows the unchanged bound`);
    }
  }
  const fixes = ["keepHead", "scalar"].map((p) => scoreFirefly(IMG, NET, p));
  assert.ok(fixes.every((r) => r.bound === 1e-2));
});
