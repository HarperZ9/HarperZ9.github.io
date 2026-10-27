// recipients.mjs: one material, rendered for each kind of recipient (Synthesis-and-Design-Framework section 1,
// "One panel of light"). The limits are physics and perception, so each recipient gets what its instrument takes:
//   eye       light on a panel: the image and type lanes, with the cadence the panel shows them at
//   ear       pressure over time: the score's onsets, tempo, register, and the band the energy sits in
//   language  words for a reader or a screen reader, computed from the same numbers (so they cannot drift)
//   agent     structured data: the normalised material, each lane's spec and hashes, for a model or a tool
// Every field is derived from the material; nothing here is hand-written per material.
import { normalize, hashMaterial } from './schema.mjs';
import { motion } from './lanes/motion.mjs';
import { score, hashScore } from './lanes/sound.mjs';
import { typeSpec } from './lanes/type.mjs';

const PLATE_WORDS = {
  relief: c => `a surface pressed ${c.relief > 0.6 ? 'deep' : 'shallow'} and lit from ${Math.round(c.lampDeg)} degrees`,
  droplets: c => `${c.particles > 0.6 ? 'dense' : 'light'} spray with ${c.flow > 0.3 ? 'drips' : 'no drips'}`,
  film: c => `thin-film colour from ${Math.round(c.filmMinNm)} to ${Math.round(c.filmMaxNm)} nanometres`,
  chladni: () => 'sand on the still lines of a vibrating plate',
  hatch: c => `engraved lines at ${Math.round(c.lineDeg)} degrees, crossed in the shadows`,
  noise: () => 'a paper ground',
  fibre: () => 'a sheet torn open, fibres at the edge',
  strands: () => 'laid three-strand rope',
  sunburst: () => 'a sunburst over a stepped skyline',
  blocks: () => 'a posterised field broken by glitch blocks',
  brush: () => 'bristle strokes in ink',
  liquid: () => 'dye stirred through water',
  codecells: () => 'one cell per character of code',
  glass: () => 'reeded glass', crt: () => 'a television signal', water: () => 'shore water reflecting the word',
};
const ROLE = r => String(r ?? '').replace(/\s+/g, ' ');
const band = hz => (hz < 120 ? 'low' : hz < 1200 ? 'middle' : 'high');

export function forEar(material, { seed = 1, drive = null } = {}) {
  const m = normalize(material), sc = score(m, { seed, drive }), c = m.core;
  return { seconds: sc.seconds, tempo: c.tempo, onsets: sc.onsets.length, onsetsPerSecond: +(sc.onsets.length / sc.seconds).toFixed(2), rootMidi: Math.round(c.pitch), resonanceHz: Math.round(c.resonanceHz), band: band(c.resonanceHz), voices: m.hints.sound.voices.map(v => ROLE(v.role ?? v.voice)), hash: hashScore(sc) };
}

export function forEye(material, { seed = 1 } = {}) {
  const m = normalize(material), mo = motion(m), t = typeSpec(m, { seed });
  return { palette: m.palette, plates: m.hints.image.plates.map(p => p.kind), lettering: t.technique, face: t.face ?? 'Hanken Grotesk', cadence: { fps: mo.fps, on: mo.on }, buildSeconds: mo.durationS, curve: mo.curve };
}

// Words: one sentence for the picture, one for the motion, one for the sound. Plain, computed, no adjectives
// that the numbers do not carry.
export function forLanguage(material, { word = null, seed = 1 } = {}) {
  const m = normalize(material), eye = forEye(m, { seed }), ear = forEar(m, { seed });
  const plates = [...new Set(m.hints.image.plates.map(p => p.kind))].map(k => (PLATE_WORDS[k] ?? (() => k))(m.core));
  const what = word ? `${word}, set in ${m.name.toLowerCase()}` : m.name;
  const cad = eye.cadence.on === 1 ? `${eye.cadence.fps} frames a second` : `${eye.cadence.fps} frames a second on ${['', 'ones', 'twos', 'threes'][eye.cadence.on]}`;
  return [
    `${what}: ${plates.join('; ')}.`,
    `It builds in ${eye.buildSeconds.toFixed(1)} seconds at ${cad}.`,
    `It sounds as ${ear.voices.join(', ')}, ${ear.onsets} hits over ${ear.seconds.toFixed(1)} seconds at ${Math.round(ear.tempo)} beats a minute, ${ear.band} in register.`,
  ].join(' ');
}

export function forAgent(material, { seed = 1 } = {}) {
  const m = normalize(material);
  return { schema: 'studio.perceive/1', material: m, materialHash: hashMaterial(m), eye: forEye(m, { seed }), ear: forEar(m, { seed }), type: typeSpec(m, { seed }), motion: motion(m).samples(32) };
}

export function perceive(material, opts = {}) {
  return { eye: forEye(material, opts), ear: forEar(material, opts), language: forLanguage(material, opts), agent: forAgent(material, opts) };
}
export const RECIPIENTS = Object.freeze(['eye', 'ear', 'language', 'agent']);
