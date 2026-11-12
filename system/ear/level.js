// level.js: how loud, how peaky, how clean. Loudness follows ITU-R BS.1770-4 (K-weighting, then gated mean square) through
// the site's own meter in world/studio/lib/loudness.mjs; loudness range follows EBU Tech 3342.
//   LUFS   loudness units relative to full scale, the BS.1770 measure of perceived level
//   dBTP   true peak in dB: the peak of the waveform between samples, estimated by 4x oversampling
//   LRA    loudness range in LU: the spread between the quiet and loud parts of a programme
import { integratedLufs, truePeakDb, kWeighting } from '../../world/studio/lib/loudness.mjs';

// K-weighted loudness of sliding windows: [{ t, lufs }], t at the window centre.
export function loudnessCurve(channels, sr, { window = 0.4, hop = 0.1 } = {}) {
  const kw = kWeighting(sr), n = channels[0].length, W = Math.round(window * sr), H = Math.round(hop * sr), sums = new Float64Array(n + 1);
  for (const c of channels) { const y = kw(c); for (let i = 0; i < n; i++) sums[i + 1] += y[i] * y[i]; }
  for (let i = 1; i <= n; i++) sums[i] += sums[i - 1];
  const out = [];
  for (let s = 0; s + W <= n; s += H) { const p = (sums[s + W] - sums[s]) / W; out.push({ t: (s + W / 2) / sr, lufs: p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity }); }
  return out;
}

// EBU Tech 3342: short-term loudness (3 s windows), gated at -70 LUFS absolute and 20 LU under the gated mean, then the
// distance from the 10th to the 95th percentile.
export function loudnessRange(shortTerm) {
  const pow = (l) => Math.pow(10, (l + 0.691) / 10), abs = shortTerm.map((s) => s.lufs).filter((l) => l > -70);
  if (abs.length < 2) return { lra: 0, low: -Infinity, high: -Infinity };
  const rel = -0.691 + 10 * Math.log10(abs.reduce((s, l) => s + pow(l), 0) / abs.length) - 20, v = abs.filter((l) => l > rel).sort((a, b) => a - b);
  const q = (f) => v[Math.min(v.length - 1, Math.max(0, Math.round(f * (v.length - 1))))];
  return { lra: q(0.95) - q(0.1), low: q(0.1), high: q(0.95) };
}

// Clipping: samples at or over 0.999 of full scale, and runs of three or more in a row (a flat top, which a single loud
// sample is not). DC offset: the mean of each channel. Crest factor: peak over RMS in dB.
export function sampleStats(channels) {
  let clipped = 0, runs = 0, peak = 0, sq = 0, count = 0; const dc = [];
  for (const c of channels) {
    let run = 0, mean = 0;
    for (let i = 0; i < c.length; i++) { const x = c[i], a = Math.abs(x); mean += x; sq += x * x; if (a > peak) peak = a;
      if (a >= 0.999) { clipped++; run++; if (run === 3) runs++; } else run = 0; }
    dc.push(mean / Math.max(1, c.length)); count += c.length;
  }
  const rms = Math.sqrt(sq / Math.max(1, count));
  return { clippedSamples: clipped, clippedRuns: runs, peakDb: 20 * Math.log10(peak || 1e-10), rmsDb: 20 * Math.log10(rms || 1e-10), crestDb: 20 * Math.log10((peak || 1e-10) / (rms || 1e-10)), dc, dcMax: Math.max(...dc.map(Math.abs)) };
}

export function level(channels, sr) {
  const momentary = loudnessCurve(channels, sr, { window: 0.4, hop: 0.1 }), shortTerm = loudnessCurve(channels, sr, { window: 3, hop: 1 });
  return { integratedLufs: integratedLufs(channels, sr), truePeakDb: truePeakDb(channels), ...loudnessRange(shortTerm), ...sampleStats(channels), momentary, shortTerm };
}
