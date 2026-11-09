// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// fft.mjs: in-place iterative radix-2 complex FFT and a power-spectrum helper for real frames.
//   const F = makeFFT(2048); F.power(frame) -> Float64Array(1025): the one-sided power of a Hann-windowed real
//   frame, scaled by Parseval so the bins sum to the frame's windowed mean square. A band sum in dB is therefore the
//   RMS level of what lies in the band (a full-scale sine sums to 0.5, -3.01 dB).

export function makeFFT(n) {
  if (n & (n - 1)) throw new Error('makeFFT: n must be a power of two');
  const bits = Math.log2(n), rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(-2 * Math.PI * i / n); sin[i] = Math.sin(-2 * Math.PI * i / n); }
  const win = new Float64Array(n); let w2 = 0;
  for (let i = 0; i < n; i++) { win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); w2 += win[i] * win[i]; }
  const re = new Float64Array(n), im = new Float64Array(n);

  function transform(re, im) {
    for (let i = 0; i < n; i++) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let s = 0; s < n; s += size) for (let k = 0; k < half; k++) {
        const c = cos[k * step], d = sin[k * step], a = s + k, b = a + half;
        const tr = re[b] * c - im[b] * d, ti = re[b] * d + im[b] * c;
        re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
      }
    }
  }
  // one-sided power of a real frame (length n, read from offset `at`), Hann window, Parseval-scaled
  function power(frame, out = new Float64Array(n / 2 + 1), at = 0) {
    for (let i = 0; i < n; i++) { const v = frame[at + i]; re[i] = (v === undefined ? 0 : v) * win[i]; im[i] = 0; }
    transform(re, im);
    const s = 1 / (n * w2);
    for (let k = 0; k <= n / 2; k++) out[k] = (re[k] * re[k] + im[k] * im[k]) * (k === 0 || k === n / 2 ? s : 2 * s);
    return out;
  }
  return { n, transform, power, window: win };
}
