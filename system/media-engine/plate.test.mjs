// node --test system/media-engine/plate.test.mjs
// The plate plugin's recipe: from params, or from the canvas's data attributes as nav.js mounts it.
import test from "node:test";
import assert from "node:assert/strict";
import { plateRecipe, DEFAULT_LAYERS } from "./plugins/plate.mjs";

test("dataset mode reads seed, layers, fx and amount from the canvas, as mountSpecimens did", () => {
  const canvas = { dataset: { specimen: "plate-terminal-tape", specimenLayers: "dendrite, riso-moire", specimenFx: "scan,  smear", specimenFxAmount: "0.4" } };
  assert.deepEqual(plateRecipe(canvas, { fromDataset: true }, "ignored"),
    { seed: "plate-terminal-tape", layers: ["dendrite", "riso-moire"], fx: ["scan", "smear"], fxAmount: 0.4 });
});

test("dataset mode falls back to the specimen defaults when the canvas names nothing", () => {
  assert.deepEqual(plateRecipe({ dataset: {} }, { fromDataset: true }, "x"), { seed: "specimen", layers: null, fx: [], fxAmount: 0.6 });
});

test("params mode keeps the Studio surface's recipe", () => {
  assert.deepEqual(plateRecipe({ dataset: {} }, {}, "folded-light"), { seed: "folded-light", layers: DEFAULT_LAYERS, fx: [], fxAmount: 0.6 });
});
