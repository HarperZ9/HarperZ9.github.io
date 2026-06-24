// pyramid.mjs — multi-resolution spatial truth (coarse→fine box-averaged RGB grids).
import { boxAverage } from "./features.mjs";
export function pyramid(px, w, h, ch = 4, scales = [4, 8, 16, 32, 64]) {
  const out = {};
  for (const n of scales) out["grid" + n] = boxAverage(px, w, h, ch, n).grid;
  return out;
}
export function multiScaleGrids(px, w, h, ch = 4, scales = [8, 16, 32]) {
  return pyramid(px, w, h, ch, scales); // kept name for web parity
}
