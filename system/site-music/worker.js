// worker.js: the live form's renderer, off the main thread. It holds the composer and the ambience for one piece and
// renders the next few bars each time it is asked: { cmd: 'start', piece, seed, sr, level } then { cmd: 'chunk', bars }.
// Each reply carries one stereo buffer (music with its tail, and the ambience for exactly those bars) and where its
// first beat sits, so the page can lay chunks end to end. The music matches the offline render of the same seed. The sea
// follows the same rules as offline but knows the score only a few bars ahead, so its waves land a little differently.
//
// Slow devices. Every chunk is timed. The budget is half of real time: a chunk that takes more than 0.5 seconds to render
// per second of audio leaves too little room for the page. Two chunks over budget in a row (after the first two, which
// warm the engine up) step the renderer down one level, and it stays there (it never steps back up, so it cannot flap):
//   level 0   full: four oscillators per pad note, pad chorus, the device's sample rate
//   level 1   lite: two oscillators per pad note, no pad chorus
//   level 2   half: lite, rendered at half the sample rate (the browser resamples on playback; nothing above a quarter of
//             the device rate is heard, which costs the air and the top of the cymbals)
import { composer } from './score.js';
import { renderBars, mixStems, timeline } from './render.js';
import { createAmbience } from './ambience.js';
import { PIECES } from './pieces.js';

export const LEVELS = [{ name: 'full', quality: 'full', rate: 1 }, { name: 'lite', quality: 'lite', rate: 1 }, { name: 'half', quality: 'lite', rate: 0.5 }];
export const BUDGET = 0.5;   // seconds of rendering allowed per second of audio
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

let st = null;
export function begin({ piece: id, seed = 1, sr = 48000, level = 0, budget = BUDGET }) {
  const piece = PIECES[id]; if (!piece) throw new Error(`unknown piece ${id}`);
  st = { id, piece, seed, deviceSr: sr, level: Math.max(0, Math.min(LEVELS.length - 1, level)), comp: composer(id, { seed }), cache: new Map(), origin: 0, leadCount: 0, ahead: [], composed: 0, over: 0, chunks: 0, budget, amb: null };
  st.sr = Math.round(sr * LEVELS[st.level].rate); st.amb = createAmbience({ seed, sr: st.sr, ...piece.ambience });
  return { id, title: piece.title, level: LEVELS[st.level].name };
}
function stepDown() {
  if (st.level >= LEVELS.length - 1) return false; st.level++; st.over = 0; const sr = Math.round(st.deviceSr * LEVELS[st.level].rate);
  if (sr !== st.sr) { st.sr = sr; st.cache.clear(); const cues = st.amb.cues; st.amb = createAmbience({ seed: st.seed, sr, ...st.piece.ambience, position: st.origin }); st.amb.cue(cues); }
  return true;
}
// compose far enough ahead that the sea knows when the lead will play and rest for about the next eight seconds
function lookAhead(need) {
  const barSec = 240 / st.piece.bpm, want = need + Math.ceil(8 / barSec), fresh = []; while (st.ahead.length < want) { const b = st.comp.next(); st.ahead.push(b); fresh.push(b); }
  if (fresh.length) { const tl = timeline(fresh, st.piece, { t0: st.composed, sr: st.sr }); st.amb.cue({ rests: tl.rests, lead: tl.lead.map((n) => [n.t0 - 0.09, n.t1]) }); st.composed = tl.end; }
}
export function chunk({ bars = 2 } = {}) {
  const t0 = now(), { piece } = st; lookAhead(bars); const list = st.ahead.splice(0, bars), sr = st.sr, L0 = LEVELS[st.level];
  if (st.cache.size > 160) st.cache.clear();   // cached notes are a speed-up only; clearing keeps memory flat on a long listen
  const r = renderBars(list, piece, { sr, seed: st.seed, origin: st.origin, cache: st.cache, quality: L0.quality, defects: { leadOffset: st.leadCount } }), mix = mixStems(r.stems, piece);
  const amb = st.amb.render(r.n), ag = Math.pow(10, piece.mix.ambience / 20), k = Math.pow(10, piece.masterDb / 20), fin = 2.5, start = st.origin;
  for (let i = 0; i < mix.L.length; i++) { mix.L[i] *= k; mix.R[i] *= k; }
  for (let i = 0; i < r.n; i++) { const g = ag * k * Math.min(1, (start + i / sr) / fin); mix.L[r.pre + i] += amb.L[i] * g; mix.R[r.pre + i] += amb.R[i] * g; }
  st.origin += r.n / sr; st.leadCount = r.leadCount;
  const renderMs = now() - t0, audioSec = r.n / sr, ratio = renderMs / 1000 / audioSec; st.chunks++; st.over = ratio > st.budget && st.chunks > 2 ? st.over + 1 : 0; const stepped = st.over >= 2 ? stepDown() : false;   // the first two chunks warm the engine up and are not judged
  return { L: mix.L, R: mix.R, sr, pre: r.pre, n: r.n, firstBar: list[0].index, bars: list.map((b) => ({ index: b.index, section: b.section, role: b.role, chords: b.chords.map((c) => c.sym) })), renderMs, audioSec, ratio, level: L0.name, stepped };
}
// for tests and for a page that already knows the device is weak
export function setLevel(level) { while (st.level < level && stepDown()); return LEVELS[st.level].name; }

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (ev) => {
    const m = ev.data;
    try {
      if (m.cmd === 'start') self.postMessage({ call: m.call, started: begin(m) });
      else if (m.cmd === 'chunk') { const c = chunk(m); self.postMessage({ call: m.call, chunk: c }, [c.L.buffer, c.R.buffer]); }
    } catch (err) { self.postMessage({ call: m.call, error: String((err && err.stack) || err) }); }
  };
}
