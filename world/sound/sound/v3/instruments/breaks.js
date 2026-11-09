// Breakbeat engine: records its own break (a jazz-funk groove played on our kit, or any cleared buffer such as the CC0
// "Drum Conversation" 78), finds the hits, and re-sequences the slices into new patterns: reorder, repeat, reverse, pitch,
// stutter, half-time. The grammar is ours; no break from a record is used.
import { rng, edges, panInto, Biquad, softclip } from './core.js';
import * as kit from './funkkit.js';

export const meta = {
  id: 'breaks', title: 'Breakbeat engine', kind: 'drums',
  params: {
    bpm: { min: 70, max: 180, default: 170, unit: 'bpm' }, density: { min: 0, max: 1, default: 0.6, doc: 'how many 16ths get a slice' },
    shuffle: { min: 0, max: 1, default: 0.5, doc: 'how far slices move from their own place' }, reverse: { min: 0, max: 0.5, default: 0.08 },
    stutter: { min: 0, max: 0.5, default: 0.12 }, pitch: { min: -12, max: 12, default: 0, unit: 'semitones' }, grit: { min: 0, max: 1, default: 0.25 },
    halftime: { min: 0, max: 1, default: 0, doc: 'probability a bar plays at half speed' },
  },
  presets: {
    'atmos-roller': { bpm: 172, density: 0.55, shuffle: 0.35, reverse: 0.05, stutter: 0.08, pitch: 0, grit: 0.2, halftime: 0 },
    'choppy-dmv': { bpm: 140, density: 0.7, shuffle: 0.6, reverse: 0.12, stutter: 0.25, pitch: -2, grit: 0.5, halftime: 0.5 },
    'dusty-78': { bpm: 92, density: 0.5, shuffle: 0.25, reverse: 0.04, stutter: 0.05, pitch: -1, grit: 0.6, halftime: 0.2 },
  },
};

// Our own source break: two bars of the kit's 'dry-break' preset at the source tempo. Returns { buf, sr, bpm, bars }.
export function ownBreak({ sr = 48000, bpm = 100, seed = 21 } = {}) {
  const p = kit.meta.presets['dry-break'], ev = kit.groove(2, p, { style: 'funk', seed, fills: false }), r = kit.render(ev, p, { bpm, sr, bars: 2, tail: 0.01 });
  const buf = new Float32Array(r.L.length); for (let i = 0; i < buf.length; i++) buf[i] = (r.L[i] + r.R[i]) / 2; return { buf, sr, bpm, bars: 2 };
}

// Slice by onsets (energy rise over 10 ms frames), or by 16ths when the source tempo is known.
export function slice(src, { sr, bpm = null, bars = 2 } = {}) {
  if (bpm) { const n = bars * 16, len = Math.floor(src.length / n); return Array.from({ length: n }, (_, i) => ({ at: i * len, len, home: i })); }
  const hop = Math.floor(sr * 0.01), e = []; for (let i = 0; i + hop < src.length; i += hop) { let s = 0; for (let k = 0; k < hop; k++) s += src[i + k] ** 2; e.push(Math.sqrt(s / hop)); }
  const marks = []; let last = -99; for (let i = 2; i < e.length; i++) if (e[i] > 0.02 && e[i] > e[i - 2] * 2 && i - last > 6) { marks.push(i * hop); last = i; }
  return marks.map((m, i) => ({ at: m, len: (marks[i + 1] ?? src.length) - m, home: i }));
}

// A new pattern for `bars` bars: per 16th, which slice (or none), with rate, reverse and stutter flags.
export function sequence(slices, bars, p, { seed = 3 } = {}) {
  const r = rng(seed), out = [], n = slices.length;
  for (let b = 0; b < bars; b++) {
    const half = r() < p.halftime, span = half ? 2 : 1;
    for (let s = 0; s < 16; s += span) {
      const anchor = s === 0 || (s === 8 && !half) || (s === 4 && !half) || (s === 12 && !half);
      if (!anchor && r() > p.density) continue;
      const home = Math.floor((s / 16) * n) % n, idx = r() < p.shuffle ? Math.floor(r() * n) : home;
      const ev = { step: b * 16 + s, slice: idx, rate: Math.pow(2, p.pitch / 12) / (half ? 2 : 1), rev: r() < p.reverse, len16: span };
      if (r() < p.stutter && s % 4 === 3) { for (let k = 0; k < 3; k++) out.push({ ...ev, step: ev.step + k / 3, len16: 1 / 3 }); } else out.push(ev);
    }
  }
  return out;
}

export function render(src, slices, events, p, { sr = 48000, bars = 2, tail = 0.5 } = {}) {
  const step = 60 / p.bpm / 4, n = Math.ceil((bars * 16 * step + tail) * sr), L = new Float32Array(n), R = new Float32Array(n);
  for (const e of events) {
    const sl = slices[e.slice], want = Math.floor(e.len16 * step * sr), m = Math.min(want, Math.floor(sl.len / e.rate)), x = new Float32Array(m);
    for (let i = 0; i < m; i++) { const pos = e.rev ? sl.at + sl.len - 1 - i * e.rate : sl.at + i * e.rate, k = Math.floor(pos), f = pos - k; x[i] = (src[k] ?? 0) + ((src[k + 1] ?? 0) - (src[k] ?? 0)) * f; }
    edges(x, sr, 0.001, 0.004); panInto(L, R, x, Math.round(e.step * step * sr), 0);
  }
  if (p.grit > 0) { softclip(L, 1 + 4 * p.grit); softclip(R, 1 + 4 * p.grit); }
  const hp = [new Biquad('hp', 30, 0.7, sr), new Biquad('hp', 30, 0.7, sr)]; hp[0].run(L); hp[1].run(R);
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); if (pk > 0.9) for (let i = 0; i < n; i++) { L[i] *= 0.9 / pk; R[i] *= 0.9 / pk; }  // stutters overlap
  return { L, R, sr, seconds: n / sr };
}
