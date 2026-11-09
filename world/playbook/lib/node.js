// lib/node.js: the thin node adapter every build exports.
// The interim shape the brief set while superframe/ did not exist: { id, ports, params, seed, render(ctx) }.
// params: { name: { range: [min, max], unit, default } } (QUALITY-SPEC S2); ports: { in: {name: medium}, out: {name: medium} }.
// Superframe landed on 2026-10-24. The thin adapter that maps these builds onto its node interface (typed ports,
// linear rasters, seeded rng) is superframe/adapters/playbook.mjs; it calls each build's CPU path directly.
export const MEDIA = Object.freeze(['image', 'points', 'text', 'events', 'clock', 'scene', 'audio', 'data']);

export function defineNode({ id, ports = { in: {}, out: {} }, params = {}, seed = 1, render }) {
  for (const [k, p] of Object.entries(params)) {
    if (!Array.isArray(p.range) || p.range.length !== 2 || !p.unit) throw new Error(`${id}: param ${k} needs range [min, max] and unit`);
    if (typeof p.default === 'number' && (p.default < p.range[0] || p.default > p.range[1])) throw new Error(`${id}: param ${k} default out of range`);
  }
  for (const side of ['in', 'out']) for (const [k, m] of Object.entries(ports[side] || {})) if (!MEDIA.includes(m)) throw new Error(`${id}: port ${side}.${k} medium ${m} unknown`);
  const defaults = Object.fromEntries(Object.entries(params).map(([k, p]) => [k, p.default]));
  return Object.freeze({ id, ports, params, seed, defaults, render: (ctx) => render({ seed, ...ctx, params: { ...defaults, ...(ctx.params || {}) } }) });
}
