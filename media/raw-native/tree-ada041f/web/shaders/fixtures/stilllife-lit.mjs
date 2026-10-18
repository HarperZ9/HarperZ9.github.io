// The still life (stilllife.mjs) lit for relighting shaders, with saturated paint-like albedos: a
// cadmium-yellow sphere, a vermilion box, a viridian torus, an ultramarine capsule on a warm grey
// table. A warm low key light from the left casts hard shadows, and only a weak cool sky fills them,
// so every saturated colour shows a lit side and a deep shadow side. This is the case pigment-space
// lighting is about: a renderer keeps yellow yellow in shadow, a painter mixes it toward olive.
// Outputs match streetScene's lighting outputs (albedo, light, kind, fogT, fogColor), kind 2 = lit.
import { stillSdf, sdSphere, sdTorus, sdCapsule, sdRoundBox, STILL } from "./stilllife.mjs";

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const norm = (a) => mul(a, 1 / Math.hypot(a[0], a[1], a[2]));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

export const SAT_ALBEDO = { table: [0.42, 0.38, 0.33], sphere: [0.85, 0.6, 0.04], box: [0.78, 0.1, 0.05], torus: [0.04, 0.42, 0.24], capsule: [0.07, 0.1, 0.62] };
const KEY = norm([-0.85, 0.42, 0.3]), KEY_C = [1.5, 1.25, 0.9], SKY_C = [0.03, 0.04, 0.07];

function material(p) {
  const d = [["table", p[1]], ["sphere", sdSphere(p)], ["torus", sdTorus(p)], ["capsule", sdCapsule(p)], ["box", sdRoundBox(p)]];
  return d.reduce((a, b) => (b[1] < a[1] ? b : a))[0];
}
function normal(p) {
  const e = 1e-4, f = (q) => stillSdf(q);
  return norm([f(add(p, [e, 0, 0])) - f(sub(p, [e, 0, 0])), f(add(p, [0, e, 0])) - f(sub(p, [0, e, 0])), f(add(p, [0, 0, e])) - f(sub(p, [0, 0, e]))]);
}
function shadow(p, l) {
  let t = 0.02;
  for (let i = 0; i < 96 && t < 12; i++) { const d = stillSdf(add(p, mul(l, t))); if (d < 1e-4) return 0; t += d; }
  return 1;
}

export function stillLifeLit(w = 640, h = 400, { albedo = SAT_ALBEDO } = {}) {
  const N = w * h, data = new Float32Array(N * 4), alb = new Float32Array(N * 4), light = new Float32Array(N * 4);
  const fogT = new Float32Array(N), kind = new Uint8Array(N), c = STILL.camera;
  const fwd = norm(sub(c.target, c.eye)), right = norm([-fwd[2], 0, fwd[0]]), up = cross(right, fwd);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, sx = ((x + 0.5) / w - 0.5) * 2 * (w / h) * c.tan, sy = (0.5 - (y + 0.5) / h) * 2 * c.tan;
    const rd = norm(add(add(fwd, mul(right, sx)), mul(up, sy)));
    let t = 0, hit = false;
    for (let k = 0; k < 160; k++) { const d = stillSdf(add(c.eye, mul(rd, t))); if (d < 1e-4 * (1 + t)) { hit = true; break; } t += d; if (t > 30) break; }
    let E, a;
    if (!hit) { E = [0.06, 0.07, 0.1]; a = [1, 1, 1]; kind[i] = 0; }
    else {
      const p = add(c.eye, mul(rd, t)), n = normal(p), m = material(p);
      const key = Math.max(0, dot(n, KEY)) * shadow(add(p, mul(n, 2e-3)), KEY), sky = 0.5 + 0.5 * n[1];
      E = [0, 1, 2].map((k) => key * KEY_C[k] + sky * SKY_C[k]);
      a = albedo[m]; kind[i] = 2;
    }
    light.set([...E, 1], i * 4); alb.set([...a, 1], i * 4);
    data.set([a[0] * E[0], a[1] * E[1], a[2] * E[2], 1], i * 4);
  }
  return { width: w, height: h, data, albedo: alb, light, fogT, fogColor: [0, 0, 0], kind };
}
