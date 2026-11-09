// film.mjs: a dated cinema-stock grade, as one reusable function. The tone defaults are measured on the author's key
// reference (feed set 32, clips/KEY-qRwy..., 1276 x 718, H.264); the texture defaults are chosen, because compression
// erased the texture in that file. Each default says which it is. See ../CLAIMS.md section 2. The method is our own: per-channel
// toe and shoulder in display space, a split tone in OKLab, halation from a blurred highlight key, clumped grain,
// per-frame weave and flicker, and an optional gate. No pixel of the reference enters an output.
//
// SPEC
//   grade(R, params, { seed, frame }) -> new raster. R is a feed-29 raster { w, h, px: Float32Array(3wh) }, linear light.
//   params (all optional; unit, range, measured default):
//     black   [r,g,b] code values 0..40, default [17.5, 14, 2]      (measured: KEY p0.5 black point)
//     white   [r,g,b] code values 180..255, default [217, 195, 141]   (measured: KEY p99.5 white point)
//     shoulder 0..4, default 1.1   (roll-off strength; 0 is a straight line between black and white)
//     toe      0.7..1.6, default 1.12 (power on the input before the shoulder; above 1 deepens the shadows)
//     shadowTint [a,b] OKLab, default [0, 0]; highlightTint [a,b], default [-0.004, 0.008]. A sweep showed the per-channel
//       black and white points alone give the KEY hue (91 to 95 degrees on neutrals), so the split is a small trim.
//     sat      0..1.5, default 0.92 (chosen; KEY mean saturation 0.44 comes mostly from the curve's warm white)
//     halation (chosen: no KEY frame had a clipped highlight to measure a fringe on) { threshold 0.5..1 display luma, default 0.78; radius 0.002..0.04 of width, default 0.012;
//                strength 0..1, default 0.3; tint [r,g,b] linear, default [1, 0.32, 0.08] }
//     grain    { sd 0..12 code values, default 2.2; sigma 0.5..1.2 px, default 0.8; chroma 0..1, default 0.3 }
//              (chosen: KEY grain after H.264 is 0.42 code values with lag-1 correlation 0.44, a floor, not the stock)
//     weave    rms px 0..2, default 0      (chosen: KEY rms 2.5 x 0.8 px is camera motion, not gate weave)
//     flicker  relative 0..0.05, default 0.004 (measured: KEY median 0.0019, p95 0.023)
//     gate     0..1, default 0  (measured: KEY corner over centre 0.98, so none)
//   determinism : seed + frame fix every random draw. cost (measured 2026-10-25, Node, one thread): 1 to 3 s at
//   1280 x 720 and 3 to 7.6 s at 1920 x 1080 per frame. Too slow for live use; an offline grade. The OKLab round trip
//   and the two chroma grain fields are most of it.
import { raster, clamp, rng, gauss, blur, grain as grainField } from '../../feed-29/build/lib/field.mjs';
import { toSrgb, toLin, linToOklab, oklabToLin } from '../../feed-29/build/lib/color.mjs';

export const DEFAULTS = Object.freeze({
  black: [17.5, 14, 2], white: [217, 195, 141], shoulder: 1.1, toe: 1.12,
  shadowTint: [0, 0], highlightTint: [-0.004, 0.008], sat: 0.92,
  halation: { threshold: 0.78, radius: 0.012, strength: 0.3, tint: [1, 0.32, 0.08] },
  grain: { sd: 2.2, sigma: 0.8, chroma: 0.3 }, weave: 0, flicker: 0.004, gate: 0,
});

const merge = p => ({ ...DEFAULTS, ...p, halation: { ...DEFAULTS.halation, ...(p?.halation ?? {}) }, grain: { ...DEFAULTS.grain, ...(p?.grain ?? {}) } });

// The tone curve for one channel, display in and display out, both 0..1.
export function curve(x, black, white, shoulder, toe) {
  const t = Math.pow(clamp(x), toe);
  const s = shoulder > 1e-4 ? (1 - Math.exp(-shoulder * t)) / (1 - Math.exp(-shoulder)) : t;
  return black + (white - black) * s;
}

// Sub-pixel shift by bilinear resampling (weave); edges clamp.
function shift(R, dx, dy) {
  if (!dx && !dy) return R;
  const { w, h, px } = R, O = raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const sx = clamp(x - dx, 0, w - 1.001), sy = clamp(y - dy, 0, h - 1.001), x0 = Math.floor(sx), y0 = Math.floor(sy), fx = sx - x0, fy = sy - y0;
    for (let c = 0; c < 3; c++) {
      const a = px[3 * (y0 * w + x0) + c], b = px[3 * (y0 * w + x0 + 1) + c], d = px[3 * ((y0 + 1) * w + x0) + c], e = px[3 * ((y0 + 1) * w + x0 + 1) + c];
      O.px[3 * (y * w + x) + c] = (a * (1 - fx) + b * fx) * (1 - fy) + (d * (1 - fx) + e * fx) * fy;
    }
  }
  return O;
}

// Halation: a soft key of the highlights, blurred wide and tinted warm, added in linear light before the curve.
function halate(R, H) {
  const { w, h, px } = R, n = w * h, key = new Float32Array(n);
  if (!(H.strength > 0)) return;
  for (let i = 0; i < n; i++) { const Y = toSrgb(clamp(0.2126 * px[3 * i] + 0.7152 * px[3 * i + 1] + 0.0722 * px[3 * i + 2])); key[i] = clamp((Y - H.threshold) / (1 - H.threshold + 1e-6)); }
  const sigma = Math.max(1, H.radius * w), b = blur(key, w, h, sigma);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) px[3 * i + c] += b[i] * H.strength * H.tint[c];
}

export function grade(src, params = {}, { seed = 'film', frame = 0 } = {}) {
  const P = merge(params), { w, h } = src, n = w * h, r = rng(`${seed}:${frame}:frame`);
  let R = { w, h, px: Float32Array.from(src.px) };
  if (P.weave > 0) R = shift(R, gauss(r) * P.weave, gauss(r) * P.weave * 0.6);
  halate(R, P.halation);
  const flick = 1 + gauss(r) * P.flicker, G = P.grain.sd > 0 ? grainField(w, h, { sigma: P.grain.sigma, seed: `${seed}:${frame}:grain` }) : null;
  const Gc = G && P.grain.chroma > 0 ? [0, 1].map(k => grainField(w, h, { sigma: P.grain.sigma, seed: `${seed}:${frame}:grain${k}` })) : null;
  const bl = P.black.map(v => v / 255), wh = P.white.map(v => v / 255), out = raster(w, h), px = R.px;
  for (let i = 0; i < n; i++) {
    const x = i % w, y = (i / w) | 0;
    const vg = P.gate > 0 ? 1 - P.gate * Math.pow(Math.hypot((x / w - 0.5) * 1.6, (y / h - 0.5) * 1.6), 3) * 0.5 : 1;
    // split tone and saturation in OKLab on the linear input, weighted by lightness
    const lab = linToOklab([Math.max(0, px[3 * i]), Math.max(0, px[3 * i + 1]), Math.max(0, px[3 * i + 2])]);
    const sh = clamp(1 - lab[0] / 0.55), hi = clamp((lab[0] - 0.45) / 0.55);
    lab[1] = lab[1] * P.sat + P.shadowTint[0] * sh + P.highlightTint[0] * hi;
    lab[2] = lab[2] * P.sat + P.shadowTint[1] * sh + P.highlightTint[1] * hi;
    const lin = oklabToLin(lab);
    for (let c = 0; c < 3; c++) {
      let v = curve(toSrgb(clamp(lin[c] * flick * vg, 0, 4) / (1 + Math.max(0, lin[c] * flick * vg - 1))), bl[c], wh[c], P.shoulder, P.toe);
      if (G) v += (G[i] * (1 - P.grain.chroma) + (Gc ? (c === 1 ? 0 : Gc[c >> 1][i]) * P.grain.chroma : 0)) * P.grain.sd / 255;
      out.px[3 * i + c] = toLin(clamp(v));
    }
  }
  return out;
}
