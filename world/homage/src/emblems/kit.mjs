// src/emblems/kit.mjs: drawing helpers for the emblems, on top of src/raster.mjs Plates. All sizes are fractions of
// the emblem side S unless stated; widths in px at S. Shapes fill by coverage with 4 x 4 supersampling at edges.
import { Plate, rng } from '../raster.mjs';
import { fbm } from '../tonefield.mjs';

export { fbm, rng };
export const TAU = Math.PI * 2;
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);

export function canvas(S, seed) {
  const ink = new Plate(S, S), spot = new Plate(S, S), R = rng(seed);
  const lw = Math.max(0.6, S / 420);
  const P = (u) => u * S;
  return {
    S, ink, spot, R, lw,
    line(x0, y0, x1, y1, w = 1, plate = ink, a = 1) { plate.seg(P(x0), P(y0), P(x1), P(y1), w * lw, w * lw, a); },
    poly(pts, w = 1, plate = ink, closed = false, a = 1) {
      const q = closed ? [...pts, pts[0]] : pts;
      for (let i = 0; i + 1 < q.length; i++) plate.seg(P(q[i][0]), P(q[i][1]), P(q[i + 1][0]), P(q[i + 1][1]), w * lw, w * lw, a);
    },
    circle(cx, cy, r, w = 1, plate = ink, a0 = 0, a1 = TAU, n = 160, a = 1) {
      const pts = []; for (let i = 0; i <= n; i++) { const t = a0 + ((a1 - a0) * i) / n; pts.push([cx + Math.cos(t) * r, cy + Math.sin(t) * r]); }
      this.poly(pts, w, plate, false, a);
    },
    dot(x, y, r, plate = ink, a = 1) { plate.disc(P(x), P(y), r * S, a); },
    // fill where inside(u, v) holds (u, v in 0..1), with anti-aliased edges by 4 x 4 supersampling
    fill(inside, plate = ink, a = 1, bbox = [0, 0, 1, 1]) {
      const [x0, y0, x1, y1] = bbox.map((v) => Math.round(v * S));
      for (let y = Math.max(0, y0); y < Math.min(S, y1); y++) for (let x = Math.max(0, x0); x < Math.min(S, x1); x++) {
        let c = 0; for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) c += inside((x + (i + 0.5) / 4) / S, (y + (j + 0.5) / 4) / S) ? 1 : 0;
        if (c) plate.put(x, y, (c / 16) * a);
      }
    },
    // parallel hatch at angle ang, spacing sp (fraction of S), clipped to inside()
    hatch(inside, ang, sp, w = 0.8, plate = ink, a = 1) {
      const dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx, step = 1 / S;
      for (let o = -1.5; o <= 1.5; o += sp) {
        let prev = null;
        for (let t = -1.5; t <= 1.5; t += step * 2) {
          const u = 0.5 + nx * o + dx * t, v = 0.5 + ny * o + dy * t, ok = u >= 0 && v >= 0 && u <= 1 && v <= 1 && inside(u, v);
          if (ok && prev) this.line(prev[0], prev[1], u, v, w, plate, a);
          prev = ok ? [u, v] : null;
        }
      }
    },
    stipple(density, n, r = 0.0016, plate = ink) { // density(u, v) in 0..1
      for (let k = 0; k < n; k++) { const u = this.R(), v = this.R(); if (this.R() < density(u, v)) plate.disc(u * S, v * S, Math.max(0.5, r * S)); }
    },
  };
}

export const inPoly = (pts) => (u, v) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
export const inCircle = (cx, cy, r) => (u, v) => (u - cx) ** 2 + (v - cy) ** 2 <= r * r;
export const inRect = (x0, y0, x1, y1) => (u, v) => u >= x0 && u <= x1 && v >= y0 && v <= y1;
