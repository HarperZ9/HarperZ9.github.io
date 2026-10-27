// lib/wood.mjs: our own wood-grain procedural, for veneer and frames. Pure.
//
// Grain is read in the board's own frame: `a` along the fibres, `b` across them. Growth rings are bands in b, bent by
// a slow fractal warp (the board's figure); latewood is the dark end of each band; pores are short streaks stretched
// along a; figure (fiddleback, curl) is a sine across a whose phase wanders, which also carries the sheen, so the
// same tile brightens or dims with the light angle against its grain (chatoyance).
import { fbm, valueNoise } from '../../../techniques/lib/util.js';
import { hexLin } from './raster.mjs';

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/** Species: colours (sRGB hex), ring spacing (px at 1x), warp (rings), pore depth, figure depth and period (px). */
export const SPECIES = Object.freeze({
  maple: { early: '#d9c6aa', late: '#c0a483', ring: 7, warp: 1.6, pore: 0.05, figure: 0.16, figurePx: 22 },
  fumed: { early: '#6f6157', late: '#4c4038', ring: 9, warp: 2.4, pore: 0.12, figure: 0.08, figurePx: 34 },
  walnut: { early: '#5e412d', late: '#3b291d', ring: 11, warp: 3.2, pore: 0.16, figure: 0.05, figurePx: 40 },
  holly: { early: '#efe4cf', late: '#e3d4b8', ring: 4, warp: 0.8, pore: 0.02, figure: 0.04, figurePx: 18 },
  ebony: { early: '#2a2320', late: '#1b1613', ring: 5, warp: 1, pore: 0.05, figure: 0.02, figurePx: 20 },
});
const LIN = new Map();
const lin = (sp) => { if (!LIN.has(sp)) LIN.set(sp, { e: hexLin(SPECIES[sp].early), l: hexLin(SPECIES[sp].late) }); return LIN.get(sp); };

/**
 * Colour of a veneer at (x, y): species, grain angle (radians), seed, scale (px multiplier), sheen 0..1 and the
 * light angle (radians) for chatoyance. Returns linear RGB.
 */
export function wood(x, y, { species = 'maple', angle = 0, seed = 1, scale = 1, sheen = 0.3, light = 0 } = {}) {
  const S = SPECIES[species], C = lin(species), ca = Math.cos(angle), sa = Math.sin(angle);
  const a = (x * ca + y * sa) / scale, b = (-x * sa + y * ca) / scale;
  const warp = (fbm(a * 0.0035, b * 0.012, seed, 4) - 0.5) * 2 * S.warp + (fbm(a * 0.02, b * 0.05, seed + 9, 3) - 0.5) * 0.4;
  const ring = ((b / S.ring + warp) % 1 + 1) % 1, late = smooth(0.55, 0.88, ring) * (1 - smooth(0.93, 1, ring));
  const pore = valueNoise(a * 0.07, b * 1.4, seed + 3) > 0.8 ? S.pore : 0;
  const fig = Math.sin((2 * Math.PI * a) / S.figurePx + fbm(a * 0.01, b * 0.03, seed + 5, 3) * 6) * S.figure;
  const shine = 1 + sheen * Math.cos(2 * (angle - light)) * 0.5 + fig * (0.6 + 0.4 * Math.cos(2 * (angle - light)));
  const k = (1 - pore) * shine;
  return [(C.e[0] + (C.l[0] - C.e[0]) * late) * k, (C.e[1] + (C.l[1] - C.e[1]) * late) * k, (C.e[2] + (C.l[2] - C.e[2]) * late) * k];
}
