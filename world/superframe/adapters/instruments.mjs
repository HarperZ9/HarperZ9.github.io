// adapters/instruments.mjs: the v3 instrument set from sound/sound/v3/instruments as nodes. Each instrument is
// one node: a preset (or the defaults) plus an optional events input (a score: notes, durations, velocities); with no score
// it plays its own demo phrase. Pure DSP, so the same samples come out in Node, the browser and the site.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { INSTRUMENTS, preset, keys, pads, reed, low, funkkit } from '../../sound/sound/v3/instruments/index.js';

const SRC = 'sound/sound/v3/instruments', RATE = 48000;
const stereo = (r) => make.audio(r.sr, [r.L, r.R === r.L ? r.L.slice() : r.R]);
const DOMAINS = { funkkit: ['music', 'jazz-funk'], breaks: ['music', 'drum and bass'], keys: ['music', 'jazz harmony'], pads: ['music', 'synthesis'], reed: ['music', 'acoustics', 'physical modelling'], b808: ['music', 'synthesis'], metal: ['acoustics', 'industrial'] };

// Render a score through a per-note instrument; events args: { note (MIDI, or a kit piece name), dur, vel, pan? }.
function score(id, p, ev) {
  const n = Math.ceil((ev.duration + 3) * RATE), L = new Float32Array(n), R = new Float32Array(n);
  for (const e of ev.events) {
    const a = e.args || {}, vel = a.vel ?? 0.7, dur = a.dur ?? 0.5; let x;
    if (id === 'keys') x = keys.note(a.note, vel, dur, p, RATE);
    else if (id === 'reed') x = reed.note(a.note, vel, dur, p, RATE);
    else if (id === 'b808') x = low.b808(a.note, vel, dur, p, { sr: RATE });
    else if (id === 'metal') x = low.metal(vel, p, RATE);
    else if (id === 'funkkit') x = funkkit.hit(typeof a.note === 'string' ? a.note : ['kick', 'snare', 'hat'][Math.abs(Math.round(a.note ?? 0)) % 3], vel, p, RATE);
    else if (id === 'pads') { const r = pads.chord(a.notes || [a.note], vel, dur, p, RATE); const at = Math.round(e.t * RATE); for (let i = 0; i < r.L.length && at + i < n; i++) { L[at + i] += r.L[i]; R[at + i] += r.R[i]; } continue; }
    const at = Math.round(e.t * RATE), g = Math.SQRT1_2, pan = a.pan ?? 0; for (let i = 0; i < x.length && at + i < n; i++) { L[at + i] += x[i] * g * (1 - pan); R[at + i] += x[i] * g * (1 + pan); }
  }
  return { L, R, sr: RATE };
}

export const NODES = Object.entries(INSTRUMENTS).map(([id, inst]) => {
  const names = Object.keys(inst.meta.presets), params = { preset: { type: 'enum', options: names, default: names[0] }, seed: { type: 'int', min: 1, max: 9999, default: 7 } };
  return defineNode({
    id: `inst.${id}`, title: inst.meta.title, lane: 'sound', domains: DOMAINS[id] || ['music'], source: `${SRC}/${id === 'b808' || id === 'metal' ? 'low' : id}.js`,
    doc: `Playable instrument with presets ${names.join(', ')}. Parameters and ranges: ${Object.keys(inst.meta.params).join(', ')}. Feed it a score on the events port, or leave it empty for the demo phrase.`,
    inputs: id === 'breaks' ? {} : { events: { type: 'events', optional: true } }, outputs: { audio: 'audio' }, params,
    cost: () => (id === 'pads' ? 900 : id === 'keys' ? 600 : 250),
    render: ({ inputs, params: q }) => {
      const p = preset(inst.meta, q.preset);
      return { audio: stereo(inputs.events ? score(id, p, inputs.events) : inst.play(p, { sr: RATE, seed: q.seed })) };
    },
  });
});

// Perceptual modes (sound/sound/v3/instruments/perceive.js): hacks on hearing used as craft, each with its two edges.
import * as perceive from '../../sound/sound/v3/instruments/perceive.js';
const PSRC = `${SRC}/perceive.js`, mono1 = (x) => make.audio(RATE, [x]), first = (a) => a.channels[0];
const edge = (k, counterpart = ['reveal.spectrogram']) => ({ persuasion: perceive.MODES[k].edge, counterpart });
NODES.push(
  defineNode({ id: 'perceive.phantombass', title: 'Missing fundamental bass', lane: 'sound', domains: ['psychoacoustics'], source: PSRC, edge: edge('phantomBass'),
    doc: 'Harmonics 2 to 8 of a note with the fundamental filtered out: the ear supplies the missing pitch, so bass reads on speakers that cannot play it.',
    outputs: { audio: 'audio' }, params: { note: { type: 'int', min: 24, max: 60, default: 33, unit: 'MIDI' }, dur: { type: 'number', min: 0.2, max: 4, default: 1.2, unit: 's' }, harmonics: { type: 'int', min: 3, max: 12, default: 7 } }, cost: () => 30,
    render: ({ params: q }) => ({ audio: mono1(perceive.phantomBass(q.note, 0.9, q.dur, { harmonics: q.harmonics, sr: RATE })) }) }),
  defineNode({ id: 'perceive.haas', title: 'Precedence (Haas) width', lane: 'sound', domains: ['psychoacoustics', 'spatial audio'], source: PSRC, edge: edge('haas'),
    inputs: { audio: 'audio' }, outputs: { audio: 'audio' }, params: { ms: { type: 'number', min: 1, max: 30, default: 12, unit: 'ms' }, fromHz: { type: 'number', min: 200, max: 4000, default: 900, unit: 'Hz' } }, cost: () => 10,
    render: ({ inputs, params: q }) => { const L = first(inputs.audio).slice(), R = (inputs.audio.channels[1] || first(inputs.audio)).slice(); perceive.haas(L, R, inputs.audio.rate, { ms: q.ms, fromHz: q.fromHz }); return { audio: make.audio(inputs.audio.rate, [L, R]) }; } }),
  defineNode({ id: 'perceive.maskreveal', title: 'Masking as reveal', lane: 'sound', domains: ['psychoacoustics'], source: PSRC, edge: edge('maskReveal'),
    inputs: { audio: 'audio' }, outputs: { audio: 'audio' }, params: { centerHz: { type: 'number', min: 200, max: 4000, default: 800, unit: 'Hz' }, depthDb: { type: 'number', min: 0, max: 30, default: 18, unit: 'dB' } }, cost: () => 10,
    render: ({ inputs, params: q }) => ({ audio: make.audio(inputs.audio.rate, [perceive.maskReveal(first(inputs.audio), inputs.audio.rate, q)]) }) }),
  defineNode({ id: 'perceive.textrhythm', title: 'Text to rhythm', lane: 'sound', domains: ['linguistics', 'music'], source: PSRC, edge: edge('textRhythm', []),
    outputs: { events: 'events' }, params: { text: { type: 'string', default: 'the record keeps what the room forgets.' }, bpm: { type: 'number', min: 60, max: 180, default: 96, unit: 'bpm' } }, cost: () => 1,
    render: ({ params: q }) => { const r = perceive.textRhythm(q.text), st = 60 / q.bpm / 4;
      return { events: make.events(r.events.map((e) => ({ t: +(e.step * st).toFixed(4), voice: 'funkkit', role: e.piece, args: { note: e.piece, dur: e.len * st, vel: e.vel } }))) }; } }),
  defineNode({ id: 'perceive.seriesnotes', title: 'Data to melody (modal)', lane: 'sound', domains: ['sonification'], source: PSRC, edge: edge('seriesNotes', []),
    inputs: { series: 'series' }, outputs: { events: 'events' }, params: { step: { type: 'number', min: 0.05, max: 1, default: 0.25, unit: 's per value' }, root: { type: 'int', min: 36, max: 72, default: 49, unit: 'MIDI' } }, cost: () => 1,
    render: ({ inputs, params: q }) => { const notes = perceive.seriesNotes(Array.from(inputs.series.y), { root: q.root });
      return { events: make.events(notes.map((n, i) => ({ t: +(i * q.step).toFixed(4), voice: 'keys', role: 'datum', args: { note: n, dur: q.step * 0.9, vel: 0.5 } }))) }; } }),
  defineNode({ id: 'perceive.features', title: 'Sound to data', lane: 'sound', domains: ['signal processing'], source: PSRC, edge: edge('features', []),
    inputs: { audio: 'audio' }, outputs: { series: 'series' }, params: { measure: { type: 'enum', options: ['rms', 'centroid', 'onset'], default: 'rms' } }, cost: () => 5,
    render: ({ inputs, params: q }) => { const f = perceive.features(first(inputs.audio), inputs.audio.rate); return { series: make.series(Float64Array.from(f[q.measure]), { label: q.measure, unit: q.measure === 'centroid' ? 'Hz' : '' }) }; } }),
);
