// lib/material.mjs: the material contract. A material declares the property types it consumes and provides,
// ranged parameters, how it reaches a font file, and one render function. The engine supplies `consumes` from the
// glyph context, converting through lib/adapters.mjs when the context holds a different property.
//
//   defineMaterial({
//     id: 'glass', title, lineage,                 // lineage: the module it calls (never a copy)
//     consumes: ['coverage', 'surface.albedo?'],    // '?' marks optional
//     provides: ['surface.albedo', 'light.dispersion'],
//     params: { ior: { min, max, default, unit } | { options, default } },
//     font: (params) => ({ kind: 'outline' | 'colr' | 'variable' | 'live', how, field? }),
//     render: ({ inputs, params, w, h, seed, clock }) => ({ 'surface.albedo': value, ... }),
//   })
//
// font.kind says which output is real font technology:
//   outline   the material is a real outline (the glyph intersected with a pattern field, in font units)
//   variable  a continuous parameter that moves points only, so it is a variation axis
//   colr      layered paint (COLRv1): flat inks, offsets, gradients over the outline or inflated copies
//   live      only the canvas or WebGL bundle can hold it (light transport, motion, sound)
import { PROPS, checkProp } from './props.mjs';

export const SLOTS = Object.freeze(['shadow', 'fill', 'interior', 'stroke', 'edge', 'motion', 'sound']);
export const FONT_KINDS = Object.freeze(['outline', 'variable', 'colr', 'live']);

const parse = (s) => ({ prop: s.replace(/\?$/, ''), optional: s.endsWith('?') });

export function defineMaterial(spec) {
  const errs = [];
  if (!/^[a-z][a-z0-9-]*$/.test(spec.id ?? '')) errs.push(`id "${spec.id}" must be lower case`);
  const consumes = (spec.consumes ?? []).map(parse), provides = spec.provides ?? [];
  for (const c of consumes) if (!PROPS[c.prop]) errs.push(`consumes unknown property ${c.prop}`); else if (PROPS[c.prop].dataOnly) errs.push('provenance cannot be consumed for drawing');
  for (const p of provides) if (!PROPS[p]) errs.push(`provides unknown property ${p}`); else if (PROPS[p].dataOnly) errs.push('provenance cannot be drawn');
  if (!provides.length) errs.push('a material must provide at least one property');
  for (const [k, p] of Object.entries(spec.params ?? {})) {
    if (p.options) { if (!p.options.includes(p.default)) errs.push(`param ${k}: default not in options`); }
    else if (typeof p.default === 'string') { if (p.color && !/^#[0-9a-f]{6}$/i.test(p.default)) errs.push(`param ${k}: colour must be #rrggbb`); }
    else if (!(p.min <= p.default && p.default <= p.max)) errs.push(`param ${k}: default ${p.default} outside ${p.min}..${p.max}`);
  }
  if (typeof spec.render !== 'function') errs.push('render must be a function');
  if (typeof spec.font !== 'function') errs.push('font must be a function');
  if (errs.length) throw new Error(`defineMaterial ${spec.id}: ${errs.join('; ')}`);
  return Object.freeze({ title: spec.id, lineage: '', sounds: provides.includes('sound.pcm'), ...spec, consumes, provides, params: spec.params ?? {} });
}

/** Defaults filled, numbers clamped, unknown keys refused (a typo in a recipe never passes silently). */
export function resolveParams(m, given = {}) {
  const out = {};
  for (const k of Object.keys(given)) if (!(k in m.params)) throw new Error(`${m.id}: unknown parameter "${k}"`);
  for (const [k, p] of Object.entries(m.params)) {
    const v = given[k] ?? p.default;
    if (p.options) { if (!p.options.includes(v)) throw new Error(`${m.id}.${k}: "${v}" not one of ${p.options.join(', ')}`); out[k] = v; }
    else if (typeof p.default === 'string') { if (p.color && !/^#[0-9a-f]{6}$/i.test(String(v))) throw new Error(`${m.id}.${k}: "${v}" is not #rrggbb`); out[k] = String(v); }
    else out[k] = Math.max(p.min, Math.min(p.max, +v));
  }
  return out;
}

/** Run a material and check every provided value against its property type. */
export function runMaterial(m, args) {
  const params = resolveParams(m, args.params);
  const out = m.render({ ...args, params });
  for (const [prop, v] of Object.entries(out)) {
    if (!m.provides.includes(prop)) throw new Error(`${m.id}: returned ${prop}, which it does not declare`);
    const e = checkProp(prop, v); if (e) throw new TypeError(`${m.id}: ${prop}: ${e}`);
  }
  return out;
}

// Shared colour helpers (linear light).
export const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
export const hex = (h) => { const n = parseInt(h.slice(1), 16); return [lin(((n >> 16) & 255) / 255), lin(((n >> 8) & 255) / 255), lin((n & 255) / 255)]; };
export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
