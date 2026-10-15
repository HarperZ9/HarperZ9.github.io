// Pigments and Kubelka-Munk mixing for the painterly shaders.
//
// Paint mixes by absorption and scattering, not by averaging RGB: blue and yellow make green.
// Kubelka-Munk theory gives an opaque layer's reflectance from its absorption K and scattering
// S, R = 1 + K/S - sqrt((K/S)^2 + 2 K/S), and a mixture's K and S are the concentration-weighted
// sums of its pigments'. We use four pigments (a white, a yellow, a magenta and a blue, the
// set a painter needs to reach most colours) with parametric masstone spectra (low confidence:
// shapes from the pigments' known colour, not measured data; docs/shaders/CONSTANTS.md).
//
// A colour enters the paint as a latent: four concentrations plus an RGB residual (the idea of
// Sochorová and Jamriška, "Practical Pigment Mixing for Digital Painting", SIGGRAPH Asia 2021,
// implemented independently). The concentrations come from a 17^3 lookup solved here by
// Levenberg-Marquardt; the residual is the colour minus the decoded pigments, so an unmixed
// colour decodes back to itself exactly, and mixing the latents linearly mixes the paint.
import { cmf, XYZ_TO, apply3 } from "../spectral.mjs";
import { LUT_B64 } from "./lut-data.mjs";

export const LAMBDA = Array.from({ length: 31 }, (_, i) => 400 + 10 * i);    // 400 to 700 nm
const sig = (l, c, w) => 1 / (1 + Math.exp(-(l - c) / w)), g = (l, c, w) => Math.exp(-0.5 * ((l - c) / w) ** 2);
// Masstone reflectance R_inf(lambda) and relative scattering S of each pigment.
export const PIGMENTS = [
  { name: "titanium white", S: 1.0, R: (l) => 0.9 - 0.12 * (1 - sig(l, 420, 8)) },
  { name: "hansa yellow", S: 0.35, R: (l) => 0.05 + 0.85 * sig(l, 515, 12) },
  { name: "quinacridone magenta", S: 0.18, R: (l) => 0.06 + 0.4 * g(l, 420, 30) + 0.78 * sig(l, 600, 14) },
  { name: "phthalo blue", S: 0.12, R: (l) => 0.03 + 0.42 * g(l, 470, 38) + 0.08 * sig(l, 690, 12) },
];
const ks = (R) => ((1 - R) * (1 - R)) / (2 * R);
export const K_TAB = LAMBDA.map((l) => PIGMENTS.map((p) => p.S * ks(p.R(l))));
export const S_TAB = LAMBDA.map(() => PIGMENTS.map((p) => p.S));
// Reflectance to linear Rec.709 under D65 (as daylight), per wavelength, normalised so R = 1 is white.
function d65(l) { return 1 + 0.0 * l; }   // equal-energy stand-in; white balanced below
const rawW = LAMBDA.map((l) => apply3(XYZ_TO.rec709, cmf(l).map((v) => v * d65(l))));
const sumW = [0, 1, 2].map((c) => rawW.reduce((a, r) => a + r[c], 0));
export const W_TAB = rawW.map((r) => r.map((v, c) => v / sumW[c]));

// Decode concentrations to linear RGB.
export function kmDecode(c) {
  const out = [0, 0, 0];
  for (let w = 0; w < LAMBDA.length; w++) {
    let K = 0, S = 0;
    for (let i = 0; i < 4; i++) { K += c[i] * K_TAB[w][i]; S += c[i] * S_TAB[w][i]; }
    const q = K / Math.max(S, 1e-9), R = 1 + q - Math.sqrt(q * q + 2 * q);
    for (let k = 0; k < 3; k++) out[k] += W_TAB[w][k] * R;
  }
  return out;
}

// Concentrations for a linear RGB target: softmax parameters fitted by Levenberg-Marquardt
// on the error in a cube-root space (closer to how we see differences than linear light).
const cr = (v) => Math.cbrt(Math.max(v, 0));
function fit(target) {
  const soft = (z) => { const m = Math.max(...z), e = z.map((v) => Math.exp(v - m)), s = e.reduce((a, b) => a + b, 0); return e.map((v) => v / s); };
  const res = (z) => { const d = kmDecode(soft(z)); return [0, 1, 2].map((k) => cr(d[k]) - cr(target[k])); };
  let best = null;
  for (const start of [[0, 0, 0, 0], [2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 2, 0], [0, 0, 0, 2], [-2, 1, 1, 1]]) {
    let z = start.slice(), r = res(z), e = r.reduce((a, v) => a + v * v, 0), mu = 1e-2;
    for (let it = 0; it < 40 && e > 1e-12; it++) {
      const J = [0, 1, 2, 3].map((j) => { const zz = z.slice(); zz[j] += 1e-4; return res(zz).map((v, k) => (v - r[k]) / 1e-4); });
      const A = [0, 1, 2, 3].map((i) => [0, 1, 2, 3].map((j) => J[i].reduce((a, v, k) => a + v * J[j][k], 0) + (i === j ? mu : 0)));
      const b = [0, 1, 2, 3].map((i) => -J[i].reduce((a, v, k) => a + v * r[k], 0));
      const step = solve4(A, b), zn = z.map((v, i) => v + step[i]), rn = res(zn), en = rn.reduce((a, v) => a + v * v, 0);
      if (en < e) { z = zn; r = rn; e = en; mu *= 0.3; } else mu *= 10;
    }
    if (!best || e < best.e) best = { e, c: soft(z) };
  }
  return best.c;
}
function solve4(A, b) {
  const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < 4; i++) {
    let p = i; for (let k = i + 1; k < 4; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
    [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < 4; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j < 5; j++) M[k][j] -= f * M[i][j]; }
  }
  const x = [0, 0, 0, 0];
  for (let i = 3; i >= 0; i--) { let s = M[i][4]; for (let j = i + 1; j < 4; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; }
  return x;
}

// The lookup: concentrations on a 17^3 grid over sRGB-encoded [0, 1]^3, as Float32 (4 per node).
// It ships precomputed in lut-data.mjs (tools/shaders/gen-paint-lut.mjs writes it; a test
// rebuilds it and compares), because solving it takes seconds.
export const LUT_N = 17;
let lut = null;
export function latentLut() {
  if (!lut) lut = decodeLut(LUT_B64);
  return lut;
}
function decodeLut(b64) {
  const bin = typeof atob === "function" ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
  const u8 = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Float32Array(u8.buffer);
}
export function buildLut() {
  const lut = new Float32Array(LUT_N ** 3 * 4);
  const lin = (v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  for (let b = 0; b < LUT_N; b++) for (let gg = 0; gg < LUT_N; gg++) for (let r = 0; r < LUT_N; r++) {
    const c = fit([r, gg, b].map((v) => lin(v / (LUT_N - 1))));
    lut.set(c, ((b * LUT_N + gg) * LUT_N + r) * 4);
  }
  return lut;
}
// Trilinear lookup of concentrations for an sRGB-encoded colour in [0, 1].
export function lutConc(s) {
  const L = latentLut(), N = LUT_N, f = s.map((v) => Math.min(1, Math.max(0, v)) * (N - 1));
  const i0 = f.map((v) => Math.min(N - 2, Math.floor(v))), t = f.map((v, k) => v - i0[k]), c = [0, 0, 0, 0];
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const w = (dx ? t[0] : 1 - t[0]) * (dy ? t[1] : 1 - t[1]) * (dz ? t[2] : 1 - t[2]), o = (((i0[2] + dz) * N + i0[1] + dy) * N + i0[0] + dx) * 4;
    for (let k = 0; k < 4; k++) c[k] += w * L[o + k];
  }
  return c;
}
