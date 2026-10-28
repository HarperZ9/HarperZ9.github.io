// src/raster.mjs: an ink plate. One float coverage channel per separation (0 = paper, 1 = full ink), drawn with
// analytic anti-aliasing (coverage falls off over 1 px at every edge, QUALITY-SPEC R3, R3b), composited "over"
// so two marks on one spot deepen the ink without exceeding 1. Plates are separations, as on a press: the collage
// tints them (black ink, cream stock, one spot colour), so one render serves every ground and theme.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { encodePNG } from '../../feed-23/build/brush/png.js';

export class Plate {
  constructor(w, h) { this.w = w | 0; this.h = h | 0; this.c = new Float32Array(this.w * this.h); }
  put(x, y, a) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = y * this.w + x, k = a > 1 ? 1 : a;
    this.c[i] += k * (1 - this.c[i]);
  }
  // A round-capped segment from (x0, y0) to (x1, y1), radius r0 to r1, alpha a. Hairlines under 0.5 px radius are
  // drawn at 0.5 px with alpha scaled by width, never as sub-pixel strokes (R3b).
  seg(x0, y0, x1, y1, r0, r1 = r0, a = 1) {
    let rr0 = r0, rr1 = r1, aa = a;
    const rm = Math.max(r0, r1);
    if (rm < 0.5) { aa *= rm / 0.5; rr0 = rr1 = 0.5; }
    const R = Math.max(rr0, rr1) + 1;
    const xa = Math.max(0, Math.floor(Math.min(x0, x1) - R)), xb = Math.min(this.w - 1, Math.ceil(Math.max(x0, x1) + R));
    const ya = Math.max(0, Math.floor(Math.min(y0, y1) - R)), yb = Math.min(this.h - 1, Math.ceil(Math.max(y0, y1) + R));
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-9;
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const px = x + 0.5 - x0, py = y + 0.5 - y0;
      let t = (px * dx + py * dy) / L2; t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = px - dx * t, ey = py - dy * t, d = Math.sqrt(ex * ex + ey * ey), r = rr0 + (rr1 - rr0) * t;
      const cov = r + 0.5 - d;
      if (cov > 0) this.put(x, y, (cov > 1 ? 1 : cov) * aa);
    }
  }
  disc(x, y, r, a = 1) { this.seg(x, y, x, y, r, r, a); }
  // A polyline [x0, y0, x1, y1, ...] with one radius, or per-point radii.
  poly(pts, r, a = 1) {
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const r0 = typeof r === 'function' ? r(i / 2) : r, r1 = typeof r === 'function' ? r(i / 2 + 1) : r;
      this.seg(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], r0, r1, a);
    }
  }
  // Fill from a coverage function f(x, y) in 0..1 (already anti-aliased by the caller).
  fill(f) { for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) this.put(x, y, f(x + 0.5, y + 0.5)); }
  mean() { let s = 0; for (const v of this.c) s += v; return s / this.c.length; }
}

// Write a separation as an 8-bit grey PNG where 255 = full ink, with TPDF dither of 1 code value (R2).
export function writePlate(path, P, seed = 1) {
  const out = new Uint8Array(P.w * P.h * 4);
  let s = seed >>> 0 || 1;
  const u = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < P.c.length; i++) {
    const v = Math.max(0, Math.min(255, Math.round(P.c[i] * 255 + (u() - u()))));
    out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = v; out[i * 4 + 3] = 255;
  }
  return encodePNG(P.w, P.h, out, (b) => deflateSync(b, { level: 6 })).then((png) => writeFileSync(path, png));
}

// Proof print: ink and spot separations laid on paper, in display sRGB. Inks multiply, as transparent inks do.
export function proof(ink, spot, { paper = '#efe8da', inkHex = '#16130f', spotHex = '#c22318', seed = 7 } = {}) {
  const hx = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const P = hx(paper), K = hx(inkHex), S = hx(spotHex), out = new Uint8Array(ink.w * ink.h * 4);
  let s = seed;
  const u = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  for (let i = 0; i < ink.c.length; i++) {
    const a = ink.c[i], b = spot ? spot.c[i] : 0;
    for (let c = 0; c < 3; c++) {
      const v = P[c] * (1 - b + b * S[c]) * (1 - a + a * K[c]);
      out[i * 4 + c] = Math.max(0, Math.min(255, Math.round(v * 255 + (u() - u()))));
    }
    out[i * 4 + 3] = 255;
  }
  return out;
}

export async function writeRGBA(path, w, h, rgba) {
  writeFileSync(path, await encodePNG(w, h, rgba, (b) => deflateSync(b, { level: 6 })));
}

// xorshift32 in [0, 1). Every technique takes randomness only from here (determinism, QUALITY-SPEC S3).
export function rng(seed = 1) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
}
