// The painted canvas under a moving 3D camera (CPU reference of canvas.wgsl.mjs).
//
// Paper, bristles and stroke identity are noise evaluated at canvas coordinates. With a 2D pan
// the coordinates are the pixel plus the pan offset. Under rotation, zoom and parallax each
// pixel instead carries the canvas coordinate its surface had last frame, fetched along the
// renderer's motion vector (advected texture coordinates, after Neyret, "Advected Textures",
// SCA 2003). Where reprojection fails a depth test (disocclusion) the coordinate starts fresh.
// Advected coordinates stretch as the view zooms or the surface turns away. Two layers carry
// them; a layer is regenerated when its mean distortion (departure of the coordinate field's
// local scale from 1, rotation free) passes a threshold, and its weight ramps in after a reset
// and falls as it distorts, so the brush texture keeps its size on screen without popping. A
// pure pan never distorts, so it never regenerates, and stays exactly anchored.
import { hash3 } from "../common.mjs";

export const CANVAS = { tau: 0.35, rampFrames: 8, minAge: 12, depthTol: 0.02, quant: 4096 };

export function createCanvasState(w, h) {
  return { w, h, C: new Float32Array(w * h * 4), prevDist: new Float32Array(w * h).fill(-1), frame: 0,
    layer: [{ age: -1, seed: [0, 0], meanD: 0, reset: false }, { age: -1, seed: [0, 0], meanD: 0, reset: false }], statSum: [0, 0], statN: [0, 0] };
}

// Decide (one thread on the GPU): last frame's distortion means; regenerate a distorted layer
// when the other one is established, and seed it with a fresh offset.
// Layers start dormant (age -1, weight 0). The first frame wakes layer 0 at full weight; a layer
// that distorts past tau wakes the other (dormant or old) one, which ramps in while it fades.
export function decide(st) {
  const L = st.layer;
  for (let k = 0; k < 2; k++) {
    L[k].meanD = st.statN[k] > 0 ? st.statSum[k] / CANVAS.quant / st.statN[k] : 0;
    if (L[k].age >= 0) L[k].age = Math.min(1e6, L[k].age + 1);
    L[k].reset = false;
  }
  const wake = (k) => { L[k].reset = true; L[k].age = 0; L[k].meanD = 0; L[k].seed = [hash3(st.frame, k, 101) * 997, hash3(st.frame, k, 103) * 997]; };
  if (st.frame === 0) { wake(0); L[0].age = CANVAS.rampFrames; }
  else for (let k = 0; k < 2; k++) {
    const o = 1 - k;
    if (L[k].age >= 0 && L[k].meanD > CANVAS.tau && (L[o].age < 0 || (L[o].age >= CANVAS.minAge && L[o].meanD > CANVAS.tau * 0.5))) { wake(o); break; }
  }
  st.statSum = [0, 0]; st.statN = [0, 0];
}
export function layerWeights(st) {
  return st.layer.map((l) => (l.age < 0 ? 0 : Math.min(1, (l.age + 1) / CANVAS.rampFrames) * Math.max(0.02, 1 - l.meanD / CANVAS.tau)));
}

function bilerp(C, w, h, x, y, ch) {
  const fx = Math.min(w - 1, Math.max(0, x)), fy = Math.min(h - 1, Math.max(0, y)), x0 = Math.floor(fx), y0 = Math.floor(fy), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1), tx = fx - x0, ty = fy - y0;
  const a = C[(y0 * w + x0) * 4 + ch], b = C[(y0 * w + x1) * 4 + ch], c = C[(y1 * w + x0) * 4 + ch], d = C[(y1 * w + x1) * 4 + ch];
  return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty;
}
// Advect: mv[p] is (this pixel - its position last frame); dist[p] is this frame's view distance
// of the pixel's point and distPrev[p] the same point's distance from last frame's camera.
export function advect(st, mv, dist, distPrev) {
  const { w, h } = st, C = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, px = x - mv[p * 2], py = y - mv[p * 2 + 1];
    const q = Math.min(h - 1, Math.max(0, Math.floor(py + 0.5))) * w + Math.min(w - 1, Math.max(0, Math.floor(px + 0.5)));
    const inside = px >= 0 && py >= 0 && px <= w - 1 && py <= h - 1, valid = inside && st.prevDist[q] > 0 && Math.abs(st.prevDist[q] - distPrev[p]) <= CANVAS.depthTol * distPrev[p];
    for (let k = 0; k < 2; k++) {
      const L = st.layer[k], fresh = L.reset || !valid;
      C[p * 4 + 2 * k] = fresh ? x + L.seed[0] : bilerp(st.C, w, h, px, py, 2 * k);
      C[p * 4 + 2 * k + 1] = fresh ? y + L.seed[1] : bilerp(st.C, w, h, px, py, 2 * k + 1);
    }
  }
  st.C = C; st.prevDist = dist.slice(); st.frame++;
  distortion(st);
}
// Mean distortion per layer, summed as integers (quantised), so CPU and GPU sums agree exactly.
export function distortion(st) {
  const { w, h, C } = st;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const p = y * w + x;
    for (let k = 0; k < 2; k++) {
      const o = 2 * k, a = (C[(p + 1) * 4 + o] - C[(p - 1) * 4 + o]) / 2, b = (C[(p + w) * 4 + o] - C[(p - w) * 4 + o]) / 2;
      const c = (C[(p + 1) * 4 + o + 1] - C[(p - 1) * 4 + o + 1]) / 2, d = (C[(p + w) * 4 + o + 1] - C[(p - w) * 4 + o + 1]) / 2;
      // Seams where a fresh coordinate meets an advected one are not stretch: leave them out.
      const D = scaleDeparture(a, b, c, d);
      if (D <= 1) { st.statSum[k] += Math.floor(D * CANVAS.quant); st.statN[k]++; }
    }
  }
}
// |log s1| + |log s2| for the singular values of [[a, b], [c, d]].
export function scaleDeparture(a, b, c, d) {
  const E = a * a + b * b + c * c + d * d, det = Math.abs(a * d - b * c), disc = Math.sqrt(Math.max(0, E * E - 4 * det * det));
  const s1 = Math.sqrt(Math.max(1e-12, (E + disc) / 2)), s2 = Math.sqrt(Math.max(1e-12, (E - disc) / 2));
  return Math.abs(Math.log(s1)) + Math.abs(Math.log(s2));
}
// A noise sampled on both layers and blended so its variance stays put (mean m).
export function blendNoise(f, st, wts, x, y, m = 0.5) {
  const fx = Math.min(st.w - 1, Math.max(0, x)), fy = Math.min(st.h - 1, Math.max(0, y)), c = [0, 1, 2, 3].map((ch) => bilerp(st.C, st.w, st.h, fx, fy, ch));
  if (wts[1] === 0) return f(c[0], c[1]);
  if (wts[0] === 0) return f(c[2], c[3]);
  const n1 = f(c[0], c[1]) - m, n2 = f(c[2], c[3]) - m;
  return m + (wts[0] * n1 + wts[1] * n2) / Math.sqrt(wts[0] * wts[0] + wts[1] * wts[1]);
}
