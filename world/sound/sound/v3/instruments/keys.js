// Electric piano and jazz chords. The tone is our own FM tine model: a sine carrier with a 1:1 modulator whose index falls
// after the strike (the bell), a high 'bark' partial on hard hits, and a pickup-style asymmetric drive. Velocity sets the index,
// so soft notes are round and loud ones bark. Chords: symbols to rootless voicings, with voice leading that moves each voice
// as little as possible from the previous chord.
import { mtof, rng, velocity, expDecay, edges, Biquad, panInto } from './core.js';

export const meta = {
  id: 'keys', title: 'Electric piano and jazz chords', kind: 'keys',
  params: {
    bell: { min: 0, max: 1, default: 0.5, doc: 'FM index at the strike' }, bark: { min: 0, max: 1, default: 0.3, doc: 'hard-hit high partial' },
    decay: { min: 0.5, max: 3, default: 1.4, unit: 's' }, tremolo: { min: 0, max: 0.6, default: 0.2 }, rate: { min: 2, max: 7, default: 4.6, unit: 'Hz' },
    drive: { min: 0, max: 1, default: 0.25 }, tone: { min: 1500, max: 9000, default: 5000, unit: 'Hz' }, spread: { min: 0, max: 1, default: 0.5, doc: 'stereo tremolo width' },
  },
  presets: {
    'warm-tine': { bell: 0.35, bark: 0.15, decay: 1.8, tremolo: 0.18, rate: 4.2, drive: 0.2, tone: 4200, spread: 0.6 },
    'bright-bark': { bell: 0.7, bark: 0.6, decay: 1.2, tremolo: 0.1, rate: 5.5, drive: 0.45, tone: 7500, spread: 0.3 },
    'late-night': { bell: 0.25, bark: 0.05, decay: 2.4, tremolo: 0.32, rate: 3.6, drive: 0.1, tone: 2800, spread: 0.8 },
  },
};

export function note(m, vel, dur, p, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), f = mtof(m), len = Math.floor((dur + p.decay * 0.6) * sr), x = new Float32Array(len), r = rng(seed);
  const I0 = (0.6 + 2.6 * p.bell) * V.bright, keyTrack = Math.min(1, 220 / f), lp = new Biquad('lp', p.tone * (0.6 + 0.4 * V.bright), 0.6, sr);
  let pc = r() * 6.28, pm = 0, pb = 0; const fb = f * 14.02;
  for (let i = 0; i < len; i++) {
    const t = i / sr, held = t < dur ? 1 : expDecay(t - dur, 0.08), I = I0 * (0.25 + 0.75 * expDecay(t, 0.35)) * keyTrack + 0.15;
    pm += 2 * Math.PI * f / sr; pc += 2 * Math.PI * f / sr; pb += 2 * Math.PI * fb / sr;
    let y = Math.sin(pc + I * Math.sin(pm)) * expDecay(t, p.decay * (0.5 + keyTrack)) * held;
    y += p.bark * V.bright * V.bright * 0.25 * Math.sin(pb) * expDecay(t, 0.02);
    y = y + p.drive * 0.3 * y * y; x[i] = lp.tick(Math.tanh(y * (1 + p.drive)));
  }
  for (let i = 0; i < len; i++) x[i] *= V.gain * 0.5; return edges(x, sr, 0.001, 0.02);
}

// Chord symbols: root name plus quality. Voicings are rootless (bass plays the root), built from 3rds, 7ths and colour tones.
const NAMES = { C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11 };
const QUAL = { m9: [3, 7, 10, 14], m11: [3, 10, 14, 17], maj9: [4, 7, 11, 14], '13': [4, 10, 14, 21], '7alt': [4, 10, 13, 20], m7b5: [3, 6, 10, 14], sus13: [5, 10, 14, 21], '6/9': [4, 9, 14, 19] };
export function parse(sym) { const m = sym.match(/^([A-G][#b]?)(.*)$/); return { root: NAMES[m[1]], q: QUAL[m[2]] ? m[2] : 'm9' }; }

// Voice leading: try each inversion and octave of the chord's tones within [lo, hi], keep the one with the least total motion.
export function voice(sym, prev = null, { lo = 52, hi = 76 } = {}) {
  const { root, q } = parse(sym), pcs = QUAL[q].map((i) => (root + i) % 12), cands = [];
  for (let inv = 0; inv < pcs.length; inv++) for (let base = lo; base < hi - 6; base++) {
    const order = pcs.slice(inv).concat(pcs.slice(0, inv)), v = []; let n = base - 1;
    for (const pc of order) { n += 1; while (n % 12 !== pc) n++; v.push(n); }
    if (v[0] < lo || v[v.length - 1] > hi || v[0] % 12 !== order[0]) continue; cands.push(v);
  }
  if (!prev) return cands.sort((a, b) => Math.abs(a[1] - 62) - Math.abs(b[1] - 62))[0];
  const cost = (v) => v.reduce((s, x, i) => s + Math.abs(x - (prev[i] ?? prev[prev.length - 1])), 0);
  return cands.sort((a, b) => cost(a) - cost(b))[0];
}
export const bassOf = (sym, oct = 2) => 12 * (oct + 1) + parse(sym).root;

// Render a progression: [{ sym, beats }] at bpm, comped with a light rhythm (stabs on 1 and the and of 2 with velocity spread).
export function comp(prog, p, { bpm = 90, sr = 48000, seed = 4, rhythm = [[0, 2.5], [2.5, 1.5]] } = {}) {
  const beat = 60 / bpm, total = prog.reduce((s, c) => s + c.beats, 0), n = Math.ceil((total * beat + p.decay + 1) * sr), L = new Float32Array(n), R = new Float32Array(n), r = rng(seed);
  let t = 0, prev = null;
  for (const c of prog) { const v = voice(c.sym, prev); prev = v;
    for (const [on, len] of rhythm) { if (on >= c.beats) continue; v.forEach((m, i) => { const x = note(m, 0.45 + 0.3 * r(), Math.min(len, c.beats - on) * beat * 0.9, p, sr, i + 1);
      panInto(L, R, x, Math.round((t + on + (r() - 0.5) * 0.03) * beat * sr), (i / (v.length - 1) - 0.5) * p.spread); }); }
    t += c.beats; }
  // tremolo: in phase at spread 0, opposite in each side at spread 1, so the chord moves across the field
  for (let i = 0; i < n; i++) { const m = Math.sin(2 * Math.PI * p.rate * i / sr) * p.tremolo; L[i] *= 1 - m * 0.5; R[i] *= 1 - m * 0.5 * (1 - 2 * p.spread); }
  return { L, R, sr, seconds: n / sr, voicings: prog.map((c) => c.sym) };
}
