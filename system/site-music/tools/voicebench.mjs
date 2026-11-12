#!/usr/bin/env node
// A fixed bench phrase for the lead and bass voices, read by the ear's note measures, so "more convincing" has numbers.
//   node system/site-music/tools/voicebench.mjs
// The phrase repeats pitches at different strengths and lengths: exactly where a stamped-out voice shows.
import { noteStats, inharmonicity } from '../../ear/note.js';
import { mtof } from '../../ear/spectrum.js';

export const SR = 48000;
export const LEAD = [[62, 0.6, 0.5], [65, 0.5, 0.45], [62, 0.9, 0.7], [67, 0.4, 0.75], [65, 0.6, 0.55], [62, 0.5, 0.6], [69, 1.1, 0.8], [67, 0.5, 0.5], [65, 0.6, 0.6], [62, 1.4, 0.7], [62, 0.5, 0.4], [60, 1.6, 0.6]];
export const BASS = [[40, 0.45, 0.7], [40, 0.25, 0.6], [43, 0.4, 0.65], [40, 0.45, 0.8], [45, 0.3, 0.6], [40, 0.5, 0.7], [47, 0.3, 0.55], [45, 0.45, 0.7], [40, 0.6, 0.75], [40, 0.3, 0.5], [38, 0.45, 0.7], [40, 0.9, 0.7]];

// For brightness against level: one pitch, one length, five strengths, twice. Nothing else changes, so the slope is the voice's own.
export const LADDER = (m) => [0.3, 0.45, 0.6, 0.75, 0.9, 0.3, 0.45, 0.6, 0.75, 0.9].map((v) => [m, 0.6, v]);
export const slope = (phrase, play) => { const b = bench(phrase, play, 0.25); return noteStats(b.x, SR, b.notes).levelSlope; };

// play(m, vel, dur, index) returns a mono Float32Array for one note; the bench lays the notes end to end with a gap.
export function bench(phrase, play, gap = 0.12) {
  let t = 0.2; const notes = phrase.map(([m, dur, vel]) => { const n = { m, vel, dur, t0: t, t1: t + dur }; t += dur + gap; return n; }), x = new Float32Array(Math.round((t + 1) * SR));
  notes.forEach((n, i) => { const y = play(n.m, n.vel, n.dur, i), at = Math.round(n.t0 * SR); for (let k = 0; k < y.length && at + k < x.length; k++) x[at + k] += y[k]; });
  return { x, notes };
}
export function read(x, notes, { string = false } = {}) {
  const s = noteStats(x, SR, notes), out = { attackMs: s.attackMs, attackSpreadMs: s.attackSpreadMs, flux: s.flux, decayTilt: s.decayTilt, levelSlope: s.levelSlope, repeatMean: s.repeatMean, repeatMax: s.repeatMax };
  if (string) { const n = notes[notes.length - 1]; out.inharmonicity = inharmonicity(x.subarray(Math.round((n.t0 + 0.03) * SR), Math.round(n.t1 * SR)), SR, mtof(n.m)); }
  return out;
}
export const line = (name, o) => `${name.padEnd(22)} attack ${o.attackMs.toFixed(1)} ms (spread ${o.attackSpreadMs.toFixed(1)}) | flux ${o.flux.toFixed(4)} | decay tilt ${o.decayTilt === null ? 'n/a' : o.decayTilt.toFixed(2)} oct | level slope ${o.levelSlope === null ? 'n/a' : o.levelSlope.toFixed(2)} oct/10 dB | repeat mean ${o.repeatMean?.toFixed(3)}, max ${o.repeatMax?.toFixed(3)}${o.inharmonicity !== undefined ? ` | B ${o.inharmonicity === null ? 'n/a' : o.inharmonicity.toExponential(2)}` : ''}`;

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/voicebench.mjs')) {
  const { sax, saxPhrase } = await import('../sax.js'), { bassGuitar } = await import('../bassguitar.js'), reed = await import('../../../world/sound/sound/v3/instruments/reed.js');
  const a = bench(LEAD, (m, v, d, i) => sax(m, v, d, {}, SR, 3 + i)); console.log(line('sax', read(a.x, a.notes)));
  { let t = 0; const ph = LEAD.map(([m, dur, vel], i) => { const n = { m, dur: dur + 0.12, vel, t, slur: i % 3 !== 0 }; t += dur + 0.12; return n; }), r = saxPhrase(ph, {}, SR, 5), notes = ph.map((n) => ({ m: n.m, t0: n.t + r.pre / SR, t1: n.t + n.dur + r.pre / SR })); console.log(line('sax, one legato phrase', read(r.x, notes))); }
  console.log('brightness against level, octaves per 10 dB: sax', slope(LADDER(62), (m, v, d, i) => sax(m, v, d, {}, SR, 3 + i)).toFixed(2), '| engine reed', slope(LADDER(62), (m, v, d, i) => reed.note(m, v, d, { model: 'reed', breath: 0.7, noise: 0.07, vibrato: 0.008, vibRate: 5.3, vibDelay: 0.35, reedStiff: 0.27, tone: 4200, scoop: 0.5 }, SR, 3 + i)).toFixed(2), '| bass guitar', slope(LADDER(40), (m, v, d, i) => bassGuitar(m, v, d, {}, SR, 1 + i)).toFixed(2));
  const st = bench(LEAD, (m, v, d) => sax(m, 0.6, d, { noise: 0, vibrato: 0, scoop: 0, drift: 0 }, SR, 3)); console.log(line('sax, stamped out', read(st.x, st.notes)));
  const c = bench(LEAD, (m, v, d, i) => reed.note(m, v, d, { model: 'reed', breath: 0.7, noise: 0.07, vibrato: 0.008, vibRate: 5.3, vibDelay: 0.35, reedStiff: 0.27, tone: 4200, scoop: 0.5 }, SR, 3 + i)); console.log(line('engine reed', read(c.x, c.notes)));
  const b = bench(BASS, (m, v, d, i) => bassGuitar(m, v, d, {}, SR, 1 + i), 0.03); console.log(line('bass guitar', read(b.x, b.notes, { string: true })));
  const bs = bench(BASS, (m, v, d) => bassGuitar(m, 0.7, d, {}, SR, 1), 0.03); console.log(line('bass, stamped out', read(bs.x, bs.notes, { string: true })));
}
