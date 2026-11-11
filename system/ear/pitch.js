// pitch.js: what notes are sounding. The signal is reduced to about 12 kHz, cut into 340 ms frames, and each frame's
// partials are assigned to the nearest equal-tempered semitone.
//   chroma        twelve numbers, one per pitch class (C, C sharp, ... B): the share of energy on each, octaves folded together
//   bass chroma   the fundamentals below 135 Hz, where the bass line states the chord's root, found by harmonic sum
//   cents         hundredths of a semitone; a partial's distance from the nearest tempered pitch is the tuning error
//   chord estimate  the root and chord type whose pitch classes best match the chroma, with the bass deciding close calls.
//                   The root is judged only where a bass sounds: a rootless piano voicing alone does not state its root.
//                   It counts as stated when the written root is the strongest bass pitch class or holds at least 30
//                   percent of the bass energy, which allows a line that alternates root and fifth, or a busy bass guitar
//                   line, and still fails a bass in the wrong key.
import { mono, decimate, powerFrames, peaks, ftom } from './spectrum.js';

export const NOTE_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
// Chord types the ear can name: intervals in semitones above the root. family is the third and seventh that define it.
export const QUALITIES = {
  maj7: { pcs: [0, 4, 7, 11], family: 'major' }, maj9: { pcs: [0, 4, 7, 11, 2], family: 'major' }, '6/9': { pcs: [0, 4, 7, 9, 2], family: 'major' },
  m7: { pcs: [0, 3, 7, 10], family: 'minor' }, m9: { pcs: [0, 3, 7, 10, 2], family: 'minor' }, m11: { pcs: [0, 3, 7, 10, 2, 5], family: 'minor' },
  '7': { pcs: [0, 4, 7, 10], family: 'dominant' }, '9': { pcs: [0, 4, 7, 10, 2], family: 'dominant' }, '13': { pcs: [0, 4, 7, 10, 2, 9], family: 'dominant' },
  '7alt': { pcs: [0, 4, 10, 1, 8], family: 'dominant' }, sus13: { pcs: [0, 5, 7, 10, 2, 9], family: 'suspended' }, m7b5: { pcs: [0, 3, 6, 10], family: 'half-diminished' },
};

// Partials per frame of the reduced signal: { frames: [[{ f, a }]], hopSec, winSec }. Shared by chroma, tuning and roughness.
export function partialFrames(x, sr, { fmin = 38, fmax = 5000, max = 24 } = {}) {
  const factor = Math.max(1, Math.floor(sr / 11000)), y = decimate(x, factor), r = sr / factor, st = powerFrames(y, r, { n: 4096, hop: 1024 });
  return { frames: st.frames.map((p) => peaks(p, st.binHz, { max, fmin, fmax: Math.min(fmax, r * 0.45), floorDb: -50 })), hopSec: st.hopSec, winSec: st.winSec };
}

// One analysis per signal: harmony, roughness and the comparison between layers all read the same frames.
const KEEP = new WeakMap();
export function framesOf(channels, sr) { const key = channels[0]; if (!KEEP.has(key)) KEEP.set(key, partialFrames(mono(channels), sr)); return KEEP.get(key); }
// The same frames narrowed to a frequency range and a number of partials.
export const narrow = (pf, { fmin = 0, fmax = Infinity, max = 24 } = {}) => ({ ...pf, frames: pf.frames.map((fr) => fr.filter((p) => p.f >= fmin && p.f <= fmax).slice(0, max)) });

// Chroma, bass chroma and tuning for each time span [{ t0, t1 }] in seconds.
export function chromaSpans(pf, spans, { bassMax = 135, tuneMin = 200, tuneMax = 2500 } = {}) {
  return spans.map(({ t0, t1 }) => {
    const c = new Float64Array(12), bass = new Float64Array(12); let dev = 0, devW = 0, signed = 0, frames = 0;
    const a = Math.max(0, Math.ceil((t0 - pf.winSec * 0.25) / pf.hopSec)), b = Math.floor((t1 - pf.winSec * 0.75) / pf.hopSec);
    for (let i = a; i <= Math.max(a, b) && i < pf.frames.length; i++) {
      frames++;
      for (const pk of pf.frames[i]) { const m = ftom(pk.f), near = Math.round(m), pc = ((near % 12) + 12) % 12, e = pk.a * pk.a;
        c[pc] += e; }
      // the bass by harmonic sum (round five): in each frame, the fundamental whose harmonics (1 to 6,
      // within 3 percent) hold the most energy among the partials below four times bassMax (a sub-octave reading
      // lands on the same pitch class, so octave errors do not count); the frame's bass energy goes to that fundamental's pitch class. A bass whose second or third harmonic is
      // stronger than its fundamental is still read at its fundamental. Round four counted each partial below bassMax
      // by its own pitch class, and read a strong third harmonic as a fifth in the bass.
      const low = pf.frames[i].filter((pk) => pk.f < 4 * bassMax); let best = 0, bf = 0, be = 0;
      for (const p of low) { if (p.f >= bassMax) continue; be += p.a * p.a; for (let k = 1; k <= 2; k++) { const f0 = p.f / k; if (f0 < 27) continue; let sc = 0;   // a candidate has its fundamental or its octave in the bass range, so chord tones above cannot add up to a phantom root
        for (const q of low) { const h = Math.round(q.f / f0); if (h >= 1 && h <= 6 && Math.abs(q.f / (h * f0) - 1) < 0.03) sc += q.a * q.a * (1 - 0.02 * h); } if (sc > best) { best = sc; bf = f0; } } }
      if (bf && be > 0) bass[((Math.round(ftom(bf)) % 12) + 12) % 12] += be;
      for (const pk of pf.frames[i]) { const m = ftom(pk.f), near = Math.round(m), e = pk.a * pk.a;
        if (pk.f >= tuneMin && pk.f <= tuneMax) { dev += Math.abs(m - near) * 100 * e; signed += (m - near) * 100 * e; devW += e; } }
    }
    const norm = (v) => { const s = v.reduce((p, q) => p + q, 0); return Array.from(v, (q) => (s ? q / s : 0)); };
    return { t0, t1, frames, chroma: norm(c), bass: norm(bass), energy: c.reduce((p, q) => p + q, 0), bassEnergy: bass.reduce((p, q) => p + q, 0), centsAbs: devW ? dev / devW : 0, cents: devW ? signed / devW : 0 };
  });
}

// The best root and chord type for one chroma. Score: the cosine between the chroma and the chord's pitch classes
// (root, third and seventh weighted 1, the rest 0.6), plus half the bass energy on the root.
export function estimateChord(chroma, bass) {
  let best = null; const cn = Math.hypot(...chroma) || 1;
  for (let root = 0; root < 12; root++) for (const [name, q] of Object.entries(QUALITIES)) {
    let dot = 0, tn = 0;
    q.pcs.forEach((iv, k) => { const w = k === 0 || k === 1 || k === 3 ? 1 : 0.6; dot += w * chroma[(root + iv) % 12]; tn += w * w; });
    const score = dot / (cn * Math.sqrt(tn)) + 0.5 * bass[root];
    if (!best || score > best.score) best = { root, quality: name, family: q.family, score, name: NOTE_NAMES[root] + name };
  }
  return best;
}

// Share of chroma energy that lands on a written chord's pitch classes (0 to 1).
export const chordFit = (chroma, pcs) => pcs.reduce((s, pc) => s + chroma[((pc % 12) + 12) % 12], 0);

// Compare what sounds with what the score wrote. chords: [{ t0, t1, bar, sym, root, pcs }] with root and pcs as pitch classes.
export function harmony(channels, sr, chords) {
  const pf = framesOf(channels, sr), spans = chromaSpans(pf, chords);
  const rows = spans.map((s, i) => { const w = chords[i], est = estimateChord(s.chroma, s.bass), bassRoot = s.bass.indexOf(Math.max(...s.bass));
    return { bar: w.bar, t0: w.t0, written: w.sym, heard: est.name, fit: chordFit(s.chroma, w.pcs), rootHeard: s.bassEnergy > 0.02 * s.energy ? NOTE_NAMES[bassRoot] : null, hasBass: s.bassEnergy > 0.02 * s.energy, rootShare: s.bass[w.root], rootMatch: s.bass[w.root] >= 0.3 || bassRoot === w.root,
      silent: s.energy < 1e-9, energy: s.energy, centsAbs: s.centsAbs, cents: s.cents, chroma: s.chroma }; });
  const live = rows.filter((r) => !r.silent), based = live.filter((r) => r.hasBass), fits = live.map((r) => r.fit).sort((a, b) => a - b), worst = live.reduce((m, r) => (!m || r.fit < m.fit ? r : m), null);
  const energy = live.reduce((a, r) => a + r.energy, 0);   // weightedFit counts each chord by how much sounds in it, so a sparse layer is judged on its notes and not on the tails between them
  return { rows, weightedFit: energy ? live.reduce((a, r) => a + r.fit * r.energy, 0) / energy : 1, meanFit: fits.reduce((a, b) => a + b, 0) / Math.max(1, fits.length), minFit: fits[0] ?? 1, worstBar: worst ? worst.bar : null,
    rootMatchRate: based.length ? based.filter((r) => r.rootMatch).length / based.length : 1, rootMisses: based.filter((r) => !r.rootMatch).map((r) => r.bar), chordsWithBass: based.length,
    centsAbsMean: live.reduce((s, r) => s + r.centsAbs, 0) / Math.max(1, live.length), centsAbsMax: Math.max(0, ...live.map((r) => r.centsAbs)) };
}

// Tuning of a single line (the lead stem): each note span's energy-weighted distance from tempered pitch, in cents.
export function tuning(x, sr, notes) {
  const pf = partialFrames(x, sr, { fmin: 120, fmax: 3000, max: 6 }), rows = chromaSpans(pf, notes, { tuneMin: 120, tuneMax: 3000 }).map((s, i) => ({ ...notes[i], cents: s.cents, centsAbs: s.centsAbs, silent: s.energy < 1e-9 }));
  const live = rows.filter((r) => !r.silent);
  return { rows, worst: live.reduce((m, r) => (!m || Math.abs(r.cents) > Math.abs(m.cents) ? r : m), null), meanAbs: live.reduce((s, r) => s + Math.abs(r.cents), 0) / Math.max(1, live.length) };
}
