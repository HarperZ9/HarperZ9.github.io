// DOM-less contract for the seeded typeface previewer. The visual rendering
// needs a real browser; this guards the axis math and the cross-language parity
// with tools/fonts/build_seeded_typeface.py, plus that the specimen renders
// without throwing and registers as an instrument.
import test from "node:test";
import assert from "node:assert/strict";
import { seedTypeface, drawTypefaceSpecimen, drawTypeface } from "./typeface.js";
import { neuralSeed } from "./neural.js";
import { specimenLayerNames } from "./generative-field.js";

// A fake 2d context whose measureText returns a width (proportional to the set
// font size and string length) so the fit loop exercises real branches.
function makeCtx(log) {
  const target = { font: "10px serif" };
  return new Proxy(target, {
    get(t, prop) {
      if (prop === "measureText") {
        return (text) => {
          const size = parseInt(String(t.font).match(/(\d+)px/)?.[1] || "10", 10);
          return { width: size * 0.6 * String(text).length };
        };
      }
      if (prop in t) return t[prop];
      if (typeof prop === "symbol") return undefined;
      return (...args) => { log.push([prop, ...args]); };
    },
    set(t, prop, value) {
      t[prop] = value;
      return true;
    },
  });
}

test("seedTypeface is deterministic and string/number equivalent", () => {
  const a = seedTypeface("aurora");
  assert.deepEqual(a, seedTypeface("aurora"));
  // A string seed hashes via FNV-1a; the specimen pipeline passes the numeric
  // route hash directly. Both paths must land on the same face.
  assert.deepEqual(a, seedTypeface(neuralSeed("aurora")));
});

test("seedTypeface axes match the Python builder for a known seed", () => {
  // Anchored to build_seeded_typeface.py's output for seed "aurora": if either
  // side's mix drifts, preview and exported font diverge and this fails.
  assert.deepEqual(seedTypeface("aurora"), {
    tag: "499b6781",
    slant: 0.0412,
    narrowing: 0.9146,
    breathingAmp: 3.712,
    breathingPhase: 2.5933,
    breathingY: 0.00915,
    facetMinChord: 252,
    facetStep: 196,
    facetMaxCuts: 5,
    bevelCut: 23,
    bevelMinEdge: 106,
    weightClass: 728,
    widthClass: 3,
  });
});

test("seedTypeface axes stay within legible bounds for many seeds", () => {
  for (const seed of ["aurora", "cinder", "obsidian", "", "42", "a long seed string!"]) {
    const p = seedTypeface(seed);
    assert.ok(p.slant >= -0.02 && p.slant <= 0.09, `slant ${p.slant}`);
    assert.ok(p.narrowing >= 0.9 && p.narrowing <= 1.03, `narrowing ${p.narrowing}`);
    assert.ok(p.breathingAmp >= 1.5 && p.breathingAmp <= 8.5, `amp ${p.breathingAmp}`);
    assert.ok(p.facetMaxCuts >= 3 && p.facetMaxCuts <= 6, `cuts ${p.facetMaxCuts}`);
    assert.ok(p.weightClass >= 520 && p.weightClass <= 860, `weight ${p.weightClass}`);
    assert.ok(p.widthClass >= 3 && p.widthClass <= 6, `width ${p.widthClass}`);
    assert.equal(p.tag.length, 8);
  }
});

test("different seeds produce different faces", () => {
  assert.notDeepEqual(seedTypeface("aurora"), seedTypeface("cinder"));
});

test("drawTypefaceSpecimen renders without throwing and returns its axes", () => {
  const log = [];
  const ctx = makeCtx(log);
  const ax = drawTypefaceSpecimen(ctx, 640, 360, "aurora");
  assert.deepEqual(ax, seedTypeface("aurora"));
  // It painted a background and set the word, plus the axis readout.
  assert.ok(log.some(([m]) => m === "fillRect"), "should fill a background");
  assert.ok(log.some(([m]) => m === "fillText"), "should draw glyphs");
  // Every drawn glyph of the word is emitted.
  const drawn = log.filter(([m]) => m === "fillText").length;
  assert.ok(drawn >= "Telos".length, `expected >= 5 fillText, got ${drawn}`);
});

test("drawTypeface is registered as a specimen instrument", () => {
  assert.ok(specimenLayerNames().includes("typeface"), "typeface layer must be registered");
  // The layer adapter honours the (ctx, w, h, tick, seed, palette) contract.
  const log = [];
  assert.doesNotThrow(() => drawTypeface(makeCtx(log), 400, 200, 0, 7, null));
});
