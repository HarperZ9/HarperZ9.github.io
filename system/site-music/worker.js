// worker.js: the live form's renderer, off the main thread. It holds the composer and the ambience for one piece and
// renders the next few bars each time it is asked: { cmd: 'start', piece, seed, sr, level } then { cmd: 'chunk', bars }.
// Each reply carries one stereo buffer (music with its tail, and the ambience for exactly those bars) and where its
// first beat sits, so the page can lay chunks end to end. The music matches the offline render of the same seed. The sea
// follows the same rules as offline but knows the score only a few bars ahead, so its waves land a little differently.
//
// Played by a listener (start with parts: true): each chunk comes as parts instead of one mix, one stereo buffer for
// each group a listener can hear apart (live.js GROUPS; the room's reverb stands for the space) and one for the sea,
// so the page sets each group's level at once. bands names the arrangements to render ('main', 'alt' or both), for a
// blend between the two bands over the same bars. Each chunk also lists its notes, so the page can draw them.
// { cmd: 'set', params, from, bands } changes the tempo, key or density (live.js) and, given a bar index, renders again
// from that bar: the bars from there on go back in the queue and the sea starts again at that moment.
//
// Slow devices. Every chunk is timed. The budget is half of real time: a chunk that takes more than 0.5 seconds to render
// per second of audio leaves too little room for the page. Two chunks over budget in a row (after the first two, which
// warm the engine up) step the renderer down one level, and it stays there (it never steps back up, so it cannot flap):
//   level 0   full: four oscillators per pad note, pad chorus, the device's sample rate
//   level 1   lite: two oscillators per pad note, no pad chorus
//   level 2   half: lite, rendered at half the sample rate (the browser resamples on playback; nothing above a quarter of
//             the device rate is heard, which costs the air and the top of the cymbals)
import { composer } from './score.js';
import { renderBars, mixStems, timeline, swung } from './render.js';
import { createAmbience } from './ambience.js';
import { arranged } from './pieces.js';
import { transpose } from './chords.js';
import { GROUPS, GROUP_OF, settle, tuned, thin, transposeOf } from './live.js';

export const LEVELS = [{ name: 'full', quality: 'full', rate: 1 }, { name: 'lite', quality: 'lite', rate: 1 }, { name: 'half', quality: 'lite', rate: 0.5 }];
export const BUDGET = 0.5;   // seconds of rendering allowed per second of audio
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const KEEP = 24;             // bars remembered after they are rendered, so a change can render them again

let st = null;
const BANDS = ['main', 'alt'], bandsOf = (list) => { const b = BANDS.filter((x) => (list || []).includes(x)); return b.length ? b : ['main']; };
export function begin({ piece: id, seed = 1, sr = 48000, level = 0, budget = BUDGET, arrangement = 'main', parts = false, bands = ['main'], params = {} }) {
  const piece = arranged(id, parts ? 'main' : arrangement); if (!piece) throw new Error(`unknown piece ${id}`);
  st = { id, piece, pieces: { main: piece, alt: arranged(id, 'alt') }, parts, bands: bandsOf(bands), seed, deviceSr: sr, level: Math.max(0, Math.min(LEVELS.length - 1, level)), comp: composer(id, { seed }),
    cache: new Map(), origin: 0, leadCount: 0, ahead: [], played: [], composed: 0, over: 0, chunks: 0, budget, amb: null, params: settle(piece, params) };
  st.sr = Math.round(sr * LEVELS[st.level].rate); st.amb = createAmbience({ seed, sr: st.sr, ...piece.ambience });
  return { id, title: piece.title, level: LEVELS[st.level].name, params: st.params };
}
const thinned = (list) => list.map((b) => thin(b, st.params.density, st.seed));
function cueSea(list, t0) {
  const tl = timeline(thinned(list), tuned(st.piece, st.params), { t0, sr: st.sr }); st.amb.cue({ rests: tl.rests, lead: tl.lead.map((n) => [n.t0 - 0.09, n.t1]) }); return tl.end;
}
function stepDown() {
  if (st.level >= LEVELS.length - 1) return false; st.level++; st.over = 0; const sr = Math.round(st.deviceSr * LEVELS[st.level].rate);
  if (sr !== st.sr) { st.sr = sr; st.cache.clear(); const cues = st.amb.cues; st.amb = createAmbience({ seed: st.seed, sr, ...st.piece.ambience, position: st.origin }); st.amb.cue(cues); }
  return true;
}
// compose far enough ahead that the sea knows when the lead will play and rest for about the next eight seconds
function lookAhead(need) {
  const barSec = 240 / st.params.bpm, want = need + Math.ceil(8 / barSec), fresh = []; while (st.ahead.length < want) { const b = st.comp.next(); st.ahead.push(b); fresh.push(b); }
  if (fresh.length) st.composed = cueSea(fresh, st.composed);
}
// The stems as the page plays them: one stereo buffer per group at the piece's levels and its master gain, each cut where
// its tail falls under -80 dB (a kit's tail is short; the room rings longer), and never shorter than the bars themselves.
function group(stems, piece, k, min) {
  const out = {};
  for (const g of GROUPS) {
    const m = mixStems(stems, piece, { only: Object.keys(stems).filter((s) => GROUP_OF[s] === g) });
    let end = m.L.length; while (end > min && Math.abs(m.L[end - 1]) < 1e-4 && Math.abs(m.R[end - 1]) < 1e-4) end--;
    end = Math.min(m.L.length, end + 256); for (let i = 0; i < end; i++) { m.L[i] *= k; m.R[i] *= k; }
    out[g] = { L: m.L.slice(0, end), R: m.R.slice(0, end) };
  }
  return out;
}
// the notes of a chunk for a page to draw: seconds from the chunk's first beat, the part, the pitch (a drum's piece name),
// the length and the velocity
function noteList(list, times, swing, semis) {
  const out = [];
  list.forEach((b, i) => {
    const T = times[i], at = (beat) => T.t0 + swung(beat, swing) * T.beatSec;
    for (const e of b.drums) out.push({ t: at(e.beat), d: 0.06, part: 'drums', m: e.piece, v: e.vel });
    for (const e of b.bass) out.push({ t: at(e.beat), d: e.beats * T.beatSec, part: 'bass', m: e.m + semis, v: e.vel });
    for (const e of b.keys) for (const m of e.notes) out.push({ t: at(e.beat), d: e.beats * T.beatSec, part: 'keys', m: m + semis, v: e.vel });
    for (const n of b.lead) out.push({ t: at(n.beat), d: n.beats * T.beatSec, part: 'lead', m: n.m + semis, v: n.vel ?? 0.7 });
  });
  return out.slice(0, 600);
}
export function chunk({ bars: count = 2 } = {}) {
  const t0 = now(); lookAhead(count); const list = st.ahead.splice(0, count), sr = st.sr, L0 = LEVELS[st.level], p = st.params, play = thinned(list);
  if (st.cache.size > 160) st.cache.clear();   // cached notes are a speed-up only; clearing keeps memory flat on a long listen
  const piece = tuned(st.parts ? st.pieces[st.bands[0]] : st.piece, p), opts = { sr, seed: st.seed, origin: st.origin, cache: st.cache, quality: L0.quality, defects: { leadOffset: st.leadCount, transpose: transposeOf(p.semis) } };
  const r = renderBars(play, piece, opts), amb = st.amb.render(r.n), ag = Math.pow(10, piece.mix.ambience / 20), k = Math.pow(10, piece.masterDb / 20), fin = 2.5, start = st.origin;
  const ramp = (i) => Math.min(1, (start + i / sr) / fin);
  const out = { sr, pre: r.pre, n: r.n, firstBar: list[0].index, level: L0.name, params: { ...p },
    bars: list.map((b) => ({ index: b.index, section: b.section, role: b.role, chords: b.chords.map((c) => (p.semis ? transpose(c.sym, p.semis) : c.sym)) })) };
  if (!st.parts) {
    const mix = mixStems(r.stems, piece);
    for (let i = 0; i < mix.L.length; i++) { mix.L[i] *= k; mix.R[i] *= k; }
    for (let i = 0; i < r.n; i++) { const g = ag * k * ramp(i); mix.L[r.pre + i] += amb.L[i] * g; mix.R[r.pre + i] += amb.R[i] * g; }
    Object.assign(out, { L: mix.L, R: mix.R });
  } else {
    // the sea at the piece's level without the master gain: the page applies the gain of the band, or of the two in a blend
    const min = r.pre + r.n, sea = { L: new Float32Array(min), R: new Float32Array(min) };
    for (let i = 0; i < r.n; i++) { const g = ag * ramp(i); sea.L[r.pre + i] = amb.L[i] * g; sea.R[r.pre + i] = amb.R[i] * g; }
    Object.assign(out, { parts: { [st.bands[0]]: group(r.stems, piece, k, min) }, sea, k: { [st.bands[0]]: k }, bands: [...st.bands], notes: noteList(play, r.times, piece.swing, p.semis), barSec: r.times.map((T) => [T.t0, T.t1]) });
    for (const b of st.bands.slice(1)) {
      const other = tuned(st.pieces[b], p), kb = Math.pow(10, other.masterDb / 20), rb = renderBars(play, other, { ...opts, defects: { transpose: transposeOf(p.semis) } });
      out.parts[b] = group(rb.stems, other, kb, min); out.k[b] = kb;
    }
  }
  list.forEach((b, i) => st.played.push({ bar: b, origin: start + r.times[i].t0 })); if (st.played.length > KEEP) st.played.splice(0, st.played.length - KEEP);
  st.origin += r.n / sr; st.leadCount = r.leadCount;
  const renderMs = now() - t0, audioSec = r.n / sr, ratio = renderMs / 1000 / audioSec; st.chunks++; st.over = ratio > st.budget && st.chunks > 2 ? st.over + 1 : 0; const stepped = st.over >= 2 ? stepDown() : false;   // the first two chunks warm the engine up and are not judged
  return { ...out, renderMs, audioSec, ratio, stepped };
}
// A change of tempo, key or density, or of whether the second band is rendered. Given `from`, the bars from that index on
// go back in the queue and render again with the change; without it the change starts with the next bars rendered.
export function set({ params = {}, from = null, bands } = {}) {
  st.params = settle(st.piece, { ...st.params, ...params }); if (bands !== undefined && st.parts) st.bands = bandsOf(bands);
  const at = from === null ? -1 : st.played.findIndex((x) => x.bar.index >= from);
  if (at < 0) return { from: null, params: st.params };
  const back = st.played.splice(at); st.ahead.unshift(...back.map((x) => x.bar)); st.origin = back[0].origin;
  st.amb = createAmbience({ seed: st.seed, sr: st.sr, ...st.piece.ambience, position: st.origin }); st.composed = cueSea(st.ahead, st.origin);
  return { from: back[0].bar.index, origin: st.origin, params: st.params };
}
// for tests and for a page that already knows the device is weak
export function setLevel(level) { while (st.level < level && stepDown()); return LEVELS[st.level].name; }

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (ev) => {
    const m = ev.data;
    try {
      if (m.cmd === 'start') self.postMessage({ call: m.call, started: begin(m) });
      else if (m.cmd === 'set') self.postMessage({ call: m.call, set: set(m) });
      else if (m.cmd === 'chunk') {
        const c = chunk(m), bufs = c.parts ? [...Object.values(c.parts).flatMap((g) => Object.values(g)), c.sea] : [c];
        self.postMessage({ call: m.call, chunk: c }, bufs.flatMap((x) => [x.L.buffer, x.R.buffer]));
      }
    } catch (err) { self.postMessage({ call: m.call, error: String((err && err.stack) || err) }); }
  };
}
