// The render calls shared by the worker (live) and tools/render_generative.mjs (offline): same inputs, same samples.
import { INSTRUMENTS, funkkit, keys, pads, reed, low } from './instruments/index.js';
import { phantomBass } from './instruments/perceive.js';

export const calls = {
  phantom: (p, a) => { const x = phantomBass(a.note, a.vel, a.dur, { harmonics: p.harmonics || 6, sr: a.sr }); return { L: x, R: x }; },
  hit: (p, a) => { const x = funkkit.hit(a.piece, a.vel, p, a.sr, a.seed || 3); return { L: x, R: x }; },
  keys: (p, a) => { const x = keys.note(a.note, a.vel, a.dur, p, a.sr); return { L: x, R: x }; },
  comp: (p, a) => keys.comp(a.prog, p, { bpm: a.bpm, sr: a.sr, seed: a.seed, rhythm: a.rhythm }),
  pad: (p, a) => pads.chord(a.notes, a.vel, a.dur, p, a.sr, a.seed),
  reed: (p, a) => { const x = reed.note(a.note, a.vel, a.dur, p, a.sr, a.seed); return { L: x, R: x }; },
  b808: (p, a) => { const x = low.b808(a.note, a.vel, a.dur, p, { path: a.path || [], sr: a.sr }); return { L: x, R: x }; },
  metal: (p, a) => { const x = low.metal(a.vel, p, a.sr); return { L: x, R: x }; },
  groove: (p, a) => funkkit.render(funkkit.groove(a.bars, p, { style: a.style, seed: a.seed }), p, { bpm: a.bpm, sr: a.sr, bars: a.bars, tail: 0.6 }),
  breaks: (p, a) => INSTRUMENTS.breaks.play(p, { bars: a.bars, seed: a.seed, sr: a.sr }),
};
