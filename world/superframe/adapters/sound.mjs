// adapters/sound.mjs: audio. The pure-DSP parts of the sound engine's motifs (memory codec, trauma groove, the
// aliasing thought, the Shepard partials, the false scale), the site's reference sound renderer (seed pieces and
// the oscilloscope figure), and the reveal nodes that every perception trick must carry (dual edge).
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { codec, phrase } from '../../sound/sound/motifs/memory.js';
import { groove, degrade } from '../../sound/sound/motifs/trauma.js';
import { decimateHold } from '../../sound/sound/motifs/thought.js';
import { partials } from '../../sound/sound/motifs/shepard.js';
import { climb } from '../../sound/sound/motifs/false-scale.js';
import { stft } from '../../sound/sound/dsp.js';
import { seedScene, figureScene, renderReference } from '../upstream/site-3ca6529/system/media-engine/sound.mjs';
import { s16ToFloats } from '../upstream/site-3ca6529/system/media-engine/contracts.mjs';

const M = 'sound/sound/motifs', SITE = 'HarperZ9.github.io system/media-engine/sound.mjs';
const mono = (rate, x) => make.audio(rate, [x instanceof Float32Array ? x : Float32Array.from(x)]);
const first = a => a.channels[0];
const ftom = f => 69 + 12 * Math.log2(f / 440);

export const NODES = [
  defineNode({
    id: 'sound.phrase', title: 'A remembered phrase', lane: 'sound', domains: ['music'], source: `${M}/memory.js`,
    outputs: { audio: 'audio' }, params: { seconds: { type: 'number', min: 1.5, max: 6, default: 3.2, unit: 's' } }, cost: () => 30,
    render: ({ params }) => ({ audio: mono(22050, phrase(params.seconds)) }),
  }),
  defineNode({
    id: 'sound.groove', title: 'A drum groove with a skip', lane: 'sound', domains: ['music'], source: `${M}/trauma.js`,
    outputs: { audio: 'audio' }, params: { bars: { type: 'int', min: 1, max: 6, default: 2 }, bpm: { type: 'number', min: 60, max: 140, default: 84, unit: 'bpm' } }, cost: () => 20,
    render: ({ params }) => ({ audio: mono(22050, groove(params.bars, params.bpm).data) }),
  }),
  defineNode({
    id: 'sound.recall', title: 'Recall as lossy re-encoding', lane: 'sound', domains: ['neuroscience', 'codecs'], source: `${M}/memory.js`,
    doc: 'Each generation re-quantises the sound in the STFT domain: a memory recalled and stored again, losing a little each time.',
    inputs: { audio: 'audio' }, outputs: { audio: 'audio' }, params: { generation: { type: 'int', min: 0, max: 9, default: 4 } }, cost: () => 60,
    render: ({ inputs, params }) => ({ audio: mono(inputs.audio.rate, codec(first(inputs.audio), params.generation)) }),
  }),
  defineNode({
    id: 'sound.degrade', title: 'Generational tape degradation', lane: 'sound', domains: ['media archaeology'], source: `${M}/trauma.js`,
    inputs: { audio: 'audio' }, outputs: { audio: 'audio' }, params: { generation: { type: 'int', min: 0, max: 7, default: 3 } }, cost: () => 10,
    render: ({ inputs, params, seedInt }) => ({ audio: mono(inputs.audio.rate, degrade(first(inputs.audio), params.generation, seedInt % 97)) }),
  }),
  defineNode({
    id: 'sound.alias', title: 'Sample-and-hold aliasing', lane: 'sound', domains: ['signal processing'], source: `${M}/thought.js`,
    inputs: { audio: 'audio' }, outputs: { audio: 'audio' }, params: { hold: { type: 'int', min: 2, max: 80, default: 12, unit: 'samples' } }, cost: () => 5,
    render: ({ inputs, params }) => ({ audio: make.audio(inputs.audio.rate, inputs.audio.channels.map(c => decimateHold(c, params.hold))) }),
  }),
  defineNode({
    id: 'sound.shepard', title: 'Shepard tone, the endless rise', lane: 'sound', domains: ['psychoacoustics'], source: `${M}/shepard.js`,
    doc: 'Octave-spaced partials under a fixed loudness bell glide forever in one direction and never arrive. A perception trick: its reveal is the spectrogram, the same octave stack cycling.',
    edge: { persuasion: 'an illusion of endless rise', counterpart: ['reveal.spectrogram'] },
    outputs: { audio: 'audio' },
    params: { seconds: { type: 'number', min: 4, max: 20, default: 8, unit: 's' }, period: { type: 'number', min: 2, max: 20, default: 6, unit: 's per octave' }, dir: { type: 'enum', options: ['up', 'down'], default: 'up' } },
    cost: p => p.seconds * 30,
    render: ({ params }) => {
      const rate = 22050, P = partials({ duration: params.seconds, period: params.period, dir: params.dir === 'up' ? 1 : -1, step: 0.02 }), n = Math.ceil(params.seconds * rate), x = new Float32Array(n);
      for (const pts of P) { let ph = 0; for (let i = 0; i < n; i++) { const u = (i / rate) / 0.02, k = Math.min(pts.length - 2, u | 0), f = u - k, a = pts[k], b = pts[k + 1]; const fr = a.f + (b.f - a.f) * f, am = a.a + (b.a - a.a) * f; ph += 2 * Math.PI * fr / rate; x[i] += Math.sin(ph) * am * 0.12; } }
      return { audio: mono(rate, x) };
    },
  }),
  defineNode({
    id: 'sound.falsescale', title: 'The false scale', lane: 'sound', domains: ['psychoacoustics', 'music theory'], source: `${M}/false-scale.js`,
    doc: 'A scale that sounds honest, each step flattened by a few cents, so it ends far from home. A perception trick: its reveal is the pitch ruler that shows each step against the honest one.',
    edge: { persuasion: 'small steady drift that reads as honest', counterpart: ['reveal.pitchruler', 'reveal.spectrogram'] },
    outputs: { events: 'events' },
    params: { root: { type: 'int', min: 45, max: 69, default: 57, unit: 'MIDI' }, drift: { type: 'number', min: 2, max: 40, default: 14, unit: 'cents per step' }, step: { type: 'number', min: 0.2, max: 0.8, default: 0.42, unit: 's' }, climbs: { type: 'int', min: 1, max: 4, default: 2 } },
    cost: () => 2,
    render: ({ params }) => {
      const ev = []; let root = params.root, t = 0;
      for (let c = 0; c < params.climbs; c++) { const steps = climb(root, params.drift); for (const s of steps) { ev.push({ t: +t.toFixed(4), voice: 'pluck', role: 'step', args: { note: ftom(s.f), honest: ftom(s.honest), dur: params.step * 1.4, vel: 0.5 } }); t += params.step; } root = Math.round(ftom(steps.at(-1).f)) - 12; }
      return { events: make.events(ev, t + 0.5) };
    },
  }),
  defineNode({
    id: 'site.seedsound', title: 'Seed composition (site reference renderer)', lane: 'sound', domains: ['music'], source: SITE,
    outputs: { audio: 'audio' }, params: { seed: { type: 'string', default: 'aurora', options: ['aurora', 'basalt', 'cinder', 'delta', 'ember', 'fjord', 'grove', 'harbor'] } }, cost: () => 150,
    render: ({ params }) => { const r = renderReference(seedScene(params.seed)); return { audio: mono(48000, s16ToFloats(r.pcm)) }; },
  }),
  defineNode({
    id: 'site.oscilloscope', title: 'Paths as an oscilloscope loop', lane: 'sound', domains: ['electronics', 'vector graphics'], source: `${SITE} figureScene`,
    doc: 'A drawing played as stereo sound: x on the left channel, y on the right. On an XY scope the sound redraws the picture.',
    inputs: { vector: 'vector' }, outputs: { audio: 'audio' }, params: { hz: { type: 'number', min: 20, max: 200, default: 60, unit: 'retraces per s' }, seconds: { type: 'number', min: 1, max: 8, default: 3, unit: 's' }, maxPoints: { type: 'int', min: 50, max: 2000, default: 600 } },
    cost: () => 40,
    render: ({ inputs, params }) => {
      const V = inputs.vector, all = V.paths.flatMap(p => p.pts), step = Math.max(1, Math.floor(all.length / params.maxPoints)), flat = [];
      for (let i = 0; i < all.length; i += step) flat.push((all[i][0] / V.w) * 2 - 1, 1 - (all[i][1] / V.h) * 2);
      if (flat.length < 4) flat.push(-0.5, 0, 0.5, 0);
      const r = renderReference(figureScene(flat, params.hz)), x = s16ToFloats(r.pcm), loopN = x.length / 2, n = Math.round(params.seconds * 48000), L = new Float32Array(n), R = new Float32Array(n);
      for (let i = 0; i < n; i++) { const j = i % loopN; L[i] = x[2 * j]; R[i] = x[2 * j + 1]; }
      return { audio: make.audio(48000, [L, R]) };
    },
  }),
  defineNode({
    id: 'reveal.spectrogram', title: 'Reveal: the spectrogram', lane: 'reveal', domains: ['acoustics'], source: 'sound/sound/dsp.js stft',
    doc: 'The counterpart of every sound trick: the sound drawn as frequency against time, so the trick can be seen working.',
    inputs: { audio: 'audio' }, outputs: { field: 'field' }, params: { log: { type: 'bool', default: true } }, cost: () => 40,
    render: ({ inputs, params, w, h }) => {
      const a = inputs.audio, x = first(a), hop = Math.max(64, Math.floor(x.length / w)), S = stft(x, a.rate, { n: 1024, hop, floorDb: -90 }), cols = S.frames.length, rows = h, F = make.field(cols, rows);
      const fLo = 40, fHi = Math.min(10000, a.rate / 2);
      for (let r = 0; r < rows; r++) { const u = 1 - r / (rows - 1), f = params.log ? fLo * (fHi / fLo) ** u : fLo + (fHi - fLo) * u, b = Math.min(S.bins - 1, Math.round(f / S.binHz)); for (let c = 0; c < cols; c++) F.data[r * cols + c] = Math.max(0, Math.min(1, (S.frames[c][b] + 90) / 70)); }
      return { field: px.resample(F, w, h) };
    },
  }),
  defineNode({
    id: 'reveal.pitchruler', title: 'Reveal: played against honest pitch', lane: 'reveal', domains: ['music theory'], source: 'superframe',
    doc: 'Each event as a tick at its played pitch, joined to a tick at the honest pitch it claims to be: drift becomes visible as a fan.',
    inputs: { events: 'events' }, outputs: { vector: 'vector' }, cost: () => 2,
    render: ({ inputs, w, h }) => {
      const E = inputs.events.events, notes = E.map(e => e.args?.note ?? 60), lo = Math.min(...notes, ...E.map(e => e.args?.honest ?? 99)) - 1, hi = Math.max(...notes, ...E.map(e => e.args?.honest ?? 0)) + 1, T = Math.max(0.1, inputs.events.duration);
      const y = n => h * 0.9 - (h * 0.8) * (n - lo) / Math.max(1, hi - lo), paths = [];
      for (const e of E) { const x = w * (0.06 + 0.88 * e.t / T), hon = e.args?.honest ?? Math.round(e.args?.note ?? 60);
        paths.push({ pts: [[x - 6, y(hon)], [x + 6, y(hon)]], width: 1 }, { pts: [[x - 6, y(e.args?.note ?? 60)], [x + 6, y(e.args?.note ?? 60)]], width: 2.4 }, { pts: [[x, y(hon)], [x, y(e.args?.note ?? 60)]], width: 0.8 }); }
      return { vector: make.vector(w, h, paths) };
    },
  }),
  defineNode({
    id: 'reveal.pair', title: 'Reveal: trick and reveal side by side', lane: 'reveal', domains: ['exhibition design'], source: 'superframe',
    inputs: { trick: 'raster', reveal: 'raster' }, outputs: { raster: 'raster' }, params: { split: { type: 'number', min: 0.3, max: 0.7, default: 0.5, unit: 'share for the trick' } }, cost: () => 5,
    render: ({ inputs, params, w, h }) => {
      const a = Math.round(w * params.split), A = px.resampleRaster(inputs.trick, a, h), B = px.resampleRaster(inputs.reveal, w - a, h), R = make.raster(w, h);
      for (let y = 0; y < h; y++) { R.data.set(A.data.subarray(y * a * 4, (y + 1) * a * 4), y * w * 4); R.data.set(B.data.subarray(y * (w - a) * 4, (y + 1) * (w - a) * 4), (y * w + a) * 4); }
      return { raster: R };
    },
  }),
];
