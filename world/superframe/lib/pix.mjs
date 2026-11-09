// pix.mjs: moving pixels between the upstream shapes and the superframe port types, plus the rasteriser the
// converters use. The drawing primitives are the feed-24 rasteriser (exact-distance antialiasing) and the feed-25
// hud fill; this file only adapts shapes.
import { surface, line as rline, disc as rdisc, toLin, toSrgb, hexLin } from '../../feed-24/build/raster.js';
import { fillShape, insidePoly } from '../../feed-25/build/hud.mjs';
import { Layer } from '../../feed-25/build/compose.mjs';
import { make } from './types.mjs';

export { toLin, toSrgb, hexLin };
// NaN clamps to the low end, so a degenerate upstream field (an empty mask) renders as ground instead of throwing
const clamp = (x, a = 0, b = 1) => (!(x >= a) ? a : x > b ? b : x);

// ---- rasters from upstream shapes
export function fromRGB3(w, h, px, alpha = null) {
  const R = make.raster(w, h), d = R.data;
  for (let i = 0; i < w * h; i++) { d[4 * i] = px[3 * i]; d[4 * i + 1] = px[3 * i + 1]; d[4 * i + 2] = px[3 * i + 2]; d[4 * i + 3] = alpha ? alpha[i] : 1; }
  return R;
}
export function fromPremul(w, h, px) {
  const R = make.raster(w, h), d = R.data;
  for (let i = 0; i < w * h; i++) { const a = px[4 * i + 3]; const k = a > 1e-6 ? 1 / a : 0; d[4 * i] = px[4 * i] * k; d[4 * i + 1] = px[4 * i + 1] * k; d[4 * i + 2] = px[4 * i + 2] * k; d[4 * i + 3] = clamp(a); }
  return R;
}
export function fromSRGB8(w, h, rgba) {
  const R = make.raster(w, h), d = R.data, lut = new Float32Array(256);
  for (let v = 0; v < 256; v++) lut[v] = toLin(v / 255);
  for (let i = 0; i < w * h; i++) { d[4 * i] = lut[rgba[4 * i]]; d[4 * i + 1] = lut[rgba[4 * i + 1]]; d[4 * i + 2] = lut[rgba[4 * i + 2]]; d[4 * i + 3] = rgba[4 * i + 3] / 255; }
  return R;
}
export const fromLayer = L => fromRGB3(L.w, L.h, L.px, L.a ?? null);

// A raster as a feed-25 Layer (premultiplied over a ground), so every compositor op can run on it.
export function toLayer(R, { seed = 1, ground = [0, 0, 0] } = {}) {
  const L = new Layer(R.w, R.h, { seed }), d = R.data, p = L.px;
  for (let i = 0; i < R.w * R.h; i++) { const a = d[4 * i + 3]; for (let c = 0; c < 3; c++) p[3 * i + c] = d[4 * i + c] * a + ground[c] * (1 - a); }
  return L;
}

// Export: linear float to 8-bit sRGB with a TPDF dither of one code value (QUALITY-SPEC R2). rng is seeded.
export function toSRGB8(R, rng, { ground = null } = {}) {
  const n = R.w * R.h, o = new Uint8ClampedArray(n * 4), d = R.data, G = ground ? hexLin(ground) : null;
  for (let i = 0; i < n; i++) {
    const a = clamp(d[4 * i + 3]);
    for (let c = 0; c < 3; c++) {
      let v = clamp(d[4 * i + c]);
      if (G) v = v * a + G[c] * (1 - a);
      o[4 * i + c] = Math.round(toSrgb(v) * 255 + (rng() - rng()));
    }
    o[4 * i + 3] = G ? 255 : Math.round(a * 255);
  }
  return o;
}

// ---- fields
export function luma(R) {
  const F = make.field(R.w, R.h), d = R.data;
  for (let i = 0; i < R.w * R.h; i++) F.data[i] = clamp(toSrgb(clamp(0.2126 * d[4 * i] + 0.7152 * d[4 * i + 1] + 0.0722 * d[4 * i + 2])) * d[4 * i + 3]);
  return F;
}
export function normalise(data) {
  let lo = Infinity, hi = -Infinity;
  for (const v of data) { if (v < lo) lo = v; if (v > hi) hi = v; }
  const k = hi > lo ? 1 / (hi - lo) : 0, out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = (data[i] - lo) * k;
  return out;
}
// Colour a scalar field through hex stops (interpolated in linear light).
export function colormap(F, stops) {
  const C = stops.map(hexLin), n = C.length - 1, R = make.raster(F.w, F.h), d = R.data;
  for (let i = 0; i < F.w * F.h; i++) {
    const t = clamp(F.data[F.channels === 2 ? 2 * i : i]) * n, k = Math.min(n - 1, Math.floor(t)), f = t - k, a = C[k], b = C[k + 1];
    d[4 * i] = a[0] + (b[0] - a[0]) * f; d[4 * i + 1] = a[1] + (b[1] - a[1]) * f; d[4 * i + 2] = a[2] + (b[2] - a[2]) * f; d[4 * i + 3] = 1;
  }
  return R;
}
// Bilinear resample of a scalar field to w x h.
export function resample(F, w, h) {
  if (F.w === w && F.h === h) return F;
  const out = make.field(w, h), sx = F.w / w, sy = F.h / h, M = F.data, W = F.w;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const fx = clamp((x + 0.5) * sx - 0.5, 0, F.w - 1.001), fy = clamp((y + 0.5) * sy - 0.5, 0, F.h - 1.001);
    const x0 = fx | 0, y0 = fy | 0, ax = fx - x0, ay = fy - y0, i = y0 * W + x0;
    out.data[y * w + x] = (M[i] * (1 - ax) + M[i + 1] * ax) * (1 - ay) + (M[i + W] * (1 - ax) + M[i + W + 1] * ax) * ay;
  }
  return out;
}
export function resampleRaster(R, w, h) {
  if (R.w === w && R.h === h) return R;
  const out = make.raster(w, h);
  for (let c = 0; c < 4; c++) {
    const F = make.field(R.w, R.h); for (let i = 0; i < R.w * R.h; i++) F.data[i] = R.data[4 * i + c];
    const G = resample(F, w, h); for (let i = 0; i < w * h; i++) out.data[4 * i + c] = G.data[i];
  }
  return out;
}

// ---- vector to coverage and colour
// Coverage field of a vector set: strokes antialiased by exact distance, closed filled paths 4 x 4 supersampled.
export function rasterizeVector(V, { w = V.w, h = V.h, width = 1.2, fill = true } = {}) {
  const S = surface(w, h), sx = w / V.w, sy = h / V.h, white = [1, 1, 1];
  for (const p of V.paths) {
    const pts = p.pts.map(([x, y]) => [x * sx, y * sy]);
    if (pts.length === 0) continue;
    if (fill && p.closed && p.fill !== null && pts.length > 2 && (p.fill || !p.width)) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      fillShape(S, x0, y0, x1, y1, insidePoly(pts), '#ffffff', 1);
      if (!p.width) continue;
    }
    const base = (p.width ?? width) * Math.sqrt(sx * sy);
    if (pts.length === 1) { rdisc(S, pts[0][0], pts[0][1], base / 2, white); continue; }
    const n = p.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      const wv = p.widths ? ((p.widths[i] + p.widths[(i + 1) % pts.length]) / 2) * Math.sqrt(sx * sy) : base;
      if (wv > 0.05) rline(S, a[0], a[1], b[0], b[1], Math.max(0.6, wv), white, Math.min(1, wv / 0.6));
    }
  }
  const F = make.field(w, h);
  for (let i = 0; i < w * h; i++) F.data[i] = clamp(S.px[3 * i]);
  return F;
}

// Ink a coverage field onto a ground.
export function inkOnGround(F, ink, ground) {
  const I = hexLin(ink), G = hexLin(ground), R = make.raster(F.w, F.h), d = R.data;
  for (let i = 0; i < F.w * F.h; i++) { const a = clamp(F.data[i]); for (let c = 0; c < 3; c++) d[4 * i + c] = G[c] + (I[c] - G[c]) * a; d[4 * i + 3] = 1; }
  return R;
}

// Splat particles as antialiased discs (additive density) into a field, then normalise to 0..1 by percentile.
export function splatParticles(P, { w = P.w, h = P.h, radius = Math.max(0.8, Math.min(4, 0.35 * Math.sqrt((P.w * P.h) / Math.max(1, P.n)))) } = {}) {
  const S = surface(w, h), sx = w / P.w, sy = h / P.h, k = Math.sqrt(sx * sy);
  for (let i = 0; i < P.n; i++) {
    const r = Math.max(0.5, (P.size ? P.size[i] : radius) * k), t = P.tone ? P.tone[i] : 1;
    rdisc(S, P.x[i] * sx, P.y[i] * sy, r, [t, t, t], 0.9, 'add');
  }
  const F = make.field(w, h), vals = [];
  for (let i = 0; i < w * h; i++) { F.data[i] = S.px[3 * i]; if (S.px[3 * i] > 0) vals.push(S.px[3 * i]); }
  vals.sort((a, b) => a - b);
  const top = vals.length ? vals[Math.floor(vals.length * 0.98)] || 1 : 1;
  for (let i = 0; i < w * h; i++) F.data[i] = clamp(F.data[i] / top);
  return F;
}

// Paint a vector set in its own colours: closed paths with a fill hex are filled (4 x 4 supersampled), strokes are
// drawn in their stroke colour or the ink, on the ground. Paths keep their order, so later paths cover earlier ones.
export function paintVector(V, { w = V.w, h = V.h, ground = '#ebe5d8', ink = '#15130f', width = 1.2 } = {}) {
  const S = surface(w, h, hexLin(ground)), sx = w / V.w, sy = h / V.h, k = Math.sqrt(sx * sy);
  for (const p of V.paths) {
    const pts = p.pts.map(([x, y]) => [x * sx, y * sy]);
    if (!pts.length) continue;
    const fillHex = p.closed && p.fill !== null && pts.length > 2 && (p.fill || !p.width) ? (p.fill && p.fill !== '#000000' ? p.fill : ink) : null;
    if (fillHex) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
      fillShape(S, x0, y0, x1, y1, insidePoly(pts), fillHex, 1);
      if (!p.width) continue;
    }
    const c = hexLin(p.stroke ?? ink), base = (p.width ?? width) * k;
    if (pts.length === 1) { rdisc(S, pts[0][0], pts[0][1], base / 2, c); continue; }
    const n = p.closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length], wv = p.widths ? ((p.widths[i] + p.widths[(i + 1) % pts.length]) / 2) * k : base;
      if (wv > 0.05) rline(S, a[0], a[1], b[0], b[1], Math.max(0.6, wv), c, Math.min(1, wv / 0.6));
    }
  }
  return fromRGB3(w, h, S.px);
}
