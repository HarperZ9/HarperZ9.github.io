// lib/color.mjs: colour from physics for the feed-29 builds. Spectral colour through the CIE 1931 matching functions
// (the analytic multi-lobe fit of Wyman, Sloan and Shirley, JCGT 2013), thin-film interference (Airy summation for one
// layer), a gamut map that adds white until a spectral colour fits sRGB, and OKLab (Ottosson 2020) for distances and
// palette work. Everything is linear-light sRGB primaries unless a name says otherwise. Pure; node and browser.

const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
// CIE 1931 2 degree observer, analytic fit. lambda in nm.
export function cmf(l) {
  return [
    1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8),
  ];
}
export const xyzToLin = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];

export const LAMBDA = Array.from({ length: 81 }, (_, i) => 380 + 5 * i); // 380..780 nm in 5 nm steps
const WHITE_Y = LAMBDA.reduce((a, l) => a + cmf(l)[1], 0);               // equal-energy white, Y = 1

// Integrate a reflectance spectrum R(lambda) under equal-energy light, then white-balance (von Kries on the sRGB
// primaries, as a camera does) so a flat reflector of 1 comes out [1, 1, 1]. Without the balance, illuminant E reads
// pink on a D65 display (about 1.20, 0.95, 0.91).
const rawLin = R => { let X = 0, Y = 0, Z = 0; for (const l of LAMBDA) { const r = R(l), c = cmf(l); X += r * c[0]; Y += r * c[1]; Z += r * c[2]; } return xyzToLin([X / WHITE_Y, Y / WHITE_Y, Z / WHITE_Y]); };
export const E_WHITE = rawLin(() => 1);
export function spectrumToLin(R) { const c = rawLin(R); return [c[0] / E_WHITE[0], c[1] / E_WHITE[1], c[2] / E_WHITE[2]]; }

// Airy reflectance of one film (index n1, thickness d nm) between media n0 and n2, at incidence cosine cos0.
// s and p amplitudes are averaged as intensities. Soap film: n0 = n2 = 1, n1 = 1.33.
export function filmReflectance(lambda, d, { n0 = 1, n1 = 1.33, n2 = 1, cos0 = 1 } = {}) {
  const sin0 = Math.sqrt(Math.max(0, 1 - cos0 * cos0)), sin1 = n0 * sin0 / n1, cos1 = Math.sqrt(Math.max(0, 1 - sin1 * sin1));
  const sin2 = n0 * sin0 / n2, cos2 = Math.sqrt(Math.max(0, 1 - sin2 * sin2)), delta = (4 * Math.PI * n1 * d * cos1) / lambda;
  const airy = (r01, r12) => (r01 * r01 + r12 * r12 + 2 * r01 * r12 * Math.cos(delta)) / (1 + r01 * r01 * r12 * r12 + 2 * r01 * r12 * Math.cos(delta));
  const rs = airy((n0 * cos0 - n1 * cos1) / (n0 * cos0 + n1 * cos1), (n1 * cos1 - n2 * cos2) / (n1 * cos1 + n2 * cos2));
  const rp = airy((n1 * cos0 - n0 * cos1) / (n1 * cos0 + n0 * cos1), (n2 * cos1 - n1 * cos2) / (n2 * cos1 + n1 * cos2));
  return 0.5 * (rs + rp);
}
export const filmColor = (d, opts) => spectrumToLin(l => filmReflectance(l, d, opts));

// Fit a linear colour into [0,1]: add white until no channel is negative (keeps hue, gives up saturation), then scale
// so the largest channel is at most `peak`. This is how a pure spectral line is shown on an sRGB screen.
export function fitGamut(c, peak = 1) {
  const m = Math.min(0, c[0], c[1], c[2]); const o = c.map(v => v - m), M = Math.max(o[0], o[1], o[2]);
  return M > peak ? o.map(v => v * peak / M) : o;
}
// The visible spectrum as colours, one per wavelength, gamut-fitted and normalised to peak 1.
export const spectralColor = l => fitGamut(xyzToLin(cmf(l)).map(v => v * 3), 1).map((v, _, a) => v / Math.max(1e-6, Math.max(...a)));

// OKLab
export function linToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s];
}
export function oklabToLin([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.2914855480 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s];
}
// Scale chroma in OKLab (k > 1 saturates), then fit the gamut. Used to lift thin-film pastels to poster strength.
export function saturate(c, k, L = null) { const p = linToOklab(c); return fitGamut(oklabToLin([L ?? p[0], p[1] * k, p[2] * k])); }

export const toSrgb = v => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
export const toLin = v => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
export const hexLin = h => { const n = parseInt(h.replace('#', ''), 16); return [toLin((n >> 16 & 255) / 255), toLin((n >> 8 & 255) / 255), toLin((n & 255) / 255)]; };
export const linHex = c => '#' + c.map(v => Math.round(Math.max(0, Math.min(1, toSrgb(Math.max(0, v)))) * 255).toString(16).padStart(2, '0')).join('');
export const mixLin = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

// A ramp sampled at n stops: from a film thickness sweep (d0..d1 nm, chroma lifted by k), or along the spectrum.
export function filmRamp(n, d0 = 120, d1 = 900, { k = 2.6, L = 0.72, ...opts } = {}) {
  return Array.from({ length: n }, (_, i) => saturate(filmColor(d0 + (d1 - d0) * i / Math.max(1, n - 1), opts), k, L));
}
export function spectralRamp(n, l0 = 420, l1 = 660, { L = 0.7, k = 0.78, dL = 0.14 } = {}) {
  return Array.from({ length: n }, (_, i) => { const u = i / Math.max(1, n - 1); return saturate(spectralColor(l0 + (l1 - l0) * u), k, L - dL / 2 + dL * u); });
}
// Piecewise-linear lookup into a ramp, t in [0,1], interpolated in OKLab so mid-tones do not go muddy.
export function rampAt(ramp, t) {
  const f = Math.max(0, Math.min(1, t)) * (ramp.length - 1), i = Math.min(ramp.length - 2, Math.floor(f)), u = f - i;
  const A = linToOklab(ramp[i]), B = linToOklab(ramp[i + 1]);
  return fitGamut(oklabToLin([A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, A[2] + (B[2] - A[2]) * u]));
}
// The same lookup baked into a 1024-entry table, for per-pixel use. lutAt(L, t) returns [r, g, b] by reference.
export function rampLUT(ramp, n = 1024) {
  const L = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const c = rampAt(ramp, i / (n - 1)); L[3 * i] = c[0]; L[3 * i + 1] = c[1]; L[3 * i + 2] = c[2]; }
  return L;
}
export function lutAt(L, t, out = [0, 0, 0]) {
  const n = L.length / 3, i = Math.max(0, Math.min(n - 1, Math.round(t * (n - 1)))) * 3;
  out[0] = L[i]; out[1] = L[i + 1]; out[2] = L[i + 2]; return out;
}
