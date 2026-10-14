// Salience caricature: the frame swells around what matters, like a caricaturist's pen.
//
// For the grotesque register of the painted RPG: a figure's head bulges, the lamp leans in, and the
// rest of the street gives way. Salience s comes from the scene (material weights: head, hat, coat,
// lamp), smoothed into S = G * s. The backward map reads each output pixel from
//   source(y) = y + lambda grad S(y)
// which pulls content toward salience peaks, so the region around a peak is magnified
// (magnification 1 / det J). The map cannot fold: J = I + lambda A with A the discrete derivative of
// grad S, and lambda is clamped to 0.8 / max ||A||_F over the frame, so ||lambda A||_2 <= 0.8, I + tA
// stays invertible for t in [0, 1] and det J >= (1 - 0.8)^2 = 0.04 everywhere, for any salience.
// Several such steps compose (steps > 1: y <- y + lambda grad S(y), reading grad S bilinearly at the
// moving point). Each step is clamped to ||lambda A||_2 <= c with (1 - c)^(2 steps) = 0.04, so the
// composed map keeps det J >= 0.04 too. (A first composed version kept the one-step clamp per step;
// its composed determinant fell to 0.001, still positive but under the committed 0.03.)
// Prior work warps by importance (Liu and Gleicher 2005; Wang et al. 2008) and guarantees bijection
// by optimisation (Panozzo et al. 2012); here the guarantee comes from one global clamp on the GPU.
export const CARI_PRESETS = {
  grotesque: { weights: { 5: 1.0, 6: 0.7, 4: 0.45, 8: 0.5, 7: 0.15 }, sigma: 0.035, lambda: 1e9, gain: 1.0, steps: 4 },
  subtle: { weights: { 5: 1.0, 6: 0.6, 4: 0.5, 8: 0.4, 7: 0.1 }, sigma: 0.09, lambda: 1e9, gain: 0.4, steps: 1 },
};
export function resolveCaricature(preset, overrides = {}, size) {
  const p = { ...CARI_PRESETS[preset], ...overrides }, sig = p.sigma * size.h, R = Math.ceil(3 * sig), taps = new Float64Array(2 * R + 1);
  let s = 0; for (let i = -R; i <= R; i++) { taps[i + R] = Math.exp(-0.5 * (i / sig) ** 2); s += taps[i + R]; }
  for (let i = 0; i < taps.length; i++) taps[i] /= s;
  return { p, w: size.w, h: size.h, R, taps };
}
export function salienceFrom(plan, mat) {
  const s = new Float64Array(plan.w * plan.h);
  for (let i = 0; i < s.length; i++) s[i] = plan.p.weights[mat[i]] || 0;
  return s;
}
// Separable gaussian with clamped borders.
export function smooth(plan, s) {
  const { w, h, R, taps } = plan, a = new Float64Array(w * h), b = new Float64Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -R; k <= R; k++) v += taps[k + R] * s[y * w + Math.min(w - 1, Math.max(0, x + k))]; a[y * w + x] = v; }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { let v = 0; for (let k = -R; k <= R; k++) v += taps[k + R] * a[Math.min(h - 1, Math.max(0, y + k)) * w + x]; b[y * w + x] = v; }
  return b;
}
const at = (plan, F, x, y, c = 0, n = 1) => F[(Math.min(plan.h - 1, Math.max(0, y)) * plan.w + Math.min(plan.w - 1, Math.max(0, x))) * n + c];
// Central-difference gradient of S, and the central-difference derivative A of that gradient.
export function gradient(plan, S) {
  const g = new Float64Array(plan.w * plan.h * 2);
  for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) { const i = y * plan.w + x; g[i * 2] = 0.5 * (at(plan, S, x + 1, y) - at(plan, S, x - 1, y)); g[i * 2 + 1] = 0.5 * (at(plan, S, x, y + 1) - at(plan, S, x, y - 1)); }
  return g;
}
export function jacobianA(plan, g, x, y) {
  return [0.5 * (at(plan, g, x + 1, y, 0, 2) - at(plan, g, x - 1, y, 0, 2)), 0.5 * (at(plan, g, x, y + 1, 0, 2) - at(plan, g, x, y - 1, 0, 2)),
    0.5 * (at(plan, g, x + 1, y, 1, 2) - at(plan, g, x - 1, y, 1, 2)), 0.5 * (at(plan, g, x, y + 1, 1, 2) - at(plan, g, x, y - 1, 1, 2))];
}
export function lambdaFor(plan, g) {
  let m = 0;
  for (let y = 0; y < plan.h; y++) for (let x = 0; x < plan.w; x++) { const A = jacobianA(plan, g, x, y); m = Math.max(m, Math.sqrt(A[0] * A[0] + A[1] * A[1] + A[2] * A[2] + A[3] * A[3])); }
  const steps = plan.p.steps || 1, c = 1 - Math.pow(0.04, 1 / (2 * steps));   // 0.8 for one step
  return m > 0 ? Math.min(plan.p.lambda, (c * plan.p.gain) / m) : 0;
}
// Bilinear read of the source (scene-linear RGBA) at a fractional pixel centre position.
function sample(src, fx, fy, out) {
  const { width: w, height: h, data: d } = src, u = fx - 0.5, v = fy - 0.5;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(u))), y0 = Math.max(0, Math.min(h - 1, Math.floor(v))), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, u - x0)), ty = Math.max(0, Math.min(1, v - y0));
  for (let c = 0; c < 3; c++) out[c] = (d[(y0 * w + x0) * 4 + c] * (1 - tx) + d[(y0 * w + x1) * 4 + c] * tx) * (1 - ty) + (d[(y1 * w + x0) * 4 + c] * (1 - tx) + d[(y1 * w + x1) * 4 + c] * tx) * ty;
}
// Bilinear read of the gradient field at a fractional pixel-centre position.
export function gradAt(plan, g, fx, fy) {
  const { w, h } = plan, u = fx - 0.5, v = fy - 0.5;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(u))), y0 = Math.max(0, Math.min(h - 1, Math.floor(v))), x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, u - x0)), ty = Math.max(0, Math.min(1, v - y0)), r = [0, 0];
  for (let c = 0; c < 2; c++) r[c] = (g[(y0 * w + x0) * 2 + c] * (1 - tx) + g[(y0 * w + x1) * 2 + c] * tx) * (1 - ty) + (g[(y1 * w + x0) * 2 + c] * (1 - tx) + g[(y1 * w + x1) * 2 + c] * tx) * ty;
  return r;
}
export function runCaricature(plan, src, sal) {
  const S = smooth(plan, sal), g = gradient(plan, S), lam = lambdaFor(plan, g), { w, h } = plan, out = new Float32Array(w * h * 4), c = [0, 0, 0], steps = plan.p.steps || 1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; let fx = x + 0.5 + lam * g[i * 2], fy = y + 0.5 + lam * g[i * 2 + 1];
    for (let k = 1; k < steps; k++) { const d = gradAt(plan, g, fx, fy); fx += lam * d[0]; fy += lam * d[1]; }
    sample(src, fx, fy, c);
    out.set([c[0], c[1], c[2], 1], i * 4);
  }
  return { out: { width: w, height: h, data: out }, S, g, lambda: lam };
}
