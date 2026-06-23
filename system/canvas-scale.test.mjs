// canvas-scale.test.mjs — unit tests for sizeToDisplay clamp math.
// Run: node --test system/canvas-scale.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sizeToDisplay } from "./canvas-scale.js";

// Minimal canvas stub: getBoundingClientRect returns cssW×cssH; backing is set via .width/.height.
function mkCanvas(cssW, cssH) {
  const c = { width: cssW, height: cssH };
  c.getBoundingClientRect = () => ({ width: cssW, height: cssH });
  return c;
}

test("dpr=1, no clamp — backing equals css size", () => {
  const c = mkCanvas(800, 600);
  const { w, h } = sizeToDisplay(c, { dpr: 1, maxBacking: 1600 });
  assert.equal(w, 800);
  assert.equal(h, 600);
  assert.equal(c.width, 800);
  assert.equal(c.height, 600);
});

test("dpr=2 — backing is 2× css, longer side under maxBacking", () => {
  const c = mkCanvas(640, 400);
  const { w, h } = sizeToDisplay(c, { dpr: 2, maxBacking: 1600 });
  assert.equal(w, 1280);
  assert.equal(h, 800);
});

test("clamp: landscape canvas at dpr=2 whose raw width exceeds maxBacking=1600", () => {
  // cssW=900, cssH=600, dpr=2 → rawW=1800, rawH=1200, longer=1800 > 1600
  // scale = 1600/1800 ≈ 0.8889 → w=round(1800*0.8889)=1600, h=round(1200*0.8889)=1067
  const c = mkCanvas(900, 600);
  const { w, h } = sizeToDisplay(c, { dpr: 2, maxBacking: 1600 });
  assert.equal(w, 1600);
  assert.equal(h, Math.max(1, Math.round(1200 * (1600 / 1800))));
});

test("clamp: portrait canvas, height is longer side", () => {
  // cssW=400, cssH=900, dpr=2 → rawW=800, rawH=1800, longer=1800 > 1600
  // scale=1600/1800 → w=round(800*(1600/1800)), h=1600
  const c = mkCanvas(400, 900);
  const { w, h } = sizeToDisplay(c, { dpr: 2, maxBacking: 1600 });
  assert.equal(h, 1600);
  assert.equal(w, Math.max(1, Math.round(800 * (1600 / 1800))));
});

test("quality=0.5 halves the effective resolution", () => {
  // cssW=800, cssH=800, dpr=2, quality=0.5 → rawW=rawH=800, longer=800 < 1600 → no clamp
  const c = mkCanvas(800, 800);
  const { w, h } = sizeToDisplay(c, { dpr: 2, maxBacking: 1600, quality: 0.5 });
  assert.equal(w, 800);
  assert.equal(h, 800);
});

test("High quality: maxBacking=2400 fits more pixels before clamping", () => {
  // cssW=800, cssH=600, dpr=2 → rawW=1600, rawH=1200 — fits in 2400, no clamp
  const c = mkCanvas(800, 600);
  const { w, h } = sizeToDisplay(c, { dpr: 2, maxBacking: 2400 });
  assert.equal(w, 1600);
  assert.equal(h, 1200);
});

test("square canvas at dpr=2 clamped to maxBacking: both sides equal maxBacking", () => {
  const c = mkCanvas(1000, 1000);
  const { w, h } = sizeToDisplay(c, { dpr: 2, maxBacking: 1600 });
  // rawW=rawH=2000 > 1600 → scale=1600/2000=0.8 → w=h=1600
  assert.equal(w, 1600);
  assert.equal(h, 1600);
});

test("backing dimensions are written back to canvas.width / canvas.height", () => {
  const c = mkCanvas(500, 400);
  sizeToDisplay(c, { dpr: 2, maxBacking: 1600 });
  assert.equal(c.width, 1000);
  assert.equal(c.height, 800);
});

test("returns {w, h} matching what was written to the canvas", () => {
  const c = mkCanvas(300, 200);
  const { w, h } = sizeToDisplay(c, { dpr: 1.5, maxBacking: 1600 });
  assert.equal(c.width, w);
  assert.equal(c.height, h);
  assert.equal(w, Math.round(300 * 1.5));
  assert.equal(h, Math.round(200 * 1.5));
});
