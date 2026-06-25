// faces.test.mjs - node:test for the polytope 2-face (triangulated) generators.
// Run: node --test system/lib/render-nd/core/faces.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { nCubeFaces, nSimplexFaces, nOrthoplexFaces, cell24Faces, polytopeFaces } from "./faces.mjs";
import { nCubeVertices, cell24Vertices } from "./polytopes.mjs";

// Count helpers (the closed-form 2-face counts).
function binom(n, k) { let r = 1; for (let i = 0; i < k; i++) r = r * (n - i) / (i + 1); return Math.round(r); }

// ── n-cube faces ──────────────────────────────────────────────────────────────
// An n-cube has C(n,2) * 2^(n-2) square 2-faces, each triangulated into 2 triangles.
test("nCubeFaces: triangle count = 2 * C(n,2) * 2^(n-2) for n=2..5", () => {
  for (let n = 2; n <= 5; n++) {
    const squares = binom(n, 2) * (2 ** (n - 2));
    assert.equal(nCubeFaces(n).length, 2 * squares, `n=${n}: expected ${2 * squares} tris`);
  }
});

test("nCubeFaces: n=3 cube has 6 squares = 12 triangles", () => {
  assert.equal(nCubeFaces(3).length, 12);
});

test("nCubeFaces: n=4 tesseract has 24 squares = 48 triangles", () => {
  assert.equal(nCubeFaces(4).length, 48);
});

test("nCubeFaces: every face index is a valid vertex index (0 .. 2^n-1)", () => {
  for (let n = 2; n <= 5; n++) {
    const max = 2 ** n;
    for (const f of nCubeFaces(n)) {
      assert.equal(f.length, 3, `n=${n}: face is a triangle`);
      for (const idx of f) assert.ok(idx >= 0 && idx < max, `n=${n}: index ${idx} in range`);
    }
  }
});

test("nCubeFaces: each triangle has three distinct vertices", () => {
  for (let n = 2; n <= 5; n++) {
    for (const [a, b, c] of nCubeFaces(n)) {
      assert.ok(a !== b && b !== c && a !== c, `n=${n}: degenerate triangle [${a},${b},${c}]`);
    }
  }
});

test("nCubeFaces: n<2 has no faces", () => {
  assert.deepEqual(nCubeFaces(1), []);
  assert.deepEqual(nCubeFaces(0), []);
});

// ── n-simplex faces: C(n+1, 3) triangles ───────────────────────────────────────
test("nSimplexFaces: count = C(n+1, 3)", () => {
  for (let n = 2; n <= 6; n++) {
    assert.equal(nSimplexFaces(n).length, binom(n + 1, 3), `n=${n}`);
  }
});

test("nSimplexFaces: n=3 tetrahedron has 4 triangular faces", () => {
  assert.equal(nSimplexFaces(3).length, 4);
});

test("nSimplexFaces: indices valid, vertices distinct, ascending", () => {
  for (let n = 2; n <= 6; n++) {
    const m = n + 1;
    for (const [a, b, c] of nSimplexFaces(n)) {
      assert.ok(a < b && b < c, `ascending [${a},${b},${c}]`);
      assert.ok(c < m, `index ${c} < ${m}`);
    }
  }
});

// ── n-orthoplex faces: 2^3 * C(n,3) triangles (choose 3 axes, a sign each) ──────
test("nOrthoplexFaces: count = 8 * C(n,3)", () => {
  for (let n = 3; n <= 6; n++) {
    assert.equal(nOrthoplexFaces(n).length, 8 * binom(n, 3), `n=${n}`);
  }
});

test("nOrthoplexFaces: n=3 octahedron has 8 faces", () => {
  assert.equal(nOrthoplexFaces(3).length, 8);
});

test("nOrthoplexFaces: no triangle uses two antipodal vertices (same axis)", () => {
  for (let n = 3; n <= 6; n++) {
    for (const [a, b, c] of nOrthoplexFaces(n)) {
      const ax = a >> 1, bx = b >> 1, cx = c >> 1;
      assert.ok(ax !== bx && bx !== cx && ax !== cx, `n=${n}: shares an axis [${a},${b},${c}]`);
    }
  }
});

test("nOrthoplexFaces: n<2 has no faces", () => {
  assert.deepEqual(nOrthoplexFaces(1), []);
});

// ── 24-cell faces ───────────────────────────────────────────────────────────
test("cell24Faces: the 24-cell has 96 triangular faces", () => {
  // The regular 24-cell has 96 triangular 2-faces.
  const V = cell24Vertices();
  assert.equal(cell24Faces(V).length, 96);
});

test("cell24Faces: every triangle's pairwise squared distance equals the edge length 2", () => {
  const V = cell24Vertices();
  for (const [a, b, c] of cell24Faces(V)) {
    for (const [i, j] of [[a, b], [b, c], [a, c]]) {
      let d2 = 0; for (let k = 0; k < 4; k++) { const d = V[i][k] - V[j][k]; d2 += d * d; }
      assert.ok(Math.abs(d2 - 2) < 1e-9, `edge [${i},${j}] d2=${d2}`);
    }
  }
});

// ── dispatch ──────────────────────────────────────────────────────────────────
test("polytopeFaces: dispatches by kind", () => {
  assert.equal(polytopeFaces("cube", 3).length, 12);
  assert.equal(polytopeFaces("simplex", 3).length, 4);
  assert.equal(polytopeFaces("orthoplex", 3).length, 8);
  assert.equal(polytopeFaces("24cell", 4, cell24Vertices()).length, 96);
  assert.deepEqual(polytopeFaces("unknown", 4), []);
});
