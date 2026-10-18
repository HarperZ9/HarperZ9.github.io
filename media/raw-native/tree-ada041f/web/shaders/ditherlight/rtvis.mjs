// Ray-traced area-light visibility for dither-quantised lighting, one ray per pixel, with the
// light sample chosen by the pixel's Bayer rank (project-docs/RT-DITHER-VISIBILITY-PROTOCOL.md).
//
// Point r of a (0, 6, 3)-net in base 2: (r / 64, phi(r), psi(r)). phi reverses the six bits of r
// (the radical inverse); psi applies the Pascal matrix mod 2 to those reversed digits (Faure's
// construction in base 2). The first coordinate is the dither threshold the pixel already has,
// so over any 8 x 8 Bayer tile the 64 (threshold, sample) pairs fill every elementary box of
// volume 1/64 once: the samples are stratified on the light and independent of the threshold.
// Pure functions; the scene supplies the occlusion test.
import { bayer8Rank } from "./thresholds.mjs";

export const bitrev6 = (r) => { let o = 0; for (let b = 0; b < 6; b++) o |= ((r >> b) & 1) << (5 - b); return o; };
// Pascal matrix mod 2 on the radical-inverse digits: digit i of the result is the parity of
// sum_j C(j, i) d_j over j >= i, where d_j is digit j (weight 2^-(j+1)) of phi(r).
export function pascal6(r) {
  const d = Array.from({ length: 6 }, (_, j) => (r >> j) & 1); // d_j: digit j of phi(r) is bit j of r
  let o = 0;
  for (let i = 0; i < 6; i++) {
    let s = 0; for (let j = i; j < 6; j++) if (((binom(j, i)) & 1) && d[j]) s ^= 1;
    o |= s << (5 - i); // digit i has weight 2^-(i+1): bit (5 - i) of a 6-bit integer
  }
  return o;
}
function binom(n, k) { let c = 1; for (let i = 0; i < k; i++) c = (c * (n - i)) / (i + 1); return c; }
// The net point for rank r, each coordinate as a cell centre in (0, 1).
export const netPoint = (r) => [(r + 0.5) / 64, (bitrev6(r) + 0.5) / 64, (pascal6(r) + 0.5) / 64];

// Shirley and Chiu's concentric map from the unit square to the unit disc.
export function concentric(u, v) {
  const a = 2 * u - 1, b = 2 * v - 1;
  if (a === 0 && b === 0) return [0, 0];
  let r, phi;
  if (Math.abs(a) > Math.abs(b)) { r = a; phi = (Math.PI / 4) * (b / a); } else { r = b; phi = Math.PI / 2 - (Math.PI / 4) * (a / b); }
  return [r * Math.cos(phi), r * Math.sin(phi)];
}
// A point on the disc of a spherical light (centre C, radius R) facing the shading point P.
export function lightPoint(C, R, P, u, v) {
  const w = [C[0] - P[0], C[1] - P[1], C[2] - P[2]], l = Math.hypot(w[0], w[1], w[2]);
  const n = [w[0] / l, w[1] / l, w[2] / l], a = Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  let t = [n[1] * a[2] - n[2] * a[1], n[2] * a[0] - n[0] * a[2], n[0] * a[1] - n[1] * a[0]]; const tl = Math.hypot(...t); t = t.map((c) => c / tl);
  const b = [n[1] * t[2] - n[2] * t[1], n[2] * t[0] - n[0] * t[2], n[0] * t[1] - n[1] * t[0]], [x, y] = concentric(u, v);
  return [C[0] + R * (x * t[0] + y * b[0]), C[1] + R * (x * t[1] + y * b[1]), C[2] + R * (x * t[2] + y * b[2])];
}

const hashU = (x, y, f, k) => { let h = (x * 374761393 + y * 668265263 + f * 2147483647 + k * 1274126177) >>> 0; h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
// Light-sample (u, v) lists per method for pixel (x, y) at frame f. A method returns K samples.
export const METHODS = {
  net1: (x, y) => { const p = netPoint(bayer8Rank(x, y)); return [[p[1], p[2]]]; },
  rank1: (x, y) => { const r = bayer8Rank(x, y); return [[((r & 7) + 0.5) / 8, ((r >> 3) + 0.5) / 8]]; },
  white1: (x, y, f) => [[hashU(x, y, f, 1), hashU(x, y, f, 2)]],
  ref64: () => GRID(8),
  truth: () => GRID(64),
};
const grids = new Map();
function GRID(n) { if (!grids.has(n)) { const g = []; for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) g.push([(i + 0.5) / n, (j + 0.5) / n]); grids.set(n, g); } return grids.get(n); }

// Visibility of a light from P by a method: the fraction of its samples that reach the light.
// occluded(P, Q) -> true when the segment P..Q is blocked.
export function visibility(method, light, P, x, y, f, occluded) {
  const S = METHODS[method](x, y, f); let n = 0;
  for (const [u, v] of S) if (!occluded(P, lightPoint(light.pos, light.radius, P, u, v))) n++;
  return n / S.length;
}
