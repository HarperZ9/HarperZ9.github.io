// pick.test.mjs - node:test for the picking math (ray/triangle, screen-space vertex/edge, ray round-trip).
// Run: node --test system/lib/render-nd/core/pick.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { screenRay, rayTriangle, pickFace, nearestVertex, nearestEdge } from "./pick.mjs";
import { orbitCamera, projectPerspective } from "./embed3d.mjs";

// ── rayTriangle (Moller-Trumbore) ──────────────────────────────────────────────
test("rayTriangle: a ray down -z hits a triangle in the z=0 plane", () => {
  const a = [-1, -1, 0], b = [1, -1, 0], c = [0, 1, 0];
  const t = rayTriangle([0, 0, 5], [0, 0, -1], a, b, c);
  assert.ok(t != null, "should hit");
  assert.ok(Math.abs(t - 5) < 1e-6, `t ~ 5, got ${t}`);
});

test("rayTriangle: a ray missing the triangle returns null", () => {
  const a = [-1, -1, 0], b = [1, -1, 0], c = [0, 1, 0];
  const t = rayTriangle([5, 5, 5], [0, 0, -1], a, b, c);   // far off to the side
  assert.equal(t, null);
});

test("rayTriangle: a ray parallel to the triangle returns null", () => {
  const a = [-1, -1, 0], b = [1, -1, 0], c = [0, 1, 0];
  const t = rayTriangle([0, 0, 5], [1, 0, 0], a, b, c);   // parallel to z=0 plane
  assert.equal(t, null);
});

test("rayTriangle: hit behind the origin (t<0) returns null", () => {
  const a = [-1, -1, 0], b = [1, -1, 0], c = [0, 1, 0];
  const t = rayTriangle([0, 0, 5], [0, 0, 1], a, b, c);   // pointing away from the triangle
  assert.equal(t, null);
});

test("rayTriangle: double-sided (hits from behind the face too)", () => {
  const a = [-1, -1, 0], b = [1, -1, 0], c = [0, 1, 0];
  const t = rayTriangle([0, 0, -5], [0, 0, 1], a, b, c);  // approach from -z side
  assert.ok(t != null && Math.abs(t - 5) < 1e-6, `t ~ 5, got ${t}`);
});

// ── pickFace ────────────────────────────────────────────────────────────────
test("pickFace: returns the nearest of two stacked triangles", () => {
  const verts = [
    [-1, -1, 0], [1, -1, 0], [0, 1, 0],     // tri 0 at z=0
    [-1, -1, 2], [1, -1, 2], [0, 1, 2],     // tri 1 at z=2 (nearer the eye at z=5)
  ];
  const faces = [[0, 1, 2], [3, 4, 5]];
  const hit = pickFace([0, 0, 5], [0, 0, -1], faces, verts);
  assert.ok(hit, "should hit");
  assert.equal(hit.faceIndex, 1, "nearer triangle (z=2) wins");
  assert.ok(Math.abs(hit.t - 3) < 1e-6, `t ~ 3, got ${hit.t}`);
});

test("pickFace: no triangle under the ray -> null", () => {
  const verts = [[-1, -1, 0], [1, -1, 0], [0, 1, 0]];
  const hit = pickFace([9, 9, 5], [0, 0, -1], [[0, 1, 2]], verts);
  assert.equal(hit, null);
});

// ── screenRay round-trip with projectPerspective ───────────────────────────────
test("screenRay: ray through a vertex's NDC actually points back at that vertex", () => {
  const cam = orbitCamera({ yaw: 0.6, pitch: 0.4, dist: 4 });
  const aspect = 1.5;
  const world = [0.3, -0.2, 0.1];
  const p = projectPerspective(world, cam, { aspect });
  assert.equal(p.behind, false);
  const ray = screenRay(cam, p.x, p.y, { aspect });
  // The world point lies along origin + t*dir for some t>0: check the cross product is ~0.
  const w = [world[0] - ray.origin[0], world[1] - ray.origin[1], world[2] - ray.origin[2]];
  const cx = ray.dir[1] * w[2] - ray.dir[2] * w[1];
  const cy = ray.dir[2] * w[0] - ray.dir[0] * w[2];
  const cz = ray.dir[0] * w[1] - ray.dir[1] * w[0];
  const colinear = Math.hypot(cx, cy, cz);
  assert.ok(colinear < 1e-6, `ray colinear with the vertex, residual ${colinear}`);
});

test("screenRay: a ray cast at a face's centroid NDC hits that face (full round-trip)", () => {
  const cam = orbitCamera({ yaw: 0.5, pitch: 0.3, dist: 4 });
  const aspect = 1;
  // a single triangle in world space, comfortably in front of the camera
  const tri = [[-0.4, -0.3, 0.2], [0.5, -0.2, -0.1], [0.0, 0.5, 0.0]];
  const proj = tri.map((v) => projectPerspective(v, cam, { aspect }));
  // centroid in NDC
  const cx = (proj[0].x + proj[1].x + proj[2].x) / 3;
  const cy = (proj[0].y + proj[1].y + proj[2].y) / 3;
  const ray = screenRay(cam, cx, cy, { aspect });
  const hit = pickFace(ray.origin, ray.dir, [[0, 1, 2]], tri);
  assert.ok(hit, "centroid ray should hit the face");
  assert.equal(hit.faceIndex, 0);
});

// ── nearestVertex ──────────────────────────────────────────────────────────────
test("nearestVertex: picks the closest projected vertex within radius", () => {
  const projected = [
    { x: 0.0, y: 0.0, depth: 0.5, behind: false },
    { x: 0.5, y: 0.5, depth: 0.5, behind: false },
    { x: -0.5, y: -0.5, depth: 0.5, behind: false },
  ];
  const hit = nearestVertex(projected, 0.02, -0.01, 0.1);
  assert.ok(hit, "within radius");
  assert.equal(hit.vertexIndex, 0);
});

test("nearestVertex: nothing within radius -> null", () => {
  const projected = [{ x: 0.9, y: 0.9, depth: 0.5, behind: false }];
  assert.equal(nearestVertex(projected, 0, 0, 0.05), null);
});

test("nearestVertex: skips vertices behind the camera", () => {
  const projected = [
    { x: 0.0, y: 0.0, depth: 0.5, behind: true },
    { x: 0.03, y: 0.0, depth: 0.5, behind: false },
  ];
  const hit = nearestVertex(projected, 0, 0, 0.1);
  assert.equal(hit.vertexIndex, 1, "behind vertex is skipped");
});

test("nearestVertex: ties broken toward the nearer (smaller depth) vertex", () => {
  const projected = [
    { x: 0.01, y: 0, depth: 0.9, behind: false },
    { x: 0.01, y: 0, depth: 0.1, behind: false },   // same screen pos, nearer
  ];
  const hit = nearestVertex(projected, 0, 0, 0.1);
  assert.equal(hit.vertexIndex, 1);
});

// ── nearestEdge ─────────────────────────────────────────────────────────────
test("nearestEdge: picks the edge whose segment passes nearest the cursor", () => {
  const projected = [
    { x: -0.5, y: 0, depth: 0.5, behind: false },
    { x: 0.5, y: 0, depth: 0.5, behind: false },     // edge 0: horizontal through y=0
    { x: 0, y: 0.5, depth: 0.5, behind: false },
    { x: 0, y: -0.5, depth: 0.5, behind: false },    // edge 1: vertical through x=0
  ];
  const edges = [[0, 1], [2, 3]];
  // cursor just above the horizontal edge, far from the vertical's lower half
  const hit = nearestEdge(projected, edges, -0.3, 0.01, 0.1);
  assert.ok(hit, "within radius");
  assert.equal(hit.edgeIndex, 0);
});

test("nearestEdge: an edge with an endpoint behind the camera is skipped", () => {
  const projected = [
    { x: -0.5, y: 0, depth: 0.5, behind: true },
    { x: 0.5, y: 0, depth: 0.5, behind: false },
  ];
  assert.equal(nearestEdge(projected, [[0, 1]], 0, 0, 0.2), null);
});

test("nearestEdge: cursor far from every edge -> null", () => {
  const projected = [
    { x: -0.5, y: 0, depth: 0.5, behind: false },
    { x: 0.5, y: 0, depth: 0.5, behind: false },
  ];
  assert.equal(nearestEdge(projected, [[0, 1]], 0, 0.9, 0.05), null);
});
