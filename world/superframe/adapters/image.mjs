// adapters/image.mjs: picture makers. The feed-23 stamp brush engine and rod grid, the feed-25 compositor's sources
// and operators (tone, glitch), its curl-walk glyph SDF and plexus, and a two-input blend. Operators run on a
// feed-25 Layer built from the incoming raster, then come back as a raster.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import * as px from '../lib/pix.mjs';
import { Surface, paintStroke, preset, PRESET_NAMES, linear, render as brushRender, SCENES } from '../../feed-23/build/brush/index.js';
import { createLedger, maskFromCoverage } from '../../feed-23/build/ledger/ledger.js';
import { noise as srcNoise, film as srcFilm, chladni as srcChladni, OPS, MODES, Layer } from '../../feed-25/build/compose.mjs';
import { design as glyphDesign, distance as glyphDistance } from '../../feed-25/build/glyphs.mjs';
import { plexus } from '../../feed-25/build/hud.mjs';

const F23 = 'feed-23/build', F25 = 'feed-25/build';
const DEPOSIT = ['rim', 'billow', 'sponge', 'haze', 'wisp', 'filament'].filter(n => PRESET_NAMES.includes(n));
const layerOf = (R, seed) => px.toLayer(R, { seed });

// Turn vector paths into brush samples: x, y in px, pressure from the path's widths when it has them.
function samplesOf(p, w) {
  const out = [], maxW = p.widths ? Math.max(...p.widths) : 1;
  p.pts.forEach(([x, y], i) => out.push({ x, y, p: p.widths ? 0.25 + 0.75 * (p.widths[i] / maxW) : 0.75, t: i * 0.016 }));
  return out;
}

const OP_NODES = [
  ['posterize', { levels: { type: 'int', min: 2, max: 12, default: 5 } }, ['print']],
  ['threshold', { t: { type: 'number', min: 0.15, max: 0.85, default: 0.5 } }, ['print']],
  ['pixelate', { size: { type: 'int', min: 2, max: 32, default: 8, unit: 'px' } }, ['display tech']],
  ['mosh', { block: { type: 'int', min: 4, max: 64, default: 16, unit: 'px' }, steps: { type: 'int', min: 1, max: 12, default: 6 }, carry: { type: 'number', min: 0, max: 1, default: 0.7 }, strength: { type: 'number', min: 0, max: 4, default: 1.5, unit: 'blocks' } }, ['codecs']],
  ['streak', { count: { type: 'int', min: 50, max: 3000, default: 600 }, figure: { type: 'number', min: 0, max: 0.5, default: 0.12 } }, ['codecs', 'print']],
  ['scanwave', { wavelength: { type: 'number', min: 10, max: 200, default: 80, unit: 'px' }, amp: { type: 'number', min: 1, max: 20, default: 6, unit: 'px' }, band: { type: 'int', min: 1, max: 24, default: 8, unit: 'rows' } }, ['display tech']],
  ['blocks', { count: { type: 'int', min: 10, max: 400, default: 80 }, copy: { type: 'number', min: 0, max: 1, default: 0.6 } }, ['codecs']],
  ['blur', { r: { type: 'number', min: 0.5, max: 12, default: 2, unit: 'px' } }, ['optics']],
  ['contrast', { c: { type: 'number', min: 0.5, max: 2.5, default: 1.3 } }, ['photography']],
  ['speckle', { std: { type: 'number', min: 0.005, max: 0.1, default: 0.03 } }, ['photography']],
  ['saturate', { s: { type: 'number', min: 0, max: 2.5, default: 1.3 } }, ['colour']],
  ['invert', {}, ['photography']],
];

export const NODES = [
  defineNode({
    id: 'brush.stroke', title: 'Stamp brush along paths', lane: 'image', domains: ['painting'], source: `${F23}/brush`,
    doc: 'Each path becomes one brush stroke: dabs of a stamp tip along a smoothed spline, with pressure, grain, wet mix and taper from the preset.',
    inputs: { vector: 'vector' }, outputs: { raster: 'raster' },
    params: { preset: { type: 'enum', options: DEPOSIT, default: 'rim', doc: 'presets that lay down paint; smear, blend, halo and flare only move or add light and vanish on a light ground' }, size: { type: 'number', min: 0.004, max: 0.08, default: 0.02, unit: 'share of width', log: true }, colour: { type: 'enum', options: ['ink', 'accent'], default: 'ink' }, maxPaths: { type: 'int', min: 1, max: 600, default: 160 } },
    cost: p => p.maxPaths * 4,
    render: ({ inputs, params, w, h, palette, seedInt }) => {
      const S = new Surface(w, h).fill(linear(palette.ground)), V = inputs.vector, sx = w / V.w, sy = h / V.h;
      const brush = preset(params.preset, { size: params.size }), color = params.colour === 'ink' ? palette.ink : palette.accent;
      const paths = V.paths.filter(p => p.pts.length > 1).sort((a, b) => b.pts.length - a.pts.length).slice(0, params.maxPaths);
      paths.forEach((p, i) => paintStroke(S, brush, samplesOf({ ...p, pts: p.pts.map(([x, y]) => [x * sx, y * sy]) }, w), { unit: w, seed: seedInt % 100000 + i, color }));
      return { raster: px.fromPremul(w, h, S.px) };
    },
  }),
  defineNode({
    id: 'brush.scene', title: 'Painted scene', lane: 'image', domains: ['painting', 'astronomy'], source: `${F23}/brush/scenes.js`,
    outputs: { raster: 'raster' }, params: { scene: { type: 'enum', options: Object.keys(SCENES), default: 'starcloud' } },
    cost: () => 900,
    render: async ({ params, w, h, seedInt }) => { const sc = SCENES[params.scene](seedInt % 1000); const S = await brushRender(sc, w); return { raster: px.resampleRaster(px.fromPremul(S.w, S.h, S.px), w, h) }; },
  }),
  defineNode({
    id: 'ledger.sweep', title: 'Ledger: a series as swept prisms', lane: 'vector', domains: ['data graphics', 'print'], source: `${F23}/ledger/ledger.js`,
    doc: 'Each value is one prism on a grid: sweep length is the value, direction the sign of its change, ink its quantile. A field masks which cells may be written (a word tallies itself).',
    inputs: { series: { type: 'series', optional: true }, field: { type: 'field', optional: true } }, outputs: { vector: 'vector' },
    params: { cols: { type: 'int', min: 8, max: 64, default: 24 }, rows: { type: 'int', min: 6, max: 48, default: 16 }, maxLen: { type: 'int', min: 1, max: 8, default: 4, unit: 'cells' }, inks: { type: 'enum', options: ['ledger', 'night'], default: 'ledger' } },
    cost: () => 15,
    render: ({ inputs, params, w, h }) => {
      let on = inputs.field ? maskFromCoverage(inputs.field.data, inputs.field.w, inputs.field.h, params.cols, params.rows, 0.5) : null;
      if (on) { let c = 0; for (let j = 0; j < params.rows; j++) for (let i = 0; i < params.cols; i++) c += on(i, j) ? 1 : 0; if (c < 4) on = null; }
      const G = createLedger({ cols: params.cols, rows: params.rows, maxLen: params.maxLen, inks: params.inks, series: inputs.series ? Array.from(inputs.series.y) : null, mask: on, loop: false }).finish();
      const s = Math.min(w / params.cols, h / params.rows), ox = (w - s * params.cols) / 2, oy = (h - s * params.rows) / 2;
      return { vector: make.vector(w, h, G.polygons().map(p => ({ pts: p.pts.map(([x, y]) => [ox + x * s, oy + y * s]), closed: true, fill: p.stroke ? null : p.fill, width: p.stroke ? Math.max(1, s * 0.07) : 0, stroke: p.stroke ? p.fill : undefined }))) };
    },
  }),
  defineNode({
    id: 'compose.noise', title: 'Fractal noise plate', lane: 'image', domains: ['procedural'], source: `${F25}/sources.mjs`,
    outputs: { field: 'field' }, params: { scale: { type: 'number', min: 0.5, max: 32, default: 4, unit: 'cycles per width', log: true }, octaves: { type: 'int', min: 1, max: 8, default: 4 } },
    cost: () => 30, render: ({ params, w, h, seedInt }) => ({ field: px.luma(px.fromLayer(srcNoise(w, h, { ...params, seed: seedInt }))) }),
  }),
  defineNode({
    id: 'compose.film', title: 'Thin-film interference plate', lane: 'image', domains: ['optics'], source: `${F25}/sources.mjs`,
    outputs: { raster: 'raster' }, params: { dMin: { type: 'number', min: 50, max: 600, default: 180, unit: 'nm' }, dMax: { type: 'number', min: 300, max: 1400, default: 760, unit: 'nm' }, scale: { type: 'number', min: 0.5, max: 8, default: 2.2, unit: 'cycles per width' } },
    cost: () => 40, render: ({ params, w, h, seedInt }) => ({ raster: px.fromLayer(srcFilm(w, h, { ...params, seed: seedInt })) }),
  }),
  defineNode({
    id: 'compose.chladni', title: 'Chladni sheet with sand stipple', lane: 'image', domains: ['acoustics'], source: `${F25}/sources.mjs`,
    outputs: { raster: 'raster' }, params: { n: { type: 'int', min: 1, max: 12, default: 3 }, m: { type: 'int', min: 1, max: 12, default: 5 }, mix: { type: 'number', min: 0, max: 90, default: 30, unit: 'deg' }, width: { type: 'number', min: 0.02, max: 0.3, default: 0.08 }, sand: { type: 'number', min: 0, max: 1, default: 0.3 } },
    cost: () => 60, render: ({ params, w, h, seedInt }) => ({ raster: px.fromLayer(srcChladni(w, h, { ...params, seed: seedInt })) }),
  }),
  defineNode({
    id: 'glyphs.curl', title: 'Curl-walk glyph field', lane: 'type', domains: ['procedural', 'asemic writing'], source: `${F25}/glyphs.mjs`,
    doc: 'An invented glyph: tubes and blobs walked along curl noise, as a signed distance field.',
    outputs: { field: 'field' }, params: { tubes: { type: 'int', min: 1, max: 9, default: 4 }, blobs: { type: 'int', min: 0, max: 5, default: 2 }, size: { type: 'number', min: 0.3, max: 1, default: 0.8, unit: 'share of the frame' } },
    cost: () => 40,
    render: ({ params, w, h, seedInt }) => { const g = glyphDesign(seedInt % 100000, { tubes: params.tubes, blobs: params.blobs }), s = Math.min(w, h) * params.size;
      const D = glyphDistance(g, (w - s) / 2, (h - s) / 2, s, w, h, s * 0.08); return { field: make.field(w, h, Float32Array.from(D, d => Math.max(0, Math.min(1, 0.5 - d / (s * 0.04))))) }; },
  }),
  defineNode({
    id: 'compose.plexus', title: 'Plexus network over points', lane: 'image', domains: ['network science'], source: `${F25}/hud.mjs`,
    inputs: { particles: 'particles' }, outputs: { raster: 'raster' },
    params: { radius: { type: 'number', min: 0.02, max: 0.2, default: 0.07, unit: 'share of width' }, max: { type: 'int', min: 20, max: 600, default: 220, unit: 'nodes' } },
    cost: p => p.max * p.max * 0.002,
    render: ({ inputs, params, w, h, palette }) => {
      const P = inputs.particles, step = Math.max(1, Math.floor(P.n / params.max)), pts = [];
      for (let i = 0; i < P.n; i += step) pts.push([P.x[i] * w / P.w, P.y[i] * h / P.h]);
      const L = new Layer(w, h).fill(palette.ground); plexus(L, pts, params.radius * w, { ink: palette.ink, w: Math.max(0.8, w / 400), node: Math.max(1.2, w / 220) });
      return { raster: px.fromLayer(L) };
    },
  }),
  defineNode({
    id: 'compose.blend', title: 'Blend two pictures', lane: 'image', domains: ['compositing'], source: `${F25}/layer.mjs`,
    inputs: { a: 'raster', b: 'raster' }, outputs: { raster: 'raster' },
    params: { mode: { type: 'enum', options: Object.keys(MODES), default: 'multiply' }, opacity: { type: 'number', min: 0.1, max: 1, default: 0.8 } },
    cost: () => 10,
    render: ({ inputs, params, w, h }) => { const A = layerOf(px.resampleRaster(inputs.a, w, h), 1), B = layerOf(px.resampleRaster(inputs.b, w, h), 2); A.place(B, 0, 0, { mode: params.mode, opacity: params.opacity }); return { raster: px.fromLayer(A) }; },
  }),
  defineNode({
    id: 'compose.modulate', title: 'Displace a picture by a field', lane: 'image', domains: ['video synthesis'], source: `${F25}/glitch.mjs`,
    doc: 'Hydra-style modulate: the field shifts where each pixel reads from.',
    inputs: { raster: 'raster', field: 'field' }, outputs: { raster: 'raster' },
    params: { amount: { type: 'number', min: -0.2, max: 0.2, default: 0.05, unit: 'share of width' } },
    cost: () => 20,
    render: ({ inputs, params, w, h }) => { const L = layerOf(px.resampleRaster(inputs.raster, w, h), 3), by = px.toLayer(px.colormap(px.resample(inputs.field, w, h), ['#000000', '#ffffff']));
      OPS.modulate(L, { by, amount: params.amount }); return { raster: px.fromLayer(L) }; },
  }),
  ...OP_NODES.map(([op, params, domains]) => defineNode({
    id: `op.${op}`, title: `${op[0].toUpperCase()}${op.slice(1)}`, lane: 'image', domains, source: `${F25}/${['posterize', 'threshold', 'blur', 'contrast', 'speckle', 'saturate', 'invert'].includes(op) ? 'tone' : 'glitch'}.mjs`,
    inputs: { raster: 'raster' }, outputs: { raster: 'raster' }, params, cost: () => 15,
    render: ({ inputs, params: p, seedInt, palette }) => {
      const L = layerOf(inputs.raster, seedInt % 100000);
      OPS[op](L, op === 'threshold' ? { ...p, dark: palette.ink, light: palette.ground } : p);
      return { raster: px.fromLayer(L) };
    },
  })),
];
