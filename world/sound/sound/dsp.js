// Small DSP helpers used by the codec motif and the spectrogram views. Radix-2 FFT and a short-time Fourier transform.
export function fft(re, im, inv = false) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) { let b = n >> 1; for (; j & b; b >>= 1) j ^= b; j ^= b; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
  for (let len = 2; len <= n; len <<= 1) {
    const a = ((inv ? 2 : -2) * Math.PI) / len, wr = Math.cos(a), wi = Math.sin(a);
    for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let k = 0; k < len / 2; k++) { const u = i + k, v = u + len / 2, xr = re[v] * cr - im[v] * ci, xi = re[v] * ci + im[v] * cr; re[v] = re[u] - xr; im[v] = im[u] - xi; re[u] += xr; im[u] += xi; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } }
  }
  if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}


// Magnitudes in dB for each frame: returns { frames: Float32Array[], bins, binHz, hopSec }.
export function stft(x, sr, { n = 2048, hop = 512, floorDb = -120 } = {}) {
  const win = new Float32Array(n); for (let i = 0; i < n; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / n);
  const frames = [];
  for (let s = 0; s + n <= x.length; s += hop) {
    const re = new Float64Array(n), im = new Float64Array(n);
    for (let i = 0; i < n; i++) re[i] = x[s + i] * win[i];
    fft(re, im);
    const m = new Float32Array(n / 2);
    for (let b = 0; b < n / 2; b++) m[b] = Math.max(floorDb, 20 * Math.log10((Math.hypot(re[b], im[b]) / n) * 4 + 1e-12));
    frames.push(m);
  }
  return { frames, bins: n / 2, binHz: sr / n, hopSec: hop / sr };
}
