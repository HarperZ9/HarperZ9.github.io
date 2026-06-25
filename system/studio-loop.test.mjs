// studio-loop.test.mjs: unit tests for the pure live-loop / fullscreen-backing helpers.
// Run: node --test system/studio-loop.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceIsAnimated, shouldHaltOnStatic, fullscreenMaxBacking } from "./studio-loop.js";

// ── sourceIsAnimated ──────────────────────────────────────────────────────────
test("animated sources are reported animated regardless of state", () => {
  for (const s of ["fractal3d", "ndim", "music", "watch"]) {
    assert.equal(sourceIsAnimated(s, {}), true, `${s} should be animated`);
    assert.equal(sourceIsAnimated(s, undefined), true, `${s} animated with no state`);
  }
});

test("static sources are reported static", () => {
  for (const s of ["atelier", "fractal", "still", "unknown", undefined]) {
    assert.equal(sourceIsAnimated(s, {}), false, `${s} should be static`);
  }
});

test("byo is animated only while a video is playing", () => {
  assert.equal(sourceIsAnimated("byo", { byoPlaying: true }), true);
  assert.equal(sourceIsAnimated("byo", { byoPlaying: false }), false);
  assert.equal(sourceIsAnimated("byo", {}), false);   // still image
});

// ── shouldHaltOnStatic ──────────────────────────────────────────────────────────
test("halt only when the frame is static AND the source is not animated", () => {
  assert.equal(shouldHaltOnStatic(true, false), true);    // static + static source → halt
  assert.equal(shouldHaltOnStatic(true, true), false);   // static hash but animated → keep reading
  assert.equal(shouldHaltOnStatic(false, false), false); // changing frame → keep reading
  assert.equal(shouldHaltOnStatic(false, true), false);  // changing + animated → keep reading
});

// ── fullscreenMaxBacking ──────────────────────────────────────────────────────────
test("fullscreen backing tracks the longer screen edge times dpr", () => {
  // 2560x1440 @ dpr 1 → longer 2560, within [1600, 4096] → 2560
  assert.equal(fullscreenMaxBacking(2560, 1440, 1), 2560);
  // 1920x1080 @ dpr 2 → 3840, within ceiling → 3840
  assert.equal(fullscreenMaxBacking(1920, 1080, 2), 3840);
});

test("fullscreen backing is clamped to the GPU-safe hard cap", () => {
  // 3840x2160 @ dpr 2 → 7680 raw, capped to default 4096
  assert.equal(fullscreenMaxBacking(3840, 2160, 2), 4096);
  // explicit lower hardCap for CPU paths
  assert.equal(fullscreenMaxBacking(3840, 2160, 2, { hardCap: 2400 }), 2400);
});

test("fullscreen backing never drops below the windowed floor", () => {
  // a tiny screen still gets at least the 1600 floor
  assert.equal(fullscreenMaxBacking(800, 600, 1), 1600);
  // custom floor honored
  assert.equal(fullscreenMaxBacking(800, 600, 1, { floor: 1200 }), 1200);
});

test("fullscreen backing tolerates missing / zero inputs", () => {
  assert.equal(fullscreenMaxBacking(0, 0, 0), 1600);          // all zero → floor
  assert.equal(fullscreenMaxBacking(undefined, undefined, undefined), 1600);
});
