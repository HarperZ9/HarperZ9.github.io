import { test } from "node:test";
import assert from "node:assert/strict";
import { heightmapToSTL, stlTriangleCount, boundaryLoop } from "./relief-stl.js";

function readTris(buf) {
  const dv = new DataView(buf);
  const n = dv.getUint32(80, true);
  const tris = [];
  for (let t = 0; t < n; t++) {
    const off = 84 + 50 * t;
    const f = [];
    for (let k = 0; k < 12; k++) f.push(dv.getFloat32(off + 4 * k, true));
    tris.push({
      n: f.slice(0, 3),
      v: [f.slice(3, 6), f.slice(6, 9), f.slice(9, 12)],
      attr: dv.getUint16(off + 48, true),
    });
  }
  return tris;
}

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

test("byte layout: size, count field, header, attribute bytes", () => {
  const w = 5, h = 4;
  const heights = new Float32Array(w * h).fill(0.5);
  const buf = heightmapToSTL(heights, w, h);
  const n = stlTriangleCount(w, h);
  assert.equal(n, 2 * 4 * 3 + 6 * (4 + 3));
  assert.equal(buf.byteLength, 84 + 50 * n);
  const dv = new DataView(buf);
  assert.equal(dv.getUint32(80, true), n);
  const head = String.fromCharCode(...new Uint8Array(buf, 0, 5));
  assert.notEqual(head, "solid");
  for (const t of readTris(buf)) assert.equal(t.attr, 0);
});

test("flat heightmap: top facet normals point +Z", () => {
  const w = 6, h = 5;
  const buf = heightmapToSTL(new Float32Array(w * h).fill(0.5), w, h);
  const tris = readTris(buf);
  const topCount = 2 * (w - 1) * (h - 1);
  for (const idx of [0, 1, Math.floor(topCount / 2), topCount - 1]) {
    const [nx, ny, nz] = tris[idx].n;
    assert.ok(Math.abs(nx) < 1e-6 && Math.abs(ny) < 1e-6);
    assert.ok(Math.abs(nz - 1) < 1e-6);
  }
});

test("random map: no NaN floats, positive octant", () => {
  const w = 7, h = 6;
  const rnd = lcg(42);
  const heights = Float32Array.from({ length: w * h }, rnd);
  const buf = heightmapToSTL(heights, w, h, { widthMM: 80, baseMM: 1 });
  for (const t of readTris(buf)) {
    for (const c of [...t.n, ...t.v.flat()]) assert.ok(!Number.isNaN(c));
    for (const [x, y, z] of t.v) assert.ok(x >= 0 && y >= 0 && z >= 0);
  }
});

test("invert convention: bright is thin, dark is thick", () => {
  const w = 3, h = 3;
  const bright = heightmapToSTL(new Float32Array(w * h).fill(1), w, h);
  const dark = heightmapToSTL(new Float32Array(w * h).fill(0), w, h);
  const topZ = (buf) => Math.max(...readTris(buf).flatMap((t) => t.v.map((v) => v[2])));
  assert.ok(Math.abs(topZ(bright) - 0.8) < 1e-5);
  assert.ok(Math.abs(topZ(dark) - 3.0) < 1e-5);
  const relief = heightmapToSTL(new Float32Array(w * h).fill(1), w, h, { invert: false });
  assert.ok(Math.abs(topZ(relief) - 3.0) < 1e-5);
});

test("watertight: every edge shared by exactly two facets, Euler V-E+F=2", () => {
  const w = 4, h = 3;
  const rnd = lcg(7);
  const heights = Float32Array.from({ length: w * h }, rnd);
  const tris = readTris(heightmapToSTL(heights, w, h));
  const verts = new Set();
  const edges = new Map();
  for (const t of tris) {
    const keys = t.v.map((v) => v.join(","));
    keys.forEach((k) => verts.add(k));
    for (let k = 0; k < 3; k++) {
      const e = [keys[k], keys[(k + 1) % 3]].sort().join("|");
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  }
  for (const count of edges.values()) assert.equal(count, 2);
  assert.equal(verts.size - edges.size + tris.length, 2);
});

test("boundary loop covers the perimeter once, counterclockwise", () => {
  const loop = boundaryLoop(4, 3);
  assert.equal(loop.length, 2 * (3 + 2));
  const seen = new Set(loop.map(([i, j]) => `${i},${j}`));
  assert.equal(seen.size, loop.length);
  assert.deepEqual(loop[0], [0, 2]);
});
