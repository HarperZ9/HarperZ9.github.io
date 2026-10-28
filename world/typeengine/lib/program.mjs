// lib/program.mjs: glyphs as programs, families as parameter spaces over them.
//
// typeengine.glyph/1: one letter.
//   { schema, char,
//     skeleton:     { source: 'accession' | 'zain-mint', style, weight, cut, extra } (the topology and its source),
//     construction: { pen: { stem, contrast }, inkBox: true, cut } (read back from the face, so it is a record of what drew it),
//     bindings:     { <slot>: { material, params, region? } } for slots shadow, fill, interior, stroke, edge, motion, sound }
//
// typeengine.family/1: a family.
//   { schema, id, name, ground, skeleton, bindings, regions, axes: [{ tag, name, min, max, default, target }],
//     inputs: { 'data.series': {...}, 'sound.pcm': {...} }, glyphs: { <char>: { bindings } }, recipe }
//   An axis target is a dotted path into the family ('skeleton.weight', 'bindings.fill.params.bevel',
//   'skeleton.extra.n'). A location { tag: value } sets each target, so cuts, weights and any continuous material
//   parameter are one mechanism. Per-glyph overrides merge over the family bindings.
import { shaped } from './shape.mjs';
import { resolveInputs } from './inputs.mjs';
import { SLOTS } from './material.mjs';
import { MATERIALS } from './materials.mjs';
import { FACE_SOURCES, face } from './faces.mjs';

export const FAMILY_SCHEMA = 'typeengine.family/1';
export const GLYPH_SCHEMA = 'typeengine.glyph/1';
export const DEFAULT_REGIONS = Object.freeze({ interior: { inset: 0.025 }, edge: { width: 0.018 }, stroke: { width: 0.45 }, shadow: { dx: 0.03, dy: 0.03 } });

const clone = (v) => JSON.parse(JSON.stringify(v));
const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
export function merge(a, b) {
  if (!isObj(a) || !isObj(b)) return clone(b ?? a);
  const out = clone(a); for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(out[k]) ? merge(out[k], v) : clone(v);
  return out;
}
function setPath(obj, path, value) {
  const keys = path.split('.'); let o = obj;
  for (const k of keys.slice(0, -1)) { if (!(isObj(o[k]) || Array.isArray(o[k]))) o[k] = {}; o = o[k]; }
  o[keys.at(-1)] = value;
}
export function getPath(obj, path) { return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj); }

/** Errors as a list of strings; empty when the family is well formed. */
export function validateFamily(f) {
  const e = [];
  if (f?.schema !== FAMILY_SCHEMA) e.push(`schema must be ${FAMILY_SCHEMA}`);
  if (!/^[a-z0-9-]+$/.test(f?.id ?? '')) e.push('id must be lower case, digits and hyphens');
  if (!FACE_SOURCES.includes(f?.skeleton?.source ?? 'accession')) e.push(`skeleton.source must be one of ${FACE_SOURCES.join(', ')}`);
  for (const [slot, b] of Object.entries(f?.bindings ?? {})) {
    if (!SLOTS.includes(slot)) e.push(`unknown slot ${slot}`);
    else if (!MATERIALS.has(b?.material)) e.push(`${slot}: unknown material ${b?.material}`);
    else for (const k of Object.keys(b.params ?? {})) if (!(k in MATERIALS.get(b.material).params)) e.push(`${slot}: ${b.material} has no parameter ${k}`);
    for (const [prop, f] of Object.entries(b?.feed ?? {})) {
      const m = MATERIALS.get(b?.material);
      if (m && !m.consumes.some((c) => c.prop === prop)) e.push(`${slot}: ${b.material} does not consume ${prop}`);
      if (f && typeof f === 'object' && !MATERIALS.has(f.material)) e.push(`${slot}: feed ${prop} names unknown material ${f.material}`);
    }
  }
  if (!f?.bindings?.fill) e.push('a family needs a fill binding');
  for (const a of f?.axes ?? []) {
    if (!/^[A-Za-z]{4}$/.test(a.tag ?? '')) e.push(`axis tag "${a.tag}" must be four letters`);
    if (!(a.min <= a.default && a.default <= a.max)) e.push(`axis ${a.tag}: default outside min..max`);
    if (typeof a.target !== 'string') e.push(`axis ${a.tag}: target must be a path`);
  }
  for (const [ch, g] of Object.entries(f?.glyphs ?? {})) for (const slot of Object.keys(g.bindings ?? {})) if (!SLOTS.includes(slot)) e.push(`glyph ${ch}: unknown slot ${slot}`);
  return e;
}

/** The family with every axis at its location (default where unset). */
export function instance(f, loc = {}) {
  const e = validateFamily(f); if (e.length) throw new Error(`family ${f?.id}: ${e.join('; ')}`);
  const out = clone(f);
  for (const a of f.axes ?? []) setPath(out, a.target, Math.max(a.min, Math.min(a.max, loc[a.tag] ?? a.default)));
  out.regions = merge(DEFAULT_REGIONS, f.regions ?? {});
  out.location = Object.fromEntries((f.axes ?? []).map((a) => [a.tag, getPath(out, a.target)]));
  return out;
}

// Modifiers (lib/shape.mjs) change the construction; they read the family's inputs, so a series can set widths.
export const faceOf = (inst) => (inst.skeleton.modifiers?.length ? shaped(inst.skeleton, resolveInputs(inst.inputs)) : face(inst.skeleton));

/** One letter's program, resolved at a location. */
export function glyphProgram(f, ch, loc = {}) {
  const inst = instance(f, loc), fc = faceOf(inst), g = fc.glyph(ch);
  return {
    schema: GLYPH_SCHEMA, char: ch, family: f.id, location: inst.location,
    skeleton: { ...inst.skeleton, strokes: g ? g.skeleton.length : 0, advance: g?.advance ?? null },
    construction: { pen: { stem: fc.metrics.stem, contrast: fc.metrics.contrast }, inkBox: fc.source === 'accession', cut: inst.skeleton.cut ?? null, source: fc.source },
    bindings: merge(inst.bindings, f.glyphs?.[ch]?.bindings ?? {}),
    regions: inst.regions,
  };
}
