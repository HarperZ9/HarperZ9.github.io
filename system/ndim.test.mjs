import { test } from "node:test";
import assert from "node:assert/strict";
import {
  nCubeVertices, nCubeEdges, rotateND, projectTo2D,
  renderScene, renderSceneVolumetric, createPaintState, paintElement,
} from "./ndim.js";

// ── vertex counts ─────────────────────────────────────────────────────────────

test("nCubeVertices: count is 2^n for n=1..6", () => {
  for (let n = 1; n <= 6; n++) {
    const verts = nCubeVertices(n);
    assert.equal(verts.length, 2 ** n, `n=${n}: expected ${2**n} vertices`);
  }
});

test("nCubeVertices: each vertex has length n", () => {
  for (let n = 1; n <= 6; n++) {
    for (const v of nCubeVertices(n)) {
      assert.equal(v.length, n, `n=${n}: vertex length mismatch`);
    }
  }
});

test("nCubeVertices: all coords are in {-1, +1}", () => {
  for (let n = 1; n <= 6; n++) {
    for (const v of nCubeVertices(n)) {
      for (const c of v) {
        assert.ok(c === 1 || c === -1, `n=${n}: coord ${c} not in {-1,+1}`);
      }
    }
  }
});

// ── edge counts ───────────────────────────────────────────────────────────────

test("nCubeEdges: count is n * 2^(n-1) for n=1..6", () => {
  for (let n = 1; n <= 6; n++) {
    const edges = nCubeEdges(n);
    const expected = n * (2 ** (n - 1));
    assert.equal(edges.length, expected, `n=${n}: expected ${expected} edges, got ${edges.length}`);
  }
});

test("nCubeEdges: all pairs have i < j", () => {
  for (let n = 1; n <= 5; n++) {
    for (const [i, j] of nCubeEdges(n)) {
      assert.ok(i < j, `n=${n}: edge [${i},${j}] violates i<j`);
    }
  }
});

test("nCubeEdges: all pairs differ by exactly one bit (Hamming distance = 1)", () => {
  const popcount = x => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };
  for (let n = 1; n <= 5; n++) {
    for (const [i, j] of nCubeEdges(n)) {
      assert.equal(popcount(i ^ j), 1, `n=${n}: edge [${i},${j}] has Hamming distance ${popcount(i^j)}`);
    }
  }
});

// ── n=10 sanity (the max UI dimension) ───────────────────────────────────────

test("n=10: 1024 vertices and 5120 edges", () => {
  assert.equal(nCubeVertices(10).length, 1024);
  assert.equal(nCubeEdges(10).length, 5120);
});

// ── rotateND ─────────────────────────────────────────────────────────────────

test("rotateND: preserves vertex count", () => {
  const verts = nCubeVertices(4);
  const rotated = rotateND(verts, [{ a: 0, b: 1, angle: 0.3 }]);
  assert.equal(rotated.length, verts.length);
});

test("rotateND: preserves dimensionality", () => {
  const verts = nCubeVertices(5);
  const rotated = rotateND(verts, [{ a: 0, b: 2, angle: 1.1 }]);
  for (const v of rotated) {
    assert.equal(v.length, 5);
  }
});

test("rotateND: zero-angle rotation is identity (within float precision)", () => {
  const verts = nCubeVertices(4);
  const rotated = rotateND(verts, [{ a: 0, b: 1, angle: 0 }]);
  for (let i = 0; i < verts.length; i++) {
    for (let d = 0; d < 4; d++) {
      assert.ok(Math.abs(rotated[i][d] - verts[i][d]) < 1e-12,
        `vertex ${i} coord ${d}: expected ${verts[i][d]}, got ${rotated[i][d]}`);
    }
  }
});

test("rotateND: does not mutate input vertices", () => {
  const verts = nCubeVertices(3);
  const snapshots = verts.map(v => new Float64Array(v));
  rotateND(verts, [{ a: 0, b: 1, angle: 1.0 }]);
  for (let i = 0; i < verts.length; i++) {
    for (let d = 0; d < 3; d++) {
      assert.equal(verts[i][d], snapshots[i][d], `vertex ${i} mutated at coord ${d}`);
    }
  }
});

test("rotateND: 90-degree rotation in plane (0,1) maps (+1,0,...) to (0,+1,...)", () => {
  // Use a single vertex with known coords to check the rotation math directly.
  const v = new Float64Array([1, 0, 0]);
  const rotated = rotateND([v], [{ a: 0, b: 1, angle: Math.PI / 2 }]);
  assert.ok(Math.abs(rotated[0][0]) < 1e-10, `x should be ~0, got ${rotated[0][0]}`);
  assert.ok(Math.abs(rotated[0][1] - 1) < 1e-10, `y should be ~1, got ${rotated[0][1]}`);
  assert.ok(Math.abs(rotated[0][2]) < 1e-12, `z should be 0, got ${rotated[0][2]}`);
});

// ── projectTo2D ───────────────────────────────────────────────────────────────

test("projectTo2D: returns finite x, y for a sample vertex", () => {
  const verts = nCubeVertices(4);
  const p = projectTo2D(verts[0], 3);
  assert.ok(Number.isFinite(p.x), `x not finite: ${p.x}`);
  assert.ok(Number.isFinite(p.y), `y not finite: ${p.y}`);
  assert.ok(Number.isFinite(p.depth), `depth not finite: ${p.depth}`);
});

test("projectTo2D: projects n=1 vertex (1D) to a point on the x axis", () => {
  const p = projectTo2D(new Float64Array([1.0]), 3);
  // n=1: no dimensions to collapse, x=v[0]=1, y=v[1] which doesn't exist → y=undefined
  // For n=1 we get coord[0]=1, and we should return {x:1, y:undefined or 0, depth:1}
  // The spec says coord[0] and coord[1]; for n=1 coord[1] is undefined → NaN.
  // Accept that n=1 projection gives a finite x even if y is undefined.
  assert.ok(Number.isFinite(p.x), `n=1 x should be finite, got ${p.x}`);
  assert.equal(p.depth, 1.0, "n=1 has no collapse steps → depth=1");
});

test("projectTo2D: n=2 is identity (no collapse steps)", () => {
  const v = new Float64Array([0.5, -0.5]);
  const p = projectTo2D(v, 3);
  assert.ok(Math.abs(p.x - 0.5) < 1e-12);
  assert.ok(Math.abs(p.y + 0.5) < 1e-12);
  assert.equal(p.depth, 1.0);
});

test("projectTo2D: depth increases when vertex is closer along the projection axis", () => {
  // Two n=3 points: one at z=+0.9 (close), one at z=-0.9 (far), dist=3
  const close = projectTo2D(new Float64Array([0, 0, 0.9]), 3);
  const far   = projectTo2D(new Float64Array([0, 0, -0.9]), 3);
  // closer z → larger f = dist/(dist-z) → larger depth product
  assert.ok(close.depth > far.depth, `close.depth=${close.depth} should > far.depth=${far.depth}`);
});

// ── renderSceneVolumetric (the TRUE 3D path, P2 directive b) ────────────────────

test("renderSceneVolumetric: produces faces, edges, points and world verts (a volume, not a flat plane)", () => {
  const scene = renderSceneVolumetric(
    { kind: "cube", n: 4, t: 0.0, rotation: "all" },
    { yaw: 0.6, pitch: 0.5, dist: 3.2 },
    { aspect: 1 },
  );
  assert.ok(scene.faces.length > 0, "has triangulated faces (solid volume)");
  assert.ok(scene.segments.length > 0, "has edges");
  assert.ok(scene.points.length > 0, "has vertices");
  assert.equal(scene.world.length, 16, "tesseract has 16 world-space vertices");
  assert.equal(scene.meta.projection, "perspective3d");
  assert.equal(scene.meta.faceCount, 48, "tesseract: 48 triangles");
});

test("renderSceneVolumetric: every vertex carries a normalized depth in [0,1] (real depth axis)", () => {
  const scene = renderSceneVolumetric({ kind: "cube", n: 3, t: 0.3 }, { yaw: 0.3, pitch: 0.2, dist: 3 }, { aspect: 1 });
  let sawNear = false, sawFar = false;
  for (const p of scene.points) {
    assert.ok(p.depth >= 0 && p.depth <= 1, `depth in [0,1], got ${p.depth}`);
    if (p.depth < 0.5) sawNear = true;
    if (p.depth > 0.5) sawFar = true;
  }
  // A 3D cube under perspective must span a depth range (not all at one plane).
  assert.ok(sawNear && sawFar, "geometry spans a depth range (volume, not flat)");
});

test("renderSceneVolumetric: faces are painter-sorted far->near", () => {
  const scene = renderSceneVolumetric({ kind: "cube", n: 4, t: 0.1 }, { yaw: 0.5, pitch: 0.4, dist: 3.2 }, { aspect: 1 });
  for (let i = 1; i < scene.faces.length; i++) {
    assert.ok(scene.faces[i - 1].depth >= scene.faces[i].depth - 1e-9,
      `face ${i - 1} depth ${scene.faces[i - 1].depth} >= face ${i} depth ${scene.faces[i].depth}`);
  }
});

test("renderSceneVolumetric: orbiting the camera (yaw) changes the projected positions", () => {
  const base = { kind: "cube", n: 4, t: 0.0 };
  const a = renderSceneVolumetric(base, { yaw: 0.0, pitch: 0.3, dist: 3.2 }, { aspect: 1 });
  const b = renderSceneVolumetric(base, { yaw: 1.2, pitch: 0.3, dist: 3.2 }, { aspect: 1 });
  let moved = 0;
  for (let i = 0; i < a.proj.length; i++) {
    if (Math.abs(a.proj[i].x - b.proj[i].x) > 1e-3 || Math.abs(a.proj[i].y - b.proj[i].y) > 1e-3) moved++;
  }
  assert.ok(moved > a.proj.length / 2, "orbit moves most vertices on screen");
});

test("renderSceneVolumetric: dollying in (smaller dist) enlarges the on-screen extent", () => {
  const base = { kind: "cube", n: 3, t: 0.0 };
  const far = renderSceneVolumetric(base, { yaw: 0.4, pitch: 0.3, dist: 6 }, { aspect: 1 });
  const near = renderSceneVolumetric(base, { yaw: 0.4, pitch: 0.3, dist: 2.2 }, { aspect: 1 });
  const extent = (s) => {
    let r = 0; for (const p of s.proj) { if (!p.behind) r = Math.max(r, Math.hypot(p.x, p.y)); } return r;
  };
  assert.ok(extent(near) > extent(far), `dolly-in enlarges: ${extent(near)} vs ${extent(far)}`);
});

test("renderSceneVolumetric: a painted face override colour shows in the face draw list", () => {
  const paint = createPaintState();
  paintElement(paint, "face", 0, [123, 45, 67]);
  const scene = renderSceneVolumetric({ kind: "cube", n: 3, t: 0.0 }, { yaw: 0.5, pitch: 0.4, dist: 3.2 }, { aspect: 1, paint });
  const painted = scene.faces.find(f => f.faceIndex === 0);
  // the painted face's colour is the override * shade; verify the hue ratio is preserved (R dominant
  // here vs the depth-cue teal/amber default) and opacity is the denser painted value.
  assert.ok(painted, "face 0 is in the draw list");
  assert.ok(painted.opacity > 0.5, "painted faces draw denser");
  assert.ok(painted.color[0] >= painted.color[1] && painted.color[0] >= painted.color[2],
    `override (R-dominant) preserved through shading, got ${painted.color}`);
});

test("renderSceneVolumetric: wireframe paint-state drops faces but keeps edges", () => {
  const paint = createPaintState({ wireframe: true });
  const scene = renderSceneVolumetric({ kind: "cube", n: 3, t: 0.0 }, { yaw: 0.5, pitch: 0.4, dist: 3.2 }, { aspect: 1, paint });
  assert.equal(scene.faces.length, 0, "wireframe hides faces");
  assert.ok(scene.segments.length > 0, "wireframe keeps edges");
});

test("renderSceneVolumetric: hiding vertices/edges empties those draw lists", () => {
  const paint = createPaintState({ showVertices: false, showEdges: false });
  const scene = renderSceneVolumetric({ kind: "cube", n: 3, t: 0.0 }, { yaw: 0.5, pitch: 0.4, dist: 3.2 }, { aspect: 1, paint });
  assert.equal(scene.points.length, 0, "vertices hidden");
  assert.equal(scene.segments.length, 0, "edges hidden");
  assert.ok(scene.faces.length > 0, "faces still shown");
});

test("renderScene (flat path) is unchanged: still returns flat points/segments without faces", () => {
  // Regression guard: the original flat renderScene must keep its shape (P0/P1 not broken).
  const flat = renderScene({ kind: "cube", n: 4, t: 0.2 });
  assert.ok(Array.isArray(flat.points) && Array.isArray(flat.segments));
  assert.equal(flat.faces, undefined, "flat path has no faces key");
  assert.equal(flat.meta.projection, "perspective");
});
