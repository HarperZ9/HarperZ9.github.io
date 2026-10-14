// Perspective-stable pixel art, part 1: the probe (CPU reference of pixel.wgsl.mjs).
//
// After Ebert, "Texel Splatting: Perspective-Stable 3D Pixel Art" (arXiv 2603.14587, CC BY 4.0),
// reimplemented from the paper. The scene is captured into a cubemap from a probe whose origin is
// the camera position snapped to a world grid, so the texels, and therefore the pixels of the
// art, belong to the world and stay put while the camera turns and moves inside a cell. Each
// texel keeps its hit's Chebyshev distance from the origin, normal, material and object, and is
// shaded once, independently of the camera: posterised OKLab lightness, and selective outlines
// (a darker shade of the object's own colour) where a texel borders a farther object or a crease.
import { sceneNormal, march, shadePoint, sky } from "./scene.mjs";
import { linearSrgbToOklab, oklabToLinearSrgb } from "../reference/contracts.mjs";

// Unnormalised direction of face f at face coordinates (u, v) in [-1, 1].
export function faceDir(f, u, v) {
  switch (f) {
    case 0: return [1, -v, -u]; case 1: return [-1, -v, u]; case 2: return [u, 1, v];
    case 3: return [u, -1, -v]; case 4: return [u, -v, 1]; default: return [-u, -v, -1];
  }
}
export const snapOrigin = (eye, cell) => eye.map((c) => (Math.floor(c / cell) + 0.5) * cell);

// depth: Chebyshev distance of the hit (-1 for sky); mat, obj; normal xyz.
export function captureProbe(origin, N) {
  const n = 6 * N * N, depth = new Float32Array(n), mat = new Int32Array(n), obj = new Int32Array(n), nrm = new Float32Array(n * 3);
  for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = (f * N + j) * N + i, r = faceDir(f, (2 * (i + 0.5)) / N - 1, (2 * (j + 0.5)) / N - 1), l = Math.hypot(...r);
    const hit = march(origin[0], origin[1], origin[2], r[0] / l, r[1] / l, r[2] / l);
    if (!hit) { depth[k] = -1; mat[k] = -1; obj[k] = -1; continue; }
    const p = [0, 1, 2].map((c) => origin[c] + (r[c] / l) * hit[0]);
    depth[k] = Math.max(Math.abs(p[0] - origin[0]), Math.abs(p[1] - origin[1]), Math.abs(p[2] - origin[2]));
    mat[k] = hit[1]; obj[k] = hit[2]; nrm.set(sceneNormal(p[0], p[1], p[2]), k * 3);
  }
  return { origin, N, depth, mat, obj, nrm };
}
export const texelPos = (pr, f, u, v, d) => { const r = faceDir(f, u, v), m = Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2])); return [0, 1, 2].map((c) => pr.origin[c] + (d / m) * r[c]); };

// Posterise OKLab lightness into `bands` steps (and shift it by dL first).
export function stylise(rgb, bands, dL) {
  const [L, a, b] = linearSrgbToOklab(Math.max(rgb[0], 0), Math.max(rgb[1], 0), Math.max(rgb[2], 0));
  const Lq = Math.min(1, Math.max(0, Math.floor((L + dL) * bands + 0.5) / bands));
  return oklabToLinearSrgb(Lq, a, b).map((v) => Math.max(0, v));
}

// Camera-independent colour of every texel, styled.
export function shadeProbe(pr, { bands = 6, outline = 0.22, crease = 0.08 } = {}) {
  const { N } = pr, col = new Float32Array(6 * N * N * 3);
  for (let f = 0; f < 6; f++) for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const k = (f * N + j) * N + i, u = (2 * (i + 0.5)) / N - 1, v = (2 * (j + 0.5)) / N - 1;
    if (pr.depth[k] < 0) { const r = faceDir(f, u, v), l = Math.hypot(...r); col.set(stylise(sky(r[0] / l, r[1] / l, r[2] / l), bands, 0), k * 3); continue; }
    const p = texelPos(pr, f, u, v, pr.depth[k]), n = [pr.nrm[k * 3], pr.nrm[k * 3 + 1], pr.nrm[k * 3 + 2]];
    let dL = 0;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + di, jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= N || jj >= N) continue;
      const q = (f * N + jj) * N + ii;
      if (pr.obj[q] !== pr.obj[k] && (pr.depth[q] < 0 || pr.depth[q] > pr.depth[k] * 1.03)) dL = -outline;
      else if (dL === 0 && pr.obj[q] === pr.obj[k] && (di > 0 || dj > 0) && n[0] * pr.nrm[q * 3] + n[1] * pr.nrm[q * 3 + 1] + n[2] * pr.nrm[q * 3 + 2] < 0.6) dL = -crease;
    }
    col.set(stylise(shadePoint(p[0], p[1], p[2], n, pr.mat[k]), bands, dL), k * 3);
  }
  return col;
}
