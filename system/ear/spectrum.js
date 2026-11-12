// spectrum.js: the ear's frequency analysis. Pure functions over PCM (Float32Array or Float64Array), Node and browser.
//   mono, decimate      channel sum, and sample-rate reduction behind a low-pass
//   powerFrames         short-time Fourier transform (STFT): the signal cut into overlapping windows, each one
//                       turned into power per frequency bin
//   peaks               the partials in one frame: local maxima with their frequency refined between bins
//   averageSpectrum     long-term average power spectrum (Welch's method: the mean of many windowed frames)
//   octaveBands         that spectrum summed into octave bands, in dB relative to the whole
import { fft } from '../../world/sound/sound/dsp.js';

export const db = (p) => 10 * Math.log10(Math.max(p, 1e-20));
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const ftom = (f) => 69 + 12 * Math.log2(f / 440);

export function mono(channels) {
  if (channels.length === 1) return channels[0];
  const n = channels[0].length, out = new Float32Array(n), k = 1 / channels.length;
  for (const c of channels) for (let i = 0; i < n; i++) out[i] += c[i] * k;
  return out;
}

// Keep one sample in `factor` after a windowed-sinc low-pass at 0.45 of the new sample rate.
export function decimate(x, factor, taps = 48) {
  if (factor <= 1) return x;
  const h = new Float64Array(2 * taps + 1), fc = 0.45 / factor; let sum = 0;
  for (let i = -taps; i <= taps; i++) { const w = 0.5 + 0.5 * Math.cos(Math.PI * i / (taps + 1)), s = i === 0 ? 2 * fc : Math.sin(2 * Math.PI * fc * i) / (Math.PI * i); h[i + taps] = s * w; sum += s * w; }
  for (let i = 0; i < h.length; i++) h[i] /= sum;
  const n = Math.floor(x.length / factor), out = new Float32Array(n);
  for (let j = 0; j < n; j++) { const c = j * factor; let s = 0; for (let i = -taps; i <= taps; i++) { const k = c + i; if (k >= 0 && k < x.length) s += x[k] * h[i + taps]; } out[j] = s; }
  return out;
}

const hannCache = new Map();
export function hann(n) { if (!hannCache.has(n)) { const w = new Float64Array(n); for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n); hannCache.set(n, w); } return hannCache.get(n); }

// Power per bin for each frame. A sine of amplitude A reads A squared at its bin (the Hann window's gain of one half is divided out), so levels compare across window sizes.
export function powerFrames(x, sr, { n = 4096, hop = 1024 } = {}) {
  const w = hann(n), frames = [], re = new Float64Array(n), im = new Float64Array(n), norm = 16 / (n * n);
  for (let s = 0; s + n <= x.length; s += hop) {
    for (let i = 0; i < n; i++) { re[i] = x[s + i] * w[i]; im[i] = 0; }
    fft(re, im);
    const p = new Float32Array(n / 2); for (let b = 0; b < n / 2; b++) p[b] = (re[b] * re[b] + im[b] * im[b]) * norm;
    frames.push(p);
  }
  return { frames, binHz: sr / n, hopSec: hop / sr, winSec: n / sr };
}

// Partials of one power frame, strongest first: [{ f, a }] with a as linear amplitude. Frequency comes from a parabola
// through the log power of the peak bin and its two neighbours, which places a steady sine within a few cents.
export function peaks(p, binHz, { max = 20, floorDb = -60, fmin = 30, fmax = Infinity } = {}) {
  let top = 0; for (let b = 1; b < p.length; b++) if (p[b] > top) top = p[b];
  const floor = top * Math.pow(10, floorDb / 10), out = [], lo = Math.max(2, Math.floor(fmin / binHz)), hi = Math.min(p.length - 2, Math.ceil(fmax / binHz));
  for (let b = lo; b <= hi; b++) {
    if (p[b] < floor || p[b] <= p[b - 1] || p[b] < p[b + 1]) continue;
    const a = Math.log(p[b - 1] + 1e-30), c = Math.log(p[b] + 1e-30), d = Math.log(p[b + 1] + 1e-30), den = a - 2 * c + d, off = den ? 0.5 * (a - d) / den : 0;
    out.push({ f: (b + off) * binHz, a: Math.sqrt(Math.exp(c - 0.25 * (a - d) * off)) });
  }
  out.sort((u, v) => v.a - u.a); return out.slice(0, max);
}

// Long-term average power spectrum of one or more channels (their powers are averaged, so stereo phase does not matter).
export function averageSpectrum(channels, sr, { n = 8192 } = {}) {
  const acc = new Float64Array(n / 2); let count = 0;
  for (const c of channels) { const { frames } = powerFrames(c, sr, { n, hop: n / 2 }); for (const f of frames) { for (let b = 0; b < acc.length; b++) acc[b] += f[b]; count++; } }
  if (count) for (let b = 0; b < acc.length; b++) acc[b] /= count;
  return { power: acc, binHz: sr / n };
}

export const OCTAVES = [31.5, 63, 125, 250, 500, 1000, 2000, 4000, 8000, 16000];

// Power between two frequencies, with the bins at the edges counted in proportion.
export function bandPower(spec, f0, f1) {
  const { power, binHz } = spec; let s = 0;
  const a = f0 / binHz, b = Math.min(f1 / binHz, power.length - 1);
  for (let k = Math.max(1, Math.floor(a)); k <= Math.floor(b); k++) { const lo = Math.max(a, k - 0.5), hi = Math.min(b, k + 0.5); if (hi > lo) s += power[k] * (hi - lo); }
  return s;
}

// Octave-band levels in dB relative to the total over all ten bands, so the numbers describe the shape and not the volume.
export function octaveBands(spec, centers = OCTAVES) {
  const p = centers.map((c) => bandPower(spec, c / Math.SQRT2, c * Math.SQRT2)), total = p.reduce((a, b) => a + b, 0) || 1e-20;
  return { centers, db: p.map((v) => db(v / total)), totalDb: db(total) };
}

// Least-squares slope of band level against octave number, in dB per octave. Pink noise reads 0, white noise +3.
export function slopePerOctave(bands, from = 63, to = 8000) {
  const pts = bands.centers.map((c, i) => [Math.log2(c), bands.db[i]]).filter((_, i) => bands.centers[i] >= from && bands.centers[i] <= to);
  const mx = pts.reduce((s, q) => s + q[0], 0) / pts.length, my = pts.reduce((s, q) => s + q[1], 0) / pts.length;
  return pts.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0) / pts.reduce((s, q) => s + (q[0] - mx) ** 2, 0);
}
