// adapters/core.mjs: the axes that are not a medium. A clock; analog sources (a scanned picture, a recorded sound,
// a decomposed reference as a starting material); distributions and their sampling; and criteria (a picture
// measured into a score), so goals can travel through a graph like any other value.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { sample, hold } from '../lib/dist.mjs';
import { fromDescriptors } from '../../studio/lib/descriptor.mjs';
import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Minimal PNG reader: 8-bit greyscale, RGB or RGBA, not interlaced. Enough for scans and our own exports.
export function decodePNG(buf) {
  const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset);
  if (dv.getUint32(0) !== 0x89504e47) throw new Error('png: not a PNG');
  let o = 8, w = 0, h = 0, ct = 0, depth = 0, il = 0; const idat = [];
  while (o < u.length) {
    const len = dv.getUint32(o), type = String.fromCharCode(...u.subarray(o + 4, o + 8)), body = u.subarray(o + 8, o + 8 + len);
    if (type === 'IHDR') { const d = new DataView(body.buffer, body.byteOffset); w = d.getUint32(0); h = d.getUint32(4); depth = body[8]; ct = body[9]; il = body[12]; }
    else if (type === 'IDAT') idat.push(body); else if (type === 'IEND') break;
    o += 12 + len;
  }
  if (depth !== 8 || il) throw new Error(`png: only 8-bit non-interlaced is read (got depth ${depth}, interlace ${il})`);
  const ch = { 0: 1, 2: 3, 4: 2, 6: 4 }[ct]; if (!ch) throw new Error(`png: colour type ${ct} not read`);
  const raw = inflateSync(Buffer.concat(idat.map(b => Buffer.from(b)))), stride = w * ch, out = new Uint8ClampedArray(w * h * 4), prev = new Uint8Array(stride), cur = new Uint8Array(stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let i = 0; i < stride; i++) {
      const a = i >= ch ? cur[i - ch] : 0, b = prev[i], c = i >= ch ? prev[i - ch] : 0, x = line[i];
      cur[i] = f === 0 ? x : f === 1 ? x + a : f === 2 ? x + b : f === 3 ? x + ((a + b) >> 1) : x + paeth(a, b, c);
    }
    for (let x = 0; x < w; x++) { const s = x * ch, d = (y * w + x) * 4; if (ch < 3) { out[d] = out[d + 1] = out[d + 2] = cur[s]; out[d + 3] = ch === 2 ? cur[s + 1] : 255; } else { out[d] = cur[s]; out[d + 1] = cur[s + 1]; out[d + 2] = cur[s + 2]; out[d + 3] = ch === 4 ? cur[s + 3] : 255; } }
    prev.set(cur);
  }
  return { w, h, rgba: out };
}
function paeth(a, b, c) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }

// 16-bit PCM WAV reader.
export function decodeWAV(buf) {
  const u = new Uint8Array(buf), dv = new DataView(u.buffer, u.byteOffset, u.byteLength); let o = 12, rate = 48000, ch = 1, bits = 16, data = null;
  while (o + 8 <= u.length) { const id = String.fromCharCode(...u.subarray(o, o + 4)), len = dv.getUint32(o + 4, true);
    if (id === 'fmt ') { ch = dv.getUint16(o + 10, true); rate = dv.getUint32(o + 12, true); bits = dv.getUint16(o + 22, true); }
    if (id === 'data') data = [o + 8, len]; o += 8 + len + (len & 1); }
  if (!data || bits !== 16) throw new Error('wav: only 16-bit PCM is read');
  const n = data[1] / 2 / ch, chans = Array.from({ length: ch }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < ch; c++) chans[c][i] = dv.getInt16(data[0] + (i * ch + c) * 2, true) / 32768;
  return make.audio(rate, chans);
}

const MC = new URL('../../', import.meta.url);
const DEMO_REFS = (() => { try { const d = new URL('2026-10-23-decompose/out/demo/', MC); return readdirSync(d).filter(n => existsSync(new URL(`${n}/ref/`, d))); } catch { return []; } })();

export const NODES = [
  defineNode({
    id: 'time.clock', title: 'A clock', lane: 'time', domains: [], source: 'superframe', explore: false,
    outputs: { time: 'time' }, params: { t: { type: 'number', min: 0, max: 600, default: 1, unit: 's' }, duration: { type: 'number', min: 0.1, max: 600, default: 4, unit: 's' }, fps: { type: 'int', min: 1, max: 120, default: 24 } },
    render: ({ params }) => ({ time: make.time(params.t, params.duration, params.fps) }),
  }),
  defineNode({
    id: 'analog.scan', title: 'A scanned or photographed picture', lane: 'analog', domains: ['photography'], source: 'superframe', runtime: ['node'], explore: false,
    doc: 'Reads a PNG from disk (8-bit). Third-party pictures enter outputs only where their licence allows; otherwise decompose them into descriptors and use analog.reference.',
    outputs: { raster: 'raster' }, params: { path: { type: 'string', default: '' } },
    render: ({ params }) => { const p = decodePNG(readFileSync(params.path)); return { raster: px.fromSRGB8(p.w, p.h, p.rgba) }; },
  }),
  defineNode({
    id: 'analog.recording', title: 'A recorded sound', lane: 'analog', domains: ['acoustics'], source: 'superframe', runtime: ['node'], explore: false,
    outputs: { audio: 'audio' }, params: { path: { type: 'string', default: '' } },
    render: ({ params }) => ({ audio: decodeWAV(readFileSync(params.path)) }),
  }),
  defineNode({
    id: 'analog.reference', title: 'A reference, decomposed into a material', lane: 'analog', domains: ['art history'], source: '2026-10-23-decompose descriptors via studio/lib/descriptor.mjs', runtime: ['node'],
    doc: 'Only measurements cross over (palette, grain, orientation, cadence, layer evidence), never pixels. The rendered result must still pass the similarity gate against the reference.',
    outputs: { material: 'material' }, params: { ref: { type: 'string', default: DEMO_REFS[0] ?? '', options: DEMO_REFS } },
    cost: () => 5,
    render: ({ params }) => {
      const dir = new URL(`2026-10-23-decompose/out/demo/${params.ref}/ref/`, MC), raw = {};
      const sub = readdirSync(dir).find(n => !n.endsWith('.json')) ?? '';
      const base = sub ? new URL(`${sub}/`, dir) : dir;
      for (const k of ['palette', 'grain', 'texture', 'motion', 'layers', 'brush', 'composition']) { const f = new URL(`${k}.json`, base); if (existsSync(f)) raw[k] = JSON.parse(readFileSync(f, 'utf8')); }
      return { material: fromDescriptors(raw, { id: `ref-${params.ref}`.toLowerCase().replace(/[^a-z0-9-]/g, '-'), name: params.ref }) };
    },
  }),
  defineNode({
    id: 'dist.make', title: 'A distribution', lane: 'probability', domains: ['statistics'], source: 'superframe', explore: false,
    outputs: { distribution: 'distribution' },
    params: { kind: { type: 'enum', options: ['normal', 'uniform', 'lognormal'], default: 'normal' }, a: { type: 'number', min: -100, max: 100, default: 0, doc: 'mean, or min for uniform' }, b: { type: 'number', min: 0, max: 100, default: 1, doc: 'sd, or max for uniform' } },
    render: ({ params: p }) => ({ distribution: p.kind === 'uniform' ? { kind: 'uniform', min: Math.min(p.a, p.b), max: Math.max(p.a, p.b) } : { kind: p.kind, mean: p.a, sd: p.b } }),
  }),
  defineNode({
    id: 'dist.draw', title: 'Draw a series from a distribution', lane: 'probability', domains: ['statistics'], source: 'superframe',
    doc: 'Sample: seeded draws. Hold: every value is the held value (mean or mode), so the same graph runs deterministic.',
    inputs: { distribution: 'distribution' }, outputs: { series: 'series' },
    params: { n: { type: 'int', min: 2, max: 2000, default: 64 }, mode: { type: 'enum', options: ['sample', 'hold', 'walk'], default: 'walk' } },
    render: ({ inputs, params, rng }) => { const d = inputs.distribution; let acc = 0;
      const y = Array.from({ length: params.n }, () => params.mode === 'hold' ? hold(d) : params.mode === 'walk' ? (acc += sample(d, rng)) : sample(d, rng));
      return { series: make.series(y, { label: `${params.mode} of ${d.kind}` }) }; },
  }),
  defineNode({
    id: 'measure.picture', title: 'Measure a picture into a score', lane: 'criteria', domains: ['perception'], source: 'superframe (in-graph proxies for QUALITY-SPEC R2, R4, R6)', explore: false,
    doc: 'Contrast, edge density, clipping and level coverage, folded into one value in 0..1 with each metric kept. The explorer uses the full Python quality tools; this is the in-graph reading a goal can steer by.',
    inputs: { raster: 'raster' }, outputs: { score: 'score' },
    params: { target: { type: 'number', min: 0, max: 1, default: 0.6, unit: 'score to pass' } },
    render: ({ inputs, params }) => {
      const L = px.luma(inputs.raster).data, n = L.length, w = inputs.raster.w; let s = 0, s2 = 0, clip = 0, edges = 0; const levels = new Set();
      for (let i = 0; i < n; i++) { const v = L[i]; s += v; s2 += v * v; if (v > 0.995) clip++; levels.add(Math.round(v * 255)); if (i % w && Math.abs(v - L[i - 1]) > 0.08) edges++; }
      const mean = s / n, sd = Math.sqrt(Math.max(0, s2 / n - mean * mean)), m = { contrast: +sd.toFixed(4), mean: +mean.toFixed(4), clip: +(clip / n).toFixed(4), edges: +(edges / n).toFixed(4), levels: levels.size };
      const value = Math.min(1, sd / 0.22) * 0.4 + Math.min(1, m.edges / 0.06) * 0.3 + (m.clip < 0.01 ? 0.15 : 0) + Math.min(1, levels.size / 120) * 0.15;
      return { score: { name: 'picture', value: +value.toFixed(4), target: [params.target, 1], pass: value >= params.target, metrics: m } };
    },
  }),
];
