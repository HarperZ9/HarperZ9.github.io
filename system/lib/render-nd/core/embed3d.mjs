// embed3d.mjs - nD -> 3D embedding + a real 3D camera with perspective projection and depth.
//
// The shipped project.mjs collapses nD straight to a flat 2D plane (x, y, depth-as-scale-product).
// That reads as a flat wireframe. This module instead:
//   1. collapses the nD coordinates down to a 3D embedding (x, y, z), keeping a genuine z axis,
//   2. applies a 3D orbit camera (yaw/pitch around the origin, dolly distance),
//   3. does a true perspective projection to clip space, returning per-vertex normalized device
//      coordinates (ndcX, ndcY in [-1,1]) AND a normalized depth (ndcZ in [0,1], 0 = near).
//
// Everything here is pure: no DOM, no canvas, no Math.random, no Date.now. Node-importable and
// node-testable. ASCII only (no em-dashes).

// ---- (1) nD -> 3D embedding -----------------------------------------------------------------
// Collapse coordinates above index 2 down onto the first three axes with the SAME iterated
// perspective the shipped projectTo2D uses (parity of the nD "look"), but stop at 3 axes instead
// of 2. For n <= 3 this is the identity (pad missing axes with 0). The result is a real 3D point.
//
// vert: a length-n array (Float64Array or plain array). dist: the nD->lower projection distance.
// Returns [x, y, z] (always length 3).
export function embedTo3D(vert, dist = 3.0) {
  const n = vert.length;
  if (n === 0) return [0, 0, 0];
  const coord = new Float64Array(3);
  coord[0] = vert[0] || 0;
  coord[1] = n > 1 ? (vert[1] || 0) : 0;
  coord[2] = n > 2 ? (vert[2] || 0) : 0;
  // Collapse the higher axes (index >= 3) one at a time onto the kept 3, exactly like projectTo2D
  // but with the floor at 3 rather than 2: scale the kept axes by dist/(dist - coord[k]).
  for (let k = n - 1; k >= 3; k--) {
    const ck = vert[k] || 0;
    const denom = dist - ck;
    const f = Math.abs(denom) < 1e-9 ? 1.0 : dist / denom;
    coord[0] *= f;
    coord[1] *= f;
    coord[2] *= f;
  }
  return [coord[0], coord[1], coord[2]];
}

// ---- (2) 3D orbit camera --------------------------------------------------------------------
// A right-handed orbit camera looking at the origin. yaw rotates around the world Y axis, pitch
// lifts the eye, dist is the eye distance (radius). Returns the eye position and an orthonormal
// basis {right, up, fwd} (fwd points from eye toward the origin).
//
// pitch is clamped to avoid gimbal flip at the poles.
export function orbitCamera({ yaw = 0, pitch = 0, dist = 3.2 } = {}) {
  const p = Math.max(-1.45, Math.min(1.45, pitch));
  const cp = Math.cos(p), sp = Math.sin(p);
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  // Eye on a sphere of radius dist around the origin.
  const eye = [dist * cp * sy, dist * sp, dist * cp * cy];
  // Forward = origin - eye, normalized.
  const fwd = normalize([-eye[0], -eye[1], -eye[2]]);
  // Right = normalize(cross(fwd, worldUp)); worldUp = (0,1,0). Guard the near-pole degeneracy.
  let right = cross(fwd, [0, 1, 0]);
  if (lenSq(right) < 1e-9) right = [1, 0, 0];
  right = normalize(right);
  const up = cross(right, fwd);
  return { eye, right, up, fwd };
}

// ---- (3) perspective projection to NDC + depth ----------------------------------------------
// Project a world point through the camera into normalized device coordinates.
//   - View space: v = R^T (p - eye), so vz is the distance along the forward axis (positive = in
//     front of the camera).
//   - Perspective divide by vz with a focal length f (cot(fov/2)); aspect scales x.
//   - Depth: map vz across [near, far] to [0, 1] (0 = near). Clamped, finite-safe.
//
// Returns { x, y, depth, vz, behind }. x, y are NDC (y up). behind = true when the point is at or
// behind the camera plane (vz <= near); such points should be culled by the caller.
export function projectPerspective(p, cam, opts = {}) {
  const focal = opts.focal == null ? 2.0 : opts.focal;     // ~ cot(fov/2); 2.0 ~ 53deg vertical fov
  const aspect = opts.aspect == null ? 1.0 : opts.aspect;  // width / height
  const near = opts.near == null ? 0.05 : opts.near;
  const far = opts.far == null ? 100.0 : opts.far;
  const dx = p[0] - cam.eye[0], dy = p[1] - cam.eye[1], dz = p[2] - cam.eye[2];
  // View-space coordinates via the camera basis (row vectors right/up/fwd).
  const vx = dx * cam.right[0] + dy * cam.right[1] + dz * cam.right[2];
  const vy = dx * cam.up[0] + dy * cam.up[1] + dz * cam.up[2];
  const vz = dx * cam.fwd[0] + dy * cam.fwd[1] + dz * cam.fwd[2];
  const behind = vz <= near;
  const safeVz = behind ? near : vz;
  const x = (focal / aspect) * vx / safeVz;
  const y = focal * vy / safeVz;
  // Normalized linear depth in [0,1] (0 = near plane, 1 = far plane). Linear depth keeps the
  // painter-order sort and the depth-cue shading well-behaved across the small scenes here.
  let depth = (safeVz - near) / (far - near);
  if (!Number.isFinite(depth)) depth = 1;
  depth = depth < 0 ? 0 : depth > 1 ? 1 : depth;
  return { x, y, depth, vz: safeVz, behind };
}

// ---- small vector helpers (pure) ------------------------------------------------------------
export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}
export function dot3(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
export function lenSq(a) { return a[0] * a[0] + a[1] * a[1] + a[2] * a[2]; }
export function normalize(a) {
  const l = Math.sqrt(lenSq(a));
  if (l < 1e-12) return [0, 0, 0];
  return [a[0] / l, a[1] / l, a[2] / l];
}

// Triangle face normal (world space), normalized. a, b, c are [x,y,z].
export function faceNormal(a, b, c) {
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
  return normalize(cross(u, v));
}
