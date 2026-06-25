// pick.mjs - pure picking math for the nD/3D geometry (ray-vs-triangle, screen-space vertex/edge).
//
// Two picking regimes:
//   - rayTriangle (Moller-Trumbore): a 3D ray vs a world-space triangle -> hit distance t.
//     Used to pick a FACE under the cursor (nearest front-facing hit wins).
//   - nearestVertex / nearestEdge: screen-space (NDC) proximity, depth tie-break. Used to pick a
//     VERTEX or EDGE under the cursor when face geometry is hidden or the target is vertex/edge.
//
// Pure: no DOM, no randomness. ASCII only (no em-dashes).

import { cross, dot3 } from "./embed3d.mjs";

// Build a world-space ray from the camera eye through an NDC point (ndcX, ndcY in [-1,1], y up).
// Inverse of projectPerspective: a pixel maps to a direction in view space (x*aspect/focal, y/focal, 1),
// rotated into world space by the camera basis. Returns { origin, dir } with dir normalized.
export function screenRay(cam, ndcX, ndcY, opts = {}) {
  const focal = opts.focal == null ? 2.0 : opts.focal;
  const aspect = opts.aspect == null ? 1.0 : opts.aspect;
  // View-space direction (camera looks down +fwd; near plane at vz>0).
  const vx = (ndcX * aspect) / focal;
  const vy = ndcY / focal;
  const vz = 1.0;
  // World direction = vx*right + vy*up + vz*fwd.
  const dir = [
    vx * cam.right[0] + vy * cam.up[0] + vz * cam.fwd[0],
    vx * cam.right[1] + vy * cam.up[1] + vz * cam.fwd[1],
    vx * cam.right[2] + vy * cam.up[2] + vz * cam.fwd[2],
  ];
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  return { origin: cam.eye.slice(), dir: [dir[0] / len, dir[1] / len, dir[2] / len] };
}

// Moller-Trumbore ray/triangle intersection. Returns t > 0 (distance along dir) on hit, else null.
// Double-sided (we render both faces of a closed polytope's surface from inside and out).
export function rayTriangle(origin, dir, a, b, c, eps = 1e-7) {
  const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  const pvec = cross(dir, e2);
  const det = dot3(e1, pvec);
  if (Math.abs(det) < eps) return null;            // ray parallel to triangle
  const inv = 1 / det;
  const tvec = [origin[0] - a[0], origin[1] - a[1], origin[2] - a[2]];
  const u = dot3(tvec, pvec) * inv;
  if (u < -1e-6 || u > 1 + 1e-6) return null;
  const qvec = cross(tvec, e1);
  const v = dot3(dir, qvec) * inv;
  if (v < -1e-6 || u + v > 1 + 1e-6) return null;
  const t = dot3(e2, qvec) * inv;
  return t > eps ? t : null;
}

// Pick the nearest face: iterate triangles (each an index triple into worldVerts), keep the
// smallest positive t. Returns { faceIndex, t } or null. worldVerts: array of [x,y,z].
export function pickFace(origin, dir, faces, worldVerts) {
  let bestT = Infinity, bestI = -1;
  for (let i = 0; i < faces.length; i++) {
    const f = faces[i];
    const a = worldVerts[f[0]], b = worldVerts[f[1]], c = worldVerts[f[2]];
    if (!a || !b || !c) continue;
    const t = rayTriangle(origin, dir, a, b, c);
    if (t != null && t < bestT) { bestT = t; bestI = i; }
  }
  return bestI >= 0 ? { faceIndex: bestI, t: bestT } : null;
}

// Pick the nearest vertex in screen space. projected: array of { x, y, depth, behind } in NDC
// (from projectPerspective). cursor (cx, cy) is NDC. radius is the NDC hit tolerance. On ties of
// proximity it prefers the nearer (smaller depth) vertex. Returns { vertexIndex, dist } or null.
export function nearestVertex(projected, cx, cy, radius = 0.06) {
  let bestI = -1, bestScore = Infinity;
  const r2 = radius * radius;
  for (let i = 0; i < projected.length; i++) {
    const p = projected[i];
    if (!p || p.behind) continue;
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 > r2) continue;
    // score blends screen distance with depth so the nearest-to-cursor, nearest-to-camera wins.
    const score = d2 + (p.depth || 0) * 1e-4;
    if (score < bestScore) { bestScore = score; bestI = i; }
  }
  return bestI >= 0 ? { vertexIndex: bestI, dist: Math.sqrt(bestScore) } : null;
}

// Distance from point P to segment AB in 2D (NDC). Helper for edge picking.
function segDist2(px, py, ax, ay, bx, by) {
  const vx = bx - ax, vy = by - ay;
  const wx = px - ax, wy = py - ay;
  const vv = vx * vx + vy * vy;
  let t = vv > 1e-12 ? (wx * vx + wy * vy) / vv : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = px - (ax + t * vx), dy = py - (ay + t * vy);
  return dx * dx + dy * dy;
}

// Pick the nearest edge in screen space. edges: array of [i, j] vertex index pairs. projected: as
// above. Returns { edgeIndex, dist } or null. Skips edges with an endpoint behind the camera.
export function nearestEdge(projected, edges, cx, cy, radius = 0.04) {
  let bestI = -1, bestD2 = radius * radius;
  for (let e = 0; e < edges.length; e++) {
    const a = projected[edges[e][0]], b = projected[edges[e][1]];
    if (!a || !b || a.behind || b.behind) continue;
    const d2 = segDist2(cx, cy, a.x, a.y, b.x, b.y);
    if (d2 <= bestD2) { bestD2 = d2; bestI = e; }
  }
  return bestI >= 0 ? { edgeIndex: bestI, dist: Math.sqrt(bestD2) } : null;
}

export const _segDist2 = segDist2;
