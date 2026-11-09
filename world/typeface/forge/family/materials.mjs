// forge/family/materials.mjs
// Material on the outline, after the pen: changes that move existing points and never add or remove
// one, so a material is a variation axis in a real font file.
//   subdivide  straight edges get interior points (once, the same for every master of a build), so
//              wear has somewhere to act on a stem
//   inkSpread  every point moves outward along its normal: letterpress gain, ink bleeding into paper
//   wear       every point moves along its normal by smooth seeded noise: a worn, torn or bitten edge
// Both act on contour points only; composites inherit them through their components.

import { mulberry32 } from "../upstream/media-engine/seed.mjs";

export function subdivide(glyphs, parts = 5) {
  for (const g of Object.values(glyphs)) {
    if (!g.contours?.length) continue;
    g.contours = g.contours.map((c) => {
      const pts = [], on = [], n = c.pts.length;
      for (let i = 0; i < n; i++) {
        const a = c.pts[i], b = c.pts[(i + 1) % n];
        pts.push(a); on.push(c.on[i]);
        if (c.on[i] && c.on[(i + 1) % n]) {
          for (let s = 1; s < parts; s++) { pts.push([a[0] + (b[0] - a[0]) * s / parts, a[1] + (b[1] - a[1]) * s / parts]); on.push(true); }
        }
      }
      return { pts, on };
    });
  }
  return glyphs;
}

// Outward normal at each point. Ink rings run clockwise (ink on the right) and counters run
// counter-clockwise (the hole on the left), so "away from the ink" is the left normal for both.
function normals(c) {
  const P = c.pts, n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i - 1 + n) % n], b = P[(i + 1) % n];
    let dx = b[0] - a[0], dy = b[1] - a[1];
    const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
    out.push([-dy, dx]);
  }
  return out;
}

function displace(glyphs, f) {
  for (const g of Object.values(glyphs)) {
    if (!g.contours?.length) continue;
    g.contours = g.contours.map((c) => {
      const N = normals(c);
      return { pts: c.pts.map((p, i) => { const d = f(p, N[i]); return [Math.round((p[0] + N[i][0] * d) * 100) / 100, Math.round((p[1] + N[i][1] * d) * 100) / 100]; }), on: c.on };
    });
  }
  return glyphs;
}

export const inkSpread = (glyphs, s) => displace(glyphs, () => s);

// Smooth 2D value noise on a lattice, seeded, in [-1, 1].
function noise2(seed, cell) {
  const r = mulberry32(seed >>> 0), table = Array.from({ length: 4096 }, () => r() * 2 - 1);
  const h = (i, j) => table[((i * 73856093) ^ (j * 19349663)) & 4095];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const X = x / cell, Y = y / cell, i = Math.floor(X), j = Math.floor(Y), u = sm(X - i), v = sm(Y - j);
    const a = h(i, j) + (h(i + 1, j) - h(i, j)) * u, b = h(i, j + 1) + (h(i + 1, j + 1) - h(i, j + 1)) * u;
    return a + (b - a) * v;
  };
}

// Wear: two octaves of noise, biased inward (wear removes ink more than it adds).
export function wear(glyphs, amp, seed = 1797) {
  const n1 = noise2(seed, 46), n2 = noise2(seed + 1, 13);
  return displace(glyphs, ([x, y]) => amp * (0.7 * n1(x, y) + 0.3 * n2(x, y) - 0.35));
}
