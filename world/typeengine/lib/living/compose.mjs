// lib/living/compose.mjs: one frame of a transfer, on the CPU (the reference; web/living-gl.mjs is the same sum).
// Every pixel reads the material that the flow has carried to it (the position map P), in the medium its process
// field W has reached: before the front, the old medium; behind it, the new one; on the front, both at once (the
// denser material covering the lighter, as wet charcoal over ink does; a material over itself stays itself), smeared
// along the way it is moving. No crossfade: the
// share of each medium is never blended over time, only the front moves.
import { clamp } from './fields.mjs';

const BAND = 0.16;

function bilerp(f, nx, ny, x, y) {
  x = clamp(x, 0, nx - 1.001); y = clamp(y, 0, ny - 1.001); const i = x | 0, j = y | 0, a = x - i, b = y - j, k = j * nx + i;
  return (f[k] * (1 - a) + f[k + 1] * a) * (1 - b) + (f[k + nx] * (1 - a) + f[k + nx + 1] * a) * b;
}
function sample(img, w, h, x, y, out) {
  x = clamp(x, 0, w - 1.001); y = clamp(y, 0, h - 1.001); const i = x | 0, j = y | 0, a = x - i, b = y - j;
  for (let c = 0; c < 3; c++) { const k = (j * w + i) * 3 + c; out[c] = (img[k] * (1 - a) + img[k + 3] * a) * (1 - b) + (img[k + w * 3] * (1 - a) + img[k + w * 3 + 3] * a) * b; }
  return out;
}
/** The fields at progress p (0..1), between two keyframes. */
export function fieldsAt(sim, p) {
  const n = sim.frames.length - 1, f = clamp(p) * n, i = Math.min(n - 1, Math.floor(f)), t = f - i, A = sim.frames[i], B = sim.frames[i + 1], len = A.px.length;
  const mix = (a, b) => { const o = new Float32Array(len); for (let k = 0; k < len; k++) o[k] = a[k] + (b[k] - a[k]) * t; return o; };
  return { px: mix(A.px, B.px), py: mix(A.py, B.py), W: mix(A.W, B.W), R: mix(A.R, B.R), vx: mix(A.px, A.px).map((v, k) => B.px[k] - A.px[k]), vy: B.py.map((v, k) => v - A.py[k]) };
}

/** A medium change of one word: images A (old medium) and B (new medium) of the same layout, light grounds. */
export function composeChange(sim, A, B, w, h, p, { paper, dark = false, same = sameMaterial(A, B) } = {}) {
  const F = fieldsAt(sim, p), { nx, ny, sx, sy } = sim, out = new Float32Array(w * h * 3), a = [0, 0, 0], b = [0, 0, 0], s = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = (x + 0.5) / sx - 0.5, gy = (y + 0.5) / sy - 0.5, Px = bilerp(F.px, nx, ny, gx, gy), Py = bilerp(F.py, nx, ny, gx, gy), Wv = bilerp(F.W, nx, ny, gx, gy);
    const X = (Px + 0.5) * sx - 0.5, Y = (Py + 0.5) * sy - 0.5, vx = bilerp(F.vx, nx, ny, gx, gy) * sx, vy = bilerp(F.vy, nx, ny, gx, gy) * sy, o = (y * w + x) * 3;
    // motion: three taps back along the way the material is moving (what the eye sees of a moving stroke)
    const pick = (img, dst) => { dst[0] = dst[1] = dst[2] = 0; for (let q = 0; q < 3; q++) { sample(img, w, h, X - vx * q * 0.5, Y - vy * q * 0.5, s); for (let c = 0; c < 3; c++) dst[c] += s[c] / 3; } return dst; };
    const e = (Wv - 0.5) / BAND;
    if (e <= -1) { pick(A, a); out.set(a, o); }
    else if (e >= 1) { pick(B, b); out.set(b, o); }
    else { pick(A, a); pick(B, b); for (let c = 0; c < 3; c++) out[o + c] = dark ? Math.max(a[c], b[c]) : same ? Math.min(a[c], b[c]) : (a[c] * b[c]) / Math.max(1e-4, paper[c]); }
  }
  return out;
}

/** True when two images are the same material (a still print and the same print awake): sampled pixels agree. */
export function sameMaterial(A, B) { if (A === B) return true; for (let k = 0; k < 64; k++) { const i = Math.floor(((k * 2654435761) >>> 0) % A.length); if (Math.abs(A[i] - B[i]) > 1e-4) return false; } return true; }

/** The drift at rest: displacement (px) of a state's surface at clock t (amp px, rate Hz). Shared with the shader. */
export function drift(x, y, t, { amp = 0, rate = 0 } = {}, seed = 1) {
  if (!amp || !rate) return [0, 0];
  const ph = 2 * Math.PI * rate * t;
  return [amp * Math.sin(ph + y * 0.045 + seed) * Math.cos(ph * 0.7 + x * 0.013), amp * 0.6 * Math.cos(ph * 0.8 + x * 0.05 + seed)];
}
/** A settled state, breathing: or, during a move, the two states' drifts weighted by progress p, so the surface keeps
 * moving continuously across the boundary between a hold and a move. */
export function breathe(img, w, h, t, breath, seed = 1, to = null, p = 0) {
  if (!breath?.amp && !to?.amp) return img;
  const out = new Float32Array(img.length), s = [0, 0, 0];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = drift(x, y, t, breath, seed), b = to ? drift(x, y, t, to, seed) : [0, 0], dx = a[0] * (1 - p) + b[0] * p, dy = a[1] * (1 - p) + b[1] * p;
    out.set(sample(img, w, h, x + dx, y + dy, s), (y * w + x) * 3);
  }
  return out;
}
export { bilerp, sample };
