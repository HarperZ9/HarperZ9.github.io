// Picking (runtime stage G1, ADR 0014): what is under the pointer. Pure: runs in Node.
//
//   3D  rayAabb, raySphere, rayTriangle, and pickScene over a G0 Scene (web/world/scene.mjs):
//       a node is pickable when its props carry local bounds { min: [x,y,z], max: [x,y,z] }
//       or a triangle list { triangles: [[ax,ay,az, bx,by,bz, cx,cy,cz], ...] }; the ray is
//       taken into the node's local space by the inverse of its world matrix, so scaled and
//       rotated nodes pick exactly. The nearest hit wins.
//   2D  pickItems over { id, rect: [x, y, w, h] } or { id, circle: [cx, cy, r] } in scene units;
//       the last item (drawn on top) wins. Isometric cells: web/world/iso.mjs isoCamera.pick.
//
// A hit is { id, t, point } with t the distance along the ray (in world units when the ray's
// direction is unit length) and point in world space.

import { apply } from "../world/scene.mjs";

const EPS = 1e-12;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

// Slab test. Returns the entry distance (0 when the origin is inside), or null.
export function rayAabb(o, d, min, max) {
  let t0 = 0, t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < EPS) { if (o[i] < min[i] || o[i] > max[i]) return null; continue; }
    let a = (min[i] - o[i]) / d[i], b = (max[i] - o[i]) / d[i];
    if (a > b) [a, b] = [b, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    if (t0 > t1) return null;
  }
  return t0;
}
export function raySphere(o, d, c, r) {
  const oc = sub(o, c), a = dot(d, d), b = dot(oc, d), q = dot(oc, oc) - r * r, disc = b * b - a * q;
  if (disc < 0) return null;
  const s = Math.sqrt(disc), t0 = (-b - s) / a, t1 = (-b + s) / a;
  return t0 >= 0 ? t0 : t1 >= 0 ? t1 : null;
}
// Two-sided ray and triangle intersection by barycentric solve (Cramer's rule on the edge
// vectors). Returns the distance, or null.
export function rayTriangle(o, d, a, b, c) {
  const e1 = sub(b, a), e2 = sub(c, a), p = cross(d, e2), det = dot(e1, p);
  if (Math.abs(det) < EPS) return null;
  const inv = 1 / det, s = sub(o, a), u = dot(s, p) * inv;
  if (u < 0 || u > 1) return null;
  const q = cross(s, e1), v = dot(d, q) * inv;
  if (v < 0 || u + v > 1) return null;
  const t = dot(e2, q) * inv;
  return t >= 0 ? t : null;
}

// Inverse of an affine column-major 4x4 (the scene's world matrices are affine).
export function invertAffine(m) {
  const a = m[0], b = m[4], c = m[8], d = m[1], e = m[5], f = m[9], g = m[2], h = m[6], i = m[10];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  if (Math.abs(det) < EPS) return null;
  const k = 1 / det, o = new Float64Array(16);
  o[0] = A * k; o[4] = -(b * i - c * h) * k; o[8] = (b * f - c * e) * k;
  o[1] = B * k; o[5] = (a * i - c * g) * k; o[9] = -(a * f - c * d) * k;
  o[2] = C * k; o[6] = -(a * h - b * g) * k; o[10] = (a * e - b * d) * k;
  const tx = m[12], ty = m[13], tz = m[14];
  o[12] = -(o[0] * tx + o[4] * ty + o[8] * tz); o[13] = -(o[1] * tx + o[5] * ty + o[9] * tz); o[14] = -(o[2] * tx + o[6] * ty + o[10] * tz);
  o[15] = 1;
  return o;
}
const applyDir = (m, v) => [m[0] * v[0] + m[4] * v[1] + m[8] * v[2], m[1] * v[0] + m[5] * v[1] + m[9] * v[2], m[2] * v[0] + m[6] * v[1] + m[10] * v[2]];

// The nearest pickable node hit by the ray, or null. filter(node) can exclude nodes.
export function pickScene(scene, { origin, dir }, { filter = null } = {}) {
  let best = null;
  for (const node of scene.nodes.values()) {
    const pr = node.props || {};
    if (!pr.bounds && !pr.triangles) continue;
    if (filter && !filter(node)) continue;
    const W = scene.world(node.id), inv = invertAffine(W);
    if (!inv) continue;
    // Local ray with an unnormalised direction: t stays the world parameter.
    const lo = apply(inv, origin), ld = applyDir(inv, dir);
    let t = null;
    if (pr.triangles) for (const tri of pr.triangles) {
      const h = rayTriangle(lo, ld, tri.slice(0, 3), tri.slice(3, 6), tri.slice(6, 9));
      if (h !== null && (t === null || h < t)) t = h;
    } else t = rayAabb(lo, ld, pr.bounds.min, pr.bounds.max);
    if (t !== null && (!best || t < best.t)) best = { id: node.id, t, point: origin.map((v, k) => v + dir[k] * t) };
  }
  return best;
}

// 2D: the topmost item containing the point (scene units), or null.
export function pickItems(items, [x, y]) {
  for (let k = items.length - 1; k >= 0; k--) {
    const it = items[k];
    if (it.rect) { const [rx, ry, w, h] = it.rect; if (x >= rx && x < rx + w && y >= ry && y < ry + h) return it.id; }
    else if (it.circle) { const [cx, cy, r] = it.circle; if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) return it.id; }
  }
  return null;
}
