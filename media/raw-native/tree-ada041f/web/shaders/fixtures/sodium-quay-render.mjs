// G-buffer of Sodium Quay (sodium-quay.mjs) for the spectral shading pass (sodium/shade.mjs).
// Per pixel, GB floats (packed for the GPU as-is):
//   0..2 P, 3 material, 4..6 N, 7 scale, 8 emit type (-1 none), 9 emit intensity, 10 hit distance,
//   11 hit (0 sky, 1 surface), 12..14 view direction, 15 reflection weight,
//   16..18 reflection P, 19 material, 20..22 N, 23 scale, 24 emit type, 25 emit intensity, 26 hit,
//   27 pad, 28..37 visibility of each light (MAX_LIGHTS), 38..39 pad.
import { quayCamera, sodiumLights, traceSurface, visOf, reflectionOf, MAX_LIGHTS, EMIT } from "./sodium-quay.mjs";
import { van, skyAt } from "./quay-street.mjs";

export const GB = 40;
const FOV = (50 * Math.PI) / 180;
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

function putLayer(o, b, h, d) {
  if (!h.hit) { const s = skyAt(d); o.set([0, 0, 0, 0, 0, 1, 0, 0, EMIT.sky, lum(s) * 1.4, 200, 0], b); return; }
  o.set([...h.P, h.s.mat, ...h.N, h.s.scale, h.s.emitType, h.s.emitI, h.t, 1], b);
}
// The G-buffer for time t at w x h: { w, h, data: Float64Array(w * h * GB), lights, cam }.
export function renderSodiumGbuffer(t, w, h, { cam = quayCamera(t), headlights = true, shadows = true, rows = null } = {}) {
  const f = cam.look.map((v, k) => v - cam.pos[k]), fw = nrm(f), r = nrm(cross(fw, [0, 1, 0])), u = cross(r, fw), th = Math.tan(FOV / 2), asp = w / h;
  const lights = sodiumLights(t, { headlights }), vs = van(t), data = new Float64Array(w * h * GB), [y0, y1] = rows || [0, h];
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const a = ((2 * (x + 0.5)) / w - 1) * th * asp, b = (1 - (2 * (y + 0.5)) / h) * th, d = nrm([fw[0] + r[0] * a + u[0] * b, fw[1] + r[1] * a + u[1] * b, fw[2] + r[2] * a + u[2] * b]);
    const i = (y * w + x) * GB, hit = traceSurface(cam.pos, d, t, vs);
    putLayer(data, i, hit, d); data.set(d, i + 12);
    const ref = reflectionOf(hit, d, t);
    if (ref) { data[i + 15] = ref.w; const h2 = traceSurface([hit.P[0], hit.P[1] + 0.01, hit.P[2]], ref.r, t, vs); putLayer(data, i + 16, h2, ref.r); }
    if (hit.hit) { const v = shadows ? visOf(hit.P, hit.N, lights, vs) : lights.map(() => 1); for (let k = 0; k < Math.min(MAX_LIGHTS, v.length); k++) data[i + 28 + k] = v[k]; }
  }
  return { w, h, data, lights, cam };
}
