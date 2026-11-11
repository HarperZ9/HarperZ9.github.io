// grounds-more.mjs: three more mediums as grounds, each by its own rule, each from a model the site already has.
// Pure: no page, runs in node and the browser. The shader's half is well-shader-more.mjs; mixOn() in grounds.mjs calls
// the rules here, and a browser test holds the shader to them.
//
//   film stock   EXPOSURE. Each pigment is light from the scene, and light adds on the negative. The site's spectral film
//                model (media/raw-native/tree-ada041f/web/shaders/film: stocks.mjs, film.mjs, grain.mjs) turns the total
//                into the colour seen: the negative's curves, the print and the projector lamp, wavelength by wavelength.
//                Its stock is the 500T negative without its anti-halation backing, so bright light spreads a red halo.
//                The bench reads the model through a table of 17 by 17 by 17 exposures (filmTable).
//   sound        POWER. A sound is drawn as a spectrogram (time across, pitch up). Sounds that do not keep step add in
//                power, and power is read in decibels, so two equal sounds read 3 decibels louder, not twice as bright.
//                The ground is the spectrogram of a signal, made by world/sound's own short-time Fourier transform (dsp.js).
//   fire heat    GLOW. Each pigment is a body on a hot plate. A pigment that absorbs more light also takes up and gives off
//                more heat (Kirchhoff's law), the heat adds, and the glow is a blackbody's colour at that temperature
//                (Planck's law through the CIE observer, the shader library's spectral.mjs).
// Our numbers, stated: the exposure of a unit of pigment, the decibel range, the plate's temperature and the heat of a
// unit of pigment. The film curves, the grain size and the halo are the film model's own; none is measured here.
import { resolveFilm } from '../../../media/raw-native/tree-ada041f/web/shaders/film/film.mjs';
import { negDensities, printPixel } from '../../../media/raw-native/tree-ada041f/web/shaders/film/stocks.mjs';
import { blackbody, spdToXYZ, apply3, XYZ_TO } from '../../../media/raw-native/tree-ada041f/web/shaders/spectral.mjs';
import { stft } from '../../sound/sound/dsp.js';
import { RATE, SIGNALS } from './signal.mjs';
import { linToSrgb, srgbToLin } from './km.mjs';

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x), lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
// ---- film stock ----
export const FILM = Object.freeze({ preset: '500t-no-remjet', expo: 0.9, stops: [-7, 5], n: 17, gateMM: 24.89 });
let film = null;
export function filmPlan(widthPx = 900) { if (!film) film = resolveFilm(FILM.preset, {}, { w: 900, h: 675 }, { w: 900, h: 675 });
  const um = FILM.gateMM * 1000 / widthPx, t = film.t;
  // grain: the stock's data-sheet granularity (sigma D through a 48 micrometre aperture) carried to one pixel of the well by
  // Selwyn's law (sigma times the square root of the area is constant), as grain.mjs states it, and turned into stops of
  // exposure by the negative's slope; each layer's grain is in proportion to its dye cloud size
  const sD = t.sigmaD48 * Math.sqrt(Math.PI * 24 * 24) / um, stops = film.t.grainUm.map((r) => sD * r / t.grainUm[1] / 0.62 / Math.log10(2));
  return { halo: film.haloStrength, ringFrac: film.halo.ringMm / FILM.gateMM, grainStops: stops, umPerPx: um };
}
const toU = (e) => clamp((Math.log2(Math.max(e, 1e-9) / 0.18) - FILM.stops[0]) / (FILM.stops[1] - FILM.stops[0]), 0, 1);
let table = null;
// 17 by 17 by 17 exposures, log-spaced, through the whole film path; laid out as 289 by 17 RGBA bytes (blue slices side by side)
export function filmTable() {
  if (table) return table; filmPlan(); const n = FILM.n, d = new Uint8Array(n * n * n * 4), e = (i) => 0.18 * 2 ** (FILM.stops[0] + (FILM.stops[1] - FILM.stops[0]) * i / (n - 1));
  for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) { const o = (g * n * n + b * n + r) * 4, out = printPixel(film.t, negDensities(film.t, [e(r), e(g), e(b)]));
    for (let c = 0; c < 3; c++) d[o + c] = Math.round(255 * linToSrgb(clamp(out[c], 0, 1))); d[o + 3] = 255; }
  return (table = { w: n * n, h: n, data: d });
}
// The table read the way the shader reads it: bilinear inside a blue slice, then linear between two slices.
export function filmLook(E) {
  const T = filmTable(), n = FILM.n, f = E.map((x) => toU(x) * (n - 1)), at = (r, g, b, c) => T.data[(g * n * n + b * n + r) * 4 + c] / 255;   // bytes are interpolated as stored, then decoded, as the shader's texture is
  const [fr, fg, fb] = f, r0 = Math.min(n - 2, Math.floor(fr)), g0 = Math.min(n - 2, Math.floor(fg)), b0 = Math.min(n - 2, Math.floor(fb)), tr = fr - r0, tg = fg - g0, tb = fb - b0;
  return [0, 1, 2].map((c) => { const sl = (b) => (at(r0, g0, b, c) * (1 - tr) + at(r0 + 1, g0, b, c) * tr) * (1 - tg) + (at(r0, g0 + 1, b, c) * (1 - tr) + at(r0 + 1, g0 + 1, b, c) * tr) * tg; return srgbToLin(sl(b0) * (1 - tb) + sl(b0 + 1) * tb); });
}
// The exposure on the negative: the scene behind the pigments (the ground's own colour) plus every pigment's light.
export const exposure = (base, lins, d) => [0, 1, 2].map((c) => base[c] + FILM.expo * lins.reduce((s, lin, i) => s + d[i] * lin[c], 0));
// ---- sound ----
export const SOUND = Object.freeze({ floorDb: -60, rangeDb: 60, groundDb: -42, unit: 0.05, n: 256, hop: 64 });   // unit: the power of a unit of pigment, 13 decibels under full
export const level = (P) => clamp((10 * Math.log10(Math.max(P, 1e-12)) - SOUND.floorDb) / SOUND.rangeDb, 0, 1);
const hueOf = (lin) => { const m = Math.max(...lin, 1e-6); return lin.map((x) => x / m); };
// powers add; the colour is each sound's hue weighted by its power; the brightness is the level in decibels
export function soundMix(base, lins, d, floorP = 10 ** (SOUND.groundDb / 10)) {
  const P = floorP + SOUND.unit * d.reduce((s, x) => s + Math.max(0, x), 0), hue = [0, 1, 2].map((c) => (floorP * hueOf(base)[c] + SOUND.unit * lins.reduce((s, lin, i) => s + Math.max(0, d[i]) * hueOf(lin)[c], 0)) / P);
  return hue.map((h) => h * level(P) ** 2.2);
}
// The ground: a signal's spectrogram by world/sound's stft, in decibels on the bench's range, as bytes (time across, pitch up).
export function spectrogram(samples = null) {
  const x = samples || Float32Array.from(SIGNALS.hiss.make(), (v) => v * 0.08), s = stft(x, RATE, { n: SOUND.n, hop: SOUND.hop }), w = s.frames.length, h = s.bins, data = new Uint8Array(w * h * 4);
  for (let t = 0; t < w; t++) for (let b = 0; b < h; b++) { const db = s.frames[t][b], o = ((h - 1 - b) * w + t) * 4, v = Math.round(255 * clamp((db - SOUND.floorDb) / SOUND.rangeDb, 0, 1)); data[o] = data[o + 1] = data[o + 2] = v; data[o + 3] = 255; }
  return { w, h, data, binHz: s.binHz, hopSec: s.hopSec };
}
// ---- fire heat ----
export const HEAT = Object.freeze({ plate: 1100, unit: 600, low: 700, high: 3300, ref: 1900, decades: 4, n: 64 });
const Yref = spdToXYZ(blackbody(HEAT.ref), 5)[1];
export function glowColour(T) { const X = spdToXYZ(blackbody(T), 5), c = apply3(XYZ_TO.rec709, X.map((v) => v / X[1])).map((v) => Math.max(0, v)), m = Math.max(...c);
  const b = clamp((Math.log10(X[1] / Yref) + HEAT.decades) / HEAT.decades, 0, 1) ** 2; return c.map((v) => v / m * b); }
let glows = null;
export function glowTable() { if (glows) return glows; const d = new Uint8Array(HEAT.n * 4);
  for (let i = 0; i < HEAT.n; i++) { const c = glowColour(HEAT.low + (HEAT.high - HEAT.low) * i / (HEAT.n - 1)); for (let k = 0; k < 3; k++) d[i * 4 + k] = Math.round(255 * linToSrgb(c[k])); d[i * 4 + 3] = 255; }
  return (glows = { w: HEAT.n, h: 1, data: d }); }
export const temperature = (lins, d) => HEAT.plate + HEAT.unit * lins.reduce((s, lin, i) => s + d[i] * (1 - clamp(lum(lin), 0, 1)), 0);
export function glowLook(T) { const G = glowTable(), f = clamp((T - HEAT.low) / (HEAT.high - HEAT.low), 0, 1) * (HEAT.n - 1), i = Math.min(HEAT.n - 2, Math.floor(f)), t = f - i;
  return [0, 1, 2].map((c) => srgbToLin((G.data[i * 4 + c] * (1 - t) + G.data[(i + 1) * 4 + c] * t) / 255)); }
