// synths.js: the synthesizer family. Every sound here is designed, not measured: no recording stands behind it, and the
// ear can only check what it measures (tuning, level, brightness against strength, movement inside a note, no copies).
// Each is described by its method. They are built from the engine's own parts (world/sound/sound/v3/instruments/core.js:
// band-limited saw tables, the state-variable filter, biquads, delay lines).
//   subtractive    oscillators rich in harmonics (saw, square) through a low-pass filter whose cutoff an envelope moves:
//                  analog (a warm bass), lead (a mono line that glides between notes), brass (a polyphonic swell)
//   FM             frequency modulation: one sine (the modulator) moves the frequency of another (the carrier); the ratio of
//                  their frequencies sets which partials appear and the modulation index how many: bell, glass (an electric
//                  piano of the glassy kind), metal (a metallic bass)
//   wavetable      a single cycle that morphs over the note between stored shapes (here sine to saw to a pulse)
//   string machine many detuned saws through a slow three-phase chorus (an ensemble), with a soft attack
//   acid           one saw through a resonant low-pass with a fast envelope and accents, sliding between tied notes
//   pluck          a digital pluck: a short burst through a filter that closes fast, for arpeggios
//   formant        a sawtooth through three band-pass filters at the resonances of a sung vowel, moving between vowels
//   sweep          a slow pad whose filter opens and closes over several bars
import { mtof, rng, velocity, expDecay, edges, Biquad, SVF, sawTable, tableRead, clamp } from '../../world/sound/sound/v3/instruments/core.js';

const tables = new Map(); const saw = (f, sr) => { const k = `${sr}:${Math.round(Math.log2(Math.max(20, f)) * 4)}`; if (!tables.has(k)) tables.set(k, sawTable(f, sr)); return tables.get(k); };
const env = (t, hold, a, d, s, r) => (t < a ? t / a : t < hold ? s + (1 - s) * Math.exp(-(t - a) / d) : (s + (1 - s) * Math.exp(-(hold - a) / d)) * Math.exp(-(t - hold) / r));
const norm = (x, g) => { new Biquad('hp', 20, 0.7, 48000).run(x); let pk = 0;   // a DC blocker first: a pulse or a driven saw can carry an offset
   for (const v of x) pk = Math.max(pk, Math.abs(v)); const k = g / (pk || 1); for (let i = 0; i < x.length; i++) x[i] *= k; return x; };

// subtractive bass: saw plus a square at the same pitch at a third of its level, through a low-pass that opens on the strike
export function analogBass(m, vel, dur, { slideFrom = null } = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.3 }), r = rng(seed * 977 + m), f0 = mtof(m) * Math.pow(2, (r() - 0.5) * 4 / 1200), wob = 0.85 + 0.3 * r(), from = slideFrom === null ? f0 : mtof(slideFrom), len = Math.floor((dur + 0.2) * sr), x = new Float32Array(len), f = new SVF(sr); let p1 = r(), p2 = r();
  for (let i = 0; i < len; i++) { const t = i / sr, fr = f0 * Math.pow(from / f0, expDecay(t, 0.05)), a = tableRead(saw(fr, sr), p1), b = p2 % 1 < 0.5 ? 1 : -1; p1 += fr / sr; p2 += fr / sr;
    const cut = 90 + (300 + 900 * V.bright) * wob * expDecay(t, 0.12) + 160; x[i] = f.tick(0.7 * a + 0.25 * b, cut, 1.3).lo * env(t, dur, 0.004, 0.3, 0.75, 0.06); }
  return edges(norm(x, 1.0 * V.gain), sr, 0.002, 0.03);
}
// FM metallic bass: carrier and modulator at 1 : 3.5, the index falling fast, so the strike is clangorous and the body round
export function fmBass(m, vel, dur, _o = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.3 }), r = rng(seed * 733 + m), f0 = mtof(m), len = Math.floor((dur + 0.15) * sr), x = new Float32Array(len), ix = 0.85 + 0.3 * r(); let pc = r() * 6.28, pm = r() * 6.28;
  for (let i = 0; i < len; i++) { const t = i / sr, I = ((0.6 + 3 * V.bright) * expDecay(t, 0.06) + 0.3) * ix; pm += 2 * Math.PI * f0 * 3.5 / sr; pc += 2 * Math.PI * f0 / sr; x[i] = Math.sin(pc + I * Math.sin(pm)) * env(t, dur, 0.002, 0.4, 0.6, 0.05); }
  return edges(norm(x, 0.5 * V.gain), sr, 0.001, 0.02);
}
// acid: one saw, a resonant low-pass with a fast envelope; a strong note (vel over 0.7) is an accent, louder and more open
export function acid(m, vel, dur, { slideFrom = null } = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.2 }), r = rng(seed * 557 + m), wob = 0.85 + 0.3 * r(), acc = vel > 0.7 ? 1 : 0, f0 = mtof(m), from = slideFrom === null ? f0 : mtof(slideFrom), len = Math.floor((dur + 0.12) * sr), x = new Float32Array(len), f = new SVF(sr); let ph = r();
  for (let i = 0; i < len; i++) { const t = i / sr, fr = f0 * Math.pow(from / f0, expDecay(t, 0.03)); ph += fr / sr; const cut = 180 + (700 + 1600 * acc) * wob * expDecay(t, acc ? 0.09 : 0.16);
    x[i] = Math.tanh(1.6 * f.tick(tableRead(saw(fr, sr), ph), cut, 5 + 3 * acc).lo) * env(t, dur, 0.002, 0.2, 0.8, 0.02); }
  return edges(norm(x, (0.45 + 0.15 * acc) * V.gain), sr, 0.001, 0.015);
}
// FM bell: 1 : 3.5 with a long decay; FM glass: an electric piano of the glassy kind, 1 : 1 with a 1 : 14 tine on the strike
export function fmBell(m, vel, dur, _p = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), r = rng(seed * 211 + m), f0 = mtof(m), len = Math.floor((dur + 2.4) * sr), x = new Float32Array(len); let pc = r() * 6.28, pm = r() * 6.28;
  for (let i = 0; i < len; i++) { const t = i / sr, I = 2.2 * V.bright * expDecay(t, 0.7); pm += 2 * Math.PI * f0 * 3.5 / sr; pc += 2 * Math.PI * f0 / sr; x[i] = Math.sin(pc + I * Math.sin(pm)) * expDecay(t, 1.6) * Math.min(1, t / 0.002) * (t < dur ? 1 : expDecay(t - dur, 0.8)); }
  return edges(norm(x, 0.48 * V.gain), sr, 0.001, 0.05);
}
export function fmGlass(m, vel, dur, _p = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), r = rng(seed * 401 + m), f0 = mtof(m), len = Math.floor((dur + 1) * sr), x = new Float32Array(len), ix = 0.9 + 0.2 * r(); let pc = r() * 6.28, pm = r() * 6.28, pt = 0, ptm = 0;
  for (let i = 0; i < len; i++) { const t = i / sr, I = ((0.4 + 1.4 * V.bright) * expDecay(t, 0.25) + 0.2) * ix; pm += 2 * Math.PI * f0 / sr; pc += 2 * Math.PI * f0 / sr; ptm += 2 * Math.PI * f0 * 14 / sr; pt += 2 * Math.PI * f0 * 14 / sr;
    const tine = 0.25 * V.bright * Math.sin(pt + 1.5 * Math.sin(ptm)) * expDecay(t, 0.03); x[i] = (Math.sin(pc + I * Math.sin(pm)) + tine) * expDecay(t, 1.3) * Math.min(1, t / 0.0015) * (t < dur ? 1 : expDecay(t - dur, 0.12)); }
  return edges(norm(x, 0.58 * V.gain), sr, 0.001, 0.04);
}
// a digital pluck for arpeggios: a saw and its octave through a low-pass that closes within 80 ms
export function pluck(m, vel, dur, _p = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.3 }), r = rng(seed * 89 + m), f0 = mtof(m), len = Math.floor((dur + 0.4) * sr), x = new Float32Array(len), f = new SVF(sr); let p1 = r(), p2 = r();
  for (let i = 0; i < len; i++) { const t = i / sr; p1 += f0 / sr; p2 += 2 * f0 / sr; x[i] = f.tick(tableRead(saw(f0, sr), p1) + 0.4 * tableRead(saw(2 * f0, sr), p2), 300 + 4200 * V.bright * expDecay(t, 0.05), 1.6).lo * expDecay(t, 0.35); }
  return edges(norm(x, 0.35 * V.gain), sr, 0.001, 0.05);
}

// A mono synth lead over a phrase: one oscillator pair for the whole phrase, gliding between slurred notes; the filter
// opens on each new note and follows the strength; vibrato arrives late. notes as blown.js takes them. Returns { x, pre }.
export function synthLead(notes, p = {}, sr = 48000, seed = 3) {
  const q = { glide: 0.04, cutoff: 1400, env: 2600, reso: 1.6, vibrato: 0.005, detune: 5, ...p }, pre = Math.round(0.05 * sr), end = notes[notes.length - 1], len = pre + Math.floor((end.t + end.dur + 0.4) * sr), x = new Float32Array(len), f = new SVF(sr), r = rng(seed);
  let k = 0, fr = mtof(notes[0].m), p1 = r(), p2 = r(), a = 0, since = 0;
  for (let i = 0; i < len; i++) { const t = (i - pre) / sr; while (k + 1 < notes.length && t >= notes[k + 1].t) { k++; if (!notes[k].slur) since = t; } if (t < 0) continue;
    const n = notes[k], on = t >= n.t && (t < n.t + n.dur || (notes[k + 1] && notes[k + 1].t - (n.t + n.dur) < 0.05)), want = mtof(n.m), tin = t - n.t; fr *= Math.pow(want / fr, n.slur ? 1 - Math.exp(-1 / (q.glide * sr)) : 1);
    const vib = 1 + q.vibrato * Math.min(1, Math.max(0, tin - 0.35) / 0.5) * Math.sin(2 * Math.PI * 5.2 * t), F = fr * vib, d = Math.pow(2, q.detune / 1200); p1 += F / sr; p2 += F * d / sr;
    a += ((on ? 1 : 0) - a) * (1 - Math.exp(-1 / ((on ? 0.008 : 0.08) * sr)));
    const V = velocity(n.vel, { curve: 1.3 }), cut = q.cutoff + q.env * V.bright * expDecay(t - since, 0.25); x[i] = f.tick(0.5 * (tableRead(saw(F, sr), p1) + tableRead(saw(F * d, sr), p2)), cut, q.reso).lo * a * V.gain; }
  return { x: edges(norm(x, 0.5), sr, 0.002, 0.05), pre };
}

// Pads and chords: (notes, vel, dur, p, sr, seed) -> { L, R }
const stereo = (len) => ({ L: new Float32Array(len), R: new Float32Array(len) });
const ensemble = (o, sr) => { // three delay taps a third of a cycle apart, swept slowly: the string machine's chorus
  const n = o.L.length, size = Math.ceil(0.03 * sr), b = new Float32Array(size); let w = 0;
  for (let i = 0; i < n; i++) { const x = 0.5 * (o.L[i] + o.R[i]); b[w] = x; const tap = (ph) => { const d = (0.007 + 0.003 * Math.sin(2 * Math.PI * 0.6 * i / sr + ph) + 0.0008 * Math.sin(2 * Math.PI * 6 * i / sr + ph)) * sr, p = w - d, j = Math.floor(p), f = p - j, a = b[((j % size) + size) % size], c = b[(((j + 1) % size) + size) % size]; return a + (c - a) * f; };
    const t1 = tap(0), t2 = tap(2.094), t3 = tap(4.189); o.L[i] = x * 0.4 + 0.6 * (t1 + 0.5 * t2); o.R[i] = x * 0.4 + 0.6 * (t3 + 0.5 * t2); w = (w + 1) % size; }
  return o;
};
function sawPad(notes, vel, dur, { voices = 3, detune = 6, attack = 0.4, release = 1.2, cut = (t) => 2000, reso = 0.9, shape = null, gain = 0.3 } = {}, sr, seed) {
  const V = velocity(vel, { curve: 1.2 }), r = rng(seed), len = Math.floor((dur + release * 1.5) * sr), o = stereo(len), fl = new SVF(sr), fr = new SVF(sr), osc = [];
  for (const m of notes) for (let k = 0; k < voices; k++) { const c = voices === 1 ? 0 : (k / (voices - 1) - 0.5) * 2 * detune, f = mtof(m) * Math.pow(2, c / 1200); osc.push({ f, ph: r(), pan: voices === 1 ? 0 : (k / (voices - 1) - 0.5) * 1.4 }); }
  const g = gain * V.gain / Math.sqrt(osc.length);
  for (let i = 0; i < len; i++) { const t = i / sr, e = Math.min(1, t / attack) * (t < dur ? 1 : Math.exp(-(t - dur) * 4.6 / release)); let a = 0, b = 0;
    for (const s of osc) { const v = shape ? shape(s.ph, t) : tableRead(saw(s.f, sr), s.ph); s.ph += s.f / sr; a += v * (1 - s.pan) * 0.5; b += v * (1 + s.pan) * 0.5; }
    const c = cut(t); o.L[i] = fl.tick(a * g, c, reso).lo * e; o.R[i] = fr.tick(b * g, c * 1.01, reso).lo * e; }
  new Biquad('hp', 20, 0.7, sr).run(o.L); new Biquad('hp', 20, 0.7, sr).run(o.R); return o;
}
export const PADS = {
  // string machine: six detuned saws a note, a soft attack, a fixed bright low-pass, then the ensemble chorus
  strings: (notes, vel, dur, p, sr, seed) => ensemble(sawPad(notes, vel, dur, { voices: 6, detune: 9, attack: 0.5, release: 1.4, cut: () => 3200, reso: 0.8, gain: 0.58 }, sr, seed), sr),
  // sweep: the filter opens over the first half of the chord and closes over the rest, a slow breath across bars
  sweep: (notes, vel, dur, p, sr, seed) => sawPad(notes, vel, dur, { voices: 4, detune: 10, attack: 1.2, release: 2.5, cut: (t) => 350 + 2600 * Math.pow(Math.sin(Math.PI * Math.min(1, t / Math.max(1, dur))), 2), reso: 2.2, gain: 0.34 }, sr, seed),
  // wavetable: each cycle morphs from a sine through a saw to a narrow pulse and back, slowly and out of step per voice
  wavetable: (notes, vel, dur, p, sr, seed) => sawPad(notes, vel, dur, { voices: 2, detune: 5, attack: 0.8, release: 2, cut: () => 4200, reso: 0.8, gain: 0.43,
    shape: (ph, t) => { const u = (ph % 1 + 1) % 1, mo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.11 * t + ph * 0.001), s = Math.sin(2 * Math.PI * u), w = 2 * u - 1, pl = u < 0.18 ? 1 : -0.2; return mo < 0.5 ? s + (w - s) * 2 * mo : w + (pl - w) * (2 * mo - 1); } }, sr, seed),
  // brass: a polyphonic swell; the filter opens over 120 ms and settles, with a little overshoot of level
  brass: (notes, vel, dur, p, sr, seed) => sawPad(notes, vel, dur, { voices: 2, detune: 6, attack: 0.06, release: 0.35, cut: (t) => 700 + 2600 * (1 - Math.exp(-t / 0.12)) * (0.7 + 0.3 * Math.exp(-t / 0.4)), reso: 1.1, gain: 0.36 }, sr, seed),
  // formant: saws through three resonances of a sung vowel, drifting from "ah" to "oo" and back over each chord
  formant: (notes, vel, dur, p, sr, seed) => { const o = sawPad(notes, vel, dur, { voices: 3, detune: 8, attack: 0.9, release: 1.8, cut: () => 6000, reso: 0.7, gain: 0.5 }, sr, seed), A = [[730, 1090, 2440], [300, 870, 2240]], g = [1, 0.5, 0.25];
    for (const ch of ['L', 'R']) { const x = ch === 'L' ? o.L : o.R, y = new Float32Array(x.length), bp = A[0].map((f) => new Biquad('bp', f, 6, sr));
      for (let i = 0; i < x.length; i++) { if (i % 256 === 0) { const u = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / sr / Math.max(2, dur)); bp.forEach((b, k) => b.set('bp', A[0][k] + (A[1][k] - A[0][k]) * u, 6)); } let s = 0; for (let k = 0; k < 3; k++) s += g[k] * bp[k].tick(x[i]); y[i] = s; }
      x.set(y); } let pk = 0; for (const v of o.L) pk = Math.max(pk, Math.abs(v)); const k = clamp(0.1 / (pk || 1), 0, 40); for (let i = 0; i < o.L.length; i++) { o.L[i] *= k; o.R[i] *= k; } return o; },
};
