// lib/raster.mjs: the float picture every feed-30 generator draws into.
// A raster is { w, h, data: Float32Array(w*h*4) }: linear light, straight alpha, the same shape as the type engine's
// surface.albedo and the superframe's raster port, so a result crosses into either without conversion.
// Pure; runs in node and the browser.
import { hex as hexLin, clamp } from '../../../typeengine/lib/material.mjs';
import { rngFrom } from '../../../superframe/lib/seed.mjs';
import { boxBlur } from '../../../techniques/lib/util.js';

export { hexLin, clamp, rngFrom };

/** A raster filled with a ground colour (hex), or transparent when ground is null. */
export function canvas(w, h, ground = null) {
  const R = { w, h, data: new Float32Array(w * h * 4) };
  if (ground) { const c = hexLin(ground); for (let i = 0; i < w * h; i++) { R.data.set(c, i * 4); R.data[i * 4 + 3] = 1; } }
  return R;
}

/** Straight-alpha "over": paint colour rgb (linear) with per-pixel coverage cov (0..1) times alpha. */
export function paint(R, cov, rgb, alpha = 1) {
  const d = R.data;
  for (let i = 0; i < cov.length; i++) {
    const a = cov[i] * alpha; if (a <= 0) continue;
    const da = d[i * 4 + 3], oa = a + da * (1 - a);
    for (let c = 0; c < 3; c++) d[i * 4 + c] = oa > 0 ? (rgb[c] * a + d[i * 4 + c] * da * (1 - a)) / oa : 0;
    d[i * 4 + 3] = oa;
  }
  return R;
}

/** Paint a per-pixel colour field (Float32Array w*h*3, linear) through coverage. */
export function paintField(R, cov, rgbField, alpha = 1) {
  const d = R.data;
  for (let i = 0; i < cov.length; i++) {
    const a = cov[i] * alpha; if (a <= 0) continue;
    const da = d[i * 4 + 3], oa = a + da * (1 - a);
    for (let c = 0; c < 3; c++) d[i * 4 + c] = (rgbField[i * 3 + c] * a + d[i * 4 + c] * da * (1 - a)) / oa;
    d[i * 4 + 3] = oa;
  }
  return R;
}

/** Add emitted light (cov times rgb), as on a dark panel. Alpha becomes the max of both. */
export function addLight(R, cov, rgb, gain = 1) {
  const d = R.data;
  for (let i = 0; i < cov.length; i++) { const a = cov[i] * gain; if (a <= 0) continue; for (let c = 0; c < 3; c++) d[i * 4 + c] += rgb[c] * a; d[i * 4 + 3] = Math.max(d[i * 4 + 3], clamp(cov[i])); }
  return R;
}

/** A linear gradient ground between hex stops along an angle (degrees, 90 = top to bottom). */
export function gradient(w, h, stops, angleDeg = 90) {
  const R = canvas(w, h), a = (angleDeg * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  const C = stops.map(hexLin), half = (Math.abs(ux) * w + Math.abs(uy) * h) / 2;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const t = clamp(((x - w / 2) * ux + (y - h / 2) * uy) / (2 * half) + 0.5) * (C.length - 1), k = Math.min(C.length - 2, Math.floor(t)), f = t - k, i = (y * w + x) * 4;
    for (let c = 0; c < 3; c++) R.data[i + c] = C[k][c] + (C[k + 1][c] - C[k][c]) * f;
    R.data[i + 3] = 1;
  }
  return R;
}

/**
 * Clumped grain (QUALITY-SPEC R4): white noise blurred to a correlation width of `px`, scaled to `sd` code values
 * (of 255) and added in display space. mono: one noise for all channels; colour: an independent noise per channel
 * mixed with the mono one by `chroma` (0 mono, 1 fully independent).
 */
export function grain(R, { sd = 3, px = 2.3, chroma = 0, seed = 'grain' } = {}) {
  const { w, h } = R, r = rngFrom(seed), field = () => { const f = new Float32Array(w * h); for (let i = 0; i < f.length; i++) f[i] = r() - r(); const o = boxBlur(f, w, h, Math.max(1, Math.round(px / 2))) ?? f; return norm(o); };
  const m = field(), cs = chroma > 0 ? [field(), field(), field()] : null, k = sd / 255;
  const enc = (v) => (v <= 0 ? 0 : v ** (1 / 2.2)), dec = (v) => (v <= 0 ? 0 : v ** 2.2);
  for (let i = 0; i < w * h; i++) for (let c = 0; c < 3; c++) {
    const n = cs ? m[i] * (1 - chroma) + cs[c][i] * chroma : m[i];
    R.data[i * 4 + c] = dec(enc(R.data[i * 4 + c]) + n * k);
  }
  return R;
}
function norm(f) { let s = 0; for (const v of f) s += v * v; const sd = Math.sqrt(s / f.length) || 1; for (let i = 0; i < f.length; i++) f[i] /= sd; return f; }

/** Separable box blur of a scalar field (radius px), returning a new array. */
export function blur(f, w, h, r) { const o = Float32Array.from(f); const b = boxBlur(o, w, h, Math.max(1, Math.round(r))); return b ?? o; }

/** Composite raster B over A (straight alpha), in place on A. */
export function over(A, B) {
  const a = A.data, b = B.data;
  for (let i = 0; i < a.length; i += 4) {
    const s = b[i + 3]; if (s <= 0) continue; const da = a[i + 3], oa = s + da * (1 - s);
    for (let c = 0; c < 3; c++) a[i + c] = (b[i + c] * s + a[i + c] * da * (1 - s)) / oa;
    a[i + 3] = oa;
  }
  return A;
}

/** Linear raster to 8-bit sRGB RGBA bytes with alpha kept (for a browser ImageData or a PNG). */
export function toBytes(R, { dither = 'feed30' } = {}) {
  const r = rngFrom(dither), out = new Uint8ClampedArray(R.w * R.h * 4);
  const enc = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
  for (let i = 0; i < R.w * R.h; i++) {
    for (let c = 0; c < 3; c++) out[i * 4 + c] = Math.round(enc(clamp(R.data[i * 4 + c])) * 255 + (r() - r()));
    out[i * 4 + 3] = Math.round(clamp(R.data[i * 4 + 3]) * 255);
  }
  return out;
}

/** Crop a raster to a rectangle. */
export function crop(R, x0, y0, w, h) {
  const out = canvas(w, h);
  for (let y = 0; y < h; y++) out.data.set(R.data.subarray(((y + y0) * R.w + x0) * 4, ((y + y0) * R.w + x0 + w) * 4), y * w * 4);
  return out;
}

/** Paste raster B into A at (x0, y0) by straight copy (for sheets). */
export function paste(A, B, x0, y0) {
  for (let y = 0; y < B.h; y++) { const ty = y + y0; if (ty < 0 || ty >= A.h) continue; for (let x = 0; x < B.w; x++) { const tx = x + x0; if (tx < 0 || tx >= A.w) continue; const s = (y * B.w + x) * 4, t = (ty * A.w + tx) * 4; for (let c = 0; c < 4; c++) A.data[t + c] = B.data[s + c]; } }
  return A;
}
