// controls.mjs: false-success controls for the ear. A clean excerpt of a piece is rendered, then one defect at a time is
// planted in it, and the ear listens to each. A control passes when the ear raises the flag that names the defect; the
// clean excerpts must raise none. A defect the ear does not flag is a hole in the ear, and is reported as one.
// Two excerpts are used: the slow ballad (most defects), and the drum and bass piece (the low-end defect, which needs a
// sub and a bass guitar together; its clean reading is also the check that the fast piece stays calm).
import { renderPiece } from './piece.js';
import { listen } from '../ear/index.js';
import { lowpass } from '../ear/low.js';
import { Biquad } from '../../world/sound/sound/v3/instruments/core.js';

const copy = (p) => ({ ...p, channels: p.channels.map((c) => c.slice()), stems: Object.fromEntries(Object.entries(p.stems).map(([k, v]) => [k, v.map((c) => c.slice())])) });
const remix = (p) => { for (let c = 0; c < 2; c++) for (let i = 0; i < p.channels[c].length; i++) p.channels[c][i] = p.stems.music[c][i] + p.stems.ambience[c][i]; return p; };
const each = (p, fn) => { for (const c of p.channels) fn(c); return p; };

// Each defect: what was planted, the flag that must appear, and how to plant it. `render` defects change the performance
// (the score stays as written); the others change the finished audio. `on` names the excerpt (the ballad when absent).
export const DEFECTS = [
  { id: 'clipping', planted: 'mix raised 12 dB and cut flat at full scale', expect: ['clipping'], post: (p) => each(p, (c) => { for (let i = 0; i < c.length; i++) c[i] = Math.max(-1, Math.min(1, c[i] * 4)); }) },
  { id: 'stem-transposed', planted: 'bass played a semitone high throughout', expect: ['stem-bass', 'roots'], render: { transpose: { bass: 1 } } },
  { id: 'keys-transposed', planted: 'electric piano played a semitone high throughout', expect: ['stem-keys'], render: { transpose: { keys: 1 } } },
  { id: 'wrong-chord', planted: 'bar 11: piano, bass and pad play the chord three semitones up', expect: ['chord'], render: { shiftBar: { bar: 10, semis: 3 } } },
  { id: 'tempo-drift', planted: 'tempo rises steadily, 8 percent over 32 bars', expect: ['tempo-drift', 'tempo', 'beat'], render: { drift: 0.08 } },
  { id: 'boost-3k', planted: '8 dB peak at 3 kHz on the mix', expect: ['harshness'], post: (p) => each(p, (c) => new Biquad('peak', 3000, 1.2, p.sr, 8).run(c)) },
  { id: 'loudness', planted: 'mix 8 dB under the target', expect: ['loudness'], post: (p) => each(p, (c) => { for (let i = 0; i < c.length; i++) c[i] *= Math.pow(10, -8 / 20); }) },
  { id: 'phase-inverted', planted: 'right channel upside down', expect: ['correlation', 'mono'], post: (p) => { const c = p.channels[1]; for (let i = 0; i < c.length; i++) c[i] = -c[i]; return p; } },
  { id: 'dropout', planted: '60 ms of silence at 30 s', expect: ['dropout'], post: (p) => each(p, (c) => c.fill(0, Math.round(30 * p.sr), Math.round(30.06 * p.sr))) },
  { id: 'dc-offset', planted: 'a constant 0.02 added to the left channel', expect: ['dc-offset'], post: (p) => { const c = p.channels[0]; for (let i = 0; i < c.length; i++) c[i] += 0.02; return p; } },
  { id: 'ambience-masks-lead', planted: 'sea and wind raised 20 dB over the music', expect: ['masking-lead', 'masking-music'], post: (p) => { for (const c of p.stems.ambience) for (let i = 0; i < c.length; i++) c[i] *= 10; return remix(p); } },
  { id: 'mistuned-note', planted: 'one lead note 45 cents sharp', expect: ['tuning'], render: { detune: { note: 1, cents: 45 } } },
  { id: 'loop', planted: 'the first eight-bar statement repeated note for note in place of every later section', expect: ['loop'], render: { loop: true } },
  { id: 'abrupt-entry', planted: 'bass, kit and lead all start in the same bar at full strength', expect: ['entry'], render: { staged: false } },
  { id: 'dull', planted: 'everything above 1.5 kHz turned down 6 dB on the mix', expect: ['dull'], post: (p) => each(p, (c) => { const lp = new Biquad('lp', 1500, 0.7, p.sr); for (let i = 0; i < c.length; i++) { const lo = lp.tick(c[i]); c[i] = lo + 0.5 * (c[i] - lo); } }) },
  { id: 'low-phase', planted: 'right channel upside down below about 200 Hz only', expect: ['low-mono'], post: (p) => { const c = p.channels[1], lo = lowpass(c, p.sr, 220); for (let i = 0; i < c.length; i++) c[i] -= 2 * lo[i]; return p; } },
  { id: 'low-clash', on: 'deep-current', planted: 'the bass guitar plays an octave down, 14 dB louder, inside the band of the sub', expect: ['low-clash'], render: { transpose: { bass: -12 }, mix: { bass: 14 } } },
  { id: 'static-lead', planted: 'every lead note the same wave: no breath, no vibrato, no scoop, one strength', expect: ['static-lead'], render: { staticLead: true } },
];
export const EXCERPTS = { 'low-tide': { bars: 36 }, 'deep-current': { bars: 44 } };

// Run every control. Returns { clean: { piece: report }, rows: [{ id, planted, caught, by, flags }] }.
export function runControls({ seed = 1, sr = 48000, log = null, only = null } = {}) {
  const hear = (p) => listen({ channels: p.channels, sr: p.sr }, { score: p.score, stems: p.stems }), bases = {}, clean = {}, rows = [];
  const base = (id) => { if (!bases[id]) { bases[id] = renderPiece(id, { ...EXCERPTS[id], seed, sr }); clean[id] = hear(bases[id]); log?.(`clean ${id}: ${clean[id].flags.map((f) => `${f.id} (${Number(f.value).toFixed(3)})`).join(', ') || 'no flags'}`); } return bases[id]; };
  base('low-tide'); base('deep-current');
  for (const d of DEFECTS) {
    if (only && !only.includes(d.id)) continue; const id = d.on || 'low-tide', b = base(id);
    // a performance defect is rendered with the clean render's master gain, so only the planted error differs
    const p = d.render ? renderPiece(id, { ...EXCERPTS[id], seed, sr, defects: d.render, masterOpts: { gainDb: b.master.gainDb } }) : d.post(copy(b)), r = hear(p), ids = r.flags.map((f) => f.id), hit = r.flags.filter((f) => d.expect.includes(f.id));
    rows.push({ id: d.id, on: id, planted: d.planted, caught: hit.length > 0, by: hit.map((f) => `${f.id}: ${f.measure} = ${Number(f.value).toFixed(3)} (limit ${f.limit})`), flags: ids, also: ids.filter((i) => !d.expect.includes(i)), report: r });
    log?.(`${d.id}: ${hit.length ? 'caught' : 'MISSED'} | ${r.flags.map((f) => `${f.id} (${Number(f.value).toFixed(3)})`).join(', ') || 'no flags'}`);
  }
  return { clean, bases, rows };
}
