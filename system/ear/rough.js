// rough.js: sensory roughness, the harmonics lens. Two tones close in frequency beat against each other inside one band of
// the inner ear, and the result sounds rough. Plomp and Levelt measured the effect for pairs of pure tones:
//   R. Plomp and W. J. M. Levelt, "Tonal consonance and critical bandwidth", Journal of the Acoustical Society of
//   America 38 (1965), 548 to 560.
// Sethares fitted their curve with two exponentials and summed it over every pair of partials in a sound:
//   W. A. Sethares, "Local consonance and the relationship between timbre and scale", Journal of the Acoustical Society
//   of America 94 (1993), 1218 to 1228; constants as given in his book Tuning, Timbre, Spectrum, Scale (2nd ed., 2005).
// For partials at f1 < f2 with amplitudes a1, a2:
//   d = min(a1, a2) * (exp(-3.5 s (f2 - f1)) - exp(-5.75 s (f2 - f1))),  s = 0.24 / (0.021 f1 + 19)
// The pair is roughest about a quarter of a critical band apart, and smooth at unison and at wide spacings. The ear here
// reports the sum over pairs divided by the sum of amplitudes, so the number does not rise just because the sound is louder.
// That normalisation is ours; the pair curve is the published one. It is a model of roughness, not of musical taste: a
// dominant seventh is rougher than a triad and still belongs in the music.
import { mono } from './spectrum.js';
import { partialFrames } from './pitch.js';

export function pairRoughness(f1, f2, a1 = 1, a2 = 1) {
  const lo = Math.min(f1, f2), df = Math.abs(f2 - f1), s = 0.24 / (0.021 * lo + 19);
  return Math.min(a1, a2) * (Math.exp(-3.5 * s * df) - Math.exp(-5.75 * s * df));
}

export function frameRoughness(parts) {
  let sum = 0, amp = 0;
  for (let i = 0; i < parts.length; i++) { amp += parts[i].a; for (let j = i + 1; j < parts.length; j++) sum += pairRoughness(parts[i].f, parts[j].f, parts[i].a, parts[j].a); }
  return amp > 0 ? sum / amp : 0;
}

// Roughness over time. spans (bars) are optional; without them the series is per frame only.
export function roughness(channels, sr, spans = null) {
  const pf = partialFrames(mono(channels), sr, { fmin: 60, fmax: 5000, max: 16 });
  const series = pf.frames.map((p, i) => ({ t: i * pf.hopSec + pf.winSec / 2, r: frameRoughness(p), a: p.reduce((s, q) => s + q.a, 0) }));
  const loud = series.filter((s) => s.a > 1e-4), v = loud.map((s) => s.r).sort((a, b) => a - b), q = (f) => (v.length ? v[Math.min(v.length - 1, Math.floor(f * v.length))] : 0);
  const out = { mean: v.reduce((a, b) => a + b, 0) / Math.max(1, v.length), p95: q(0.95), max: v[v.length - 1] ?? 0, series };
  if (spans) out.bars = spans.map((sp) => { const inb = loud.filter((s) => s.t >= sp.t0 && s.t < sp.t1); return { bar: sp.bar, t0: sp.t0, r: inb.reduce((a, s) => a + s.r, 0) / Math.max(1, inb.length) }; });
  return out;
}

// Roughness between layers only: every pair takes one partial from one layer and one from another, so the seconds and
// sevenths inside a single chord voicing do not count. Layers that agree on the harmony read low; a layer in the wrong key
// rubs against the others and reads high. layers: channel arrays of equal length.
export function crossRoughness(layers, sr) {
  const pfs = layers.map((ch) => partialFrames(mono(ch), sr, { fmin: 38, fmax: 4000, max: 10 })), n = Math.min(...pfs.map((p) => p.frames.length)), vals = [];
  for (let f = 0; f < n; f++) { let sum = 0, amp = 0, sounding = 0;
    for (let a = 0; a < pfs.length; a++) { const A = pfs[a].frames[f], sa = A.reduce((s, q) => s + q.a, 0); amp += sa; if (sa > 1e-3) sounding++;
      for (let b = a + 1; b < pfs.length; b++) for (const p of A) for (const q of pfs[b].frames[f]) sum += pairRoughness(p.f, q.f, p.a, q.a); }
    if (sounding >= 2) vals.push(sum / amp); }
  vals.sort((x, y) => x - y); return { mean: vals.reduce((s, v) => s + v, 0) / Math.max(1, vals.length), p95: vals.length ? vals[Math.floor(0.95 * (vals.length - 1))] : 0, frames: vals.length };
}
