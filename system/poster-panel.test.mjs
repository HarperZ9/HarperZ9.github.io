import test from "node:test";
import assert from "node:assert/strict";
import { applyPosterBlockPosition } from "./poster-panel.js";

test("applyPosterBlockPosition writes normalized free position without changing the legacy cell", () => {
  const block = { kind: "headline", cell: "middle-left" };
  const box = { x0: 0.2, y0: 0.3, x1: 0.45, y1: 0.42 };

  const moved = applyPosterBlockPosition(block, box, { x: 0.55, y: 0.68 }, { x: 0.08, y: 0.04 });

  assert.equal(moved, true);
  assert.deepEqual(block.position, { x: 0.47, y: 0.64 });
  assert.equal(block.cell, "middle-left");
});

test("applyPosterBlockPosition clamps movement by the measured box size", () => {
  const block = { kind: "standfirst", cell: "bottom-left" };
  const box = { x0: 0.2, y0: 0.3, x1: 0.45, y1: 0.42 };

  const moved = applyPosterBlockPosition(block, box, { x: 0.98, y: 0.98 }, { x: 0, y: 0 });

  assert.equal(moved, true);
  assert.deepEqual(block.position, { x: 0.75, y: 0.88 });
});

test("applyPosterBlockPosition refuses non-finite pointer input", () => {
  const block = { kind: "folio", cell: "top-left" };
  const box = { x0: 0.1, y0: 0.1, x1: 0.2, y1: 0.2 };

  const moved = applyPosterBlockPosition(block, box, { x: Number.NaN, y: 0.5 }, { x: 0, y: 0 });

  assert.equal(moved, false);
  assert.equal(block.position, undefined);
});
