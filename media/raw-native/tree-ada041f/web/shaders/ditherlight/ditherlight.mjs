// Dither-quantised lighting: light and shadow resolved through a threshold matrix into N tones,
// with 1 bit (N = 2) as the limit case. CPU reference, float64.
//
// Passes, in the order a GlagStone-style night is built:
//   world      the albedo tone of the surface, from the geometry pass;
//   darkness   a level of ambient light, d, lifted a little toward the sky on upward normals;
//   lights     every radial light and shaped beam adds vis * mask * surface term (lights.mjs);
//   fog        the lit tone is mixed toward paper white with distance, 1 - exp(-(depth/fogDist)^2)
//              (the reverse of fog to black: far geometry dissolves into the ground colour);
//   pattern    the tone goes through the threshold matrix (thresholds.mjs) into one of N levels.
//
//   lit  = albedo * (d (1 - h + h (0.5 + 0.5 n.y)) + sum_i vis_i mask_i term_i)
//   tone = clamp(lit, 0, 1) (1 - tf) + tf,   tf = fogMax (1 - exp(-(depth / fogDist)^2))
//   with a per-pixel haze h in [0, 1] (light scattered along the view ray) the tone is 1 - (1 - tone)(1 - h)
// Sky pixels (kind 0) and emissive pixels (kind 1) are already tones and skip lights and fog.
//
// Quantiser. Levels are evenly spaced in a lightness-like space and sit at linear light
// l_k = (k / (N - 1))^gamma. A tone Y in [l_k, l_(k+1)] takes level k+1 when its fraction
// f = (Y - l_k) / (l_(k+1) - l_k) exceeds the pixel's threshold, else level k. The fraction is
// taken in linear light, so the mean of a threshold period's outputs equals Y to within
// 1 / (2 M) of one level step, and what a viewer integrates is what the lighting computed.
// The display colour of level k is ink + (paper - ink) l_k in linear light.
import { anchorCell, thresholdAt, pixelAngle } from "./thresholds.mjs";
import { maskAt, surfaceTerm } from "./lights.mjs";
import { linearToSrgb } from "../common.mjs";

export const DL_PRESETS = {
  ink: { levels: 2, ink: [0.012, 0.011, 0.01], paper: [0.92, 0.9, 0.84], source: "bayer8", anchor: "screen", cell: 0.1, px: 2, gamma: 2.2, dark: 0.16, hemi: 0.5, fogDist: 38, fogMax: 1 },
  tones4: { levels: 4, ink: [0.012, 0.011, 0.01], paper: [0.92, 0.9, 0.84], source: "bayer8", anchor: "screen", cell: 0.1, px: 2, gamma: 2.2, dark: 0.16, hemi: 0.5, fogDist: 38, fogMax: 1 },
};
export function resolveDitherlight(preset = "ink", overrides = {}, { height = 180, fov = (70 * Math.PI) / 180 } = {}) {
  const base = DL_PRESETS[preset];
  if (!base) throw new Error(`ditherlight: unknown preset ${preset}`);
  const p = { ...base, ...overrides, pa: pixelAngle(fov, height) };
  if (!(p.levels >= 2 && Number.isInteger(p.levels))) throw new Error("ditherlight: levels is an integer >= 2");
  return p;
}
export const levelLinear = (plan, k) => Math.pow(k / (plan.levels - 1), plan.gamma);

// The tone of one pixel before the pattern. px: a G-buffer pixel (see fixtures/dream.mjs).
export function toneOf(plan, lights, px) {
  let Y = px.albedo;
  if (px.kind === 2) {
    let E = plan.dark * (1 - plan.hemi + plan.hemi * (0.5 + 0.5 * px.nrm[1]));
    for (let i = 0; i < lights.length; i++) {
      const v = px.vis[i];
      if (!(v > 0)) continue;
      const m = maskAt(lights[i], px.wpos);
      if (m > 0) E += v * m * surfaceTerm(lights[i], px.wpos, px.nrm);
    }
    const lit = Math.min(1, Math.max(0, px.albedo * E)), r = px.depth / plan.fogDist, tf = plan.fogMax * (1 - Math.exp(-r * r));
    Y = lit * (1 - tf) + tf;
  }
  // in-scattered light along the view ray (light shafts, glow around lamps), screen-blended
  const hz = px.haze > 0 ? Math.min(1, px.haze) : 0;
  return hz > 0 ? 1 - (1 - Y) * (1 - hz) : Y;
}

// Tone to a level, given the threshold t in (0, 1).
export function quantise(plan, Y, t) {
  const N = plan.levels, y = Math.min(1, Math.max(0, Y));
  let k = Math.floor(Math.pow(y, 1 / plan.gamma) * (N - 1));
  if (k > N - 2) k = N - 2;
  const lo = levelLinear(plan, k), hi = levelLinear(plan, k + 1), f = (y - lo) / (hi - lo);
  return f > t ? k + 1 : k;
}

export function levelRgb8(plan, k) {
  const l = levelLinear(plan, k), o = [0, 0, 0];
  for (let c = 0; c < 3; c++) o[c] = Math.round(linearToSrgb(plan.ink[c] + (plan.paper[c] - plan.ink[c]) * l) * 255);
  return o;
}

// A whole G-buffer to levels, the continuous tone and RGBA8. g: { width, height, ... } as made by
// the dream fixture; lights: the frame's lights in the order of g.vis.
export function runDitherlight(plan, lights, g) {
  const { width: w, height: h } = g, n = w * h, level = new Uint8Array(n), tone = new Float32Array(n), rgba = new Uint8ClampedArray(n * 4);
  const table = Array.from({ length: plan.levels }, (_, k) => levelRgb8(plan, k)), px = { vis: [0, 0, 0, 0], wpos: [0, 0, 0], nrm: [0, 0, 1], apos: [0, 0, 0], anrm: [0, 0, 1] };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    px.kind = g.kind[i]; px.albedo = g.albedo[i]; px.depth = g.depth[i]; px.haze = g.haze ? g.haze[i] : 0; px.ix = x; px.iy = y;
    for (let c = 0; c < 3; c++) { px.wpos[c] = g.wpos[i * 3 + c]; px.nrm[c] = g.nrm[i * 3 + c]; px.apos[c] = g.apos[i * 3 + c]; px.anrm[c] = g.anrm[i * 3 + c]; }
    for (let c = 0; c < 4; c++) px.vis[c] = g.vis[i * 4 + c];
    const Y = toneOf(plan, lights, px), [cx, cy] = anchorCell(plan, px);
    const k = quantise(plan, Y, thresholdAt(plan.source, cx, cy));
    tone[i] = Y; level[i] = k;
    rgba.set(table[k], i * 4); rgba[i * 4 + 3] = 255;
  }
  return { width: w, height: h, level, tone, rgba };
}
