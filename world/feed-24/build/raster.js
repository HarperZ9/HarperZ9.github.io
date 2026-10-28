// raster.js: a small linear-light float rasteriser shared by the feed-24 generators. Coverage for
// lines, arcs, circles and squares comes from exact distance to the shape, so edges are antialiased
// at whatever pixel size the caller asks for (pass device pixels to render at the device pixel ratio).
// Output goes through a triangular-PDF dither before 8-bit quantisation, which removes banding in
// smooth glows. Pure; the page blits the result with putImageData, and the tests read the same pixels.

export function surface(w, h, bg = [0, 0, 0]) {
  const px = new Float32Array(w * h * 3);
  for (let i = 0; i < w * h; i++) { px[3 * i] = bg[0]; px[3 * i + 1] = bg[1]; px[3 * i + 2] = bg[2]; }
  return { w, h, px };
}

// sRGB <-> linear, both on [0, 1].
export const toLin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const toSrgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
export const hexLin = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => toLin(c / 255)); };

// Blend colour c (linear) at coverage a into pixel i. mode 'add' sums light; 'over' replaces.
function put(S, i, c, a, mode) {
  const k = 3 * i, p = S.px;
  if (mode === 'add') { p[k] += c[0] * a; p[k + 1] += c[1] * a; p[k + 2] += c[2] * a; }
  else { p[k] += (c[0] - p[k]) * a; p[k + 1] += (c[1] - p[k + 1]) * a; p[k + 2] += (c[2] - p[k + 2]) * a; }
}

const cov = (d, hw) => { const v = hw + 0.5 - d; return v <= 0 ? 0 : v >= 1 ? 1 : v; };

// Generic: visit pixels in a bounding box, coverage from a distance function.
function shade(S, x0, y0, x1, y1, dist, hw, c, alpha, mode) {
  const xa = Math.max(0, Math.floor(x0 - hw - 1)), xb = Math.min(S.w - 1, Math.ceil(x1 + hw + 1));
  const ya = Math.max(0, Math.floor(y0 - hw - 1)), yb = Math.min(S.h - 1, Math.ceil(y1 + hw + 1));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const a = cov(dist(x + 0.5, y + 0.5), hw) * alpha;
    if (a > 0) put(S, y * S.w + x, c, a, mode);
  }
}

export function line(S, ax, ay, bx, by, width, c, alpha = 1, mode = 'over') {
  const dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy || 1e-12;
  shade(S, Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), (x, y) => {
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    return Math.hypot(x - ax - t * dx, y - ay - t * dy);
  }, width / 2, c, alpha, mode);
}

// Dashed line: dash and gap in pixels along the segment, phase offsets the pattern.
export function dashed(S, ax, ay, bx, by, width, c, dash, gap, alpha = 1, phase = 0) {
  const L = Math.hypot(bx - ax, by - ay), ux = (bx - ax) / (L || 1), uy = (by - ay) / (L || 1);
  for (let s = -((phase % (dash + gap)) + dash + gap) % (dash + gap); s < L; s += dash + gap) {
    const a = Math.max(0, s), b = Math.min(L, s + dash); if (b > a) line(S, ax + ux * a, ay + uy * a, ax + ux * b, ay + uy * b, width, c, alpha);
  }
}

export function disc(S, cx, cy, r, c, alpha = 1, mode = 'over') {
  shade(S, cx - r, cy - r, cx + r, cy + r, (x, y) => Math.hypot(x - cx, y - cy), r, c, alpha, mode);
}

// Circle outline, optionally dashed by angle (dash, gap in pixels of arc length).
export function ring(S, cx, cy, r, width, c, alpha = 1, dash = 0, gap = 0) {
  const per = dash > 0 ? dash + gap : 0;
  shade(S, cx - r, cy - r, cx + r, cy + r, (x, y) => {
    const d = Math.abs(Math.hypot(x - cx, y - cy) - r);
    if (!per) return d;
    const s = (Math.atan2(y - cy, x - cx) + Math.PI) * r;
    return (s % per) < dash ? d : 1e9;
  }, width / 2, c, alpha, 'over');
}

// Arc from angle a0 to a1 (radians, a1 > a0, y down), with round caps.
export function arc(S, cx, cy, r, a0, a1, width, c, alpha = 1, mode = 'over') {
  const A0 = [cx + r * Math.cos(a0), cy + r * Math.sin(a0)], A1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
  const span = a1 - a0;
  shade(S, cx - r, cy - r, cx + r, cy + r, (x, y) => {
    let t = Math.atan2(y - cy, x - cx) - a0; t = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (t <= span) return Math.abs(Math.hypot(x - cx, y - cy) - r);
    return Math.min(Math.hypot(x - A0[0], y - A0[1]), Math.hypot(x - A1[0], y - A1[1]));
  }, width / 2, c, alpha, mode);
}

// Axis-aligned square cell, filled, with exact box coverage.
export function cell(S, x, y, s, c, alpha = 1, mode = 'over') {
  const xa = Math.max(0, Math.floor(x)), xb = Math.min(S.w - 1, Math.ceil(x + s) - 1);
  const ya = Math.max(0, Math.floor(y)), yb = Math.min(S.h - 1, Math.ceil(y + s) - 1);
  for (let j = ya; j <= yb; j++) {
    const cy = Math.min(j + 1, y + s) - Math.max(j, y); if (cy <= 0) continue;
    for (let i = xa; i <= xb; i++) {
      const cx = Math.min(i + 1, x + s) - Math.max(i, x); if (cx <= 0) continue;
      put(S, j * S.w + i, c, cx * cy * alpha, mode);
    }
  }
}

export function box(S, x, y, s, width, c, alpha = 1) {
  line(S, x, y, x + s, y, width, c, alpha); line(S, x + s, y, x + s, y + s, width, c, alpha);
  line(S, x + s, y + s, x, y + s, width, c, alpha); line(S, x, y + s, x, y, width, c, alpha);
}

// Additive Gaussian splat (glow, point sprites). sigma in pixels; energy scales the peak.
export function glow(S, cx, cy, sigma, c, energy = 1) {
  const r = Math.ceil(sigma * 3), k = -0.5 / (sigma * sigma);
  const xa = Math.max(0, Math.floor(cx - r)), xb = Math.min(S.w - 1, Math.ceil(cx + r));
  const ya = Math.max(0, Math.floor(cy - r)), yb = Math.min(S.h - 1, Math.ceil(cy + r));
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, a = energy * Math.exp((dx * dx + dy * dy) * k);
    if (a > 1e-4) put(S, y * S.w + x, c, a, 'add');
  }
}

// Seeded 32-bit generator (mulberry32) so every render is reproducible.
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// 14-bit linear -> sRGB code value table (0..255 as floats): fine enough that the table adds no steps.
const LUT = Float32Array.from({ length: 16384 }, (_, i) => toSrgb(i / 16383) * 255);

// Linear float -> sRGB 8-bit with a soft shoulder above 1 and TPDF dither (seeded, so tests are stable).
export function toRGBA(S, { seed = 7, shoulder = true, dither = true } = {}) {
  const out = new Uint8ClampedArray(S.w * S.h * 4), r = rng(seed);
  // one TPDF value per pixel, shared by the three channels: monochrome grain (QUALITY-SPEC R4 chroma_ratio)
  let dv = 0;
  for (let i = 0; i < S.w * S.h; i++) for (let c = 0; c < 3; c++) {
    if (c === 0) dv = dither ? r() - r() : 0;
    let v = S.px[3 * i + c];
    if (shoulder && v > 0.8) v = 0.8 + 0.2 * (1 - Math.exp(-(v - 0.8) / 0.2));
    const s = LUT[Math.round(Math.max(0, Math.min(1, v)) * 16383)] + dv;
    out[4 * i + c] = s < 0 ? 0 : s > 255 ? 255 : Math.round(s);
    if (c === 2) out[4 * i + 3] = 255;
  }
  return out;
}

// Luma field on [0,1] from RGBA (for SSIM goldens).
export function luma(rgba, w, h) {
  const f = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) f[i] = (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255;
  return f;
}
