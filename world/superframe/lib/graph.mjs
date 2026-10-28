// graph.mjs: recipes, type checking, automatic converters and evaluation.
//
// A recipe is JSON:
//   { schema: 'superframe.recipe/1', seed: 'any string', size: [w, h],
//     palette: { ground, ink, accent }, time: { t, duration, fps },
//     nodes: [ { id: 'a', node: 'chladni.membrane', params: {...}, in: { port: 'b.out' | 'b' } }, ... ],
//     convert: { 'field>raster': { ramp: 'tri' } },     // optional parameters for inserted converters
//     out: { image: 'c.raster', audio: 'd' } }
// 'b' alone names b's first output. compile() checks every edge; where the two port types differ it inserts the
// shortest chain of converters (instance ids 'a<-b:field>raster'). The same recipe and seed give the same output:
// every node draws from its own substream of the recipe seed (seed.mjs).
import { resolveParams } from './node.mjs';
import { checkValue, TYPE_NAMES } from './types.mjs';
import { nodeSeed } from './seed.mjs';
import { CONVERTERS } from './convert.mjs';
import { sample as sampleDist, hold as holdDist, isDist } from './dist.mjs';

export const SCHEMA = 'superframe.recipe/1';
const DEFAULT_PALETTE = { ground: '#ebe5d8', ink: '#15130f', accent: '#c4632b' };

// Shortest converter chain between two types, by breadth-first search over the converter table.
const CONV_BY_FROM = {};
for (const c of CONVERTERS) { const f = c.inputs.in.type; (CONV_BY_FROM[f] ??= []).push(c); }
const pathCache = new Map();
export function conversionPath(from, to) {
  if (from === to) return [];
  const key = `${from}>${to}`;
  if (pathCache.has(key)) return pathCache.get(key);
  const prev = new Map([[from, null]]), queue = [from];
  while (queue.length) {
    const t = queue.shift();
    for (const c of CONV_BY_FROM[t] ?? []) {
      const o = c.outputs.out;
      if (prev.has(o)) continue;
      prev.set(o, [t, c]); if (o === to) queue.length = 0; else queue.push(o);
    }
  }
  let path = null;
  if (prev.has(to)) { path = []; for (let t = to; t !== from;) { const [p, c] = prev.get(t); path.unshift(c); t = p; } }
  pathCache.set(key, path);
  return path;
}
export function convertible(from, to) { return conversionPath(from, to) !== null; }

// Parameters given as distributions are drawn from the node's own 'params' substream, or held when recipe.hold.
function drawParams(n, recipe) {
  const given = n.params ?? {}, out = {};
  let r = null;
  for (const [k, v] of Object.entries(given)) {
    if (!isDist(v)) { out[k] = v; continue; }
    if (recipe.hold) { out[k] = holdDist(v); continue; }
    r ??= nodeSeed(recipe.seed ?? 'superframe', `${n.id}/params`).rng;
    out[k] = sampleDist(v, r);
  }
  return out;
}

function parseRef(ref, byId) {
  const [id, port] = String(ref).split('.');
  const inst = byId.get(id);
  if (!inst) throw new Error(`recipe: reference "${ref}" names no node`);
  const p = port ?? Object.keys(inst.def.outputs)[0];
  if (!(p in inst.def.outputs)) throw new Error(`recipe: node ${id} (${inst.def.id}) has no output "${p}"`);
  return { id, port: p, type: inst.def.outputs[p] };
}

// compile: recipe -> plan { order: [instances], outs: { name: { id, port, type } } }. Throws with the reason.
export function compile(recipe, registry) {
  if (recipe.schema && recipe.schema !== SCHEMA) throw new Error(`recipe: schema must be ${SCHEMA}`);
  if (!Array.isArray(recipe.nodes) || !recipe.nodes.length) throw new Error('recipe: nodes must be a non-empty array');
  const byId = new Map(), order = [];
  for (const n of recipe.nodes) {
    if (!/^[a-z0-9_-]+$/i.test(n.id ?? '')) throw new Error(`recipe: node id "${n.id}" must be letters, digits, _ or -`);
    if (byId.has(n.id)) throw new Error(`recipe: duplicate node id ${n.id}`);
    const def = registry.get(n.node);
    if (!def) throw new Error(`recipe: unknown node type "${n.node}"`);
    byId.set(n.id, { id: n.id, def, params: resolveParams(def, drawParams(n, recipe)), in: {}, raw: n });
  }
  const convParams = recipe.convert ?? {};
  const insertChain = (src, toType, label) => {
    const chain = conversionPath(src.type, toType);
    if (!chain) throw new Error(`recipe: ${label}: no conversion from ${src.type} to ${toType}`);
    let cur = src;
    for (const c of chain) {
      const key = `${c.inputs.in.type}>${c.outputs.out}`, cid = `${cur.id}:${key}`;
      if (!byId.has(cid)) byId.set(cid, { id: cid, def: c, params: resolveParams(c, convParams[key] ?? {}), in: { in: { id: cur.id, port: cur.port } }, inserted: true });
      cur = { id: cid, port: 'out', type: c.outputs.out };
    }
    return cur;
  };
  for (const n of recipe.nodes) {
    const inst = byId.get(n.id);
    for (const [port, spec] of Object.entries(inst.def.inputs)) {
      const ref = n.in?.[port];
      if (ref === undefined) { if (!spec.optional) throw new Error(`recipe: node ${n.id} (${inst.def.id}) needs input "${port}" (${spec.type})`); continue; }
      const src = parseRef(ref, byId);
      inst.in[port] = insertChain(src, spec.type, `${n.id}.${port}`);
    }
    for (const k of Object.keys(n.in ?? {})) if (!(k in inst.def.inputs)) throw new Error(`recipe: node ${n.id} (${inst.def.id}) has no input "${k}"`);
  }
  const outs = {};
  const want = { image: 'raster', audio: 'audio', vector: 'vector', events: 'events' };
  for (const [name, ref] of Object.entries(recipe.out ?? {})) {
    const src = parseRef(ref, byId);
    outs[name] = want[name] ? insertChain(src, want[name], `out.${name}`) : src;
  }
  if (!Object.keys(outs).length) throw new Error('recipe: out must name at least one output');
  // topological order over the instances that the outputs need
  const seen = new Map();
  const visit = id => {
    const st = seen.get(id); if (st === 2) return; if (st === 1) throw new Error(`recipe: cycle through ${id}`);
    seen.set(id, 1); const inst = byId.get(id);
    for (const r of Object.values(inst.in)) visit(r.id);
    seen.set(id, 2); order.push(inst);
  };
  for (const o of Object.values(outs)) visit(o.id);
  return { order, outs, byId };
}

// evaluate: run a compiled plan. Returns { outputs: { name: value }, values: Map, timings: { id: ms } }.
export async function evaluate(recipe, registry, { check = true } = {}) {
  const plan = compile(recipe, registry);
  const [w, h] = recipe.size ?? [256, 256];
  const palette = { ...DEFAULT_PALETTE, ...(recipe.palette ?? {}) };
  const time = recipe.time ?? { t: 1, duration: 2, fps: 24 };
  const values = new Map(), timings = {};
  for (const inst of plan.order) {
    const inputs = {};
    for (const [port, r] of Object.entries(inst.in)) inputs[port] = values.get(r.id)[r.port];
    const s = nodeSeed(recipe.seed ?? 'superframe', inst.id);
    const t0 = performance.now();
    let out;
    try { out = await inst.def.render({ inputs, params: inst.params, w, h, palette, time, node: inst.def, id: inst.id, ...s }); }
    catch (e) { e.message = `node ${inst.id} (${inst.def.id}): ${e.message}`; throw e; }
    timings[inst.id] = +(performance.now() - t0).toFixed(1);
    for (const [port, type] of Object.entries(inst.def.outputs)) {
      if (!(port in out)) throw new Error(`node ${inst.id} (${inst.def.id}) returned no "${port}"`);
      if (check) { const err = checkValue(type, out[port]); if (err) throw new Error(`node ${inst.id} (${inst.def.id}) output ${port}: ${err}`); }
    }
    values.set(inst.id, out);
  }
  const outputs = {};
  for (const [name, r] of Object.entries(plan.outs)) outputs[name] = values.get(r.id)[r.port];
  return { outputs, values, timings, plan };
}

export function lanesOf(plan) { return [...new Set(plan.order.filter(i => !i.inserted).map(i => i.def.lane))]; }
export function domainsOf(plan) { return [...new Set(plan.order.flatMap(i => i.def.domains))]; }
export { TYPE_NAMES, DEFAULT_PALETTE };
