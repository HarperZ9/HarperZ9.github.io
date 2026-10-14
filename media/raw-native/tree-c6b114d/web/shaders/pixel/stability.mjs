// Measuring "perspective-stable": reprojection mismatch between consecutive frames.
// For each pixel of frame B we know the world point it shows. Project that point into frame A;
// where A sees the same point (depth within 2%), the two colours should agree. The fraction
// that does not is the shimmer: content changing colour although the world did not change.
// The baseline is naive pixelisation: the same shading and styling at a low resolution,
// upscaled by nearest neighbour, whose pixel grid is locked to the screen.
import { march, sceneNormal, shadePoint, sky } from "./scene.mjs";
import { stylise, faceDir } from "./probe.mjs";
import { rayDir, project, camera } from "./splat.mjs";

// Naive pixelisation at 1/k resolution: { img (linear RGBA), pos (world xyz per pixel, NaN for sky) }.
export function pixelise(cam, k, { bands = 6, outline = 0.22 } = {}) {
  const lw = Math.ceil(cam.w / k), lh = Math.ceil(cam.h / k), lc = camera(cam.eye, cam.eye.map((e, i) => e + cam.f[i]), Math.atan(cam.ty) * 2, lw, lh);
  const hits = [];
  for (let y = 0; y < lh; y++) for (let x = 0; x < lw; x++) {
    const d = rayDir(lc, x, y), h = march(cam.eye[0], cam.eye[1], cam.eye[2], d[0], d[1], d[2]);
    hits.push(h ? { p: [0, 1, 2].map((c) => cam.eye[c] + d[c] * h[0]), t: h[0], m: h[1], o: h[2] } : { d });
  }
  const low = hits.map((h, i) => {
    if (!h.p) return stylise(sky(...h.d), bands, 0);
    const x = i % lw, y = (i / lw) | 0; let dL = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= lw || yy >= lh) continue;
      const q = hits[yy * lw + xx]; if (!q.p || (q.o !== h.o && q.t > h.t * 1.03)) dL = -outline;
    }
    return stylise(shadePoint(h.p[0], h.p[1], h.p[2], sceneNormal(...h.p), h.m), bands, dL);
  });
  const img = new Float32Array(cam.w * cam.h * 4), pos = new Float32Array(cam.w * cam.h * 3).fill(NaN);
  for (let y = 0; y < cam.h; y++) for (let x = 0; x < cam.w; x++) {
    const li = Math.min(lh - 1, (y / k) | 0) * lw + Math.min(lw - 1, (x / k) | 0), c = low[li];
    img.set([c[0], c[1], c[2], 1], (y * cam.w + x) * 4); if (hits[li].p) pos.set(hits[li].p, (y * cam.w + x) * 3);
  }
  return { img, pos };
}
// World point per pixel for a splatted frame: the texel's centre (NaN where an eye ray filled it).
export function splatPositions(pr, vis, w, h) {
  const N = pr.N, pos = new Float32Array(w * h * 3).fill(NaN);
  for (let p = 0; p < w * h; p++) {
    const k = vis.idb[p]; if (k === 0xffffffff) continue;
    const f = Math.floor(k / (N * N)), j = Math.floor((k % (N * N)) / N), i = k % N, r = faceDir(f, (2 * (i + 0.5)) / N - 1, (2 * (j + 0.5)) / N - 1);
    const m = Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2]));
    pos.set([0, 1, 2].map((c) => pr.origin[c] + (pr.depth[k] / m) * r[c]), p * 3);
  }
  return pos;
}
// Fraction of comparable pixels whose colour differs by more than `tol` (8-bit) in some channel.
export function mismatch(camA, imgA, posA, camB, imgB, posB, tol = 3) {
  let bad = 0, n = 0; const { w, h } = camB;
  const depthA = new Float32Array(w * h).fill(Infinity);
  for (let p = 0; p < w * h; p++) if (!Number.isNaN(posA[p * 3])) depthA[p] = project(camA, [posA[p * 3], posA[p * 3 + 1], posA[p * 3 + 2]])[2];
  for (let p = 0; p < w * h; p++) {
    if (Number.isNaN(posB[p * 3])) continue;
    const s = project(camA, [posB[p * 3], posB[p * 3 + 1], posB[p * 3 + 2]]), x = Math.floor(s[0]), y = Math.floor(s[1]);
    if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1 || Math.abs(depthA[y * w + x] - s[2]) > 0.02 * s[2]) continue;
    n++;
    for (let c = 0; c < 3; c++) if (Math.abs(imgA[(y * w + x) * 4 + c] - imgB[p * 4 + c]) * 255 > tol) { bad++; break; }
  }
  return { fraction: bad / Math.max(1, n), compared: n };
}
