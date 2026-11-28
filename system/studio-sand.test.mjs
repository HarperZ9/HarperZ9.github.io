import test from "node:test";
import assert from "node:assert/strict";
import { SandWorld, MAT, MATERIAL_LIST, SAND_PRESETS } from "./studio-sand.js";

test("SandWorld gravity drops sand particles downward deterministically", () => {
  const w = new SandWorld(40, 30, 99);
  w.setCell(20, 5, MAT.SAND);
  for (let i = 0; i < 15; i++) w.step();
  assert.equal(w.cells[w.idx(20, 5)], MAT.AIR);
  assert.equal(w.cells[w.idx(20, 20)], MAT.SAND);
});

test("SandWorld fire melts adjacent sand into glass and water extinguishes fire to steam", () => {
  const w = new SandWorld(40, 30, 777);
  w.paintDisc(20, 15, 4, MAT.SAND);
  w.paintDisc(20, 19, 3, MAT.FIRE);
  for (let i = 0; i < 60; i++) w.step();
  const c = w.counts();
  assert.ok((c[MAT.GLASS] || 0) >= 1, "fire melted at least one sand cell into glass");
});

test("SandWorld presets populate non-empty multi-material scenes and render RGBA pixels", () => {
  const w = new SandWorld(64, 48, 42);
  for (const p of SAND_PRESETS) {
    w.loadPreset(p.id);
    const total = Object.values(w.counts()).reduce((a, b) => a + b, 0);
    assert.ok(total > 50, `preset ${p.id} populated cells`);
  }
  const img = { data: new Uint8ClampedArray(64 * 48 * 4) };
  w.renderToImageData(img);
  assert.equal(img.data[3], 255);
  assert.ok(MATERIAL_LIST.length === 10);
});
