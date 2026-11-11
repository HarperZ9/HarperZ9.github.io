// score.js: the composer. From a piece and a seed it writes the music one bar at a time: which chords, how the electric
// piano voices and places them, the bass line, the brushed kit, the pad, and lead phrases with long rests between them.
// It is pure data (no audio, no clock), so the offline render, the live worker and the tests all get the same bars from
// the same seed. Times inside a bar are in beats (0 to 4); the renderer turns beats into seconds and applies the swing.
import { rng } from '../../world/sound/sound/v3/instruments/core.js';
import { parse, voice, bassNote, transpose, NOTE } from './chords.js';
import { PIECES } from './pieces.js';

const KEYS = {   // comping rhythms as [start beat, length in beats], with a weight; an empty list is a bar of rest
  ballad: [[3, [[0, 3.5]]], [3, [[0, 1.5], [1.5, 2.5]]], [2, [[0, 2.5], [2.5, 1.5]]], [1, [[0, 2], [3.5, 0.5]]], [1, [[1, 3]]], [0.6, []]],
  modal: [[3, [[0, 4]]], [2, [[0, 1.5], [1.5, 2.5]]], [1.5, [[1.5, 2.5]]], [1.5, [[0, 1], [2.5, 1.5]]], [0.8, []]],
  bossa: [[3, [[0, 1.4], [1.5, 1.4], [3, 1]]], [2, [[0.5, 1.4], [2, 1.9]]], [2, [[0, 2.4], [2.5, 1.5]]], [1.5, [[0, 1.4], [2, 1], [3.5, 0.5]]]],
};
const RHYTHMS = [[1, 0.5, 0.5, 2.5], [0.5, 0.5, 1, 3], [1.5, 0.5, 3], [2, 1, 3.5], [0.5, 1, 0.5, 1, 3], [1, 1, 0.5, 0.5, 3], [3], [1.5, 2.5], [0.5, 0.5, 0.5, 0.5, 2.5]];
const STEPS = [-2, -1, -1, -1, 1, 1, 1, 2];
const hash = (id, seed) => { let h = 2166136261 ^ seed; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) || 1; };

export function composer(id, { seed = 1, total = Infinity } = {}) {
  const P = PIECES[id]; if (!P) throw new Error(`unknown piece ${id}`);
  const r = rng(hash(id, seed)), pick = (a) => a[Math.floor(r() * a.length)], weighted = (pool) => { let u = r() * pool.reduce((s, q) => s + q[0], 0); for (const q of pool) if ((u -= q[0]) <= 0) return q[1]; return pool[0][1]; };
  const tonic = parse(P.tonic), dominant = NOTE[(tonic.root + 7) % 12] + (tonic.type.startsWith('m') ? '7alt' : 'sus13');
  const st = { index: 0, section: null, plan: [], prev: null, lead: [], leadFree: 32 + 2 * Math.floor(r() * 3), motif: null, lastLead: (P.lead.range[0] + P.lead.range[1]) >> 1, drumsOut: 0 };

  function extend() {
    const nx = st.section ? P.next[st.section] : { A: 1 }; let u = r(), name = Object.keys(nx)[0]; for (const [k, w] of Object.entries(nx)) if ((u -= w) <= 0) { name = k; break; }
    st.section = name; const bars = P.sections[name].map((s) => s.split(' '));
    bars.forEach((syms, pos) => {
      const chords = syms.map((sym, i) => ({ sym, beat: i * 4 / syms.length, beats: 4 / syms.length }));
      for (const c of chords) { const q = parse(c.sym), u2 = r();   // seeded colour: a dominant may turn suspended, or move a tritone away
        if (q.type === '13' && u2 < 0.14) c.sym = transpose(c.sym, 0, 'sus13'); else if (q.type === '13' && u2 < 0.26 && pos < 7 && syms.length === 1 && parse(bars[pos + 1][0]).root === (q.root + 5) % 12) c.sym = transpose(c.sym, 6, '13');   // only where it resolves down a semitone
        else if (q.type === 'maj9' && u2 < 0.12) c.sym = transpose(c.sym, 0, '6/9'); else if (q.type === 'm9' && u2 < 0.12) c.sym = transpose(c.sym, 0, 'm11'); }
      st.plan.push({ section: name, pos, chords, breather: pos < 4 && st.plan.length + st.index > 20 && name !== 'A' && pos === 0 ? r() < 0.3 : false });
    });
  }
  const chordAt = (abs, cur) => { const k = Math.floor(abs / 4) - cur.index, b = k <= 0 ? cur : st.plan[k - 1], beat = abs - (cur.index + Math.max(0, k)) * 4; if (!b) return null; let c = b.chords[0]; for (const q of b.chords) if (q.beat <= beat + 1e-9) c = q; return { ...parse(c.sym), end: (cur.index + Math.max(0, k)) * 4 + c.beat + c.beats }; };
  const ladder = (ch, short) => { const ok = new Set(ch.pcs); if (short) for (const pc of P.scale) if (!ch.pcs.includes((pc + 11) % 12)) ok.add(pc); const out = []; for (let m = P.lead.range[0]; m <= P.lead.range[1]; m++) if (ok.has(m % 12)) out.push(m); return out; };
  const nearest = (list, m) => list.reduce((b, x, i) => (Math.abs(x - m) < Math.abs(list[b] - m) ? i : b), 0);

  function phrase(cur, start) {
    const reuse = st.motif && r() < 0.55, rhythm = reuse ? st.motif.rhythm : pick(RHYTHMS), steps = reuse ? st.motif.steps.slice() : rhythm.map(() => pick(STEPS));
    if (reuse && r() < 0.6) steps[Math.floor(r() * steps.length)] = pick(STEPS); st.motif = { rhythm, steps };
    let beat = start, m = st.lastLead + pick([-4, -2, 0, 0, 2, 3]); const out = [];
    rhythm.forEach((len, i) => {
      const last = i === rhythm.length - 1, ch = chordAt(beat, cur); if (!ch) return;
      let lad = ladder(ch, len <= 0.5 && !last); if (last) { const guide = [ch.pcs[1], ch.pcs[3], ch.pcs[4] ?? ch.pcs[2]]; lad = lad.filter((x) => guide.includes(x % 12)); }
      const at = nearest(lad, m) + (i === 0 ? 0 : steps[i]); m = lad[Math.max(0, Math.min(lad.length - 1, at))];
      let beats = len; if (beat + len > ch.end + 1e-9) { const nx = chordAt(ch.end, cur); if (!nx || !nx.pcs.includes(m % 12)) beats = Math.max(0.5, ch.end - beat); }
      out.push({ abs: beat, m, beats: beats * (last ? 0.96 : 0.9), vel: 0.5 + 0.12 * r() - (last ? 0.04 : 0) }); beat += len;
    });
    st.lastLead = Math.max(P.lead.range[0] + 4, Math.min(P.lead.range[1] - 4, m)); st.leadFree = beat + P.lead.rest[0] + Math.floor(r() * (P.lead.rest[1] - P.lead.rest[0] + 1));
    return out;
  }

  function next() {
    while (st.plan.length < 4) extend();
    const b = st.plan.shift(), index = st.index++, left = total - index, final = left === 1;
    if (final) b.chords = [{ sym: P.tonic, beat: 0, beats: 4 }]; else if (left === 2) b.chords = [{ sym: dominant, beat: 0, beats: 4 }];
    if (b.breather) st.drumsOut = 4;
    const lay = { keys: index >= 1, bass: index >= 4, drums: index >= 4 && left > 2 && st.drumsOut-- <= 0, lead: index >= 8 && left > 5 }, intro = index < 4;
    const chords = b.chords.map((c) => ({ ...parse(c.sym), beat: c.beat, beats: c.beats })), out = { index, section: b.section, pos: b.pos, chords, keys: [], bass: [], drums: [], lead: [], pad: [] }, cur = { index, chords: b.chords };
    const jit = (ms) => (r() - 0.5) * 2 * ms / 1000;
    for (const c of chords) {
      const v = voice(c.sym, st.prev); st.prev = v; out.pad.push({ beat: c.beat, beats: c.beats, notes: v.slice(0, 3), vel: 0.5 });
      if (!lay.keys) continue;
      const pat = final || intro ? [[0, c.beats]] : c.beats < 4 ? (r() < 0.6 ? [[0, 1.8]] : [[0, 1], [1.5, 0.5]]) : weighted(KEYS[P.feel]);
      pat.forEach(([on, len], i) => out.keys.push({ beat: c.beat + on, beats: len * 0.92, notes: v, vel: (intro ? 0.36 : 0.44) + 0.12 * r() - 0.05 * i, roll: final ? 0.06 : 0.008 + 0.02 * r(), j: jit(5) }));
    }
    if (lay.bass) chords.forEach((c, i) => {
      const n = bassNote(c.root), fifth = n - 5 >= 31 ? n - 5 : n + 7, nxt = chords[i + 1] || (st.plan[0] && parse(st.plan[0].chords[0].sym)), vel = 0.58 + 0.1 * r(), add = (beat, m, beats, dv = 0) => out.bass.push({ beat: c.beat + beat, m, beats: beats * 0.9, vel: vel + dv, j: jit(6) });
      if (final) return add(0, n, 4);
      if (c.beats < 4) return add(0, n, 2);
      if (P.feel === 'bossa') { add(0, n, 1.5); add(1.5, fifth, 0.5, -0.1); add(2, fifth, 1.5, -0.04); add(3.5, n, 0.5, -0.1); }
      else if (P.feel === 'modal') { add(0, n, 3); if (r() < 0.6) add(r() < 0.5 ? 3 : 3.5, r() < 0.5 ? fifth : n + 12, 0.8, -0.1); }
      else { add(0, n, 2); add(2, r() < 0.55 ? n : fifth, 1.5, -0.05); if (nxt && r() < 0.35) add(3.5, bassNote(nxt.root) + (r() < 0.5 ? -1 : 1), 0.5, -0.14); }
    });
    if (lay.drums) {
      const d = (beat, piece, vel, dur) => out.drums.push({ beat, piece, vel: vel * (0.9 + 0.2 * r()), dur, j: jit(piece === 'kick' ? 3 : 7) });
      if (P.feel === 'bossa') { for (let k = 0; k < 8; k++) d(k / 2, 'pedal', k % 2 ? 0.26 : 0.38); d(0, 'ride', 0.34); d(2, 'ride', 0.3); for (const t of index % 2 ? [1, 2.5] : [0, 1.5, 3]) d(t, 'tap', 0.3);
        [[0, 0.4], [1.5, 0.25], [2, 0.35], [3.5, 0.25]].forEach(([t, v]) => d(t, 'kick', v)); d(0, 'sweep', 0.25, 4); }
      else if (P.feel === 'modal') { for (let k = 0; k < 4; k++) d(k, 'ride', k % 2 ? 0.4 : 0.48); if (r() < 0.5) d(r() < 0.5 ? 2.5 : 3.5, 'ride', 0.28); d(0, 'sweep', 0.4, 4); d(2, 'tap', 0.35); if (r() < 0.25) d(3.5, 'tap', 0.15);
        d(1, 'pedal', 0.28); d(3, 'pedal', 0.28); if (r() < 0.9) d(0, 'kick', 0.4); if (r() < 0.25) d(1.5, 'kick', 0.26); }
      else { [[0, 0.5], [1, 0.42], [1.5, 0.3], [2, 0.48], [3, 0.42], [3.5, 0.3]].forEach(([t, v]) => { if (t % 1 === 0 || r() > 0.12) d(t, 'ride', v); }); d(0, 'sweep', 0.45, 2); d(2, 'sweep', 0.4, 2); d(1, 'tap', 0.32); d(3, 'tap', 0.32);
        d(1, 'pedal', 0.3); d(3, 'pedal', 0.3); if (r() < 0.85) d(0, 'kick', 0.4); if (r() < 0.2) d(2.5, 'kick', 0.28); }
    }
    if (lay.lead && !st.lead.length && index * 4 >= st.leadFree) st.lead = phrase(cur, index * 4 + pick([0.5, 1, 1.5, 2, 2.5]));
    out.lead = st.lead.filter((e) => e.abs < index * 4 + 4).map((e) => ({ beat: e.abs - index * 4, m: e.m, beats: e.beats, vel: e.vel })); st.lead = st.lead.filter((e) => e.abs >= index * 4 + 4);
    return out;
  }
  return { id, piece: P, seed, next };
}

// A whole piece of a fixed length, with an introduction and an ending.
export function compose(id, { seed = 1, bars = 48 } = {}) { const c = composer(id, { seed, total: bars }), out = []; for (let i = 0; i < bars; i++) out.push(c.next()); return { id, piece: c.piece, seed, bars: out }; }
