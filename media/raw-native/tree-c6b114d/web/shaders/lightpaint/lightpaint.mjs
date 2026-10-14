// Pigment-space lighting: light decides what a painter would mix into the local colour.
//
// A renderer darkens a shadow by multiplying RGB, so yellow in shadow stays yellow, only darker.
// A painter mixes: yellow in shadow takes some of the shadow colour on the palette (an
// ultramarine, a violet, the light's complement), and Kubelka-Munk mixing turns it olive; a red
// goes maroon; a highlight takes a warm white. Here each pixel's albedo becomes a pigment latent
// (four concentrations plus an RGB residual, as in the painterly shader), and the irradiance sets
// how much shadow pigment or light pigment is mixed into it, subtractively, at run time. Nearest
// prior (Lei and Chang, PCM 2004) precomputes one KM colour band per object, painted by hand and
// indexed by N.L; here the mix is per pixel for any albedo, with one global choice of pigments.
//
// Value stays with the light: the paint sets the chromaticity, the physical lighting sets the
// luminance, so relighting keeps its energy and the result is monotone in irradiance.
//   e = Y(E), lc = E / e, t = e / (e + Emid)                              irradiance to a value
//   ws = strength ((t0 - t) / t0)^shape below t0;  wl = strength ((t - t0) / (1 - t0))^shape above
//   c = (1 - ws - wl) c_albedo + ws c_shadow + wl c_light;  r = (1 - ws - wl) r_albedo
//   paint = clamp(KM(c) + r, 0, 1);  out = (paint * lc) * Y(albedo * E) / Y(paint * lc)
// With strength 0 the paint is the albedo and out is albedo * E exactly (up to rounding).
// Sky and emissive pixels pass through; fog is applied after, as in the source.
import { kmDecode, lutConc } from "../paint/pigments.mjs";
import { linearToSrgb } from "../common.mjs";

export const LP_PRESETS = {
  disco: { shadow: [0, 0, 0.45, 0.55], light: [0.8, 0.2, 0, 0], Emid: 0.35, t0: 0.5, strength: 0.5, shape: 1.5, complement: false },
  grotesque: { shadow: [0, 0.15, 0.6, 0.25], light: [0.5, 0.45, 0, 0.05], Emid: 0.3, t0: 0.55, strength: 1, shape: 0.7, complement: false },
  complement: { shadow: [0, 0, 0, 1], light: [0.85, 0.15, 0, 0], Emid: 0.35, t0: 0.5, strength: 0.6, shape: 1.2, complement: true },
};
const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const resolveLightpaint = (preset, overrides = {}) => ({ p: { ...LP_PRESETS[preset], ...overrides } });

export function latentOf(rgb) {
  const c = lutConc(rgb.map((v) => linearToSrgb(Math.min(1, Math.max(0, v))))), d = kmDecode(c);
  return { c, r: [rgb[0] - d[0], rgb[1] - d[1], rgb[2] - d[2]] };
}
// The complement of a light colour, as a dark pigment: (max + min) - lc, scaled to a 0.3 peak.
export function complementOf(lc) {
  const mx = Math.max(...lc), mn = Math.min(...lc), q = lc.map((v) => mx + mn - v), m = Math.max(...q, 1e-9);
  return q.map((v) => (0.3 * v) / m);
}

// Shade one pixel: albedo and irradiance E (linear RGB). Returns [out, paint].
export function shade(plan, alb, E) {
  const p = plan.p, e = Y(E);
  if (!(e > 1e-12)) return [[0, 0, 0], alb.slice()];
  const lc = [E[0] / e, E[1] / e, E[2] / e], t = e / (e + p.Emid);
  const ws = t < p.t0 ? p.strength * Math.pow((p.t0 - t) / p.t0, p.shape) : 0;
  const wl = t > p.t0 ? p.strength * Math.pow((t - p.t0) / (1 - p.t0), p.shape) : 0;
  const a = latentOf(alb), cs = p.complement ? lutConc(complementOf(lc).map(linearToSrgb)) : p.shadow;
  const wa = 1 - ws - wl, c = [0, 1, 2, 3].map((k) => wa * a.c[k] + ws * cs[k] + wl * p.light[k]);
  const d = kmDecode(c), paint = [0, 1, 2].map((k) => Math.min(1, Math.max(0, d[k] + wa * a.r[k])));
  const tint = [paint[0] * lc[0], paint[1] * lc[1], paint[2] * lc[2]], yt = Y(tint), target = Y([alb[0] * E[0], alb[1] * E[1], alb[2] * E[2]]);
  if (!(yt > 1e-9)) return [[alb[0] * E[0], alb[1] * E[1], alb[2] * E[2]], paint];
  const s = target / yt;
  return [[tint[0] * s, tint[1] * s, tint[2] * s], paint];
}

// A whole frame from the street fixture's lighting outputs.
export function runLightpaint(plan, src) {
  const { width: w, height: h } = src, out = new Float32Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const o = i * 4, E = [src.light[o], src.light[o + 1], src.light[o + 2]];
    let c;
    if (src.kind[i] === 2) c = shade(plan, [src.albedo[o], src.albedo[o + 1], src.albedo[o + 2]], E)[0];
    else c = E;
    const f = src.fogT[i];
    for (let k = 0; k < 3; k++) out[o + k] = c[k] * (1 - f) + src.fogColor[k] * f;
    out[o + 3] = 1;
  }
  return { width: w, height: h, data: out };
}
