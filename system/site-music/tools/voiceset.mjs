// voiceset.mjs: every measured voice and variant the benches can judge, with the class of real recordings it is judged
// against. play(m, vel, dur, i, table) returns mono samples at 48 kHz at the asked pitch (no octave shift); table, when
// given, stands in for the voice's measured table while it plays (fit on one source, judge on another).
import { TABLES } from '../measured.js';
import { blown } from '../blown.js';
import { LEADS, KEYS, BASSES, TINE } from '../variants.js';
import { bassGuitar } from '../bassguitar.js';

const SR = 48000, R4 = process.env.SITE_MUSIC_R4 || null;   // a checkout of round four, for before-and-after numbers
let old = null; if (R4) old = { voices: await import(new URL(`file:///${R4.replace(/\\/g, '/')}/system/site-music/voices.js`).href), bass: await import(new URL(`file:///${R4.replace(/\\/g, '/')}/system/site-music/bassguitar.js`).href) };
const swap = (key, table, fn) => { if (!table) return fn(); const keep = TABLES[key]; TABLES[key] = table; try { return fn(); } finally { TABLES[key] = keep; } };
const lead = (kind, key) => ({ key, play: (m, v, d, i, table) => { const L = LEADS[kind]; return swap(key, table, () => blown(m, v, d, L.table(), L.base, SR, 3 + i)); } });
const keys = (kind, key) => ({ key, play: (m, v, d, i, table) => swap(key, table, () => KEYS[kind].play(m, v, d, TINE, SR)) });
const bass = (kind, key) => ({ key, fmin: 30, play: (m, v, d, i, table) => swap(key, table, () => BASSES[kind].play(m, v, d, { style: 'finger' }, SR, 1 + i)) });

export const VOICES = {
  upright: { cls: 'upright', ...bass('upright', 'upright') },
  'upright-r4': { cls: 'upright', fmin: 30, play: (m, v, d, i) => old.voices.softBass(m, v, d, SR, 1 + i) },
  arco: { cls: 'uprightarco', ...bass('arco', 'uprightarco') },
  'bass-guitar': { cls: 'bassguitar', ...bass('guitar', 'bassguitar') },
  'bass-guitar-r4': { cls: 'bassguitar', fmin: 30, play: (m, v, d, i) => old.bass.bassGuitar(m, v, d, {}, SR, 1 + i) },
  'bass-picked': { cls: 'basspicked', ...bass('picked', 'basspicked') },
  'bass-ghost': { cls: 'bassguitar-muted', sub: ['ghost'], key: 'bassmuted', fmin: 30, dur: 1.2, play: (m, v, d, i, table) => swap('bassmuted', table, () => bassGuitar(m, v, d, { style: 'ghost' }, SR, 1 + i)) },
  'bass-ghost-r4': { cls: 'bassguitar-muted', sub: ['ghost'], fmin: 30, dur: 0.3, play: (m, v, d, i) => old.bass.bassGuitar(m, v, d, { style: 'ghost' }, SR, 1 + i) },
  sax: { cls: 'sax', sub: ['alto'], ...lead('sax', 'sax') },
  tenor: { cls: 'sax', sub: ['tenor'], ...lead('tenor', 'saxtenor') },
  soprano: { cls: 'sax', sub: ['soprano'], ...lead('soprano', 'saxsoprano') },
  baritone: { cls: 'sax', sub: ['baritone'], dur: 0.45, ...lead('baritone', 'saxbaritone') },   // the recorded notes are 0.5 s long
  flute: { cls: 'flute', ...lead('flute', 'flute') },
  altoflute: { cls: 'altoflute', ...lead('altoflute', 'altoflute') },
  clarinet: { cls: 'clarinet', ...lead('reed', 'clarinet') },
  trumpet: { cls: 'trumpet', ...lead('trumpet', 'trumpet') },
  tine: { cls: 'epiano', sub: ['tine'], ...keys('tine', 'epiano') },
  wurlitzer: { cls: 'epiano-reed', ...keys('wurlitzer', 'epianoreed') },
  tx81z: { cls: 'epiano-fm', ...keys('tx81z', 'epianofm') },
  piano: { cls: 'piano', ...keys('piano', 'piano') },
  vibraphone: { cls: 'vibraphone', minM: 52, ...keys('vibraphone', 'vibraphone') },
};
