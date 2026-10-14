// A small diorama for the pixel-art shaders (template (b), "2.5D, somewhat semi 3D"): a cottage
// with a pitched roof, door and lit window, a tree, a figure, a lantern, a rock and a pond on
// tiled grass. Signed distance functions, raymarched; the same functions exist in WGSL in
// scene.wgsl.mjs. Shading is camera-independent (sun with a hard shadow, sky fill, the lantern),
// which is what lets a texel's colour be computed once from a probe and then reused.
const box = (px, py, pz, cx, cy, cz, bx, by, bz) => {
  const qx = Math.abs(px - cx) - bx, qy = Math.abs(py - cy) - by, qz = Math.abs(pz - cz) - bz;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0);
};
const sph = (px, py, pz, cx, cy, cz, r) => Math.hypot(px - cx, py - cy, pz - cz) - r;
const cyl = (px, py, pz, cx, cz, y0, y1, r) => Math.max(Math.hypot(px - cx, pz - cz) - r, Math.abs(py - (y0 + y1) / 2) - (y1 - y0) / 2);

// Returns [distance, material, object]. Materials index ALBEDO; objects separate things for outlines.
export function sceneMap(px, py, pz) {
  let d = py, m = 0, o = 0;                                                          // ground
  const pond = Math.max(Math.hypot(px - 2.2, (pz - 1.6) * 1.4) - 0.9, Math.abs(py + 0.02) - 0.03);
  if (pond < d) { d = pond; m = 1; o = 1; }
  const walls = box(px, py, pz, -1, 0.8, -0.6, 1.2, 0.8, 0.9); if (walls < d) { d = walls; m = 2; o = 2; }
  // Roof: a box rotated 45 degrees about z, cut by the walls' footprint.
  const rx = (px + 1) * 0.7071 + (py - 1.6) * 0.7071, ry = -(px + 1) * 0.7071 + (py - 1.6) * 0.7071;
  const roof = Math.max(box(rx, ry, pz, 0, 0, -0.6, 0.95, 0.95, 1.05), -py + 1.6); if (roof < d) { d = roof; m = 3; o = 3; }
  const door = box(px, py, pz, -0.5, 0.45, 0.32, 0.22, 0.45, 0.04); if (door < d) { d = door; m = 4; o = 4; }
  const win = box(px, py, pz, -1.45, 0.95, 0.32, 0.25, 0.2, 0.03); if (win < d) { d = win; m = 5; o = 5; }
  const trunk = cyl(px, py, pz, 1.9, -1.2, 0, 1.1, 0.13); if (trunk < d) { d = trunk; m = 6; o = 6; }
  const leaves = Math.min(sph(px, py, pz, 1.9, 1.5, -1.2, 0.62), sph(px, py, pz, 2.25, 1.15, -0.95, 0.42)); if (leaves < d) { d = leaves; m = 7; o = 7; }
  const body = cyl(px, py, pz, 0.6, 1.0, 0, 0.62, 0.16); if (body < d) { d = body; m = 8; o = 8; }
  const head = sph(px, py, pz, 0.6, 0.78, 1.0, 0.13); if (head < d) { d = head; m = 9; o = 9; }
  const post = cyl(px, py, pz, 0.2, 1.75, 0, 0.9, 0.035); if (post < d) { d = post; m = 10; o = 10; }
  const lamp = box(px, py, pz, 0.2, 0.98, 1.75, 0.08, 0.09, 0.08); if (lamp < d) { d = lamp; m = 11; o = 11; }
  const rock = sph(px, py, pz, -2.3, 0.15, 1.4, 0.38) + 0.04 * Math.sin(px * 9) * Math.sin(pz * 7); if (rock < d) { d = rock; m = 12; o = 12; }
  return [d, m, o];
}
export const ALBEDO = [[0.17, 0.32, 0.1], [0.08, 0.2, 0.32], [0.62, 0.5, 0.36], [0.45, 0.13, 0.09], [0.28, 0.16, 0.08], [1, 0.8, 0.4],
  [0.25, 0.15, 0.08], [0.1, 0.3, 0.09], [0.15, 0.22, 0.45], [0.75, 0.55, 0.42], [0.1, 0.1, 0.1], [1, 0.75, 0.35], [0.4, 0.4, 0.42]];
export const EMISSIVE = { 5: 1.6, 11: 4 };
export const SUN = (() => { const l = Math.hypot(-0.45, 0.8, 0.4); return [-0.45 / l, 0.8 / l, 0.4 / l]; })();
export const LANTERN = [0.2, 0.98, 1.75];

export function sceneNormal(px, py, pz) {
  const e = 1e-3, f = (x, y, z) => sceneMap(x, y, z)[0];
  const nx = f(px + e, py, pz) - f(px - e, py, pz), ny = f(px, py + e, pz) - f(px, py - e, pz), nz = f(px, py, pz + e) - f(px, py, pz - e), l = Math.hypot(nx, ny, nz);
  return [nx / l, ny / l, nz / l];
}
// March from o along unit direction r. Returns [t, material, object] or null.
export function march(ox, oy, oz, rx, ry, rz, tMax = 40) {
  let t = 0;
  for (let i = 0; i < 160 && t < tMax; i++) {
    const [d, m, o] = sceneMap(ox + rx * t, oy + ry * t, oz + rz * t);
    if (d < 1e-3 * (1 + t)) return [t, m, o];
    t += d * 0.9;
  }
  return null;
}
export function hardShadow(px, py, pz) {
  const h = march(px + SUN[0] * 0.02, py + SUN[1] * 0.02, pz + SUN[2] * 0.02, SUN[0], SUN[1], SUN[2], 12);
  return h ? 0 : 1;
}
// Sky radiance by direction (linear): a warm horizon to a blue zenith.
export function sky(rx, ry, rz) { const k = Math.max(0, ry); return [0.85 - 0.6 * k, 0.82 - 0.4 * k, 0.78 + 0.1 * k]; }
// Camera-independent linear colour of a surface point.
export function shadePoint(px, py, pz, n, m) {
  if (EMISSIVE[m]) return ALBEDO[m].map((a) => a * EMISSIVE[m]);
  let alb = ALBEDO[m];
  if (m === 0) { const k = ((Math.floor(px * 2) + Math.floor(pz * 2)) & 1) ? 1 : 0.86; alb = alb.map((a) => a * k); }
  const sun = Math.max(0, n[0] * SUN[0] + n[1] * SUN[1] + n[2] * SUN[2]) * hardShadow(px, py, pz) * 2.6;
  const skyF = (0.55 + 0.45 * n[1]) * 0.55;
  const lx = LANTERN[0] - px, ly = LANTERN[1] - py, lz = LANTERN[2] - pz, ld = Math.hypot(lx, ly, lz);
  const lan = Math.max(0, (n[0] * lx + n[1] * ly + n[2] * lz) / ld) * 1.2 / (ld * ld + 0.2);
  return alb.map((a, k) => a * (sun * [1, 0.93, 0.8][k] + skyF * [0.6, 0.75, 1][k] + lan * [1, 0.7, 0.35][k]));
}
