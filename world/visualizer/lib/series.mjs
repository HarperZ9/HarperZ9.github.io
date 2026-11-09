// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// series.mjs: the data front end. A data series is read into the same feature schema as audio, so every scene,
// drive and HUD that plays music plays data without a branch. One observation is one beat.
//
//   analyseSeries(values, { labels, unit, name, duration, fps }) -> features (schema vis.features/1, kind 'series')
//     beats       the time of each observation (duration / n apart)
//     tempo       observations per minute of playback
//     meter       the dominant cycle in observations, from the autocorrelation of the detrended series
//                 (lags 2 to n/4, so four cycles at least); beatsPerBar is that cycle when its autocorrelation is
//                 above 0.4, else 4 with identified false. (A first version took n/3 and 0.3, and called a 28-year
//                 'cycle' in 111 years of inflation at r = 0.31; that is a pattern four times over at most, not a cycle.) Annual price data has no fixed cycle; a monthly series would show 12.
//     onsets      change points: observations whose step is above 2 robust standard deviations of all steps
//     series      per frame, by monotone cubic interpolation between observations:
//                   value (0..1 over the range), raw (the value in its unit), flux (the absolute step, 0..1),
//                   six 'bands' as multi-scale detail: the absolute difference of Gaussian smoothings at 1, 2, 4,
//                   8, 16 and 32 observations, in dB of the range (air is the finest, sub the coarsest), so the
//                   same band drives a fast tremor or a slow swell as they do for sound
//                   rms, lufsM and lufsS carry the level in dB of the range so loudness drives still move
//     labels      one label per observation (a year), read by the HUD
import { median } from './features.mjs';

const BAND_SCALES = { air: 1, presence: 2, mid: 4, lowmid: 8, low: 16, sub: 32 };

function gaussSmooth(y, s) {
  if (s <= 0) return Float64Array.from(y);
  const r = Math.ceil(3 * s), w = Array.from({ length: 2 * r + 1 }, (_, k) => Math.exp(-0.5 * ((k - r) / s) ** 2)), out = new Float64Array(y.length);
  for (let i = 0; i < y.length; i++) { let a = 0, c = 0; for (let k = -r; k <= r; k++) { const j = Math.min(y.length - 1, Math.max(0, i + k)); a += w[k + r] * y[j]; c += w[k + r]; } out[i] = a / c; }
  return out;
}

// Fritsch-Carlson monotone cubic: no overshoot between observations, so a plotted line never invents a peak.
function monotone(y) {
  const n = y.length, d = new Float64Array(n - 1), m = new Float64Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = y[i + 1] - y[i];
  m[0] = d[0]; m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; }
    const a = m[i] / d[i], b = m[i + 1] / d[i], h = a * a + b * b;
    if (h > 9) { const t = 3 / Math.sqrt(h); m[i] = t * a * d[i]; m[i + 1] = t * b * d[i]; }
  }
  return u => {
    const i = Math.max(0, Math.min(n - 2, Math.floor(u))), t = Math.max(0, Math.min(1, u - i)), t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * m[i + 1];
  };
}

export function analyseSeries(values, { labels = null, unit = '', name = '', duration = 24, fps = 100, lead = 0.5 } = {}) {
  const y = Float64Array.from(values), n = y.length;
  if (n < 4) throw new Error('analyseSeries: needs at least four observations');
  const lo = Math.min(...y), hi = Math.max(...y), range = hi - lo || 1, step = (duration - 2 * lead) / (n - 1);
  const beats = Array.from({ length: n }, (_, i) => lead + i * step), frames = Math.round(duration * fps);
  const steps = Array.from({ length: n - 1 }, (_, i) => y[i + 1] - y[i]);
  const mad = median(steps.map(s => Math.abs(s - median(steps)))) * 1.4826 || 1e-9;
  const onsets = beats.filter((_, i) => i > 0 && Math.abs(steps[i - 1] - median(steps)) > 2 * mad);
  // detrended autocorrelation for the cycle
  const trend = gaussSmooth(y, Math.max(2, n / 12)), r = Float64Array.from(y, (v, i) => v - trend[i]);
  const rm = r.reduce((a, b) => a + b, 0) / n, v0 = r.reduce((a, b) => a + (b - rm) ** 2, 0) / n || 1;
  let cycle = 0, best = 0; const ac = {};
  for (let l = 2; l <= Math.floor(n / 4); l++) { let s = 0; for (let i = l; i < n; i++) s += (r[i] - rm) * (r[i - l] - rm); const a = s / (n - l) / v0; ac[l] = +a.toFixed(3); if (a > best) { best = a; cycle = l; } }
  const identified = best > 0.4;   // and, from the lag range, at least four full cycles in the data
  const beatsPerBar = identified ? cycle : 4;
  const curve = monotone(y), absStep = monotone(Float64Array.from({ length: n }, (_, i) => (i ? Math.abs(steps[i - 1]) : 0)));
  const maxStep = Math.max(...steps.map(Math.abs)) || 1;
  const detail = Object.fromEntries(Object.entries(BAND_SCALES).map(([k, s]) => { const a = gaussSmooth(y, s / 2), b = gaussSmooth(y, s); return [k, monotone(Float64Array.from(a, (v, i) => Math.abs(v - b[i])))]; }));
  const S = { value: new Float32Array(frames), raw: new Float32Array(frames), flux: new Float32Array(frames), rms: new Float32Array(frames), lufsM: new Float32Array(frames), lufsS: new Float32Array(frames), centroid: new Float32Array(frames), flatness: new Float32Array(frames) };
  for (const k of Object.keys(BAND_SCALES)) S[k] = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    const u = Math.max(0, Math.min(n - 1, (f / fps - lead) / step)), v = curve(u);
    S.raw[f] = v; S.value[f] = (v - lo) / range; S.flux[f] = Math.min(1.5, absStep(u) / maxStep);
    const dB = x => Math.max(-90, 20 * Math.log10(Math.max(1e-6, x / range)));
    for (const k of Object.keys(BAND_SCALES)) S[k][f] = dB(detail[k](u));
    S.rms[f] = dB(Math.max(1e-6, v - lo)); S.lufsM[f] = -40 + 32 * S.value[f]; S.lufsS[f] = S.lufsM[f];
    S.centroid[f] = 200 + 7800 * S.value[f]; S.flatness[f] = S.flux[f];
  }
  // smooth the short-term level over 3 observations, as the 3 s window does for sound
  const k = Math.max(1, Math.round(3 * step * fps)); const cs = new Float64Array(frames + 1);
  for (let f = 0; f < frames; f++) cs[f + 1] = cs[f] + S.lufsM[f];
  for (let f = 0; f < frames; f++) S.lufsS[f] = (cs[f + 1] - cs[Math.max(0, f + 1 - k)]) / Math.min(k, f + 1);
  const phase = identified ? (() => { let bp = 0, bv = -Infinity; for (let p = 0; p < cycle; p++) { let s = 0, c = 0; for (let i = p; i < n; i += cycle) { s += r[i]; c++; } if (s / c > bv) { bv = s / c; bp = p; } } return bp; })() : 0;
  return {
    schema: 'vis.features/1', kind: 'series', name, unit, fps, n: frames, duration, series: S, onsets, beats,
    downbeats: beats.filter((_, i) => i % beatsPerBar === phase),
    tempo: { bpm: 60 / step, period: step, candidates: [] },
    meter: { beatsPerBar, phase, identified, confidence: identified ? +best.toFixed(3) : 0, evidence: { autocorr: ac, cycle, best: +best.toFixed(3) } },
    lufsI: -40 + 32 * (median(Array.from(y)) - lo) / range,
    labels: labels ?? Array.from({ length: n }, (_, i) => String(i)), values: Array.from(y), range: [lo, hi],
  };
}
