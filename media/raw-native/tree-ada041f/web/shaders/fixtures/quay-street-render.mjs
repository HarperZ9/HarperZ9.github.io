// Renders Quay Street (quay-street.mjs) to a scene-linear HDR frame: lamp heads and headlights
// far brighter than the scene (the lens suite needs real highlights), Lambert lighting with soft
// shadows from point lights, wet ground and puddles that reflect by Fresnel (one traced
// reflection ray), black harbour water, and light scattered by mist around every lamp (closed-form
// single scattering along the view ray). Also lists the emitters as screen-space sources, the
// "scene supplies the bright-source list" mode of the lens suite.
import * as Q from "./quay-street.mjs";
import { STREET, lamps, van, objects, facadeAt, groundAt, skyAt, blockHeight, fbm } from "./quay-street.mjs";

const FOV = (50 * Math.PI) / 180, MIST = { scatter: 0.008, extinct: 0.007 };
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export function quayCamera(t = 0) { return { pos: [1.3 + 0.08 * Math.sin(t * 0.7), 1.55 + 0.03 * Math.sin(t * 1.3), 7 - 0.55 * t], look: [-0.6, 2.4, -45] }; }
function basis(cam) { const f = nrm(sub(cam.look, cam.pos)), r = nrm(cross(f, [0, 1, 0])), u = cross(r, f); return { f, r, u }; }

// Lights of a frame: lamps (sodium left, white right) and the van's headlights (a forward cone).
export function lightsAt(t) {
  const L = lamps().map((l) => ({ pos: l.pos, rgb: l.rgb.map((c) => c * l.I), r: l.r, emit: l.rgb.map((c) => c * 160), cone: null }));
  for (const p of van(t).lights) L.push({ pos: p, rgb: [55, 52, 48], r: 0.13, emit: [260, 250, 235], cone: [0, -0.05, 1] });
  return L;
}

export function march(o, d, tMax, vs) {
  let t = 0.02;
  for (let i = 0; i < 110 && t < tMax; i++) { const h = objects(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t, vs); if (h < 0.002 * (1 + t)) return { t, id: Q.hitId }; t += h * 0.95; }
  return null;
}
export function objNormal(p, vs) { const e = 0.003, f = (x, y, z) => objects(x, y, z, vs); return nrm([f(p[0] + e, p[1], p[2]) - f(p[0] - e, p[1], p[2]), f(p[0], p[1] + e, p[2]) - f(p[0], p[1] - e, p[2]), f(p[0], p[1], p[2] + e) - f(p[0], p[1], p[2] - e)]); }
export function shadow(p, L, vs) {
  const v = sub(L, p), dist = Math.hypot(v[0], v[1], v[2]), d = [v[0] / dist, v[1] / dist, v[2] / dist];
  let res = 1, t = 0.05;
  for (let i = 0; i < 64 && t < dist - 0.75; i++) { const h = objects(p[0] + d[0] * t, p[1] + d[1] * t, p[2] + d[2] * t, vs); if (h < 0.001) return 0; res = Math.min(res, (8 * h) / t); t += Math.min(0.6, Math.max(h, 0.015)); }
  return Math.max(0, Math.min(1, res));
}
// Nearest analytic surface: street, pavement, quay wall, water, facades.
export function analytic(o, d) {
  let best = { t: Infinity };
  const plane = (axis, val) => (Math.abs(d[axis]) < 1e-9 ? -1 : (val - o[axis]) / d[axis]);
  const tk = plane(1, STREET.kerb); if (tk > 0) { const x = o[0] + d[0] * tk, z = o[2] + d[2] * tk; if (Math.abs(x) > STREET.half && Math.abs(x) < STREET.facade && z > STREET.quayZ && tk < best.t) best = { t: tk, kind: "ground" }; }
  const t0 = plane(1, 0); if (t0 > 0) { const x = o[0] + d[0] * t0, z = o[2] + d[2] * t0; if (Math.abs(x) <= STREET.half && z > STREET.quayZ && t0 < best.t) best = { t: t0, kind: "ground" }; }
  const tw = plane(1, STREET.waterY); if (tw > 0 && o[2] + d[2] * tw <= STREET.quayZ && tw < best.t) best = { t: tw, kind: "water" };
  const tq = plane(2, STREET.quayZ); if (tq > 0) { const y = o[1] + d[1] * tq; if (y < STREET.kerb && y > STREET.waterY && tq < best.t) best = { t: tq, kind: "quay" }; }
  for (const side of [-1, 1]) { const tf = plane(0, side * STREET.facade); if (tf > 0 && tf < best.t) { const y = o[1] + d[1] * tf, z = o[2] + d[2] * tf; if (z > STREET.quayZ - 0.01 && z < 12 && y < blockHeight(side, z)) best = { t: tf, kind: "facade", side }; } }
  return best;
}
function direct(p, n, albedo, lights, vs, shadows) {
  const o = [0.012 * albedo[0], 0.014 * albedo[1], 0.02 * albedo[2]];
  for (const L of lights) {
    const v = sub(L.pos, p), d2 = dot(v, v); if (d2 > 900) continue;
    const dist = Math.sqrt(d2), l = [v[0] / dist, v[1] / dist, v[2] / dist], c = dot(n, l); if (c <= 0) continue;
    let k = c / d2; if (L.cone) { const a = -dot(l, L.cone); k *= a > 0.8 ? Math.pow((a - 0.8) / 0.2, 1.5) * 4 : 0; } if (k <= 0) continue;
    if (shadows) k *= shadow([p[0] + n[0] * 0.02, p[1] + n[1] * 0.02, p[2] + n[2] * 0.02], L.pos, vs);
    for (let j = 0; j < 3; j++) o[j] += albedo[j] * L.rgb[j] * k * 0.3183;
  }
  return o;
}
function mist(o, d, tEnd, lights) {
  const s = [0, 0, 0], end = Math.min(tEnd, 80);
  for (const L of lights) {
    const v = sub(L.pos, o), s0 = dot(v, d), h = Math.max(0.12, Math.sqrt(Math.max(0, dot(v, v) - s0 * s0)));
    const k = (MIST.scatter / (4 * Math.PI * h)) * (Math.atan((end - s0) / h) + Math.atan(s0 / h));
    for (let j = 0; j < 3; j++) s[j] += L.rgb[j] * k;
  }
  return s;
}
// Radiance along a ray. depth 0 is the camera ray (shadows, reflections, mist); depth 1 a reflection.
export function radiance(o, d, t, lights, vs, depth = 0) {
  const a = analytic(o, d), m = march(o, d, Math.min(a.t, 90), vs);
  let col, tHit;
  if (m && m.t < a.t) {
    tHit = m.t; const p = [o[0] + d[0] * m.t, o[1] + d[1] * m.t, o[2] + d[2] * m.t];
    if (m.id === 2 || m.id === 5) { const L = lights.reduce((b, l) => (Math.hypot(...sub(l.pos, p)) < Math.hypot(...sub(b.pos, p)) ? l : b)); col = [...L.emit]; }
    else { const n = objNormal(p, vs), alb = m.id === 4 ? [0.18, 0.05, 0.04] : m.id === 3 ? [0.09, 0.09, 0.08] : [0.04, 0.045, 0.05]; col = direct(p, n, alb, lights, vs, depth === 0); }
  } else if (a.t < Infinity) {
    tHit = a.t; const p = [o[0] + d[0] * a.t, o[1] + d[1] * a.t, o[2] + d[2] * a.t];
    if (a.kind === "facade") { const f = facadeAt(a.side, p[1], p[2], t), n = [-a.side, 0, 0]; col = direct(p, n, f.albedo, lights, vs, depth === 0).map((c, j) => c + f.emit[j]); }
    else if (a.kind === "quay") col = direct(p, [0, 0, 1], [0.05, 0.05, 0.05], lights, vs, false);
    else {
      const water = a.kind === "water", g = water ? { wet: 1, albedo: [0.004, 0.006, 0.008], bump: 0 } : groundAt(p[0], p[2]);
      const ripple = water ? 0.02 * (fbm(p[0] * 0.8 + t * 0.3, p[2] * 2 - t * 0.2) - 0.5) : 0;
      const bx = water ? ripple : 0.10 * (fbm(p[0] * 7, p[2] * 1.1) - 0.5) * (1 - g.wet * 0.9), bz = water ? ripple * 3 : 0.03 * (fbm(p[0] * 2.3 + 5, p[2] * 6) - 0.5) * (1 - g.wet);
      const n = nrm([bx, 1, bz]), diff = direct(p, [0, 1, 0], g.albedo.map((c) => c * (1 - 0.45 * g.wet)), lights, vs, depth === 0);
      col = diff;
      if (depth === 0) {
        const c = Math.max(0, -dot(d, n)), F = 0.02 + 0.98 * Math.pow(1 - c, 5), w = water ? F : F * (0.25 + 0.75 * g.wet);
        const r = nrm([d[0] - 2 * dot(d, n) * n[0], Math.abs(d[1] - 2 * dot(d, n) * n[1]), d[2] - 2 * dot(d, n) * n[2]]);
        const rc = radiance([p[0], p[1] + 0.01, p[2]], r, t, lights, vs, 1);
        for (let j = 0; j < 3; j++) col[j] += w * rc[j];
      }
    }
  } else { tHit = 200; col = skyAt(d); }
  const ext = Math.exp(-MIST.extinct * Math.min(tHit, 120)), ms = depth === 0 ? mist(o, d, tHit, lights) : [0, 0, 0];
  return [col[0] * ext + ms[0], col[1] * ext + ms[1], col[2] * ext + ms[2]];
}

// The frame: { width, height, data: Float64Array RGBA } (scene-linear), rows optional.
export function renderQuay(t, w, h, { rows = null, cam = quayCamera(t) } = {}) {
  const data = new Float64Array(w * h * 4), b = basis(cam), th = Math.tan(FOV / 2), asp = w / h, lights = lightsAt(t), vs = van(t);
  const [y0, y1] = rows || [0, h];
  for (let y = y0; y < y1; y++) for (let x = 0; x < w; x++) {
    const u = ((2 * (x + 0.5)) / w - 1) * th * asp, v = (1 - (2 * (y + 0.5)) / h) * th, d = nrm([b.f[0] + b.r[0] * u + b.u[0] * v, b.f[1] + b.r[1] * u + b.u[1] * v, b.f[2] + b.r[2] * u + b.u[2] * v]);
    const c = radiance(cam.pos, d, t, lights, vs, 0), i = (y * w + x) * 4;
    data[i] = c[0]; data[i + 1] = c[1]; data[i + 2] = c[2]; data[i + 3] = 1;
  }
  return { width: w, height: h, data };
}
// Emitters as screen sources: { x, y, E } with E the emitter's energy in frame units (radiance x
// projected disc area in px), visible ones only (an occlusion ray from the camera).
export function emittersOf(t, w, h, cam = quayCamera(t)) {
  const b = basis(cam), th = Math.tan(FOV / 2), fpx = h / (2 * th), vs = van(t), out = [];
  for (const L of lightsAt(t)) {
    const v = sub(L.pos, cam.pos), z = dot(v, b.f); if (z < 0.5) continue;
    const x = w / 2 + (dot(v, b.r) / z) * fpx, y = h / 2 - (dot(v, b.u) / z) * fpx; if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const dist = Math.hypot(v[0], v[1], v[2]), d = [v[0] / dist, v[1] / dist, v[2] / dist], m = march(cam.pos, d, dist - L.r - 0.02, vs), a = analytic(cam.pos, d);
    if (m || a.t < dist - L.r) continue;
    const area = Math.PI * ((L.r * fpx) / z) ** 2;
    out.push({ x, y, E: L.emit.map((c) => c * area) });
  }
  return out;
}
