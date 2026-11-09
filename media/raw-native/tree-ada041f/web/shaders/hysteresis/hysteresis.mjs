// Hysteresis quantisation: band and palette decisions that remember the last frame.
//
// Posterised light, toon bands and palette snapping flicker when a surface sits near a threshold
// and the light or the camera moves a little: the decision flips back and forth every frame (band
// boil). Here each pixel keeps the previous frame's decision, found by reprojecting through the
// motion vectors, and only changes it when the input leaves that decision's interval by a margin,
// a Schmitt trigger per decision. Where the reprojection lands on a different surface
// (disocclusion, by view distance) the pixel starts fresh with the plain decision. Prior: a video
// tool applies per-pixel palette hysteresis (NOVELTY.md); this is the real-time 3D form with
// reprojected memory, a margin in Oklab lightness and a bound of one band of lag.
//
// Bands: L = Oklab lightness of the display-referred colour, plain q = round(L N); keep p while
//   L N lies in [p - 0.5 - m, p + 0.5 + m]. Output: Oklab (p / N, a s, b s) with s = (p / N) / L.
// Palette: plain = nearest palette entry in Oklab; keep p while |c - P_p| <= |c - P_best| + m.
// A margin m < 0.5 keeps every held band within one band of the plain decision.
// Persistence: a held decision also gives way when the plain decision has differed from it for
// K frames in a row (a counter carried with the decision), K = persistSec x fps, so the
// persistence is a time (light flicker has a frequency in time, not in frames). Flicker reverses before K frames; a
// sustained change does not. Added after the first run, where margin alone kept 72% of the band
// changes a doubled lamp should cause (evidence/shaders-hysteresis-runs.json).
import { labPalette } from "../reference/retro-palettes.mjs";

export const HYST_PRESETS = {
  bands6: { mode: "bands", N: 6, margin: 0.3, persistSec: 0.2, fps: 24, gain: 2.4, depthTol: 0.03 },
  pico8: { mode: "palette", palette: "pico8", margin: 0.03, persistSec: 0.2, fps: 24, gain: 2.4, depthTol: 0.03 },
};
export function resolveHysteresis(preset, overrides = {}, size) {
  const p = { ...HYST_PRESETS[preset], ...overrides };
  const pal = p.mode === "palette" ? labPalette(p.palette).map((e) => e.lab) : [];
  return { p, w: size.w, h: size.h, pal, K: Math.max(1, Math.round(p.persistSec * p.fps)) };
}

export const shoulder = (v, g) => 1 - Math.exp(-Math.max(0, v) * g);
export function toOklab(r, g, b) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b), m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b), s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
}
export function fromOklab(L, a, b) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3, m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3, s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s, -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s, -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s];
}
const enc8 = (v) => { const c = Math.min(1, Math.max(0, v)), s = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055; return Math.round(s * 255); };

// Plain decision for one Oklab colour, and the distance of a palette entry (bands: unused).
function plainDecision(plan, lab) {
  const p = plan.p;
  if (p.mode === "bands") return Math.min(p.N, Math.max(0, Math.round(lab[0] * p.N)));
  let best = 0, bd = Infinity;
  for (let k = 0; k < plan.pal.length; k++) { const q = plan.pal[k], d = Math.hypot(lab[0] - q[0], lab[1] - q[1], lab[2] - q[2]); if (d < bd) { bd = d; best = k; } }
  return best;
}
function keep(plan, lab, prev, plain) {
  const p = plan.p;
  if (p.mode === "bands") { const x = lab[0] * p.N; return x >= prev - 0.5 - p.margin && x <= prev + 0.5 + p.margin; }
  const q = plan.pal[prev], b = plan.pal[plain];
  const dp = Math.hypot(lab[0] - q[0], lab[1] - q[1], lab[2] - q[2]), db = Math.hypot(lab[0] - b[0], lab[1] - b[1], lab[2] - b[2]);
  return dp <= db + p.margin;
}

// A sequence runner. state: { idx: Int32Array, dist: Float32Array } or null for the first frame.
// frame: { width, height, data (scene-linear RGBA) }; motion: { mv, dA } or null (static camera);
// dist: this frame's view distance per pixel (for the next frame's disocclusion test).
export function step(plan, frame, motion, dist, state, { hysteresis = true } = {}) {
  const { w, h, p } = plan, n = w * h, idx = new Int32Array(n), cnt = new Int32Array(n), plainIdx = new Int32Array(n), out = new Uint8ClampedArray(n * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, o = i * 4, lab = toOklab(shoulder(frame.data[o], p.gain), shoulder(frame.data[o + 1], p.gain), shoulder(frame.data[o + 2], p.gain));
    const plain = plainDecision(plan, lab); plainIdx[i] = plain;
    let d = plain;
    if (hysteresis && state) {
      const mx = motion ? motion.mv[i * 2] : 0, my = motion ? motion.mv[i * 2 + 1] : 0;
      const px = Math.floor(x + 0.5 - mx), py = Math.floor(y + 0.5 - my);
      if (px >= 0 && py >= 0 && px < w && py < h) {
        const j = py * w + px, expect = motion ? motion.dA[i] : dist[i];
        if (Math.abs(state.dist[j] - expect) <= p.depthTol * expect) {
          const prev = state.idx[j];
          if (prev !== plain && keep(plan, lab, prev, plain)) { const c = state.cnt[j] + 1; if (c < plan.K) { d = prev; cnt[i] = c; } }
        }
      }
    }
    idx[i] = d;
    let rgb;
    if (p.mode === "bands") { const Lq = d / p.N, s = lab[0] > 1e-9 ? Lq / lab[0] : 0; rgb = fromOklab(Lq, lab[1] * s, lab[2] * s); }
    else rgb = fromOklab(...plan.pal[d]);
    out[o] = enc8(rgb[0]); out[o + 1] = enc8(rgb[1]); out[o + 2] = enc8(rgb[2]); out[o + 3] = 255;
  }
  return { idx, plainIdx, out, state: { idx, cnt, dist: Float32Array.from(dist) } };
}
