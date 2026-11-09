// Spectral lights and materials for the sodium study and the Sodium Quay shading pass.
//
// Every light has a spectral power distribution; every material a spectral reflectance. For
// Lambertian reflection without fluorescence the colour of material m under light L is fixed, so
// it is integrated once, in float64, into a response table resp[L][m] (linear Rec. 709 and XYZ).
// Continuous spectra are integrated at 1 nm; emission lines are exact delta terms, which is why a
// 0.6 nm doublet survives (the lens suite's 40 nm bins could not hold it). Each light is scaled so
// a perfect white (R = 1) has luminance Y = 1 per unit intensity.
import { cmf, XYZ_TO, apply3, blackbody, energyBand } from "../spectral.mjs";

// ---- lights ----
// Low-pressure sodium: D2 589.0 nm and D1 589.6 nm at 2 : 1, plus `impurity` of the power in two
// weak sodium lines (568.5 and 615.8 nm, split evenly). The 2% default is an approximate figure.
export const sodiumLines = (impurity = 0.02) => [[589.0, (2 / 3) * (1 - impurity)], [589.6, (1 / 3) * (1 - impurity)], [568.5, impurity / 2], [615.8, impurity / 2]];
export const LIGHT_TYPES = ["sodium", "window", "led", "sky"];
export function lightSpectrum(type, { impurity = 0.02 } = {}) {
  if (type === "sodium") return { lines: sodiumLines(impurity) };
  if (type === "window") return { spd: blackbody(2700) };
  if (type === "sky") return { spd: blackbody(4100) };
  if (type === "led") { const b = energyBand(450, 22), p = energyBand(560, 110); return { spd: (wl) => 0.55 * b(wl) + p(wl) }; }
  throw new Error(`sodium: unknown light type ${type}`);
}

// ---- materials ----
// Reflectance as a sigmoid of a quadratic in t = (lambda - 380) / 400 (the form of Jakob and
// Hanika 2019; the coefficients are ours), times a peak value. [a, b, c] gives x = a t^2 + b t + c.
const sig = (x) => 0.5 + x / (2 * Math.sqrt(1 + x * x));
export const MATERIALS = [
  { name: "red paint", q: [0, 12, -6.6], peak: 0.85 }, { name: "orange buoy", q: [0, 14, -6.65], peak: 0.85 },
  { name: "yellow line", q: [0, 14, -4.9], peak: 0.85 }, { name: "green door", q: [-60, 45, -6.94], peak: 0.8 },
  { name: "teal hull", q: [-50, 27.5, -2.58], peak: 0.8 }, { name: "blue van", q: [0, -12, 3.6], peak: 0.8 },
  { name: "violet", q: [40, -36, 6.9], peak: 0.8 }, { name: "grey", flat: 0.5 },
  // scene materials (not in the palette metric)
  { name: "asphalt", flat: 0.06 }, { name: "stone", q: [0, 1.2, -0.9], peak: 0.32 }, { name: "plaster", q: [0, 2, -0.4], peak: 0.55 },
  { name: "brick", q: [0, 9, -4.2], peak: 0.45 }, { name: "metal", flat: 0.3 }, { name: "glass", flat: 0.05 },
];
export const PALETTE = 8; // the first eight are the measured palette
export function reflectance(m, wl) {
  const M = typeof m === "number" ? MATERIALS[m] : m;
  if (M.flat !== undefined) return M.flat;
  const t = (wl - 380) / 400, [a, b, c] = M.q;
  return M.peak * sig(a * t * t + b * t + c);
}

// XYZ of reflectance R under a light spectrum (unnormalised).
function xyzUnder(spec, R) {
  const o = [0, 0, 0];
  if (spec.lines) for (const [wl, w] of spec.lines) { const c = cmf(wl), r = R(wl); for (let k = 0; k < 3; k++) o[k] += w * r * c[k]; }
  else for (let wl = 380; wl <= 780; wl++) { const c = cmf(wl), s = spec.spd(wl) * R(wl); for (let k = 0; k < 3; k++) o[k] += s * c[k]; }
  return o;
}
// The response table: xyz[L][m] and rgb[L][m] (linear Rec. 709), white normalised to Y = 1;
// white[L] is the colour of the light itself (a perfect white reflector), for emission and mist.
export function responseTable({ impurity = 0.02, types = LIGHT_TYPES } = {}) {
  const xyz = [], rgb = [], white = [];
  for (const t of types) {
    const spec = lightSpectrum(t, { impurity }), w = xyzUnder(spec, () => 1), Y = w[1];
    const row = MATERIALS.map((_, m) => xyzUnder(spec, (wl) => reflectance(m, wl)).map((v) => v / Y));
    xyz.push(row); rgb.push(row.map((v) => apply3(XYZ_TO.rec709, v))); white.push(apply3(XYZ_TO.rec709, w.map((v) => v / Y)));
  }
  return { types, xyz, rgb, white };
}

// ---- metric ----
// OKLab from XYZ (D65), with a signed cube root so out-of-gamut colours stay defined.
const M1 = [0.8189330101, 0.3618667424, -0.1288597137, 0.0329845436, 0.9293118715, 0.0361456387, 0.0482003018, 0.2643662691, 0.633851707];
const M2 = [0.2104542553, 0.793617785, -0.0040720468, 1.9779984951, -2.428592205, 0.4505937099, 0.0259040371, 0.7827717662, -0.808675766];
export function xyzToOklab(xyz) { return apply3(M2, apply3(M1, xyz).map(Math.cbrt)); }
// Chromatic spread: the largest distance between (a / L, b / L) over pairs of colours (XYZ).
export function chromaSpread(xyzs) {
  const d = xyzs.map((v) => { const [L, a, b] = xyzToOklab(v); return [a / L, b / L]; });
  let s = 0; for (let i = 0; i < d.length; i++) for (let j = i + 1; j < d.length; j++) s = Math.max(s, Math.hypot(d[i][0] - d[j][0], d[i][1] - d[j][1]));
  return s;
}
// Spread of the palette under a mix: weights per light type (luminance fractions of a white).
export function paletteSpread(table, weights) {
  const cols = []; for (let m = 0; m < PALETTE; m++) { const v = [0, 0, 0]; table.types.forEach((t, L) => { const w = weights[t] || 0; for (let k = 0; k < 3; k++) v[k] += w * table.xyz[L][m][k]; }); cols.push(v); }
  return chromaSpread(cols);
}
