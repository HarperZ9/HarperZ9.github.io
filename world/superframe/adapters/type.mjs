// adapters/type.mjs: words. The house type forge sets text as real outlines (no canvas, no system font), and the
// lettering library turns the word's mask into strokes, cells, lamps, exposures, relief and sound.
// Every glyphs value keeps its text, so a word drawn in any technique still has its real-text equivalent.
import { defineNode } from '../lib/node.mjs';
import { make } from '../lib/types.mjs';
import { fillNonzero, contourToPolyline } from '../lib/fill.mjs';
import { mintMaster } from '../../typeface/forge/family/family.mjs';
import { flatten } from '../../typeface/forge/family/svg.mjs';
import { buildGlyph } from '../../lettering/lib/glyph.mjs';
import { coverage, dotRadius } from '../../lettering/lib/techniques/glyphcell.mjs';
import { lamps } from '../../lettering/lib/techniques/nightlights.mjs';
import { exposure } from '../../lettering/lib/techniques/developed.mjs';
import { pressField } from '../../lettering/lib/techniques/raked.mjs';
import { bitmap, synth } from '../../lettering/lib/techniques/sound.mjs';
import { stencilMask } from '../../lettering/lib/techniques/sprayed.mjs';
import { toneField } from '../../lettering/lib/techniques/engraved.mjs';

const WORDS = ['ROPE', 'ECHO', 'TIDE', 'SIGNAL', 'WITNESS', 'Low Water', 'fixed point', 'NODE', 'Accession', 'dither', 'CHORUS', 'record'];
const masters = new Map();
const master = (style, weight) => { const k = `${style}/${weight}`; if (!masters.has(k)) masters.set(k, mintMaster(style, weight, { noKern: true })); return masters.get(k); };

// Set a line of text with the forge: outlines in px, scaled to fit the frame with a margin.
export function setText(text, w, h, { style = 'display', weight = 700, fill = 0.78 } = {}) {
  const m = master(style, weight), byChar = new Map();
  for (const [n, g] of Object.entries(m.glyphs)) if (g.unicode) byChar.set(g.unicode, n);
  let x = 0; const placed = [];
  for (const ch of text) {
    if (ch === ' ') { x += 280; continue; }
    const name = byChar.get(ch.codePointAt(0)); if (!name) { x += 300; continue; }
    placed.push({ contours: flatten(m.glyphs, name), dx: x, adv: m.glyphs[name].advance, code: ch.codePointAt(0) }); x += m.glyphs[name].advance;
  }
  const em = 1000, s = Math.min((w * fill) / Math.max(1, x), (h * fill) / (em * 0.95)), ox = (w - x * s) / 2, base = h / 2 + 0.36 * em * s;
  const polys = [];
  for (const p of placed) for (const c of p.contours) polys.push(contourToPolyline(c, ([cx, cy]) => [ox + (p.dx + cx) * s, base - cy * s]));
  const spans = placed.map(p => ({ x0: ox + p.dx * s, x1: ox + (p.dx + p.adv) * s, code: p.code }));
  return { polys: polys.filter(q => q.length > 2), scale: s, spans };
}

const glyphCache = new WeakMap();
const lettering = g => { if (!glyphCache.has(g)) glyphCache.set(g, buildGlyph({ w: g.w, h: g.h, mask: g.mask, text: g.text })); return glyphCache.get(g); };
const src = 'lettering/lib/techniques';

export const NODES = [
  defineNode({
    id: 'type.forge', title: 'House type, set as outlines', lane: 'type', domains: ['typography'], source: 'typeface/forge/family',
    doc: 'Sets text in the house family (Accession) from the forge masters and fills it nonzero, so overlapping stroke rings read as one letter.',
    inputs: { text: { type: 'text', optional: true, doc: 'words from upstream; they replace the text parameter' } },
    outputs: { glyphs: 'glyphs' },
    params: {
      text: { type: 'string', default: 'ROPE', doc: 'the word; empty draws one from a small list by seed', options: WORDS },
      style: { type: 'enum', options: ['display', 'text', 'mono'], default: 'display' },
      weight: { type: 'int', min: 300, max: 800, default: 700, unit: 'wght' },
      fill: { type: 'number', min: 0.4, max: 0.95, default: 0.78, unit: 'share of the frame' },
    },
    cost: () => 90,
    render: ({ inputs, params, w, h }) => {
      const text = inputs.text?.text?.trim() ? inputs.text.text.trim().slice(0, 48) : params.text;
      const { polys, spans } = setText(text, w, h, params);
      return { glyphs: { text, w, h, spans, mask: fillNonzero(polys, w, h), outlines: make.vector(w, h, polys.map(pts => ({ pts, closed: true, fill: '#000000' }))) } };
    },
  }),
  defineNode({
    id: 'lettering.sdf', title: 'Signed distance of the word', lane: 'type', domains: ['geometry'], source: 'lettering/lib/glyph.mjs',
    inputs: { glyphs: 'glyphs' }, outputs: { field: 'field' },
    params: { reach: { type: 'number', min: 0.5, max: 8, default: 2.5, unit: 'half-stroke widths' } },
    cost: () => 60,
    render: ({ inputs, params }) => { const g = lettering(inputs.glyphs), F = make.field(g.w, g.h), k = 1 / (g.half * params.reach || 1);
      for (let i = 0; i < F.data.length; i++) F.data[i] = Math.max(0, Math.min(1, 0.5 + g.sdf[i] * k * 0.5)); return { field: F }; },
  }),
  defineNode({
    id: 'lettering.strokes', title: 'Centre-line strokes', lane: 'type', domains: ['geometry', 'calligraphy'], source: 'lettering/lib/skeleton.mjs',
    inputs: { glyphs: 'glyphs' }, outputs: { vector: 'vector' },
    params: { width: { type: 'number', min: 0.2, max: 2, default: 0.7, unit: 'share of the stroke width' } },
    cost: () => 70,
    render: ({ inputs, params }) => { const g = lettering(inputs.glyphs);
      const paths = g.strokes.map(s => { const pts = []; for (let i = 0; i < s.pts.length; i += 2) pts.push([s.pts[i], s.pts[i + 1]]); return { pts, closed: s.closed, width: Math.max(1, g.half * 2 * params.width) }; });
      return { vector: make.vector(g.w, g.h, paths) }; },
  }),
  defineNode({
    id: 'lettering.glyphcell', title: 'Glyph-cell dots', lane: 'type', domains: ['print', 'display tech'], source: `${src}/glyphcell.mjs`,
    inputs: { glyphs: 'glyphs' }, outputs: { particles: 'particles' },
    params: { cell: { type: 'int', min: 3, max: 24, default: 7, unit: 'px' }, misregister: { type: 'number', min: 0, max: 0.4, default: 0.1, unit: 'share of a cell' } },
    cost: () => 70,
    render: ({ inputs, params, rng }) => { const g = lettering(inputs.glyphs), c = coverage(g, params.cell), xs = [], ys = [], sz = [], tone = [];
      for (let j = 0; j < c.rows; j++) for (let i = 0; i < c.cols; i++) { const v = c.cov[j * c.cols + i]; if (v < 0.04) continue; xs.push((i + 0.5 + (rng() - 0.5) * params.misregister) * params.cell); ys.push((j + 0.5 + (rng() - 0.5) * params.misregister) * params.cell); sz.push(dotRadius(v) * params.cell); tone.push(v); }
      return { particles: make.particles(g.w, g.h, Float32Array.from(xs), Float32Array.from(ys), { size: Float32Array.from(sz), tone: Float32Array.from(tone) }) }; },
  }),
  defineNode({
    id: 'lettering.nightlights', title: 'Night lights: the word as a lit city', lane: 'type', domains: ['urban', 'remote sensing'], source: `${src}/nightlights.mjs`,
    inputs: { glyphs: 'glyphs' }, outputs: { particles: 'particles' },
    params: { pitch: { type: 'number', min: 2, max: 12, default: 3.5, unit: 'px between lamps' }, angle: { type: 'number', min: -1.5, max: 1.5, default: -0.21, unit: 'rad' } },
    cost: () => 90,
    render: ({ inputs, params, seedInt }) => { const g = lettering(inputs.glyphs), L = lamps(g, { seed: seedInt, pitch: params.pitch, angle: params.angle });
      return { particles: make.particles(g.w, g.h, Float32Array.from(L, l => l.x), Float32Array.from(L, l => l.y), { tone: Float32Array.from(L, l => (l.cls === 2 ? 0.3 : l.cls === 1 ? 0.7 : 1)), size: Float32Array.from(L, l => (l.cls === 0 ? 0.9 : 0.6)) }) }; },
  }),
  defineNode({
    id: 'lettering.developed', title: 'Developed print exposure', lane: 'type', domains: ['photochemistry'], source: `${src}/developed.mjs`,
    inputs: { glyphs: 'glyphs' }, outputs: { field: 'field' }, cost: () => 40,
    render: ({ inputs, seedInt }) => { const g = lettering(inputs.glyphs); return { field: make.field(g.w, g.h, Float32Array.from(exposure(g, seedInt % 1000))) }; },
  }),
  defineNode({
    id: 'lettering.pressed', title: 'Letterpress relief height', lane: 'type', domains: ['print', 'material'], source: `${src}/raked.mjs`,
    inputs: { glyphs: 'glyphs' }, outputs: { field: 'field' },
    params: { depth: { type: 'number', min: 0.05, max: 0.8, default: 0.3, unit: 'share' }, chamfer: { type: 'number', min: 0.1, max: 1, default: 0.55, unit: 'share' }, uneven: { type: 'number', min: 0, max: 1, default: 0.35, unit: 'share' } },
    cost: () => 120,
    render: ({ inputs, params, seedInt }) => { const g = lettering(inputs.glyphs), P = pressField(g, { seed: seedInt % 31, ...params }); return { field: make.field(g.w, g.h, Float32Array.from(P.height)) }; },
  }),
  defineNode({
    id: 'lettering.stencil', title: 'Stencil cut of the word', lane: 'type', domains: ['street art'], source: `${src}/sprayed.mjs`,
    inputs: { glyphs: 'glyphs' }, outputs: { field: 'field' },
    params: { bridge: { type: 'number', min: 1, max: 12, default: 3, unit: 'px bridge width' } }, cost: () => 50,
    render: ({ inputs, params }) => { const g = lettering(inputs.glyphs); return { field: make.field(g.w, g.h, Float32Array.from(stencilMask(g, params.bridge))) }; },
  }),
  defineNode({
    id: 'lettering.tone', title: 'Engraving tone field', lane: 'type', domains: ['engraving'], source: `${src}/engraved.mjs`,
    inputs: { glyphs: 'glyphs' }, outputs: { field: 'field' },
    params: { part: { type: 'enum', options: ['both', 'letter', 'shadow'], default: 'both' } }, cost: () => 40,
    render: ({ inputs, params }) => { const g = lettering(inputs.glyphs), F = toneField(g, {}, params.part); return { field: make.field(g.w, g.h, Float32Array.from(F, v => 1 - v)) }; },
  }),
  defineNode({
    id: 'lettering.sound', title: 'The word synthesised as a spectrogram', lane: 'sound', domains: ['acoustics', 'typography'], source: `${src}/sound.mjs`,
    doc: 'Additive synthesis of the word bitmap: played through a spectrogram, the sound shows the word again.',
    inputs: { glyphs: 'glyphs' }, outputs: { audio: 'audio' },
    params: { rows: { type: 'int', min: 24, max: 96, default: 48, unit: 'frequency rows' }, fLow: { type: 'number', min: 200, max: 2000, default: 600, unit: 'Hz' }, fHigh: { type: 'number', min: 3000, max: 10000, default: 7000, unit: 'Hz' }, colSec: { type: 'number', min: 0.008, max: 0.03, default: 0.014, unit: 's per column' } },
    cost: () => 400,
    render: ({ inputs, params, seedInt }) => { const g = lettering(inputs.glyphs), s = synth(bitmap(g, params.rows), { fLow: params.fLow, fHigh: params.fHigh, colSec: params.colSec, seed: seedInt % 101 }); return { audio: make.audio(s.sr, [s.x]) }; },
  }),
];
export { WORDS };
