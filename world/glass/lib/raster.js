// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// raster.js: the float picture shared by glass, liquid and crt. A raster is the super framework's raster port
// shape: { w, h, data: Float32Array(w*h*4) }, linear light, straight alpha. Helpers sample it with bilinear
// filtering, blur it, and encode it to 8-bit sRGB with a seeded TPDF dither so goldens are exact.
import { rng, xmur3, srgbToLinear, linearToSrgb } from '../../substrate/lib/vendor/superstack.mjs';

export { srgbToLinear, linearToSrgb };
export const raster = (w, h, data = new Float32Array(w * h * 4)) => ({ w, h, data });
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// A seeded [0, 1) source from any string or number seed.
export function random(seed) { const r = rng(String(seed)); return () => r.nextFloat(); }
export function gauss(r) { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(6.283185307179586 * r()); }
export const seedU32 = seed => xmur3(String(seed));

export function hexLin(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [srgbToLinear(((n >> 16) & 255) / 255), srgbToLinear(((n >> 8) & 255) / 255), srgbToLinear((n & 255) / 255)];
}

// Bilinear sample of one channel at (x, y) in pixel units (pixel centres at +0.5), clamped to the edge.
export function sample(R, x, y, c) {
  const { w, h, data } = R;
  x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = (y0 * w + x0) * 4 + c;
  const a = data[i], b = data[i + 4], d = data[i + w * 4], e = data[i + w * 4 + 4];
  return (a + (b - a) * fx) * (1 - fy) + (d + (e - d) * fx) * fy;
}
// Bilinear sample of a scalar field { w, h, data } (one value per pixel).
export function sampleF(F, x, y) {
  const { w, h, data } = F;
  x = clamp(x - 0.5, 0, w - 1.001); y = clamp(y - 0.5, 0, h - 1.001);
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
  return (data[i] + (data[i + 1] - data[i]) * fx) * (1 - fy) + (data[i + w] + (data[i + w + 1] - data[i + w]) * fx) * fy;
}

// Separable box blur, run `passes` times (three passes approach a Gaussian). Works on any stride.
export function boxBlur(src, w, h, r, { stride = 1, passes = 3 } = {}) {
  if (r < 1) return Float32Array.from(src);
  let a = Float32Array.from(src), b = new Float32Array(src.length);
  const n = 2 * r + 1;
  for (let p = 0; p < passes; p++) {
    for (let c = 0; c < stride; c++) {
      for (let y = 0; y < h; y++) {
        let s = 0; const row = y * w;
        for (let k = -r; k <= r; k++) s += a[(row + clamp(k, 0, w - 1)) * stride + c];
        for (let x = 0; x < w; x++) {
          b[(row + x) * stride + c] = s / n;
          s += a[(row + Math.min(w - 1, x + r + 1)) * stride + c] - a[(row + Math.max(0, x - r)) * stride + c];
        }
      }
      for (let x = 0; x < w; x++) {
        let s = 0;
        for (let k = -r; k <= r; k++) s += b[(clamp(k, 0, h - 1) * w + x) * stride + c];
        for (let y = 0; y < h; y++) {
          a[(y * w + x) * stride + c] = s / n;
          s += b[(Math.min(h - 1, y + r + 1) * w + x) * stride + c] - b[(Math.max(0, y - r) * w + x) * stride + c];
        }
      }
    }
  }
  return a;
}

// Clumped monochrome film grain: seeded Gaussian white noise through two passes of a radius-1 box (correlation
// half-width about 2 px, QUALITY-SPEC R4 asks 1.9 to 3.1), rescaled to unit SD. One value per pixel.
export function grainField(w, h, seed = 1, r = 1) {
  const R = random(`grain/${seed}`), g = new Float32Array(w * h);
  for (let i = 0; i < g.length; i++) g[i] = gauss(R);
  const b = boxBlur(g, w, h, r, { passes: 3 });
  let s = 0; for (const v of b) s += v * v; const k = 1 / Math.sqrt(s / b.length || 1);
  for (let i = 0; i < b.length; i++) b[i] *= k;
  return b;
}

// Linear raster to 8-bit sRGB RGBA with a seeded TPDF dither (deterministic under the seed). grain: SD in 8-bit
// code values of a mono clumped grain added in the encoded domain, the way film grain sits in density; it is
// stronger in the mid-tones and fades toward black and white (a parabola on the encoded value).
export function toSRGB8(R, seed = 1, { grain = 0, grainR = 1 } = {}) {
  const { w, h, data } = R, o = new Uint8ClampedArray(w * h * 4), r = random(`dither/${seed}`);
  const G = grain > 0 ? grainField(w, h, seed, grainR) : null;
  for (let i = 0; i < w * h; i++) {
    let n = 0;
    if (G) { const y = linearToSrgb(clamp(0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2])); n = G[i] * grain * (0.35 + 2.6 * y * (1 - y)); }
    const d = G ? r() - r() : 0; // with grain on, one mono dither value per pixel keeps the noise colourless (R4)
    for (let c = 0; c < 3; c++) o[i * 4 + c] = Math.round(linearToSrgb(clamp(data[i * 4 + c])) * 255 + n + (G ? d : r() - r()));
    o[i * 4 + 3] = Math.round(clamp(data[i * 4 + 3]) * 255);
  }
  return o;
}
export function fromSRGB8(w, h, rgba) {
  const R = raster(w, h), lut = new Float32Array(256).map((_, i) => srgbToLinear(i / 255));
  for (let i = 0; i < w * h * 4; i++) R.data[i] = (i & 3) === 3 ? rgba[i] / 255 : lut[rgba[i]];
  return R;
}

// Resize with area averaging when shrinking and bilinear when growing.
export function resize(R, w, h) {
  const O = raster(w, h), sx = R.w / w, sy = R.h / h;
  if (sx <= 1 && sy <= 1) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) O.data[(y * w + x) * 4 + c] = sample(R, (x + 0.5) * sx, (y + 0.5) * sy, c);
    return O;
  }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx)), y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    const acc = [0, 0, 0, 0]; let n = 0;
    for (let yy = y0; yy < Math.min(y1, R.h); yy++) for (let xx = x0; xx < Math.min(x1, R.w); xx++) { const i = (yy * R.w + xx) * 4; for (let c = 0; c < 4; c++) acc[c] += R.data[i + c]; n++; }
    for (let c = 0; c < 4; c++) O.data[(y * w + x) * 4 + c] = acc[c] / Math.max(1, n);
  }
  return O;
}

// Mean SSIM on luma over 8 x 8 windows (stride 4), the comparison the golden tests use.
export function ssim(a, b, w, h) {
  const L = (rgba, i) => 0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2];
  const C1 = (0.01 * 255) ** 2, C2 = (0.03 * 255) ** 2; let s = 0, n = 0;
  for (let y = 0; y + 8 <= h; y += 4) for (let x = 0; x + 8 <= w; x += 4) {
    let ma = 0, mb = 0, va = 0, vb = 0, cv = 0;
    for (let j = 0; j < 8; j++) for (let k = 0; k < 8; k++) { const i = ((y + j) * w + x + k) * 4, p = L(a, i), q = L(b, i); ma += p; mb += q; va += p * p; vb += q * q; cv += p * q; }
    ma /= 64; mb /= 64; va = va / 64 - ma * ma; vb = vb / 64 - mb * mb; cv = cv / 64 - ma * mb;
    s += ((2 * ma * mb + C1) * (2 * cv + C2)) / ((ma * ma + mb * mb + C1) * (va + vb + C2)); n++;
  }
  return s / n;
}

export function fnv(bytes) { let h = 0x811c9dc5; for (let i = 0; i < bytes.length; i++) { h ^= bytes[i]; h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16).padStart(8, '0'); }
