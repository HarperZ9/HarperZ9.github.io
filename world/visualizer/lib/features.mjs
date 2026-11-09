// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// features.mjs: the audio front end. One pass turns a sample buffer into the features the scene graph reads.
//
//   analyse({ rate, channels }, opts) -> features (schema vis.features/1)
//     fps           feature frames per second (100 by default; hop = round(rate / fps))
//     series        per frame: flux (onset strength, 0..1), rms (dBFS), centroid (Hz), flatness (0..1),
//                   six bands in dBFS (sub 20-60, low 60-250, lowmid 250-500, mid 500-2k, presence 2k-6k,
//                   air 6k-16k), lufsM and lufsS (BS.1770 momentary and short-term)
//     onsets        seconds, from adaptive peak picking on flux
//     tempo         { bpm, period, candidates } from the onset autocorrelation under a log-Gaussian prior, with
//                   the duple and triple harmonic sums of Ellis (2007) so the beat level is chosen, not guessed
//     beats         seconds, dynamic-programming tracker (Ellis 2007), tightness 100
//     meter         { beatsPerBar 3 | 4, confidence, phase, evidence } from three readings of the beat series:
//                   accent contrast, bar-lag self-similarity of beat-synchronous spectra, and bar-lag onset
//                   periodicity (see meter.mjs)
//     downbeats     seconds
//     lufsI         integrated loudness, LUFS
//     spec          48 log-spaced bands, 30 Hz to 16 kHz, dB per frame (the HUD spectrum); series.peakHz and
//                   series.peakDb hold the strongest bin from 40 Hz to 2 kHz, parabolic-interpolated
//
// Method notes. Flux is SuperFlux-like: log-compressed power in a log-spaced filterbank (12 bands per octave,
// 30 Hz to 16 kHz, merged where a band is narrower than one bin), positive change against the maximum of the
// three neighbouring bands two frames back, which ignores vibrato and slow swells. Everything is deterministic.
import { makeFFT } from './fft.mjs';
import { mono } from './wav.mjs';
import { loudness } from './loudness.mjs';
import { inferMeter } from './meter.mjs';

export const SCHEMA = 'vis.features/1';
export const BANDS = Object.freeze({ sub: [20, 60], low: [60, 250], lowmid: [250, 500], mid: [500, 2000], presence: [2000, 6000], air: [6000, 16000] });
export const DEFAULTS = Object.freeze({ fps: 100, minBpm: 40, maxBpm: 240, priorBpm: 120, priorOctaves: 1.4, tightness: 100, gamma: 1000 });

function filterbank(nBins, rate, n, { lo = 30, hi = 16000, perOctave = 12 } = {}) {
  const top = Math.min(hi, rate / 2 * 0.98), edges = [];
  for (let f = lo; f <= top; f *= 2 ** (1 / perOctave)) edges.push(Math.round(f * n / rate));
  const bands = [];
  for (let i = 0; i + 2 < edges.length; i++) {
    const a = edges[i], c = edges[i + 1], b = edges[i + 2];
    if (bands.length && c <= bands[bands.length - 1].c) continue;  // merge bands narrower than a bin
    bands.push({ a, c: Math.max(c, a + 1), b: Math.max(b, c + 1) });
  }
  return bands;
}

export function analyse(audio, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, rate = audio.rate, x = mono(audio);
  const hop = Math.round(rate / o.fps), fps = rate / hop;
  const n = 2 ** Math.round(Math.log2(0.046 * rate)), F = makeFFT(n), nb = n / 2 + 1, half = n >> 1;
  const frames = Math.max(1, Math.floor(x.length / hop));
  const fb = filterbank(nb, rate, n);
  const bandBins = Object.fromEntries(Object.entries(BANDS).map(([k, [a, b]]) => [k, [Math.max(1, Math.round(a * n / rate)), Math.min(nb - 1, Math.round(b * n / rate))]]));
  const S = { flux: new Float32Array(frames), rms: new Float32Array(frames), centroid: new Float32Array(frames), flatness: new Float32Array(frames), peakHz: new Float32Array(frames), peakDb: new Float32Array(frames) };
  // 48 log-spaced bands from 30 Hz to 16 kHz for the HUD spectrum (dB), kept compact on purpose
  const SPEC_N = 48, specEdges = Array.from({ length: SPEC_N + 1 }, (_, i) => Math.max(1, Math.round(30 * (Math.min(16000, rate / 2 * 0.98) / 30) ** (i / SPEC_N) * n / rate)));
  const spec = new Float32Array(frames * SPEC_N);
  const pk0 = Math.max(2, Math.round(40 * n / rate)), pk1 = Math.min(nb - 2, Math.round(2000 * n / rate));
  for (const k of Object.keys(BANDS)) S[k] = new Float32Array(frames);
  const logBands = Array.from({ length: 3 }, () => new Float32Array(fb.length));  // ring of the last three frames
  const chroma = new Float32Array(frames * 12), P = new Float64Array(nb), pad = new Float32Array(x.length + n);
  pad.set(x, half);
  const fl0 = Math.round(100 * n / rate), fl1 = Math.min(nb - 1, Math.round(10000 * n / rate));
  const pcOf = new Int8Array(nb).fill(-1);
  for (let k = 1; k < nb; k++) { const f = k * rate / n; if (f >= 55 && f <= 2000) pcOf[k] = ((Math.round(12 * Math.log2(f / 440)) % 12) + 12 + 9) % 12; }
  for (let t = 0; t < frames; t++) {
    F.power(pad, P, t * hop);
    let tot = 0, cen = 0, lg = 0, ar = 0;
    for (let k = 1; k < nb; k++) { tot += P[k]; cen += P[k] * k * rate / n; }
    for (let k = fl0; k <= fl1; k++) { lg += Math.log(P[k] + 1e-20); ar += P[k]; }
    S.rms[t] = 10 * Math.log10(tot + 1e-12);
    S.centroid[t] = tot > 1e-10 ? cen / tot : 0;
    S.flatness[t] = ar > 1e-12 ? Math.exp(lg / (fl1 - fl0 + 1)) / (ar / (fl1 - fl0 + 1)) : 1;
    for (const [k, [a, b]] of Object.entries(bandBins)) { let s = 0; for (let j = a; j <= b; j++) s += P[j]; S[k][t] = Math.max(-120, 10 * Math.log10(s + 1e-12)); }
    for (let k = 1; k < nb; k++) if (pcOf[k] >= 0) chroma[t * 12 + pcOf[k]] += Math.sqrt(P[k]);
    for (let b = 0; b < SPEC_N; b++) { let s2 = 0; for (let j = specEdges[b]; j < Math.max(specEdges[b] + 1, specEdges[b + 1]); j++) s2 += P[j]; spec[t * SPEC_N + b] = Math.max(-120, 10 * Math.log10(s2 + 1e-12)); }
    // spectral peak, 40 Hz to 2 kHz, parabolic interpolation on log power: the HUD's dB | Hz | note readout
    let kp = pk0; for (let k = pk0; k <= pk1; k++) if (P[k] > P[kp]) kp = k;
    const la = Math.log(P[kp - 1] + 1e-20), lb = Math.log(P[kp] + 1e-20), lc = Math.log(P[kp + 1] + 1e-20), dd = la - 2 * lb + lc;
    const off = Math.abs(dd) > 1e-12 ? Math.max(-0.5, Math.min(0.5, 0.5 * (la - lc) / dd)) : 0;
    S.peakHz[t] = (kp + off) * rate / n; S.peakDb[t] = Math.max(-120, 10 * Math.log10(P[kp] + 1e-12));
    const cur = logBands[t % 3], back = logBands[(t + 1) % 3];  // back = two frames ago
    for (let i = 0; i < fb.length; i++) {
      const { a, c, b } = fb[i]; let s = 0;
      for (let j = a; j < b && j < nb; j++) s += Math.sqrt(P[j]) * (j <= c ? (j - a + 1) / (c - a + 1) : (b - j) / (b - c));
      cur[i] = Math.log1p(o.gamma * s);
    }
    if (t >= 2) {
      let f = 0;
      for (let i = 0; i < fb.length; i++) { const m = Math.max(back[i], back[Math.max(0, i - 1)], back[Math.min(fb.length - 1, i + 1)]); const d = cur[i] - m; if (d > 0) f += d; }
      S.flux[t] = f;
    }
  }
  // normalise flux to its 99.5th percentile so thresholds mean the same thing on any track
  const sorted = Float32Array.from(S.flux).sort(), ref = sorted[Math.floor(0.995 * (sorted.length - 1))] || 1;
  for (let t = 0; t < frames; t++) S.flux[t] = Math.min(1.5, S.flux[t] / ref);

  const onsets = pickOnsets(S.flux, fps);
  const tempo = estimateTempo(S.flux, fps, o);
  let beats = trackBeats(S.flux, fps, tempo.period * fps, o.tightness);
  // Beat level: when every other tracked beat is much weaker, the tracker found a subdivision (an off-beat hat
  // under a slower pulse). Move up one level and track again (see levelCheck).
  const lv = levelCheck(S.flux, fps, beats, tempo.bpm, o);
  tempo.level = lv;
  if (lv.halve) { tempo.bpm /= 2; tempo.period *= 2; beats = trackBeats(S.flux, fps, tempo.period * fps, o.tightness); }
  const L = loudness(audio, { hop });
  S.lufsM = fit(L.momentary, frames); S.lufsS = fit(L.shortTerm, frames);
  const meter = inferMeter({ flux: S.flux, low: S.low, sub: S.sub, chroma, fps, beats, period: tempo.period });
  // A level fallback (re-track at a 3:2 or 2:1 related tempo candidate when the bar is not identified) was tried
  // and removed on 2026-10-24: on the synthetic sweep it moved 11 of 50 correct tempos to a wrong level, and on the
  // 26 s 3/4 reference clip it still did not identify the bar. An unidentified bar is reported as such.
  const downbeats = beats.filter((_, i) => i % meter.beatsPerBar === meter.phase);
  return { schema: SCHEMA, kind: 'audio', rate, hop, fps, n: frames, duration: x.length / rate, series: S, onsets, tempo, beats, meter, downbeats, lufsI: L.integrated, chroma, spec: { bands: SPEC_N, lo: 30, hi: Math.min(16000, rate / 2 * 0.98), data: spec } };
}

// Parity test on the tracked beats: onset support (flux maximum within 20 ms) on even against odd beats. A ratio
// above `ratio` (1.8 by default) with the slower level still at or above `minBpm` (55) means the slower level is
// the beat. Returns the evidence either way, so the decision can be read and checked.
export function levelCheck(flux, fps, beats, bpm, { levelRatio = 1.8, levelMinBpm = 55 } = {}) {
  if (beats.length < 8) return { halve: false, ratio: 1 };
  const s = beats.map(t => { const a = Math.round(t * fps); let m = 0; for (let k = a - 2; k <= a + 2; k++) if (k >= 0 && k < flux.length) m = Math.max(m, flux[k]); return m; });
  const mean = a => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
  const even = mean(s.filter((_, i) => i % 2 === 0)), odd = mean(s.filter((_, i) => i % 2 === 1));
  const ratio = Math.max(even, odd) / Math.max(1e-9, Math.min(even, odd));
  return { halve: ratio > levelRatio && bpm / 2 >= levelMinBpm, ratio: +ratio.toFixed(3), strong: even >= odd ? 'even' : 'odd' };
}

function fit(a, n) { const o = new Float32Array(n); for (let i = 0; i < n; i++) { const v = a[Math.min(a.length - 1, i)]; o[i] = Number.isFinite(v) ? Math.max(-90, v) : -90; } return o; }

// Adaptive peak picking (librosa-style windows): a local maximum within +-30 ms, above the mean of the preceding
// 100 ms and following 70 ms by delta, at least 30 ms after the previous onset.
export function pickOnsets(env, fps, { delta = 0.07, pre = 0.03, post = 0.03, preAvg = 0.1, postAvg = 0.07, wait = 0.03 } = {}) {
  const out = [], W = s => Math.max(1, Math.round(s * fps));
  const a = W(pre), b = W(post), c = W(preAvg), d = W(postAvg), w = W(wait);
  let last = -Infinity;
  for (let t = 1; t < env.length - 1; t++) {
    let mx = -Infinity, mean = 0, cnt = 0;
    for (let k = t - a; k <= t + b; k++) if (k >= 0 && k < env.length) mx = Math.max(mx, env[k]);
    if (env[t] < mx) continue;
    for (let k = t - c; k <= t + d; k++) if (k >= 0 && k < env.length) { mean += env[k]; cnt++; }
    if (env[t] >= mean / cnt + delta && t - last > w) { out.push(t / fps); last = t; }
  }
  return out;
}

function autocorr(env, maxLag) {
  const n = env.length; let m = 0; for (const v of env) m += v; m /= n;
  const ac = new Float64Array(maxLag + 1);
  for (let l = 0; l <= maxLag; l++) { let s = 0; for (let t = l; t < n; t++) s += (env[t] - m) * (env[t - l] - m); ac[l] = s / (n - l); }
  return ac;
}

// Tempo: TPS(l) = W(l) * ac(l) with a log-Gaussian W around the prior; TPS2 and TPS3 add the energy at twice and
// three times the lag, and the larger of the two picks the beat level (Ellis 2007, section 3.1).
export function estimateTempo(env, fps, o = DEFAULTS) {
  const lo = Math.floor(fps * 60 / o.maxBpm), hi = Math.ceil(fps * 60 / o.minBpm), ac = autocorr(env, 3 * hi + 2);
  const l0 = fps * 60 / o.priorBpm, W = l => Math.exp(-0.5 * (Math.log2(l / l0) / o.priorOctaves) ** 2);
  const tps = l => (l >= 1 && l < ac.length ? W(l) * Math.max(0, ac[l]) : 0);
  let best = { l: lo, s: -Infinity, kind: 'duple' }; const cand = [];
  for (let l = lo; l <= hi; l++) {
    const s2 = tps(l) + 0.5 * tps(2 * l) + 0.25 * tps(2 * l - 1) + 0.25 * tps(2 * l + 1);
    const s3 = tps(l) + 0.33 * tps(3 * l) + 0.33 * tps(3 * l - 1) + 0.33 * tps(3 * l + 1);
    const s = Math.max(s2, s3);
    cand.push({ l, s, kind: s3 > s2 ? 'triple' : 'duple' });
    if (s > best.s) best = { l, s, kind: s3 > s2 ? 'triple' : 'duple' };
  }
  // parabolic refinement on the raw autocorrelation around the chosen lag
  const l = best.l, y0 = ac[l - 1] ?? ac[l], y1 = ac[l], y2 = ac[l + 1] ?? ac[l], den = y0 - 2 * y1 + y2;
  const lag = l + (Math.abs(den) > 1e-12 ? Math.max(-0.5, Math.min(0.5, 0.5 * (y0 - y2) / den)) : 0);
  const peaks = cand.filter((c, i) => i > 0 && i < cand.length - 1 && c.s >= cand[i - 1].s && c.s >= cand[i + 1].s).sort((a, b) => b.s - a.s).slice(0, 4);
  const top = best.s || 1;
  return { bpm: 60 * fps / lag, period: lag / fps, harmonic: best.kind, candidates: peaks.map(c => ({ bpm: +(60 * fps / c.l).toFixed(2), score: +(c.s / top).toFixed(3), kind: c.kind })) };
}

// Dynamic-programming beat tracker (Ellis 2007): C(t) = O(t) + max over previous beats tau in [t - 2P, t - P/2]
// of C(tau) - tightness * log((t - tau) / P)^2. The last beat is the last local maximum of C whose score is above
// half the median of local maxima; beats with weak onset support at either end are trimmed.
export function trackBeats(env, fps, P, tightness = 100) {
  const n = env.length; if (n < 4 || !(P > 1)) return [];
  let sd = 0, m = 0; for (const v of env) m += v; m /= n; for (const v of env) sd += (v - m) ** 2; sd = Math.sqrt(sd / n) || 1;
  const O = Float64Array.from(env, v => v / sd), C = new Float64Array(n), back = new Int32Array(n).fill(-1);
  const a = Math.round(2 * P), b = Math.max(1, Math.round(P / 2));
  for (let t = 0; t < n; t++) {
    let best = -Infinity, arg = -1;
    for (let tau = t - a; tau <= t - b; tau++) {
      if (tau < 0) continue;
      const s = C[tau] - tightness * Math.log((t - tau) / P) ** 2;
      if (s > best) { best = s; arg = tau; }
    }
    C[t] = O[t] + (arg >= 0 && best > 0 ? best : 0); back[t] = arg >= 0 && best > 0 ? arg : -1;
  }
  const maxima = []; for (let t = 1; t < n - 1; t++) if (C[t] > C[t - 1] && C[t] >= C[t + 1]) maxima.push(t);
  if (!maxima.length) return [];
  const med = maxima.map(t => C[t]).sort((p, q) => p - q)[maxima.length >> 1];
  let end = maxima[maxima.length - 1]; for (let i = maxima.length - 1; i >= 0; i--) if (C[maxima[i]] >= 0.5 * med) { end = maxima[i]; break; }
  const beats = []; for (let t = end; t >= 0; t = back[t]) { beats.push(t); if (back[t] < 0) break; }
  beats.reverse();
  // trim beats at the ends whose local onset support is under half the RMS support of all beats
  const sup = beats.map(t => Math.max(...Array.from({ length: 5 }, (_, k) => O[Math.min(n - 1, Math.max(0, t + k - 2))])));
  const rms = Math.sqrt(sup.reduce((s, v) => s + v * v, 0) / sup.length);
  let i0 = 0, i1 = beats.length - 1; while (i0 < i1 && sup[i0] < 0.5 * rms) i0++; while (i1 > i0 && sup[i1] < 0.5 * rms) i1--;
  return beats.slice(i0, i1 + 1).map(t => t / fps);
}

// Read every series and the clock signals at time t (seconds). Linear interpolation between frames.
export function at(F, t) {
  const p = Math.max(0, Math.min(F.n - 1, t * F.fps)), i = Math.floor(p), f = p - i, j = Math.min(F.n - 1, i + 1), v = {};
  for (const [k, s] of Object.entries(F.series)) v[k] = s[i] + (s[j] - s[i]) * f;
  Object.assign(v, clock(F.beats, t, 'beat'), clock(F.downbeats, t, 'bar'));
  v.onsetAge = since(F.onsets, t);
  v.t = t;
  return v;
}
function since(list, t) { let lo = 0, hi = list.length - 1, k = -1; while (lo <= hi) { const m = (lo + hi) >> 1; if (list[m] <= t) { k = m; lo = m + 1; } else hi = m - 1; } return k < 0 ? Infinity : t - list[k]; }
// Phase within the current interval of a grid (0 on a grid point), its index, and the time since the last point.
// Before the first point and after the last, the median interval extends the grid so phase keeps running.
export function clock(grid, t, name) {
  const out = {}; if (!grid?.length) { out[`${name}Phase`] = 0; out[`${name}Index`] = -1; out[`${name}Age`] = Infinity; return out; }
  const d = grid.length > 1 ? median(grid.slice(1).map((g, i) => g - grid[i])) : 1;
  let k, a, b;
  if (t < grid[0]) { k = Math.floor((t - grid[0]) / d); a = grid[0] + k * d; b = a + d; }
  else if (t >= grid[grid.length - 1]) { const e = Math.floor((t - grid[grid.length - 1]) / d); k = grid.length - 1 + e; a = grid[grid.length - 1] + e * d; b = a + d; }
  else { let lo = 0, hi = grid.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (grid[m] <= t) lo = m; else hi = m; } k = lo; a = grid[lo]; b = grid[hi]; }
  out[`${name}Phase`] = (t - a) / (b - a); out[`${name}Index`] = k; out[`${name}Age`] = t - a; out[`${name}Period`] = b - a;
  return out;
}
export const median = a => { const s = [...a].sort((p, q) => p - q); return s.length ? s[s.length >> 1] : NaN; };
