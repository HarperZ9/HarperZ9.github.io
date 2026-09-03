// hero-aperture.test.mjs: the per-surface identity table and the three boot gates.
// Run: node --test system/hero-aperture.test.mjs
//
// The shader itself is measured in the browser (composited over the black ground); what is testable
// here is the contract around it: that the three surfaces stay distinguishable, and that a canvas
// that cannot or should not run one ends up labelled rather than left half-mounted.
import { test } from "node:test";
import assert from "node:assert/strict";
import { APERTURES, bootHeroAperture, isHeroApertureAvailable } from "./hero-aperture.js";

const KEYS = ["gallery", "retro", "loom"];

// Circular distance on the 0..1 hue wheel: 0.95 and 0.02 are 0.07 apart, not 0.93.
function hueGap(a, b) {
  const d = Math.abs(a - b) % 1;
  return d > 0.5 ? 1 - d : d;
}

// A canvas stub carrying only what boot reads. No WebGL, so getContext returns null and the module
// must take its failure path rather than throwing into the page.
function mkCanvas(key) {
  return { dataset: { aperture: key }, getContext: () => null, clientWidth: 540, clientHeight: 540 };
}

function withMedia(matches, run) {
  const priorWindow = globalThis.window;
  globalThis.window = { matchMedia: (q) => ({ matches: !!matches[q] }) };
  try { return run(); } finally { globalThis.window = priorWindow; }
}

const DESKTOP = { "(min-width: 900px)": true, "(pointer: fine)": true };

test("every surface names a complete preset", () => {
  assert.deepEqual(Object.keys(APERTURES).sort(), [...KEYS].sort());
  for (const k of KEYS) {
    const p = APERTURES[k];
    for (const field of ["hue", "blades", "seed", "radius", "gain"]) {
      assert.equal(typeof p[field], "number", `${k}.${field}`);
      assert.ok(Number.isFinite(p[field]), `${k}.${field} finite`);
    }
    assert.ok(p.hue >= 0 && p.hue < 1, `${k}.hue in [0,1)`);
    assert.ok(p.blades >= 8 && p.blades <= 128, `${k}.blades sane`);
    assert.ok(p.gain > 0 && p.gain <= 2, `${k}.gain sane`);
  }
});

test("no two surfaces read as the same instrument", () => {
  // Hue and blade count are the whole of the identity. If either pair collapsed, two pages would
  // open with the same mark and the variation would be decorative rather than meaningful.
  for (let i = 0; i < KEYS.length; i++) {
    for (let j = i + 1; j < KEYS.length; j++) {
      const a = APERTURES[KEYS[i]], b = APERTURES[KEYS[j]];
      assert.ok(hueGap(a.hue, b.hue) >= 0.15, `${KEYS[i]} vs ${KEYS[j]} hue gap`);
      assert.notEqual(a.blades, b.blades, `${KEYS[i]} vs ${KEYS[j]} blades`);
      assert.notEqual(a.seed, b.seed, `${KEYS[i]} vs ${KEYS[j]} seed`);
    }
  }
});

// Mean composited luminance over the black ground at 1440x900, per surface, with gain forced to 1.
// These are measurements, not targets: the gains below are chosen to divide them to a common level.
const PRE_GAIN_MEAN = { gallery: 24.66, retro: 28.64, loom: 37.11 };

test("gain normalises measured luminance, so the three carry equal weight", () => {
  // Not a function of blade count alone: the Retro Engine lights sixteen blades and still outshines
  // the Gallery's forty-four, because its rim and ember core carry more of the light. The only rule
  // that holds is the measured one, which is why the constants are pinned to a measurement here.
  const levels = KEYS.map(k => PRE_GAIN_MEAN[k] * APERTURES[k].gain);
  const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
  for (let i = 0; i < KEYS.length; i++) {
    assert.ok(Math.abs(levels[i] - mean) / mean < 0.03,
      `${KEYS[i]} sits ${(100 * (levels[i] - mean) / mean).toFixed(1)}% off the common level`);
  }
  // The browser re-measures these three at 26.10 / 26.39 / 26.20 after the gain is applied, which is
  // the same numbers back: gain multiplies the whole colour, so the level scales linearly with it.
  assert.ok(mean > 24 && mean < 28, `common level ${mean.toFixed(2)} drifted out of the measured band`);
});

test("without WebGL a canvas is marked static, not left half-mounted", () => {
  withMedia(DESKTOP, () => {
    const c = mkCanvas("gallery");
    assert.equal(bootHeroAperture(c), null);
    assert.equal(c.dataset.mode, "static");
  });
  assert.equal(isHeroApertureAvailable(), false, "no document or WebGL in node");
});

test("narrow and coarse-pointer viewports never mount a context", () => {
  for (const media of [{}, { "(min-width: 900px)": true }, { "(pointer: fine)": true }]) {
    withMedia(media, () => {
      const c = mkCanvas("loom");
      assert.equal(bootHeroAperture(c), null);
      assert.equal(c.dataset.mode, "static");
    });
  }
});

test("boot tolerates a missing canvas and an unknown key", () => {
  withMedia(DESKTOP, () => {
    assert.equal(bootHeroAperture(null), null);
    const c = mkCanvas("no-such-surface");
    assert.equal(bootHeroAperture(c), null);
    assert.equal(c.dataset.mode, "static");
  });
});
