// "The Salt Road": an original monochrome surreal space, authored for the dither-lighting work.
// A salt flat of low dunes at night. Inverted arches hang in a receding line over the road, a
// tapering tower floats tip-down and turns slowly, a striped lighthouse sweeps a bladed beam, a
// grove of pale thin trunks stands in the fog, and a large moon sits in a sky of black shards.
// Everything is signed distance fields and procedural albedo: no imported asset, no texture.
// Units are metres, y is up. The scene function and materials are allocation-free so a CPU
// raymarcher can run them per pixel. The turning tower is the one moving object: its albedo and
// dither anchor live in its own space.
import { pcg } from "../common.mjs";

export const TOWER = { cx: 5.5, cz: -21, y0: 2.2, y1: 11 };
export const LIGHTHOUSE = { x: -10, z: -27, lanternY: 10.8 };
export const ORBS = [[1.8, 1.1, -5.5], [-2.4, 0.9, -12], [3, 1.4, -17]];
export const MOON = (() => { const v = [0.5, 0.42, -0.75], l = Math.hypot(...v); return v.map((c) => c / l); })();
const hash = (a, b) => pcg((a | 0) ^ pcg(b | 0)) / 4294967296;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const fract = (x) => x - Math.floor(x);
const sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };

export const groundH = (x, z) => 0.38 * Math.sin(0.13 * x + 0.4 * Math.sin(0.07 * z)) + 0.22 * Math.sin(0.21 * z + 1.3) + 2.2 * Math.exp(-((x - LIGHTHOUSE.x) ** 2 + (z - LIGHTHOUSE.z) ** 2) / 18);

export let hitId = 0;
// Rotation of the tower, set per frame by the renderer.
let towerCos = 1, towerSin = 0;
export function setTowerAngle(a) { towerCos = Math.cos(a); towerSin = Math.sin(a); }
export function towerLocal(x, z) { const dx = x - TOWER.cx, dz = z - TOWER.cz; return [towerCos * dx + towerSin * dz, -towerSin * dx + towerCos * dz]; }

export function map(x, y, z) {
  let d = (y - groundH(x, z)) * 0.7; hitId = 0;
  // inverted tower, square cross-section tapering to its tip
  { const dx = x - TOWER.cx, dz = z - TOWER.cz, lx = towerCos * dx + towerSin * dz, lz = -towerSin * dx + towerCos * dz;
    if (Math.abs(dx) < 6 && Math.abs(dz) < 6 && y > TOWER.y0 - 1 && y < TOWER.y1 + 1) {
      const r = 0.35 + 0.42 * (y - TOWER.y0), body = Math.max(Math.max(Math.abs(lx), Math.abs(lz)) - r, Math.abs(y - (TOWER.y0 + TOWER.y1) / 2) - (TOWER.y1 - TOWER.y0) / 2) * 0.8;
      const cap = Math.max(Math.max(Math.abs(lx), Math.abs(lz)) - 4.4, Math.abs(y - (TOWER.y1 + 0.15)) - 0.15) * 0.9, t = Math.min(body, cap);
      if (t < d) { d = t; hitId = 1; } } }
  // inverted arches, repeated along the road
  { const k = Math.min(6, Math.max(0, Math.round(-(z + 8) / 6))), pz = z + 8 + 6 * k;
    const slab = Math.max(Math.abs(x) - 3.4, Math.abs(y - 5.3) - 2.1, Math.abs(pz) - 0.45), notch = Math.hypot(x, y - 7.4) - 2.2, t = Math.max(slab, -notch);
    if (t < d) { d = t; hitId = 2; } }
  // lighthouse: tapering shaft, lantern room, cap
  { const dx = x - LIGHTHOUSE.x, dz = z - LIGHTHOUSE.z;
    if (Math.abs(dx) < 4 && Math.abs(dz) < 4 && y < 15) {
      const rr = Math.hypot(dx, dz), r = 1.1 - 0.04 * y, shaft = Math.max(rr - r, y - 10) * 0.9, lant = Math.max(rr - 0.8, Math.abs(y - 10.8) - 0.8) * 0.9;
      const cap = Math.max(rr - 1.3 * (1 - (y - 11.6) / 2), y - 13.6, 11.6 - y) * 0.7;
      if (shaft < d) { d = shaft; hitId = 3; } if (lant < d) { d = lant; hitId = 4; } if (cap < d) { d = cap; hitId = 3; } } }
  // grove of pale trunks on a jittered grid
  { const bx = Math.max(Math.abs(x + 12) - 8.5, Math.abs(z + 25) - 21, y - 11, -1);
    if (bx > 0.3) { if (bx < d) { d = bx; hitId = 0; } } else {
      const i = Math.floor((x + 20) / 4), j = Math.floor((-z - 5) / 4);
      if (i >= 0 && i < 4 && j >= 0 && j < 10 && hash(i, j) < 0.8) {
        const cx = -20 + 4 * i + 2 + (hash(i, j + 50) - 0.5) * 2.4, cz = -5 - 4 * j - 2 + (hash(i + 50, j) - 0.5) * 2.4, h = 6 + 5 * hash(i + 9, j + 9), rad = 0.11 + 0.08 * hash(i + 3, j + 3);
        const t = Math.max(Math.hypot(x - cx, z - cz) - rad, y - h) * 0.6;
        if (t < d) { d = t; hitId = 5; } } } }
  for (let i = 0; i < 3; i++) { const o = ORBS[i], t = Math.hypot(x - o[0], y - o[1], z - o[2]) - 0.22; if (t < d) { d = t; hitId = 6; } }
  return d;
}

// Albedo in anchor space. (ax, ay, az): the anchor position; id: the object.
export function albedoOf(id, ax, ay, az) {
  switch (id) {
    case 0: { const rip = Math.sin(ax * 2.1 + az * 0.7 + 3 * Math.sin(az * 0.4)), crack = Math.max(sstep(0.93, 0.985, Math.abs(Math.sin(ax * 0.9 + 1.7 * Math.sin(az * 0.31)))), sstep(0.94, 0.99, Math.abs(Math.sin(az * 1.1 + 0.8 * Math.sin(ax * 0.27))))); return sat(0.7 + 0.06 * rip - 0.3 * crack); }
    case 1: { const u = Math.abs(ax) > Math.abs(az) ? az : ax, band = fract(ay * 1.2) < 0.1 ? 0.18 : 1, win = Math.abs(fract(u * 0.9) - 0.5) < 0.12 && Math.abs(fract(ay * 0.7) - 0.5) < 0.28 ? 0.08 : 1; return 0.7 * band * win; }
    case 2: return fract(ax * 3) < 0.12 ? 0.3 : (Math.abs(ay - 5.3) > 1.9 ? 0.78 : 0.56);
    case 3: return fract(ay * 0.5 + Math.atan2(az, ax) / Math.PI) < 0.5 ? 0.88 : 0.12;
    case 5: return fract(ay * 0.9) < 0.1 || (hash(Math.floor(ay * 2), Math.floor(ax * 9 + az * 9)) < 0.07) ? 0.1 : 0.8;
    default: return 1;
  }
}

// Sky and moon as a tone for a view direction. Black shards drift with t.
export function skyTone(dx, dy, dz, t) {
  let tone = 0.1 + 0.9 * Math.pow(1 - sat(dy * 1.6), 2);
  const cm = dx * MOON[0] + dy * MOON[1] + dz * MOON[2], a = Math.acos(Math.min(1, Math.max(-1, cm)));
  tone += 0.35 * Math.exp(-((a / 0.5) ** 2));
  if (a < 0.17) tone = 0.92 - 0.3 * sstep(0.2, 0.7, 0.5 + 0.5 * Math.sin(dx * 53 + Math.sin(dz * 41) * 2) * Math.sin(dy * 47 + 1)) - 0.25 * sstep(0.12, 0.17, a);
  for (let i = 0; i < 14; i++) {
    const az = hash(i, 1) * Math.PI * 2 + 0.01 * t * (1 + hash(i, 5)), el = 0.12 + hash(i, 2) * 0.9, s = 0.02 + 0.1 * hash(i, 3) * hash(i, 3);
    const cx = Math.sin(az) * Math.cos(el), cy = Math.sin(el), cz = -Math.cos(az) * Math.cos(el), dd = dx * cx + dy * cy + dz * cz;
    if (dd < 0.9) continue;
    const qx = dx / dd - cx, qy = dy / dd - cy, qz = dz / dd - cz;
    // tangent basis at c
    let ux = cy * 0 - cz * 1, uy = cz * 0 - cx * 0, uz = cx * 1 - cy * 0; const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = cy * uz - cz * uy, vy = cz * ux - cx * uz, vz = cx * uy - cy * ux;
    const px = qx * ux + qy * uy + qz * uz, py = qx * vx + qy * vy + qz * vz, rot = hash(i, 4) * 6.283 + 0.02 * t, c = Math.cos(rot), sn = Math.sin(rot), rx = (c * px + sn * py) / s, ry = (-sn * px + c * py) / s;
    if (ry > -0.5 && ry < 1 - Math.abs(rx) * 1.7 && Math.abs(rx) < 0.6) return 0;
  }
  return Math.min(1, tone);
}
