// Orthographic G-buffer renderer for Chapel Yard (chapel.mjs): per pixel the class (with the void
// pools split out of the ground), a detail value, position, normal, depth, and the shadow
// visibility of the three lights the palette lighting uses (moon, lamp, window glow), plus the
// pool's pattern value for palette cycling. CPU, float64 march.
import { map, hitId, surfaceOf, setExact, CLS, LAMP, WINDOWS } from "./chapel.mjs";
import { pcg } from "../common.mjs";

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]); return [a[0] / l, a[1] / l, a[2] / l]; };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const MOON_DIR = norm([-0.5, 0.68, 0.5]);
export const TARGET = [3, 1.2, 3];

export function chapelCamera({ yawDeg = 30, elevDeg = 42, scale = 8.5, target = TARGET, dist = 60 } = {}) {
  const y = (yawDeg * Math.PI) / 180, e = (elevDeg * Math.PI) / 180, fwd = [-Math.sin(y) * Math.cos(e), -Math.sin(e), -Math.cos(y) * Math.cos(e)], right = norm(cross(fwd, [0, 1, 0])), up = norm(cross(right, fwd));
  return { pos: [target[0] - fwd[0] * dist, target[1] - fwd[1] * dist, target[2] - fwd[2] * dist], fwd, right, up, scale };
}
const hash = (a, b) => pcg((a | 0) ^ pcg(b | 0)) / 4294967296;
function vnoise(x, y) { const x0 = Math.floor(x), y0 = Math.floor(y), fx = (x - x0) ** 2 * (3 - 2 * (x - x0)), fy = (y - y0) ** 2 * (3 - 2 * (y - y0)); return (hash(x0, y0) * (1 - fx) + hash(x0 + 1, y0) * fx) * (1 - fy) + (hash(x0, y0 + 1) * (1 - fx) + hash(x0 + 1, y0 + 1) * fx) * fy; }
export const poolPhase = (x, z) => { const v = 0.55 * vnoise(x * 0.8, z * 0.8) + 0.25 * vnoise(x * 2.1 + 7, z * 2.1) + 0.2 * vnoise(x * 0.35 + 3, z * 0.35 + 9); return v - Math.floor(v); };

function normalAt(x, y, z) { const e = 0.003, k0 = map(x + e, y - e, z - e), k1 = map(x - e, y - e, z + e), k2 = map(x - e, y + e, z - e), k3 = map(x + e, y + e, z + e); return norm([k0 - k1 - k2 + k3, -k0 - k1 + k2 + k3, -k0 + k1 - k2 + k3]); }
function shadow(P, N, L, maxT, k = 8) {
  const o = [P[0] + N[0] * 0.04, P[1] + N[1] * 0.04, P[2] + N[2] * 0.04]; let res = 1, t = 0.05;
  for (let i = 0; i < 60 && t < maxT; i++) { const h = map(o[0] + L[0] * t, o[1] + L[1] * t, o[2] + L[2] * t); if (h < 0.002) return 0; res = Math.min(res, (k * h) / t); t += Math.max(h, 0.05); }
  return Math.max(0, Math.min(1, res));
}

export function renderChapel(cam, w, h, { lamp = LAMP, moon = MOON_DIR } = {}) {
  const n = w * h, g = { w, h, hit: new Uint8Array(n), cls: new Uint8Array(n), a: new Float32Array(n), depth: new Float32Array(n), P: new Float32Array(n * 3), N: new Float32Array(n * 3), vis: new Float32Array(n * 3), phase: new Float32Array(n) };
  const asp = w / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, u = (((x + 0.5) / w) * 2 - 1) * asp, v = 1 - ((y + 0.5) / h) * 2, s = cam.scale;
    const o = [cam.pos[0] + (cam.right[0] * u + cam.up[0] * v) * s, cam.pos[1] + (cam.right[1] * u + cam.up[1] * v) * s, cam.pos[2] + (cam.right[2] * u + cam.up[2] * v) * s], d = cam.fwd;
    setExact(false);
    let t = 0, hit = false;
    for (let k = 0; k < 220 && t < 150; k++) { const q = map(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t); if (q < 0.0008 + 0.0002 * t) { hit = true; break; } t += q; }
    if (!hit) continue;
    const P = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    map(P[0], P[1], P[2]); const id = hitId; setExact(true); const N = normalAt(P[0], P[1], P[2]), so = surfaceOf(id, P[0], P[1], P[2]);
    g.hit[i] = 1; g.cls[i] = so.cls; g.a[i] = so.a; g.depth[i] = (P[0] - cam.pos[0]) * d[0] + (P[1] - cam.pos[1]) * d[1] + (P[2] - cam.pos[2]) * d[2];
    for (let c = 0; c < 3; c++) { g.P[i * 3 + c] = P[c]; g.N[i * 3 + c] = N[c]; }
    g.phase[i] = so.cls === CLS.void ? poolPhase(P[0], P[2]) : 0;
    if (so.cls !== CLS.window && so.cls !== CLS.lamp && so.cls !== CLS.void) {
      g.vis[i * 3] = shadow(P, N, moon, 40);
      const toL = [lamp[0] - P[0], lamp[1] - P[1], lamp[2] - P[2]], dist = Math.hypot(...toL);
      g.vis[i * 3 + 1] = dist < 11 ? shadow(P, N, [toL[0] / dist, toL[1] / dist, toL[2] / dist], dist - 0.95, 5) : 0;
      g.vis[i * 3 + 2] = 1;
    }
    setExact(false);
  }
  return g;
}
export { WINDOWS };
