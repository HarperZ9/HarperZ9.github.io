// adapters/visualizer.mjs: sound and data as drivers (visualizer). The audio front end (onsets, tempo,
// beats, meter, bands, loudness), the data front end (one observation per beat), the geometric meter figure, and
// the seabed scene's layers. Each node calls the visualizer's own modules; nothing is reimplemented here.
// Any numeric parameter of any node in the registry can be driven by these features through
// visualizer/lib/drive.mjs; these nodes are the ones that turn sound into the graph's own types.
//   audio.file      a WAV from disk                         audio.analyse  audio to one feature series
//   audio.events    beats, downbeats or onsets as events     audio.meter    beats per bar as a score
//   series.beats    a data series as one event per observation (and change points as onsets)
//   meter.figure    the bar as a polygon, the music's place on its perimeter (vector)
//   vis.water       the wave-equation surface with a drop for every event (field)
//   vis.seabed      a floor seen through that surface: refraction and caustics (raster)
//   vis.ribbons     glass ribbons orbiting the figure (raster)   vis.phosphor  vector paths as light (raster)
//   vis.finish      shoulder, vignette, clumped grain (raster)
//   midi.file       a Standard MIDI File as events              vis.grid      the struck grid: a score on framed cells
//   vis.flow        sound or data poured into the medium tank (lib/medium): sound as vibration and pressure, data as
//                   rate and timing, after Kac (a tone suggests a mode of the tank and does not fix it)
import { readFileSync } from 'node:fs';
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { readWav } from '../../visualizer/lib/wav.mjs';
import { analyse } from '../../visualizer/lib/features.mjs';
import { pattern } from '../../visualizer/lib/synthetic.mjs';
import { analyseSeries } from '../../visualizer/lib/series.mjs';
import { figureVector, FIGURE } from '../../visualizer/render/meter.mjs';
import { surfaceAt, WATER } from '../../visualizer/render/water.mjs';
import { seabed, tintPlate, SEABED } from '../../visualizer/render/seabed.mjs';
import { ribbons, RIBBONS } from '../../visualizer/render/ribbons.mjs';
import { addLight } from '../../visualizer/render/phosphor.mjs';
import { finish } from '../../visualizer/render/finish.mjs';
import { plane, polyline } from '../../visualizer/lib/draw.mjs';
import { parseMidi, toEvents } from '../../visualizer/lib/midi.mjs';
import { prepareScore, drawGrid, composeTwoInk, GRID, MASKS } from '../../visualizer/render/grid.mjs';
import { flowAt, renderMedium, FLOW } from '../../visualizer/lib/flow.mjs';

const V = 'visualizer';
let DEMO = null;
const demoFeatures = () => (DEMO ??= analyse(pattern({ bpm: 112, beatsPerBar: 4, bars: 6, seed: 4 }).audio));
const audioCache = new Map(), featureCache = new WeakMap();
export function loadAudio(path) { if (!audioCache.has(path)) { audioCache.set(path, readWav(readFileSync(path))); if (audioCache.size > 4) audioCache.delete(audioCache.keys().next().value); } return audioCache.get(path); }
export function featuresOf(audio) { if (!featureCache.has(audio)) featureCache.set(audio, analyse(audio)); return featureCache.get(audio); }

// Features to events: every beat (role downbeat or beat, with its place in the bar), and onsets with strength.
export function eventsOf(F, kind) {
  const m = F.meter.beatsPerBar, ev = [], flux = F.series.flux, at = t => flux[Math.max(0, Math.min(F.n - 1, Math.round(t * F.fps)))];
  if (kind === 'onsets') for (const t of F.onsets) ev.push({ t, voice: 'onset', role: 'onset', args: { note: 60, dur: 0.12, vel: Math.min(1, at(t)) } });
  else {
    const d0 = F.downbeats[0] ?? 0, first = F.beats.findIndex(b => Math.abs(b - d0) < 1e-6), off = first < 0 ? 0 : first % m;
    F.beats.forEach((t, i) => { const inBar = ((i - off) % m + m) % m; if (kind === 'downbeats' && inBar) return; ev.push({ t, voice: inBar ? 'beat' : 'downbeat', role: inBar ? 'beat' : 'downbeat', args: { note: inBar ? 42 : 36, dur: 0.1, vel: Math.min(1, at(t)), beatInBar: inBar, beatsPerBar: m } }); });
  }
  return make.events(ev, F.duration);
}
// Events back to the figure's grid: beats, downbeats, bar length and onsets.
export function gridOf(beatEv, onsetEv = null) {
  const E = beatEv.events, m = E[0]?.args?.beatsPerBar ?? 4;
  return { beats: E.map(e => e.t), downbeats: E.filter(e => e.role === 'downbeat').map(e => e.t), beatsPerBar: m, accents: E.map(e => e.args?.vel ?? 0.5), onsets: (onsetEv?.events ?? []).map(e => ({ t: e.t, vel: e.args?.vel ?? 0.5 })) };
}
const tOf = (time, p) => (time ? time.t : p.t ?? 1);

export const NODES = [
  defineNode({
    id: 'vis.flow', title: 'Sound or data poured into the tank', lane: 'matter', domains: ['fluid dynamics', 'acoustics', 'music information retrieval', 'spectral geometry'], source: `${V}/lib/flow.mjs`,
    doc: 'The medium tank hears a track: each bar drives one standing mode of the water at the beat rate, chosen among the modes that share the tone of the bar (Kac 1966; Gordon, Webb and Wolpert 1992), each onset presses the surface at its place in the bar, strong low onsets release bubbles. A series pours as timed ink drops and a drip whose rate follows the values. The tank at t has heard the input up to t.',
    inputs: { audio: { type: 'audio', optional: true }, series: { type: 'series', optional: true }, time: { type: 'time', optional: true } }, outputs: { raster: 'raster' },
    params: { t: { type: 'number', min: 0.1, max: 120, default: 6, unit: 's (without a time input)' }, grid: { type: 'int', min: 48, max: 320, default: 96, unit: 'cells across' },
      vib: { type: 'number', min: 0, max: 3, default: FLOW.vib }, press: { type: 'number', min: 0, max: 3, default: FLOW.press }, tol: { type: 'number', min: 0.005, max: 0.3, default: FLOW.tol, unit: 'eigenvalue match, share' },
      duration: { type: 'number', min: 2, max: 120, default: 12, unit: 's a series plays over' } },
    cost: p => (p?.grid ?? 96) ** 2 * (p?.t ?? 6) * 0.02,
    render: ({ inputs, params: p, w, h, time }) => {
      // with no input it hears its own demo: a synthetic 4/4 pattern at 112 BPM (as the instruments play a demo phrase)
      const F = inputs.audio ? featuresOf(inputs.audio) : inputs.series ? analyseSeries(inputs.series.y, { duration: p.duration }) : demoFeatures();
      const { medium } = flowAt(F, tOf(inputs.time ?? time, p), { nx: p.grid, ny: Math.round(p.grid * 9 / 16), vib: p.vib, press: p.press, tol: p.tol });
      return { raster: renderMedium(medium, w, h) };
    },
  }),
  defineNode({
    id: 'midi.file', title: 'A MIDI file', lane: 'sound', domains: ['music'], source: `${V}/lib/midi.mjs`, runtime: ['node'], explore: false,
    doc: 'Reads a Standard MIDI File (format 0 or 1, the whole tempo map) into events: one per note, with key, length, velocity and track.',
    outputs: { events: 'events' }, params: { path: { type: 'string', default: '' } },
    render: ({ params }) => { if (!params.path) throw new Error('midi.file: path is empty'); return { events: toEvents(parseMidi(readFileSync(params.path))) }; },
  }),
  defineNode({
    id: 'vis.grid', title: 'The struck grid', lane: 'image', domains: ['music', 'motion design'], source: `${V}/render/grid.mjs`,
    doc: 'Each note strikes one cell, chosen by its key; the cell fills with ink and empties from its centre, opacity and a ground mask on one ease-out curve. Velocity sets the fill, length the fade, track the mask shape. Two inks only.',
    inputs: { events: 'events', time: { type: 'time', optional: true } }, outputs: { raster: 'raster' },
    params: { cols: { type: 'int', min: 1, max: 24, default: GRID.cols }, rows: { type: 'int', min: 1, max: 24, default: GRID.rows }, fade: { type: 'number', min: 0.05, max: 10, default: GRID.fade, unit: 's' },
      mapping: { type: 'enum', options: ['pitch', 'rank', 'seeded'], default: GRID.mapping }, mask: { type: 'enum', options: ['track', ...MASKS], default: GRID.mask },
      ground: { type: 'color', default: '#02040b' }, ink: { type: 'color', default: '#e6edf7' }, seed: { type: 'int', min: 0, max: 99999, default: 1 }, t: { type: 'number', min: 0, max: 3600, default: 1, unit: 's (without a time input)' } },
    render: ({ inputs, params: p, w, h, time }) => {
      const notes = inputs.events.events.map(e => ({ t: e.t, dur: e.args?.dur ?? 0.25, pitch: Math.round(typeof e.args?.note === 'number' ? e.args.note : 60), vel: e.args?.vel ?? 0.8, track: e.args?.track ?? 0 }));
      const prep = prepareScore(notes, { cols: p.cols, rows: p.rows, fade: p.fade, mapping: p.mapping, mask: p.mask, seed: p.seed }), ink = plane(w, h);
      drawGrid(ink, prep, tOf(inputs.time ?? time, p), w, h);
      return { raster: composeTwoInk(ink, p.ground, p.ink) };
    },
  }),
  defineNode({
    id: 'audio.file', title: 'A sound file', lane: 'sound', domains: ['acoustics'], source: `${V}/lib/wav.mjs`, runtime: ['node'], explore: false,
    doc: 'Reads a RIFF WAVE file (PCM 8 to 32 bit, or float). Use only material whose licence allows it.',
    outputs: { audio: 'audio' }, params: { path: { type: 'string', default: '' } },
    render: ({ params }) => { if (!params.path) throw new Error('audio.file: path is empty'); return { audio: loadAudio(params.path) }; },
  }),
  defineNode({
    id: 'audio.analyse', title: 'Sound to a feature series', lane: 'sound', domains: ['signal processing', 'music information retrieval'], source: `${V}/lib/features.mjs`,
    doc: 'One feature at 100 frames per second: spectral flux, RMS, centroid, flatness, six bands, BS.1770 loudness or the spectral peak.',
    inputs: { audio: 'audio' }, outputs: { series: 'series' },
    params: { feature: { type: 'enum', options: ['flux', 'rms', 'centroid', 'flatness', 'sub', 'low', 'lowmid', 'mid', 'presence', 'air', 'lufsM', 'lufsS', 'peakHz'], default: 'flux' } },
    cost: () => 400,
    render: ({ inputs, params }) => { const F = featuresOf(inputs.audio), y = F.series[params.feature]; return { series: make.series(y, { x: Float64Array.from(y, (_, i) => i / F.fps), label: params.feature, unit: { centroid: 'Hz', peakHz: 'Hz', lufsM: 'LUFS', lufsS: 'LUFS', rms: 'dBFS' }[params.feature] ?? (['sub', 'low', 'lowmid', 'mid', 'presence', 'air'].includes(params.feature) ? 'dBFS' : '') }) }; },
  }),
  defineNode({
    id: 'audio.events', title: 'Beats, downbeats or onsets', lane: 'sound', domains: ['music information retrieval'], source: `${V}/lib/features.mjs`,
    doc: 'Beats from the dynamic-programming tracker (Ellis 2007) with their place in the bar, or onsets from adaptive peak picking on spectral flux.',
    inputs: { audio: 'audio' }, outputs: { events: 'events' },
    params: { kind: { type: 'enum', options: ['beats', 'downbeats', 'onsets'], default: 'beats' } }, cost: () => 400,
    render: ({ inputs, params }) => ({ events: eventsOf(featuresOf(inputs.audio), params.kind) }),
  }),
  defineNode({
    id: 'audio.meter', title: 'Beats per bar', lane: 'sound', domains: ['music theory', 'statistics'], source: `${V}/lib/meter.mjs`,
    doc: 'Three or four beats per bar from accent contrast and bar-lag self-similarity, each against a permutation null. pass is false when the bar is not identified.',
    inputs: { audio: 'audio' }, outputs: { score: 'score' }, cost: () => 400,
    render: ({ inputs }) => { const F = featuresOf(inputs.audio), M = F.meter; return { score: { name: 'meter', value: M.beatsPerBar, pass: M.identified, metrics: { margin: M.margin, confidence: M.confidence, bpm: +F.tempo.bpm.toFixed(2), lufsI: +F.lufsI.toFixed(2) } } }; },
  }),
  defineNode({
    id: 'series.beats', title: 'Data as beats', lane: 'data', domains: ['statistics', 'sonification'], source: `${V}/lib/series.mjs`,
    doc: 'One beat per observation over a chosen playback length; change points (steps above two robust deviations) become onsets; a dominant cycle, when found, sets the bar.',
    inputs: { series: 'series' }, outputs: { events: 'events' },
    params: { duration: { type: 'number', min: 2, max: 600, default: 24, unit: 's' }, kind: { type: 'enum', options: ['beats', 'onsets'], default: 'beats' }, group: { type: 'int', min: 0, max: 64, default: 0, unit: 'observations per bar (0 finds the cycle)' }, phase: { type: 'int', min: 0, max: 63, default: 0, unit: 'observations before the first downbeat' } },
    render: ({ inputs, params }) => {
      const F = analyseSeries(inputs.series.y, { duration: params.duration });
      if (params.group > 1) { F.meter = { ...F.meter, beatsPerBar: params.group, phase: params.phase % params.group, identified: false, declared: true }; F.downbeats = F.beats.filter((_, i) => i % params.group === params.phase % params.group); }
      return { events: eventsOf(F, params.kind === 'onsets' ? 'onsets' : 'beats') };
    },
  }),
  defineNode({
    id: 'meter.figure', title: 'The bar as a polygon', lane: 'vector', domains: ['music theory', 'geometry'], source: `${V}/render/meter.mjs`,
    doc: 'One vertex per beat; the bar runs once round the perimeter; earlier bars shrink inward and turn. Output paths carry alpha.',
    inputs: { beats: 'events', onsets: { type: 'events', optional: true }, time: { type: 'time', optional: true } }, outputs: { vector: 'vector' },
    params: { cx: { type: 'number', min: 0, max: 1, default: FIGURE.cx, unit: 'share of width' }, cy: { type: 'number', min: 0, max: 1, default: FIGURE.cy, unit: 'share of height' },
      r: { type: 'number', min: 0.02, max: 0.5, default: FIGURE.r, unit: 'share of height' }, turn: { type: 'number', min: -1, max: 1, default: FIGURE.turn, unit: 'rad per bar' },
      history: { type: 'int', min: 0, max: 8, default: FIGURE.history, unit: 'bars' }, t: { type: 'number', min: 0, max: 3600, default: 1, unit: 's (without a time input)' } },
    render: ({ inputs, params, w, h, time }) => { const V2 = figureVector(gridOf(inputs.beats, inputs.onsets), tOf(inputs.time ?? time, params), w, h, { ...params, aspect: w / h }); return { vector: { w, h, paths: V2.paths } }; },
  }),
  defineNode({
    id: 'vis.water', title: 'Sounding water', lane: 'field', domains: ['fluid mechanics', 'acoustics'], source: `${V}/render/water.mjs`,
    doc: 'The glass module\'s wave equation with a drop for each event, placed on the meter figure; the field is the surface height (0.5 is level) on the simulation grid.',
    inputs: { events: 'events', beats: { type: 'events', optional: true }, time: { type: 'time', optional: true } }, outputs: { field: 'field' },
    params: { gain: { type: 'number', min: 0, max: 4, default: WATER.drop.gain }, radius: { type: 'number', min: 0.5, max: 8, default: WATER.drop.r, unit: 'cells' }, damping: { type: 'number', min: 0, max: 0.05, default: WATER.damping },
      wind: { type: 'number', min: 0, max: 0.02, default: WATER.wind }, cx: { type: 'number', min: 0, max: 1, default: FIGURE.cx }, cy: { type: 'number', min: 0, max: 1, default: FIGURE.cy }, r: { type: 'number', min: 0.02, max: 0.5, default: FIGURE.r }, t: { type: 'number', min: 0, max: 3600, default: 1, unit: 's' } },
    render: ({ inputs, params: p, w, h, time }) => {
      const grid = inputs.beats ? gridOf(inputs.beats) : null, fig = { cx: p.cx, cy: p.cy, r: p.r, aspect: w / h };
      const place = e => { if (!grid?.beats.length) return [p.cx, p.cy]; const g = figureVector(grid, e.t, 4, 4, fig).geometry; return g.pos; };
      const ev = inputs.events.events.map(e => ({ t: e.t, vel: e.args?.vel ?? 0.5, size: e.args?.vel ?? 0.5 }));
      const S = surfaceAt(ev, tOf(inputs.time ?? time, p), { nx: WATER.nx, ny: Math.round(WATER.nx * h / w), damping: p.damping, wind: p.wind, drop: { r: p.radius, gain: p.gain }, place, placeKey: `${p.cx},${p.cy},${p.r},${w}x${h}` });
      return { field: make.field(S.nx, S.ny, Float32Array.from(S.u, v => 0.5 + 0.5 * Math.tanh(v))) };
    },
  }),
  defineNode({
    id: 'vis.seabed', title: 'A floor seen through moving water', lane: 'image', domains: ['optics', 'fluid mechanics'], source: `${V}/render/seabed.mjs`,
    doc: 'Refraction by the surface slope and caustics from its curvature (inverse area change of the refracted bundle), over a floor coloured in one hue.',
    inputs: { plate: 'field', water: { type: 'field', optional: true }, time: { type: 'time', optional: true } }, outputs: { raster: 'raster' },
    params: { depth: { type: 'number', min: 0, max: 0.2, default: SEABED.depth, unit: 'share of height' }, caustic: { type: 'number', min: 0, max: 2, default: SEABED.caustic }, focus: { type: 'number', min: 0, max: 3, default: SEABED.focus },
      fine: { type: 'number', min: 0, max: 3, default: SEABED.fine }, sim: { type: 'number', min: 0, max: 6, default: SEABED.simGain, unit: 'gain on the simulated surface' }, crest: { type: 'number', min: 0, max: 2, default: SEABED.crest, unit: 'light on the drop wavefronts' }, crestLevel: { type: 'number', min: 0.02, max: 2, default: SEABED.crestLevel, unit: 'surface height of the drawn wavefront' }, exposure: { type: 'number', min: 0, max: 4, default: SEABED.exposure }, gain: { type: 'number', min: 0.2, max: 2, default: 1, unit: 'floor gain' },
      deep: { type: 'color', default: '#02040b' }, low: { type: 'color', default: '#0b1d4a' }, mid: { type: 'color', default: '#1d4fae' }, light: { type: 'color', default: '#b4cdf5' }, t: { type: 'number', min: 0, max: 3600, default: 1, unit: 's' } },
    cost: () => 60,
    render: ({ inputs, params: p, w, h, time }) => {
      const plate = tintPlate(inputs.plate, w, h, { stops: [p.deep, p.low, p.mid, p.light], gain: p.gain });
      const surf = inputs.water ? { nx: inputs.water.w, ny: inputs.water.h, u: Float32Array.from(inputs.water.data, v => Math.atanh(Math.max(-0.999, Math.min(0.999, 2 * v - 1)))) } : null;
      return { raster: seabed(plate, surf, tOf(inputs.time ?? time, p), { depth: p.depth, caustic: p.caustic, focus: p.focus, fine: p.fine, exposure: p.exposure, simGain: p.sim, crest: p.crest, crestLevel: p.crestLevel }) };
    },
  }),
  defineNode({
    id: 'vis.ribbons', title: 'Glass ribbons round the figure', lane: 'image', domains: ['optics', 'materials'], source: `${V}/render/ribbons.mjs`,
    doc: 'Swept-SDF glass ribbons on logarithmic-spiral arcs about a centre, through the glass module\'s dispersion, Fresnel, film coat and caustics.',
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' },
    params: { cx: { type: 'number', min: 0, max: 1, default: RIBBONS.cx }, cy: { type: 'number', min: 0, max: 1, default: RIBBONS.cy }, count: { type: 'int', min: 1, max: 12, default: RIBBONS.count },
      inner: { type: 'number', min: 0.05, max: 1, default: RIBBONS.inner, unit: 'share of height' }, outer: { type: 'number', min: 0.05, max: 1.2, default: RIBBONS.outer, unit: 'share of height' },
      swirl: { type: 'number', min: -1000, max: 1000, default: 0, unit: 'rad' }, breathe: { type: 'number', min: -1, max: 1, default: 0 },
      thickness: { type: 'number', min: 0.005, max: 0.12, default: RIBBONS.body.thickness, unit: 'share of height' }, width: { type: 'number', min: 0.01, max: 0.15, default: RIBBONS.body.width, unit: 'share of height' },
      striae: { type: 'int', min: 0, max: 16, default: RIBBONS.body.striae }, caustic: { type: 'number', min: 0, max: 2, default: RIBBONS.glass.caustic.strength }, seed: { type: 'int', min: 0, max: 99999, default: RIBBONS.seed } },
    cost: () => 2000,
    render: ({ inputs, params: p }) => ({ raster: ribbons(inputs.raster, { cx: p.cx, cy: p.cy, count: p.count, inner: p.inner, outer: p.outer, swirl: p.swirl, breathe: p.breathe, seed: p.seed,
      body: { thickness: p.thickness, width: p.width, striae: p.striae }, glass: { caustic: p.caustic > 0 ? { ...RIBBONS.glass.caustic, strength: p.caustic } : null, soften: Math.max(1, 1.5 * inputs.raster.h / 1080) } }) }),
  }),
  defineNode({
    id: 'vis.phosphor', title: 'Paths as light', lane: 'image', domains: ['display physics'], source: `${V}/render/phosphor.mjs`,
    doc: 'Vector paths drawn as an emissive core with a halo; per-path alpha is kept. Added to the raster (light adds).',
    inputs: { raster: 'raster', vector: 'vector' }, outputs: { raster: 'raster' },
    params: { gain: { type: 'number', min: 0, max: 4, default: 0.9 }, glow: { type: 'number', min: 0, max: 2, default: 0.35 }, radius: { type: 'number', min: 0, max: 0.02, default: 0.004, unit: 'share of height' }, colour: { type: 'color', default: '#dfe8f6' }, width: { type: 'number', min: 0.25, max: 4, default: 1, unit: 'x path width' } },
    render: ({ inputs, params: p, w, h }) => {
      const E = plane(w, h), s = h / 1080;
      for (const q of inputs.vector.paths) polyline(E, q.pts.map(([x, y]) => [x * w / inputs.vector.w, y * h / inputs.vector.h]), (q.width ?? 1) * p.width * s, q.alpha ?? 1, !!q.closed);
      const R = { w, h, data: Float32Array.from(inputs.raster.data) };
      return { raster: addLight(R, E, p.colour, p.gain, { radius: p.radius * h, gain: p.glow }) };
    },
  }),
  defineNode({
    id: 'vis.finish', title: 'Shoulder, vignette and grain', lane: 'image', domains: ['photography'], source: `${V}/render/finish.mjs`,
    doc: 'A soft highlight shoulder, a rounded vignette and clumped mono grain that re-seeds at 24 Hz. Output is linear light again.',
    inputs: { raster: 'raster', time: { type: 'time', optional: true } }, outputs: { raster: 'raster' },
    params: { grain: { type: 'number', min: 0, max: 12, default: 3.2, unit: '8-bit code values' }, vignette: { type: 'number', min: 0, max: 1, default: 0.32 }, t: { type: 'number', min: 0, max: 3600, default: 1, unit: 's' } },
    render: ({ inputs, params: p, time }) => {
      const O = finish(inputs.raster, tOf(inputs.time ?? time, p), { grain: { sd: p.grain }, vignette: p.vignette });
      const L = make.raster(O.w, O.h); for (let i = 0; i < O.data.length; i++) { const v = O.data[i]; L.data[i] = (i & 3) === 3 ? 1 : v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }
      return { raster: L };
    },
  }),
];
