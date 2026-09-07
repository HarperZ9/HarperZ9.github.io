import { test } from "node:test";
import assert from "node:assert/strict";
import * as textured from "./spatial-textured.js";

const normalizeTexturedControls = (input) => {
  assert.equal(typeof textured.normalizeTexturedControls, "function");
  return textured.normalizeTexturedControls(input);
};

const texturedKindVisibility = (mode) => {
  assert.equal(typeof textured.texturedKindVisibility, "function");
  return textured.texturedKindVisibility(mode);
};

test("textured controls default missing Crystal City depth authoring safely", () => {
  assert.deepEqual(normalizeTexturedControls({ glow: 1.1 }), {
    parallax: .7,
    skyCurve: .24,
    atmosphereDensity: .88,
    hazeOpacity: .34,
    atmosphereFlow: .28,
    bokehScale: 1.05,
    beamFlow: .36,
    glow: 1.1,
    waterFlow: .2,
    depthDetail: .45,
    materialFocus: 0,
  });
});

test("textured controls reject non-finite or out-of-range depth authoring", () => {
  const controls = normalizeTexturedControls({
    depthDetail: Infinity,
    materialFocus: 1.25,
    atmosphereDensity: 4,
    hazeOpacity: -0.1,
  });
  assert.equal(controls.depthDetail, .45);
  assert.equal(controls.materialFocus, 0);
  assert.equal(controls.atmosphereDensity, .88);
  assert.equal(controls.hazeOpacity, .34);
});

test("particle focus maps to exact point-kind visibility vectors", () => {
  assert.deepEqual(texturedKindVisibility(0), { a: [1, 1, 1, 1], b: [1, 1, 1, 1] });
  assert.deepEqual(texturedKindVisibility(1), { a: [0, 0, 0, 1], b: [0, 1, 1, 0] });
  assert.deepEqual(texturedKindVisibility(2), { a: [0, 1, 1, 0], b: [0, 0, 0, 0] });
  assert.deepEqual(texturedKindVisibility(3), { a: [1, 0, 0, 0], b: [1, 0, 0, 1] });
});
