// lib/materials.mjs: every material the engine knows, by id. Adding one = a defineMaterial in a materials file plus
// nothing else; the registry, the room's swatches, the font planner and the tests read this list.
import { CORE } from './materials-core.mjs';
import { MEDIA } from './materials-media.mjs';

export const MATERIALS = new Map();
for (const m of [...CORE, ...MEDIA]) {
  if (MATERIALS.has(m.id)) throw new Error(`materials: duplicate id ${m.id}`);
  MATERIALS.set(m.id, m);
}
export const material = (id) => { const m = MATERIALS.get(id); if (!m) throw new Error(`materials: unknown material "${id}" (one of ${[...MATERIALS.keys()].join(', ')})`); return m; };

/** Who provides and who consumes each property: the matrix the room and the docs draw. */
export function matrix() {
  const out = {};
  for (const m of MATERIALS.values()) {
    for (const p of m.provides) (out[p] ??= { providers: [], consumers: [] }).providers.push(m.id);
    for (const c of m.consumes) (out[c.prop] ??= { providers: [], consumers: [] }).consumers.push(m.id);
  }
  return out;
}
