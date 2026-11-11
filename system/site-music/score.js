// score.js: the composer. From a piece and a seed it writes the music one bar at a time. It is pure data (no audio, no
// clock), so the offline render, the live worker and the tests all get the same bars from the same seed.
// A piece has a shape made of roles, each an eight-bar section (the introduction and ending are shorter):
//   intro       pad, then the electric piano; the last bar leads in
//   statement   the band comes in one layer at a time (bass, then a whisper of the kit, then the light kit, then the
//               full kit, then the lead with the theme)
//   middle      a different section of the harmony, the kit pulled back to its light form, the lead developing the
//               theme higher up
//   return      the opening harmony, the full band, the theme again
//   ending      the kit thins, the cadence (ii, V) resolves to the home chord, which is held
// A piece of a fixed length is intro, two statements, then middle and return in turn, then the ending. The endless live
// form is the same without an ending. The last bar of each section carries a fill.
import { rng } from '../../world/sound/sound/v3/instruments/core.js';
import { parse, voice, transpose } from './chords.js';
import { PIECES } from './pieces.js';
import { writeKeys, writeBass, writeSub, writeDrums, HUMAN } from './parts.js';
import { newLead, phrase } from './lead.js';

const hash = (id, seed) => { let h = 2166136261 ^ seed; for (const ch of id) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) || 1; };
const DYN = { intro: 0.88, statement: 1, middle: 0.9, return: 1.05, ending: 0.92 };

// The roles of a piece `total` bars long: [{ role, bars }]. Infinity gives the endless form (a generator of sections).
export function shapeOf(P, total) {
  const intro = P.intro ?? 4; if (!Number.isFinite(total)) return null;
  const sections = Math.max(1, Math.floor((total - intro - 4) / 8)), ending = total - intro - sections * 8, out = [{ role: 'intro', bars: intro }];
  for (let i = 0; i < sections; i++) out.push({ role: i < 2 ? 'statement' : i === sections - 1 || (i - 2) % 2 === 1 ? 'return' : 'middle', bars: 8 });
  out.push({ role: 'ending', bars: ending }); return out;
}

// opts.staged = false and opts.loop = true are defects for the ear's controls: the band arriving all at once, and the
// first statement repeated note for note in place of every later section.
export function composer(id, { seed = 1, total = Infinity, staged = true, loop = false } = {}) {
  const P = PIECES[id]; if (!P) throw new Error(`unknown piece ${id}`);
  const r = rng(hash(id, seed)), tonic = parse(P.tonic), plan = shapeOf(P, total), L = newLead(P, r);
  const lead3 = L.theme.rhythm.slice(0, Math.min(3, L.theme.rhythm.length - 1)).reduce((a, d) => a + d, 0) * (P.lead.stretch || 1), closeAt = (total - 1) * 4 - lead3;
  const st = { index: 0, section: null, queue: [], prev: null, sectionNo: 0, statements: 0, slide: undefined, looped: null, copy: [] };

  // one section of harmony as bars: [{ chords: [{ sym, beat, beats, held, span }] }], with "=" resolved and the seeded colours applied
  function harmony(name) {
    const src = P.sections[name].map((s) => s.split(' ')), bars = []; let last = null;
    src.forEach((syms, pos) => {
      if (syms[0] === '=') { last.span++; bars.push({ chords: [{ sym: last.sym, beat: 0, beats: 4, held: true, span: 1 }] }); return; }
      const chords = syms.map((sym, i) => ({ sym, beat: i * 4 / syms.length, beats: 4 / syms.length, held: false, span: 1 }));
      for (const c of chords) { const q = parse(c.sym), u = r(), nx = src[pos + 1] && src[pos + 1][0] !== '=' ? parse(src[pos + 1][0]).root : null;
        if (q.type === '13' && u < 0.14) c.sym = transpose(c.sym, 0, 'sus13'); else if (q.type === '13' && u < 0.26 && syms.length === 1 && nx === (q.root + 5) % 12) c.sym = transpose(c.sym, 6, '13');   // a tritone away, only where it resolves down a semitone
        else if (q.type === 'maj9' && u < 0.12) c.sym = transpose(c.sym, 0, '6/9'); else if (q.type === 'm9' && u < 0.12) c.sym = transpose(c.sym, 0, 'm11'); }
      last = chords[chords.length - 1]; bars.push({ chords });
    });
    return bars;
  }
  // after a section is cut, a held bar at the front becomes a fresh chord and every chord's span is counted again
  function respan(bars) { if (bars[0]) bars[0].chords[0].held = false; bars.forEach((b, i) => { const c = b.chords[b.chords.length - 1]; c.span = 1; for (let k = i + 1; k < bars.length && bars[k].chords[0].held; k++) c.span++; }); return bars; }
  function pickSection(role) {
    if (role === 'middle') return P.middle; if (role === 'return' || role === 'intro' || role === 'ending' || !st.section || st.statements === 0) return 'A';
    const nx = P.next[st.section] || { A: 1 }; let u = r(); for (const [k, w] of Object.entries(nx)) if ((u -= w) <= 0) return k; return 'A';
  }
  function extend() {
    const no = st.sectionNo++, sec = plan ? plan[no] : no === 0 ? { role: 'intro', bars: P.intro ?? 4 } : { role: no <= 2 ? 'statement' : ['middle', 'return', 'statement'][(no - 3) % 3], bars: 8 };
    if (!sec) throw new Error('the piece has ended');
    const name = pickSection(sec.role); let bars = harmony(name);
    if (sec.role === 'intro') bars = respan(bars.slice(8 - sec.bars));
    if (sec.role === 'ending') { const fill = harmony('A').slice(0, Math.max(0, sec.bars - 3)); bars = [...fill, ...P.cadence.map((sym) => ({ chords: [{ sym, beat: 0, beats: 4, held: false, span: 1 }] })), { chords: [{ sym: P.tonic, beat: 0, beats: 4, held: false, span: 1 }] }].slice(-sec.bars); bars = respan(bars); }
    if (sec.role === 'statement') st.statements++; st.section = name === P.middle ? st.section : name;
    bars.forEach((b, pos) => st.queue.push({ ...b, section: name, role: sec.role, pos, len: bars.length, first: sec.role === 'statement' && st.statements === 1, last: sec.role === 'ending' && pos === bars.length - 1 }));
  }
  const chordAt = (abs, cur) => { const k = Math.floor(abs / 4) - cur.index, b = k <= 0 ? cur : st.queue[k - 1], base = (cur.index + Math.max(0, k)) * 4, beat = abs - base; if (!b) return null; let c = b.chords[0]; for (const q of b.chords) if (q.beat <= beat + 1e-9) c = q; return { ...parse(c.sym), end: base + c.beat + c.beats }; };

  // how much of the band plays in this bar
  function layers(b, left) {
    const p = b.pos, dyn = DYN[b.role], lay = { keys: true, bass: 'full', kit: 'full', lead: true, fill: p === b.len - 1 && b.role !== 'intro' && b.role !== 'ending', final: b.last, intro: b.role === 'intro', dyn };
    if (b.role === 'intro') Object.assign(lay, { keys: p >= Math.min(1, b.len - 1) && !(P.feel === 'dnb' && p < 2), bass: 'none', kit: p === b.len - 1 || (P.feel === 'dnb' && p >= 4) ? 'whisper' : 'none', lead: false });
    else if (b.first && staged) Object.assign(lay, { bass: p < 2 ? 'simple' : 'full', kit: p < 1 ? 'none' : p < 2 ? 'whisper' : p < 4 ? 'light' : 'full', lead: p >= 5, dyn: p < 2 ? 0.8 : p < 4 ? 0.9 : dyn });   // each layer also comes in quietly
    else if (b.role === 'middle') Object.assign(lay, { bass: p < 5 ? 'simple' : 'full', kit: p < 6 ? 'light' : 'full', lead: p >= 1, dyn: dyn + 0.03 * Math.max(0, p - 4) });   // the last bars build toward the return
    else if (b.role === 'ending') Object.assign(lay, { kit: left > 3 ? 'light' : left > 1 ? 'whisper' : 'none', bass: left > 3 ? 'full' : 'simple', lead: left > 6 });
    return lay;
  }

  function next() {
    while (st.queue.length < 4 && !(plan && st.sectionNo >= plan.length)) extend();
    const b = st.queue.shift(); if (!b) throw new Error('the piece has ended');
    const index = st.index++, left = total - index, lay = layers(b, left), nxt = st.queue[0];
    if (loop && st.looped && b.role !== 'ending') { const src = st.looped[(index - st.loopStart) % 8], copy = JSON.parse(JSON.stringify(src)); copy.index = index; copy.role = b.role; copy.pos = b.pos; return copy; }
    const chords = b.chords.map((c) => { const q = { ...parse(c.sym), beat: c.beat, beats: c.beats, held: c.held, span: c.span }; q.voicing = c.held && st.prev ? st.prev : voice(c.sym, st.prev); st.prev = q.voicing; return q; });
    const out = { index, section: b.section, role: b.role, pos: b.pos, level: lay.kit, chords, keys: [], bass: [], sub: [], drums: [], lead: [], pad: [] }, cur = { index, chords: b.chords };
    const c = { P, r, out, chords, nextRoot: nxt ? parse(nxt.chords[0].sym).root : undefined, nextVoicing: nxt && !nxt.chords[0].held ? voice(nxt.chords[0].sym, st.prev) : null, lay, index, pos: b.pos, role: b.role, st };
    for (const ch of chords) if (!ch.held) out.pad.push({ beat: ch.beat, beats: ch.beats + (ch.span - 1) * 4, notes: ch.voicing.slice(0, 3), vel: 0.5 * lay.dyn });
    if (lay.keys) writeKeys(c);
    if (lay.bass !== 'none') { if (P.band.bass === 'sub') writeSub(c); else writeBass(c); }
    writeDrums(c);
    // the close: the opening of the theme once more, timed so that its last long note lands on the first beat of the final bar
    if (Number.isFinite(total) && !st.closed && closeAt >= index * 4 && closeAt < index * 4 + 4) {
      st.closed = true; L.queue = L.queue.filter((e) => e.abs + e.beats < closeAt - 0.5);
      L.queue.push(...phrase(L, P, r, 'ending', closeAt, (abs) => chordAt(abs, cur), { dyn: lay.dyn, tonic }).map((e) => ({ ...e, j: 0.008 * (P.human ?? 1) }))); out.restAt = L.restAt - index * 4;
    } else if (lay.lead && !L.queue.length && index * 4 >= L.free && !(st.closed)) {
      const late = HUMAN.leadLateMs, lag = () => (late[0] + (late[1] - late[0]) * r()) * (P.human ?? 1) / 1000;
      L.queue = phrase(L, P, r, b.role, index * 4 + [0.5, 1, 1.5, 2, 2.5][Math.floor(r() * 5)], (abs) => chordAt(abs, cur), { dyn: lay.dyn, tonic }).map((e) => ({ ...e, j: lag() }));
      out.restAt = L.restAt - index * 4;   // beats from this bar's start to where the lead falls silent again: the sea listens for it
    }
    out.lead = L.queue.filter((e) => e.abs < index * 4 + 4).map((e) => ({ beat: e.abs - index * 4, m: e.m, beats: e.beats, vel: e.vel, j: e.j, kind: e.kind })); L.queue = L.queue.filter((e) => e.abs >= index * 4 + 4);
    if (loop && b.first) { st.copy.push(out); if (st.copy.length === 8) { st.looped = st.copy; st.loopStart = index + 1; } }
    return out;
  }
  return { id, piece: P, seed, next, shape: plan, kinds: () => L.kinds.slice() };
}

// A whole piece of a fixed length.
export function compose(id, { seed = 1, bars = 48, ...opts } = {}) { const c = composer(id, { seed, total: bars, ...opts }), out = []; for (let i = 0; i < bars; i++) out.push(c.next()); return { id, piece: c.piece, seed, bars: out, shape: c.shape, kinds: c.kinds() }; }
