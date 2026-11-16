// cmath.mjs: the colour arithmetic every study measure uses. sRGB (IEC 61966-2-1, D65) to linear light, CIE XYZ,
// CIELAB and LCh(ab); sRGB HSV hue; CIE76 colour difference; and the CIECAM02 lightness J of a stimulus on a
// background of a given luminance (Moroney et al. 2002, average surround). Pure, no state.

export const D65 = [0.95047, 1, 1.08883];
export const METHOD = {
  space: 'sRGB (IEC 61966-2-1) to CIE XYZ (D65, 2 degree) to CIELAB',
  dE: 'CIE76: Euclidean distance in CIELAB',
};

export const lin = v => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
export const enc = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
const LIN8 = Float64Array.from({ length: 256 }, (_, i) => lin(i / 255));
export const lin8 = c => LIN8[c];

export function linToXYZ([r, g, b]) {
  return [0.4124564 * r + 0.3575761 * g + 0.1804375 * b, 0.2126729 * r + 0.7151522 * g + 0.0721750 * b, 0.0193339 * r + 0.1191920 * g + 0.9503041 * b];
}
export function xyzToLin([x, y, z]) {
  return [3.2404542 * x - 1.5371385 * y - 0.4985314 * z, -0.9692660 * x + 1.8760108 * y + 0.0415560 * z, 0.0556434 * x - 0.2040259 * y + 1.0572252 * z];
}
const f = t => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
const fi = t => (t ** 3 > 216 / 24389 ? t ** 3 : (116 * t - 16) / (24389 / 27));
export function xyzToLab([x, y, z]) {
  const fx = f(x / D65[0]), fy = f(y / D65[1]), fz = f(z / D65[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToXYZ([L, a, b]) {
  const fy = (L + 16) / 116;
  return [D65[0] * fi(fy + a / 500), D65[1] * fi(fy), D65[2] * fi(fy - b / 200)];
}
export const rgb8ToLab = (r, g, b) => xyzToLab(linToXYZ([LIN8[r], LIN8[g], LIN8[b]]));
export const srgbToLab = rgb => xyzToLab(linToXYZ(rgb.map(lin)));

// CIELAB to 8-bit sRGB, clipped to the gamut; `clipped` says whether any channel had to be clipped.
export function labToRgb8(lab) {
  const l = xyzToLin(labToXYZ(lab));
  const clipped = l.some(v => v < -1e-4 || v > 1 + 1e-4);
  return { rgb: l.map(v => Math.round(enc(Math.min(1, Math.max(0, v))) * 255)), clipped };
}
export const hex = ([r, g, b]) => '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
export const parseHex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

export function lch([L, a, b]) {
  const C = Math.hypot(a, b);
  let h = Math.atan2(b, a) * 180 / Math.PI; if (h < 0) h += 360;
  return [L, C, h];
}
export const dE76 = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
export const luminance = rgb8 => linToXYZ(rgb8.map(c => LIN8[c]))[1];

// sRGB HSV hue in degrees (0 red, 60 yellow, 120 green, 240 blue); null for a grey.
export function hsvHue([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return null;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60; return h < 0 ? h + 360 : h;
}

// CIECAM02 lightness J of a stimulus (relative luminance Y and chromaticity from its XYZ) seen on a background of
// relative luminance Yb (0..1), adapting luminance La = 64 cd/m2, average surround, full adaptation (D = 1).
// Only the background's luminance enters the model, so this is the lightness part of simultaneous contrast.
export function cam02J(xyz, Yb, { La = 64 } = {}) {
  const W = D65.map(v => v * 100), X = xyz.map(v => v * 100), yb = Math.max(0.1, Yb * 100);
  const c = 0.69, Nc = 1, F = 1;
  const M = [[0.7328, 0.4296, -0.1624], [-0.7036, 1.6975, 0.0061], [0.0030, 0.0136, 0.9834]];
  const Mh = [[0.38971, 0.68898, -0.07868], [-0.22981, 1.18340, 0.04641], [0, 0, 1]];
  const Mi = [[1.096124, -0.278869, 0.182745], [0.454369, 0.473533, 0.072098], [-0.009628, -0.005698, 1.015326]];
  const mul = (m, v) => m.map(r => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
  const k = 1 / (5 * La + 1), FL = 0.2 * k ** 4 * 5 * La + 0.1 * (1 - k ** 4) ** 2 * Math.cbrt(5 * La);
  const n = yb / W[1], z = 1.48 + Math.sqrt(n), Nbb = 0.725 * n ** -0.2;
  const RGBw = mul(M, W);
  const adapt = v => { const r = mul(M, v).map((x, i) => x * W[1] / RGBw[i]); return mul(Mh, mul(Mi, r)); };
  const post = v => v.map(x => { const t = (FL * Math.abs(x) / 100) ** 0.42; return Math.sign(x) * 400 * t / (t + 27.13) + 0.1; });
  const A = v => (2 * v[0] + v[1] + v[2] / 20 - 0.305) * Nbb;
  const Aw = A(post(adapt(W))), As = A(post(adapt(X)));
  return 100 * Math.max(0, As / Aw) ** (c * z);
}
