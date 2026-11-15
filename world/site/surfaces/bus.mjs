// bus.mjs: how one module hands a value to another.
//
// Every value travels in the same envelope:
//
//   { medium, refs, value, from: { module, surface, form, at, recipe } }
//
//   medium   what the value is, from the registry's MEDIA ('palette', 'blend', 'image', ...)
//   refs     the named things the value is about: ids from the shipped tables (an element id such as 'ink'), or
//            ids of values made earlier in this tab, which read session.<hash>
//   value    the value itself; anything the two modules agree on for that medium
//   from     who made it: the module's id, the surface (page) it is mounted on, the form the module takes there
//            (live, replay or captured), when it was made (an ISO time), and the recipe: the inputs that give the
//            same value again
//
//   const bus = createBus();                                   one bus per page
//   bus.join('plot', (env) => plot.update(...));               a module listens; it only ever hears a medium it takes
//   bus.send('blend', 'palette', value, { refs: ['ink'] });    a module gives; the envelope is built, checked, sent
//
// A module can only send a medium its registry row gives, and only hears a medium its row takes. A malformed
// envelope is refused with the reason, and nobody hears it.
//
// Values made in the page are derived. Each gets the id session.<hash>, a hash of its medium, value and recipe, so
// the same value has the same id in every tab. Derived values live in the bus for as long as the page is open.
// They never enter the shipped tables: SHIPPED ids and session ids cannot be confused, because no shipped id may
// start with "session.", and tests/test_demo_labels.py-style checks in bus.test.mjs read the shipped tables to
// hold that line.
import registry from './registry.mjs';
import { sessionHash } from './bus-kernel.mjs';

export const SESSION = 'session.';
export const isSessionId = (id) => typeof id === 'string' && /^session\.[0-9a-f]{16}$/.test(id);
const FROM_KEYS = ['module', 'surface', 'form', 'at', 'recipe'], KEYS = ['medium', 'refs', 'value', 'from'];
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

// Canonical text of a value: JSON with every object's keys in order, so the same value gives the same bytes.
// A value that JSON cannot carry (a canvas, a function) is named by its kind; two such values differ by recipe.
export function canonical(v) {
  if (v === null || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return JSON.stringify(v) ?? 'null';
  if (typeof v === 'undefined') return 'null';
  if (Array.isArray(v) || ArrayBuffer.isView(v)) return `[${Array.from(v, canonical).join(',')}]`;
  if (typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null))
    return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  return JSON.stringify(`<${typeof v === 'function' ? 'function' : v.constructor?.name || 'object'}>`);
}
// The id of a derived value: the same medium, value and recipe give the same id.
export const sessionId = (medium, value, recipe) => SESSION + sessionHash(new TextEncoder().encode(canonical({ medium, recipe: recipe ?? null, value })));

// Why an envelope is malformed, or null when it is well formed. Pure: it reads the registry's vocabulary and rows.
export function refusal(env, reg = registry) {
  if (!env || typeof env !== 'object' || Array.isArray(env)) return 'an envelope is an object';
  const extra = Object.keys(env).filter((k) => !KEYS.includes(k));
  if (extra.length) return `an envelope has no field named ${extra.join(', ')}`;
  for (const k of KEYS) if (!(k in env)) return `the envelope lacks ${k}`;
  if (!reg.MEDIA.includes(env.medium)) return `"${env.medium}" is not a medium in the registry`;
  if (!Array.isArray(env.refs) || env.refs.some((r) => typeof r !== 'string' || !r)) return 'refs is a list of ids';
  const bad = env.refs.find((r) => r.startsWith(SESSION) && !isSessionId(r));
  if (bad) return `"${bad}" is not a session id`;
  if (env.value === undefined) return 'the envelope has no value';
  const f = env.from;
  if (!f || typeof f !== 'object') return 'from says who made the value';
  for (const k of FROM_KEYS) if (!(k in f)) return `from lacks ${k}`;
  const row = reg.SURFACES[f.module];
  if (!row) return `no module named "${f.module}" in the registry`;
  if (!row.load) return `"${f.module}" has nothing behind it and cannot give a value`;
  if (!row.gives.includes(env.medium)) return `"${f.module}" does not give ${env.medium}`;
  if (!reg.HOMES.includes(f.surface)) return `"${f.surface}" is not one of the surfaces`;
  if (!reg.FORMS.includes(f.form)) return `"${f.form}" is not a form; the forms are ${reg.FORMS.join(', ')}`;
  if (f.form !== row.form) return `"${f.module}" is ${row.form} in the registry, the envelope says ${f.form}`;
  if (typeof f.at !== 'string' || !ISO.test(f.at)) return 'from.at is an ISO time';
  if (f.recipe === undefined) return 'from.recipe is the inputs that give the value again, or null';
  return null;
}
// Whether a module takes what an envelope carries.
export const accepts = (moduleId, env, reg = registry) => !!reg.SURFACES[moduleId]?.takes.includes(env?.medium);

export function createBus({ reg = registry, surface = 'playground', now = () => new Date().toISOString() } = {}) {
  const listeners = new Map(), derived = new Map(), log = [];
  const bus = {
    // A module starts listening. It hears every envelope whose medium its row takes, except its own.
    join(moduleId, fn) {
      if (!reg.SURFACES[moduleId]) throw new Error(`bus: no module named "${moduleId}" in the registry`);
      const set = listeners.get(moduleId) ?? listeners.set(moduleId, new Set()).get(moduleId);
      set.add(fn);
      return () => set.delete(fn);
    },
    // Deliver a finished envelope. Returns { ok, id, heard } or { ok: false, why }; a refused envelope reaches nobody.
    deliver(env) {
      const why = refusal(env, reg);
      if (why) { log.push({ ok: false, why }); return { ok: false, why }; }
      const unknown = env.refs.find((r) => r.startsWith(SESSION) && !derived.has(r));
      if (unknown) { const w = `"${unknown}" was not made in this tab`; log.push({ ok: false, why: w }); return { ok: false, why: w }; }
      const id = sessionId(env.medium, env.value, env.from.recipe), sealed = Object.freeze({ ...env, refs: Object.freeze([...env.refs]), from: Object.freeze({ ...env.from }) });
      derived.set(id, sealed);
      const heard = [];
      for (const [moduleId, set] of listeners) {
        if (moduleId === env.from.module || !accepts(moduleId, sealed, reg)) continue;
        for (const fn of set) fn(sealed, id);
        heard.push(moduleId);
      }
      log.push({ ok: true, id, medium: env.medium, from: env.from.module, heard });
      return { ok: true, id, heard };
    },
    // Build the envelope for a module's value and deliver it.
    send(moduleId, medium, value, { refs = [], recipe = null } = {}) {
      const row = reg.SURFACES[moduleId];
      return bus.deliver({ medium, refs, value, from: { module: moduleId, surface, form: row?.form ?? null, at: now(), recipe } });
    },
    // A value made earlier in this tab, by its session id; undefined for anything else, a shipped id included.
    derived: (id) => derived.get(id),
    ids: () => [...derived.keys()],
    log: () => log.slice(),
    clear() { listeners.clear(); derived.clear(); log.length = 0; },
  };
  return bus;
}

// The line between shipped and derived, for any table that ships: none of its ids may read as a session id.
export function sessionIdsIn(table) {
  const found = [];
  (function walk(v) {
    if (typeof v === 'string') { if (v.startsWith(SESSION)) found.push(v); return; }
    if (Array.isArray(v)) { v.forEach(walk); return; }
    if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (k.startsWith(SESSION)) found.push(k); walk(x); }
  })(table);
  return found;
}
