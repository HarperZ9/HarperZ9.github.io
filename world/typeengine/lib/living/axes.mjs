// lib/living/axes.mjs: a cut's construction rule moving within one stop. Burin's LINE (4 to 8) and Divisumma's TURN
// (0 to 100) follow a timing layer (the creation engine's gen/timing.mjs curves, read-only: heartbeat, forge, spring,
// sqrt_t, beat ...). The stop is painted at a few levels of the axis; each pixel shows the level at its own place on
// a slow patch field, so a hairline is engraved or lifted patch by patch as the axis moves, never the whole word at
// once (a cut), and never two levels blended (a crossfade).
//   stop.animate = { param: 'lines', from: 4, to: 8, timing: { curves: [{ curve: 'heartbeat', weight: 1, params }] } }
//   or timing: a creation-engine timing layer (its state.progress is read as it is)
import { CURVES } from '../../../creation/lib/gen/timing.mjs';

export const SPREAD = 0.9;  // how far apart in level two places on the patch field can be (in levels)

/** The axis's levels: whole lines for LINE, five steps for a continuous axis. */
export function levelsOf(anim) {
  const n = anim.levels ?? (anim.param === 'lines' ? Math.abs(anim.to - anim.from) + 1 : 5);
  return Array.from({ length: n }, (_, k) => anim.from + (anim.to - anim.from) * (k / Math.max(1, n - 1)));
}
/** Progress 0..1 of the timing at clock t. */
export function progressAt(anim, t) {
  const T = anim.timing ?? { curves: [{ curve: 'heartbeat', weight: 1, params: { bpm: 20 } }] };
  if (T.state && typeof T.state.progress === 'number') return T.state.progress;
  let s = 0, w = 0; for (const c of T.curves) { const f = CURVES[c.curve]; if (!f) throw new Error(`living: unknown timing curve ${c.curve}`); s += (c.weight ?? 1) * f(t, c.params ?? {}); w += c.weight ?? 1; }
  return Math.min(1, Math.max(0, s / Math.max(1e-9, w)));
}
// a smooth value noise both the CPU and the shader compute the same way (hash by sine, cubic fade), cells of `scale` px
const fr = (x) => x - Math.floor(x);
const h2 = (x, y) => fr(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
export function patch(x, y, scale = 48) {
  const u = x / scale, v = y / scale, i = Math.floor(u), j = Math.floor(v), a = u - i, b = v - j, sa = a * a * (3 - 2 * a), sb = b * b * (3 - 2 * b);
  return (h2(i, j) * (1 - sa) + h2(i + 1, j) * sa) * (1 - sb) + (h2(i, j + 1) * (1 - sa) + h2(i + 1, j + 1) * sa) * sb;
}
export const PATCH_GLSL = `float h2(vec2 p) { return fract(sin(p.x * 127.1 + p.y * 311.7) * 43758.5453); }
float patchN(vec2 p) { vec2 u = p / 48., i = floor(u), f = u - i, s = f * f * (3. - 2. * f);
  return mix(mix(h2(i), h2(i + vec2(1., 0.)), s.x), mix(h2(i + vec2(0., 1.)), h2(i + vec2(1.)), s.x), s.y); }`;

/** One frame of a moving axis on the CPU: images[k] at each level, u the continuous level index 0..K-1. */
export function composeLevels(images, w, h, u) {
  const K = images.length, out = new Float32Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = Math.max(0, Math.min(K - 1, Math.round(u + SPREAD * (patch(x, y) - 0.5)))), o = (y * w + x) * 3;
    out[o] = images[k][o]; out[o + 1] = images[k][o + 1]; out[o + 2] = images[k][o + 2];
  }
  return out;
}
