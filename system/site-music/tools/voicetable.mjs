#!/usr/bin/env node
// The per-voice table: every measured voice against recordings it was not fitted to (where a second licensed source
// exists), beside the distance between real recordings of the instrument, whole note and per segment (segcheck.mjs).
//   node system/site-music/tools/voicetable.mjs NOTES_DIR [--json OUT] [--only NAME]
// A voice "passes" on this picture when its distance to held-out sources is no larger than real sources are from each
// other, over the whole note and in every segment. With one source there is no verdict. A listener decides.
import { writeFileSync } from 'node:fs';
import { segcheck } from './segcheck.mjs';
import { loadIndex } from '../../ear/tools/identity.mjs';
import { PLAN } from './fit.mjs';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
// voice: [plan name, held-out sources (empty: none licensed)]
export const ROWS = { upright: ['upright', ['sneaky', 'dsmolken']], arco: ['uprightarco', ['meatbass', 'dsmolken']], 'bass-guitar': ['bassguitar', []], 'bass-picked': ['basspicked', []], 'bass-ghost': ['bassmuted', []],
  sax: ['sax', ['weresax']], tenor: ['saxtenor', []], soprano: ['saxsoprano', []], baritone: ['saxbaritone', []], flute: ['flute', []], altoflute: ['altoflute', []], clarinet: ['clarinet', []], trumpet: ['trumpet', []],
  tine: ['epiano', []], wurlitzer: ['epianoreed', []], tx81z: ['epianofm', []], piano: ['piano', ['vcsl-steinway', 'vcsl-yamaha']], vibraphone: ['vibraphone', ['iowa']] };
const SEG = ['whole', 'attack', 'early', 'sustain', 'tail'];
export function verdict(held) { if (!held || held.yardstick !== 'another source') return 'no verdict (one licensed source)'; const bad = SEG.filter((k) => held.ours[k] !== null && held.real[k] !== null && held.ours[k] > held.real[k]); return bad.length ? `fails in ${bad.join(', ')}` : 'passes'; }

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('tools/voicetable.mjs')) {
  const dir = process.argv[2], index = loadIndex(dir), only = arg('--only', null), out = [], f = (v) => (v === null || v === undefined ? 'n/a' : v.toFixed(1));
  for (const [voice, [plan, held]] of Object.entries(ROWS)) { if (only && voice !== only) continue; const fitted = segcheck(dir, index, voice, PLAN[plan].source), h = held.length ? segcheck(dir, index, voice, held) : null, v = verdict(h);
    out.push({ voice, fitted: PLAN[plan].source, held, toFitted: fitted, toHeld: h, verdict: v });
    const seg = (o) => SEG.map((k) => `${k} ${f(o[k])}`).join(', ');
    console.log(`${voice}: fitted to ${PLAN[plan].source.join('+')}\n  to fitted:   ${seg(fitted.ours)} (${fitted.notes} notes)\n  ${h ? `to held-out ${held.join('+')}: ${seg(h.ours)} (${h.notes} notes)\n  real-real:   ${seg(h.real)}` : `real-real (${fitted.yardstick}): ${seg(fitted.real)}`}\n  verdict on this picture: ${v}`); }
  const o = arg('--json', null); if (o) writeFileSync(o, JSON.stringify(out, null, 1));
}
