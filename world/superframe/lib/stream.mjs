// stream.mjs: a graph that keeps running. createStream(recipe) compiles once and holds every node's last output.
// set(nodeId, params) or feed(nodeId, value) marks that node dirty; tick() re-evaluates only the dirty nodes and
// everything downstream of them, so a live input (a slider, a microphone frame, an agent's edit) flows through
// without re-running the parts of the graph it does not touch. Same seed rule as evaluate(): a node's randomness
// depends only on the recipe seed and its id, so a re-run node gives the same output for the same inputs.
import { compile } from './graph.mjs';
import { resolveParams } from './node.mjs';
import { nodeSeed } from './seed.mjs';
import { checkValue } from './types.mjs';

export function createStream(recipe, registry, { onOutput = null } = {}) {
  const plan = compile(recipe, registry), values = new Map(), dirty = new Set(plan.order.map(i => i.id)), fed = new Map();
  const [w, h] = recipe.size ?? [256, 256];
  const palette = { ground: '#ebe5d8', ink: '#15130f', accent: '#c4632b', ...(recipe.palette ?? {}) };
  let time = recipe.time ?? { t: 0, duration: 4, fps: 24 }, frame = 0;
  const down = new Map();
  for (const inst of plan.order) for (const r of Object.values(inst.in)) { if (!down.has(r.id)) down.set(r.id, []); down.get(r.id).push(inst.id); }
  const markFrom = id => { const st = [id]; while (st.length) { const x = st.pop(); if (dirty.has(x) && x !== id) continue; dirty.add(x); for (const y of down.get(x) ?? []) st.push(y); } };
  const timeNodes = plan.order.filter(i => Object.values(i.def.inputs).some(s => s.type === 'time') || i.def.id === 'time.clock').map(i => i.id);

  async function tick() {
    const ran = [];
    for (const inst of plan.order) {
      if (!dirty.has(inst.id)) continue;
      let out;
      if (fed.has(inst.id)) out = fed.get(inst.id);
      else {
        const inputs = {};
        for (const [port, r] of Object.entries(inst.in)) inputs[port] = values.get(r.id)[r.port];
        out = await inst.def.render({ inputs, params: inst.params, w, h, palette, time, node: inst.def, id: inst.id, ...nodeSeed(recipe.seed ?? 'superframe', inst.id) });
        for (const [port, type] of Object.entries(inst.def.outputs)) { const e = checkValue(type, out[port]); if (e) throw new Error(`stream ${inst.id}: ${e}`); }
      }
      values.set(inst.id, out); ran.push(inst.id);
    }
    dirty.clear(); frame++;
    const outputs = Object.fromEntries(Object.entries(plan.outs).map(([k, r]) => [k, values.get(r.id)[r.port]]));
    if (onOutput) await onOutput(outputs, { frame, ran });
    return { outputs, ran };
  }
  return {
    plan, tick,
    set(id, params) { const inst = plan.byId.get(id); if (!inst) throw new Error(`stream: no node ${id}`); inst.params = resolveParams(inst.def, { ...inst.params, ...params }); markFrom(id); },
    feed(id, value) { if (!plan.byId.has(id)) throw new Error(`stream: no node ${id}`); fed.set(id, value); markFrom(id); },
    advance(dt) { time = { ...time, t: time.t + dt }; for (const id of timeNodes) markFrom(id); },
    get frame() { return frame; },
  };
}
