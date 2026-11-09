// tone.mjs: per-pixel tone operators. Each takes a layer and replaces its pixels in place.
// Perceptual steps (posterize, ramps, thresholds) work on sRGB-encoded values; the buffer stays linear.
import { enc, toLin, colour, gauss, sampler } from './px.mjs';

const lin = (v) => toLin(v < 0 ? 0 : v > 1 ? 1 : v);

// Quantize each channel to `levels` steps in sRGB (the 4 to 6 levels measured on images 33 to 36).
// soft (0..0.5) keeps a narrow ramp where a value crosses between two levels, so a posterized edge stays
// anti-aliased (QUALITY-SPEC R3) while flat areas still land exactly on a level. soft 0 is a hard step.
export function posterize(L, { levels = 5, soft = 0 } = {}) {
  if (!(levels >= 2)) throw new RangeError('posterize: levels must be at least 2');
  const p = L.px, q = levels - 1, lut = Float32Array.from({ length: levels }, (_, i) => toLin(i / q));
  if (!soft) { for (let i = 0; i < p.length; i++) p[i] = lut[Math.round(enc(p[i]) * q)]; return; }
  for (let i = 0; i < p.length; i++) {
    const t = enc(p[i]) * q, k = Math.min(q - 1, Math.floor(t)), f = (t - k - 0.5 + soft) / (2 * soft), s = f <= 0 ? 0 : f >= 1 ? 1 : f * f * (3 - 2 * f);
    p[i] = toLin((k + s) / q);
  }
}

// Map sRGB luma through colour stops (two stops = a duotone). Stops interpolate in linear light.
export function ramp(L, { stops, gamma = 1 } = {}) {
  const S = stops.map(colour), n = S.length - 1, p = L.px;
  if (n < 1) throw new RangeError('ramp: give at least two stops');
  for (let i = 0; i < L.w * L.h; i++) {
    const t = Math.pow(Math.min(1, Math.max(0, L.luma(i))), gamma) * n, k = Math.min(n - 1, t | 0), f = t - k;
    for (let c = 0; c < 3; c++) p[3 * i + c] = S[k][c] + (S[k + 1][c] - S[k][c]) * f;
  }
}
export function duotone(L, dark, light, { gamma = 1 } = {}) { ramp(L, { stops: [dark, light], gamma }); }

export function threshold(L, { t = 0.5, dark = '#000000', light = '#ffffff' } = {}) {
  const D = colour(dark), W = colour(light), p = L.px;
  for (let i = 0; i < L.w * L.h; i++) { const c = L.luma(i) >= t ? W : D; p[3 * i] = c[0]; p[3 * i + 1] = c[1]; p[3 * i + 2] = c[2]; }
}

export function invert(L) { const p = L.px; for (let i = 0; i < p.length; i++) p[i] = lin(1 - enc(p[i])); }

// Saturation about Rec. 709 luma, in sRGB values.
export function saturate(L, { s = 1.2 } = {}) {
  const p = L.px;
  for (let i = 0; i < L.w * L.h; i++) {
    const r = enc(p[3 * i]), g = enc(p[3 * i + 1]), b = enc(p[3 * i + 2]), y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    p[3 * i] = lin(y + (r - y) * s); p[3 * i + 1] = lin(y + (g - y) * s); p[3 * i + 2] = lin(y + (b - y) * s);
  }
}

export function brightness(L, { b = 0 } = {}) { const p = L.px; for (let i = 0; i < p.length; i++) p[i] = lin(enc(p[i]) + b); }
export function contrast(L, { c = 1.2, mid = 0.5 } = {}) { const p = L.px; for (let i = 0; i < p.length; i++) p[i] = lin(mid + (enc(p[i]) - mid) * c); }

// Separable box blur, three passes (close to a Gaussian with sigma about r * 0.58 * sqrt(3)).
export function blur(L, { r = 2 } = {}) {
  r = Math.max(0, Math.round(r)); if (!r) return;
  const { w, h } = L; let src = L.px, tmp = new Float32Array(src.length);
  const pass = (a, b, horiz) => {
    const n = horiz ? w : h, m = horiz ? h : w, st = horiz ? 3 : 3 * w;
    for (let j = 0; j < m; j++) {
      const base = horiz ? 3 * j * w : 3 * j;
      for (let c = 0; c < 3; c++) {
        let acc = 0; for (let k = -r; k <= r; k++) acc += a[base + Math.min(n - 1, Math.max(0, k)) * st + c];
        for (let i = 0; i < n; i++) {
          b[base + i * st + c] = acc / (2 * r + 1);
          acc += a[base + Math.min(n - 1, i + r + 1) * st + c] - a[base + Math.max(0, i - r) * st + c];
        }
      }
    }
  };
  for (let it = 0; it < 3; it++) { pass(src, tmp, true); pass(tmp, src, false); }
}

// Noise baked into a layer, in sRGB code values (the glyph pieces carry theirs inside the art).
export function speckle(L, { std = 0.045, mono = true } = {}) {
  const r = L.rand(), p = L.px;
  for (let i = 0; i < L.w * L.h; i++) {
    const g0 = gauss(r) * std;
    for (let c = 0; c < 3; c++) p[3 * i + c] = lin(enc(p[3 * i + c]) + (mono ? g0 : gauss(r) * std));
  }
}

// Alpha from a field (layer luma, Float32Array or (u, v) -> 0..1), optionally thresholded or inverted.
export function mask(L, { by, invert: inv = false, t = null, soft = 0 } = {}) {
  const f = sampler(by, L.w, L.h), a = L.a ?? new Float32Array(L.w * L.h).fill(1);
  for (let y = 0; y < L.h; y++) for (let x = 0; x < L.w; x++) {
    let v = f(x + 0.5, y + 0.5);
    if (t !== null) v = soft ? Math.min(1, Math.max(0, (v - t) / soft + 0.5)) : v >= t ? 1 : 0;
    a[y * L.w + x] *= inv ? 1 - v : v;
  }
  L.a = a;
}

export const TONE = { posterize, ramp, duotone, threshold, invert, saturate, brightness, contrast, blur, speckle, mask };
