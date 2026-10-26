// convert.mjs: converters between port types. Each converter is an ordinary node with one input and one output
// (kind 'convert'). When two ports differ, graph.mjs finds the cheapest chain of converters by breadth-first
// search over this table and inserts it. Converters read the recipe palette (ctx.palette) so an inserted
// colour step matches the rest of the piece.
import { defineNode } from './node.mjs';
import { make } from './types.mjs';
import * as px from './pix.mjs';
import { contours } from '../../lettering/lib/fields.mjs';
import { stft } from '../../sound/sound/dsp.js';
import { filmLinear } from '../../substrate/lib/thinfilm.mjs';
import { scanScene, renderReference } from '../upstream/site-3ca6529/system/media-engine/sound.mjs';
import { s16ToFloats } from '../upstream/site-3ca6529/system/media-engine/contracts.mjs';
import { renderEvents } from './voices.mjs';
import { textToSeries, describePicture, describeSound } from './transform.mjs';
import { renderImage } from '../../studio/lib/lanes/image.mjs';
import { score } from '../../studio/lib/lanes/sound.mjs';
import { describeSeries } from '../../substrate/lib/vector.mjs';
import { setText } from '../adapters/type.mjs';
import { fillNonzero } from './fill.mjs';

const PENTA = [0, 3, 5, 7, 10, 12, 15, 17, 19, 22, 24, 27, 29, 31, 34, 36];
const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const conv = (from, to, id, render, extra = {}) => defineNode({
  id: `convert.${id}`, title: `${from} to ${to}`, lane: 'convert', kind: 'convert', inputs: { in: from }, outputs: { out: to },
  source: 'superframe', explore: false, cost: () => 5, ...extra, render,
});

export const CONVERTERS = [
  // language: words read as they are, words set as letters, data and letters described in words
  conv('text', 'glyphs', 'text-glyphs', ({ inputs, w, h }) => { const t = inputs.in.text || ' ', { polys, spans } = setText(t, w, h, {});
    return { out: { text: t, w, h, spans, mask: fillNonzero(polys, w, h), outlines: make.vector(w, h, polys.map(pts => ({ pts, closed: true, fill: '#000000' }))) } }; }, { source: 'typeface forge via adapters/type.mjs' }),
  conv('text', 'series', 'text-series', ({ inputs }) => { const s = textToSeries(inputs.in.text, 'words'); return { out: make.series(s.y, { label: s.label, unit: s.unit }) }; }, { source: 'superframe lib/transform.mjs' }),
  // motion: a poster frame stands for the whole; the captions are its words
  conv('motion', 'raster', 'motion-raster', ({ inputs }) => { const M = inputs.in, k = M.captions?.length ? M.captions[Math.floor(M.captions.length / 2)].from + 1 : Math.floor(M.frames.length / 2); return { out: make.raster(M.w, M.h, Float32Array.from(M.frames[Math.min(M.frames.length - 1, k)])) }; }),
  conv('motion', 'text', 'motion-text', ({ inputs }) => ({ out: { text: (inputs.in.captions ?? []).map(c => c.text).join(' '), role: 'content' } })),
  // pictures and sounds into words take the plain-description path, so no chain reaches text through an empty glyph
  conv('raster', 'text', 'raster-text', ({ inputs }) => ({ out: { text: describePicture(inputs.in), role: 'description' } }), { source: 'superframe lib/transform.mjs' }),
  conv('audio', 'text', 'audio-text', ({ inputs }) => ({ out: { text: describeSound(inputs.in), role: 'description' } }), { source: 'superframe lib/transform.mjs' }),
  conv('glyphs', 'text', 'glyphs-text', ({ inputs }) => ({ out: { text: inputs.in.text, role: 'content' } })),
  conv('series', 'text', 'series-text', ({ inputs }) => ({ out: { text: describeSeries(Array.from(inputs.in.y), { label: inputs.in.label ?? 'Series', unit: inputs.in.unit ?? '', labels: inputs.in.x ? Array.from(inputs.in.x, String) : null }), role: 'description' } }), { source: 'substrate/lib/vector.mjs describeSeries' }),
  conv('field', 'raster', 'field-raster', ({ inputs, params, palette }) => {
    const F = px.resample(inputs.in, inputs.in.w, inputs.in.h);
    if (params.ramp === 'film') {
      const R = make.raster(F.w, F.h);
      for (let i = 0; i < F.w * F.h; i++) { const c = filmLinear(180 + 580 * F.data[F.channels === 2 ? 2 * i : i]); R.data.set([c[0], c[1], c[2], 1], 4 * i); }
      return { out: R };
    }
    const stops = params.ramp === 'tri' ? [palette.ground, palette.accent, palette.ink] : [palette.ground, palette.ink];
    return { out: px.colormap(F, stops) };
  }, { params: { ramp: { type: 'enum', options: ['duo', 'tri', 'film'], default: 'duo', doc: 'ground to ink, ground-accent-ink, or thin-film interference colour' } } }),
  conv('raster', 'field', 'raster-field', ({ inputs }) => ({ out: px.luma(inputs.in) })),
  conv('field', 'particles', 'field-particles', ({ inputs, params, w, h, rng }) => {
    const F = px.resample(inputs.in, w, h), n = params.n, x = new Float32Array(n), y = new Float32Array(n), tone = new Float32Array(n);
    let k = 0, guard = 0;
    while (k < n && guard++ < n * 60) { const xi = rng() * w, yi = rng() * h, v = F.data[(yi | 0) * w + (xi | 0)]; if (rng() < v ** params.gamma) { x[k] = xi; y[k] = yi; tone[k] = v; k++; } }
    return { out: make.particles(w, h, x.slice(0, k), y.slice(0, k), { tone: tone.slice(0, k) }) };
  }, { params: { n: { type: 'int', min: 100, max: 60000, default: 6000, unit: 'points' }, gamma: { type: 'number', min: 0.3, max: 4, default: 1.4, unit: 'density exponent' } } }),
  conv('particles', 'field', 'particles-field', ({ inputs, w, h }) => ({ out: px.splatParticles(inputs.in, { w, h }) })),
  conv('vector', 'raster', 'vector-raster', ({ inputs, w, h, palette }) => ({ out: px.paintVector(inputs.in, { w, h, ground: palette.ground, ink: palette.ink }) })),
  conv('vector', 'field', 'vector-field', ({ inputs, w, h }) => ({ out: px.rasterizeVector(inputs.in, { w, h }) })),
  conv('field', 'vector', 'field-vector', ({ inputs, params }) => {
    const F = inputs.in, paths = [];
    for (const iso of params.levels === 1 ? [0.5] : Array.from({ length: params.levels }, (_, i) => (i + 1) / (params.levels + 1))) {
      for (const c of contours(F.channels === 2 ? F.data.filter((_, i) => i % 2 === 0) : F.data, F.w, F.h, iso)) {
        const pts = []; for (let i = 0; i < c.pts.length; i += 2) pts.push([c.pts[i], c.pts[i + 1]]);
        if (pts.length > 2) paths.push({ pts, closed: true, width: 1.1, fill: null });
      }
    }
    return { out: make.vector(F.w, F.h, paths) };
  }, { params: { levels: { type: 'int', min: 1, max: 12, default: 6, unit: 'iso lines' } } }),
  conv('glyphs', 'field', 'glyphs-field', ({ inputs }) => ({ out: make.field(inputs.in.w, inputs.in.h, Float32Array.from(inputs.in.mask)) })),
  conv('field', 'glyphs', 'field-glyphs', ({ inputs }) => ({ out: { text: '', w: inputs.in.w, h: inputs.in.h, mask: Float32Array.from(inputs.in.data.filter((_, i) => inputs.in.channels !== 2 || i % 2 === 0), v => (v > 0.5 ? 1 : 0)) } })),
  conv('glyphs', 'vector', 'glyphs-vector', ({ inputs }) => {
    const g = inputs.in;
    if (g.outlines) return { out: g.outlines };
    const paths = contours(g.mask, g.w, g.h, 0.5).map(c => { const pts = []; for (let i = 0; i < c.pts.length; i += 2) pts.push([c.pts[i], c.pts[i + 1]]); return { pts, closed: true, width: 1.2, fill: null }; });
    return { out: make.vector(g.w, g.h, paths) };
  }),
  conv('audio', 'field', 'audio-field', ({ inputs, w, h }) => {
    const a = inputs.in, x = a.channels[0], n = 1024, hop = Math.max(64, Math.floor(x.length / Math.max(16, w)));
    const S = stft(x, a.rate, { n, hop, floorDb: -90 }), cols = S.frames.length, rows = Math.min(S.bins, Math.floor(10000 / S.binHz));
    const G = make.field(cols, rows);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) G.data[(rows - 1 - r) * cols + c] = clamp((S.frames[c][r] + 90) / 72);
    return { out: px.resample(G, w, h) };
  }),
  conv('field', 'audio', 'field-audio', ({ inputs, params }) => {
    const F = px.resample(inputs.in, params.cols, params.rows), freqs = Array.from({ length: params.rows }, (_, r) => 110 * 2 ** ((PENTA[(params.rows - 1 - r) % PENTA.length] + 36 * Math.floor((params.rows - 1 - r) / PENTA.length)) / 12));
    const ref = renderReference(scanScene({ rows: params.rows, cols: params.cols, grid: F.data }, freqs, params.seconds, { label: 'superframe' }));
    return { out: make.audio(48000, [Float32Array.from(s16ToFloats(ref.pcm))]) };
  }, { source: 'HarperZ9.github.io system/media-engine/sound.mjs scanScene', params: { rows: { type: 'int', min: 4, max: 32, default: 16, unit: 'pitch rows' }, cols: { type: 'int', min: 8, max: 128, default: 48, unit: 'time columns' }, seconds: { type: 'number', min: 2, max: 20, default: 6, unit: 's' } } }),
  conv('audio', 'series', 'audio-series', ({ inputs, params }) => {
    const x = inputs.in.channels[0], k = Math.max(1, Math.floor(x.length / params.frames)), y = [];
    for (let f = 0; f < params.frames; f++) { let s = 0; for (let i = f * k; i < Math.min(x.length, (f + 1) * k); i++) s += x[i] * x[i]; y.push(Math.sqrt(s / k)); }
    return { out: make.series(y, { label: 'RMS envelope', unit: 'linear amplitude' }) };
  }, { params: { frames: { type: 'int', min: 8, max: 512, default: 96, unit: 'frames' } } }),
  conv('series', 'events', 'series-events', ({ inputs, params }) => {
    const y = inputs.in.y, n = px.normalise(y), dt = params.seconds / y.length;
    const events = Array.from(n, (v, i) => ({ t: +(i * dt).toFixed(4), voice: params.voice, role: 'datum', args: { note: params.root + PENTA[Math.round(v * 10)], dur: Math.max(0.08, dt * 1.6), vel: 0.25 + 0.4 * v } }));
    return { out: make.events(events, params.seconds) };
  }, { source: 'pentatonic mapping after studio/lib/drivers.mjs dataBrush', params: { root: { type: 'int', min: 36, max: 72, default: 52, unit: 'MIDI' }, seconds: { type: 'number', min: 1, max: 20, default: 6, unit: 's' }, voice: { type: 'enum', options: ['pluck', 'bell', 'pad', 'bubble'], default: 'pluck' } } }),
  conv('events', 'audio', 'events-audio', ({ inputs, rng }) => ({ out: renderEvents(inputs.in, { rng }) }), { source: 'sound/sound/v3/instruments via lib/voices.mjs', cost: () => 400 }),
  conv('events', 'series', 'events-series', ({ inputs }) => ({ out: make.series(inputs.in.events.length >= 2 ? inputs.in.events.map(e => e.args?.note ?? 60) : [0, 0], { label: 'pitch', unit: 'MIDI' }) })),
  conv('series', 'vector', 'series-vector', ({ inputs, w, h }) => {
    const n = px.normalise(inputs.in.y), pts = Array.from(n, (v, i) => [w * (0.08 + 0.84 * i / (n.length - 1)), h * (0.85 - 0.7 * v)]);
    return { out: make.vector(w, h, [{ pts, width: Math.max(1.5, w / 160), widths: Array.from(n, v => Math.max(0.8, (w / 90) * (0.3 + v))) }]) };
  }),
  conv('series', 'field', 'series-field', ({ inputs, w, h }) => {
    const n = px.normalise(inputs.in.y), F = make.field(w, h);
    for (let x = 0; x < w; x++) { const u = x / (w - 1) * (n.length - 1), k = Math.min(n.length - 2, u | 0), v = n[k] + (n[k + 1] - n[k]) * (u - k);
      for (let y = 0; y < h; y++) F.data[y * w + x] = clamp((v - (1 - y / h)) * 6 + 0.5); }
    return { out: F };
  }),
  conv('field', 'series', 'field-series', ({ inputs, params }) => {
    const F = inputs.in, y = [];
    for (let k = 0; k < params.n; k++) { const x0 = Math.floor(k * F.w / params.n), x1 = Math.max(x0 + 1, Math.floor((k + 1) * F.w / params.n)); let s = 0, c = 0; for (let yy = 0; yy < F.h; yy++) for (let x = x0; x < x1; x++) { s += F.data[(yy * F.w + x) * (F.channels ?? 1)]; c++; } y.push(s / c); }
    return { out: make.series(y, { label: 'column mean', unit: 'share' }) };
  }, { params: { n: { type: 'int', min: 4, max: 256, default: 48, unit: 'values' } } }),
  conv('particles', 'events', 'particles-events', ({ inputs, params }) => {
    const P = inputs.in, step = Math.max(1, Math.floor(P.n / params.max)), events = [];
    for (let i = 0; i < P.n; i += step) events.push({ t: +(P.x[i] / P.w * params.seconds).toFixed(4), voice: 'pluck', role: 'grain', args: { note: 48 + PENTA[Math.round((1 - P.y[i] / P.h) * 15)], dur: 0.2, vel: 0.15 + 0.3 * (P.tone ? P.tone[i] : 0.5) } });
    events.sort((a, b) => a.t - b.t);
    return { out: make.events(events, params.seconds) };
  }, { params: { max: { type: 'int', min: 8, max: 400, default: 96, unit: 'events' }, seconds: { type: 'number', min: 1, max: 20, default: 6, unit: 's' } } }),
  conv('vector', 'particles', 'vector-particles', ({ inputs, params }) => {
    const V = inputs.in, xs = [], ys = [];
    for (const p of V.paths) for (let i = 0; i + 1 < p.pts.length; i++) { const [ax, ay] = p.pts[i], [bx, by] = p.pts[i + 1], L = Math.hypot(bx - ax, by - ay), m = Math.max(1, Math.floor(L / params.spacing)); for (let k = 0; k < m; k++) { xs.push(ax + (bx - ax) * k / m); ys.push(ay + (by - ay) * k / m); } }
    return { out: make.particles(V.w, V.h, Float32Array.from(xs), Float32Array.from(ys)) };
  }, { params: { spacing: { type: 'number', min: 0.5, max: 20, default: 2, unit: 'px' } } }),
  conv('material', 'raster', 'material-raster', ({ inputs, w, h, seedInt }) => ({ out: px.fromLayer(renderImage(inputs.in, { w, h, seed: seedInt % 100000, marks: false })) }), { source: 'studio/lib/lanes/image.mjs', cost: () => 120 }),
  conv('material', 'events', 'material-events', ({ inputs, seedInt }) => { const sc = score(inputs.in, { seconds: 6, seed: seedInt % 100000 }); return { out: make.events(sc.events, sc.seconds) }; }, { source: 'studio/lib/lanes/sound.mjs' }),
];
