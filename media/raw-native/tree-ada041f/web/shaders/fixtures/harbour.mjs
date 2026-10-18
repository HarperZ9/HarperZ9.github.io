// "Lamp Quay": an original block-out of a small harbour, authored for the paint-over work. A stone
// quay with three houses, a warehouse with an arched door, a striped lighthouse, crates and
// barrels, a moored boat, a lamp post, steps to the water. Signed distance fields with flat
// block-out colours (the colours a painter would start from); no imported asset.
// y is up; the quay top is y = 0; the water is y = -0.9. Group bounding spheres skip far work.
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
const box = (x, y, z, cx, cy, cz, hx, hy, hz) => { const qx = Math.abs(x - cx) - hx, qy = Math.abs(y - cy) - hy, qz = Math.abs(z - cz) - hz; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0); };
const cyl = (x, y, z, cx, cy, cz, r, hh) => { const dx = Math.hypot(x - cx, z - cz) - r, dy = Math.abs(y - cy) - hh; return Math.hypot(Math.max(dx, 0), Math.max(dy, 0)) + Math.min(Math.max(dx, dy), 0); };
const sph = (x, y, z, cx, cy, cz, r) => Math.hypot(x - cx, y - cy, z - cz) - r;
// A gable roof along x: a triangular prism, ridge at height rh above the eaves.
const gable = (x, y, z, cx, cy, cz, hx, hz, rh) => {
  const lx = Math.abs(x - cx) - hx, lz = z - cz, ly = y - cy, slope = (Math.abs(lz) / hz) * rh - (rh - ly); // inside when ly < rh (1 - |lz|/hz)
  const side = (slope) * (hz / Math.hypot(hz, rh)), bottom = -ly;
  return Math.max(lx, side, bottom);
};

export const IDS = { quay: 0, water: 1, wall: 2, roof: 3, lighthouse: 4, lantern: 5, crate: 6, hull: 7, lamppost: 8, lamp: 9, steps: 10, door: 11, barrel: 12, mast: 13 };
export let hitId = 0;
export let exact = false;
export const setExact = (v) => { exact = v; };
export function map(x, y, z) {
  let d = Infinity, id = 0;
  const T = (t, i) => { if (t < d) { d = t; id = i; } };
  // quay slab and water
  T(box(x, y, z, 0, -0.6, -3, 13, 0.6, 6.2), IDS.quay);
  T(y + 0.9, IDS.water);
  // steps down to the water at the front edge
  if (Math.abs(x + 1.5) < 3 && z > 2 && z < 5) for (let k = 0; k < 3; k++) T(box(x, y, z, -1.5, -0.3 * (k + 1), 3.2 + 0.45 * k, 1.3, 0.3 * (k + 1) * 0.5 + 0.0, 0.25), IDS.steps);
  // house A (left): walls, roof, door
  { const lb = Math.max(Math.hypot(x - (-6), z - (-5)) - 6, y - 9); if (lb > 0.03 && !exact) T(lb, 0); else {
    T(box(x, y, z, -6, 2, -5, 2.6, 2, 2), IDS.wall); T(gable(x, y, z, -6, 4, -5, 2.9, 2.4, 1.7), IDS.roof);
    T(box(x, y, z, -6, 0.9, -2.95, 0.6, 0.9, 0.1), IDS.door);
  } }
  // house B (middle, taller) with a chimney
  { const lb = Math.max(Math.hypot(x - (0.5), z - (-6.5)) - 6, y - 10); if (lb > 0.03 && !exact) T(lb, 0); else {
    T(box(x, y, z, 0.5, 2.8, -6.5, 2.4, 2.8, 2.1), IDS.wall); T(gable(x, y, z, 0.5, 5.6, -6.5, 2.7, 2.5, 2), IDS.roof);
    T(box(x, y, z, 1.8, 7.0, -6.9, 0.35, 1.0, 0.35), IDS.wall); T(box(x, y, z, 0.5, 0.9, -4.35, 0.6, 0.9, 0.1), IDS.door);
  } }
  // warehouse C (right) with an arched door recess
  { const lb = Math.max(Math.hypot(x - (7), z - (-4)) - 7, y - 8); if (lb > 0.03 && !exact) T(lb, 0); else {
    const w = box(x, y, z, 7, 1.9, -4, 3.2, 1.9, 2.3);
    const arch = Math.min(box(x, y, z, 5.4, 0.9, -1.7, 0.8, 0.9, 0.5), Math.max(Math.hypot(x - 5.4, y - 1.8) - 0.8, Math.abs(z + 1.7) - 0.5));
    T(Math.max(w, -arch), IDS.wall); T(gable(x, y, z, 7, 3.8, -4, 3.5, 2.6, 1.3), IDS.roof);
    T(box(x, y, z, 5.4, 0.8, -1.75, 0.66, 0.8, 0.06), IDS.door);
  } }
  // lighthouse
  { const lb = Math.max(Math.hypot(x - (10), z - (0.5)) - 3, y - 12); if (lb > 0.03 && !exact) T(lb, 0); else {
    const r = 1.1 - 0.06 * Math.max(y, 0), t = Math.max(Math.hypot(x - 10, z - 0.5) - r, y - 7.2, -y) * 0.9;
    T(t, IDS.lighthouse); T(Math.max(Math.hypot(x - 10, z - 0.5) - 0.75, Math.abs(y - 7.9) - 0.7) * 0.9, IDS.lantern);
    T(Math.max(Math.hypot(x - 10, z - 0.5) - 1.1 * (1 - (y - 8.6) / 1.8), y - 10.4, 8.6 - y) * 0.7, IDS.roof);
    T(box(x, y, z, 10, 7.2, 0.5, 1.15, 0.08, 1.15), IDS.lighthouse);
  } }
  // crates and barrels
  { const lb = Math.max(Math.hypot(x - (-2.8), z - (0.2)) - 3, y - 3); if (lb > 0.03 && !exact) T(lb, 0); else {
    T(box(x, y, z, -3, 0.5, 0, 0.5, 0.5, 0.5), IDS.crate); T(box(x, y, z, -2.1, 0.45, 0.35, 0.45, 0.45, 0.45), IDS.crate); T(box(x, y, z, -2.6, 1.3, 0.1, 0.4, 0.4, 0.4), IDS.crate);
    T(cyl(x, y, z, -4.3, 0.5, 0.9, 0.42, 0.5), IDS.barrel); T(cyl(x, y, z, -4.9, 0.5, 0.2, 0.42, 0.5), IDS.barrel);
  } }
  // lamp post
  { const lb = Math.max(Math.hypot(x - 3, z) - 1.5, y - 5); if (lb > 0.03 && !exact) T(lb, 0); else { T(cyl(x, y, z, 3, 1.9, 0, 0.09, 1.9), IDS.lamppost); T(sph(x, y, z, 3, 4.0, 0, 0.3), IDS.lamp); T(box(x, y, z, 3, 0.2, 0, 0.25, 0.2, 0.25), IDS.lamppost); } }
  // boat in the water: hull (squashed sphere), cabin, mast
  { const lb = Math.max(Math.hypot(x - (-4), z - (7)) - 4.5, y - 6); if (lb > 0.03 && !exact) T(lb, 0); else {
    const hx = (x + 4) / 2.6, hy = (y + 0.55) / 0.8, hz = (z - 7) / 1.2, hull = (Math.hypot(hx, hy, hz) - 1) * 0.8;
    T(Math.max(hull, -(y + 0.45)), IDS.hull); T(box(x, y, z, -4.3, 0.15, 7, 0.7, 0.4, 0.55), IDS.wall); T(cyl(x, y, z, -3.4, 1.5, 7, 0.06, 2.0), IDS.mast);
  } }
  hitId = id;
  return d;
}

// Block-out colours (linear-ish, as a painter would block in) and emissive flags.
export function albedoOf(id, x, y, z) {
  switch (id) {
    case IDS.quay: return (Math.floor(x * 1.3) + Math.floor(z * 1.3)) & 1 ? [0.5, 0.47, 0.42] : [0.55, 0.52, 0.47];
    case IDS.water: return [0.2, 0.34, 0.42];
    case IDS.wall: return [0.78, 0.66, 0.46];
    case IDS.roof: return [0.55, 0.22, 0.16];
    case IDS.lighthouse: return Math.floor(y * 0.7) & 1 ? [0.85, 0.2, 0.17] : [0.9, 0.88, 0.82];
    case IDS.crate: return [0.52, 0.36, 0.2];
    case IDS.hull: return [0.17, 0.25, 0.4];
    case IDS.lamppost: return [0.16, 0.17, 0.2];
    case IDS.steps: return [0.45, 0.42, 0.38];
    case IDS.door: return [0.3, 0.18, 0.1];
    case IDS.barrel: return [0.4, 0.27, 0.15];
    case IDS.mast: return [0.35, 0.25, 0.15];
    default: return [1, 0.9, 0.55];
  }
}
export const isEmissive = (id) => id === IDS.lantern || id === IDS.lamp;
export { sat };
