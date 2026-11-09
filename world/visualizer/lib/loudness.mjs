// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// loudness.mjs: ITU-R BS.1770-4 loudness. K-weighting (a high shelf and a high pass) designed for any sample rate
// with the bilinear-transform formulas that reproduce the standard's 48 kHz coefficients; momentary (400 ms) and
// short-term (3 s) loudness at a chosen hop; integrated loudness with the absolute (-70 LUFS) and relative (-10 LU)
// gates over 400 ms blocks at 75% overlap. Channel weights are 1 (left, right, mono); surround weights are not used.
//
//   kWeight(x, rate) -> Float64Array          filtered copy of one channel
//   loudness({ rate, channels }, { hop })      -> { momentary: Float32Array, shortTerm: Float32Array, integrated, hop }
//                                                 momentary[i] and shortTerm[i] end at sample (i + 1) * hop

const SHELF = { G: 3.999843853973347, Q: 0.7071752369554196, fc: 1681.974450955533 };
const HIPASS = { Q: 0.5003270373238773, fc: 38.13547087602444 };

export function kCoefficients(rate) {
  let K = Math.tan(Math.PI * SHELF.fc / rate);
  const Vh = 10 ** (SHELF.G / 20), Vb = Vh ** 0.4996667741545416, a0 = 1 + K / SHELF.Q + K * K;
  const shelf = { b: [(Vh + Vb * K / SHELF.Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / SHELF.Q + K * K) / a0], a: [2 * (K * K - 1) / a0, (1 - K / SHELF.Q + K * K) / a0] };
  K = Math.tan(Math.PI * HIPASS.fc / rate);
  const d = 1 + K / HIPASS.Q + K * K;
  const hp = { b: [1, -2, 1], a: [2 * (K * K - 1) / d, (1 - K / HIPASS.Q + K * K) / d] };
  return { shelf, hp };
}

function biquad(x, { b, a }) {
  const y = new Float64Array(x.length); let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b[0] * x[i] + b[1] * x1 + b[2] * x2 - a[0] * y1 - a[1] * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
export function kWeight(x, rate) { const c = kCoefficients(rate); return biquad(biquad(x, c.shelf), c.hp); }

const LUFS = ms => (ms > 0 ? -0.691 + 10 * Math.log10(ms) : -Infinity);

export function loudness({ rate, channels }, { hop = Math.round(rate / 100) } = {}) {
  const n = channels[0].length, sq = new Float64Array(n);
  for (const c of channels) { const y = kWeight(c, rate); for (let i = 0; i < n; i++) sq[i] += y[i] * y[i]; }
  const cum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) cum[i + 1] = cum[i] + sq[i];
  const meanSq = (end, len) => { const a = Math.max(0, end - len); return (cum[end] - cum[a]) / len; };
  const frames = Math.floor(n / hop), M = Math.round(0.4 * rate), S = Math.round(3 * rate);
  const momentary = new Float32Array(frames), shortTerm = new Float32Array(frames);
  for (let i = 0; i < frames; i++) { const end = (i + 1) * hop; momentary[i] = LUFS(meanSq(end, M)); shortTerm[i] = LUFS(meanSq(end, S)); }
  // integrated: 400 ms blocks every 100 ms
  const step = Math.round(0.1 * rate), blocks = [];
  for (let end = M; end <= n; end += step) blocks.push(meanSq(end, M));
  const above = blocks.filter(z => LUFS(z) > -70);
  let integrated = -Infinity;
  if (above.length) {
    const rel = LUFS(above.reduce((s, z) => s + z, 0) / above.length) - 10;
    const kept = above.filter(z => LUFS(z) > rel);
    if (kept.length) integrated = LUFS(kept.reduce((s, z) => s + z, 0) / kept.length);
  }
  return { momentary, shortTerm, integrated, hop };
}
