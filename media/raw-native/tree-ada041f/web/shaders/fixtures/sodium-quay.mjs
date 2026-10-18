// "Sodium Quay": Quay Street (quay-street.mjs) relit for the spectral sodium pass. Every street lamp
// is low-pressure sodium; one shop on the right spills warm incandescent light onto the pavement;
// the van's headlights are white LEDs. Surfaces carry a material id (web/shaders/sodium/spectra.mjs)
// and a scalar brightness, not a colour, so the colour comes from the spectra. A strip of painted
// tiles in the eight palette colours runs along the right pavement from under a sodium lamp into
// the shop light: the readable colour test of the scene.
// Output is a G-buffer of two layers (the camera hit, and the hit of one wet-ground reflection ray)
// plus per-light visibility of the camera hit; the shading pass (sodium/shade.mjs) turns it into light.
import { STREET, lamps, van, objects, facadeAt, groundAt, fbm } from "./quay-street.mjs";
import { quayCamera, march, analytic, objNormal, shadow } from "./quay-street-render.mjs";
import { MATERIALS } from "../sodium/spectra.mjs";

export { quayCamera };
const MAT = Object.fromEntries(MATERIALS.map((m, i) => [m.name, i]));
export const MAT_IDS = MAT;
export const SHOP = { side: 1, z0: -22, z1: -17.5, light: [5.95, 1.5, -19.6] };
export const STRIP = { x0: 3.9, z0: -15, x1: 5.6, z1: -20.6, width: 1.0, tiles: 16 }; // ground segment, lamp foot to shop
export const MAX_LIGHTS = 10;
export const EMIT = { sodium: 0, window: 1, led: 2, sky: 3 };

// Lights: { pos, type (index into LIGHT_TYPES), I, cone, mode } with mode 0 omni, 1 spot (cone
// cosine 0.8), 2 cosine emitter facing `cone`.
export function sodiumLights(t, { headlights = true } = {}) {
  const L = lamps().map((l) => ({ pos: l.pos, type: EMIT.sodium, I: 24, cone: [0, 0, 0], mode: 0 }));
  L.push({ pos: SHOP.light, type: EMIT.window, I: 9, cone: [-1, 0, 0], mode: 2 });
  if (headlights) for (const p of van(t).lights) L.push({ pos: p, type: EMIT.led, I: 55, cone: [0, -0.05, 1], mode: 1 });
  return L;
}
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const lumOf = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

// Where a point on the ground falls on the tile strip: palette index or -1.
export function stripTile(x, z) {
  const ax = STRIP.x1 - STRIP.x0, az = STRIP.z1 - STRIP.z0, len = Math.hypot(ax, az), u = ((x - STRIP.x0) * ax + (z - STRIP.z0) * az) / (len * len);
  const v = Math.abs((x - STRIP.x0) * az - (z - STRIP.z0) * ax) / len;
  if (u < 0 || u > 1 || v > STRIP.width / 2) return -1;
  return Math.floor(u * STRIP.tiles) % 8;
}
// Surface record at a hit: { mat, scale, emitType, emitI, wet }.
function surfaceOf(kind, side, p, id, t) {
  if (kind === "obj") {
    if (id === 2) return { mat: MAT.grey, scale: 0, emitType: EMIT.sodium, emitI: 140 };
    if (id === 5) return { mat: MAT.grey, scale: 0, emitType: EMIT.led, emitI: 240 };
    if (id === 4) return { mat: MAT["blue van"], scale: 1, emitType: -1, emitI: 0 };
    if (id === 3) return { mat: MAT["red paint"], scale: 1, emitType: -1, emitI: 0 };
    return { mat: MAT.metal, scale: 0.5, emitType: -1, emitI: 0 };
  }
  if (kind === "facade") {
    const f = facadeAt(side, p[1], p[2], t), e = lumOf(f.emit);
    const shop = side === SHOP.side && p[2] > SHOP.z0 && p[2] < SHOP.z1 && p[1] > 0.4 && p[1] < 2.6;
    if (shop) return { mat: MAT.glass, scale: 1, emitType: EMIT.window, emitI: 0.3 + 0.15 * fbm(p[2] * 3, p[1] * 2) };
    if (e > 0) return { mat: MAT.glass, scale: 1, emitType: EMIT.window, emitI: p[1] < 3.1 ? e * 0.12 : e * 0.8 }; // ground-floor shopfronts other than SHOP are dim, closed for the night
    const cz = Math.floor(-p[2] / 2.6), door = p[1] < 2.2 && (cz % 5) === 2 && Math.abs(-p[2] / 2.6 - cz - 0.5) < 0.22;
    if (door) return { mat: [MAT["green door"], MAT["red paint"], MAT["blue van"], MAT["teal hull"]][((cz / 5) | 0) % 4], scale: 0.8, emitType: -1, emitI: 0 };
    const brick = ((Math.floor(-p[2] / 9) + (side > 0 ? 1 : 0)) & 1) === 1;
    return { mat: brick ? MAT.brick : MAT.plaster, scale: lumOf(f.albedo) / 0.17, emitType: -1, emitI: 0 };
  }
  if (kind === "quay") return { mat: MAT.stone, scale: 0.7, emitType: -1, emitI: 0 };
  if (kind === "water") return { mat: MAT.asphalt, scale: 0.1, emitType: -1, emitI: 0, wet: 1 };
  const g = groundAt(p[0], p[2]), tile = Math.abs(p[0]) > STREET.half ? stripTile(p[0], p[2]) : -1;
  const line = Math.abs(p[0]) < 0.07 && g.albedo[0] > 0.2;
  const mat = tile >= 0 ? tile : line ? MAT["yellow line"] : Math.abs(p[0]) > STREET.half ? MAT.stone : MAT.asphalt;
  return { mat, scale: (tile >= 0 || line ? 0.9 : lumOf(g.albedo) / (Math.abs(p[0]) > STREET.half ? 0.1 : 0.06)) * (1 - 0.45 * g.wet), emitType: -1, emitI: 0, wet: g.wet };
}
// Trace one ray: { hit, P, N, s (surface), t }.
export function traceSurface(o, d, t, vs) {
  const a = analytic(o, d), m = march(o, d, Math.min(a.t, 90), vs);
  if (m && m.t < a.t) { const P = [o[0] + d[0] * m.t, o[1] + d[1] * m.t, o[2] + d[2] * m.t]; return { hit: true, P, N: objNormal(P, vs), s: surfaceOf("obj", 0, P, m.id, t), t: m.t }; }
  if (a.t < Infinity) {
    const P = [o[0] + d[0] * a.t, o[1] + d[1] * a.t, o[2] + d[2] * a.t];
    const N = a.kind === "facade" ? [-a.side, 0, 0] : a.kind === "quay" ? [0, 0, 1] : [0, 1, 0];
    return { hit: true, P, N, kind: a.kind, s: surfaceOf(a.kind, a.side, P, 0, t), t: a.t };
  }
  return { hit: false, t: 200 };
}
// Per-light visibility of a point (soft shadow through the small objects).
export const visOf = (P, N, lights, vs) => lights.map((L) => (dot(N, sub(L.pos, P)) > 0 ? shadow([P[0] + N[0] * 0.02, P[1] + N[1] * 0.02, P[2] + N[2] * 0.02], L.pos, vs) : 0));
// The reflection: Fresnel weight and direction for a ground or water hit, with rain ripples.
export function reflectionOf(hit, d, t) {
  if (!hit.hit || !(hit.kind === "ground" || hit.kind === "water")) return null;
  const p = hit.P, water = hit.kind === "water", wet = hit.s.wet ?? 0;
  const rip = 0.05 * Math.sin(17 * fbm(p[0] * 3.1 + 11 * Math.floor(t * 4), p[2] * 3.1)) * wet;
  const bx = water ? 0.02 * (fbm(p[0] * 0.8 + t * 0.3, p[2] * 2) - 0.5) : 0.1 * (fbm(p[0] * 7, p[2] * 1.1) - 0.5) * (1 - wet * 0.9) + rip;
  const bz = water ? 0.06 * (fbm(p[0] * 0.8, p[2] * 2 - t * 0.2) - 0.5) : 0.03 * (fbm(p[0] * 2.3 + 5, p[2] * 6) - 0.5) * (1 - wet) + rip * 0.5;
  const n = nrm([bx, 1, bz]), c = Math.max(0, -dot(d, n)), F = 0.02 + 0.98 * Math.pow(1 - c, 5), w = water ? F : F * (0.25 + 0.75 * wet);
  const k = 2 * dot(d, n), r = nrm([d[0] - k * n[0], Math.abs(d[1] - k * n[1]), d[2] - k * n[2]]);
  return { w, r };
}
