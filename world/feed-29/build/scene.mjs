// scene.mjs: a small street at dusk built as quads, for the spot-ink illustration treatment. Our own geometry: blocks
// of different heights down both sides of a street, window grids, a tram, a lamp. A pinhole camera projects it; a
// painter's sort and a supersampled polygon fill give per-sample face ids. Everything here is plain data, so the
// illustration module (spotink.mjs) can read faces, objects and lit windows without any renderer of its own.
import { rng } from './lib/field.mjs';

// Face classes: 0 front (faces the camera), 1 side (faces the street), 2 top, 3 ground, 4 window, 5 sky.
export function street(seed = 'street') {
  const r = rng(seed), quads = []; let obj = 0;
  const box = (x0, x1, z0, z1, hgt, opts = {}) => {
    const o = ++obj, side = x0 > 0 ? x0 : x1, P = (x, y, z) => [x, y, z];
    quads.push({ obj: o, cls: 0, pts: [P(x0, 0, z0), P(x1, 0, z0), P(x1, hgt, z0), P(x0, hgt, z0)] });
    quads.push({ obj: o, cls: 1, pts: [P(side, 0, z0), P(side, 0, z1), P(side, hgt, z1), P(side, hgt, z0)] });
    quads.push({ obj: o, cls: 2, pts: [P(x0, hgt, z0), P(x1, hgt, z0), P(x1, hgt, z1), P(x0, hgt, z1)] });
    if (opts.windows) {
      const floors = Math.floor((hgt - 1) / 3.2), bays = Math.max(2, Math.floor((z1 - z0) / 2.6)), dz = (z1 - z0) / bays, inset = side > 0 ? -0.02 : 0.02;
      for (let f = 0; f < floors; f++) for (let b = 0; b < bays; b++) {
        const y0 = 1.4 + f * 3.2, za = z0 + b * dz + dz * 0.28, zb = za + dz * 0.44, lit = r() < opts.lit;
        quads.push({ obj: o, cls: 4, lit, pts: [P(side + inset, y0, za), P(side + inset, y0, zb), P(side + inset, y0 + 1.7, zb), P(side + inset, y0 + 1.7, za)] });
      }
    }
    return o;
  };
  for (const s of [-1, 1]) {
    let z = 6;
    while (z < 120) { const d = 6 + r() * 10, hgt = 7 + r() * 18, x = s * 7.5; box(s < 0 ? x - 9 : x, s < 0 ? x : x + 9, z, z + d, hgt, { windows: true, lit: 0.22 }); z += d + 0.3 + (r() < 0.25 ? 3 : 0); }
  }
  box(-2.4, 0.2, 14, 26, 3.4); // tram body
  quads.push({ obj: ++obj, cls: 4, lit: true, pts: [[0.2 + 0.01, 1.6, 15.5], [0.21, 1.6, 24.5], [0.21, 2.6, 24.5], [0.21, 2.6, 15.5]].map(([x, y, z]) => [x, y, z]) }); // its lit band
  box(4.6, 4.8, 24, 24.2, 6.5); // lamp post
  quads.push({ obj: ++obj, cls: 4, lit: true, pts: [[4.0, 6.3, 23.9], [4.8, 6.3, 23.9], [4.8, 6.75, 23.9], [4.0, 6.75, 23.9]] }); // lamp head
  quads.push({ obj: 0, cls: 3, pts: [[-60, 0, -6], [60, 0, -6], [60, 0, 200], [-60, 0, 200]] });
  return quads;
}

// Pinhole camera at eye height, slightly turned, looking down +z. Returns [sx, sy, depth].
export function camera(w, h, { eye = [0.6, 1.7, -7], yaw = -0.1, pitch = 0.04, fov = 56 } = {}) {
  const f = (w / 2) / Math.tan(fov * Math.PI / 360), cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  const toCam = ([x, y, z]) => { let X = x - eye[0], Y = y - eye[1], Z = z - eye[2]; [X, Z] = [X * cy - Z * sy, X * sy + Z * cy]; [Y, Z] = [Y * cp - Z * sp, Y * sp + Z * cp]; return [X, Y, Z]; };
  const project = ([X, Y, Z]) => [w / 2 + f * X / Z, h * 0.64 - f * Y / Z, Z];
  // The world point on the ground plane (y = 0) seen at screen (sx, sy), or null above the horizon.
  const ground = (px, py) => {
    let X = (px - w / 2) / f, Y = -(py - h * 0.64) / f, Z = 1;
    [Y, Z] = [Y * cp + Z * sp, -Y * sp + Z * cp]; [X, Z] = [X * cy + Z * sy, -X * sy + Z * cy];
    if (Y >= -1e-9) return null; const t = -eye[1] / Y; return [eye[0] + X * t, 0, eye[2] + Z * t];
  };
  const proj = p => project(toCam(p)); proj.toCam = toCam; proj.project = project; proj.ground = ground;
  return proj;
}

// Clip each quad to depth > near in camera space, project, then fill per sample (painter's order, far first).
// Returns { ids: Int32Array(W*H) quad index or -1, W, H, ss, quads } at ss x ss samples per pixel.
export function rasterize(quads, w, h, { ss = 3, ...cam } = {}) {
  const proj = camera(w * ss, h * ss, cam), W = w * ss, H = h * ss, ids = new Int32Array(W * H).fill(-1);
  const order = quads.map((q, i) => ({ i, d: q.cls === 3 ? 1e9 : q.pts.reduce((a, p) => a + proj(p)[2], 0) / 4 - (q.cls === 4 ? 0.5 : 0) })).sort((a, b) => b.d - a.d);
  for (const { i } of order) {
    const P = clipNear(quads[i].pts.map(proj.toCam), 0.3).map(proj.project); if (P.length < 3) continue;
    let y0 = Infinity, y1 = -Infinity; for (const p of P) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    for (let y = Math.max(0, Math.floor(y0)); y <= Math.min(H - 1, Math.ceil(y1)); y++) {
      const xs = [], yc = y + 0.5;
      for (let k = 0; k < P.length; k++) { const a = P[k], b = P[(k + 1) % P.length]; if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
      xs.sort((a, b) => a - b);
      for (let k = 0; k + 1 < xs.length; k += 2) for (let x = Math.max(0, Math.ceil(xs[k] - 0.5)); x <= Math.min(W - 1, Math.floor(xs[k + 1] - 0.5)); x++) ids[y * W + x] = i;
    }
  }
  return { ids, W, H, ss, quads, proj };
}
function clipNear(P, near) {
  const out = [];
  for (let k = 0; k < P.length; k++) {
    const a = P[k], b = P[(k + 1) % P.length], ia = a[2] > near, ib = b[2] > near;
    if (ia) out.push(a);
    if (ia !== ib) { const t = (near - a[2]) / (b[2] - a[2]); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1]), near]); } // camera space
  }
  return out;
}
