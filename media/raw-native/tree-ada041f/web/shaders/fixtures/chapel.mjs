// "Chapel Yard": an original night scene for the palette-locked lighting work. A small stone chapel
// with a bell tower and two lit windows, a yard of leaning headstones, an iron fence, bare trees,
// a hedge, a lamp post, and two pools of void in the grass. Signed distance fields, flat classes
// and procedural albedo detail; no imported asset. Viewed by an orthographic three-quarter camera.
// y is up; the ground is y = 0. Group bounds return a lower bound unless `exact` is set.
import { pcg } from "../common.mjs";

export const CLS = { ground: 0, stone: 1, wood: 2, foliage: 3, void: 4, window: 5, lamp: 6 };
const hash = (a, b) => pcg((a | 0) ^ pcg(b | 0)) / 4294967296;
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x), fract = (x) => x - Math.floor(x), sstep = (a, b, x) => { const t = sat((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function vnoise(x, y) { const x0 = Math.floor(x), y0 = Math.floor(y), fx = sstep(0, 1, x - x0), fy = sstep(0, 1, y - y0); return (hash(x0, y0) * (1 - fx) + hash(x0 + 1, y0) * fx) * (1 - fy) + (hash(x0, y0 + 1) * (1 - fx) + hash(x0 + 1, y0 + 1) * fx) * fy; }
const box = (x, y, z, cx, cy, cz, hx, hy, hz) => { const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
const cyl = (x, y, z, cx, cy, cz, r, hh) => { const dx = Math.hypot(x - cx, z - cz) - r, dy = Math.abs(y - cy) - hh; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
const cap = (x, y, z, ax, ay, az, bx, by, bz, r) => { const px = x - ax, py = y - ay, pz = z - az, bax = bx - ax, bay = by - ay, baz = bz - az, h = Math.min(1, Math.max(0, (px * bax + py * bay + pz * baz) / (bax * bax + bay * bay + baz * baz))); return Math.hypot(px - bax * h, py - bay * h, pz - baz * h) - r; };

// The void pools: [centre x, centre z, radius x, radius z].
export const POOLS = [[3, 3.2, 2.6, 1.6], [9.2, 8, 1.8, 1.3]];
export const inPool = (x, z) => POOLS.some(([cx, cz, rx, rz]) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 + 0.12 * Math.sin(x * 2.3 + z * 1.7) * 0.4 < 1);
export const LAMP = [5.2, 3.6, 5.6], WINDOWS = [[-6.0, 2.4, 0.32], [-3.0, 2.4, 0.32]];

export let hitId = 0, exact = false;
export const setExact = (v) => { exact = v; };
export function map(x, y, z) {
  let d = y, id = CLS.ground;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  // chapel: walls, gabled roof, bell tower, door arch, windows
  { const lb = Math.max(Math.hypot(x + 4.5, z + 3.2) - 8, y - 11);
    if (lb > 0.03 && !exact) T(lb, 0); else {
      T(box(x, y, z, -4.5, 2.2, -3.5, 3.2, 2.2, 3.8), CLS.stone);
      { const lx = Math.abs(z + 3.5) - 3.8, sl = (Math.abs(x + 4.5) * 2.0 - 2.2 * 2.0 + (y - 4.4) * 3.2) / Math.hypot(2.0, 3.2); T(Math.max(lx, sl, 4.4 - y), CLS.wood); }
      T(box(x, y, z, -4.5, 6.2, -1.2, 1.0, 1.8, 1.0), CLS.stone); T(Math.max(Math.hypot(x + 4.5, z + 1.2) - 1.4 * (1 - (y - 8) / 3), y - 11, 8 - y) * 0.7, CLS.wood);
      for (const w of WINDOWS) T(box(x, y, z, w[0], w[1], w[2], 0.45, 0.8, 0.05), CLS.window);
      T(box(x, y, z, -4.5, 1.1, 0.34, 0.6, 1.1, 0.06), CLS.wood);
    } }
  // headstones on a jittered grid
  { const lb = Math.max(Math.abs(x - 4) - 7.5, Math.abs(z - 4) - 6.5, y - 1.8);
    if (lb > 0.05 && !exact) T(lb, 0); else {
      const i = Math.floor((x + 3.5) / 2.2), j = Math.floor((z + 2.5) / 2.2);
      for (let di = 0; di <= 0; di++) { const gi = i + di, gj = j; if (gi < 0 || gi > 6 || gj < 0 || gj > 5 || hash(gi, gj) > 0.7 || inPool(-3.5 + 2.2 * gi + 1.1, -2.5 + 2.2 * gj + 1.1)) continue;
        const cx = -3.5 + 2.2 * gi + 1.1 + (hash(gi + 40, gj) - 0.5) * 0.7, cz = -2.5 + 2.2 * gj + 1.1 + (hash(gi, gj + 40) - 0.5) * 0.7, a = (hash(gi + 9, gj + 9) - 0.5) * 0.7, ca = Math.cos(a), sa = Math.sin(a), lx = ca * (x - cx) + sa * (z - cz), lz = -sa * (x - cx) + ca * (z - cz), h = 0.7 + 0.5 * hash(gi + 3, gj + 5);
        T(Math.min(box(lx, y, lz, 0, h / 2, 0, 0.32, h / 2, 0.09), Math.max(Math.hypot(lx, y - h) - 0.32, Math.abs(lz) - 0.09)), CLS.stone); }
    } }
  // iron fence along the front and the right side
  { const lb = Math.max(Math.abs(x - 4.5) - 8.5, Math.abs(z - 6) - 6.5, y - 1.7);
    if (lb > 0.05 && !exact) T(lb, 0); else {
      const fx = Math.abs(z - 11.7) < 0.2 && x > -2 && x < 11.7, fz = Math.abs(x - 11.7) < 0.2 && z > -1 && z < 11.7;
      if (fx || fz) { const p = fx ? x : z, bar = Math.abs(fract(p / 0.4 + 0.5) - 0.5) * 0.4; T(Math.max(Math.hypot(bar, fx ? z - 11.7 : x - 11.7) - 0.04, y - 1.5), CLS.wood); T(box(x, y, z, fx ? 4.85 : 11.7, 1.25, fx ? 11.7 : 5.35, fx ? 6.85 : 0.03, 0.04, fx ? 0.03 : 6.35), CLS.wood); }
    } }
  // bare trees
  for (const [tx, tz, s] of [[-10, -1, 1], [13, 3.5, 1.15], [1.5, -7.5, 0.9]]) {
    const lb = Math.max(Math.hypot(x - tx, z - tz) - 5 * s, y - 9 * s);
    if (lb > 0.05 && !exact) { T(lb, 0); continue; }
    T(cap(x, y, z, tx, 0, tz, tx + 0.15, 4 * s, tz, 0.3 * s), CLS.wood); T(cap(x, y, z, tx + 0.15, 3.6 * s, tz, tx + 2.4 * s, 6.4 * s, tz + 0.6 * s, 0.14 * s), CLS.wood);
    T(cap(x, y, z, tx + 0.1, 4 * s, tz, tx - 2.1 * s, 7.2 * s, tz - 0.4 * s, 0.14 * s), CLS.wood); T(cap(x, y, z, tx + 0.1, 4.4 * s, tz, tx + 0.4 * s, 8.4 * s, tz + 0.2 * s, 0.1 * s), CLS.wood);
  }
  // hedge along the back
  { const lb = Math.max(Math.abs(x - 6) - 9, Math.abs(z + 8.4) - 0.9, y - 2); if (lb > 0.05 && !exact) T(lb, 0); else T(box(x, y, z, 6, 0.9, -8.4, 8.5, 0.9 + 0.12 * Math.sin(x * 1.7), 0.8), CLS.foliage); }
  // lamp post
  { const lb = Math.max(Math.hypot(x - LAMP[0], z - LAMP[2]) - 1.5, y - 5.2); if (lb > 0.05 && !exact) T(lb, 0); else { T(cyl(x, y, z, LAMP[0], 1.6, LAMP[2], 0.07, 1.6), CLS.wood); T(box(x, y, z, LAMP[0], LAMP[1], LAMP[2], 0.2, 0.28, 0.2), CLS.lamp); T(box(x, y, z, LAMP[0], 0.15, LAMP[2], 0.2, 0.15, 0.2), CLS.wood); } }
  hitId = id;
  return d;
}

// Albedo detail in 0..1 (the modulation a painter would draw into a class), plus the class override
// for the void pools. Returns { cls, a }.
export function surfaceOf(id, x, y, z) {
  if (id === CLS.ground) {
    if (inPool(x, z)) return { cls: CLS.void, a: 1 };
    const path = Math.abs(x + 4.5 - 0.35 * Math.sin(z * 0.5)) < 0.9 && z > 0 || (Math.abs(z - 8.5 + 0.4 * Math.sin(x * 0.4)) < 0.6 && x > -4.5 && x < 11);
    const n = vnoise(x * 1.6, z * 1.6), blade = hash(Math.floor(x * 5), Math.floor(z * 5));
    return { cls: CLS.ground, a: path ? 0.95 - 0.12 * blade : sat(0.45 + 0.5 * n + 0.2 * (blade - 0.5) + (fract(x * 0.9 + z * 0.35) < 0.08 ? -0.2 : 0)) };
  }
  if (id === CLS.stone) { const row = Math.floor(y * 2.2), u = x * 1.6 + z * 1.6 + (row & 1) * 0.5, mortar = fract(y * 2.2) < 0.1 || fract(u) < 0.08; return { cls: CLS.stone, a: mortar ? 0.55 : 0.85 + 0.15 * hash(row, Math.floor(u)) }; }
  if (id === CLS.wood) return { cls: CLS.wood, a: 0.75 + 0.25 * Math.abs(Math.sin((x + z) * 14 + y * 2)) };
  if (id === CLS.foliage) return { cls: CLS.foliage, a: 0.55 + 0.45 * hash(Math.floor(x * 4), Math.floor(y * 4) + Math.floor(z * 4) * 7) };
  return { cls: id, a: 1 };
}
