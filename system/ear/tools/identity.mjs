#!/usr/bin/env node
// Build the identity judge's book of reference notes, and show that the judge can tell real instruments apart.
//   node system/ear/tools/identity.mjs build NOTES_DIR      analyse every reference note; write ../identity-refs.json
//   node system/ear/tools/identity.mjs report NOTES_DIR     the confusion tables and the controls
// NOTES_DIR holds single notes cut from the reference recordings as raw 32-bit float mono files with an index.json
// ([{ file, sr, class, sub, source, name, m, vel, ship }]). The recordings stay outside this repository; the book holds
// only numbers measured from them. A note marked ship: false (a source whose licence does not allow it) goes into
// NOTES_DIR/book-local.json and not into the repository's book.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { analyse } from '../timbre.js';
import { build, judge, leaveOut, tableText, identify } from '../identity.js';

export const SOURCES = {
  iowa: { name: 'University of Iowa Musical Instrument Samples', url: 'https://theremin.music.uiowa.edu/MIS.html', licence: 'free for any projects, without restrictions (the page\'s own words)' },
  'bbb-darkblack': { name: 'Karoryfer Samples, Black And Blue Basses', url: 'https://github.com/sfzinstruments/karoryfer.black-and-blue-basses', licence: 'CC0 1.0' },
  'bbb-babyblue': { name: 'Karoryfer Samples, Black And Blue Basses', url: 'https://github.com/sfzinstruments/karoryfer.black-and-blue-basses', licence: 'CC0 1.0' },
  weresax: { name: 'Karoryfer Samples, Weresax', url: 'https://github.com/sfzinstruments/karoryfer.weresax', licence: 'CC0 1.0' },
  meatbass: { name: 'Karoryfer Samples, Meatbass', url: 'https://github.com/sfzinstruments/karoryfer.meatbass', licence: 'CC0 1.0' },
  'gm-rhodes': { name: 'Discord SFZ GM Bank, Electric Piano 1 (a 1977 Rhodes Mark I, recorded by Jeff Learman)', url: 'https://github.com/sfzinstruments/Discord-SFZ-GM-Bank', licence: 'CC0 (stated in the instrument file by its author)' },
  vcsl: { name: 'Versilian Community Sample Library, Tenor Saxophone', url: 'https://github.com/sgossner/VCSL', licence: 'CC0 1.0' },
};
export const readNote = (dir, r) => { const b = readFileSync(path.join(dir, r.file)); return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4); };
export const loadIndex = (dir) => JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8'));
export const loadBook = (file) => JSON.parse(readFileSync(file, 'utf8'));
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), BOOK = path.join(HERE, '..', 'identity-refs.json'), round = (v) => Math.round(v * 1000) / 1000;

// Resample by a ratio (linear interpolation): the note plays faster and higher, as on a tape machine. A control for the judge.
export function shift(x, semis) { const k = Math.pow(2, semis / 12), n = Math.floor(x.length / k), y = new Float32Array(n); for (let i = 0; i < n; i++) { const p = i * k, a = Math.floor(p), f = p - a; y[i] = x[a] + ((x[a + 1] ?? x[a]) - x[a]) * f; } return y; }
export function tone(kind, m, sr = 48000, dur = 1.5) { const f = 440 * Math.pow(2, (m - 69) / 12), x = new Float32Array(Math.round((dur + 0.2) * sr)), at = Math.round(0.1 * sr);
  for (let i = 0; i < Math.round(dur * sr); i++) { const t = i / sr, e = Math.min(1, t / 0.01) * Math.min(1, (dur - t) / 0.02); let y = 0; if (kind === 'sine') y = Math.sin(2 * Math.PI * f * t); else for (let k = 1; k * f < 0.45 * sr; k++) y += Math.sin(2 * Math.PI * k * f * t) / k * 0.6; x[at + i] = 0.4 * e * y; } return x; }

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))) {
  const [cmd, dir] = process.argv.slice(2), index = loadIndex(dir);
  if (cmd === 'build') {
    const refs = [], held = []; for (const r of index) { const a = analyse(readNote(dir, r), r.sr, { m: r.m }); if (!a) { console.log('unreadable', r.name); continue; } (r.hold ? held : refs).push({ cls: r.class, sub: r.sub, source: r.source, name: r.name, m: round(a.m), vel: r.vel, ship: r.ship, v: a.vector.map(round) }); }
    const strip = (list) => list.map(({ ship, ...q }) => q), note = 'Numbers measured from recordings of real instruments. The recordings are not in this repository.';
    const ship = build(strip(refs.filter((r) => r.ship)), { note, built: new Date().toISOString().slice(0, 10), sources: SOURCES }), local = build(strip(refs), { note: 'Local research copy: includes sources that do not ship.' });
    writeFileSync(BOOK, JSON.stringify(ship).replace(/\{"cls"/g, '\n{"cls"') + '\n'); writeFileSync(path.join(dir, 'book-local.json'), JSON.stringify(local)); writeFileSync(path.join(dir, 'held.json'), JSON.stringify(held));
    const count = {}; for (const r of ship.refs) count[r.cls] = (count[r.cls] || 0) + 1; console.log('book:', ship.refs.length, 'notes', count, '\nlimits', Object.fromEntries(Object.entries(ship.limits).map(([k, v]) => [k, round(v)])), '\nlocal book:', local.refs.length, 'notes');
  } else if (cmd === 'report') {
    const book = loadBook(process.argv[4] || BOOK), f = (v) => (Number.isFinite(v) ? v.toFixed(2) : 'n/a');
    const a = leaveOut(book), b = leaveOut(book, { by: 'source' });
    console.log(`Leave one note out: ${a.right} of ${a.total} named as their own instrument (${(100 * a.accuracy).toFixed(1)} %)\n${tableText(a.table)}\n`);
    console.log(`Leave one source out (classes with two or more sources): ${b.right} of ${b.total} (${(100 * b.accuracy).toFixed(1)} %)\n${tableText(b.table)}\n`);
    for (const [x, y] of [['sax', 'clarinet'], ['bassguitar', 'upright']]) console.log(`${x} against ${y}: ${x} heard as ${y} ${a.table[x]?.[y] || 0} of ${Object.values(a.table[x] || {}).reduce((s, v) => s + v, 0)}; ${y} heard as ${x} ${a.table[y]?.[x] || 0} of ${Object.values(a.table[y] || {}).reduce((s, v) => s + v, 0)}`);
    // controls: a sine and a sawtooth at reference pitches must resemble nothing; a reference moved in pitch must keep its class
    let bad = 0, n = 0; const heard = {}; for (const kind of ['sine', 'saw']) for (const m of [36, 43, 50, 57, 62, 67, 72, 79]) { const v = identify(tone(kind, m), 48000, book, { m }); n++; if (v.heard !== 'none') { bad++; heard[`${kind} ${m}`] = `${v.heard} ${f(v.d)}/${f(v.limit)}`; } }
    console.log(`\nControl, pure tones: ${n - bad} of ${n} sines and sawtooths rejected as every instrument`, bad ? heard : '');
    const held = JSON.parse(readFileSync(path.join(dir, 'held.json'), 'utf8')), hh = {}; for (const r of held) { const v = judge(r.v, r.m, book); hh[v.heard] = (hh[v.heard] || 0) + 1; }
    if (held.length) console.log(`Control, a played ${held[0].cls} phrase from a source the book has never seen (${held[0].source}, ${held.length} notes cut from it): heard as`, hh);
    const refIdx = index.filter((r) => r.ship), pick = refIdx.filter((_, i) => i % 5 === 0); let kept = 0, tot = 0; const flips = [];
    for (const r of pick) for (const s of [-3, -2, 2, 3]) { const x = shift(readNote(dir, r), s), an = analyse(x, r.sr, { m: r.m + s }); if (!an) continue; const v = judge(an.vector, an.m, book, { skip: (q) => q.name === r.name }); tot++; if (v.best === r.class) kept++; else flips.push(`${r.name} ${s > 0 ? '+' : ''}${s}: ${v.best}`); }
    console.log(`Control, pitch moved by 2 and 3 semitones (resampled; the note judged without its own entry): nearest class unchanged in ${kept} of ${tot}`); if (flips.length) console.log('  changed:', flips.slice(0, 12).join('; '), flips.length > 12 ? `... and ${flips.length - 12} more` : '');
  }
}
