// export.mjs: offline export of graph outputs to files. Node only (fs, zlib); the formats themselves come from
// existing modules: PNG from the feed-23 encoder, WAV and PCM from superstack, MIDI and STL from the site.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { encodePNG } from '../../feed-23/build/brush/png.js';
import { quantizeS16, wavS16 } from '../../substrate/lib/vendor/superstack.mjs';
import { writeMIDI } from '../upstream/site-3ca6529/system/midi-writer.js';
import { heightmapToSTL } from '../upstream/site-3ca6529/system/relief-stl.js';
import { toSRGB8, resampleRaster } from './pix.mjs';
import { rngFrom } from './seed.mjs';

const ensure = p => mkdirSync(dirname(p), { recursive: true });

export async function pngBytes(R, { seed = 'export', ground = null, size = null } = {}) {
  const S = size ? resampleRaster(R, size[0], size[1]) : R;
  return encodePNG(S.w, S.h, toSRGB8(S, rngFrom(seed), { ground }), b => deflateSync(b, { level: 6 }));
}
export async function writePNG(path, R, opts) { ensure(path); writeFileSync(path, await pngBytes(R, opts)); return path; }

export function interleave(a) {
  const n = a.channels[0].length, c = a.channels.length, x = new Float32Array(n * c);
  for (let i = 0; i < n; i++) for (let k = 0; k < c; k++) x[i * c + k] = a.channels[k][i];
  return x;
}
export function wavBytes(a) { return wavS16(quantizeS16(interleave(a)), a.rate, a.channels.length); }
export function writeWAV(path, a) { ensure(path); writeFileSync(path, wavBytes(a)); return path; }

export function svgOf(V, { ground = '#ebe5d8', ink = '#15130f', title = '' } = {}) {
  const f = v => +v.toFixed(2);
  const body = V.paths.map(p => {
    const d = 'M' + p.pts.map(([x, y]) => `${f(x)} ${f(y)}`).join('L') + (p.closed ? 'Z' : '');
    return p.closed && p.fill !== null && (p.fill || !p.width) ? `<path d="${d}" fill="${p.fill && p.fill !== '#000000' ? p.fill : ink}" fill-rule="nonzero"/>` : `<path d="${d}" fill="none" stroke="${p.stroke ?? ink}" stroke-width="${f(p.width ?? 1)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${V.w} ${V.h}" width="${V.w}" height="${V.h}">${title ? `<title>${title.replace(/[<&]/g, '')}</title>` : ''}<rect width="100%" height="100%" fill="${ground}"/>${body}</svg>`;
}
export function writeSVG(path, V, opts) { ensure(path); writeFileSync(path, svgOf(V, opts)); return path; }

export function midiBytes(ev, { bpm = 96 } = {}) {
  const tpq = 480, tick = t => (t * bpm / 60) * tpq, out = [];
  for (const e of ev.events) {
    const note = Math.max(0, Math.min(127, Math.round(e.args?.note ?? 60))), vel = Math.max(1, Math.min(127, Math.round((e.args?.vel ?? 0.6) * 127)));
    out.push({ type: 'on', ch: 0, a: note, b: vel, tick: tick(e.t) }, { type: 'off', ch: 0, a: note, b: 0, tick: tick(e.t + (e.args?.dur ?? 0.25)) });
  }
  return new Uint8Array(writeMIDI({ events: out, tempoBPM: bpm, ticksPerQuarter: tpq }));
}
export function writeMIDIFile(path, ev, o) { ensure(path); writeFileSync(path, midiBytes(ev, o)); return path; }

export function stlBytes(F, opts = {}) { return new Uint8Array(heightmapToSTL(F.data, F.w, F.h, opts)); }
export function writeSTL(path, F, o) { ensure(path); writeFileSync(path, stlBytes(F, o)); return path; }

// Write the renderings for each recipient the recipe names (recipe.for). Returns the file list.
export async function exportRecipients(base, ev, recipe) {
  const { forRecipient } = await import('./recipient.mjs'), files = [];
  for (const r of recipe.for ?? []) {
    const { value, check } = await forRecipient(r, ev, recipe);
    if (!check.ok) console.error(`recipient ${r}: not perceptible: ${check.why.join('; ')}`);
    if (r === 'eye' && value) files.push(await writePNG(`${base}.eye.png`, value, { seed: recipe.seed }));
    else if (r === 'ear' && value) files.push(writeWAV(`${base}.ear.wav`, value));
    else if (r === 'reader') { ensure(`${base}.reader.txt`); writeFileSync(`${base}.reader.txt`, value + '\n'); files.push(`${base}.reader.txt`); }
    else if (r === 'screenreader' || r === 'agent') { const f = `${base}.${r}.json`; ensure(f); writeFileSync(f, JSON.stringify(value, null, 1)); files.push(f); }
  }
  return files;
}

// Write every output of an evaluation next to a base path. Returns the file list.
export async function exportAll(base, outputs, { seed = 'export', palette = {} } = {}) {
  const files = [];
  for (const [name, v] of Object.entries(outputs)) {
    if (v?.data && v.data.length === v.w * v.h * 4) files.push(await writePNG(`${base}.${name}.png`, v, { seed }));
    else if (v?.rate && v.channels) files.push(writeWAV(`${base}.${name}.wav`, v));
    else if (v?.paths) files.push(writeSVG(`${base}.${name}.svg`, v, palette));
    else if (Array.isArray(v?.events)) files.push(writeMIDIFile(`${base}.${name}.mid`, v));
    else if (v?.data && v.channels === 1) files.push(writeSTL(`${base}.${name}.stl`, v));
  }
  return files;
}
