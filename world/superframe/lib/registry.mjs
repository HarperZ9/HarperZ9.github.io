// registry.mjs: every node the framework knows. Adding a technique = one adapter file exporting NODES, plus one
// line here. Converters register themselves so graph.mjs can insert them.
import { CONVERTERS } from './convert.mjs';
import { NODES as TYPE } from '../adapters/type.mjs';
import { NODES as MATTER } from '../adapters/matter.mjs';
import { NODES as IMAGE } from '../adapters/image.mjs';
import { NODES as PRINT } from '../adapters/print.mjs';
import { NODES as SOUND } from '../adapters/sound.mjs';
import { NODES as SITE } from '../adapters/site.mjs';
import { NODES as STUDIO } from '../adapters/studio.mjs';
import { NODES as CORE } from '../adapters/core.mjs';
import { NODES as INSTRUMENTS } from '../adapters/instruments.mjs';
import { NODES as OPTICS } from '../adapters/optics.mjs';
import { NODES as PLAYBOOK } from '../adapters/playbook.mjs';

export const ADAPTERS = { type: TYPE, matter: MATTER, image: IMAGE, print: PRINT, sound: SOUND, site: SITE, studio: STUDIO, core: CORE, instruments: INSTRUMENTS, optics: OPTICS, playbook: PLAYBOOK };

// The drop-in hook: any other adapters/*.mjs that exports NODES is registered too, so an agent adds a technique by
// writing one file (feed 28 and 29 gradient-field, painting-to-pixel and spot-colour ink nodes; glass v2).
// A file that fails to import stops the load with its path and its error. It used to be reported and skipped, and a
// skipped adapter with a syntax error let every test stay green (a false success, found by the living type agent,
// 2026-10-26); a broken adapter is now a failing run. tests/registry.test.mjs keeps that control.
import { readdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
export async function loadAdapters(dir, skip = new Set()) {
  const out = {}, failed = [];
  for (const f of readdirSync(dir).filter(f => f.endsWith('.mjs') && !skip.has(f)).sort()) {
    const path = join(dir, f);
    try { const m = await import(pathToFileURL(path).href); if (Array.isArray(m.NODES)) out[f.replace(/\.mjs$/, '')] = m.NODES; }
    catch (e) { failed.push(`${path}: ${e.name}: ${e.message}`); }
  }
  if (failed.length) throw new Error(`registry: ${failed.length} adapter(s) failed to import: ${failed.join(' | ')}`);
  return out;
}
const KNOWN = new Set(Object.keys(ADAPTERS).map(k => `${k}.mjs`));
Object.assign(ADAPTERS, await loadAdapters(fileURLToPath(new URL('../adapters/', import.meta.url)), KNOWN));
export const ALL = [...Object.values(ADAPTERS).flat(), ...CONVERTERS];

export const registry = new Map();
for (const n of ALL) {
  if (registry.has(n.id)) throw new Error(`registry: duplicate node id ${n.id}`);
  registry.set(n.id, n);
}
export const techniques = () => ALL.filter(n => n.kind !== 'convert');
