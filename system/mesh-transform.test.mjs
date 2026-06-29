import { test } from "node:test";
import assert from "node:assert/strict";

import { cloneMesh, meshBounds, meshStats, normalizeMesh, transformMesh } from "./mesh-transform.js";

const TRI = {
  vertices: [[0, 0, 0], [2, 0, 0], [0, 4, 0]],
  faces: [[0, 1, 2]],
};

test("cloneMesh preserves topology without aliasing source arrays", () => {
  const c = cloneMesh(TRI);
  assert.deepEqual(c.faces, TRI.faces);
  c.vertices[0][0] = 99;
  assert.equal(TRI.vertices[0][0], 0);
});

test("meshBounds reports center, size, and radius", () => {
  const b = meshBounds(TRI);
  assert.deepEqual(b.center, [1, 2, 0]);
  assert.deepEqual(b.size, [2, 4, 0]);
  assert.equal(Number(b.radius.toFixed(6)), Number(Math.sqrt(5).toFixed(6)));
});

test("normalizeMesh centers mesh and scales it into a unit radius", () => {
  const n = normalizeMesh(TRI);
  const b = meshBounds(n);
  assert.ok(Math.abs(b.center[0]) < 1e-12);
  assert.ok(Math.abs(b.center[1]) < 1e-12);
  assert.ok(Math.abs(b.radius - 1) < 1e-12);
});

test("transformMesh applies scale, rotation, and translation while preserving faces", () => {
  const out = transformMesh(TRI, { scale: 2, rotateZ: 90, translateX: 1, translateY: -1 });
  assert.deepEqual(out.faces, TRI.faces);
  assert.ok(Math.abs(out.vertices[1][0] - 1) < 1e-9);
  assert.ok(Math.abs(out.vertices[1][1] - 3) < 1e-9);
  const stats = meshStats(out);
  assert.equal(stats.vertices, 3);
  assert.equal(stats.faces, 1);
});
