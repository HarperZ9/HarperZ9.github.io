/* retro-dither.js: the quantisation step of the Retro engine.

   retro.py nudges lightness by a fixed Bayer offset before the nearest-colour
   pick. That only ever dithers inside a band as wide as the offset, so a
   four-colour hardware palette shows hard steps across most of a ramp. Here
   the pattern decides between the two palette colours that bracket the
   pixel, and the mix fraction is the pixel's position along the segment
   between them in OKLab. A coarse palette dithers a full ramp, a rich one
   dithers only where its steps are visible, and the threshold source is a
   choice: Bayer 2/4/8, interleaved gradient noise, or serpentine
   Floyd-Steinberg diffusion in OKLab. Pure functions over typed arrays, so
   the same code runs in the browser and in a node test. */

import { nearestIndex } from "./retro-palettes.js";

export const BAYER = {
  2: [[0, 2], [3, 1]],
  4: [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]],
  8: [[0, 32, 8, 40, 2, 34, 10, 42], [48, 16, 56, 24, 50, 18, 58, 26],
    [12, 44, 4, 36, 14, 46, 6, 38], [60, 28, 52, 20, 62, 30, 54, 22],
    [3, 35, 11, 43, 1, 33, 9, 41], [51, 19, 59, 27, 49, 17, 57, 25],
    [15, 47, 7, 39, 13, 45, 5, 37], [63, 31, 55, 23, 61, 29, 53, 21]],
};
export const BAYER_MAX = { 2: 4, 4: 16, 8: 64 };
export const DITHER_MODES = ["none", "bayer2", "bayer4", "bayer8", "noise", "diffusion"];

// Interleaved gradient noise (Jimenez 2014): a cheap hash whose spectrum reads
// as grain, never as a grid. Deterministic in (x, y).
export function ign(x, y) {
  const f = 0.06711056 * x + 0.00583715 * y;
  const v = 52.9829189 * (f - Math.floor(f));
  return v - Math.floor(v);
}

// Weight of the pair-distance penalty in the bracketing score.
const PAIR_PENALTY = 0.12;

// The palette colour that best brackets (L, a, b) together with entry i: the
// one whose segment from entry i passes closest to the pixel, among entries
// on the far side of the pixel from i. Returns -1 when no other colour lies
// on the far side. Choosing the closest segment, not the closest colour,
// keeps a near-white pixel between white and pink from flickering cyan.
export function farSideIndex(L, a, b, i, pal) {
  const p = pal[i].lab;
  const dL = L - p[0], da = a - p[1], db = b - p[2];
  const d2 = dL * dL + da * da + db * db;
  let best = -1, bestScore = Infinity;
  for (let j = 0; j < pal.length; j++) {
    if (j === i) continue;
    const q = pal[j].lab;
    const sL = q[0] - p[0], sa = q[1] - p[1], sb = q[2] - p[2];
    const len2 = sL * sL + sa * sa + sb * sb;
    if (len2 < 1e-9) continue;
    const u = (dL * sL + da * sa + db * sb) / len2;
    if (u <= 0) continue;
    const uc = Math.min(u, 1);
    // Residual error of the mix, plus a penalty on mixing distant colours that
    // grows as the ratio leaves 0.5 (after Yliluoma). A sparse scatter of a far
    // hue reads as specks, so the nearer hue wins unless it is a poor fit.
    const score = d2 - uc * uc * len2 + PAIR_PENALTY * len2 * (Math.abs(uc - 0.5) + 0.5);
    if (score < bestScore) { bestScore = score; best = j; }
  }
  return best;
}

// Ordered pick between the bracketing pair for one pixel. `t` is the pattern
// threshold in [0, 1); `strength` folds the threshold toward 0.5, so 0 is a
// plain nearest-colour pick and 1 is the full pattern.
export function orderedPick(L, a, b, pal, t, strength) {
  const i = nearestIndex(L, a, b, pal);
  if (pal.length < 2 || strength <= 0) return i;
  const j = farSideIndex(L, a, b, i, pal);
  if (j < 0) return i;
  const p = pal[i].lab, q = pal[j].lab;
  const sL = q[0] - p[0], sa = q[1] - p[1], sb = q[2] - p[2];
  const len2 = sL * sL + sa * sa + sb * sb;
  if (len2 < 1e-9) return i;
  let f = ((L - p[0]) * sL + (a - p[1]) * sa + (b - p[2]) * sb) / len2;
  f = f < 0 ? 0 : f > 1 ? 1 : f;
  const th = 0.5 + (t - 0.5) * strength;
  return f > th ? j : i;
}

function diffuse(lab, tw, th, pal, strength) {
  const out = new Uint16Array(tw * th);
  const err = new Float32Array(tw * th * 3);
  const CAP = 0.5; // per-channel error clamp: no worms, no runaway in flat fields
  const push = (p, eL, ea, eb, k) => {
    const q = p * 3;
    err[q] += eL * k; err[q + 1] += ea * k; err[q + 2] += eb * k;
  };
  for (let y = 0; y < th; y++) {
    const ltr = (y & 1) === 0;
    for (let s = 0; s < tw; s++) {
      const x = ltr ? s : tw - 1 - s, p = y * tw + x, q = p * 3;
      const c = lab[p];
      const L = c[0] + Math.max(-CAP, Math.min(CAP, err[q]));
      const a = c[1] + Math.max(-CAP, Math.min(CAP, err[q + 1]));
      const b = c[2] + Math.max(-CAP, Math.min(CAP, err[q + 2]));
      const i = nearestIndex(L, a, b, pal);
      out[p] = i;
      const e = pal[i].lab;
      const eL = (L - e[0]) * strength, ea = (a - e[1]) * strength, eb = (b - e[2]) * strength;
      const dx = ltr ? 1 : -1;
      if (x + dx >= 0 && x + dx < tw) push(p + dx, eL, ea, eb, 7 / 16);
      if (y + 1 < th) {
        if (x - dx >= 0 && x - dx < tw) push(p + tw - dx, eL, ea, eb, 3 / 16);
        push(p + tw, eL, ea, eb, 5 / 16);
        if (x + dx >= 0 && x + dx < tw) push(p + tw + dx, eL, ea, eb, 1 / 16);
      }
    }
  }
  return out;
}

/* ditherPlate(lab, tw, th, pal, mode, strength) -> Uint16Array of palette
   indices, one per pixel. `lab` is an array of [L, a, b] triples in row-major
   order, `pal` an array of { lab } entries. */
export function ditherPlate(lab, tw, th, pal, mode = "bayer4", strength = 1) {
  const s = Math.max(0, Math.min(1, +strength || 0));
  if (mode === "diffusion" && s > 0) return diffuse(lab, tw, th, pal, s);
  const out = new Uint16Array(tw * th);
  const N = mode === "bayer2" ? 2 : mode === "bayer4" ? 4 : mode === "bayer8" ? 8 : 0;
  const noise = mode === "noise";
  const patterned = (N > 0 || noise) && s > 0;
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) {
    const p = y * tw + x, c = lab[p];
    if (!patterned) { out[p] = nearestIndex(c[0], c[1], c[2], pal); continue; }
    const t = noise ? ign(x, y) : (BAYER[N][y % N][x % N] + 0.5) / BAYER_MAX[N];
    out[p] = orderedPick(c[0], c[1], c[2], pal, t, s);
  }
  return out;
}
