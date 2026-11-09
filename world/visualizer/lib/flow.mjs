// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// flow.mjs: the visualizer as a source for the super framework's medium (superframe/lib/medium), the tank
// of water and air that anything can be poured into. Sound pours in as surface vibration and pressure; data pours in
// as rate and timing. Tank time is media time: the tank at t has heard the track up to t.
//
// Sound
//   vibration  one standing mode of the tank's water at a time, cos(pi m x / W) cos(pi n y / D), held for a bar and
//              driven at the beat rate, its strength following short-term loudness. The bar's spectral centroid sets
//              the mode's eigenvalue lambda = (m / W)^2 + (n / D)^2, low notes low modes. Many (m, n) pairs share nearly
//              the same lambda, and the choice among them is made by the bar number, so the same tone shows different
//              shapes. That is Kac's question in the tank (reference library: st-mathelirium-2114312133747876204):
//              a spectrum suggests a shape and does not fix it (Gordon, Webb and Wolpert, 1992). The frames say which
//              mode is showing and how many shared its tone; they never claim the sound "is" that shape.
//   pressure   each onset presses the surface down at its place in the bar (the downbeat at the left wall, the bar
//              running across the tank), a Gaussian dent in the surface speed and a push into the water under it,
//              in proportion to the onset's spectral flux; the strongest tenth of low-band onsets also release
//              bubbles from the bed (medium.add 'bubbles').
// Data
//   timing     each observation is a drop of ink (medium.add 'ink') at its beat time, placed by its place in its group
//              (a decade of years runs across the tank), dark for a rise and red for a fall
//   rate       a drip at the surface pours for the whole series, its rate driven by the values (medium.add 'data'
//              on that drip), and each change point (a step above two robust deviations) presses like an onset
//
//   pourFeatures(m, F, opts) -> { forcing(m), modes: [{ bar, t0, t1, m, n, lambda, shared }] }
//       schedules the medium.add pours on m and returns the per-step forcing to run with m.run(seconds, forcing)
//   modesFor(lambda, W, D) -> candidate (m, n) pairs within `tol` of lambda: the isospectral set the choice is made in
//   flowAt(F, t, opts) -> { medium, modes, mode }: a fresh tank run from 0 to t (pure function of F, t and opts)
import { Medium, render } from '../../superframe/lib/medium/index.mjs';

// The tank before the music: two thin bands of ink resting on a salt layer (stratified, so they stay put until
// something moves them) and a little sediment on the bed. Water itself is clear; the bands are what show its motion.
export const BASE = Object.freeze([
  ['salt', { x: 0.5, y: 0.82, w: 0.5, h: 0.13 }, 2, { at: 0, for: 0.5 }],
  ['ink', { x: 0.5, y: 0.52, w: 0.5, h: 0.012 }, 0.9, { color: '#1d2a3a', at: 0, for: 0.4, spread: 0.3 }],
  ['ink', { x: 0.5, y: 0.66, w: 0.5, h: 0.01 }, 0.7, { color: '#a3241c', at: 0, for: 0.4, spread: 0.3 }],
  ['tiles', { x: 0.5, y: 0.4, w: 0.48, h: 0.02 }, 0.25, { color: '#b0603a', at: 0, for: 1 }],
]);

export const FLOW = Object.freeze({ base: BASE, nx: 192, ny: 108, waterLevel: 0.3, maxM: 16, maxN: 5, tol: 0.08, vib: 0.55, press: 1, seed: 'vis-flow' });

export function modesFor(lambda, W, D, { maxM = 16, maxN = 5, tol = 0.04 } = {}) {
  const out = [];
  for (let m = 1; m <= maxM; m++) for (let n = 0; n <= maxN; n++) { const l = (m / W) ** 2 + (n / D) ** 2; if (Math.abs(l - lambda) / lambda <= tol) out.push({ m, n, lambda: l }); }
  return out.sort((a, b) => a.lambda - b.lambda || a.m - b.m);
}
function hash(i, s) { let h = Math.imul(i + 1, 2654435761) ^ Math.imul(s + 7, 1597334677); h = Math.imul(h ^ (h >>> 15), 2246822519); return (h ^ (h >>> 13)) >>> 0; }
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[s.length >> 1] : 0; };

// The bar's tone as a target eigenvalue. The tone is the bar's median spectral centroid (the spectral peak sits on
// the bass in most bars, which would pin every bar to the lowest mode). Its log is placed within this track's own
// range of bar tones (5th to 95th percentile), and that range spans the modes from (2, 0) to (maxM, maxN), so the
// map is monotone and uses the whole set. Bright bars get fine, high modes; dark bars broad, low ones.
function targetLambda(u, W, D, P) {
  const lo = (2 / W) ** 2, hi = (P.maxM / W) ** 2 + (P.maxN / D) ** 2;
  return lo * (hi / lo) ** Math.max(0, Math.min(1, u));
}
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]; };

export function pourFeatures(m, F, opts = {}) {
  const P = { ...FLOW, ...opts }, W = m.nx, D = (1 - m.waterLevel) * m.ny, bars = F.downbeats.length ? F.downbeats : [0];
  const barLen = bars.length > 1 ? med(bars.slice(1).map((b, i) => b - bars[i])) : 2;
  const xOf = t => { let k = 0; while (k + 1 < bars.length && bars[k + 1] <= t) k++; return 0.06 + 0.88 * Math.max(0, Math.min(1, (t - bars[k]) / barLen)); };
  const at = (s, t) => s[Math.max(0, Math.min(F.n - 1, Math.round(t * F.fps)))];
  // vibration: one mode per bar
  const modes = [], tone = [];
  for (let b = 0; b < bars.length; b++) {
    const t0 = bars[b], t1 = b + 1 < bars.length ? bars[b + 1] : t0 + barLen;
    tone.push(F.kind === 'series' ? at(F.series.value, t0) : Math.log(Math.max(20, med(Array.from({ length: 24 }, (_, k) => at(F.series.centroid, t0 + (t1 - t0) * k / 24))))));
  }
  const tlo = pct(tone, 0.05), thi = pct(tone, 0.95);
  for (let b = 0; b < bars.length; b++) {
    const t0 = bars[b], t1 = b + 1 < bars.length ? bars[b + 1] : t0 + barLen, lambda = targetLambda((tone[b] - tlo) / (thi - tlo || 1), W, D, P);
    let set = modesFor(lambda, W, D, P);
    if (!set.length) set = [modesFor(lambda, W, D, { ...P, tol: 10 }).sort((a, c) => Math.abs(a.lambda - lambda) - Math.abs(c.lambda - lambda))[0]];
    const pick = set[hash(b, 31) % set.length];
    modes.push({ bar: b, t0, t1, tone: F.kind === 'series' ? +tone[b].toFixed(3) : Math.round(Math.exp(tone[b])), m: pick.m, n: pick.n, lambda: pick.lambda, shared: set.length });
  }
  // pressure: onsets (sound) or change points (data)
  const flux = F.series.flux, fmax = Math.max(1e-6, ...F.onsets.map(t => at(flux, t)));
  const presses = F.onsets.map(t => ({ t, x: xOf(t), k: Math.min(1, at(flux, t) / fmax) }));
  if (F.kind !== 'series') {
    // timing from the score's own phrasing: a fresh thin band of ink at every eighth downbeat, alternating depth, so
    // the tank keeps a line for the sound to move after the first bands have mixed
    for (let b = 8; b < bars.length; b += 8) m.add('ink', { x: 0.5, y: (b / 8) % 2 ? 0.58 : 0.46, w: 0.5, h: 0.008 }, 0.6, { color: (b / 8) % 2 ? '#a3241c' : '#1d2a3a', at: bars[b], for: 0.3, spread: 0.3 });
    const lowAt = F.onsets.map(t => at(F.series.low, t)), cut = [...lowAt].sort((a, b) => a - b)[Math.floor(lowAt.length * 0.9)] ?? Infinity;
    F.onsets.forEach((t, i) => { if (lowAt[i] >= cut) m.add('bubbles', { x: xOf(t), y: 0.92, r: 0.02 }, 1.5, { at: t, for: 0.12 }); });
  } else {
    // timing: one drop per observation; rate: a drip whose amount follows the values
    const v = F.values, lo = Math.min(...v), hi = Math.max(...v);
    F.beats.forEach((t, i) => { const up = i === 0 || v[i] >= v[i - 1]; m.add('ink', { x: xOf(t), y: m.waterLevel + 0.04, r: 0.012 }, 0.15 + 0.6 * (v[i] - lo) / (hi - lo || 1), { color: up ? '#1d2a3a' : '#a3241c', at: t, for: 0.15 }); });
    m.add('ink', { x: 0.5, y: m.waterLevel + 0.02, r: 0.01 }, 0.25, { color: '#1d2a3a', at: F.beats[0], for: F.beats[F.beats.length - 1] - F.beats[0] });
    m.add('data', {}, 1, { series: Array.from(v), at: F.beats[0], for: F.beats[F.beats.length - 1] - F.beats[0], target: m.emitters.length - 1 });
  }
  let pi = 0, mi = 0;
  function forcing(med2) {
    const t = med2.time, { nx, ny } = med2;
    while (mi + 1 < modes.length && modes[mi + 1].t0 <= t) mi++;
    const M = modes[mi], beatHz = F.tempo.bpm / 60, loud = F.series.lufsS ? Math.max(0, Math.min(1, (at(F.series.lufsS, t) + 40) / 32)) : 0.6;
    if (M && t >= M.t0) {
      const w = Math.sin(2 * Math.PI * beatHz * (t - M.t0)) * P.vib * loud, top = Math.floor(med2.waterLevel * ny);
      for (let i = 0; i < nx; i++) {
        const cx = Math.cos(Math.PI * M.m * (i + 0.5) / nx);
        med2.hv[i] += 0.02 * cx * w;
        for (let j = top; j < ny; j++) { const k = j * nx + i; if (med2.phase[k] && !med2.solid[k]) med2.v[k] += 0.006 * cx * Math.cos(Math.PI * M.n * (j - top + 0.5) / D) * w; }
      }
    }
    while (pi < presses.length && presses[pi].t <= t) {
      const p = presses[pi++], x0 = p.x * nx, r = 0.03 * nx, amp = 0.9 * p.k * P.press;
      for (let i = Math.max(0, Math.floor(x0 - 3 * r)); i < Math.min(nx, Math.ceil(x0 + 3 * r)); i++) {
        const g = Math.exp(-0.5 * ((i + 0.5 - x0) / r) ** 2); med2.hv[i] -= amp * g;
        const js = Math.max(0, Math.floor(med2.surfaceY(i)));
        for (let j = js; j < Math.min(ny, js + 8); j++) { const k = j * nx + i; if (med2.phase[k] && !med2.solid[k]) med2.v[k] += 0.4 * amp * g * (1 - (j - js) / 8); }
      }
    }
  }
  return { forcing, modes, presses };
}

// A tank that has heard F up to t, built fresh (so any t can be rendered alone, in parallel or out of order).
export function flowAt(F, t, opts = {}) {
  const P = { ...FLOW, ...opts }, m = new Medium({ nx: P.nx, ny: P.ny, seed: P.seed, waterLevel: P.waterLevel });
  if (P.base) for (const a of P.base) m.add(...a);
  const { forcing, modes } = pourFeatures(m, F, P);
  m.run(Math.max(1 / 30, t), forcing);
  const mode = [...modes].reverse().find(M => M.t0 <= t) ?? modes[0];
  return { medium: m, modes, mode };
}

// Sequential frames: one tank run, read at each frame time (a video needs this; flowAt per frame would rerun the
// tank from zero every frame). cb(medium, t, mode, index) is awaited in order.
export async function flowFrames(F, times, cb, opts = {}) {
  const P = { ...FLOW, ...opts }, m = new Medium({ nx: P.nx, ny: P.ny, seed: P.seed, waterLevel: P.waterLevel });
  if (P.base) for (const a of P.base) m.add(...a);
  const { forcing, modes } = pourFeatures(m, F, P);
  for (let i = 0; i < times.length; i++) {
    if (times[i] > m.time) m.run(times[i] - m.time, forcing);
    await cb(m, times[i], [...modes].reverse().find(M => M.t0 <= times[i]) ?? modes[0], i);
  }
  return modes;
}

export { render as renderMedium };
