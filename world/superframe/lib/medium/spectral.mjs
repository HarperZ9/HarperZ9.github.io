// lib/medium/spectral.mjs: colour as spectra, so pigments can be metamers (BLEED sections 12 and 18). An RGB engine
// carries three numbers per colour, the same count as the eye's readout, so two inks that look alike are identical to
// it and cannot come apart; here inks and pigments are 16-band spectra (400 to 700 nm, 20 nm bands), mixed band by
// band, and turned into RGB only for display, through the CIE 1931 2-degree observer under a chosen illuminant.
// Prior work: Kubelka and Munk (1931) for pigment mixing (single-constant form here); Mixbox (Sochorova and Jamriska,
// 2021) for practical pigment-true mixing in a paint engine; Jakob and Hanika (2019) for the sigmoid-polynomial
// spectral upsampling used to give a measured RGB colour a smooth spectrum.
// Tables: CIE 1931 2-degree colour matching functions (CIE 015:2018), averaged over each 20 nm band from the 5 nm
// table; CIE illuminant D65 relative spectral power at the band centres; illuminant A is Planck's law at 2856 K by
// definition. Check: the 10 nm D65 table here gives white at x 0.3127, y 0.3293 against the standard 0.3127, 0.3290;
// the 16-band sums give 0.3130, 0.3274, so display conversion normalises to the bands' own white.
// Plain ES module, no imports.
export const BANDS = 16;
export const LAMBDA = [400, 420, 440, 460, 480, 500, 520, 540, 560, 580, 600, 620, 640, 660, 680, 700];
const CMF = {
  x: [0.017257, 0.14762, 0.33372, 0.2816, 0.10236, 0.010664, 0.072343, 0.29383, 0.59568, 0.9079, 1.0447, 0.84169, 0.45339, 0.17256, 0.04958, 0.012389],
  y: [0.0004795, 0.0049712, 0.02361, 0.061597, 0.14261, 0.3361, 0.69847, 0.94441, 0.98677, 0.86405, 0.63067, 0.3818, 0.17905, 0.06417, 0.018056, 0.0044761],
  z: [0.081996, 0.71311, 1.6829, 1.6178, 0.83686, 0.28732, 0.086845, 0.022249, 0.0044562, 0.0016125, 0.00078, 0.00018125, 0.00002125, 0, 0, 0],
};
const planck = (nm, K) => { const l = nm * 1e-9; return 1 / (l ** 5 * (Math.exp(1.4387769e-2 / (l * K)) - 1)); };
export const ILLUMINANTS = {
  D65: [82.755, 93.432, 104.86, 117.81, 115.92, 109.35, 104.79, 104.41, 100, 95.788, 90.006, 87.699, 83.699, 80.215, 78.284, 71.609],
  A: LAMBDA.map(l => 100 * planck(l, 2856) / planck(560, 2856)),
  // a candle flame, as a blackbody at 1900 K (an approximation: a flame is close to, not exactly, a blackbody)
  candle: LAMBDA.map(l => 100 * planck(l, 1900) / planck(560, 1900)),
};
// pure water's absorption per metre at the band centres (Pope and Fry 1997; values from memory, moderate confidence)
export const WATER_ABSORPTION = [0.0066, 0.0048, 0.0064, 0.0098, 0.0145, 0.0257, 0.0477, 0.0638, 0.0708, 0.1, 0.222, 0.275, 0.32, 0.41, 0.465, 0.65];

// reflectance or transmittance spectrum -> XYZ under an illuminant (Y of a perfect white = 1)
export function toXYZ(R, illum = 'D65') {
  const S = ILLUMINANTS[illum] ?? illum; let X = 0, Y = 0, Z = 0, N = 0;
  for (let i = 0; i < BANDS; i++) { const e = S[i] * R[i]; X += e * CMF.x[i]; Y += e * CMF.y[i]; Z += e * CMF.z[i]; N += S[i] * CMF.y[i]; }
  return [X / N, Y / N, Z / N];
}
const WHITE = Object.fromEntries(Object.keys(ILLUMINANTS).map(k => [k, toXYZ(new Array(BANDS).fill(1), k)]));
// XYZ -> linear sRGB, with a von Kries scaling from the illuminant's band white to D65's standard white: the viewer is
// adapted to the light, so a perfect white is white under every illuminant and only the pigments' differences show
export function toLinearRGB(XYZ, illum = 'D65') {
  const w = WHITE[illum] ?? toXYZ(new Array(BANDS).fill(1), illum), D = [0.95047, 1, 1.08883], [X, Y, Z] = XYZ.map((v, i) => v * D[i] / w[i]);
  return [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
}
export const spectrumRGB = (R, illum = 'D65') => toLinearRGB(toXYZ(R, illum), illum);

// smooth spectrum for a linear sRGB colour (Jakob and Hanika's sigmoid of a quadratic in wavelength), fitted by
// Gauss-Newton on the RGB residual under D65; reflectances stay inside (0, 1) by construction
const sig = x => 0.5 + x / (2 * Math.sqrt(1 + x * x));
export const sigmoidSpectrum = c => LAMBDA.map(l => { const t = (l - 550) / 150; return sig(c[0] + c[1] * t + c[2] * t * t); });
export function upsample(rgb) {
  const target = rgb.map(v => Math.min(0.999, Math.max(0.001, v)));
  let c = [0, 0, 0];
  for (let it = 0; it < 60; it++) {
    const f = spectrumRGB(sigmoidSpectrum(c)), r = f.map((v, i) => v - target[i]);
    if (Math.hypot(...r) < 1e-6) break;
    const J = [0, 1, 2].map(j => { const e = 1e-4, d = c.slice(); d[j] += e; const g = spectrumRGB(sigmoidSpectrum(d)); return g.map((v, i) => (v - f[i]) / e); }); // J[j][i]
    // solve (J^T J + mu I) dc = -J^T r, 3 x 3
    const A = [0, 1, 2].map(a => [0, 1, 2].map(b => J[a].reduce((s, v, i) => s + v * J[b][i], 0) + (a === b ? 1e-6 : 0))), g = [0, 1, 2].map(a => -J[a].reduce((s, v, i) => s + v * r[i], 0));
    const dc = solve3(A, g); for (let j = 0; j < 3; j++) c[j] += Math.max(-4, Math.min(4, dc[j]));
  }
  return sigmoidSpectrum(c);
}
function solve3(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 3; i++) { let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]]; const d = M[i][i] || 1e-12; for (let k = i; k < 4; k++) M[i][k] /= d; for (let r = 0; r < 3; r++) if (r !== i) { const f = M[r][i]; for (let k = i; k < 4; k++) M[r][k] -= f * M[i][k]; } }
  return M.map(r => r[3]);
}
const hexLinear = h => { const n = parseInt(h.slice(1), 16); return [16, 8, 0].map(s => { const c = ((n >> s) & 255) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); };
export const spectrumOf = hex => upsample(hexLinear(hex));
// an ink's absorbance per band, on the same scale as the RGB engine's absorb() (transmission = exp(-3.9 a))
export const absorbance = R => R.map(v => -Math.log(Math.max(0.02, v)) / 3.9);
export const absorbanceOf = hex => absorbance(spectrumOf(hex));

// Kubelka-Munk, single-constant: an opaque pigment's absorption-to-scattering ratio K/S from its reflectance, and back;
// mixing adds K/S by concentration, band by band
export const ks = R => R.map(r => { const v = Math.min(0.999, Math.max(1e-3, r)); return (1 - v) ** 2 / (2 * v); });
export const fromKS = k => k.map(q => 1 + q - Math.sqrt(q * q + 2 * q));
export function mixKM(parts) { const t = parts.reduce((a, p) => a + p.c, 0), K = new Array(BANDS).fill(0); for (const p of parts) { const q = ks(p.R); for (let i = 0; i < BANDS; i++) K[i] += q[i] * p.c / t; } return fromKS(K); }
// transparent glazes over a ground: transmittances multiply band by band (the light passes each glaze twice)
export const glaze = (ground, ...T) => ground.map((g, i) => T.reduce((v, t) => v * t[i] * t[i], g));

// a metameric black: a spectral change invisible to the observer under one illuminant. A smooth seeded wiggle with
// the three observer directions (under that illuminant) projected out; scaled to keep base + black inside (lo, hi)
export function metamericBlack(base, illum = 'D65', { seed = 1, lo = 0.02, hi = 0.98, scale = 1 } = {}) {
  const S = ILLUMINANTS[illum] ?? illum, rows = ['x', 'y', 'z'].map(k => CMF[k].map((v, i) => v * S[i]));
  let v = LAMBDA.map((l, i) => Math.sin(i * 0.9 + seed) + 0.6 * Math.sin(i * 2.3 + 2 * seed) + 0.3 * Math.cos(i * 0.45 + 3 * seed));
  // Gram-Schmidt on the three rows, then remove their span from v
  const Q = [];
  for (const r of rows) { let u = r.slice(); for (const q of Q) { const d = u.reduce((s, x, i) => s + x * q[i], 0); u = u.map((x, i) => x - d * q[i]); } const n = Math.hypot(...u); Q.push(u.map(x => x / n)); }
  for (const q of Q) { const d = v.reduce((s, x, i) => s + x * q[i], 0); v = v.map((x, i) => x - d * q[i]); }
  // bounds per band: never below half the base (a dark band stays dark) or the floor, never above the ceiling
  let k = Infinity; for (let i = 0; i < BANDS; i++) { const L = Math.min(lo, base[i] * 0.5), Hh = Math.max(hi, base[i]); if (v[i] > 1e-9) k = Math.min(k, (Hh - base[i]) / v[i]); if (v[i] < -1e-9) k = Math.min(k, (L - base[i]) / v[i]); }
  return v.map(x => x * k * scale);
}

// a transmittance spectrum as an RGB multiplier under an illuminant (a perfect filter, T = 1, is 1, 1, 1)
export const filterRGB = (T, illum = 'D65') => spectrumRGB(T, illum);

// RGB light as a spectrum, for scenes whose background is RGB: three smooth basis spectra (the upsampled primaries),
// weighted so the result has exactly the given linear RGB under D65. It is linear in RGB, so caustics, stains and fog
// scale it the way they scale RGB, and only the pigments in front of it carry their own spectra
let BASIS = null;
function basis() {
  if (BASIS) return BASIS;
  const B = [[0.999, 0.001, 0.001], [0.001, 0.999, 0.001], [0.001, 0.001, 0.999]].map(upsample), N = B.map(b => spectrumRGB(b)); // N[k] = RGB of basis k
  const M = [0, 1, 2].map(i => [0, 1, 2].map(k => N[k][i])), inv = invert3(M);
  return (BASIS = { B, inv });
}
function invert3(M) { const [[a, b, c], [d, e, f], [g, h, i]] = M, A = e * i - f * h, Bq = -(d * i - f * g), Cq = d * h - e * g, det = a * A + b * Bq + c * Cq; return [[A, -(b * i - c * h), b * f - c * e], [Bq, a * i - c * g, -(a * f - c * d)], [Cq, -(a * h - b * g), a * e - b * d]].map(r => r.map(v => v / det)); }
export function rgbToSpectrum(rgb, out = new Array(BANDS)) {
  const { B, inv } = basis(), w = [0, 1, 2].map(k => inv[k][0] * rgb[0] + inv[k][1] * rgb[1] + inv[k][2] * rgb[2]);
  for (let i = 0; i < BANDS; i++) out[i] = Math.max(0, w[0] * B[0][i] + w[1] * B[1][i] + w[2] * B[2][i]);
  return out;
}
// a per-channel coefficient (red, green, blue) spread over the bands, linear between 610, 550 and 465 nm
export function rgbCoefficientBands([r, g, b]) {
  return LAMBDA.map(l => (l >= 610 ? r : l >= 550 ? g + (r - g) * (l - 550) / 60 : l >= 465 ? b + (g - b) * (l - 465) / 85 : b));
}
