// The v3 instrument set: one registry, one calling convention. Each entry has meta (params with ranges, presets) and
// play(params, opts) -> { L, R, sr } as plain Float32Arrays, so the browser, the superframe and tests all render the same way.
import * as funkkit from './funkkit.js';
import * as breaks from './breaks.js';
import * as keys from './keys.js';
import * as pads from './pads.js';
import * as reed from './reed.js';
import * as low from './low.js';

const mono = (x, sr) => ({ L: x, R: x, sr, seconds: x.length / sr });
export const preset = (meta, name) => ({ ...Object.fromEntries(Object.entries(meta.params).map(([k, v]) => [k, v.default])), ...(meta.presets[name] || {}) });

export const INSTRUMENTS = {
  funkkit: { meta: funkkit.meta, play: (p, { bars = 2, bpm = 96, style = 'funk', seed = 7, sr = 48000 } = {}) => funkkit.render(funkkit.groove(bars, p, { style, seed }), p, { bpm, sr, bars }) },
  breaks: { meta: breaks.meta, play: (p, { bars = 2, seed = 3, sr = 48000, source = null } = {}) => {
    const src = source || breaks.ownBreak({ sr }), sl = breaks.slice(src.buf, { sr, bpm: src.bpm, bars: src.bars });
    return breaks.render(src.buf, sl, breaks.sequence(sl, bars, p, { seed }), p, { sr, bars }); } },
  keys: { meta: keys.meta, play: (p, { prog = [{ sym: 'C#m9', beats: 4 }, { sym: 'Amaj9', beats: 4 }, { sym: 'F#m11', beats: 4 }, { sym: 'G#7alt', beats: 4 }], bpm = 86, seed = 4, sr = 48000 } = {}) => keys.comp(prog, p, { bpm, sr, seed }) },
  pads: { meta: pads.meta, play: (p, { notes = [49, 56, 64, 68], dur = 6, vel = 0.6, seed = 5, sr = 48000 } = {}) => pads.chord(notes, vel, dur, p, sr, seed) },
  reed: { meta: reed.meta, play: (p, { bars = 2, bpm = 70, seed = 9, root = 61, sr = 48000 } = {}) => {
    const ln = reed.line(bars, { root, seed }), beat = 60 / bpm, n = Math.ceil((bars * 4 * beat + 1) * sr), L = new Float32Array(n);
    for (const e of ln) { const x = reed.note(e.m, 0.7, e.beats * beat * 0.95, p, sr, Math.round(e.beat * 7)), at = Math.round(e.beat * beat * sr); for (let i = 0; i < x.length && at + i < n; i++) L[at + i] += x[i]; }
    return { ...mono(L, sr), line: ln }; } },
  b808: { meta: low.meta808, play: (p, { note = 37, dur = 1.6, path = [[0.9, 44], [1.3, 37]], vel = 0.9, sr = 48000 } = {}) => mono(low.b808(note, vel, dur, p, { path, sr }), sr) },
  metal: { meta: low.metaMetal, play: (p, { vel = 0.8, sr = 48000 } = {}) => mono(low.metal(vel, p, sr), sr) },
};
export { funkkit, breaks, keys, pads, reed, low };
