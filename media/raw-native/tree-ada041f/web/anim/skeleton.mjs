// Skeletons and linear-blend skinning, CPU reference (float64). Pure: runs in Node and the browser.
// Matrices are column-major Float64Array(16), as in web/world/scene.mjs.
//
//   const sk = makeSkeleton([{ name: "hip", t: [0, 1, 0] }, { name: "knee", parent: "hip", t: [0, -0.45, 0] }]);
//   const world = poseSkeleton(sk, { knee: { r: quatAxisAngle([1, 0, 0], 0.5) } });   // per-joint world matrices
//   const M = skinMatrices(world, sk.invBind);                                          // world x inverse bind
//   const out = skin(mesh, M);   // mesh: { pos Float32Array(3n), nrm?, joints Uint16Array(4n), weights Float32Array(4n) }
//
// A joint's rest frame is its parent's frame translated by t and rotated by r (a unit quaternion);
// a pose adds a local rotation (and, for any joint, a translation offset) on top of the rest. The
// bind pose is the rest pose, so skinning with an empty pose returns the mesh unchanged.
import { compose, mul, apply } from "../world/scene.mjs";

export function makeSkeleton(joints) {
  const index = new Map(), list = [];
  for (const j of joints) {
    if (index.has(j.name)) throw new Error(`skeleton: duplicate joint ${j.name}`);
    const parent = j.parent == null ? -1 : index.get(j.parent);
    if (parent === undefined) throw new Error(`skeleton: joint ${j.name} names parent ${j.parent} before it is defined`);
    index.set(j.name, list.length);
    list.push({ name: j.name, parent, t: j.t ? [...j.t] : [0, 0, 0], r: j.r ? [...j.r] : [0, 0, 0, 1] });
  }
  const sk = { joints: list, index };
  sk.bind = poseSkeleton(sk, {});
  sk.invBind = sk.bind.map(rigidInverse);
  return sk;
}

// World matrices for a pose: { jointName: { r: quaternion, t: [x, y, z] offset } }.
export function poseSkeleton(sk, pose = {}) {
  const out = new Array(sk.joints.length);
  sk.joints.forEach((j, i) => {
    const p = pose[j.name] || {}, t = p.t ? [j.t[0] + p.t[0], j.t[1] + p.t[1], j.t[2] + p.t[2]] : j.t;
    const local = compose(t, p.r ? quatMul(j.r, p.r) : j.r);
    out[i] = j.parent < 0 ? local : mul(out[j.parent], local);
  });
  return out;
}

// Inverse of a rotation-and-translation matrix (no scale).
export function rigidInverse(m) {
  const o = new Float64Array(16);
  for (let c = 0; c < 3; c++) for (let r = 0; r < 3; r++) o[c * 4 + r] = m[r * 4 + c];
  for (let r = 0; r < 3; r++) o[12 + r] = -(o[r] * m[12] + o[4 + r] * m[13] + o[8 + r] * m[14]);
  o[15] = 1;
  return o;
}

export const skinMatrices = (world, invBind) => world.map((w, i) => mul(w, invBind[i]));

// Linear-blend skinning: up to four influences a vertex; weights are renormalised so a vertex whose
// weights do not sum to one is still a convex blend. Normals use the blended rotation part and are
// renormalised (exact for rigid joint matrices up to the blend).
export function skin(mesh, M) {
  const n = mesh.pos.length / 3, pos = new Float32Array(n * 3), nrm = mesh.nrm ? new Float32Array(n * 3) : null;
  for (let v = 0; v < n; v++) {
    let sw = 0; for (let k = 0; k < 4; k++) sw += mesh.weights[v * 4 + k];
    if (sw <= 0) { for (let c = 0; c < 3; c++) { pos[v * 3 + c] = mesh.pos[v * 3 + c]; if (nrm) nrm[v * 3 + c] = mesh.nrm[v * 3 + c]; } continue; }
    const p = [mesh.pos[v * 3], mesh.pos[v * 3 + 1], mesh.pos[v * 3 + 2]];
    let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
    for (let k = 0; k < 4; k++) {
      const w = mesh.weights[v * 4 + k] / sw; if (!w) continue;
      const m = M[mesh.joints[v * 4 + k]], q = apply(m, p); x += w * q[0]; y += w * q[1]; z += w * q[2];
      if (nrm) { const d = [mesh.nrm[v * 3], mesh.nrm[v * 3 + 1], mesh.nrm[v * 3 + 2]]; nx += w * (m[0] * d[0] + m[4] * d[1] + m[8] * d[2]); ny += w * (m[1] * d[0] + m[5] * d[1] + m[9] * d[2]); nz += w * (m[2] * d[0] + m[6] * d[1] + m[10] * d[2]); }
    }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    if (nrm) { const l = Math.hypot(nx, ny, nz) || 1; nrm[v * 3] = nx / l; nrm[v * 3 + 1] = ny / l; nrm[v * 3 + 2] = nz / l; }
  }
  return { pos, nrm };
}

// Quaternions (x, y, z, w).
export function quatMul(a, b) {
  return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
}
export function quatAxisAngle(axis, angle) {
  const l = Math.hypot(axis[0], axis[1], axis[2]) || 1, s = Math.sin(angle / 2);
  return [(axis[0] / l) * s, (axis[1] / l) * s, (axis[2] / l) * s, Math.cos(angle / 2)];
}
// Yaw about +Y, then pitch about +X, then roll about +Z (radians), as one quaternion.
export const quatEuler = (pitch, yaw, roll) => quatMul(quatMul(quatAxisAngle([0, 1, 0], yaw), quatAxisAngle([1, 0, 0], pitch)), quatAxisAngle([0, 0, 1], roll));
export const jointPos = (world, i) => [world[i][12], world[i][13], world[i][14]];
