// Perspective-stable pixel art, part 2: splatting the probe's texels as world-space quads into
// the view (CPU reference of pixel.wgsl.mjs). Visibility in two passes, as a GPU does it with
// atomics: the nearest depth per pixel, then the lowest texel index at that depth. Pixels no
// texel reaches (disocclusions) are filled by an eye ray, styled the same way. During a cell
// change a 4 x 4 Bayer threshold picks, per pixel, the new probe or the previous one.
import { faceDir, stylise } from "./probe.mjs";
import { march, sceneNormal, shadePoint, sky } from "./scene.mjs";

export function camera(eye, target, fovy, w, h) {
  const f = [0, 1, 2].map((c) => target[c] - eye[c]), fl = Math.hypot(...f); f.forEach((v, i) => (f[i] = v / fl));
  let r = [f[2], 0, -f[0]]; const rl = Math.hypot(...r); r = r.map((v) => -v / rl);
  const u = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
  return { eye, f, r, u, ty: Math.tan(fovy / 2), w, h };
}
// World point to [sx, sy, z] in pixels and view depth.
export function project(cam, p) {
  const v = [p[0] - cam.eye[0], p[1] - cam.eye[1], p[2] - cam.eye[2]], z = v[0] * cam.f[0] + v[1] * cam.f[1] + v[2] * cam.f[2];
  const x = (v[0] * cam.r[0] + v[1] * cam.r[1] + v[2] * cam.r[2]) / (z * cam.ty * (cam.w / cam.h)), y = (v[0] * cam.u[0] + v[1] * cam.u[1] + v[2] * cam.u[2]) / (z * cam.ty);
  return [((x + 1) / 2) * cam.w, ((1 - y) / 2) * cam.h, z];
}
export function rayDir(cam, px, py) {
  const x = ((2 * (px + 0.5)) / cam.w - 1) * cam.ty * (cam.w / cam.h), y = (1 - (2 * (py + 0.5)) / cam.h) * cam.ty;
  const d = [0, 1, 2].map((c) => cam.f[c] + x * cam.r[c] + y * cam.u[c]), l = Math.hypot(...d);
  return d.map((v) => v / l);
}
const edge = (a, b, x, y) => (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
function inTri(a, b, c, x, y) { const e0 = edge(a, b, x, y), e1 = edge(b, c, x, y), e2 = edge(c, a, x, y); return (e0 >= 0 && e1 >= 0 && e2 >= 0) || (e0 <= 0 && e1 <= 0 && e2 <= 0); }

// The screen quad of texel k: four projected corners and the centre's view depth, or null.
export function texelQuad(pr, cam, k, expand) {
  const N = pr.N, f = Math.floor(k / (N * N)), j = Math.floor((k % (N * N)) / N), i = k % N, d = pr.depth[k];
  if (d < 0) return null;
  const u = (2 * (i + 0.5)) / N - 1, v = (2 * (j + 0.5)) / N - 1, h = expand / N, out = [];
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1], [0, 0]]) {
    const r = faceDir(f, u + su * h, v + sv * h), m = Math.max(Math.abs(r[0]), Math.abs(r[1]), Math.abs(r[2]));
    const s = project(cam, [0, 1, 2].map((c) => pr.origin[c] + (d / m) * r[c]));
    if (s[2] < 0.05) return null;
    out.push(s);
  }
  return out;
}
// Visibility: for every pixel, the index of the nearest texel covering it (0xffffffff if none).
export function splat(pr, cam, expand = 1.15) {
  const { w, h } = cam, n = 6 * pr.N * pr.N, zbuf = new Float32Array(w * h).fill(Infinity), idb = new Uint32Array(w * h).fill(0xffffffff);
  for (const pass of [0, 1]) for (let k = 0; k < n; k++) {
    const q = texelQuad(pr, cam, k, expand); if (!q) continue;
    const x0 = Math.max(0, Math.floor(Math.min(q[0][0], q[1][0], q[2][0], q[3][0]))), x1 = Math.min(w - 1, Math.ceil(Math.max(q[0][0], q[1][0], q[2][0], q[3][0])));
    const y0 = Math.max(0, Math.floor(Math.min(q[0][1], q[1][1], q[2][1], q[3][1]))), y1 = Math.min(h - 1, Math.ceil(Math.max(q[0][1], q[1][1], q[2][1], q[3][1])));
    if (x1 - x0 > 63 || y1 - y0 > 63) continue;
    // Depth key: view depth quantised to 1/4096 world unit, so overlapping quads of one surface
    // tie, and the lowest texel index wins on the CPU and the GPU alike.
    const z = Math.floor(q[4][2] * 4096);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      if (!inTri(q[0], q[1], q[2], x + 0.5, y + 0.5) && !inTri(q[0], q[2], q[3], x + 0.5, y + 0.5)) continue;
      const p = y * w + x;
      if (pass === 0) { if (z < zbuf[p]) zbuf[p] = z; } else if (z === zbuf[p] && k < idb[p]) idb[p] = k;
    }
  }
  return { zbuf, idb };
}
export const bayer4 = (x, y) => [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5][(y & 3) * 4 + (x & 3)];
// Final colour (linear): the texel's styled colour, or an eye-ray fill. prev/blend: crossfade.
export function resolve(cam, cur, prev = null, blend = 1, bands = 6) {
  const { w, h } = cam, img = new Float32Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, usePrev = prev && (bayer4(x, y) + 0.5) / 16 >= blend, s = usePrev ? prev : cur, id = s.vis.idb[p];
    let c;
    if (id !== 0xffffffff) c = [s.col[id * 3], s.col[id * 3 + 1], s.col[id * 3 + 2]];
    else {
      const d = rayDir(cam, x, y), hit = march(cam.eye[0], cam.eye[1], cam.eye[2], d[0], d[1], d[2]);
      if (!hit) c = stylise(sky(d[0], d[1], d[2]), bands, 0);
      else { const q = [0, 1, 2].map((k) => cam.eye[k] + d[k] * hit[0]); c = stylise(shadePoint(q[0], q[1], q[2], sceneNormal(q[0], q[1], q[2]), hit[1]), bands, 0); }
    }
    img.set([c[0], c[1], c[2], 1], p * 4);
  }
  return img;
}
