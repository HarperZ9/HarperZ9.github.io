// The mix dither: each pixel's plan of 16 palette colours whose mean, in linear light, matches
// the pixel, ordered by lightness; an ordered threshold picks one entry. Pair dithering
// (reference/retro-dither.mjs) mixes only the two colours that bracket a pixel and sets the
// fraction in OKLab, so a colour between three or more palette entries goes grey or changes
// hue, and darks rise. The plan idea follows pattern dithering; this code is written here.
// Bounds: evidence/shaders-dither-mix-bounds.json.
import { nearestIndex, SRGB8_TO_LINEAR, linearToOklab } from "../reference/retro-palettes.mjs";

export const PLAN = 16;
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Palette entries in linear light, and each entry's rank by OKLab L (ties by index).
export function mixPalette(pal) {
  const lin = pal.map((e) => e.rgb.map((v) => SRGB8_TO_LINEAR[v]));
  return { pal, lin };
}
const before = (pal, a, b) => pal[a].lab[0] < pal[b].lab[0] || (pal[a].lab[0] === pal[b].lab[0] && a < b);

// The plan for one pixel in linear light: 16 palette indices sorted by lightness. Each step adds
// the entry that brings the plan's mean (in linear light, which is what the eye averages)
// closest to the colour in OKLab. OKLab is homogeneous of degree 1/3, so comparing the sum
// with (i + 1) times the colour picks the same entry as comparing the means, without a division.
export function mixPlan(r, g, b, mp) {
  const { pal, lin } = mp, plan = new Array(PLAN);
  let sr = 0, sg = 0, sb = 0;
  for (let i = 0; i < PLAN; i++) {
    const n = i + 1, [TL, TA, TB] = linearToOklab(n * r, n * g, n * b);
    let k = 0, bd = Infinity;
    for (let j = 0; j < lin.length; j++) {
      const [L, A, B] = linearToOklab(sr + lin[j][0], sg + lin[j][1], sb + lin[j][2]), d = (L - TL) ** 2 + (A - TA) ** 2 + (B - TB) ** 2;
      if (d < bd) { bd = d; k = j; }
    }
    let q = i; while (q > 0 && before(pal, k, plan[q - 1])) { plan[q] = plan[q - 1]; q--; } plan[q] = k;
    sr += lin[k][0]; sg += lin[k][1]; sb += lin[k][2];
  }
  return plan;
}

// One pixel: t is the ordered threshold in [0, 1); strength folds it toward 0.5; 0 is nearest.
export function mixPick(r, g, b, mp, t, strength) {
  if (strength <= 0 || mp.pal.length < 2) { const [L, A, B] = linearToOklab(r, g, b); return nearestIndex(L, A, B, mp.pal); }
  const th = 0.5 + (t - 0.5) * strength;
  return mixPlan(r, g, b, mp)[Math.min(PLAN - 1, Math.floor(th * PLAN))];
}
