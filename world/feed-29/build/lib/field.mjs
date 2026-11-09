// lib/field.mjs: float rasters, seeded noise, clumped film grain, signed-distance coverage and export for the feed-29
// builds. A raster here is { w, h, px: Float32Array(w*h*3) } in linear-light sRGB primaries (the superframe raster type
// adds alpha; adapters convert). Seeds follow the superstack rule xmur3-mulberry32/1.
import { Mulberry32, xmur3 } from '../../../substrate/lib/vendor/superstack.mjs';
import { toSrgb, toLin } from './color.mjs';

export const SEED_RULE = 'xmur3-mulberry32/1';
export function rng(seed) { const m = new Mulberry32(xmur3(String(seed))); return () => m.nextFloat(); }
export const raster = (w, h, fill = [0, 0, 0]) => { const px = new Float32Array(w * h * 3); for (let i = 0; i < w * h; i++) { px[3 * i] = fill[0]; px[3 * i + 1] = fill[1]; px[3 * i + 2] = fill[2]; } return { w, h, px }; };
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
// Coverage of a shape from its signed distance d (px, negative inside): a 1 px anti-aliased edge widened by `soft` px.
export const cover = (d, soft = 0) => clamp(0.5 - d / (1 + soft));

// Gaussian normal from a uniform source (Box-Muller, one value per call).
export function gauss(r) { let u = r(); if (u < 1e-12) u = 1e-12; return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); }

// Separable Gaussian blur of a scalar field, edges clamped. sigma in px.
export function blur(f, w, h, sigma) {
  if (sigma <= 0) return Float32Array.from(f);
  const R = Math.ceil(sigma * 3), k = new Float32Array(2 * R + 1); let s = 0;
  for (let i = -R; i <= R; i++) s += (k[i + R] = Math.exp(-0.5 * (i / sigma) ** 2));
  for (let i = 0; i < k.length; i++) k[i] /= s;
  const t = new Float32Array(w * h), o = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -R; i <= R; i++) a += k[i + R] * f[y * w + clamp(x + i, 0, w - 1)]; t[y * w + x] = a; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let a = 0; for (let i = -R; i <= R; i++) a += k[i + R] * t[clamp(y + i, 0, h - 1) * w + x]; o[y * w + x] = a; }
  return o;
}

// Film grain: white Gaussian noise blurred to a correlation width, renormalised to unit SD. The autocorrelation of
// blurred white noise is a Gaussian of sigma x sqrt 2, so its full width at half maximum is 3.33 x sigma. QUALITY-SPEC
// R4 asks 1.9 to 3.1 px at 1x (grain.py corr_halfwidth, which reports the full width), so sigma 0.57 to 0.93.
export function grain(w, h, { sigma = 0.8, seed = 'grain' } = {}) {
  const r = rng(seed), n = new Float32Array(w * h);
  for (let i = 0; i < n.length; i++) n[i] = gauss(r);
  const b = blur(n, w, h, sigma); let m = 0, v = 0;
  for (const x of b) m += x; m /= b.length; for (const x of b) v += (x - m) ** 2; v = Math.sqrt(v / b.length) || 1;
  for (let i = 0; i < b.length; i++) b[i] = (b[i] - m) / v;
  return b;
}

// Encode for display: linear -> sRGB, plus mono grain of `sd` code values (added in display space, where film grain
// is visible at an even strength), plus a TPDF dither of one code value. 8-bit RGBA, or 16-bit when depth is 16.
export function encode(R, { grainSd = 0, grainSigma = 0.8, seed = 'enc', depth = 8 } = {}) {
  const { w, h, px } = R, n = w * h, G = grainSd > 0 ? grain(w, h, { sigma: grainSigma, seed: seed + ':grain' }) : null, r = rng(seed + ':dither');
  const max = depth === 16 ? 65535 : 255, out = depth === 16 ? new Uint16Array(n * 4) : new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i++) {
    const gr = G ? G[i] * grainSd / 255 : 0;
    for (let c = 0; c < 3; c++) out[4 * i + c] = clamp(Math.round((clamp(toSrgb(Math.max(0, px[3 * i + c]))) + gr) * max + (depth === 16 ? 0 : r() - r())), 0, max);
    out[4 * i + 3] = max;
  }
  return out;
}
// The inverse for tests and the pixel tool: 8-bit RGBA to a linear raster.
export function decode(w, h, rgba) {
  const R = raster(w, h), lut = new Float32Array(256); for (let v = 0; v < 256; v++) lut[v] = toLin(v / 255);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) R.px[3 * i + c] = lut[rgba[4 * i + c]];
  return R;
}
// Luma of an 8-bit RGBA buffer as [0,1] (golden thumbnails and probes).
export const luma8 = (rgba, n) => Float32Array.from({ length: n }, (_, i) => (0.2126 * rgba[4 * i] + 0.7152 * rgba[4 * i + 1] + 0.0722 * rgba[4 * i + 2]) / 255);

// Box resample of a raster (area average when shrinking, nearest when growing), for previews and pixel grids.
export function resize(R, tw, th) {
  const o = raster(tw, th), sx = R.w / tw, sy = R.h / th;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    let a = 0, b = 0, c = 0, n = 0;
    for (let j = y0; j < y1 && j < R.h; j++) for (let i = x0; i < x1 && i < R.w; i++) { const k = 3 * (j * R.w + i); a += R.px[k]; b += R.px[k + 1]; c += R.px[k + 2]; n++; }
    const k = 3 * (y * tw + x); o.px[k] = a / n; o.px[k + 1] = b / n; o.px[k + 2] = c / n;
  }
  return o;
}
