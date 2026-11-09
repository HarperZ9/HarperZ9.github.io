// Spectral sodium shading, CPU reference (float64): the G-buffer of fixtures/sodium-quay-render.mjs
// to scene-linear Rec. 709 light. The colour of every surface under every light comes from the
// spectral response table (spectra.mjs); no RGB light colour is multiplied by an RGB albedo.
//   const plan = resolveSodium({ impurity, mist, rain, ambient });
//   const f = runSodium(plan, g, time);   // { width, height, data: Float64Array RGBA }
// Per pixel: the camera hit lit by every light (Lambert, inverse square, spot or cosine emitter,
// visibility from the G-buffer) plus sky fill, plus Fresnel-weighted light from the reflection hit
// (no shadows there), dimmed by mist extinction; then light scattered by mist toward the camera
// from each light (closed form), and rain streaks lit by the same scattered light.
import { responseTable, LIGHT_TYPES } from "./spectra.mjs";
import { pcg } from "../common.mjs";

export const SODIUM_DEFAULTS = { impurity: 0.02, mist: 0.008, extinct: 0.007, rain: 1, ambient: 0.03 };
const tables = new Map();
export function resolveSodium(o = {}) {
  const p = { ...SODIUM_DEFAULTS, ...o };
  const key = String(p.impurity); if (!tables.has(key)) tables.set(key, responseTable({ impurity: p.impurity, types: LIGHT_TYPES }));
  return { ...p, table: tables.get(key), sky: LIGHT_TYPES.indexOf("sky") };
}
const INV_PI = 0.3183098861837907;

// Light reaching a surface record at offset b of the pixel, vis at offset vb (or 1 when vb < 0).
function surface(plan, g, lights, b, vb) {
  const d = g.data, o = [0, 0, 0], mat = d[b + 3], scale = d[b + 7], et = d[b + 8], rgb = plan.table.rgb;
  if (et >= 0) { const wv = plan.table.white[et], I = d[b + 9]; for (let k = 0; k < 3; k++) o[k] += wv[k] * I; }
  if (scale <= 0) return o;
  const sky = rgb[plan.sky][mat]; for (let k = 0; k < 3; k++) o[k] += sky[k] * scale * plan.ambient;
  for (let j = 0; j < lights.length; j++) {
    const L = lights[j], vx = L.pos[0] - d[b], vy = L.pos[1] - d[b + 1], vz = L.pos[2] - d[b + 2], d2 = vx * vx + vy * vy + vz * vz, dl = Math.sqrt(d2);
    const lx = vx / dl, ly = vy / dl, lz = vz / dl, c = d[b + 4] * lx + d[b + 5] * ly + d[b + 6] * lz;
    if (c <= 0) continue;
    let k = c / d2;
    if (L.mode === 1) { const a = -(lx * L.cone[0] + ly * L.cone[1] + lz * L.cone[2]); k *= a > 0.8 ? Math.pow((a - 0.8) / 0.2, 1.5) * 4 : 0; }
    else if (L.mode === 2) k *= Math.max(0, -(lx * L.cone[0] + ly * L.cone[1] + lz * L.cone[2]));
    if (vb >= 0) k *= d[vb + j];
    if (k <= 0) continue;
    const r = rgb[L.type][mat], s = scale * L.I * k * INV_PI;
    for (let q = 0; q < 3; q++) o[q] += r[q] * s;
  }
  return o;
}
// Rain: slanted streaks falling down the screen, deterministic per pixel and time.
export function rainAt(x, y, h, time) {
  const col = (x + Math.floor(y * 0.2)) >>> 0, h1 = pcg((col * 9781 + 17) >>> 0) / 4294967296;
  if (h1 > 0.22) return 0;
  const speed = 0.9 + 0.6 * (pcg((col * 7919 + 3) >>> 0) / 4294967296), phase = pcg((col * 104729 + 5) >>> 0) / 4294967296, len = 0.08 * h;
  const u = (y + time * speed * h * 1.2) / len + phase, f = u - Math.floor(u);
  return f < 0.35 ? 1 - f / 0.35 : 0;
}
export function shadePixel(plan, g, x, y, time) {
  const d = g.data, b = (y * g.w + x) * 40, lights = g.lights, o = surface(plan, g, lights, b, b + 28);
  const w = d[b + 15];
  if (w > 0) { const r = surface(plan, g, lights, b + 16, -1); for (let k = 0; k < 3; k++) o[k] += w * r[k]; }
  const tHit = d[b + 10], ext = Math.exp(-plan.extinct * Math.min(tHit, 120)), end = Math.min(tHit, 80);
  const m = [0, 0, 0], cam = g.cam.pos, dir = [d[b + 12], d[b + 13], d[b + 14]];
  for (const L of lights) {
    const vx = L.pos[0] - cam[0], vy = L.pos[1] - cam[1], vz = L.pos[2] - cam[2], s0 = vx * dir[0] + vy * dir[1] + vz * dir[2];
    const hh = Math.max(0.12, Math.sqrt(Math.max(0, vx * vx + vy * vy + vz * vz - s0 * s0)));
    const k = ((plan.mist * L.I) / (4 * Math.PI * hh)) * (Math.atan((end - s0) / hh) + Math.atan(s0 / hh)), wv = plan.table.white[L.type];
    for (let q = 0; q < 3; q++) m[q] += wv[q] * k;
  }
  const rain = plan.rain > 0 ? plan.rain * 3 * rainAt(x, y, g.h, time) : 0;
  return [o[0] * ext + m[0] * (1 + rain), o[1] * ext + m[1] * (1 + rain), o[2] * ext + m[2] * (1 + rain)];
}
export function runSodium(plan, g, time, rows = null) {
  const out = new Float64Array(g.w * g.h * 4), [y0, y1] = rows || [0, g.h];
  for (let y = y0; y < y1; y++) for (let x = 0; x < g.w; x++) { const c = shadePixel(plan, g, x, y, time), i = (y * g.w + x) * 4; out[i] = c[0]; out[i + 1] = c[1]; out[i + 2] = c[2]; out[i + 3] = 1; }
  return { width: g.w, height: g.h, data: out };
}
