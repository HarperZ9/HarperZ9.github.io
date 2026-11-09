// adapters/optics.mjs: glass, water and the television signal (glass). Each node calls the glass module's
// own functions; the physics is not reimplemented here. Rasters are linear light, the same shape on both sides.
//   signal.crt     a CRT signal (bars, card, snow, or any raster as the programme) drawn by the beam
//   glass.refract  whatever is behind, seen through a glass body (a word, a figure, an arch or a field as height)
//   liquid.surface the wave-equation surface as a height field
//   liquid.shore   a scene seen across rippled water to the horizon; a word stands in it and reflects
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { signal, display } from '../../glass/crt.js';
import { renderGlass, fromMask, flute, figure, arch, maskFromSdf, sd, GLASSES } from '../../glass/glass.js';
import { Water, renderShore } from '../../glass/liquid.js';
import { sky } from '../../glass/lib/sky.js';

const G = 'glass';
const ras = R => make.raster(R.w, R.h, R.data);

export const NODES = [
  defineNode({
    id: 'signal.crt', title: 'Television signal on a tube', lane: 'image', domains: ['broadcast engineering', 'display physics'], source: `${G}/crt.js`,
    doc: 'Programme in YIQ, band-limited per line (luma wide, chroma narrow), with snow, sync jitter, tear and roll; then a Gaussian beam per scan line, aperture grille, halation and curvature. A raster input becomes the programme.',
    inputs: { raster: { type: 'raster', optional: true } }, outputs: { raster: 'raster' },
    params: {
      content: { type: 'enum', options: ['card', 'bars', 'static'], default: 'card' },
      lines: { type: 'int', min: 24, max: 480, default: 240, unit: 'scan lines' },
      snow: { type: 'number', min: 0, max: 0.6, default: 0.05, unit: 'sigma on Y' },
      tear: { type: 'number', min: 0, max: 0.1, default: 0.01, unit: 'share of a line' },
      roll: { type: 'number', min: 0, max: 2, default: 0, unit: 'frames per second' },
      mask: { type: 'number', min: 0, max: 0.6, default: 0.2, unit: 'aperture grille depth' },
    },
    cost: p => p.lines * 1.5,
    render: ({ inputs, params, w, h, seedInt, time }) => {
      const sig = signal({ content: inputs.raster ? 'source' : params.content, source: inputs.raster ?? null, lines: params.lines, samples: Math.min(720, Math.max(64, w)),
        snow: params.snow, tear: params.tear, roll: params.roll, t: time?.t ?? 1, seed: seedInt % 100000 });
      return { raster: ras(display(sig, w, h, { mask: params.mask })) };
    },
  }),
  defineNode({
    id: 'glass.refract', title: 'Seen through glass', lane: 'image', domains: ['optics', 'materials'], source: `${G}/glass.js`,
    doc: 'Refraction through a height-field glass body with per-channel index (Cauchy through n_d and V_d), Beer-Lambert tint, exact Fresnel against a gradient sky, forward-splatted caustics and optional reeds. The body is the word, a field (as height), a figure with an aperture head, or an arch.',
    inputs: { raster: 'raster', glyphs: { type: 'glyphs', optional: true }, field: { type: 'field', optional: true } }, outputs: { raster: 'raster' },
    params: {
      body: { type: 'enum', options: ['input', 'figure', 'arch', 'disc'], default: 'input' },
      glass: { type: 'enum', options: Object.keys(GLASSES), default: 'crown' },
      thickness: { type: 'number', min: 0.005, max: 0.2, default: 0.05, unit: 'share of height' },
      gap: { type: 'number', min: 0, max: 0.4, default: 0.1, unit: 'share of height to what is behind' },
      reedPitch: { type: 'number', min: 0, max: 0.05, default: 0, unit: 'share of width (0 is plain)' },
      reedDepth: { type: 'number', min: 0, max: 0.01, default: 0.003, unit: 'share of height' },
    },
    cost: () => 300,
    render: ({ inputs, params: p, w, h }) => {
      const bg = inputs.raster.w === w && inputs.raster.h === h ? inputs.raster : null;
      if (!bg) throw new Error('glass.refract: the raster behind must match the frame size');
      let mask = null;
      if (inputs.glyphs && p.body === 'input') mask = inputs.glyphs.mask;
      else if (inputs.field && p.body === 'input') mask = Float32Array.from(inputs.field.data, v => (v > 0.02 ? 1 : 0));
      else if (p.body === 'figure') mask = figure(w, h).mask;
      else if (p.body === 'arch') mask = arch(w, h, { wall: 0 }).mask;
      else mask = maskFromSdf(w, h, (x, y) => sd.circle(x, y, w / 2, h / 2, Math.min(w, h) * 0.3));
      let body = fromMask(mask, w, h, { radius: p.thickness * h * 0.8, thickness: p.thickness * h });
      if (inputs.field && p.body === 'input' && !inputs.glyphs) body = { ...body, height: Float32Array.from(inputs.field.data, v => v * p.thickness * h) };
      if (p.reedPitch > 0) body = flute(body, { pitch: Math.max(2, p.reedPitch * w), depth: p.reedDepth * h });
      return { raster: ras(renderGlass(bg, body, { glass: p.glass, gap: p.gap * h })) };
    },
  }),
  defineNode({
    id: 'liquid.surface', title: 'Water surface (wave equation)', lane: 'field', domains: ['fluid mechanics', 'numerical methods'], source: `${G}/liquid.js`,
    doc: 'A damped wave equation with an optional plate-stiffness term (capillary-like dispersion), seeded drops and wind. Output is the surface height, mapped to 0..1.',
    outputs: { field: 'field' },
    params: { drops: { type: 'int', min: 0, max: 200, default: 30 }, steps: { type: 'int', min: 1, max: 600, default: 80 }, stiffness: { type: 'number', min: 0, max: 0.03, default: 0.002 }, wind: { type: 'number', min: 0, max: 0.03, default: 0.004 } },
    cost: p => p.steps * 2,
    render: ({ params: p, w, h, seedInt }) => {
      const W = new Water({ nx: w, ny: h, seed: seedInt % 100000, stiffness: p.stiffness }).rain(p.drops).step(p.steps).wind(p.wind).step(4);
      let lo = Infinity, hi = -Infinity; for (const v of W.u) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
      return { field: make.field(w, h, Float32Array.from(W.u, v => (v - lo) / Math.max(1e-9, hi - lo))) };
    },
  }),
  defineNode({
    id: 'liquid.shore', title: 'Across the water', lane: 'image', domains: ['optics', 'fluid mechanics'], source: `${G}/liquid.js, lib/sky.js`,
    doc: 'A low camera over rippled shallow water: exact mirror reflection through ripple normals, Fresnel, a sandy bottom by Beer-Lambert, wet sand above the swash line, sun glints at the sun\'s angular size. A word stands in the water and reflects.',
    inputs: { raster: { type: 'raster', optional: true }, glyphs: { type: 'glyphs', optional: true } }, outputs: { raster: 'raster' },
    params: { horizon: { type: 'number', min: 0.2, max: 0.8, default: 0.56, unit: 'share of height' }, drops: { type: 'int', min: 0, max: 100, default: 16 }, ripple: { type: 'number', min: 0, max: 8, default: 3 } },
    cost: () => 400,
    render: ({ inputs, params: p, w, h, seedInt }) => {
      const above = inputs.raster ?? sky(w, h, { horizon_y: p.horizon });
      const sea = new Water({ nx: 256, ny: 256, seed: seedInt % 100000, stiffness: 0.002, damping: 0.006 }).rain(p.drops, { amp: [-0.3, -0.1] }).step(70);
      const objects = [];
      if (inputs.glyphs) {
        let ymax = 0; const g = inputs.glyphs, L = make.raster(w, h);
        for (let i = 0; i < w * h; i++) if (g.mask[i] > 0.5) ymax = Math.max(ymax, Math.floor(i / w));
        for (let i = 0; i < w * h; i++) { const a = g.mask[i]; if (a > 0) L.data.set([0.9, 0.86, 0.8, a], i * 4); }
        objects.push({ raster: L, contact: ymax + 1 });
      }
      return { raster: ras(renderShore(above, sea, { horizon: p.horizon, ripple: p.ripple, objects, sun: { x: 0.25, y: p.horizon - 0.02 } })) };
    },
  }),
];
