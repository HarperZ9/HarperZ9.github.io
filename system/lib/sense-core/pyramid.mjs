// pyramid.mjs -- multi-resolution spatial truth (coarse to fine box-averaged RGB grids).
import { boxAverage } from "./features.mjs";
export function pyramid(px, w, h, ch = 4, scales = [4, 8, 16, 32, 64, 128]) {
  const out = {};
  for (const n of scales) out["grid" + n] = boxAverage(px, w, h, ch, n).grid;
  return out;
}
// multiScaleGrids: the full high-fidelity set (8, 16, 32, 64, 128).
// The 8/16/32 keys are preserved for backward compatibility; 64 and 128 are additive.
export function multiScaleGrids(px, w, h, ch = 4, scales = [8, 16, 32, 64, 128]) {
  return pyramid(px, w, h, ch, scales); // kept name for web parity
}
