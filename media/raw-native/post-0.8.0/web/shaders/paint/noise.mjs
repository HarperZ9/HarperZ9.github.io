// Value noise, paper and bristles for the painterly shaders (CPU; the WGSL copies are in
// paint.wgsl.mjs). All coordinates are canvas pixels plus the canvas offset, so a camera pan
// can carry the paper and the brush texture with the world instead of sliding over it.
import { hash3 } from "../common.mjs";

const fade = (t) => t * t * (3 - 2 * t);
export function vnoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y), tx = fade(x - xi), ty = fade(y - yi);
  const h = (i, j) => hash3((xi + i) >>> 0, (yi + j) >>> 0, seed);
  const a = h(0, 0), b = h(1, 0), c = h(0, 1), d = h(1, 1);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}
// Cold-press paper: a fine tooth, a broader undulation, and two families of stretched fibres.
export function paperHeight(x, y) {
  const c1 = 0.9397, s1 = 0.342, c2 = -0.342, s2 = 0.9397;
  const f1 = vnoise((x * c1 + y * s1) / 0.9, (-x * s1 + y * c1) / 7, 31), f2 = vnoise((x * c2 + y * s2) / 0.9, (-x * s2 + y * c2) / 7, 37);
  return 0.45 * vnoise(x / 2.2, y / 2.2, 11) + 0.25 * vnoise(x / 9, y / 9, 13) + 0.15 * f1 + 0.15 * f2;
}
// Bristle noise: fine across the stroke, which the flow integration then stretches along it.
export const bristle = (x, y) => 0.7 * vnoise(x / 1.3, y / 1.3, 53) + 0.3 * vnoise(x / 5, y / 5, 59);
// Low-frequency warp for the expressive presets: two noise fields in [-1, 1].
export function warp(x, y) { return [warpX(x, y), warpY(x, y)]; }
export const warpX = (x, y) => 2 * vnoise(x / 23, y / 23, 71) - 1, warpY = (x, y) => 2 * vnoise(x / 23, y / 23, 73) - 1;
// Paper at half the tooth frequency: where pigment settles.
export const paperHalf = (x, y) => paperHeight(x / 2, y / 2);
// Oil canvas: a plain weave (threads over and under every 3.2 px) with a little slub noise.
export function canvasHeight(x, y) {
  return 0.5 + 0.25 * Math.sin((2 * Math.PI * x) / 3.2) * Math.cos((2 * Math.PI * y) / 3.2) + 0.25 * (vnoise(x / 1.5, y / 1.5, 61) - 0.5);
}
// Stroke identity: a coarse field that the flow integration turns into one value per stroke.
export const strokeId = (x, y) => vnoise(x / 6, y / 6, 67);
