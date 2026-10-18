// Palette-locked lighting: light is resolved into the palette's own ramps, so every output pixel is
// a palette entry and lighting never makes a colour the palette does not hold. CPU reference, f64.
//
// Per lit pixel: the irradiance splits into a cool part (moon and ambient) and a warm part (lamp,
// window glow). With E = E_cool + E_warm and detail a in 0..1,
//   tone = 1 - exp(-gain E a)            the ramp coordinate s = tone (K - 1), K steps per ramp,
//   w    = E_warm / E                    the warm fraction.
// The ramp variant is the warm one above w = 0.7, the cool one below 0.3, and dithered by w between (so the variant pattern only shows in the transition), the step is the upper neighbour of
// floor(s) when the fraction of s exceeds another. Both thresholds come from the same Bayer 8 x 8
// matrix at two phases (so they are not the same pattern), screen-anchored, as the dither lighting
// study chose. Ramp steps are spaced evenly in perceived lightness by construction (palette.mjs),
// so mixing in index space keeps the mean lightness of a neighbourhood at the tone's.
// Void pools cycle: the pool pattern plus time sets a position on a closed ramp of 6, dithered
// between neighbours, wrapping around: the palette-cycle animation of 8-bit hardware.
// Emissive window and lamp pixels take the short ramps by their flicker value.
import { thresholdAt } from "../ditherlight/thresholds.mjs";
import { maskAt, surfaceTerm, makeRadial } from "../ditherlight/lights.mjs";
import { CLS } from "../fixtures/chapel.mjs";
import { MOON_DIR } from "../fixtures/chapel-render.mjs";
import { LAMP, WINDOWS } from "../fixtures/chapel.mjs";
import { buildPalette, CLASS_BASES } from "./palette.mjs";
import { srgbToLinear, linearToSrgb } from "../common.mjs";

export const PL_DEFAULTS = { gain: 1.5, ambient: 0.08, moon: 0.45, cycleRate: 0.18, steps: 4, voidSteps: 6, lampPos: LAMP, moonDir: MOON_DIR };
export function resolvePalettelight(over = {}) {
  const p = { ...PL_DEFAULTS, ...over }, palette = buildPalette({ steps: p.steps, voidSteps: p.voidSteps });
  return { ...p, palette, lamp: makeRadial({ pos: p.lampPos, radius: 11, core: 1.6, intensity: 6, wrap: 0.25 }), glows: WINDOWS.map((w) => makeRadial({ pos: [w[0], w[1] - 0.2, w[2] + 0.9], radius: 6, core: 1.0, intensity: 1.3, wrap: 0.5 })) };
}

const CLS_NAME = ["ground", "stone", "wood", "foliage"];
// Cool and warm irradiance at a lit pixel. px: { P, N, vis: [moon, lamp, window] }.
export function irradiance(plan, px) {
  const md = plan.moonDir, nl = Math.max(0, px.N[0] * md[0] + px.N[1] * md[1] + px.N[2] * md[2]), cool = plan.ambient * (0.7 + 0.3 * (0.5 + 0.5 * px.N[1])) + plan.moon * nl * px.vis[0];
  let warm = 0;
  const m = maskAt(plan.lamp, px.P); if (m > 0) warm += px.vis[1] * m * surfaceTerm(plan.lamp, px.P, px.N);
  for (const g of plan.glows) { const q = maskAt(g, px.P); if (q > 0) warm += px.vis[2] * q * surfaceTerm(g, px.P, px.N); }
  return { cool, warm };
}

// The palette index of one pixel. px: { hit, cls, a, P, N, vis, phase, ix, iy }, time in seconds.
export function indexOf(plan, px, time) {
  const pal = plan.palette, K = plan.steps, T1 = thresholdAt("bayer8", px.ix, px.iy), T2 = thresholdAt("bayer8", px.ix + 11, px.iy + 7);
  if (!px.hit) return pal.ramp.night;
  if (px.cls === CLS.void) {
    const pos = (px.phase * plan.voidSteps + time * plan.cycleRate * plan.voidSteps) % plan.voidSteps, lo = Math.floor(pos), f = pos - lo;
    return pal.ramp.void[(f > T1 ? lo + 1 : lo) % plan.voidSteps];
  }
  if (px.cls === CLS.window) { const s = 1.4 + 0.6 * Math.sin(time * 5 + px.P[0] * 3) + 0.4 * (px.a - 0.5), tone = Math.min(2, Math.max(0, s)), lo = Math.min(1, Math.floor(tone)); return pal.ramp.window[tone - lo > T1 ? lo + 1 : lo]; }
  if (px.cls === CLS.lamp) return pal.ramp.lamp[0.5 + 0.2 * Math.sin(time * 7) > T1 ? 1 : 0];
  const { cool, warm } = irradiance(plan, px), E = cool + warm, tone = 1 - Math.exp(-plan.gain * E * px.a), s = Math.min(K - 1, Math.max(0, tone * (K - 1))), w = E > 1e-9 ? warm / E : 0;
  const lo = Math.min(K - 2, Math.floor(s)), step = s - lo > T1 ? lo + 1 : lo, variant = w >= 0.7 ? 1 : w <= 0.3 ? 0 : (w - 0.3) / 0.4 > T2 ? 1 : 0;
  return pal.ramp[CLS_NAME[px.cls]][variant][step];
}

// A whole G-buffer (chapel-render.mjs) to palette indices and RGBA8.
export function runPalettelight(plan, g, time = 0) {
  const n = g.w * g.h, idx = new Uint16Array(n), rgba = new Uint8ClampedArray(n * 4), px = { P: [0, 0, 0], N: [0, 0, 1], vis: [0, 0, 0] };
  for (let y = 0; y < g.h; y++) for (let x = 0; x < g.w; x++) {
    const i = y * g.w + x;
    px.hit = g.hit[i]; px.cls = g.cls[i]; px.a = g.a[i]; px.phase = g.phase[i]; px.ix = x; px.iy = y;
    for (let c = 0; c < 3; c++) { px.P[c] = g.P[i * 3 + c]; px.N[c] = g.N[i * 3 + c]; px.vis[c] = g.vis[i * 3 + c]; }
    const k = indexOf(plan, px, time); idx[i] = k; rgba.set(plan.palette.entries[k].rgb, i * 4); rgba[i * 4 + 3] = 255;
  }
  return { w: g.w, h: g.h, idx, rgba };
}

// ---- continuous references (used by the study, not by the shader) ----
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const COOL_RGB = [0.62, 0.72, 1.0], WARM_RGB = [1.0, 0.62, 0.3];
// The ramp coordinate and warm fraction of a lit pixel: { s, w, wEff } (wEff is the fraction the
// variant dither realises: 0 below 0.3, 1 above 0.7, linear between).
export function tonality(plan, px) {
  const { cool, warm } = irradiance(plan, px), E = cool + warm, tone = 1 - Math.exp(-plan.gain * E * px.a), w = E > 1e-9 ? warm / E : 0;
  return { s: Math.min(plan.steps - 1, Math.max(0, tone * (plan.steps - 1))), w, wEff: Math.min(1, Math.max(0, (w - 0.3) / 0.4)), cool, warm };
}
// The ideal continuous colour of a lit pixel in OKLab: the two variant ramps interpolated along s,
// then mixed by wEff. What the palette-locked pass reproduces on average.
export function idealLab(plan, px) {
  const { s, wEff } = tonality(plan, px), name = CLS_NAME[px.cls], lo = Math.min(plan.steps - 2, Math.floor(s)), f = s - lo, E = plan.palette.entries;
  const at = (v) => lerp3(E[plan.palette.ramp[name][v][lo]].lab, E[plan.palette.ramp[name][v][lo + 1]].lab, f);
  return lerp3(at(0), at(1), wEff);
}
// The naive continuous render of the same lighting (class colour times coloured light, tone mapped):
// sRGB 0..1. This is what a post-process palette dither would be given.
export function naiveRgb(plan, px, time) {
  const pal = plan.palette, ent = pal.entries;
  if (!px.hit) return ent[pal.ramp.night].rgb.map((v) => v / 255);
  if (px.cls === CLS.void) { const pos = (px.phase * plan.voidSteps + time * plan.cycleRate * plan.voidSteps) % plan.voidSteps, lo = Math.floor(pos), a = ent[pal.ramp.void[lo]].rgb, b = ent[pal.ramp.void[(lo + 1) % plan.voidSteps]].rgb; return lerp3(a, b, pos - lo).map((v) => v / 255); }
  if (px.cls === CLS.window) { const s = Math.min(2, Math.max(0, 1.4 + 0.6 * Math.sin(time * 5 + px.P[0] * 3) + 0.4 * (px.a - 0.5))), lo = Math.min(1, Math.floor(s)); return lerp3(ent[pal.ramp.window[lo]].rgb, ent[pal.ramp.window[lo + 1]].rgb, s - lo).map((v) => v / 255); }
  if (px.cls === CLS.lamp) return lerp3(ent[pal.ramp.lamp[0]].rgb, ent[pal.ramp.lamp[1]].rgb, 0.5 + 0.2 * Math.sin(time * 7)).map((v) => v / 255);
  const { cool, warm } = irradiance(plan, px), base = CLASS_BASES[CLS_NAME[px.cls]].map((v) => srgbToLinear(v)), out = [0, 0, 0];
  for (let c = 0; c < 3; c++) { const x = base[c] * px.a * (COOL_RGB[c] * cool + WARM_RGB[c] * warm); out[c] = linearToSrgb(1 - Math.exp(-plan.gain * x * 2.2)); }
  return out;
}
