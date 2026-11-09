// Spectral colour for the shader library: spectra to CIE XYZ, primaries to matrices,
// emission band models for phosphors, and blackbody light. Plain arithmetic, used by
// the CPU references and to build the constant tables the GPU passes read.
import { CMF_START, CMF_STEP, CMF_N, CMF_X, CMF_Y, CMF_Z } from "./cie1931.mjs";

export const WL_MIN = 380, WL_MAX = 780;

// The CMFs at any wavelength by linear interpolation (zero outside the table).
export function cmf(wl) {
  const f = (wl - CMF_START) / CMF_STEP;
  if (f < 0 || f > CMF_N - 1) return [0, 0, 0];
  const i = Math.min(CMF_N - 2, Math.floor(f)), t = f - i;
  return [CMF_X[i] + (CMF_X[i + 1] - CMF_X[i]) * t, CMF_Y[i] + (CMF_Y[i + 1] - CMF_Y[i]) * t, CMF_Z[i] + (CMF_Z[i + 1] - CMF_Z[i]) * t];
}

// Integrate a spectral power function spd(wl) against the CMFs at 1 nm.
// Returns unnormalised XYZ.
export function spdToXYZ(spd, step = 1) {
  let X = 0, Y = 0, Z = 0;
  for (let wl = WL_MIN; wl <= WL_MAX; wl += step) {
    const p = spd(wl), [x, y, z] = cmf(wl);
    X += p * x * step; Y += p * y * step; Z += p * z * step;
  }
  return [X, Y, Z];
}
export const xyOf = ([X, Y, Z]) => { const s = X + Y + Z; return [X / s, Y / s]; };
export const xyToXYZ = ([x, y], Y = 1) => [(x * Y) / y, Y, ((1 - x - y) * Y) / y];

// 3 x 3 matrices as flat row-major arrays.
export function mul3(a, b) {
  const o = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return o;
}
export const apply3 = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
export function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det,
    C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
// The RGB -> XYZ matrix of a set of primaries (xy each) and a white point (xy), with
// the white at Y = 1 (SMPTE RP 177).
export function rgbToXYZ(primaries, white) {
  const P = [0, 1, 2].map((k) => xyToXYZ(primaries[k]));
  const M = [P[0][0], P[1][0], P[2][0], P[0][1], P[1][1], P[2][1], P[0][2], P[1][2], P[2][2]];
  const s = apply3(inv3(M), xyToXYZ(white));
  return [M[0] * s[0], M[1] * s[1], M[2] * s[2], M[3] * s[0], M[4] * s[1], M[5] * s[2], M[6] * s[0], M[7] * s[1], M[8] * s[2]];
}

// Standard primaries and whites (xy). Sources and confidence in docs/shaders/CONSTANTS.md.
export const WHITE = { D65: [0.3127, 0.329], D93: [0.2831, 0.2971], J9300: [0.281, 0.311], C: [0.310, 0.316] };
export const PRIMARIES = {
  rec709: [[0.64, 0.33], [0.30, 0.60], [0.15, 0.06]],
  rec2020: [[0.708, 0.292], [0.170, 0.797], [0.131, 0.046]],
  smpteC: [[0.630, 0.340], [0.310, 0.595], [0.155, 0.070]],
  ebu: [[0.640, 0.330], [0.290, 0.600], [0.150, 0.060]],
  ntsc1953: [[0.67, 0.33], [0.21, 0.71], [0.14, 0.08]],
};
export const XYZ_TO = {
  rec709: inv3(rgbToXYZ(PRIMARIES.rec709, WHITE.D65)),
  rec2020: inv3(rgbToXYZ(PRIMARIES.rec2020, WHITE.D65)),
};

// Emission bands. A broad band of a ZnS-type phosphor is close to gaussian in photon
// energy, so the band is a gaussian in wavenumber with the given peak and FWHM (nm).
export function energyBand(peak, fwhm) {
  const k0 = 1e7 / peak, kw = (1e7 / (peak - fwhm / 2) - 1e7 / (peak + fwhm / 2)) / 2.3548;
  return (wl) => { const d = (1e7 / wl - k0) / kw; return Math.exp(-0.5 * d * d); };
}
// A line spectrum (rare-earth activators such as Eu3+): narrow gaussians in wavelength.
export function lineSpectrum(lines, fwhm = 3) {
  const s = fwhm / 2.3548;
  return (wl) => { let p = 0; for (const [c, a] of lines) { const d = (wl - c) / s; p += a * Math.exp(-0.5 * d * d); } return p; };
}
export const sumSpd = (parts) => (wl) => parts.reduce((p, [w, f]) => p + w * f(wl), 0);

// Planck's law, relative spectral radiance at wl (nm) for temperature T (K).
export function blackbody(T) {
  const c2 = 1.4387769e-2;
  return (wl) => { const l = wl * 1e-9; return 1 / (Math.pow(l, 5) * (Math.exp(c2 / (l * T)) - 1)); };
}
