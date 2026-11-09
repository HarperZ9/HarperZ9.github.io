// Raymarched G-buffer and the lit "export" image of the Lamp Quay block-out (harbour.mjs), for any
// camera of paintover/camera.mjs. The export is what a painter paints over: flat block-out colour,
// a key light with soft shadow, a sky fill and a little occlusion.
import { map, hitId, albedoOf, isEmissive, setExact } from "./harbour.mjs";
import { ray } from "../paintover/camera.mjs";

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
export const SUN = norm([-0.45, 0.8, 0.55]);
function normalAt(x, y, z) {
  const e = 0.0025, k0 = map(x + e, y - e, z - e), k1 = map(x - e, y - e, z + e), k2 = map(x - e, y + e, z - e), k3 = map(x + e, y + e, z + e);
  return norm([k0 - k1 - k2 + k3, -k0 - k1 + k2 + k3, -k0 + k1 - k2 + k3]);
}
function softShadow(P, N, L) {
  const o = [P[0] + N[0] * 0.03, P[1] + N[1] * 0.03, P[2] + N[2] * 0.03];
  let res = 1, t = 0.04;
  for (let i = 0; i < 48 && t < 30; i++) { const h = map(o[0] + L[0] * t, o[1] + L[1] * t, o[2] + L[2] * t); if (h < 0.002) return 0; res = Math.min(res, (9 * h) / t); t += Math.max(h, 0.04); }
  return sat(res);
}
function occlusion(P, N) { let o = 0; for (let i = 1; i <= 5; i++) { const h = 0.08 * i; o += (h - map(P[0] + N[0] * h, P[1] + N[1] * h, P[2] + N[2] * h)) / (i * i); } return sat(1 - 1.6 * o); }
const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);

// Returns { w, h, hit, id, depth, P, N, albedo, shade } (shade: lit export, RGB f32, 0..1).
export function renderGbuf(cam, w, h, { rows = null, shadeOn = true } = {}) {
  const n = w * h, g = { w, h, hit: new Uint8Array(n), id: new Uint8Array(n).fill(255), depth: new Float32Array(n).fill(1e9), P: new Float32Array(n * 3), N: new Float32Array(n * 3), albedo: new Float32Array(n * 3), shade: new Float32Array(n * 3) };
  const [y0, y1] = rows || [0, h], T0 = cam.ortho ? 0 : 0.1, TM = 160;
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, { o, d } = ray(cam, w, h, x, y);
    let t = T0, hit = false;
    // an orthographic ray starts far back along the view axis, before the scene
    if (cam.ortho) t = 0;
    for (let s = 0; s < 220 && t < TM; s++) { const q = map(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t); if (q < 0.0008 + 0.0002 * t) { hit = true; break; } t += q; }
    if (!hit) { g.shade[i * 3] = 0.78; g.shade[i * 3 + 1] = 0.82; g.shade[i * 3 + 2] = 0.84; continue; }
    const P = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    map(P[0], P[1], P[2]); const id = hitId; setExact(true); const N = normalAt(P[0], P[1], P[2]), a = albedoOf(id, P[0], P[1], P[2]);
    g.hit[i] = 1; g.id[i] = id; g.depth[i] = (P[0] - cam.pos[0]) * cam.fwd[0] + (P[1] - cam.pos[1]) * cam.fwd[1] + (P[2] - cam.pos[2]) * cam.fwd[2];
    for (let c = 0; c < 3; c++) { g.P[i * 3 + c] = P[c]; g.N[i * 3 + c] = N[c]; g.albedo[i * 3 + c] = a[c]; }
    if (!shadeOn) { setExact(false); continue; }
    if (isEmissive(id)) { for (let c = 0; c < 3; c++) g.shade[i * 3 + c] = Math.min(1, a[c] * 1.1); setExact(false); continue; }
    const ndl = Math.max(0, N[0] * SUN[0] + N[1] * SUN[1] + N[2] * SUN[2]), vis = ndl > 0 ? softShadow(P, N, SUN) : 0, ao = occlusion(P, N), sky = 0.5 + 0.5 * N[1];
    const key = ndl * vis * 1.05, fill = (0.28 + 0.2 * sky) * ao;
    setExact(false);
    for (let c = 0; c < 3; c++) g.shade[i * 3 + c] = Math.min(1, a[c] * (key * [1.0, 0.95, 0.85][c] + fill * [0.75, 0.85, 1.0][c]));
  }
  return g;
}
