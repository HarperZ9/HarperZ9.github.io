// adapters/medium.mjs: the living medium as superframe nodes. Anything a node makes can be poured in (lib/medium/
// ports.mjs maps every port type to additives); the tank runs; the output is the living picture or one of its
// readings (exploded sheets, depth planes, or the mosaic by law, element, medium or property).
import { defineNode } from '../lib/node.mjs';
import { Medium, tankAdditives, additivesFromPort, render, view } from '../lib/medium/index.mjs';

const VIEWS = ['living', 'exploded', 'planes', 'mosaic-laws', 'mosaic-elements', 'mosaic-mediums', 'mosaic-temperature', 'ribbons'];
const INPUTS = { text: 'text', raster: 'raster', series: 'series', audio: 'audio', events: 'events', material: 'material', field: 'field', vector: 'vector', particles: 'particles', distribution: 'distribution', score: 'score', time: 'time' };

function build(inputs, params, seed) {
  const m = new Medium({ nx: params.grid, ny: Math.round(params.grid * 9 / 16), seed });
  const words = inputs.text?.text ?? params.words;
  for (const a of tankAdditives(words)) {
    const [kind] = a;
    if (kind === 'oil' && !params.oil) continue; if (kind === 'heat' && !params.heat) continue; if (kind === 'wind' && !params.wind) continue;
    if (kind === 'glass' && !params.glass) continue; if (kind === 'bubbles' && !params.bubbles) continue;
    if (kind === 'heat') a[2] *= params.heat; if (kind === 'wind') a[2] *= params.wind; if (kind === 'oil') a[2] *= params.oil;
    m.add(...a);
  }
  for (const [port, type] of Object.entries(INPUTS)) if (port !== 'text' && inputs[port]) for (const a of additivesFromPort(type, inputs[port], { mode: params.form, at: 1 })) {
    if (a[0] === 'data') a[3].target = m.emitters.length - 1;
    m.add(...a);
  }
  return m;
}

function show(m, params, w, h) {
  if (params.view === 'living') return render(m, w, h);
  if (params.view === 'exploded') return view(m, { W: w, H: h, mode: 'exploded', layers: ['temperature', 'pigment', 'oil', 'advection', 'buoyancy'], living: render(m, Math.round(w / 2), Math.round(h / 2)) }).raster;
  if (params.view === 'planes') return view(m, { W: w, H: h, layers: 'planes' }).raster;
  if (params.view === 'ribbons') return view(m, { W: w, H: h, mosaic: { axis: 'speed', tileSize: 1, ribbons: true } }).raster;
  return view(m, { W: w, H: h, mosaic: { axis: params.view.replace('mosaic-', ''), tileSize: 1, maxTile: 16 } }).raster;
}

export const NODES = [
  defineNode({
    id: 'medium.tank', title: 'A tank of water and air that anything can be poured into', lane: 'matter', domains: ['fluid dynamics', 'optics', 'chemistry', 'craft'], source: 'superframe lib/medium',
    doc: 'Typed words fall in as ink and dissolve; oil gathers and marbles at the surface; heat rises from below; wind raises waves; settled pigment builds a mosaic bed under a glass lens. Any input pours in as an additive by its type. The view picks the living picture or a reading of it.',
    inputs: Object.fromEntries(Object.entries(INPUTS).map(([k, t]) => [k, { type: t, optional: true }])),
    outputs: { raster: 'raster' },
    params: {
      words: { type: 'string', default: 'flow', doc: 'used when no text input arrives' },
      seconds: { type: 'number', min: 0.5, max: 30, default: 6, unit: 's of tank time' },
      view: { type: 'enum', options: VIEWS, default: 'living' },
      grid: { type: 'int', min: 64, max: 384, default: 160, unit: 'cells across' },
      oil: { type: 'number', min: 0, max: 2, default: 1 }, heat: { type: 'number', min: 0, max: 3, default: 1 }, wind: { type: 'number', min: 0, max: 2, default: 1 },
      glass: { type: 'bool', default: true }, bubbles: { type: 'bool', default: true },
      form: { type: 'enum', options: ['stretch', 'rigid', 'dissolve'], default: 'stretch', doc: 'how a poured picture travels' },
    },
    cost: p => (p?.grid ?? 160) ** 2 * (p?.seconds ?? 6) * 0.012,
    render: ({ inputs, params, w, h, seed }) => { const m = build(inputs, params, seed); m.run(inputs.time ? Math.max(0.1, Math.min(30, inputs.time.t)) : params.seconds); return { raster: show(m, params, w, h) }; },
  }),
];
