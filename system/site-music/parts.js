// parts.js: what each player does in one bar. The composer (score.js) decides the chords and how much of the band is
// playing (the level: "none", "simple" or "whisper", "light", "full"); these writers turn that into notes and hits.
// Times are in beats within the bar; a sixteenth note is 0.25. Every writer takes one context object:
//   { P, r, out, chords, nextRoot, lay, index, pos, role, st }
// Humanised playing: each note is moved by a small random time and its strength by a small random amount, inside fixed
// bounds (HUMAN, in milliseconds and velocity units, scaled by the piece's `human`). The kick moves least, so the bar
// line stays where it is; the lead is only ever late, never early.
import { bassNote } from './chords.js';

export const HUMAN = { keysMs: 6, bassMs: 6, drumsMs: 5, kickMs: 2.5, leadLateMs: [4, 18], velocity: 0.05 };
const KEYS = {   // comping rhythms as [start beat, length in beats], with a weight; an empty list is a bar of rest
  ballad: [[3, [[0, 3.5]]], [3, [[0, 1.5], [1.5, 2.5]]], [2, [[0, 2.5], [2.5, 1.5]]], [1, [[0, 2], [3.5, 0.5]]], [1, [[1, 3]]], [0.6, []]],
  modal: [[3, [[0, 4]]], [2, [[0, 1.5], [1.5, 2.5]]], [1.5, [[1.5, 2.5]]], [1.5, [[0, 1], [2.5, 1.5]]], [0.8, []]],
  bossa: [[3, [[0, 1.4], [1.5, 1.4], [3, 1]]], [2, [[0.5, 1.4], [2, 1.9]]], [2, [[0, 2.4], [2.5, 1.5]]], [1.5, [[0, 1.4], [2, 1], [3.5, 0.5]]]],
  fusion: [[3, [[0, 0.6], [1.5, 0.9], [2.75, 1.2]]], [3, [[0, 1.4], [1.75, 0.5], [2.5, 0.5], [3.5, 0.5]]], [2, [[0.5, 0.5], [1.5, 1.2], [3, 0.9]]], [2, [[0, 2.2], [2.75, 1.2]]], [1, [[0.75, 1], [2.5, 1.4]]]],
};
const weighted = (r, pool) => { let u = r() * pool.reduce((s, q) => s + q[0], 0); for (const q of pool) if ((u -= q[0]) <= 0) return q[1]; return pool[0][1]; };
const jit = (c, ms) => (c.r() - 0.5) * 2 * ms * (c.P.human ?? 1) / 1000, vary = (c, v) => Math.max(0.05, Math.min(0.95, (v + (c.r() - 0.5) * 2 * HUMAN.velocity * (c.P.human ?? 1)) * c.lay.dyn));

export function writeKeys(c) {
  const { P, r, out, lay } = c;
  for (const ch of c.chords) {
    const v = ch.voicing, span = (ch.span || 1) * 4, soft = lay.intro ? 0.36 : 0.45;
    const add = (on, len, vel, notes = v, roll = 0.008 + 0.02 * r()) => out.keys.push({ beat: ch.beat + on, beats: len * 0.92, notes, vel: vary(c, vel), roll, j: jit(c, HUMAN.keysMs) });
    if (lay.final) { add(0, 4, 0.46, v, 0.06); continue; }
    if (P.feel === 'dnb') {   // slow harmony: the chord is laid down once and left to ring; held bars may answer with its top notes
      if (!ch.held) add(0, span - 0.5, soft, v, 0.03); else if (r() < 0.45 && !lay.intro) add(r() < 0.5 ? 1.5 : 2.5, 1.2, soft - 0.1, v.slice(2).map((m) => m + 12), 0.02);
      continue;
    }
    const pat = lay.intro ? [[0, ch.beats]] : ch.beats < 4 ? (P.feel === 'fusion' ? [[0, 0.6], [0.75, 1]] : r() < 0.6 ? [[0, 1.8]] : [[0, 1], [1.5, 0.5]]) : weighted(r, KEYS[P.feel]);
    pat.forEach(([on, len], i) => add(on, len, soft + 0.02 - 0.04 * i));
  }
  // the fill: on the last bar of a section the piano plays the coming chord half a beat early
  if (lay.fill && c.nextVoicing && !lay.final && P.feel !== 'dnb') out.keys.push({ beat: 3.5, beats: 0.45, notes: c.nextVoicing, vel: vary(c, 0.4), roll: 0.01, j: jit(c, HUMAN.keysMs) });
}

export function writeBass(c) {
  const { P, r, out, lay } = c, guitar = P.band.bass === 'guitar', simple = lay.bass === 'simple';
  c.chords.forEach((ch, i) => {
    const n = bassNote(ch.root), fifth = n - 5 >= 31 ? n - 5 : n + 7, nxt = c.chords[i + 1]?.root ?? c.nextRoot, toward = nxt === undefined ? n : bassNote(nxt), b0 = ch.beat, base = 0.6;
    const add = (beat, m, beats, dv = 0, extra = {}) => out.bass.push({ beat: b0 + beat, m, beats: beats * 0.9, vel: vary(c, base + dv), j: jit(c, HUMAN.bassMs), ...extra });
    const tone = () => { const iv = ((ch.pcs[r() < 0.5 ? 1 : 3] - ch.root) + 12) % 12; return n + iv <= 50 ? n + iv : n + iv - 12; };
    if (lay.final) return add(0, n, 4, 0, guitar ? { style: 'finger' } : {});
    if (guitar && P.feel === 'fusion') {
      const first = c.st.slide !== undefined ? { slideFrom: c.st.slide } : {}; c.st.slide = undefined;
      if (simple) { add(0, n, 2.4, 0, first); if (ch.beats === 4) add(2.5, fifth, 1.2, -0.06); return; }
      if (ch.beats < 4) { add(0, n, 0.7, 0, first); add(0.75, n, 0.2, -0.2, { style: 'ghost' }); add(1.5, n + 12, 0.3, -0.04, { style: 'pop' }); return; }
      const T = [   // sixteenth-note lines: [beat, note, length, velocity change, style]
        [[0, n, 0.7], [0.75, n, 0.2, -0.2, 'ghost'], [1.5, n + 12, 0.3, -0.04, 'pop'], [2, n, 0.5], [2.75, n, 0.2, -0.2, 'ghost'], [3, tone(), 0.5, -0.04], [3.5, toward - 1, 0.45, -0.06]],
        [[0, n, 0.5], [0.5, n, 0.2, -0.2, 'ghost'], [0.75, n, 0.7], [1.75, tone(), 0.25, -0.04, 'pop'], [2.5, n, 0.5], [3.25, n, 0.2, -0.2, 'ghost'], [3.5, toward + 1, 0.45, -0.06]],
        [[0, n, 1], [1.5, n + 12, 0.25, -0.02, 'pop'], [1.75, n, 0.2, -0.2, 'ghost'], [2, fifth, 0.5, -0.04], [2.5, n, 0.2, -0.2, 'ghost'], [2.75, tone(), 0.5, -0.03], [3.5, n, 0.25, -0.05], [3.75, n, 0.2, -0.2, 'ghost']],
        [[0, n, 1.5], [1.75, n, 0.2, -0.2, 'ghost'], [2, fifth, 0.75, -0.04], [3, n + 12, 0.25, 0, 'pop'], [3.5, toward - 1, 0.45, -0.06]],
      ][Math.floor(r() * 4)];
      T.forEach(([beat, m, len, dv = 0, style = 'finger'], k) => { if (style === 'ghost' && r() < 0.25) return; add(beat, m, len, dv, { style, ...(k === 0 ? first : {}) }); });
      const tail = T[T.length - 1]; if (tail[0] === 3.5 && Math.abs(tail[1] - toward) === 1 && r() < 0.6) c.st.slide = tail[1];   // slide from the approach note into the next root
      return;
    }
    if (ch.beats < 4) return add(0, n, 2, 0, guitar ? { style: 'finger' } : {});
    if (simple) { add(0, n, P.feel === 'modal' ? 3.4 : 2); if (P.feel !== 'modal') add(2, n, 1.6, -0.06); return; }
    if (lay.fill && !guitar) { add(0, n, 2); add(2, tone(), 0.9, -0.04); add(3, fifth, 0.5, -0.06); add(3.5, toward + (r() < 0.5 ? -1 : 1), 0.5, -0.1); return; }   // walk into the next section
    if (P.feel === 'bossa') {
      add(0, n, 1.5, 0, guitar ? { style: 'finger', ...(c.st.slide !== undefined ? { slideFrom: c.st.slide } : {}) } : {}); c.st.slide = undefined;
      if (guitar && r() < 0.5) add(1.25, n, 0.2, -0.22, { style: 'ghost' });
      add(1.5, fifth, 0.5, -0.1); add(2, fifth, 1.4, -0.04);
      if (guitar && (lay.fill || r() < 0.22)) { add(3, n + 12, 0.3, -0.02, { style: 'pop' }); add(3.5, toward - 1, 0.45, -0.08); c.st.slide = toward - 1; } else add(3.5, n, 0.5, -0.1);
    } else if (P.feel === 'modal') { add(0, n, 3); if (r() < 0.6) add(r() < 0.5 ? 3 : 3.5, r() < 0.5 ? fifth : n + 12, 0.8, -0.1); }
    else { add(0, n, 2); add(2, r() < 0.55 ? n : fifth, 1.5, -0.05); if (r() < 0.35) add(3.5, toward + (r() < 0.5 ? -1 : 1), 0.5, -0.14); }
  });
}

// The sub: one long note per chord, struck again off the beat, sometimes moving to the fifth; and, where the piece has
// them, short bass guitar figures an octave and more above the sub at the ends of phrases, so the two never share a band.
const subNote = (pc) => (pc >= 7 ? 24 + pc : 36 + pc);   // G1 (49 Hz) to F-sharp 2 (92 Hz): low, and still there on small speakers
export function writeSub(c) {
  const { P, r, out, lay } = c;
  for (const ch of c.chords) {
    const n = subNote(ch.root), fifth = n + 7 <= 42 ? n + 7 : n - 5, add = (beat, m, beats, dv = 0, extra = {}) => out.sub.push({ beat: ch.beat + beat, m, beats, vel: vary(c, 0.62 + dv), ...extra });
    if (lay.final) { add(0, n, 4); continue; }
    if (lay.bass === 'simple') { add(0, n, 3.8); continue; }
    const cell = Math.floor(r() * (ch.held ? 4 : 3));
    if (cell === 0) add(0, n, 3.6); else if (cell === 1) { add(0, n, 2.6); add(2.75, n, 1.1, -0.05); } else if (cell === 2) { add(0, n, 2.3); add(2.5, fifth, 1.4, -0.05, { slideFrom: n }); } else { add(0.75, n, 1.6, -0.04); add(2.5, n, 1.4); }
  }
  if (P.band.fills === 'guitar' && lay.kit === 'full' && (c.pos === 3 || c.pos === 7) && !lay.final) {
    const ch = c.chords[c.chords.length - 1], top = [ch.pcs[0], ch.pcs[2] ?? ch.pcs[1], ch.pcs[1], ch.pcs[3]].map((pc) => 50 + ((pc - 50) % 12 + 12) % 12).sort((a, b) => a - b), at = [1.5, 2, 2.75, 3.5];
    at.forEach((beat, k) => { if (k === 2 && r() < 0.4) return; out.bass.push({ beat, m: top[k % top.length] + (k === 3 ? 12 : 0), beats: 0.35, vel: vary(c, 0.5), j: jit(c, HUMAN.bassMs), style: k === 3 ? 'pop' : 'finger', voice: 'guitar' }); });
  }
}

export function writeDrums(c) {
  const { P, r, out, lay, index } = c, level = lay.kit; if (level === 'none') return;
  const full = level === 'full', light = level === 'light' || full;
  const d = (beat, piece, vel, dur) => out.drums.push({ beat, piece, vel: vary(c, vel), dur, j: jit(c, piece.endsWith('kick') ? HUMAN.kickMs : HUMAN.drumsMs) });
  if (P.band.kit === 'brush') {
    if (P.feel === 'bossa') {
      for (let k = 0; k < 8; k++) if (light || k % 2 === 0) d(k / 2, 'pedal', k % 2 ? 0.26 : 0.38); d(0, 'sweep', 0.25, 4);
      if (light) { d(0, 'ride', 0.34); d(2, 'ride', 0.3); }
      if (full) { for (const t of index % 2 ? [1, 2.5] : [0, 1.5, 3]) d(t, 'tap', 0.3); [[0, 0.4], [1.5, 0.25], [2, 0.35], [3.5, 0.25]].forEach(([t, v]) => d(t, 'kick', v)); }
    } else if (P.feel === 'modal') {
      d(0, 'sweep', 0.4, 4); if (light) { for (let k = 0; k < 4; k++) d(k, 'ride', k % 2 ? 0.4 : 0.48); if (r() < 0.5) d(r() < 0.5 ? 2.5 : 3.5, 'ride', 0.28); d(1, 'pedal', 0.28); d(3, 'pedal', 0.28); }
      if (full) { d(2, 'tap', 0.35); if (r() < 0.25) d(3.5, 'tap', 0.15); if (r() < 0.9) d(0, 'kick', 0.4); if (r() < 0.25) d(1.5, 'kick', 0.26); }
    } else {
      d(0, 'sweep', 0.45, 2); d(2, 'sweep', 0.4, 2);
      if (light) { [[0, 0.5], [1, 0.42], [1.5, 0.3], [2, 0.48], [3, 0.42], [3.5, 0.3]].forEach(([t, v]) => { if (t % 1 === 0 || r() > 0.12) d(t, 'ride', v); }); d(1, 'pedal', 0.3); d(3, 'pedal', 0.3); }
      if (full) { d(1, 'tap', 0.32); d(3, 'tap', 0.32); if (r() < 0.85) d(0, 'kick', 0.4); if (r() < 0.2) d(2.5, 'kick', 0.28); }
    }
    if (lay.fill && light) { d(2, 'sweep', 0.55, 2); [[2.5, 0.2], [3, 0.3], [3.5, 0.38]].forEach(([t, v]) => d(t, 'tap', v)); }   // a swell and three taps into the next section
    return;
  }
  if (P.band.kit === 'tight') {   // the kick follows the bass guitar's strong notes, so the two lock
    for (let k = 0; k < 8; k++) d(k / 2, 'fk:hat', k % 2 ? 0.34 : 0.46); if (light) for (const s of [0.25, 1.75, 2.25, 3.75]) if (r() < 0.3) d(s, 'fk:hat', 0.2);
    if (light) { d(1, full ? 'fk:snare' : 'fk:rim', full ? 0.46 : 0.4); d(3, full ? 'fk:snare' : 'fk:rim', full ? 0.48 : 0.4); }
    if (full) { d(0, 'fk:kick', 0.5); const strong = out.bass.filter((e) => e.style !== 'ghost' && e.beat >= 1.4 && e.beat < 3.6 && e.beat % 1 !== 0).map((e) => e.beat).slice(0, 2); for (const b of strong) d(b, 'fk:kick', 0.38);
      for (const s of [1.75, 2.25, 3.75]) if (r() < 0.3) d(s, 'fk:snare', 0.13); if (r() < 0.2) d(3.5, 'fk:ohat', 0.3); }
    if (lay.fill && light) for (let k = 0; k < 4; k++) d(3 + k / 4, k === 3 ? 'fk:rim' : 'fk:snare', 0.2 + 0.08 * k);
    return;
  }
  // the break: each half bar is one of a few cells (kick and snare placements in sixteenths), chosen so the snare keeps
  // the backbeat while the kicks and ghost notes move. s: snare, k: kick, g: ghost snare.
  const CELLS = [[[0, 'k'], [4, 's']], [[2, 'k'], [4, 's'], [7, 'g']], [[0, 'k'], [3, 'k'], [4, 's'], [6, 'g']], [[1, 'g'], [2, 'k'], [4, 's']], [[0, 'k'], [4, 's'], [5, 'g'], [7, 'g']], [[4, 's'], [6, 'k'], [7, 'g']]];
  for (let k = 0; k < 8; k++) d(k / 2, index % 16 >= 8 && full ? 'fk:ride' : 'fk:hat', k % 2 ? 0.3 : 0.42); if (light) for (let s = 1; s < 16; s += 2) if (r() < 0.22) d(s / 4, 'fk:hat', 0.18);
  if (light) for (let h = 0; h < 2; h++) { const cell = h === 0 ? CELLS[[0, 0, 2, 3][Math.floor(r() * 4)]] : CELLS[1 + Math.floor(r() * 5)];
    for (const [s, what] of cell) { if (what === 'k' && !full && s !== 0) continue; d(h * 2 + s / 4, what === 'k' ? 'fk:kick' : 'fk:snare', what === 'k' ? (s === 0 ? 0.5 : 0.4) : what === 's' ? (full ? 0.46 : 0.34) : 0.13); } }
  if (lay.fill && light) { for (let k = 0; k < 4; k++) d(3 + k / 4, 'fk:snare', 0.14 + 0.07 * k); d(3.875, 'fk:snare', 0.3); }   // a roll into the next section
}
