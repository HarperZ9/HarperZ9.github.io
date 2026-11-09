// lib/materials-core.mjs: inks and pattern-field materials. Every one of these reaches a font file as real outline
// or colour-layer technology, because each is either a flat ink, an offset copy, or the glyph intersected with a
// field in font units (lib/fields.mjs).
import { defineMaterial, hex, clamp } from './material.mjs';
import { make } from './props.mjs';
import { FIELDS, normalise } from './fields.mjs';

// Coverage of the glyph intersected with a field, per placed glyph in glyph-local font units.
export function fieldCoverage(g, name, p, base) {
  const { w, h } = g, out = new Float32Array(w * h), F = FIELDS[name];
  for (const pl of g.lay.placed) {
    const s = pl.s, x0 = Math.max(0, Math.floor(pl.x - 0.2 * pl.g.advance * s)), x1 = Math.min(w - 1, Math.ceil(pl.x + 1.2 * pl.g.advance * s));
    const y0 = Math.max(0, Math.floor(pl.baseline - 1000 * s)), y1 = Math.min(h - 1, Math.ceil(pl.baseline + 300 * s)), aa = 1 / s, box = { x0: 0, x1: pl.g.advance };
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x, c = base[i]; if (c <= 0) continue;
      const v = c * F.at((x + 0.5 - pl.x) / s, (pl.baseline - y - 0.5) / s, p, aa, box); if (v > out[i]) out[i] = v;
    }
  }
  return out;
}

export function paint(w, h, cov, rgb, ground = null) {
  const A = make.albedo(w, h);
  for (let i = 0; i < w * h; i++) { const a = cov[i]; A.data[i * 4] = rgb[0]; A.data[i * 4 + 1] = rgb[1]; A.data[i * 4 + 2] = rgb[2]; A.data[i * 4 + 3] = a; }
  return A;
}

const tone = { heavy: { min: 0.2, max: 0.95, default: 0.62, unit: 'share of pitch at the descender' }, light: { min: 0.05, max: 0.8, default: 0.26, unit: 'share of pitch at the ascender' } };
const colorParam = (d) => ({ color: Object.freeze({ default: d, color: true }) });

function fieldMaterial(id, title, field, params, kindNote, extra = {}) {
  return defineMaterial({
    id, title, lineage: `lib/fields.mjs ${field}; the outline route of typeface/build/techniques.py`,
    consumes: ['coverage', ...(extra.consumes ?? [])], provides: ['surface.albedo'],
    params: { ...params, ...colorParam(extra.color ?? '#15130f') },
    font: (p) => ({ kind: 'outline', how: kindNote, field }),
    fieldParams: extra.fieldParams ?? ((p) => p),
    render: ({ inputs, params: p, w, h, glyph }) => {
      const fp = (extra.fieldParams ?? ((q) => q))(p, inputs);
      return { 'surface.albedo': paint(w, h, fieldCoverage(glyph, field, fp, inputs.coverage.data), hex(p.color)) };
    },
  });
}

export const CORE = [
  defineMaterial({
    id: 'ink', title: 'Flat ink', lineage: 'the pen outline as drawn',
    consumes: ['coverage'], provides: ['surface.albedo'], params: { ...colorParam('#15130f'), opacity: { min: 0.1, max: 1, default: 1 } },
    font: () => ({ kind: 'outline', how: 'the outline itself; colour from CSS or a COLRv1 palette entry' }),
    render: ({ inputs, params: p, w, h }) => ({ 'surface.albedo': paint(w, h, inputs.coverage.data.map((v) => v * p.opacity), hex(p.color)) }),
  }),
  defineMaterial({
    id: 'offset', title: 'Offset second ink', lineage: 'two-ink misregistration (techniques.py print)',
    consumes: ['coverage'], provides: ['surface.albedo'], params: { dx: { min: -0.08, max: 0.08, default: 0.022, unit: 'em' }, dy: { min: -0.08, max: 0.08, default: 0.014, unit: 'em' }, ...colorParam('#c8553a'), opacity: { min: 0.1, max: 1, default: 0.9 } },
    font: () => ({ kind: 'colr', how: 'a PaintTransform offset layer of the same glyph under the first ink' }),
    render: ({ inputs, params: p, w, h, glyph }) => {
      const dx = Math.round(p.dx * glyph.size), dy = Math.round(p.dy * glyph.size), src = inputs.coverage.data, out = new Float32Array(w * h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = x - dx, sy = y - dy; if (sx >= 0 && sy >= 0 && sx < w && sy < h) out[y * w + x] = src[sy * w + sx] * p.opacity; }
      return { 'surface.albedo': paint(w, h, out, hex(p.color)) };
    },
  }),
  defineMaterial({
    id: 'glow', title: 'Lit edge', lineage: 'distance falloff; the inflated-outline layers of techniques.py light',
    consumes: ['field.sdf'], provides: ['light.emission'], params: { reach: { min: 0.01, max: 0.2, default: 0.06, unit: 'em' }, power: { min: 0.1, max: 4, default: 1.4 }, ...colorParam('#ffb34d') },
    font: () => ({ kind: 'colr', how: 'three inflated copies (forge inkSpread) under the glyph at falling alpha; a true blur is live only' }),
    render: ({ inputs, params: p, w, h, glyph }) => {
      const R = p.reach * glyph.size, c = hex(p.color), E = make.emission(w, h), D = inputs['field.sdf'].data;
      for (let i = 0; i < w * h; i++) { const d = Math.max(0, D[i]), k = p.power * Math.exp(-d / Math.max(0.5, R)) * (D[i] > 0 ? 1 : 0); E.data[i * 4] = c[0] * k; E.data[i * 4 + 1] = c[1] * k; E.data[i * 4 + 2] = c[2] * k; E.data[i * 4 + 3] = clamp(k); }
      return { 'light.emission': E };
    },
  }),
  fieldMaterial('halftone', 'Dot screen', 'halftone', { pitch: { min: 16, max: 90, default: 34, unit: 'font units' }, ...tone }, 'glyph AND a hex dot screen (skia-pathops)'),
  fieldMaterial('engraved', 'Burin rules', 'engraved', { pitch: { min: 14, max: 90, default: 38, unit: 'font units' }, ...tone }, 'glyph AND swelling rules (skia-pathops)'),
  fieldMaterial('scanline', 'Phosphor rows', 'scanline', { pitch: { min: 10, max: 60, default: 24, unit: 'font units' }, duty: { min: 0.2, max: 0.9, default: 0.58 } }, 'glyph AND even rules: the tube frozen to outlines', { color: '#1f4a35' }),
  fieldMaterial('sand', 'Settled grains', 'sand', { pitch: { min: 14, max: 60, default: 26, unit: 'font units' }, grain: { min: 3, max: 20, default: 9, unit: 'font units' }, seed: { min: 1, max: 9999, default: 41 } }, 'glyph AND one jittered grain per cell'),
  fieldMaterial('ledger', 'Ledger bars', 'ledger', { pitch: { min: 30, max: 160, default: 64, unit: 'font units' }, gap: { min: 0, max: 0.8, default: 0.28 }, floor: { min: -300, max: 400, default: -40 }, ceil: { min: 300, max: 1000, default: 820 } },
    'glyph AND one bar per pitch, height from the series (the font holds the series it was minted with)',
    { consumes: ['data.series'], fieldParams: (p, inputs) => ({ ...p, series: normalise(inputs['data.series'].y) }) }),
  fieldMaterial('ridgeline', 'Ridgelines', 'ridgeline', { pitch: { min: 30, max: 140, default: 70, unit: 'font units' }, amp: { min: 0, max: 200, default: 90, unit: 'font units' }, weight: { min: 6, max: 60, default: 22, unit: 'font units' } },
    'glyph AND traces lifted by the envelope (the font holds the envelope it was minted with)',
    { consumes: ['data.series'], fieldParams: (p, inputs) => ({ ...p, series: normalise(inputs['data.series'].y) }) }),
];
