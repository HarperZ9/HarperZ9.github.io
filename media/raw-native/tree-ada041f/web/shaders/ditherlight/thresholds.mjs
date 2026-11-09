// Threshold sources and anchoring for dither-quantised lighting (ditherlight.mjs).
//
// A threshold matrix is a tile of M distinct ranks 0 .. M-1; the threshold of a cell is
// (rank + 0.5) / M, strictly inside (0, 1), so a tone of exactly 0 never lights a cell and a
// tone of exactly 1 always does. Two sources: Bayer 8 x 8 by bit interleaving (Bayer 1973, the
// recursive matrix, no table) and the engine's own void-and-cluster blue-noise mask, 64 x 64.
//
// Anchoring decides which integer cell a pixel reads:
//   screen        the pixel's own coordinates (the classic: a fixed pattern over the picture);
//   world-fixed   the surface's anchor position, projected along the dominant axis of the anchor
//                 normal, in cells of a fixed size in world units (the pattern is printed on
//                 the surface and shrinks with distance);
//   world-octave  the same, with the cell size doubled until one cell covers about `px` pixels
//                 at the pixel's depth, so the dots keep a near-constant size on screen. The
//                 octave is chosen per pixel from depth alone.
// The anchor position is in the object's own space, so a moving object carries its dots.
import { blueNoise64 } from "../dither/bluenoise.mjs";

export const ANCHORS = { screen: 0, "world-fixed": 1, "world-octave": 2 };
export const SOURCES = { bayer8: 0, blue64: 1 };

// Bayer rank of cell (x, y) in an 8 x 8 tile: the bits of x ^ y and y, interleaved, most
// significant first. Equals BAYER[8][y][x] of the vendored reference (tested).
export function bayer8Rank(x, y) {
  x &= 7; y &= 7;
  const v = x ^ y;
  return ((v & 1) << 5) | ((y & 1) << 4) | (((v >> 1) & 1) << 3) | (((y >> 1) & 1) << 2) | (((v >> 2) & 1) << 1) | ((y >> 2) & 1);
}
let blue = null;
export function blueRank(x, y) { blue ??= blueNoise64(); return blue[((y & 63) << 6) | (x & 63)]; }

export function thresholdAt(source, cx, cy) {
  if (source === "bayer8") return (bayer8Rank(cx, cy) + 0.5) / 64;
  if (source === "blue64") return (blueRank(cx, cy) + 0.5) / 4096;
  throw new Error(`ditherlight: unknown threshold source ${source}`);
}

// World size of one pixel at unit depth, for a vertical field of view in radians.
export const pixelAngle = (fov, height) => (2 * Math.tan(fov / 2)) / height;

// The octave of a pixel under world-octave anchoring: the smallest k >= 0 for which a cell of
// cell * 2^k world units covers at least `px` pixels at this depth.
export function octaveOf(cell, px, pa, depth) {
  const r = (px * pa * Math.max(depth, 1e-6)) / cell;
  return r <= 1 ? 0 : Math.ceil(Math.log2(r));
}

// The integer cell of a pixel. p: { ix, iy, apos: [x, y, z], anrm: [x, y, z], depth }.
export function anchorCell(plan, p) {
  if (plan.anchor === "screen") return [p.ix, p.iy];
  const n = p.anrm, ax = Math.abs(n[0]), ay = Math.abs(n[1]), az = Math.abs(n[2]);
  let u, v;
  if (ax >= ay && ax >= az) { u = p.apos[2]; v = p.apos[1]; } else if (ay >= az) { u = p.apos[0]; v = p.apos[2]; } else { u = p.apos[0]; v = p.apos[1]; }
  let size = plan.cell;
  if (plan.anchor === "world-octave") size *= Math.pow(2, octaveOf(plan.cell, plan.px, plan.pa, p.depth));
  return [Math.floor(u / size), Math.floor(v / size)];
}
