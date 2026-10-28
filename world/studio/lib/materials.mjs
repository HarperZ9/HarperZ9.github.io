// materials.mjs: the starting library. Eleven materials, each one parameter set across four lanes.
// Type techniques are the lettering library's ids (../../lettering/lib/letter.mjs TECHNIQUES).
// Voices are the sound engine's (../../sound/sound/voices.js) plus five small ones in lanes/sound.mjs.
import { normalize, validate } from './schema.mjs';

const RAW = [
  {
    id: 'raked-concrete', name: 'Raked concrete', genre: ['brutalist', 'surface'],
    palette: { ground: '#8d877c', ink: '#1d1b18', accent: '#d9cdb4' }, noiseColour: 'brown',
    core: { relief: 0.85, lampDeg: 14, lampAzDeg: 300, grainStd: 0.012, grainPx: 2.6, particles: 0.25, order: 0.1, line: 0.05, tension: 0.35, fps: 24, on: 2, durationS: 2.2, tempo: 72, pitch: 31, resonanceHz: 55, decayS: 0.9, transient: 0.25, noise: 0.35, brightness: 0.18 },
    hints: {
      type: { technique: 'raked', face: 'accession-display' },
      image: { plates: [{ kind: 'relief' }, { kind: 'noise', mode: 'multiply', opacity: 0.25 }] },
      motion: { curve: 'engravingReveal' },
      sound: { voices: [{ voice: 'kick808', role: 'thud', gain: 0.9 }, { voice: 'noise', role: 'grit', gain: 0.25 }] },
    },
  },
  {
    id: 'spray', name: 'Spray', genre: ['street', 'aerosol'],
    palette: { ground: '#d9d4c7', ink: '#1a1820', accent: '#d2462f' }, noiseColour: 'white',
    core: { relief: 0.05, particles: 0.85, order: 0.05, flow: 0.35, grainStd: 0.01, grainPx: 2.0, tension: 0.7, fps: 24, on: 1, durationS: 1.4, tempo: 96, pitch: 72, resonanceHz: 2400, decayS: 0.08, transient: 0.8, noise: 0.9, brightness: 0.85 },
    hints: {
      type: { technique: 'sprayed' },
      image: { plates: [{ kind: 'droplets' }] },
      motion: { curve: 'expoOut' },
      sound: { voices: [{ voice: 'noise', role: 'hiss', gain: 0.6 }, { voice: 'pluck', role: 'drip', gain: 0.45 }] },
    },
  },
  {
    id: 'light', name: 'Light', genre: ['luminous', 'optical'],
    palette: { ground: '#07070b', ink: '#f3eee2', accent: '#7fd6e8' }, noiseColour: 'pink',
    core: { relief: 0, sheen: 0.95, filmMinNm: 200, filmMaxNm: 780, particles: 0.1, order: 0.4, flow: 0.4, grainStd: 0.006, grainPx: 2.2, tension: 0.15, fps: 60, on: 1, durationS: 3.2, tempo: 60, pitch: 69, resonanceHz: 880, decayS: 4, transient: 0.05, noise: 0.08, brightness: 0.75 },
    hints: {
      type: { technique: 'light' },
      image: { plates: [{ kind: 'film', mode: 'screen' }] },
      motion: { curve: 'sineInOut' },
      sound: { voices: [{ voice: 'pad', role: 'shimmer', gain: 0.8 }, { voice: 'bell', role: 'glint', gain: 0.2 }], motif: 'shepard' },
    },
  },
  {
    id: 'engraving', name: 'Engraving', genre: ['intaglio', 'line'],
    palette: { ground: '#efe8d8', ink: '#15130f', accent: '#8f3a19' }, noiseColour: 'white',
    core: { relief: 0.3, line: 0.95, lineDeg: 30, order: 0.7, grainStd: 0.007, grainPx: 2.0, tension: 0.6, fps: 24, on: 1, durationS: 2.6, tempo: 84, pitch: 76, resonanceHz: 3200, decayS: 0.05, transient: 0.9, noise: 0.7, brightness: 0.7 },
    hints: {
      type: { technique: 'engraved' },
      image: { plates: [{ kind: 'hatch' }] },
      motion: { curve: 'engravingReveal' },
      sound: { voices: [{ voice: 'scrape', role: 'burin', gain: 0.7 }] },
    },
  },
  {
    id: 'chladni', name: 'Chladni sand', genre: ['acoustic', 'modal'],
    palette: { ground: '#141a2e', ink: '#e4dcc4', accent: '#a9b7d6' }, noiseColour: 'pink',
    core: { relief: 0.1, particles: 0.7, order: 1, grainStd: 0.008, grainPx: 2.2, tension: 0.45, fps: 24, on: 2, durationS: 2.6, tempo: 66, pitch: 64, resonanceHz: 440, decayS: 2.2, transient: 0.35, noise: 0.25, brightness: 0.6 },
    hints: {
      type: { technique: 'chladni' },
      image: { plates: [{ kind: 'chladni' }] },
      motion: { curve: 'glyphCascade' },
      sound: { voices: [{ voice: 'bell', role: 'plate', gain: 0.7 }, { voice: 'noise', role: 'sand', gain: 0.18 }], motif: 'spectrogram-picture' },
    },
  },
  {
    id: 'torn-paper', name: 'Torn paper', genre: ['collage', 'archive'],
    palette: { ground: '#d8cfba', ink: '#2a2620', accent: '#efe8d8' }, noiseColour: 'pink',
    core: { relief: 0.25, fibre: 0.9, particles: 0.1, order: 0.15, grainStd: 0.01, grainPx: 2.8, tension: 0.8, fps: 12, on: 2, durationS: 1.2, tempo: 100, pitch: 50, resonanceHz: 900, decayS: 0.3, transient: 0.6, noise: 0.85, brightness: 0.55 },
    hints: {
      type: { technique: 'torn' },
      image: { plates: [{ kind: 'noise' }, { kind: 'fibre' }] },
      motion: { curve: 'stepped' },
      sound: { voices: [{ voice: 'rip', role: 'tear', gain: 0.8 }] },
    },
  },
  {
    id: 'rope', name: 'Rope', genre: ['maritime', 'craft'],
    palette: { ground: '#e4dccb', ink: '#3b2a1a', accent: '#b58a52' }, noiseColour: 'brown',
    core: { relief: 0.5, fibre: 0.6, order: 0.8, line: 0.3, lineDeg: 60, grainStd: 0.009, grainPx: 2.4, tension: 0.55, fps: 24, on: 1, durationS: 3, tempo: 70, pitch: 38, resonanceHz: 140, decayS: 0.6, transient: 0.3, noise: 0.3, brightness: 0.3 },
    hints: {
      type: { technique: 'rope' },
      image: { plates: [{ kind: 'strands' }] },
      motion: { curve: 'rope' },
      sound: { voices: [{ voice: 'creak', role: 'haul', gain: 0.8 }, { voice: 'noise', role: 'fibre', gain: 0.15 }] },
    },
  },
  {
    id: 'art-deco', name: 'Art deco', genre: ['deco', 'setback'],
    palette: { ground: '#101418', ink: '#e9d8a6', accent: '#b8893a' }, noiseColour: 'pink',
    core: { relief: 0.35, line: 0.6, lineDeg: 90, order: 0.95, sheen: 0.2, grainStd: 0.006, grainPx: 2.0, tension: 0.6, fps: 24, on: 1, durationS: 2, tempo: 112, pitch: 55, resonanceHz: 660, decayS: 0.7, transient: 0.55, noise: 0.05, brightness: 0.62 },
    hints: {
      // the minted deco cut misplaces the lettering library's art (its vertical metrics; see PROGRESS.md), so the
      // deco lettering is cut in the house display face and the deco lives in the plate and the engraving
      type: { technique: 'engraved', face: 'accession-display', opts: { dsep: 2.4 } },
      image: { plates: [{ kind: 'sunburst' }] },
      motion: { curve: 'glyphCascade' },
      sound: { voices: [{ voice: 'pluck', role: 'brass stab', gain: 0.6 }, { voice: 'bell', role: 'chime', gain: 0.3 }] },
    },
  },
  {
    id: 'dmv-beat', name: 'DMV beat', genre: ['dmv', 'trap', 'glitch'],
    palette: { ground: '#0b0a0c', ink: '#ece5d6', accent: '#7a2c8c' }, noiseColour: 'white',
    core: { relief: 0.05, particles: 0.3, order: 0.85, grainStd: 0.014, grainPx: 2.0, tension: 0.9, fps: 24, on: 2, durationS: 1, tempo: 140, pitch: 33, resonanceHz: 50, decayS: 1.1, transient: 0.95, noise: 0.3, brightness: 0.5 },
    hints: {
      type: { technique: 'sound', face: 'accession-display' },
      image: { plates: [{ kind: 'blocks' }] },
      motion: { curve: 'stepped' },
      sound: { voices: [{ voice: 'kick808', role: '808', gain: 1 }, { voice: 'hatRoll', role: 'hats', gain: 0.5 }, { voice: 'clap', role: 'clap', gain: 0.6 }] },
    },
  },
  {
    id: 'ink-brush', name: 'Ink brush', genre: ['painting', 'gesture'],
    palette: { ground: '#ede6d6', ink: '#14110d', accent: '#3f5f8a' }, noiseColour: 'pink',
    core: { relief: 0.1, flow: 0.5, fibre: 0.5, particles: 0.2, order: 0.25, grainStd: 0.008, grainPx: 2.4, tension: 0.4, fps: 24, on: 2, durationS: 2.4, tempo: 80, pitch: 57, resonanceHz: 300, decayS: 0.5, transient: 0.2, noise: 0.5, brightness: 0.4 },
    hints: {
      type: { technique: 'painted' },
      image: { plates: [{ kind: 'brush' }] },
      motion: { curve: 'revealOut' },
      sound: { voices: [{ voice: 'noise', role: 'bristle', gain: 0.45 }, { voice: 'sub', role: 'body', gain: 0.35 }] },
    },
  },
  {
    id: 'liquid', name: 'Liquid', genre: ['fluid', 'any-to-liquid'],
    palette: { ground: '#0d1a22', ink: '#d7ece9', accent: '#3fa7a0' }, noiseColour: 'brown',
    core: { relief: 0.2, flow: 1, sheen: 0.3, particles: 0.2, order: 0.05, grainStd: 0.006, grainPx: 2.2, tension: 0.1, fps: 60, on: 1, durationS: 4, tempo: 64, pitch: 60, resonanceHz: 1300, decayS: 0.12, transient: 0.3, noise: 0.45, brightness: 0.35 },
    hints: {
      type: { technique: 'swarm' },
      image: { plates: [{ kind: 'liquid' }] },
      motion: { curve: 'sineInOut' },
      sound: { voices: [{ voice: 'bubble', role: 'bubbles', gain: 0.6 }, { voice: 'noise', role: 'wash', gain: 0.3 }] },
    },
  },
  // Glass, signal and water (glass; feed set 27): materials that refract, broadcast and reflect.
  {
    id: 'glass', name: 'Glass', genre: ['optical', 'refraction', 'crossover'],
    palette: { ground: '#101317', ink: '#e8ece9', accent: '#a7c4c6' }, noiseColour: 'pink',
    core: { relief: 0.6, line: 0.35, order: 0.7, sheen: 0.15, filmMinNm: 260, filmMaxNm: 720, particles: 0.3, flow: 0.1, grainStd: 0.005, grainPx: 2.0, tension: 0.2, fps: 30, on: 1, durationS: 3, tempo: 64, pitch: 72, resonanceHz: 2200, decayS: 2.5, transient: 0.6, noise: 0.05, brightness: 0.8 },
    hints: {
      type: { technique: 'light' },
      image: { plates: [{ kind: 'glass' }] },
      motion: { curve: 'sineInOut' },
      sound: { voices: [{ voice: 'bell', role: 'rim', gain: 0.7 }, { voice: 'pad', role: 'ring', gain: 0.25 }] },
    },
  },
  {
    id: 'crt-signal', name: 'CRT signal', genre: ['analog', 'broadcast', 'television'],
    palette: { ground: '#050506', ink: '#d9d6cf', accent: '#c23b2f' }, noiseColour: 'white',
    core: { relief: 0, order: 0.5, line: 0.4, noise: 0.25, tension: 0.4, grainStd: 0.012, grainPx: 2.0, particles: 0.6, fps: 30, on: 1, durationS: 2, tempo: 100, pitch: 69, resonanceHz: 7867, decayS: 0.1, transient: 0.7, brightness: 0.7 },
    hints: {
      type: { technique: 'glyphcell' },
      image: { plates: [{ kind: 'crt' }] },
      motion: { curve: 'stepped' },
      sound: { voices: [{ voice: 'noise', role: 'snow', gain: 0.5 }, { voice: 'hat', role: 'flyback', gain: 0.2 }] },
    },
  },
  {
    id: 'shore-water', name: 'Shore water', genre: ['water', 'reflection', 'dusk'],
    palette: { ground: '#25324a', ink: '#ffe0b8', accent: '#e9b48a' }, noiseColour: 'brown',
    core: { relief: 0.1, flow: 0.5, sheen: 0.6, particles: 0.4, order: 0.2, grainStd: 0.005, grainPx: 2.2, tension: 0.1, fps: 30, on: 1, durationS: 5, tempo: 58, pitch: 50, resonanceHz: 600, decayS: 1.5, transient: 0.15, noise: 0.5, brightness: 0.4 },
    hints: {
      type: { technique: 'swarm' },
      image: { plates: [{ kind: 'water' }] },
      motion: { curve: 'sineInOut' },
      sound: { voices: [{ voice: 'noise', role: 'wash', gain: 0.45 }, { voice: 'bubble', role: 'lap', gain: 0.35 }] },
    },
  },
];

for (const m of RAW) { const v = validate(m); if (!v.ok) throw new Error(`materials: ${m.id}: ${v.errors.join('; ')}`); }
export const RAW_MATERIALS = Object.freeze(RAW);
export const MATERIALS = Object.freeze(RAW.map(normalize));
export const byId = id => MATERIALS.find(m => m.id === id) ?? null;

// Code material: a preset over the codecells plate, used by the code-to-image conversion.
export const CODE_MATERIAL = normalize({
  id: 'code', name: 'Code', genre: ['code', 'terminal'],
  palette: { ground: '#0e0f0d', ink: '#d9e3c4', accent: '#e6a03c' }, noiseColour: 'white',
  core: { order: 1, line: 0.2, grainStd: 0.006, grainPx: 2, tension: 0.8, fps: 24, on: 1, durationS: 1.6, tempo: 120, pitch: 60, resonanceHz: 1800, decayS: 0.06, transient: 0.85, noise: 0.15, brightness: 0.7 },
  hints: { type: { technique: 'glyphcell' }, image: { plates: [{ kind: 'codecells' }] }, motion: { curve: 'glyphCascade' }, sound: { voices: [{ voice: 'pluck', role: 'token', gain: 0.5 }, { voice: 'hat', role: 'punct', gain: 0.3 }] } },
});
