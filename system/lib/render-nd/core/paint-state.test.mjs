// paint-state.test.mjs - node:test for the pure painting/display state model.
// Run: node --test system/lib/render-nd/core/paint-state.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createPaintState, setBrush, setPaintTarget, paintElement, paintAtTarget,
  faceColor, vertexColor, edgeColor, toggle, clearPaint, snapshot,
} from "./paint-state.mjs";

test("createPaintState: sensible defaults", () => {
  const s = createPaintState();
  assert.equal(s.showFaces, true);
  assert.equal(s.showEdges, true);
  assert.equal(s.showVertices, true);
  assert.equal(s.wireframe, false);
  assert.equal(s.paintTarget, "face");
  assert.deepEqual(s.brush, [240, 176, 64]);
  assert.equal(s.faceColors.size, 0);
});

test("createPaintState: overrides apply", () => {
  const s = createPaintState({ showFaces: false, wireframe: true, paintTarget: "vertex", brush: [10, 20, 30] });
  assert.equal(s.showFaces, false);
  assert.equal(s.wireframe, true);
  assert.equal(s.paintTarget, "vertex");
  assert.deepEqual(s.brush, [10, 20, 30]);
});

test("setBrush: clamps + rounds to byte range", () => {
  const s = createPaintState();
  setBrush(s, [300, -5, 127.6]);
  assert.deepEqual(s.brush, [255, 0, 128]);
});

test("setPaintTarget: only accepts face/vertex/edge", () => {
  const s = createPaintState();
  setPaintTarget(s, "edge"); assert.equal(s.paintTarget, "edge");
  setPaintTarget(s, "bogus"); assert.equal(s.paintTarget, "edge");   // unchanged
});

test("paintElement: writes to the right map and looks up", () => {
  const s = createPaintState();
  paintElement(s, "face", 3, [1, 2, 3]);
  paintElement(s, "vertex", 7, [4, 5, 6]);
  paintElement(s, "edge", 2, [7, 8, 9]);
  assert.deepEqual(faceColor(s, 3), [1, 2, 3]);
  assert.deepEqual(vertexColor(s, 7), [4, 5, 6]);
  assert.deepEqual(edgeColor(s, 2), [7, 8, 9]);
  assert.equal(faceColor(s, 99), null);   // no override -> null
});

test("paintElement: rejects negative / null indices", () => {
  const s = createPaintState();
  paintElement(s, "face", -1, [1, 2, 3]);
  paintElement(s, "face", null, [1, 2, 3]);
  assert.equal(s.faceColors.size, 0);
});

test("paintAtTarget: paints whatever the target is, with the current brush by default", () => {
  const s = createPaintState({ brush: [11, 22, 33] });
  setPaintTarget(s, "vertex");
  paintAtTarget(s, 5);
  assert.deepEqual(vertexColor(s, 5), [11, 22, 33]);
  // explicit colour overrides the brush
  paintAtTarget(s, 6, [99, 99, 99]);
  assert.deepEqual(vertexColor(s, 6), [99, 99, 99]);
});

test("toggle: flips a boolean flag and returns the new value", () => {
  const s = createPaintState();
  assert.equal(toggle(s, "wireframe"), true);
  assert.equal(s.wireframe, true);
  assert.equal(toggle(s, "showFaces"), false);
  assert.equal(s.showFaces, false);
  assert.equal(toggle(s, "notAFlag"), null);   // unknown flag -> null
  assert.equal(toggle(s, "brush"), null);      // non-boolean -> null
});

test("clearPaint: empties all override maps, keeps toggles + brush", () => {
  const s = createPaintState({ brush: [1, 2, 3] });
  paintElement(s, "face", 1, [9, 9, 9]);
  paintElement(s, "vertex", 2, [8, 8, 8]);
  toggle(s, "wireframe");
  clearPaint(s);
  assert.equal(s.faceColors.size, 0);
  assert.equal(s.vertexColors.size, 0);
  assert.equal(s.edgeColors.size, 0);
  assert.equal(s.wireframe, true);    // toggle preserved
  assert.deepEqual(s.brush, [1, 2, 3]);
});

test("snapshot: deterministic, index-sorted dump", () => {
  const s = createPaintState();
  paintElement(s, "face", 5, [1, 1, 1]);
  paintElement(s, "face", 2, [2, 2, 2]);
  const snap = snapshot(s);
  assert.deepEqual(snap.faces, [[2, [2, 2, 2]], [5, [1, 1, 1]]]);   // sorted by index
  assert.equal(snap.paintTarget, "face");
  assert.deepEqual(snap.brush, s.brush);
  // snapshot brush is a copy, not a reference
  snap.brush[0] = 0;
  assert.notEqual(s.brush[0], 0);
});
