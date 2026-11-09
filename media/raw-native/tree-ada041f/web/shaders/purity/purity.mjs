// CRT colour purity and degauss: beams that land on the wrong phosphor.
//
// In a colour tube each gun's beam passes the aperture grille at an angle chosen so it lands on its
// own phosphor stripe. A stray magnetic field (a magnetised mask, the earth's field, a speaker
// magnet) bends the beams, so they land shifted and partly light the neighbouring stripe: colour
// blotches that follow the field. Degaussing drives a decaying AC field through a coil around the
// tube; while it rings, the landing error swings at the mains frequency and dies away. Because the
// beam draws the picture line by line, the swing is sampled at each line's own time, so a frame
// shows bands of shifted colour running down the screen.
//
// Model, per pixel, in triad-pitch units (stripes R, G, B left to right at -1/3, 0, +1/3, width s;
// the rest is black matrix). Gun k's beam is a footprint of width w <= s centred at c_k + e, where e
// is the horizontal landing error (vertical errors do not matter on vertical stripes). The light of
// gun k reaching stripe j is the overlap of the footprint with stripe j (and its neighbours one
// pitch away) over w; light on the black matrix is lost, none is created. With e = 0 every beam
// lands inside its own stripe and the picture is unchanged.
//   e(x, y, t) = magnetisation (smooth noise) + earth field (u r^2) + degauss
// The three beams leave the guns at different places, so one stray field moves them by different
// amounts: gun k lands with e (1 + spread (k - 1)). With spread 0 a white field only dims (each
// stripe gets its neighbour's light in exchange); with spread > 0 it tints, as tubes do. The spread
// is a choice (low confidence), added after the first sheets showed grey blotches on white.
//   degauss = A exp(-t / tau) sin(2 pi f t_line) (0.3 + r^2),  t_line = t + (y / H) T (1 - blank)
// The same swing deflects the whole picture a little (wobble), dx = k_geo e_degauss pixels.
// Sources for the physics: US 4122485 (landing errors), US 5754007 (decaying degauss current);
// constants are choices or low confidence (docs/shaders/CONSTANTS.md).
import { hash3 } from "../common.mjs";

export const PURITY_PRESETS = {
  magnetised: { s: 0.26, spread: 0.35, w: 0.2, mag: 0.16, magScale: 0.3, earth: 0, degauss: 0, tau: 0.25, mains: 60, field: 59.94, blank: 0.08, wobble: 0 },
  "earth-field": { s: 0.26, spread: 0.35, w: 0.2, mag: 0.02, magScale: 0.3, earth: 0.12, degauss: 0, tau: 0.25, mains: 60, field: 59.94, blank: 0.08, wobble: 0 },
  degauss: { s: 0.26, spread: 0.35, w: 0.2, mag: 0.015, magScale: 0.3, earth: 0, degauss: 0.08, tau: 0.25, mains: 60, field: 59.94, blank: 0.08, wobble: 3 },
};
export const resolvePurity = (preset, overrides = {}) => ({ p: { ...PURITY_PRESETS[preset], ...overrides } });

const CENT = [-1 / 3, 0, 1 / 3];
const overlap = (a0, a1, b0, b1) => Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
// f[k][j]: fraction of gun k's light on stripe j, for landing error e (one number, or one per gun).
export function landing(p, e) {
  const f = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], ek = typeof e === "number" ? [e, e, e] : e;
  for (let k = 0; k < 3; k++) {
    const a0 = CENT[k] + ek[k] - p.w / 2, a1 = CENT[k] + ek[k] + p.w / 2;
    for (let j = 0; j < 3; j++) for (let m = -1; m <= 1; m++) f[k][j] += overlap(a0, a1, CENT[j] + m - p.s / 2, CENT[j] + m + p.s / 2) / p.w;
  }
  return f;
}

const fade5 = (t) => t * t * t * (t * (t * 6 - 15) + 10);
export function vnoise2(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), u = fade5(x - xi), v = fade5(y - yi);
  const h = (i, j) => hash3((i + 4096) >>> 0, (j + 4096) >>> 0, seed);
  return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
}
// Screen coordinates: u, v in [-1, 1] (v down), aspect-corrected radius squared.
export function coords(w, h, x, y) { const u = ((x + 0.5) / w) * 2 - 1, v = ((y + 0.5) / h) * 2 - 1, a = w / h; return { u, v, r2: (u * u * a * a + v * v) / (a * a + 1) * 2 }; }
export function degaussAt(p, t, y, h) { const tl = t + (y / h) * (1 - p.blank) / p.field; return p.degauss * Math.exp(-tl / p.tau) * Math.sin(2 * Math.PI * p.mains * tl); }
export function staticError(p, w, h, x, y) {
  const c = coords(w, h, x, y), sc = p.magScale * w;
  const m = p.mag * ((0.65 * vnoise2(x / sc, y / sc, 31) + 0.35 * vnoise2(x / (0.4 * sc), y / (0.4 * sc), 37)) - 0.5) * 2;
  return m + p.earth * c.u * c.r2;
}
export function landingError(p, w, h, x, y, t) { const c = coords(w, h, x, y); return { stat: staticError(p, w, h, x, y), dg: degaussAt(p, t, y, h) * (0.3 + c.r2) }; }

// A frame. src: display-linear RGBA (0..1). Returns display-linear RGBA.
export function runPurity(plan, src, t) {
  const p = plan.p, { width: w, height: h } = src, out = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const { stat, dg } = landingError(p, w, h, x, y, t), e = stat + dg, f = landing(p, [e * (1 - p.spread), e, e * (1 + p.spread)]);
    // Wobble: the picture itself shifts by k_geo times the degauss swing (linear interpolation).
    const xs = x - p.wobble * (dg / Math.max(p.degauss, 1e-9)), x0 = Math.floor(xs), fx = xs - x0;
    const I = [0, 0, 0];
    for (const [xx, wt] of [[x0, 1 - fx], [x0 + 1, fx]]) { const xc = Math.min(w - 1, Math.max(0, xx)), o = (y * w + xc) * 4; for (let k = 0; k < 3; k++) I[k] += wt * src.data[o + k]; }
    const o = (y * w + x) * 4;
    for (let j = 0; j < 3; j++) out[o + j] = f[0][j] * I[0] + f[1][j] * I[1] + f[2][j] * I[2];
    out[o + 3] = 1;
  }
  return { width: w, height: h, data: out };
}
// Display-linear to 8-bit sRGB (round half up), shared by the parity page and the sheets.
export function displayEncode8(f) {
  const o = new Uint8ClampedArray(f.width * f.height * 4);
  for (let i = 0; i < o.length; i++) { if ((i & 3) === 3) { o[i] = 255; continue; } const c = Math.min(1, Math.max(0, f.data[i])); o[i] = Math.round((c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055) * 255); }
  return o;
}
