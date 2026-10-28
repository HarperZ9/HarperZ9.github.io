// lib/living/index.mjs: living type. A word that changes medium as it moves across the surface, stop by stop.
//
//   import { createLiving } from '.../typeengine/lib/living/index.mjs';
//   const L = createLiving({ w, h, family, stops: [
//     { state: 'ink', text: 'water' }, { state: 'charcoal' }, { state: 'plant' },
//     { state: 'paint' }, { state: 'ink', text: 'wæter', lang: 'ang', note: 'Old English' },   // a reveal: words differ
//     { state: 'burin', params: { lines: 4 } }, { state: 'burin', params: { lines: 8 } },        // a weight that moves
//   ] });
//   L.at(s, t)        linear RGB (w*h*3) at road position s (stop i at s = i, settled; the move to stop i+1 runs over
//                     s in (i + lead, i + 1)) and clock t in seconds (the place's own clock; the drift at rest)
//   L.frame(s, t)     the same as an sRGB RGBA8 ImageData-shaped object { width, height, data }
//   L.text(s)         { text, lang, note } of the stop the visitor is at: keep it in the DOM, it is the real text
//   L.timing(i)       { law, seconds }: how long the move after stop i takes in its medium's own physics
//   scheme: 'day' | 'night' (night: each state by its night law, lib/living/night.mjs)
//   baked: { 'text|state': linear RGB w*h*3 } images painted elsewhere (the tile states in a browser)
//   options: reduced (settled frames only), hum (keep time with Hum v4: the move steps on 112 BPM sixteenths, felt in
//   half time; off by default, since the theme's clock is not the site's), lead (share of each stop held still, 0.35)
// Text carried from stop to stop: a stop without text keeps the previous stop's.
import './states-digital.mjs';
import { STATES, state, context, registerState } from './states.mjs';
// The tile states come from the name-art mosaic, which is node-only today (its img.mjs imports node:fs). In a browser
// they arrive as baked images (createLiving({ baked })); the stubs say so if a page forgets to bake them.
const NODE = typeof process !== 'undefined' && !!process.versions?.node;
try { if (!NODE) throw new Error('not in node'); await import('./states-tiles.mjs'); } catch (e) {
  for (const [id, title, kind] of [['tiles', 'Mosaic', 'print'], ['tiles-code', 'Code mosaic', 'digital']]) registerState({ id, title, kind, breath: { amp: 0, rate: 0 }, paint() { throw new Error(`living: ${id} needs a baked image in the browser (${e.message})`); } });
}
import { edge } from './graph.mjs';
import { simulate } from './transfer.mjs';
import { composeChange, breathe } from './compose.mjs';
import { createReveal } from './reveal.mjs';
import { srgb8, clamp, linear } from './fields.mjs';
import { instance, faceOf } from '../program.mjs';
import { glyphContext } from '../setline.mjs';
import { face } from '../faces.mjs';
import { toNight } from './night.mjs';
import { levelsOf, progressAt, composeLevels } from './axes.mjs';
import './states-cuts.mjs';

export { STATES, registerState } from './states.mjs';
export { registerLaw, LAWS } from './transfer.mjs';
export { connect, edge, table } from './graph.mjs';
export { registerPicture } from './pictures.mjs';
export { createReveal } from './reveal.mjs';

export const HUM = Object.freeze({ bpm: 112, beat: 60 / 112, sixteenth: 15 / 112, bar: 240 / 112, feel: 'half time' });
const PLAIN = { schema: 'typeengine.family/1', id: 'living', name: 'living', skeleton: { source: 'accession', style: 'display', weight: 700 }, bindings: { fill: { material: 'ink' } } };
const UNDER_PAPER = null; // the same paper: depth comes from the wash, not a tinted box

export function createLiving({ w, h, stops, family = PLAIN, seed = 1, fill = 0.8, size = null, lead = 0.35, hum = false, reduced = false, baked = {}, unread = false, scheme = 'day' }) {
  if (!stops?.length) throw new Error('living: stops needed');
  let last = stops[0].text ?? 'living';
  const S = stops.map((s, i) => { state(s.state); const t = s.text ?? last; last = t; return { ...s, text: t, i }; });
  const fc = faceOf(instance(family)), Gs = new Map(), imgs = new Map(), moves = new Map();
  const G = (text) => { if (!Gs.has(text)) Gs.set(text, glyphContext(fc, text, w, h, { fill, size })); return Gs.get(text); };
  // a state that does not read below some size (measured by OCR) is refused there, not drawn unreadable
  for (const s of S) if (state(s.state).reads === false && !unread) throw new Error(`living: ${s.state} does not read (${state(s.state).measured}); pass unread: true for an art moment`);
  for (const s of S) { const min = state(s.state).minSize ?? 0; if (min && G(s.text).size < min) throw new Error(`living: ${s.state} does not read below ${min} px (here ${Math.round(G(s.text).size)} px)`); }
  const skel = instance(family).skeleton;
  // a state may draw the same word in another cut of the family (Burin, Divisumma): same size, re-centred
  const recut = (text) => (cut, extra) => { const k = `${text}|${cut}|${JSON.stringify(extra)}`; if (!Gs.has(k)) Gs.set(k, glyphContext(face({ ...skel, cut, extra: { ...(skel.extra ?? {}), ...extra } }), text, w, h, { size: G(text).size })); return Gs.get(k); };
  const paint = (text, st, paper, params = {}) => {
    const k = `${text}|${st}|${paper ?? ''}|${JSON.stringify(params)}`; if (!imgs.has(k) && baked[`${text}|${st}`]) { const B = baked[`${text}|${st}`]; imgs.set(k, scheme === 'night' ? toNight(B, { paper: linear('#ebe5d8'), law: state(st).night ?? 'negative' }) : B); }
    if (!imgs.has(k)) { const C = context(G(text), { seed, paper }); C.recut = recut(text); const day = state(st).paint(C, params); imgs.set(k, scheme === 'night' ? toNight(day, { paper: C.paper, law: state(st).night ?? 'negative' }) : day); }
    return imgs.get(k);
  };
  const dark = (st) => scheme === 'night' || st === 'crt'; // by night the lighter material covers, as the darker does by day

  function move(i) {
    if (moves.has(i)) return moves.get(i);
    const a = S[i], b = S[i + 1], changed = a.text !== b.text, law = edge(a.state, b.state, { textChanged: changed, via: b.via });
    let m;
    if (changed) {
      const r = createReveal({ top: paint(a.text, a.state, null, a.params), under: paint(b.text, b.state, UNDER_PAPER, b.params), w, h, law, mask: G(a.text).coverage.data, seed: seed + i });
      m = { kind: 'reveal', law, seconds: r.seconds, sim: r.sim, top: paint(a.text, a.state, null, a.params), under: paint(b.text, b.state, UNDER_PAPER, b.params), frame: (p, t = 0) => r.frame(p, { under: S[i + 1].animate ? livingStop(i + 1, t) : null, top: S[i].animate ? livingStop(i, t) : null }) };
    } else {
      const sim = simulate(law, { w, h, G: G(a.text), seed: seed + i }), A = paint(a.text, a.state, null, a.params), B = paint(b.text, b.state, null, b.params), paper = linear('#ebe5d8');
      const dk = dark(a.state) || dark(b.state);
      m = { kind: 'change', law, seconds: sim.seconds, sim, A, B, paper, dark: dk, frame: (p, t = 0) => composeChange(sim, S[i].animate ? livingStop(i, t) : A, S[i + 1].animate ? livingStop(i + 1, t) : B, w, h, p, { paper, dark: dk }) };
      // a side whose cut's rule is moving is that stop's own frame at the same clock, so the move leaves and reaches
      // exactly what the stops show (no seam at arrival)
    }
    moves.set(i, m); return m;
  }
  // the image a stop settles to (a revealed stop keeps the under-paper it was revealed on)
  const settled = (i) => paint(S[i].text, S[i].state, i > 0 && S[i - 1].text !== S[i].text ? UNDER_PAPER : null, S[i].params);

  // a stop whose cut's rule moves (stop.animate): its levels, painted once, and the frame at clock t
  const levels = (i) => { const a = S[i].animate; return levelsOf(a).map((v) => paint(S[i].text, S[i].state, null, { ...(S[i].params ?? {}), [a.param]: v })); };
  const livingStop = (i, t) => { const a = S[i].animate, L = (lv[i] ??= levels(i)); return composeLevels(L, w, h, progressAt(a, t) * (L.length - 1)); };
  const lv = [];
  function at(s, t = 0) {
    s = clamp(s, 0, S.length - 1); const i = Math.min(S.length - 1, Math.floor(s)), local = s - i;
    if (reduced || i === S.length - 1 || local <= lead) { const k = reduced ? Math.round(s) : i; if (S[k].animate && !reduced) return livingStop(k, t); return reduced ? settled(k) : breathe(settled(k), w, h, t, state(S[k].state).breath, seed); }
    let p = (local - lead) / (1 - lead);
    if (hum) { const m = move(i), steps = Math.max(1, Math.round(m.seconds / HUM.sixteenth)); p = Math.floor(p * steps) / steps; }
    return breathe(move(i).frame(p, t), w, h, t, state(S[i].state).breath, seed, state(S[i + 1].state).breath, p);
  }
  return {
    stops: S, at,
    frame(s, t) { const img = at(s, t), data = new Uint8ClampedArray(w * h * 4); for (let k = 0; k < w * h; k++) { data[k * 4] = srgb8(img[k * 3]); data[k * 4 + 1] = srgb8(img[k * 3 + 1]); data[k * 4 + 2] = srgb8(img[k * 3 + 2]); data[k * 4 + 3] = 255; } return { width: w, height: h, data }; },
    /** The frame as the engine's linear RGBA raster { w, h, data } (for writePNG, the superframe node and the tests). */
    raster(s, t) { const img = at(s, t), data = new Float32Array(w * h * 4); for (let k = 0; k < w * h; k++) { data[k * 4] = img[k * 3]; data[k * 4 + 1] = img[k * 3 + 1]; data[k * 4 + 2] = img[k * 3 + 2]; data[k * 4 + 3] = 1; } return { w, h, data }; },
    text(s) { const st = S[Math.min(S.length - 1, Math.round(clamp(s, 0, S.length - 1)))]; return { text: st.text, lang: st.lang ?? 'en', note: st.note ?? null, state: st.state }; },
    timing(i) { const m = move(i); return { law: m.law, seconds: m.seconds }; },
    /** Where the word sits, for laying the real DOM text exactly over it: { size, x, baseline, width } in canvas px. */
    /** The word's coverage (0..1, w*h), for a glyphs port or a hit area. */
    coverage(text) { return G(text).coverage.data; },
    layout(text) { const g = G(text); return { size: g.size, x: g.x, baseline: g.baseline, width: g.width }; },
    levels, axis: (i, t) => (S[i].animate ? { u: progressAt(S[i].animate, t) * (levelsOf(S[i].animate).length - 1), K: levelsOf(S[i].animate).length } : null),
    settled, move, breath: (i) => state(S[i].state).breath, w, h, lead, hum, reduced, seed,
  };
}
