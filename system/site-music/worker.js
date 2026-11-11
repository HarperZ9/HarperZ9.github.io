// worker.js: the live form's renderer, off the main thread. It holds the composer and the ambience for one piece and
// renders the next few bars each time it is asked: { cmd: 'start', piece, seed, sr } then { cmd: 'chunk', bars }.
// Each reply carries one stereo buffer (music with its tail, and the ambience for exactly those bars) and where its
// first beat sits, so the page can lay chunks end to end. The samples match the offline render of the same seed.
import { composer } from './score.js';
import { renderBars, mixStems } from './render.js';
import { createAmbience } from './ambience.js';
import { PIECES } from './pieces.js';

let st = null;
export function begin({ piece: id, seed = 1, sr = 48000 }) {
  const piece = PIECES[id]; if (!piece) throw new Error(`unknown piece ${id}`);
  st = { id, piece, seed, sr, comp: composer(id, { seed }), amb: createAmbience({ seed, sr, ...piece.ambience }), cache: new Map(), origin: 0, leadCount: 0, played: 0 };
  return { id, title: piece.title };
}
export function chunk({ bars = 2 } = {}) {
  const { piece, sr } = st, list = []; for (let i = 0; i < bars; i++) list.push(st.comp.next());
  if (st.cache.size > 160) st.cache.clear();   // cached notes are a speed-up only; clearing keeps memory flat on a long listen
  const r = renderBars(list, piece, { sr, seed: st.seed, origin: st.origin, cache: st.cache, defects: { leadOffset: st.leadCount } }), mix = mixStems(r.stems, piece);
  const amb = st.amb.render(r.n), ag = Math.pow(10, piece.mix.ambience / 20), k = Math.pow(10, piece.masterDb / 20), fin = 2.5 * sr;
  for (let i = 0; i < mix.L.length; i++) { mix.L[i] *= k; mix.R[i] *= k; }
  for (let i = 0; i < r.n; i++) { const g = ag * k * Math.min(1, (st.played + i) / fin); mix.L[r.pre + i] += amb.L[i] * g; mix.R[r.pre + i] += amb.R[i] * g; }
  const out = { L: mix.L, R: mix.R, sr, pre: r.pre, n: r.n, firstBar: list[0].index, bars: list.map((b) => ({ index: b.index, section: b.section, chords: b.chords.map((c) => c.sym) })) };
  st.origin += r.n / sr; st.played += r.n; st.leadCount = r.leadCount; return out;
}

if (typeof self !== 'undefined' && typeof self.postMessage === 'function' && typeof window === 'undefined') {
  self.onmessage = (ev) => {
    const m = ev.data;
    try {
      if (m.cmd === 'start') self.postMessage({ call: m.call, started: begin(m) });
      else if (m.cmd === 'chunk') { const c = chunk(m); self.postMessage({ call: m.call, chunk: c }, [c.L.buffer, c.R.buffer]); }
    } catch (err) { self.postMessage({ call: m.call, error: String((err && err.stack) || err) }); }
  };
}
