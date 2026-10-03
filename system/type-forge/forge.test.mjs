// node --test system/type-forge/forge.test.mjs
// The browser forge against the engine it ports. The hashes below are SHA-256 of the TrueType files
// Flywheel's Python forge (harness/typeface_forge.py + typeface_ttf.py, Flywheel main 6e1b0e06,
// 3 October 2026) wrote for the same parameters. This port must write the same bytes.
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mint, setText, DEFAULTS } from "./forge.mjs";
import { toTTF } from "./ttf.mjs";
import { pyRound } from "./pyround.mjs";

const PY = [
  [58, {}, "ac4f7f9fb27784a239e1769d34d27d403660598962f03976637785b1688c3558"],
  [58, { weight: 0.145 }, "dde233e2d29d0b18b38830dfbcb798b55be499ac2404e0f2e52b28c7d0025775"],
  [58, { contrast: 0.6, weight: 0.058, width: 1.2 }, "a1dc9917c25d2004f3de17e3430e9019ccf57df5b80a09cb8fb30468bb6cc0b1"],
  [7, { style: "runic" }, "68ade70359a56c839004c9914d580b9d9631fc777341e9179defc8d4d466898d"],
];
const sha = (b) => createHash("sha256").update(b).digest("hex");

test("the port writes the Python engine's font bytes for every reference mint", () => {
  for (const [seed, params, expected] of PY) {
    const face = mint(params, seed);
    assert.equal(face.refused, false, JSON.stringify(params));
    assert.equal(sha(toTTF(face)), expected, JSON.stringify(params));
  }
});

test("a rule refuses an over-heavy weight by name, with the Python engine's words", () => {
  const face = mint({ weight: 0.2 }, 58);
  assert.equal(face.refused, true);
  assert.deepEqual(face.refusals, ["counter-minimum: bowl counter 120 under 150 em-units; lighten the weight or raise the x-height"]);
  assert.deepEqual(face.glyphs, {});
  assert.match(mint({ contrast: 0.3 }, 58).refusals.join(" "), /contrast-floor/);
});

test("the seed is recorded but does not move the outlines yet (true of the original too)", () => {
  assert.equal(sha(toTTF(mint({}, 137))), PY[0][2]);
  assert.notDeepEqual(mint({}, 137).receipt.params._shoulder_jitter, mint({}, 58).receipt.params._shoulder_jitter);
});

test("the charset is a to z, A to Z, 0 to 9 and . , -, and setText reports what is missing", () => {
  const face = mint({}, 58);
  assert.equal(Object.keys(face.glyphs).length, 65);
  const set = setText(face, "Hi, 2026? ok");
  assert.deepEqual(set.missing, ["?"]);
  assert.match(set.svg, /^<svg /);
  assert.equal(DEFAULTS.weight, 0.085);
});

test("pyRound matches Python's round half to even on exact ties and binary near-ties", () => {
  assert.equal(pyRound(12.5), 12);
  assert.equal(pyRound(13.5), 14);
  assert.equal(pyRound(-12.5), -12);
  assert.equal(pyRound(0.125, 2), 0.12);
  assert.equal(pyRound(0.375, 2), 0.38);
  assert.equal(pyRound(2.675, 2), 2.67, "2.675 is stored just below the tie");
  assert.equal(pyRound(1.005, 2), 1);
});
