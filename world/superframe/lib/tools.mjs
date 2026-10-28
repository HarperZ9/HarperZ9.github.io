// tools.mjs: the agent surface. Each tool has a JSON schema and a handler; the CLI (superframe call), the MCP stdio
// server (tools/mcp.mjs) and the studio all reach the same handlers, so a person and an agent drive identical nodes.
// Outputs are files plus a JSON summary; receipts (seed, timings, dual-edge result) stay in the data, not on a page.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { registry, techniques } from './registry.mjs';
import { evaluate, compile, lanesOf, domainsOf, conversionPath } from './graph.mjs';
import { dualEdge } from './dualedge.mjs';
import { exportAll, exportRecipients } from './export.mjs';
import { forRecipient, RECIPIENTS } from './recipient.mjs';
import { soloRecipe } from './autofeed.mjs';

const nodeInfo = n => ({ id: n.id, title: n.title, lane: n.lane, domains: n.domains, source: n.source, doc: n.doc, inputs: n.inputs, outputs: n.outputs, params: n.params, runtime: n.runtime, edge: n.edge });

export const TOOLS = [
  { name: 'superframe_list', description: 'List every node with its lane and typed ports.', inputSchema: { type: 'object', properties: { lane: { type: 'string' } } } },
  { name: 'superframe_show', description: 'One node: ports, parameters with ranges and units, source module, dual-edge marking.', inputSchema: { type: 'object', properties: { node: { type: 'string' } }, required: ['node'] } },
  { name: 'superframe_compile', description: 'Check a recipe without running it: the node order with inserted converters, lanes, fields crossed, and the dual-edge result.', inputSchema: { type: 'object', properties: { recipe: { type: 'object' } }, required: ['recipe'] } },
  { name: 'superframe_render', description: 'Evaluate a recipe (superframe.recipe/1) and write every output to files under outBase.', inputSchema: { type: 'object', properties: { recipe: { type: 'object' }, outBase: { type: 'string' } }, required: ['recipe', 'outBase'] } },
  { name: 'superframe_perceive', description: 'Render a recipe for one recipient (eye, ear, reader, screenreader, agent) and report whether the result is perceptible to it. Text and JSON come back inline; pictures and sound go to outBase.', inputSchema: { type: 'object', properties: { recipe: { type: 'object' }, recipient: { enum: Object.keys(RECIPIENTS) }, outBase: { type: 'string' } }, required: ['recipe', 'recipient'] } },
  { name: 'superframe_try', description: 'Run one node alone with default inputs and write its outputs.', inputSchema: { type: 'object', properties: { node: { type: 'string' }, outBase: { type: 'string' }, size: { type: 'integer' }, params: { type: 'object' } }, required: ['node', 'outBase'] } },
  { name: 'superframe_convert_path', description: 'The converter chain the graph inserts between two port types.', inputSchema: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' } }, required: ['from', 'to'] } },
  { name: 'superframe_channels', description: 'Saved channels: named recipes the explorer found, with quality, novelty and lanes.', inputSchema: { type: 'object', properties: {} } },
  { name: 'superframe_explore', description: 'Run the explorer: sample n recipes, render, score, gate, rank; returns the run folder and best picks.', inputSchema: { type: 'object', properties: { n: { type: 'integer' }, seed: { type: 'string' } } } },
  { name: 'superframe_verdict', description: 'Keep or kill an explorer item; kept items steer later sampling and join the novelty archive.', inputSchema: { type: 'object', properties: { run: { type: 'string' }, id: { type: 'string' }, verdict: { enum: ['keep', 'kill', 'none'] } }, required: ['run', 'id', 'verdict'] } },
];

export async function callTool(name, a = {}) {
  switch (name) {
    case 'superframe_list': return techniques().filter(n => !a.lane || n.lane === a.lane).map(n => ({ id: n.id, lane: n.lane, inputs: Object.fromEntries(Object.entries(n.inputs).map(([k, s]) => [k, s.type + (s.optional ? '?' : '')])), outputs: n.outputs }));
    case 'superframe_show': { const n = registry.get(a.node); if (!n) throw new Error(`no node ${a.node}`); return nodeInfo(n); }
    case 'superframe_compile': { const p = compile(a.recipe, registry); return { order: p.order.map(i => ({ id: i.id, node: i.def.id, inserted: !!i.inserted, params: i.params })), lanes: lanesOf(p), domains: domainsOf(p), dualEdge: dualEdge(p) }; }
    case 'superframe_render': { const p = compile(a.recipe, registry), de = dualEdge(p); if (!de.pass) return { refused: de.problems }; const e = await evaluate(a.recipe, registry); return { files: [...await exportAll(a.outBase, e.outputs, { seed: a.recipe.seed, palette: a.recipe.palette ?? {} }), ...await exportRecipients(a.outBase, e, a.recipe)], timings: e.timings }; }
    case 'superframe_perceive': {
      const e = await evaluate(a.recipe, registry), r = await forRecipient(a.recipient, e, a.recipe);
      if (a.recipient === 'eye' || a.recipient === 'ear') return { check: r.check, files: a.outBase ? await exportRecipients(a.outBase, e, { ...a.recipe, for: [a.recipient] }) : [] };
      return { check: r.check, value: r.value };
    }
    case 'superframe_try': { const def = registry.get(a.node); if (!def) throw new Error(`no node ${a.node}`); const s = a.size ?? 256, r = soloRecipe(def, { size: [s, s], params: a.params ?? {} }); const e = await evaluate(r, registry); return { recipe: r, files: await exportAll(a.outBase, e.outputs, { seed: r.seed }) }; }
    case 'superframe_convert_path': { const p = conversionPath(a.from, a.to); return p ? p.map(c => c.id) : null; }
    case 'superframe_channels': { const d = new URL('../channels/', import.meta.url); return existsSync(d) ? readdirSync(d).map(f => JSON.parse(readFileSync(new URL(f, d), 'utf8'))).map(({ name, lanes, domains, quality, novelty }) => ({ name, lanes, domains, quality, novelty })) : []; }
    case 'superframe_explore': { const { runExplore } = await import('../explore/explore.mjs'); const { out, ranked } = await runExplore({ n: a.n ?? 40, seed: a.seed ?? `agent-${Date.now()}`, log: () => {} }); return { out, best: ranked.map(r => ({ id: r.id, channel: r.channel, quality: r.quality, novelty: r.novelty })) }; }
    case 'superframe_verdict': { const { verdict } = await import('../explore/explore.mjs'); verdict(a.run, a.id, a.verdict); return { ok: true }; }
    default: throw new Error(`unknown tool ${name}`);
  }
}
