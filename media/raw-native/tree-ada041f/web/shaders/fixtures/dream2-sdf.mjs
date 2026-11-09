// "The Salt Road", second version: the same night, redrawn for drama. A salt flat with cracked
// polygons, ripples, stones and a pale road that winds to a striped lighthouse; hanging gothic
// arches walked under; a fluted inverted spire with buttress fins and orbiting stones; a banded
// ring that frames the moon; a grove whose canopy is leaf noise; floating shards; a large moon lit
// from the side. Signed distance fields and procedural albedo only; no imported asset. Group
// bounding boxes return a lower bound so far work is skipped; `exact` switches that off for
// normals and shadows. Units are metres, y is up.
import { pcg } from "../common.mjs";

export const SPIRE = { cx: 7, cz: -28, y0: 3, y1: 15 };
export const LIGHTHOUSE2 = { x: -13, z: -34, lanternY: 15.4 };
export const ORBS2 = [[1.6, 0.9, -4], [-2.2, 0.8, -11], [2.8, 1.1, -19], [-3.5, 1.0, -27]];
export const RING = { cx: 0, cy: 4.8, cz: -16, R: 4.3, r: 0.22 };
export const MOON2 = (() => { const v = [0.3, 0.27, -0.9], l = Math.hypot(...v); return v.map((c) => c / l); })();
const SHARDS = [[-4, 7.5, -8, 0.9], [5, 10.5, -13, 1.2], [-7, 5.5, -20, 0.8], [2, 12, -24, 1.4], [9, 6.5, -36, 1.1], [-2, 9, -33, 0.7], [-10, 11, -15, 1.0]];
const hash = (a, b) => pcg((a | 0) ^ pcg(b | 0)) / 4294967296, hash3 = (a, b, c) => pcg((a | 0) ^ pcg((b | 0) ^ pcg(c | 0))) / 4294967296;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x), fract = (x) => x - Math.floor(x), sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function vnoise(x, y) { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sstep(0, 1, x - x0), fy = sstep(0, 1, y - y0); return (hash(x0, y0) * (1 - fx) + hash(x0 + 1, y0) * fx) * (1 - fy) + (hash(x0, y0 + 1) * (1 - fx) + hash(x0 + 1, y0 + 1) * fx) * fy; }

export const groundH = (x, z) => 0.42 * Math.sin(0.11 * x + 0.5 * Math.sin(0.06 * z)) + 0.26 * Math.sin(0.19 * z + 1.1) + 0.1 * Math.sin(0.7 * x) * Math.sin(0.5 * z) + 0.05 * Math.sin(2.3 * x + 1.1) * Math.sin(1.7 * z) + 0.03 * Math.sin(4.1 * x + 3.3 * z)
  + 2.6 * Math.exp(-((x - LIGHTHOUSE2.x) ** 2 + (z - LIGHTHOUSE2.z) ** 2) / 22);
export const roadX = (z) => 0.8 * Math.sin(0.12 * z) + 0.5 * Math.sin(0.31 * z + 1);

export let hitId = 0, exact = false;
export const setExact = (v) => { exact = v; };
let spinC = 1, spinS = 0, spinA = 0;
export function setSpin(a) { spinA = a; spinC = Math.cos(a); spinS = Math.sin(a); }
export function spireLocal(x, z) { const dx = x - SPIRE.cx, dz = z - SPIRE.cz; return [spinC * dx + spinS * dz, -spinS * dx + spinC * dz]; }
export const shardCentre = (k, t) => { const s = SHARDS[k]; return [s[0] + 0.6 * Math.sin(0.02 * t + k), s[1] + 0.5 * Math.sin(0.017 * t * (1 + k * 0.3) + k * 2), s[2]]; };

export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  T((y - groundH(x, z)) * 0.65, 0);
  // hanging gothic arches, one every 7 m along the road
  { const lb = Math.max(Math.abs(x) - 6, y - 13.5, -1 - y, z + 7.5, -52 - z);
    if (lb > 0.04 && !exact) T(lb, 0); else {
      const k = Math.min(5, Math.max(0, Math.round(-(z + 9) / 7))), pz = z + 9 + 7 * k;
      const slab = Math.max(Math.abs(x) - 4.4, Math.abs(y - 9.0) - 3.5, Math.abs(pz) - 0.5), notch = Math.max(Math.hypot(x + 1.3, y - 12.7) - 3.0, Math.hypot(x - 1.3, y - 12.7) - 3.0);
      T(Math.max(slab, -notch), 2);
      T(Math.max(Math.hypot(Math.abs(x) - 3.7, pz) - 0.3, y - 5.6, -1.2 - y), 2);
    } }
  // fluted inverted spire, buttress fins, orbiting stones
  { const lb = Math.max(Math.hypot(x - SPIRE.cx, z - SPIRE.cz) - 9, y - 16.5, 2 - y);
    if (lb > 0.04 && !exact) T(lb, 0); else {
      const [lx, lz] = spireLocal(x, z), rho = Math.hypot(lx, lz), th = Math.atan2(lz, lx), r = 0.3 + 0.38 * (y - SPIRE.y0), rr = r * (1 + 0.06 * Math.cos(14 * th));
      T(Math.max(rho - rr, Math.abs(y - 9) - 6) * 0.7, 3);
      T(Math.max(rho - 5.4, Math.abs(y - 15.2) - 0.2) * 0.8, 3);
      const a = ((th + Math.PI / 4 + 40 * Math.PI) % (Math.PI / 2)) - Math.PI / 4, u = rho * Math.cos(a), v = rho * Math.sin(a);
      T(Math.max(Math.abs(v) - 0.13, u - (r + (y - 3) * 0.13), -(u - r * 0.7), Math.abs(y - 9) - 6) * 0.8, 4);
      for (let k = 0; k < 8; k++) { const ang = spinA * 1.7 + (k * Math.PI) / 4, sy = 9 + 1.6 * Math.sin(k * 1.9 + spinA * 3); T(Math.hypot(x - (SPIRE.cx + Math.cos(ang) * 7), y - sy, z - (SPIRE.cz + Math.sin(ang) * 7)) - 0.5, 5); }
    } }
  // the banded ring
  { const lb = Math.max(Math.abs(x - RING.cx) - RING.R - 1, Math.abs(y - RING.cy) - RING.R - 1, Math.abs(z - RING.cz) - 1);
    if (lb > 0.04 && !exact) T(lb, 0); else T(Math.hypot(Math.hypot(x - RING.cx, y - RING.cy) - RING.R, z - RING.cz) - RING.r, 6); }
  // lighthouse
  { const dx = x - LIGHTHOUSE2.x, dz = z - LIGHTHOUSE2.z, lb = Math.max(Math.hypot(dx, dz) - 4, y - 20);
    if (lb > 0.04 && !exact) T(lb, 0); else {
      const rr = Math.hypot(dx, dz), r = 1.5 - 0.045 * Math.max(0, y - 2);
      T(Math.max(rr - r, y - 14.4) * 0.9, 7); T(Math.max(rr - 1.0, Math.abs(y - 15.4) - 0.9) * 0.9, 8);
      T(Math.max(rr - 1.6 * (1 - (y - 16.3) / 2.4), y - 18.7, 16.3 - y) * 0.7, 7); T(Math.max(rr - 1.8, Math.abs(y - 14.6) - 0.1) * 0.9, 7);
    } }
  // grove: trunks and noisy canopies on a jittered grid
  { const lb = Math.max(Math.abs(x + 15.5) - 11.5, Math.abs(z + 30) - 25, y - 14, -1);
    if (lb > 0.3 && !exact) T(lb, 0); else {
      const i = Math.floor((x + 26) / 4), j = Math.floor((-z - 6) / 4);
      if (i >= 0 && i < 5 && j >= 0 && j < 12 && hash(i, j) < 0.85) {
        const cx = -26 + 4 * i + 2 + (hash(i, j + 50) - 0.5) * 2.4, cz = -6 - 4 * j - 2 + (hash(i + 50, j) - 0.5) * 2.4, h = 7 + 5 * hash(i + 9, j + 9), rad = 0.09 + 0.06 * hash(i + 3, j + 3);
        T(Math.max(Math.hypot(x - cx, z - cz) - rad, y - h) * 0.6, 9);
        T((Math.hypot((x - cx) / 1.7, (y - h) / 1.1, (z - cz) / 1.7) - 1) * 0.6, 10);
      }
    } }
  // floating shards (octahedra) and lamp orbs
  for (let k = 0; k < SHARDS.length; k++) {
    const c = shardCentre(k, spinA * 40), s = SHARDS[k][3], dx = x - c[0], dy = y - c[1], dz = z - c[2], lb = Math.hypot(dx, dy, dz) - s * 1.6;
    if (lb > 0.04 && !exact) { T(lb, 0); continue; }
    const a = spinA * 2 * (1 + k * 0.2) + k, ca = Math.cos(a), sa = Math.sin(a), lx = ca * dx + sa * dz, lz = -sa * dx + ca * dz;
    T((Math.abs(lx) * 1.2 + Math.abs(dy) * 0.55 + Math.abs(lz) * 1.2 - s) * 0.5, 11 + (k & 1));
  }
  for (let i = 0; i < 4; i++) { const o = ORBS2[i]; T(Math.hypot(x - o[0], y - o[1], z - o[2]) - 0.24, 13); }
  hitId = id;
  return d;
}

// Voronoi on a 2D cell grid: [F1, F2, cellId hash].
function voronoi(px, pz) {
  const cx = Math.floor(px), cz = Math.floor(pz);
  let f1 = 9, f2 = 9, cid = 0;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const gx = cx + i, gz = cz + j, fx = gx + hash(gx, gz * 7 + 1), fz = gz + hash(gx * 13 + 5, gz), d = Math.hypot(px - fx, pz - fz);
    if (d < f1) { f2 = f1; f1 = d; cid = hash(gx + 100, gz + 100); } else if (d < f2) f2 = d;
  }
  return [f1, f2, cid];
}
// Albedo in anchor space.
export function albedoOf(id, ax, ay, az) {
  switch (id) {
    case 0: {
      const [f1, f2, cid] = voronoi(ax * 0.5, az * 0.5), crack = 1 - sstep(0.02, 0.09, f2 - f1);
      let a = 0.42 + 0.32 * cid + 0.05 * Math.sin(ax * 3 + az * 1.3 + 2 * Math.sin(az * 0.7)) - 0.55 * crack;
      const rd = Math.abs(ax - roadX(az));
      if (rd < 1.5) { const edge = sstep(1.0, 1.5, rd); a = a * edge + (0.9 + 0.06 * hash(Math.floor(ax * 5), Math.floor(az * 5))) * (1 - edge); const cell = hash(Math.floor(ax * 2), Math.floor(az * 2)); if (rd > 1.0 && cell > 0.55) a = 0.18; }
      const sx = Math.floor(ax / 1.3), sz = Math.floor(az / 1.3);
      if (hash(sx, sz) > 0.9 && Math.hypot(fract(ax / 1.3) - 0.5, fract(az / 1.3) - 0.5) < 0.17) a = 0.14;
      return sat(a);
    }
    case 2: { const row = Math.floor(ay * 1.6), u = ax * 1.1 + (row & 1) * 0.5, mortar = fract(ay * 1.6) < 0.08 || fract(u) < 0.07; return mortar ? 0.2 : 0.7 + 0.14 * hash(row, Math.floor(u)); }
    case 3: { const th = Math.atan2(az, ax), band = fract(ay * 0.7) < 0.16 ? 0.92 : 1; return (Math.cos(14 * th) > 0 ? 0.6 : 0.3) * band; }
    case 4: return 0.1;
    case 5: return hash(Math.floor(ax), Math.floor(az * 3)) > 0.5 ? 0.92 : 0.12;
    case 6: return fract(Math.atan2(ay - RING.cy, ax - RING.cx) * 22 / (2 * Math.PI)) < 0.5 ? 0.04 : 0.95;
    case 7: return fract(ay * 0.55 + Math.atan2(az, ax) / Math.PI) < 0.5 ? 0.9 : 0.1;
    case 9: return fract(ay * 0.8) < 0.1 || hash3(Math.floor(ay * 2), Math.floor(ax * 9), Math.floor(az * 9)) < 0.08 ? 0.1 : 0.82;
    case 10: return hash3(Math.floor(ax * 6), Math.floor(ay * 6), Math.floor(az * 6)) > 0.5 ? 0.78 : 0.08;
    case 11: return 0.02;
    case 12: return 0.95;
    default: return 1;
  }
}

// Sky and the large side-lit moon, as a tone for a view direction; black triangles drift with t.
export function skyTone(dx, dy, dz, t) {
  let tone = 0.07 + 0.93 * Math.pow(1 - sat(dy * 1.4), 2.2);
  const cm = dx * MOON2[0] + dy * MOON2[1] + dz * MOON2[2], a = Math.acos(Math.min(1, Math.max(-1, cm))), Rm = 0.3;
  tone += 0.32 * Math.exp(-((a / 0.7) ** 2));
  if (a < Rm) {
    const t1 = (() => { const u = [MOON2[2], 0, -MOON2[0]], l = Math.hypot(...u); return u.map((c) => c / l); })(), t2 = [MOON2[1] * t1[2] - MOON2[2] * t1[1], MOON2[2] * t1[0] - MOON2[0] * t1[2], MOON2[0] * t1[1] - MOON2[1] * t1[0]];
    const s = Math.sin(Rm), u = (dx * t1[0] + dy * t1[1] + dz * t1[2]) / s, v = (dx * t2[0] + dy * t2[1] + dz * t2[2]) / s, r2 = u * u + v * v;
    if (r2 < 1) {
      const nz = Math.sqrt(1 - r2), L = [0.75, 0.3, 0.6], ll = Math.hypot(...L), lam = Math.max(0, (u * L[0] + v * L[1] + nz * L[2]) / ll);
      const crat = 0.5 * vnoise(u * 5 + 3, v * 5) + 0.3 * vnoise(u * 11, v * 11 + 7) + 0.2 * (fract(Math.hypot(u - 0.3, v + 0.2) * 7) < 0.3 ? 1 : 0.3);
      tone = 0.05 + 0.92 * lam * (0.62 + 0.38 * crat) * (0.7 + 0.3 * nz);
    }
  }
  for (let i = 0; i < 9; i++) {
    const az = hash(i, 1) * Math.PI * 2 + 0.01 * t * (1 + hash(i, 5)), el = 0.1 + hash(i, 2) * 0.9, s = 0.03 + 0.12 * hash(i, 3) * hash(i, 3);
    const cx = Math.sin(az) * Math.cos(el), cy = Math.sin(el), cz = -Math.cos(az) * Math.cos(el), dd = dx * cx + dy * cy + dz * cz;
    if (dd < 0.9) continue;
    const qx = dx / dd - cx, qy = dy / dd - cy, qz = dz / dd - cz; let ux = -cz, uz = cx; const ul = Math.hypot(ux, uz) || 1; ux /= ul; uz /= ul;
    const vx = cy * uz, vy = cz * ux - cx * uz, vz = -cy * ux, px = qx * ux + qz * uz, py = qx * vx + qy * vy + qz * vz, rot = hash(i, 4) * 6.283 + 0.02 * t, c = Math.cos(rot), sn = Math.sin(rot), rx = (c * px + sn * py) / s, ry = (-sn * px + c * py) / s;
    if (ry > -0.5 && ry < 1 - Math.abs(rx) * 1.7 && Math.abs(rx) < 0.6) return 0.0;
  }
  return Math.min(1, tone);
}
