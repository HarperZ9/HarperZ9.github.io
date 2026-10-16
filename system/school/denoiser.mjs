// Lesson K25, "Case study: the denoiser's tensor-core parity". Pure ES module,
// no DOM and no dependencies beyond precision.mjs: the lab page, a worker and
// the Node fill script share it.
//
// What raw-native measured (evidence/rr-tc-note-2026-10-15.json): its ray
// reconstruction network's cooperative-matrix path (vk_rr_conv.comp, COOP=1)
// rounds every convolution input and every weight to fp16, multiplies on
// tensor cores with fp32 accumulation and adds an fp32 bias. A per-pixel
// softmax 5 x 5 kernel predicted by the full-resolution head (layer 10) then
// filters the demodulated specular signal in fp32 (vk_rr_glue.comp, KAPPLY).
// One sample's specular radiance of 1,087, demodulated by 0.04 + 0.01, is
// about 21,700; the kernel weighs it down to about 110. Any logit error dz on
// that tap moves the output by about w (v - out) dz, which is about 110 dz.
//
// This module re-creates that arithmetic at one pixel and on a small image.
// It is SYNTHETIC: the network's weights and the frame's pixel values are not
// in raw-native's evidence, so a two-layer stand-in (a hidden 1 x 1 layer, then
// the head) is built to the note's magnitudes. The parity measure and its
// bound are raw-native's own (vk_rrnet.cpp: |out - ref| per value in double,
// the max over every value, pass when max <= 1e-2), and no variant changes it.
import { rounder } from "./precision.mjs";

export const PARITY = Object.freeze({ bound: 1e-2, measure: "max over every pixel and channel of |out - ref|, in double, from float32 outputs; pass when max <= bound" });
export const NOTE_CASE = Object.freeze({ fireflyRadiance: 1087, specularAlbedo: 0.04, eps: 0.01, neighbourRadiance: 0.1, filteredValue: 110, taps: 25, hidden: 24, ownFeatures: 25 });
export const Q = Object.freeze({ fp32: Math.fround, fp16: rounder("fp16"), bf16: rounder("bf16") });

// Per-layer arithmetic: w and x are the storage formats of weights and inputs;
// acc is how the dot product is summed: "seq32" fp32 starting from the bias
// (the scalar path), "tc32" fp32 then + fp32 bias (the tensor-core path),
// "fp16" an fp16 running sum and fp16 bias (not what the RTX path does).
const L = (w, x, acc) => Object.freeze({ w, x, acc });
const S32 = L("fp32", "fp32", "seq32"), TC = L("fp16", "fp16", "tc32");
export const VARIANTS = Object.freeze({
  scalar: Object.freeze({ label: "fp32 throughout (the scalar path, COOP=0)", hidden: S32, head: S32, tried: "run on the RTX 4090: 2.9e-3, passes" }),
  W: Object.freeze({ label: "weights fp16, inputs fp32, fp32 sums (the note's mode W)", hidden: L("fp16", "fp32", "tc32"), head: L("fp16", "fp32", "tc32"), tried: "emulated: 0.137" }),
  A: Object.freeze({ label: "inputs fp16, weights fp32, fp32 sums (the note's mode A)", hidden: L("fp32", "fp16", "tc32"), head: L("fp32", "fp16", "tc32"), tried: "emulated: 0.104" }),
  WA: Object.freeze({ label: "fp16 inputs and weights, fp32 sums (the tensor-core path, COOP=1)", hidden: TC, head: TC, tried: "RTX 4090: 0.107; emulated: 0.1085" }),
  keepHead: Object.freeze({ label: "WA with the head kept in fp32 (the note's mixed precision, layer 10 in fp32)", hidden: TC, head: L("fp32", "fp32", "tc32"), tried: "emulated: 0.051" }),
  fp16acc: Object.freeze({ label: "fp16 inputs, weights and sums (fp16 throughout; not tried in the note)", hidden: L("fp16", "fp16", "fp16"), head: L("fp16", "fp16", "fp16"), tried: null }),
  bf16: Object.freeze({ label: "bf16 inputs and weights, fp32 sums (not tried in the note)", hidden: L("bf16", "bf16", "tc32"), head: L("bf16", "bf16", "tc32"), tried: null }),
});

// Seeded uniform [0, 1) (mulberry32) and standard normal (Box-Muller).
export function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const normal = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
const f = Math.fround;

// One dense layer: out[i] = b[i] + sum_j W[i][j] x[j], in the given arithmetic.
// "exact" (the reference, a stand-in for PyTorch's fp32 convolution) sums the
// float32 products in double and rounds once to float32.
export function linear(W, b, x, rows, cols, ar) {
  const out = new Float64Array(rows), qw = ar === "exact" ? f : Q[ar.w], qx = ar === "exact" ? f : Q[ar.x], acc = ar === "exact" ? "exact" : ar.acc;
  const xq = Array.from(x, qx);
  for (let i = 0; i < rows; i++) {
    let s = acc === "seq32" ? b[i] : 0;
    for (let j = 0; j < cols; j++) {
      const p = qw(W[i * cols + j]) * xq[j];
      if (acc === "exact") s += p; else if (acc === "fp16") s = Q.fp16(s + Q.fp16(p)); else s = f(s + f(p));
    }
    out[i] = acc === "exact" ? f(f(s) + b[i]) : acc === "fp16" ? Q.fp16(s + Q.fp16(b[i])) : acc === "tc32" ? f(s + b[i]) : s;
  }
  return out;
}

// The head bound of model version >= 2: 8 tanh(z / 8), in fp32.
const hb = (z) => f(8 * f(Math.tanh(f(z / 8))));

// Softmax kernel applied to 25 taps of 3 channels. gpu: vk_rr_glue.comp's
// KAPPLY order (sum e v, then divide). Otherwise rr_model.apply_kernel's order
// (weights first, then the weighted sum), as the reference.
export function applyKernel(z, taps, gpu) {
  const hz = Array.from(z, hb), m = Math.max(...hz), e = hz.map((v) => f(Math.exp(f(v - m))));
  let s = 0;
  for (const v of e) s = f(s + v);
  const out = [0, 0, 0], w = e.map((v) => f(v / s));
  for (let k = 0; k < z.length; k++) for (let c = 0; c < 3; c++) out[c] = gpu ? f(out[c] + f(e[k] * taps[k][c])) : f(out[c] + f(taps[k][c] * w[k]));
  return { out: gpu ? out.map((v) => f(v / s)) : out, weights: w, hz };
}

// A small specular image: neighbours near 0.1 and, when firefly is true, one
// pixel of 1,087 in every channel at a seeded place. The rng stream is the same
// with or without the firefly, so the control differs in that pixel only.
export function makeImage(seed, { w = 32, h = 18, firefly = true } = {}) {
  const r = rng(seed * 7919 + 1), rad = new Float32Array(w * h * 3), extra = new Float32Array(w * h * (NOTE_CASE.ownFeatures - 3));
  for (let i = 0; i < rad.length; i++) rad[i] = NOTE_CASE.neighbourRadiance * (0.7 + 0.6 * r());
  for (let i = 0; i < extra.length; i++) extra[i] = r();
  const fx = 2 + Math.floor(r() * (w - 4)), fy = 2 + Math.floor(r() * (h - 4));
  if (firefly) for (let c = 0; c < 3; c++) rad[(fy * w + fx) * 3 + c] = NOTE_CASE.fireflyRadiance;
  const den = f(NOTE_CASE.specularAlbedo + NOTE_CASE.eps), demod = rad.map((v) => f(v / den));
  return { w, h, rad, demod, extra, firefly: { x: fx, y: fy, present: firefly } };
}

const at = (img, x, y) => { const cx = Math.min(Math.max(x, 0), img.w - 1), cy = Math.min(Math.max(y, 0), img.h - 1), i = (cy * img.w + cx) * 3; return [img.demod[i], img.demod[i + 1], img.demod[i + 2]]; };
const lg = (v) => f(Math.log1p(f(Math.max(v, 0))));

// The stand-in network. hidden: 24 x 25, He-normal, on the pixel's own 25
// features (3 log1p demodulated specular, 22 seeded stand-ins). head: 25 x 49
// on [hidden (24), log1p of each tap's mean demodulated value (25)]; the tap
// block is diagonal, -alpha, so a bright tap gets a small weight (the learned
// suppression the note describes); the hidden block is normal with sd 0.1.
// alpha is solved so that, with the random part left out, the firefly tap
// brings the filtered value to the note's 110. Given the firefly image, the
// head's bias is then set to cancel the random part at the firefly's pixel (in
// double, rounded once to fp32), so the reference case sits at about 110
// whatever the seed; the rounding of those random terms still reaches the
// fp16 paths, which is the point.
export function makeNet(seed, img = null, { headSd = 0.1 } = {}) {
  const r = rng(seed * 104729 + 3), nh = NOTE_CASE.hidden, n0 = NOTE_CASE.ownFeatures, nt = NOTE_CASE.taps, nc = nh + nt;
  const W1 = Float32Array.from({ length: nh * n0 }, () => normal(r) * Math.sqrt(2 / n0)), b1 = Float32Array.from({ length: nh }, () => normal(r) * 0.1);
  const alpha = alphaFor(), Wh = new Float32Array(nt * nc), bh = Float32Array.from({ length: nt }, () => normal(r) * 0.1);
  for (let k = 0; k < nt; k++) { for (let j = 0; j < nh; j++) Wh[k * nc + j] = normal(r) * headSd; Wh[k * nc + nh + k] = -alpha; }
  const net = { W1, b1, Wh, bh, alpha: f(alpha), seed, calibrated: false };
  if (img && img.firefly.present) {
    const hid = ownHidden(img, net, img.firefly.x, img.firefly.y, "exact");
    for (let k = 0; k < nt; k++) { let s = 0; for (let j = 0; j < nh; j++) s += Wh[k * nc + j] * hid[j]; bh[k] = -s; }
    net.calibrated = true;
  }
  return net;
}

export function alphaFor(target = NOTE_CASE.filteredValue) {
  const den = f(NOTE_CASE.specularAlbedo + NOTE_CASE.eps), vf = f(NOTE_CASE.fireflyRadiance / den), vn = f(NOTE_CASE.neighbourRadiance / den);
  const out = (a) => { const zf = hb(-a * lg(vf)), zn = hb(-a * lg(vn)), m = Math.max(zf, zn), ef = Math.exp(zf - m), en = Math.exp(zn - m); return (ef * vf + 24 * en * vn) / (ef + 24 * en); };
  let lo = 0, hi = 2;
  for (let i = 0; i < 80; i++) { const mid = (lo + hi) / 2; if (out(mid) > target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

// One output pixel along a path: "reference" or a VARIANTS key.
function ownHidden(img, net, x, y, ar) {
  const nh = NOTE_CASE.hidden, n0 = NOTE_CASE.ownFeatures, i = y * img.w + x;
  const x0 = [...at(img, x, y).map(lg), ...img.extra.subarray(i * (n0 - 3), (i + 1) * (n0 - 3))];
  return linear(net.W1, net.b1, x0, nh, n0, ar).map((u) => Math.max(u, 0));
}

export function filterPixel(img, net, x, y, path) {
  const v = VARIANTS[path], ref = path === "reference", nh = NOTE_CASE.hidden;
  const hidden = ownHidden(img, net, x, y, ref ? "exact" : v.hidden);
  const taps = [];
  for (let k = 0; k < 25; k++) taps.push(at(img, x + (k % 5) - 2, y + Math.floor(k / 5) - 2));
  const tapL = taps.map((t) => lg(f(f(f(t[0] + t[1]) + t[2]) / 3)));
  const z = linear(net.Wh, net.bh, [...hidden, ...tapL], 25, nh + 25, ref ? "exact" : v.head);
  return { ...applyKernel(z, taps, !ref), z, taps };
}

// raw-native's parity statistics over a set of (out, ref) value pairs.
function stats(pairs, where) {
  let max = 0, sum = 0, n = 0, over = 0, maxAt = null;
  for (let p = 0; p < pairs.length; p++) {
    let worst = 0;
    for (let c = 0; c < 3; c++) { const d = Math.abs(pairs[p].out[c] - pairs[p].ref[c]); sum += d; n++; worst = Math.max(worst, d); if (d > max || Number.isNaN(d)) { max = Number.isNaN(d) ? 1e30 : d; maxAt = where[p]; } }
    if (worst > PARITY.bound) over++;
  }
  return { maxAbs: max, meanAbs: n ? sum / n : 0, values: n, pixelsOver: over, maxAt, bound: PARITY.bound, within: max <= PARITY.bound };
}

// Every pixel of the image along `path` against the reference.
export function scoreImage(img, net, path) {
  const pairs = [], where = [], outs = new Float64Array(img.w * img.h);
  for (let y = 0; y < img.h; y++) for (let x = 0; x < img.w; x++) {
    const ref = filterPixel(img, net, x, y, "reference").out, out = filterPixel(img, net, x, y, path).out;
    pairs.push({ out, ref }); where.push({ x, y, pixel: y * img.w + x });
    outs[y * img.w + x] = Math.max(...out.map((v, c) => Math.abs(v - ref[c])));
  }
  return { path, ...stats(pairs, where), errorMap: outs };
}

// The firefly's own pixel along `path`, with the linear prediction of the
// error: dout_c = sum_k w_k (v_kc - out_c) dz_k, dz in the bounded-logit space.
export function scoreFirefly(img, net, path) {
  const { x, y } = img.firefly, R = filterPixel(img, net, x, y, "reference"), P = filterPixel(img, net, x, y, path), ff = 12;
  const err = P.out.map((v, c) => Math.abs(v - R.out[c])), dz = P.hz.map((v, k) => v - R.hz[k]);
  const pred = [0, 1, 2].map((c) => R.weights.reduce((s, w, k) => s + w * (R.taps[k][c] - R.out[c]) * dz[k], 0));
  const sens = [0, 1, 2].map((c) => R.weights[ff] * (R.taps[ff][c] - R.out[c]));
  return { path, x, y, ref: R.out, out: P.out, maxAbs: Math.max(...err), bound: PARITY.bound, within: Math.max(...err) <= PARITY.bound, fireflyWeight: R.weights[ff], fireflyValue: R.taps[ff][0],
    sensitivity: Math.max(...sens.map(Math.abs)), dzFirefly: dz[ff], maxAbsDz: Math.max(...dz.map(Math.abs)), predicted: Math.max(...pred.map(Math.abs)) };
}

// Many seeded cases at the firefly pixel (each seed: its own image and net).
export function sweep(seeds, paths = Object.keys(VARIANTS), firefly = true) {
  const rows = Object.fromEntries(paths.map((p) => [p, []])), refs = [];
  for (const s of seeds) {
    const img = makeImage(s, { firefly }), net = makeNet(s, firefly ? img : makeImage(s));
    for (const p of paths) rows[p].push(scoreFirefly(img, net, p).maxAbs);
    refs.push(filterPixel(img, net, img.firefly.x, img.firefly.y, "reference").out[0]);
  }
  const summ = (a) => { const s = [...a].sort((u, v) => u - v); return { n: s.length, min: s[0], median: s[Math.floor(s.length / 2)], max: s[s.length - 1], over: a.filter((v) => v > PARITY.bound).length, bound: PARITY.bound }; };
  return { firefly, perPath: Object.fromEntries(paths.map((p) => [p, summ(rows[p])])), referenceValue: (({ over, bound, ...r }) => r)(summ(refs)) };
}
