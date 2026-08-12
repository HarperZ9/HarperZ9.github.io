import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DISC_DEFAULTS,
  STRIP_DEFAULTS,
  spinRate,
  frameDrift,
  smearAngleRad,
  counterDistortPoint,
  discLayout,
  stripLayout,
  drumDiameterForStrip,
  stripLengthForSheet,
  drawDiscTemplate,
  drawStripTemplate,
} from "./zoetrope.js";

test("spin rate follows the flash rate law RPM = 60 f / S", () => {
  const s = spinRate(12, 12);
  assert.equal(s.revPerSec, 1);
  assert.equal(s.rpm, 60);
  assert.equal(spinRate(24, 12).rpm, 120);
  assert.throws(() => spinRate(0, 12), RangeError);
  assert.throws(() => spinRate(12, 1), RangeError);
});

test("drift law: equal holds, fewer drifts against spin, more drifts with it", () => {
  assert.deepEqual(frameDrift(12, 12), { holds: true, direction: 0, framesPerRev: 0 });
  assert.deepEqual(frameDrift(12, 13), { holds: false, direction: -1, framesPerRev: -1 });
  assert.deepEqual(frameDrift(14, 13), { holds: false, direction: 1, framesPerRev: 1 });
});

test("default disc fits both letter and A4 with 12 wedges of 30 degrees", () => {
  const d = discLayout();
  assert.equal(d.diameterMM, 190);
  assert.ok(d.diameterMM <= 198);
  assert.equal(d.frames, 12);
  assert.equal(d.slots, 12);
  assert.equal(d.frameAngleDeg, 30);
  assert.equal(d.slotStepDeg, 30);
  assert.equal(d.spindleHoleMM, 7.24);
  assert.equal(d.frameCenterAngleDeg(3), 90);
  assert.equal(d.slotCenterAngleDeg(6), 180);
  assert.equal(d.spin(12).rpm, 60);
  assert.ok(d.drift.holds);
});

test("disc bands nest: image band sits inside the slot band, all sizes positive", () => {
  const d = discLayout();
  assert.equal(d.slotInnerRMM, d.radiusMM - d.slotLengthMM);
  assert.ok(d.slotInnerRMM > 0);
  assert.ok(d.imageOuterRMM < d.slotInnerRMM);
  assert.ok(d.imageInnerRMM > 0);
  assert.ok(d.imageInnerRMM < d.imageOuterRMM);
});

test("slot width clamps to the practical 1 to 3 mm cutting range", () => {
  assert.equal(discLayout({ slotWidthMM: 0.2 }).slotWidthMM, 1);
  assert.equal(discLayout({ slotWidthMM: 8 }).slotWidthMM, 3);
  assert.equal(stripLayout({ slotWidthMM: 0.2 }).slotWidthMM, 1);
});

test("disc rejects bad counts and impossible dimensions", () => {
  assert.throws(() => discLayout({ frames: 1 }), RangeError);
  assert.throws(() => discLayout({ slots: 2.5 }), RangeError);
  assert.throws(() => discLayout({ diameterMM: -5 }), RangeError);
  assert.throws(() => discLayout({ imageInnerFrac: 0.99 }), RangeError);
});

test("smear angle is the slot arc and shrinks with radius", () => {
  const near = smearAngleRad(2, 50);
  const far = smearAngleRad(2, 100);
  assert.ok(near > 0);
  assert.ok(far < near);
  assert.equal(far, 2 / 100);
  assert.throws(() => smearAngleRad(0, 100), RangeError);
});

test("counter distortion is identity at strength 0 and rotates against spin", () => {
  const d = discLayout();
  const p0 = counterDistortPoint(60, 0, d, 0);
  assert.ok(Math.abs(p0.x - 60) < 1e-9);
  assert.ok(Math.abs(p0.y) < 1e-9);
  const p1 = counterDistortPoint(60, 0, d, 1);
  const half = smearAngleRad(d.slotWidthMM, d.slotInnerRMM) / 2;
  assert.ok(Math.abs(Math.hypot(p1.x, p1.y) - 60) < 1e-9);
  assert.ok(Math.abs(Math.atan2(p1.y, p1.x) - half) < 1e-9);
});

test("strip math matches the calculator worked example: 200 mm, 12 frames, 60 RPM", () => {
  const s = stripLayout({ drumDiameterMM: 200, frames: 12, slots: 12 });
  assert.ok(Math.abs(s.circumferenceMM - Math.PI * 200) < 1e-9);
  assert.ok(Math.abs(s.frameWidthMM - s.circumferenceMM / 12) < 1e-9);
  assert.equal(s.spin(12).rpm, 60);
  assert.equal(s.totalLengthMM, s.circumferenceMM + s.overlapTabMM);
});

test("slot centers align with frame centers when counts match", () => {
  const s = stripLayout({ drumDiameterMM: 100, frames: 12, slots: 12 });
  for (let i = 0; i < 12; i += 1) {
    const f = s.frameRectMM(i);
    const slot = s.slotRectMM(i);
    assert.ok(Math.abs(f.x + f.w / 2 - (slot.x + slot.w / 2)) < 1e-9);
  }
});

test("strip rects tile the band without overlap and slots sit above frames", () => {
  const s = stripLayout();
  const f0 = s.frameRectMM(0);
  const f1 = s.frameRectMM(1);
  assert.ok(Math.abs(f0.x + f0.w - f1.x) < 1e-9);
  assert.equal(f0.y, s.slotHeightMM);
  assert.equal(s.slotRectMM(0).y, 0);
  assert.ok(s.slotHeightMM >= s.imageHeightMM);
  assert.equal(s.heightMM, s.slotHeightMM + s.imageHeightMM);
  assert.ok(s.wallHeightMM > 0);
  assert.ok(s.wallHeightMM <= 90);
});

test("sheet math: one letter sheet yields an 85 mm drum", () => {
  const len = stripLengthForSheet("letter");
  assert.equal(len, 267);
  assert.ok(Math.abs(drumDiameterForStrip(len) - 85) < 0.5);
  assert.equal(stripLengthForSheet("a4", 2), 570);
  assert.throws(() => stripLengthForSheet("tabloid"), RangeError);
});

function mockCtx() {
  const calls = { strokeRect: 0, arc: 0, stroke: 0 };
  return {
    calls,
    save() {}, restore() {}, rotate() {}, beginPath() {},
    moveTo() {}, lineTo() {},
    arc() { calls.arc += 1; },
    stroke() { calls.stroke += 1; },
    strokeRect() { calls.strokeRect += 1; },
  };
}

test("disc template draws one slot rect per slot plus outline, crosshair, spindle", () => {
  const ctx = mockCtx();
  const d = discLayout();
  drawDiscTemplate(ctx, d, 4);
  assert.equal(ctx.calls.strokeRect, d.slots);
  assert.equal(ctx.calls.arc, 2);
});

test("strip template draws border, tab, and one rect per slot and frame", () => {
  const ctx = mockCtx();
  const s = stripLayout();
  drawStripTemplate(ctx, s, 4);
  assert.equal(ctx.calls.strokeRect, 1 + s.slots + s.frames + 1);
});
