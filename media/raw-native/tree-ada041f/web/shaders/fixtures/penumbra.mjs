// "Penumbra Yard": the analytic scene of the RT visibility study. A ground plane seen from above
// (orthographic), a spherical light, and one blocker: a thin wall along x, the same wall along z,
// or a sphere. Exact ray intersection only (slab test for the wall, quadratic for the sphere).
// Units are metres, y up.
export const YARD = { px: 256, metres: 8, albedo: 0.8, ambient: 0.1, intensity: 9 };
export const yardLight = (dx = 0) => ({ pos: [0.3 + dx, 3, -0.6], radius: 0.6 });
export const BLOCKERS = {
  "wall-x": { kind: "box", lo: [-3, 0, 0.775], hi: [3, 1.2, 0.825] },
  "wall-z": { kind: "box", lo: [0.775, 0, -3], hi: [0.825, 1.2, 3] },
  sphere: { kind: "sphere", c: [0.6, 1.0, 0.6], r: 0.5 },
};
// Does the segment P -> Q cross the blocker?
export function occludedBy(b) {
  if (b.kind === "box") return (P, Q) => {
    let t0 = 0, t1 = 1;
    for (let k = 0; k < 3; k++) {
      const d = Q[k] - P[k];
      if (Math.abs(d) < 1e-12) { if (P[k] < b.lo[k] || P[k] > b.hi[k]) return false; continue; }
      let a = (b.lo[k] - P[k]) / d, c = (b.hi[k] - P[k]) / d; if (a > c) [a, c] = [c, a];
      t0 = Math.max(t0, a); t1 = Math.min(t1, c); if (t0 > t1) return false;
    }
    return true;
  };
  return (P, Q) => {
    const d = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], o = [P[0] - b.c[0], P[1] - b.c[1], P[2] - b.c[2]];
    const A = d[0] * d[0] + d[1] * d[1] + d[2] * d[2], B = 2 * (o[0] * d[0] + o[1] * d[1] + o[2] * d[2]), C = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - b.r * b.r, disc = B * B - 4 * A * C;
    if (disc < 0) return false;
    const s = Math.sqrt(disc), t0 = (-B - s) / (2 * A), t1 = (-B + s) / (2 * A);
    return t1 >= 0 && t0 <= 1;
  };
}
// World point of pixel (x, y) on the ground.
export const yardPoint = (x, y) => [-YARD.metres / 2 + ((x + 0.5) * YARD.metres) / YARD.px, 0, -YARD.metres / 2 + ((y + 0.5) * YARD.metres) / YARD.px];
// Tone of a ground point given the light's visibility V (Lambert, inverse square, clamped).
export function yardTone(P, light, V) {
  const v = [light.pos[0] - P[0], light.pos[1] - P[1], light.pos[2] - P[2]], d2 = v[0] * v[0] + v[1] * v[1] + v[2] * v[2], c = v[1] / Math.sqrt(d2);
  return Math.min(1, YARD.albedo * (YARD.ambient + (YARD.intensity * Math.max(0, c) * V) / d2));
}
