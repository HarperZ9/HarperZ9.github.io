// node.mjs: the node interface. A node is a technique with typed ports, ranged parameters, a cost estimate and
// one render function. Adapters wrap existing modules in this shape; they never fork them.
//
//   defineNode({
//     id: 'chladni.membrane',           // stable, lower-case, dot-separated: <family>.<technique>
//     title, lane,                       // lane: the medium family it belongs to (image, field, type, sound, data, matter, ...)
//     domains: ['physics', 'acoustics'], // the fields of knowledge it draws on; the explorer prefers recipes that cross them
//     source: 'feed-22/build/chladni.js',
//     inputs:  { field: { type: 'field', optional: true } },
//     outputs: { field: 'field' },
//     params:  { n: { type: 'int', min: 1, max: 9, default: 3, unit: 'nodal lines' }, ... },
//     cost: p => ms,                     // rough wall time at 256 x 256 in Node
//     runtime: ['node', 'browser'],
//     edge: { persuasion: 'Shepard illusion', counterpart: ['reveal.spectrogram'] },   // optional, see dualedge.mjs
//     render: async ctx => ({ field }),  // ctx: { inputs, params, w, h, seed, seedInt, rng, time }
//   })
import { TYPES } from './types.mjs';

const PARAM_KINDS = new Set(['number', 'int', 'enum', 'bool', 'string', 'color']);
const HEX = /^#[0-9a-f]{6}$/i;

export function defineNode(spec) {
  const errs = [];
  if (!/^[a-z0-9]+(\.[a-z0-9-]+)+$/.test(spec.id ?? '')) errs.push(`id "${spec.id}" must be <family>.<technique>, lower case`);
  if (typeof spec.render !== 'function') errs.push('render must be a function');
  const inputs = {};
  for (const [k, v] of Object.entries(spec.inputs ?? {})) {
    const p = typeof v === 'string' ? { type: v } : v;
    if (!TYPES[p.type]) errs.push(`input ${k}: unknown type ${p.type}`);
    inputs[k] = { type: p.type, optional: !!p.optional, doc: p.doc ?? '' };
  }
  const outputs = {};
  for (const [k, v] of Object.entries(spec.outputs ?? {})) {
    if (!TYPES[v]) errs.push(`output ${k}: unknown type ${v}`);
    outputs[k] = v;
  }
  if (!Object.keys(outputs).length) errs.push('a node needs at least one output');
  const params = {};
  for (const [k, p] of Object.entries(spec.params ?? {})) {
    if (!PARAM_KINDS.has(p.type)) errs.push(`param ${k}: type must be one of ${[...PARAM_KINDS].join(', ')}`);
    if ((p.type === 'number' || p.type === 'int') && !(p.min <= p.default && p.default <= p.max)) errs.push(`param ${k}: default ${p.default} outside ${p.min} to ${p.max}`);
    if (p.type === 'enum' && !p.options?.includes(p.default)) errs.push(`param ${k}: default not in options`);
    params[k] = { unit: '', doc: '', ...p };
  }
  if (errs.length) throw new Error(`defineNode ${spec.id}: ${errs.join('; ')}`);
  return Object.freeze({
    id: spec.id, title: spec.title ?? spec.id, lane: spec.lane ?? 'misc', domains: spec.domains ?? [],
    source: spec.source ?? '', doc: spec.doc ?? '', kind: spec.kind ?? 'technique',
    inputs, outputs, params, runtime: spec.runtime ?? ['node', 'browser'],
    cost: spec.cost ?? (() => 20), edge: spec.edge ?? null, render: spec.render,
    explore: spec.explore ?? true,
  });
}

// Fill defaults and clamp into range. Unknown keys are an error so a typo in a recipe never passes silently.
export function resolveParams(node, given = {}) {
  const out = {};
  for (const k of Object.keys(given)) if (!(k in node.params)) throw new Error(`${node.id}: unknown parameter "${k}"`);
  for (const [k, p] of Object.entries(node.params)) {
    let v = given[k] ?? p.default;
    if (p.type === 'number') v = clamp(Number(v), p.min, p.max);
    else if (p.type === 'int') v = Math.round(clamp(Number(v), p.min, p.max));
    else if (p.type === 'bool') v = !!v;
    else if (p.type === 'enum') { if (!p.options.includes(v)) throw new Error(`${node.id}: ${k} = ${v} is not one of ${p.options.join(', ')}`); }
    else if (p.type === 'color') { if (!HEX.test(v)) throw new Error(`${node.id}: ${k} must be #rrggbb`); }
    else v = String(v);
    if (Number.isNaN(v)) throw new Error(`${node.id}: ${k} is not a number`);
    out[k] = v;
  }
  return out;
}

// Draw a random valid value for one parameter (used by the explorer). r() is a seeded [0,1) source.
export function sampleParam(p, r) {
  switch (p.type) {
    case 'number': return p.log ? p.min * (p.max / p.min) ** r() : p.min + (p.max - p.min) * r();
    case 'int': return Math.min(p.max, p.min + Math.floor((p.max - p.min + 1) * r()));
    case 'enum': return p.options[Math.floor(r() * p.options.length)];
    case 'bool': return r() < 0.5;
    default: return p.options?.length ? p.options[Math.floor(r() * p.options.length)] : p.default;
  }
}

const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
