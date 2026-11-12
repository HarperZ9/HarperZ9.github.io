// time.js: when things happen. An onset is the start of a note or a hit; the ear finds onsets as jumps in the spectrum
// (spectral flux), then reads tempo, beat regularity, swing and drift from them.
//   tempo        beats per minute, from the autocorrelation of the onset curve (how well the curve matches itself one beat later)
//   regularity   how far onsets near a beat sit from the beat grid, as a standard deviation in milliseconds
//   swing        where the off-beat eighth note falls inside the beat: 0.50 is straight, 0.667 is a triplet feel
//   drift        how far the tempo of any 16-beat window departs from the tempo of the whole, in percent
import { mono, hann } from './spectrum.js';
import { fft } from '../../world/sound/sound/dsp.js';

// Onset strength every `hop` samples: the summed rise in log magnitude across bins since the previous frame.
export function onsetCurve(x, sr, { n = 1024, hop = 256 } = {}) {
  const w = hann(n), re = new Float64Array(n), im = new Float64Array(n), prev = new Float32Array(n / 2), env = [];
  for (let s = 0; s + n <= x.length; s += hop) {
    for (let i = 0; i < n; i++) { re[i] = x[s + i] * w[i]; im[i] = 0; }
    fft(re, im); let flux = 0;
    for (let b = 1; b < n / 2; b++) { const m = Math.log1p(1000 * Math.hypot(re[b], im[b]) / n), d = m - prev[b]; if (d > 0) flux += d; prev[b] = m; }
    env.push(flux);
  }
  return { env: Float64Array.from(env), fps: sr / hop, lead: n / 2 / sr };
}

// Onset times: peaks of the curve that stand above the local mean by `k` local deviations, at least `gap` seconds apart.
export function onsets(curve, { k = 1.4, gap = 0.05, span = 0.4 } = {}) {
  const { env, fps, lead } = curve, W = Math.round(span * fps), out = [], pre = new Float64Array(env.length + 1), pre2 = new Float64Array(env.length + 1);
  for (let i = 0; i < env.length; i++) { pre[i + 1] = pre[i] + env[i]; pre2[i + 1] = pre2[i] + env[i] * env[i]; }
  let floor = 0; for (const v of env) floor += v; floor = 0.15 * floor / Math.max(1, env.length);
  for (let i = 1; i < env.length - 1; i++) {
    if (env[i] <= env[i - 1] || env[i] < env[i + 1]) continue;
    const a = Math.max(0, i - W), b = Math.min(env.length, i + W), mean = (pre[b] - pre[a]) / (b - a), sd = Math.sqrt(Math.max(0, (pre2[b] - pre2[a]) / (b - a) - mean * mean));
    if (env[i] < mean + k * sd || env[i] < floor) continue;
    const den = env[i - 1] - 2 * env[i] + env[i + 1], off = den ? 0.5 * (env[i - 1] - env[i + 1]) / den : 0, t = (i + off) / fps + lead;
    if (out.length && t - out[out.length - 1].t < gap) { if (env[i] > out[out.length - 1].strength) out[out.length - 1] = { t, strength: env[i] }; continue; }
    out.push({ t, strength: env[i] });
  }
  return out;
}

function autocorr(env, maxLag) {
  let mean = 0; for (const v of env) mean += v; mean /= env.length;
  const ac = new Float64Array(maxLag + 1);
  for (let lag = 0; lag <= maxLag; lag++) { let s = 0; for (let i = 0; i + lag < env.length; i++) s += (env[i] - mean) * (env[i + lag] - mean); ac[lag] = s / (env.length - lag); }
  return ac;
}
const at = (a, x) => { const i = Math.floor(x), f = x - i; return i + 1 < a.length ? a[i] * (1 - f) + a[i + 1] * f : 0; };
function refine(ac, lag, half) { let best = lag, bv = -Infinity; for (let l = Math.max(1, Math.round(lag - half)); l <= Math.min(ac.length - 2, Math.round(lag + half)); l++) if (ac[l] > bv) { bv = ac[l]; best = l; }
  const den = ac[best - 1] - 2 * ac[best] + ac[best + 1]; return best + (den < 0 ? Math.max(-1, Math.min(1, 0.5 * (ac[best - 1] - ac[best + 1]) / den)) : 0); }   // a peak only: the parabola must open downward

// Tempo in BPM. Each candidate beat length is scored by the autocorrelation at one, two and four beats, with a broad
// preference centred on 85 BPM that settles the half-time and double-time readings. `hint` (the score's tempo) narrows the
// search to one octave around it; without a hint the result is the ear's own reading.
export function tempo(curve, { min = 45, max = 200, hint = null } = {}) {
  const { env, fps } = curve, lo = hint ? hint / 1.35 : min, hi = hint ? hint * 1.35 : max, maxLag = Math.min(env.length - 2, Math.ceil(8.2 * 60 / lo * fps)), ac = autocorr(env, maxLag);
  let best = 0, bs = -Infinity;
  for (let lag = 60 / hi * fps; lag <= 60 / lo * fps; lag += 0.25) {
    const bpm = 60 * fps / lag, prior = Math.exp(-0.5 * (Math.log2(bpm / (hint || 85)) / 0.9) ** 2), s = (at(ac, lag) + 0.7 * at(ac, 2 * lag) + 0.5 * at(ac, 4 * lag)) * prior;
    if (s > bs) { bs = s; best = lag; }
  }
  let lag = refine(ac, best, 2); for (const m of [2, 4, 8]) if (m * lag + 3 < maxLag) lag = refine(ac, m * lag, 2) / m;   // longer lags give a finer reading
  return { bpm: 60 * fps / lag, beatSec: lag / fps, strength: ac[0] > 0 ? at(ac, lag) / ac[0] : 0 };
}

// Tempo of each window of `beats` beats, as a percentage difference from the global tempo.
export function drift(curve, beatSec, { beats = 16, step = 4 } = {}) {
  const { env, fps } = curve, W = Math.round(beats * beatSec * fps), H = Math.round(step * beatSec * fps), lag4 = 4 * beatSec * fps, out = [];
  for (let s = 0; s + W <= env.length; s += H) {
    const ac = autocorr(env.subarray(s, s + W), Math.ceil(lag4 * 1.15)), l = refine(ac, lag4, lag4 * 0.1);
    if (ac[Math.round(l)] > 0.2 * ac[0]) out.push({ t: (s + W / 2) / fps, pct: (lag4 / l - 1) * 100 });   // windows with no clear pulse (an introduction, a rest) are left out
  }
  // a real drift lasts: each window is replaced by the median of itself and its two neighbours, so one misread window
  // (a rest, a fill) does not stand for a tempo change
  const raw = out.map((o) => o.pct), p = raw.map((v, i) => { const w = [raw[i - 1] ?? v, v, raw[i + 1] ?? v].sort((a, b) => a - b); return w[1]; });
  return { windows: out, maxPct: p.length ? Math.max(...p.map(Math.abs)) : 0, spanPct: p.length ? Math.max(...p) - Math.min(...p) : 0 };
}

// Beat grid, regularity and swing from the onsets and the beat length.
export function grid(on, beatSec) {
  if (!on.length) return { phase: 0, regularityMs: 0, swing: null, offbeats: 0 };
  let best = 0, bs = -Infinity;   // the phase that gathers the most onset strength within 30 ms of a beat
  for (let k = 0; k < 200; k++) { const ph = k / 200 * beatSec; let s = 0; for (const o of on) { const u = ((o.t - ph) / beatSec % 1 + 1) % 1, d = Math.min(u, 1 - u) * beatSec; if (d < 0.03) s += o.strength * (1 - d / 0.03); } if (s > bs) { bs = s; best = ph; } }
  const onBeat = [], off = [];
  for (const o of on) { const u = ((o.t - best) / beatSec % 1 + 1) % 1, d = (u > 0.5 ? u - 1 : u) * beatSec; if (Math.abs(d) < 0.12 * beatSec) onBeat.push(d); else if (u > 0.4 && u < 0.8) off.push(u); }
  // spread around the beat as a robust standard deviation (1.4826 times the median distance from the median), so a few
  // slow-attack sounds such as a brush sweep do not stand in for the drummer's time
  onBeat.sort((a, b) => a - b); const mean = onBeat.length ? onBeat[onBeat.length >> 1] : 0, dev = onBeat.map((d) => Math.abs(d - mean)).sort((a, b) => a - b), sd = dev.length ? 1.4826 * dev[dev.length >> 1] : 0;
  off.sort((a, b) => a - b);
  return { phase: best + mean, regularityMs: sd * 1000, swing: off.length >= 4 ? off[Math.floor(off.length / 2)] - mean / beatSec : null, offbeats: off.length, onbeats: onBeat.length };
}

export function timing(channels, sr, { bpm = null } = {}) {
  const x = mono(channels), curve = onsetCurve(x, sr), on = onsets(curve), free = tempo(curve), t = bpm ? tempo(curve, { hint: bpm }) : free, g = grid(on, t.beatSec), d = drift(curve, t.beatSec);
  return { bpm: t.bpm, bpmUnhinted: free.bpm, beatSec: t.beatSec, strength: t.strength, regularityMs: g.regularityMs, swing: g.swing, offbeats: g.offbeats,
    driftMaxPct: d.maxPct, driftSpanPct: d.spanPct, driftWindows: d.windows, onsetCount: on.length, onsetsPerSecond: on.length / (x.length / sr), onsets: on };
}
