// reactive.test.mjs
// Node:test suite for the pure reactive-mapping and reactive-visuals helpers.
// No DOM, no WebAudio, no canvas. Tests the deterministic math layer only.
// Run: node --test system/reactive.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  applyMapping, MAPPING_PRESETS, dominantChromaClass, chromaToHue, chromaPeak, clamp,
} from "./reactive-mapping.js";
import {
  oklchToRgba, lerpOklch, analogousPalette, triadicPalette, noise2, curlNoise2,
} from "./reactive-visuals.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// A silent feature frame (all zeros; represents quiescence).
function silentFeatures() {
  return { level: 0, flux: 0, bass: 0, mid: 0, treble: 0, centroid: 0,
           chroma: new Array(12).fill(0), tempo: 0 };
}

// A loud feature frame (onset, all bands up).
function loudFeatures() {
  return { level: 0.9, flux: 0.8, bass: 0.85, mid: 0.7, treble: 0.6, centroid: 0.6,
           chroma: [1, 0, 0, 0.5, 0, 0.3, 0, 0, 0, 0, 0, 0], tempo: 120 };
}

// ---------------------------------------------------------------------------
// clamp
// ---------------------------------------------------------------------------

test("clamp: below lo returns lo, above hi returns hi, within is identity", () => {
  assert.equal(clamp(-1, 0, 1), 0);
  assert.equal(clamp(2, 0, 1), 1);
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(0, 0, 1), 0);
  assert.equal(clamp(1, 0, 1), 1);
});

// ---------------------------------------------------------------------------
// dominantChromaClass
// ---------------------------------------------------------------------------

test("dominantChromaClass: returns the argmax index of the chroma vector", () => {
  const ch = [0, 0, 0.8, 0, 0, 0, 1, 0, 0, 0, 0, 0];  // max at index 6 (F#)
  assert.equal(dominantChromaClass(ch), 6);
});

test("dominantChromaClass: returns -1 on zero vector", () => {
  assert.equal(dominantChromaClass(new Array(12).fill(0)), -1);
});

test("dominantChromaClass: handles null / bad input gracefully", () => {
  assert.equal(dominantChromaClass(null), -1);
  assert.equal(dominantChromaClass([]), -1);
  assert.equal(dominantChromaClass([0.5]), -1);  // length < 12
});

test("chromaToHue: returns 0 for zero chroma, a hue in [0,360) otherwise", () => {
  const zero = new Array(12).fill(0);
  assert.equal(chromaToHue(zero), 0);
  const ch = new Array(12).fill(0); ch[9] = 1;  // A = pitch class 9 -> should be > 0
  const h = chromaToHue(ch);
  assert.ok(h >= 0 && h < 360, `Expected hue in [0,360), got ${h}`);
});

test("chromaPeak: returns 0 on zero chroma, max value otherwise", () => {
  assert.equal(chromaPeak(new Array(12).fill(0)), 0);
  const ch = [0, 0, 0.6, 0, 0, 0, 0.9, 0, 0, 0, 0, 0];
  assert.ok(Math.abs(chromaPeak(ch) - 0.9) < 1e-9);
});

// ---------------------------------------------------------------------------
// applyMapping - core mapping assertions
// ---------------------------------------------------------------------------

test("applyMapping: silent features -> near-zero pulse, intensity, lowMod, highMod", () => {
  const params = applyMapping(silentFeatures(), {});
  assert.ok(params.pulse    < 0.05, `pulse should be near 0, got ${params.pulse}`);
  assert.ok(params.intensity < 0.05, `intensity should be near 0, got ${params.intensity}`);
  assert.ok(params.lowMod   < 0.05, `lowMod should be near 0, got ${params.lowMod}`);
  assert.ok(params.highMod  < 0.05, `highMod should be near 0, got ${params.highMod}`);
});

test("applyMapping: loud onset -> large pulse > silent pulse", () => {
  const loud   = applyMapping(loudFeatures(), {});
  const silent = applyMapping(silentFeatures(), {});
  assert.ok(loud.pulse > silent.pulse, `loud pulse ${loud.pulse} should exceed silent ${silent.pulse}`);
  assert.ok(loud.pulse > 0.4, `expected pulse > 0.4 on onset, got ${loud.pulse}`);
});

test("applyMapping: loud features -> greater intensity than silence", () => {
  const loud   = applyMapping(loudFeatures(), {});
  const silent = applyMapping(silentFeatures(), {});
  assert.ok(loud.intensity > silent.intensity, "louder audio should produce more intensity");
});

test("applyMapping: higher centroid -> larger hueShift", () => {
  const lo = applyMapping({ ...silentFeatures(), centroid: 0.1 }, {});
  const hi = applyMapping({ ...silentFeatures(), centroid: 0.9 }, {});
  assert.ok(hi.hueShift > lo.hueShift, `hueShift should increase with centroid: ${lo.hueShift} vs ${hi.hueShift}`);
});

test("applyMapping: bass drives lowMod proportionally", () => {
  const bass0 = applyMapping({ ...silentFeatures(), bass: 0.0 }, {});
  const bass1 = applyMapping({ ...silentFeatures(), bass: 0.8 }, {});
  assert.ok(bass1.lowMod > bass0.lowMod, `bass should drive lowMod: ${bass0.lowMod} vs ${bass1.lowMod}`);
});

test("applyMapping: treble drives highMod proportionally", () => {
  const t0 = applyMapping({ ...silentFeatures(), treble: 0.0 }, {});
  const t1 = applyMapping({ ...silentFeatures(), treble: 0.8 }, {});
  assert.ok(t1.highMod > t0.highMod, `treble should drive highMod: ${t0.highMod} vs ${t1.highMod}`);
});

test("applyMapping: tempo 120 bpm at default speedRef -> speedMult close to 1", () => {
  const f = { ...silentFeatures(), tempo: 120 };
  const p = applyMapping(f, { speedRef: 120 });
  assert.ok(Math.abs(p.speedMult - 1.0) < 0.05, `speedMult should be ~1 at 120 bpm, got ${p.speedMult}`);
});

test("applyMapping: tempo 240 bpm -> speedMult higher than tempo 60 bpm", () => {
  const fast = applyMapping({ ...silentFeatures(), tempo: 240 }, {});
  const slow = applyMapping({ ...silentFeatures(), tempo: 60  }, {});
  assert.ok(fast.speedMult > slow.speedMult, `fast tempo should give higher speedMult`);
});

test("applyMapping: unknown tempo (0 bpm) -> speedMult == 1", () => {
  const p = applyMapping({ ...silentFeatures(), tempo: 0 }, {});
  assert.equal(p.speedMult, 1);
});

test("applyMapping: all output params are in valid ranges", () => {
  const loud = applyMapping(loudFeatures(), {});
  assert.ok(loud.pulse    >= 0 && loud.pulse    <= 1,   `pulse out of range: ${loud.pulse}`);
  assert.ok(loud.intensity >= 0 && loud.intensity <= 1,  `intensity out of range: ${loud.intensity}`);
  assert.ok(loud.hueShift  >= 0 && loud.hueShift  <= 1,  `hueShift out of range: ${loud.hueShift}`);
  assert.ok(loud.hue       >= 0 && loud.hue       <  360, `hue out of range: ${loud.hue}`);
  assert.ok(loud.speedMult >= 0,                         `speedMult negative: ${loud.speedMult}`);
  assert.ok(loud.lowMod    >= 0 && loud.lowMod    <= 1,  `lowMod out of range: ${loud.lowMod}`);
  assert.ok(loud.highMod   >= 0 && loud.highMod   <= 1,  `highMod out of range: ${loud.highMod}`);
});

test("applyMapping: mapping is deterministic (same input -> same output)", () => {
  const f = loudFeatures();
  const m = {};
  const p1 = applyMapping(f, m);
  const p2 = applyMapping(f, m);
  assert.deepStrictEqual(p1, p2, "applyMapping must be deterministic");
});

test("applyMapping: sensitivity multiplier scales pulse proportionally", () => {
  const f = { ...silentFeatures(), flux: 0.6 };
  const low  = applyMapping(f, { sensitivity: 0.5 });
  const high = applyMapping(f, { sensitivity: 2.0 });
  assert.ok(high.pulse > low.pulse, `higher sensitivity should yield larger pulse: ${low.pulse} vs ${high.pulse}`);
});

// ---------------------------------------------------------------------------
// Preset configs: smoke test each preset name
// ---------------------------------------------------------------------------

test("all MAPPING_PRESETS apply without throwing and return valid params", () => {
  const f = loudFeatures();
  for (const [name, config] of Object.entries(MAPPING_PRESETS)) {
    const p = applyMapping(f, config);
    assert.ok(typeof p.pulse === "number"    && Number.isFinite(p.pulse),    `${name}: pulse not finite`);
    assert.ok(typeof p.intensity === "number" && Number.isFinite(p.intensity), `${name}: intensity not finite`);
    assert.ok(typeof p.hue === "number"       && Number.isFinite(p.hue),       `${name}: hue not finite`);
    assert.ok(p.pulse >= 0 && p.pulse <= 1, `${name}: pulse out of [0,1]`);
  }
});

test("pulse preset: produces larger pulse than ambient preset on onset", () => {
  const f = loudFeatures();
  const pPulse   = applyMapping(f, MAPPING_PRESETS.pulse);
  const pAmbient = applyMapping(f, MAPPING_PRESETS.ambient);
  assert.ok(pPulse.pulse > pAmbient.pulse, "pulse preset should be puncher than ambient");
});

// ---------------------------------------------------------------------------
// OKLab / OKLCH color helpers (reactive-visuals.js exports)
// ---------------------------------------------------------------------------

test("oklchToRgba: returns an rgba(...) CSS string", () => {
  const s = oklchToRgba(0.65, 0.2, 200, 0.8);
  assert.ok(typeof s === "string", "oklchToRgba should return a string");
  assert.ok(s.startsWith("rgba("), `Expected rgba(...), got: ${s}`);
});

test("oklchToRgba: white-ish L=0.99, C=0 approximates a near-white color", () => {
  const s = oklchToRgba(0.99, 0, 0, 1);
  // Should contain high RGB values
  const nums = s.match(/\d+/g).map(Number);
  assert.ok(nums[0] > 200 && nums[1] > 200 && nums[2] > 200, `Expected near-white, got ${s}`);
});

test("oklchToRgba: black-ish L=0.0, C=0 approximates a near-black color", () => {
  const s = oklchToRgba(0.0, 0, 0, 1);
  const nums = s.match(/\d+/g).map(Number);
  assert.ok(nums[0] < 30 && nums[1] < 30 && nums[2] < 30, `Expected near-black, got ${s}`);
});

test("lerpOklch: t=0 returns first color, t=1 returns second color approximately", () => {
  const [L0, C0, H0] = lerpOklch(0.65, 0.2, 100, 0.50, 0.15, 200, 0);
  assert.ok(Math.abs(L0 - 0.65) < 1e-9, `t=0 L should be first L`);

  const [L1, C1, H1] = lerpOklch(0.65, 0.2, 100, 0.50, 0.15, 200, 1);
  assert.ok(Math.abs(L1 - 0.50) < 1e-9, `t=1 L should be second L`);
});

test("lerpOklch: t=0.5 gives intermediate L", () => {
  const [L] = lerpOklch(0.0, 0.0, 0, 1.0, 0.0, 0, 0.5);
  assert.ok(Math.abs(L - 0.5) < 1e-9, `midpoint L should be 0.5, got ${L}`);
});

test("analogousPalette: returns n swatches, all hues within spread of base", () => {
  const pal = analogousPalette(180, 5, 60, 0.65, 0.2);
  assert.equal(pal.length, 5, "Expected 5 swatches");
  for (const sw of pal) {
    assert.ok(sw.H >= 0 && sw.H < 360, `Hue out of range: ${sw.H}`);
    assert.ok(typeof sw.L === "number" && typeof sw.C === "number");
  }
});

test("triadicPalette: returns 3 swatches with hues 120 degrees apart", () => {
  const pal = triadicPalette(0, 0.65, 0.2);
  assert.equal(pal.length, 3);
  const diff1 = (pal[1].H - pal[0].H + 360) % 360;
  const diff2 = (pal[2].H - pal[0].H + 360) % 360;
  assert.ok(Math.abs(diff1 - 120) < 1, `expected 120 degree gap, got ${diff1}`);
  assert.ok(Math.abs(diff2 - 240) < 1, `expected 240 degree gap, got ${diff2}`);
});

// ---------------------------------------------------------------------------
// Noise helpers
// ---------------------------------------------------------------------------

test("noise2: returns values in approximately [-1, 1]", () => {
  for (const [x, y] of [[0,0],[1.5,2.3],[10,20],[0.1,0.9]]) {
    const v = noise2(x, y);
    assert.ok(v >= -1.5 && v <= 1.5, `noise2(${x},${y}) = ${v} outside expected range`);
  }
});

test("noise2: deterministic (same input same output)", () => {
  assert.equal(noise2(1.23, 4.56), noise2(1.23, 4.56));
  assert.equal(noise2(0, 0), noise2(0, 0));
});

test("noise2: different inputs produce different outputs (not constant)", () => {
  const samples = [[0,0],[0.5,0.5],[1,1],[2,3],[10,10]].map(([x,y]) => noise2(x,y));
  const unique = new Set(samples);
  assert.ok(unique.size > 1, "noise2 returned constant output for all inputs");
});

test("curlNoise2: returns a 2-element array with finite values", () => {
  const [dx, dy] = curlNoise2(1.5, 2.5, 0.01);
  assert.ok(Number.isFinite(dx) && Number.isFinite(dy), `curlNoise2 returned non-finite: [${dx}, ${dy}]`);
});

test("curlNoise2: produces a non-trivial force direction (not always [0,0])", () => {
  let nonZeroCount = 0;
  for (const [x, y] of [[0.5,0.5],[1.1,2.2],[5,7],[0.01,0.01]]) {
    const [dx, dy] = curlNoise2(x, y, 0.01);
    if (Math.abs(dx) > 1e-9 || Math.abs(dy) > 1e-9) nonZeroCount++;
  }
  assert.ok(nonZeroCount > 0, "curlNoise2 produced all-zero vectors");
});
