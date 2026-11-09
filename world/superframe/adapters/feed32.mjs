// adapters/feed32.mjs: feed set 32 (2026-10-24). Sequence strata, the dated cinema grade, the subtitle line, the
// equation sequencer and the hollowing grid. Thin wrappers: each calls its library in feed-32/build.
//   strata.plot     a sequence decomposed into weight, level and jump, with one hot line (raster)
//   film.grade      measured toe, shoulder and warm white, halation, clumped grain, weave, flicker (raster to raster)
//   subtitle.line   a line of house type at the measured place and ink, laid in before the grade (raster to raster)
//   eqseq.pattern   drum and tone pattern from closed-form envelopes (events and audio from the same maths)
//   eqseq.lanes     that pattern drawn as envelope traces with a playhead (raster)
//   grid.hollow     any score as struck cells that empty from the centre (events to raster)
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { fromRGB3 } from '../lib/pix.mjs';
import { SEQUENCES, sequence } from '../../feed-32/build/sequences.mjs';
import { decompose, render as strata, HOT } from '../../feed-32/build/strata.mjs';
import { grade, DEFAULTS as FILM } from '../../feed-32/build/film.mjs';
import { inkFor, composite, lineMask, solveLegible, compositeLegible, MEASURED } from '../../feed-32/build/subtitle.mjs';
import { set } from '../../feed-32/build/settype.mjs';
import { DEMO, events as seqEvents, audio as seqAudio, draw as lanes } from '../../feed-32/build/eqseq.mjs';
import { draw as hollow } from '../../feed-32/build/hollowgrid.mjs';
import { raster as rgb3 } from '../../feed-29/build/lib/field.mjs';

const F32 = 'feed-32/build';
const out = R => fromRGB3(R.w, R.h, R.px);
const in3 = Rs => { const R = rgb3(Rs.w, Rs.h), d = Rs.data; for (let i = 0; i < Rs.w * Rs.h; i++) for (let c = 0; c < 3; c++) R.px[3 * i + c] = d[4 * i + c] * d[4 * i + 3]; return R; };
const clock = (p, time) => (p.t >= 0 ? p.t : time?.t ?? 0);
const T = { type: 'number', min: -1, max: 600, default: -1, unit: 's (-1 follows the graph clock)' };
const DIGITS = /^[0-9]{1,32}$/;
const pattern = p => {
  for (const k of ['kick', 'hat', 'tone', 'notes']) if (!DIGITS.test(p[k])) throw new Error(`eqseq: ${k} must be 1 to 32 digits, got "${p[k]}"`);
  return { bpm: p.bpm, steps: p.steps, bars: p.bars, voices: [
    { name: 'kick', kind: 'kick', digits: p.kick, decay: p.kickDecay }, { name: 'hat', kind: 'hat', digits: p.hat, decay: 34 },
    { name: 'tone', kind: 'tone', digits: p.tone, notes: p.notes, decay: 5 }] };
};
const v = DEMO.voices;
const PATTERN = {
  bpm: { type: 'number', min: 40, max: 240, default: DEMO.bpm, unit: 'bpm' }, steps: { type: 'int', min: 4, max: 32, default: DEMO.steps, unit: 'steps per bar' },
  bars: { type: 'int', min: 1, max: 16, default: DEMO.bars }, kick: { type: 'string', default: v[0].digits }, hat: { type: 'string', default: v[1].digits },
  tone: { type: 'string', default: v[2].digits }, notes: { type: 'string', default: v[2].notes }, kickDecay: { type: 'number', min: 2, max: 60, default: v[0].decay, unit: 'per beat' },
};

export const NODES = [
  defineNode({
    id: 'strata.plot', title: 'Sequence strata', lane: 'image', domains: ['number theory', 'data visualization'], source: `${F32}/strata.mjs`,
    doc: 'Each term written as weight x level + jump (the decomposition credited to R. Eismann); log coordinates in a turned cube; one property drawn in the hot ink, with its status (proved, conjecture, computed).',
    inputs: {}, outputs: { raster: 'raster' },
    params: {
      sequence: { type: 'enum', options: Object.keys(SEQUENCES), default: 'primes' }, n: { type: 'int', min: 100, max: 2000000, default: 60000, unit: 'terms' },
      hot: { type: 'enum', options: Object.keys(HOT), default: 'weight3' }, yaw: { type: 'number', min: -3.14, max: 3.14, default: -0.9, unit: 'rad' },
      pitch: { type: 'number', min: -1.2, max: 1.2, default: 0.42, unit: 'rad' }, ground: { type: 'color', default: '#ece7dc' }, ink: { type: 'color', default: '#1b1a17' }, hotInk: { type: 'color', default: '#c8442a' },
    },
    cost: p => 5 + p.n / 4000,
    render: ({ params: p, w, h }) => { const S = sequence(p.sequence, p.n); return { raster: out(strata({ w, h, D: decompose(S), A: S[S.length - 1], hot: p.hot, yaw: p.yaw, pitch: p.pitch, ground: p.ground, ink: p.ink, hotInk: p.hotInk })) }; },
  }),
  defineNode({
    id: 'film.grade', title: 'Dated cinema grade', lane: 'image', domains: ['photochemistry', 'colorimetry', 'film'], source: `${F32}/film.mjs`,
    doc: 'Per-channel toe and shoulder to a measured warm black and white, a small OKLab highlight trim, halation from a blurred highlight key, clumped grain, weave and flicker drawn per frame from the seed.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: {
      frame: { type: 'int', min: 0, max: 100000, default: 0, unit: 'frame (new grain, weave, flicker)' }, shoulder: { type: 'number', min: 0, max: 4, default: FILM.shoulder },
      sat: { type: 'number', min: 0, max: 1.5, default: FILM.sat }, grain: { type: 'number', min: 0, max: 12, default: FILM.grain.sd, unit: 'code values' },
      halation: { type: 'number', min: 0, max: 1, default: FILM.halation.strength }, weave: { type: 'number', min: 0, max: 2, default: FILM.weave, unit: 'px rms' },
      flicker: { type: 'number', min: 0, max: 0.05, default: FILM.flicker },
    },
    cost: () => 40,
    render: ({ inputs, params: p, seed }) => ({ raster: out(grade(in3(inputs.raster), { shoulder: p.shoulder, sat: p.sat, grain: { sd: p.grain }, halation: { strength: p.halation }, weave: p.weave, flicker: p.flicker }, { seed: String(seed), frame: p.frame })) }),
  }),
  defineNode({
    id: 'subtitle.line', title: 'Subtitle line', lane: 'image', domains: ['typography', 'film'], source: `${F32}/subtitle.mjs`,
    doc: 'One line of the house type at the measured baseline and size, in an ink solved so that it lands on the target colour after film.grade. Put this before the grade so grain and halation reach the letters. With legible on, a dark halo in the grade black point is sized so every glyph clears 4.5:1 against its own surround after the default grade.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: {
      text: { type: 'string', default: 'the river keeps the last of the light' }, ink: { type: 'color', default: MEASURED.ink },
      baseline: { type: 'number', min: 0.85, max: 0.97, default: MEASURED.baseline, unit: 'share of height' }, cap: { type: 'number', min: 0.015, max: 0.06, default: MEASURED.cap, unit: 'share of height' },
      show: { type: 'bool', default: true }, legible: { type: 'bool', default: true },
    },
    cost: p => (p.legible ? 120 : 30),
    render: ({ inputs, params: p, w, h, seed }) => {
      const R = in3(inputs.raster);
      if (!p.show || !p.text.trim()) return { raster: out(R) };
      const M = lineMask(p.text, w, h, set(), { baseline: p.baseline, cap: p.cap });
      if (!p.legible) return { raster: out(composite(R, M, inkFor(p.ink))) };
      const L = solveLegible(R, M, { target: p.ink, seed: String(seed) });  // halo sized so every glyph clears 4.5:1 after film.grade
      return { raster: out(compositeLegible(R, M, L.ink, L.halo)) };
    },
  }),
  defineNode({
    id: 'eqseq.pattern', title: 'Equation sequencer', lane: 'sound', domains: ['music', 'mathematics', 'synthesis'], source: `${F32}/eqseq.mjs`,
    doc: 'A pattern packed into the digits of integers and read back with floor and mod; each step a decaying exponential. The events and the PCM come from the same envelopes.',
    inputs: {}, outputs: { events: 'events', audio: 'audio' }, params: PATTERN,
    cost: p => 20 * p.bars,
    render: ({ params: p }) => { const P = pattern(p), E = seqEvents(P); return { events: make.events(E.events, E.duration), audio: make.audio(48000, [seqAudio(P, 48000)]) }; },
  }),
  defineNode({
    id: 'eqseq.lanes', title: 'Equation sequencer lanes', lane: 'image', domains: ['music', 'mathematics', 'data visualization'], source: `${F32}/eqseq.mjs`,
    doc: 'One lane per voice: the envelope as a trace over one bar, step ticks, and the playhead as one hot disc per lane.',
    inputs: {}, outputs: { raster: 'raster' },
    params: { ...PATTERN, t: T, ground: { type: 'color', default: '#ece7dc' }, ink: { type: 'color', default: '#1b1a17' }, hotInk: { type: 'color', default: '#c8442a' } },
    cost: () => 25,
    render: ({ params: p, w, h, time }) => ({ raster: out(lanes({ w, h, pattern: pattern(p), t: clock(p, time) / (60 / p.bpm), ground: p.ground, ink: p.ink, hotInk: p.hotInk })) }),
  }),
  defineNode({
    id: 'grid.hollow', title: 'Hollowing grid', lane: 'image', domains: ['music', 'motion design'], source: `${F32}/hollowgrid.mjs`,
    doc: 'Every note strikes one cell (pitch class to column and octave to row, or a serpentine order); the fill fades while a ground-coloured hole grows from the centre on the same ease-out curve. One state per cell; a pure function of time.',
    inputs: { events: 'events' }, outputs: { raster: 'raster' },
    params: {
      t: T, cols: { type: 'int', min: 2, max: 24, default: 5 }, rows: { type: 'int', min: 2, max: 24, default: 5 }, map: { type: 'enum', options: ['pitch', 'order'], default: 'pitch' },
      mask: { type: 'enum', options: ['square', 'circle', 'diamond'], default: 'square' }, fade: { type: 'number', min: 0.2, max: 6, default: 2.5, unit: 's' },
      ground: { type: 'color', default: '#e9edf2' }, ink: { type: 'color', default: '#1d2a44' },
    },
    cost: () => 6,
    render: ({ inputs, params: p, w, h, time }) => ({ raster: out(hollow({ w, h, score: inputs.events, t: clock(p, time), cols: p.cols, rows: p.rows, map: p.map, mask: p.mask, fade: p.fade, ground: p.ground, ink: p.ink })) }),
  }),
];
