// studio-surface.test.mjs
// Node:test unit tests for the pure helpers in studio-surface.js.
// Only tests code paths that do not touch the DOM (pure logic helpers).
// Run: node --test system/studio-surface.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

// ── Helpers for the NATIVE_CAMERA_SOURCES set logic ──────────────────────────
// We replicate the set logic here rather than importing the browser module,
// because studio-surface.js uses document / window which are not available in Node.

// P2 directive a: ndim is reclassified into the native-camera set (the volumetric renderer dollies
// the camera INTO the volume on wheel + orbits on drag), so it must NOT get the flat CSS panzoom.
const NATIVE_CAMERA_SOURCES = new Set(["fractal", "fractal3d", "ndim"]);

function needsNativeCamera(source) {
  return NATIVE_CAMERA_SOURCES.has(source);
}

test("fractal, fractal3d, and ndim are native-camera sources (no flat panzoom layer)", () => {
  assert.equal(needsNativeCamera("fractal"), true);
  assert.equal(needsNativeCamera("fractal3d"), true);
  assert.equal(needsNativeCamera("ndim"), true);   // P2: volumetric camera, not a flat image scale
});

test("genuinely flat sources still get the universal CSS panzoom layer", () => {
  for (const s of ["atelier", "music", "byo", "watch", "unknown"]) {
    assert.equal(needsNativeCamera(s), false, `${s} should not be a native-camera source`);
  }
});

// ── Fit/Fill toggle state machine ─────────────────────────────────────────────
// Pure state: "fit" | "fill" cycling.

function makeToggleFitMode(initial = "fit") {
  let mode = initial;
  return function toggle() {
    mode = mode === "fit" ? "fill" : "fit";
    return mode;
  };
}

test("fit/fill toggles from fit to fill", () => {
  const toggle = makeToggleFitMode("fit");
  assert.equal(toggle(), "fill");
});

test("fit/fill toggles from fill back to fit", () => {
  const toggle = makeToggleFitMode("fill");
  assert.equal(toggle(), "fit");
});

test("fit/fill round-trips correctly over multiple toggles", () => {
  const toggle = makeToggleFitMode("fit");
  const results = [toggle(), toggle(), toggle(), toggle()];
  assert.deepEqual(results, ["fill", "fit", "fill", "fit"]);
});

// ── Cinema mode state ─────────────────────────────────────────────────────────

function makeCinemaState() {
  let active = false;
  return {
    toggle() { active = !active; return active; },
    set(v) { active = !!v; return active; },
    get() { return active; },
  };
}

test("cinema starts off", () => {
  const c = makeCinemaState();
  assert.equal(c.get(), false);
});

test("cinema toggle: off -> on", () => {
  const c = makeCinemaState();
  assert.equal(c.toggle(), true);
});

test("cinema toggle: on -> off", () => {
  const c = makeCinemaState();
  c.toggle();   // now on
  assert.equal(c.toggle(), false);
});

test("cinema set(true) activates", () => {
  const c = makeCinemaState();
  assert.equal(c.set(true), true);
});

test("cinema set(false) deactivates", () => {
  const c = makeCinemaState();
  c.set(true);
  assert.equal(c.set(false), false);
});

// ── Music monitor params clamping ─────────────────────────────────────────────
// The monitor update loop clamps feature values to [0,1] for the graph bindings.

function clampFeature(v) {
  if (typeof v !== "number") return 0;
  return Math.max(0, Math.min(1, v));
}

test("clampFeature clamps positive overflows to 1", () => {
  assert.equal(clampFeature(1.5), 1);
});

test("clampFeature clamps negative values to 0", () => {
  assert.equal(clampFeature(-0.3), 0);
});

test("clampFeature passes through valid range", () => {
  assert.equal(clampFeature(0.5), 0.5);
  assert.equal(clampFeature(0), 0);
  assert.equal(clampFeature(1), 1);
});

test("clampFeature returns 0 for non-number", () => {
  assert.equal(clampFeature(null), 0);
  assert.equal(clampFeature(undefined), 0);
  assert.equal(clampFeature("high"), 0);
});

// ── Source change panzoom gate ────────────────────────────────────────────────
// Verify the attach/detach decision logic is correct.

function panzoomShouldAttach(source) {
  return !NATIVE_CAMERA_SOURCES.has(source);
}

test("panzoom attaches for music", () => {
  assert.equal(panzoomShouldAttach("music"), true);
});

test("panzoom does NOT attach for ndim (P2: native volumetric camera)", () => {
  assert.equal(panzoomShouldAttach("ndim"), false);
});

test("panzoom attaches for atelier", () => {
  assert.equal(panzoomShouldAttach("atelier"), true);
});

test("panzoom attaches for byo", () => {
  assert.equal(panzoomShouldAttach("byo"), true);
});

test("panzoom does NOT attach for fractal (native camera)", () => {
  assert.equal(panzoomShouldAttach("fractal"), false);
});

test("panzoom does NOT attach for fractal3d (native camera)", () => {
  assert.equal(panzoomShouldAttach("fractal3d"), false);
});
