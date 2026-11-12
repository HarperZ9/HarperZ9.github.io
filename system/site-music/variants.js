// variants.js: every voice a piece can choose, by role. A piece's band names one per role (band.lead, band.keys,
// band.bassVoice, band.pad, band.arp); the composition does not change with the choice, only the sound.
// Each entry says how it was made:
//   measured   its tone was fitted to recordings of the real instrument (source and licence in measured-data.js)
//   played     a designed way of playing over a measured tone (a breathier attack, a mute, a darker reed)
//   designed   no recording stands behind it (the synthesizers, and instruments no licensed recording was found for)
import { TABLES } from './measured.js';
import { blownPhrase, blown } from './blown.js';
import { tine, TINE } from './voices.js';
import { upright } from './upright.js';
import { bassGuitar, sub } from './bassguitar.js';
import { piano, vibraphone, wurlitzer, tx81z, pianoPan } from './struck.js';
import { analogBass, fmBass, acid, fmBell, fmGlass, pluck, synthLead, PADS } from './synths.js';
import * as pads from '../../world/sound/sound/v3/instruments/pads.js';

const t = (name, fallback = 'sax') => TABLES[name] || TABLES[fallback];
const ARCO = { attack: 0.07, over: 0.08, scoop: 0, vibrato: 0.004, vibDelay: 0.25, vibRate: 5.2, keys: 0, intake: 0, drift: 2, gain: 0.55, noise: 0.1 };
// lead voices: a measured table, the playing (blown.js presets), and a shift in whole octaves for an instrument that
// sounds in another octave (a shift by any other interval would put the melody in another key). The piece's own lead preset is laid over `base` unless `own` says the variant's playing wins.
export const LEADS = {
  sax: { how: 'measured', table: () => t('sax'), base: {} },
  tenor: { how: 'measured', table: () => t('saxtenor'), base: { tone: 0 } },
  soprano: { how: 'measured', table: () => t('saxsoprano'), base: { vibrato: 0.009 } },
  baritone: { how: 'measured', table: () => t('saxbaritone'), base: { attack: 0.02, tone: 0 }, shift: -12 },
  'sax-subtone': { how: 'played', table: () => t('sax'), base: { breath: 0.4, noise: 0.32, attack: 0.03, over: 0.05, tone: 2300, vibrato: 0.009, vibRate: 4.4, scoop: 0.3, keys: 0.5 }, own: true },
  'sax-funk': { how: 'played', table: () => t('sax'), base: { breath: 0.92, noise: 0.08, attack: 0.008, over: 0.45, tone: 0, vibrato: 0.006, scoop: 0.35, growl: 0.12 }, own: true },
  flute: { how: 'measured', table: () => t('flute'), base: { attack: 0.022, keys: 0.4, gain: 0.44 } },
  'flute-plain': { how: 'played', table: () => t('flute'), base: { attack: 0.022, keys: 0.4, gain: 0.44, vibrato: 0 }, own: true },
  'flute-breathy': { how: 'played', table: () => t('flute'), base: { attack: 0.045, keys: 0.3, gain: 0.44, noise: 0.34, breath: 0.55, vibrato: 0.008 }, own: true },
  altoflute: { how: 'measured', table: () => t('altoflute', 'flute'), base: { attack: 0.03, keys: 0.35, gain: 0.46 } },
  shakuhachi: { how: 'played', table: () => t('altoflute', 'flute'), base: { attack: 0.06, keys: 0, gain: 0.46, noise: 0.5, breath: 0.5, scoop: 1.4, vibrato: 0.014, vibRate: 4, vibDelay: 0.6, tone: 2600, over: 0.5 }, own: true },
  reed: { how: 'measured', table: () => t('clarinet'), base: { attack: 0.045, over: 0, move: 0.5, gain: 0.55 } },
  trumpet: { how: 'measured', table: () => t('trumpet'), base: { attack: 0.015, over: 0.3, gain: 0.5 } },
  'trumpet-harmon': { how: 'played', table: () => t('trumpet'), base: { attack: 0.015, over: 0.2, gain: 0.5, mute: 'harmon', vibrato: 0.004 } },
  flugelhorn: { how: 'played', table: () => t('trumpet'), base: { attack: 0.03, over: 0.1, gain: 0.55, tone: 1700, vibrato: 0.007 } },
  'synth-lead': { how: 'designed', synth: true, base: {} },
};
export const leadPhrase = (kind, notes, preset, sr, seed) => {
  const L = LEADS[kind] || LEADS.sax, sh = L.shift || 0, ns = sh ? notes.map((n) => ({ ...n, m: n.m + sh })) : notes, p = L.own ? { ...preset, ...L.base } : { ...L.base, ...preset };
  return L.synth ? synthLead(ns, {}, sr, seed) : blownPhrase(ns, L.table(), p, sr, seed);
};
export const leadNote = (kind, m, vel, dur, preset = {}, sr = 48000, seed = 3) => { const L = LEADS[kind] || LEADS.sax; if (L.synth) return synthLead([{ t: 0, dur, m, vel }], {}, sr, seed).x; const p = L.own ? { ...preset, ...L.base } : { ...L.base, ...preset }; return blown(m + (L.shift || 0), vel, dur, L.table(), p, sr, seed); };

// keyboard voices: (m, vel, dur, piece tine preset, sr) -> mono; pan(m, k, n) places a note of a chord
const chordPan = (m, k, n) => (k / Math.max(1, n - 1) - 0.5) * 0.9;
export const KEYS = {
  tine: { how: 'measured', play: (m, v, d, tp, sr, s = 1) => tine(m, v, d, tp, sr, s), pan: chordPan },
  'tine-soft': { how: 'played', play: (m, v, d, tp, sr, s = 1) => tine(m, v * 0.8, d, { ...tp, bell: 0.25, tone: 3600 }, sr, s), pan: chordPan },
  'tine-bark': { how: 'played', play: (m, v, d, tp, sr, s = 1) => tine(m, Math.min(0.98, v * 1.2), d, { ...tp, bell: 1, tone: 7800 }, sr, s), pan: chordPan },
  wurlitzer: { how: 'measured', play: (m, v, d, tp, sr, s = 1) => wurlitzer(m, v, d, {}, sr, s), pan: chordPan },
  tx81z: { how: 'measured', play: (m, v, d, tp, sr, s = 1) => tx81z(m, v, d, {}, sr, s), pan: chordPan },
  piano: { how: 'measured', play: (m, v, d, tp, sr, s = 1) => piano(m, v, d, {}, sr, s), pan: (m) => pianoPan(m) },
  vibraphone: { how: 'measured', play: (m, v, d, tp, sr, s = 1) => vibraphone(m, v, d, { motor: 0.25 }, sr, s), pan: chordPan },
  'fm-glass': { how: 'designed', play: (m, v, d, tp, sr, s = 1) => fmGlass(m, v, d, {}, sr, s), pan: chordPan },
  'fm-bell': { how: 'designed', play: (m, v, d, tp, sr, s = 1) => fmBell(m, v, d, {}, sr, s), pan: chordPan },
};
// bass voices: (m, vel, dur, { style, slideFrom }, sr, seed) -> mono
export const BASSES = {
  upright: { how: 'measured', play: (m, v, d, o, sr, s) => upright(m, v, d, { from: o.slideFrom, ghost: o.style === 'ghost' }, sr, s) },
  arco: { how: 'measured', play: (m, v, d, o, sr, s) => blown(m, v, d, t('uprightarco', 'sax'), ARCO, sr, s) },
  guitar: { how: 'measured', play: (m, v, d, o, sr, s) => bassGuitar(m, v, d, { ...o, voice: 'finger' }, sr, s) },
  picked: { how: 'measured', play: (m, v, d, o, sr, s) => bassGuitar(m, v, d, { ...o, voice: 'picked' }, sr, s) },
  muted: { how: 'measured', play: (m, v, d, o, sr, s) => bassGuitar(m, v, d, { ...o, voice: 'muted' }, sr, s) },
  slap: { how: 'played', play: (m, v, d, o, sr, s) => bassGuitar(m, v, d, { ...o, voice: 'slap' }, sr, s) },
  fretless: { how: 'played', play: (m, v, d, o, sr, s) => bassGuitar(m, v, d, { ...o, voice: 'fretless' }, sr, s) },
  sub: { how: 'designed', play: (m, v, d, o, sr, s = 1) => sub(m, v, d, { slideFrom: o.slideFrom ?? null }, sr, s) },
  analog: { how: 'designed', play: (m, v, d, o, sr, s = 1) => analogBass(m, v, d, { slideFrom: o.slideFrom ?? null }, sr, s) },
  'fm-bass': { how: 'designed', play: (m, v, d, o, sr, s = 1) => fmBass(m, v, d, {}, sr, s) },
  acid: { how: 'designed', play: (m, v, d, o, sr, s = 1) => acid(m, v, d, { slideFrom: o.slideFrom ?? null }, sr, s) },
};
// pad voices: (notes, vel, dur, pad preset, sr, seed) -> { L, R }
export const PAD_PRESET = { voices: 4, detune: 8, cutoff: 1900, motion: 0.45, reso: 1.1, attack: 1.4, release: 2.6, chorus: 0.5, air: 0.1 };
export const PADVOICES = {
  pad: { how: 'designed', play: (n, v, d, p, sr, s) => pads.chord(n, v, d, p, sr, s) },
  'pad-glass': { how: 'designed', play: (n, v, d, p, sr, s) => pads.chord(n, v, d, { ...p, ...pads.meta.presets['night-glass'], voices: p.voices, chorus: p.chorus }, sr, s) },
  strings: { how: 'designed', play: (n, v, d, p, sr, s) => PADS.strings(n, v, d, p, sr, s) },
  sweep: { how: 'designed', play: (n, v, d, p, sr, s) => PADS.sweep(n, v, d, p, sr, s) },
  wavetable: { how: 'designed', play: (n, v, d, p, sr, s) => PADS.wavetable(n, v, d, p, sr, s) },
  brass: { how: 'designed', play: (n, v, d, p, sr, s) => PADS.brass(n, v, d, p, sr, s) },
  formant: { how: 'designed', play: (n, v, d, p, sr, s) => PADS.formant(n, v, d, p, sr, s) },
};
export const ARPS = { pluck: { how: 'designed', play: (m, v, d, sr, s = 1) => pluck(m, v, d, {}, sr, s) } };
export { TINE };
