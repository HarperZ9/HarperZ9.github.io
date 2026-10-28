// lib/legacy.mjs: the old Studio's Type forge saves, opened in the type engine.
//
// The site Studio (HarperZ9.github.io origin/main 3ca6529) keeps the Type forge source three ways:
//   studio.v1.type          a kept session, { schema: 'studio.session/1', source: 'type', savedAt, state }
//   studio.presets.v1.type  named presets, [{ name, savedAt, state }]
//   a project file          { schema: 'studio.project/1', savedAt, active, sessions: { type: state, ... } }
// state is the forge desk: { text, weight, contrast, width, x_height, roundness, aperture, style }, values as the
// form gave them (strings or numbers). The engine reads all three onto a family whose skeleton source is the same
// Zain Mint forge with the same parameters, so the face is the one that was saved, and writes the state back.
import { readProject as siteReadProject, PROJECT_SCHEMA } from '../upstream/site-3ca6529/system/studio-project.js';
import { PRESET_PREFIX } from '../upstream/site-3ca6529/system/studio-presets.js';
import { KEEP_SCHEMA, KEEP_PREFIX } from '../upstream/site-3ca6529/system/studio-store.js';
import { FAMILY_SCHEMA, instance } from './program.mjs';

export const LEGACY_SOURCE = 'type';
export const LEGACY_KEYS = Object.freeze(['weight', 'contrast', 'width', 'x_height', 'roundness', 'aperture']);
export const SESSION_SCHEMA = 'typeengine.session/1';
// The old desk's six sliders (type-forge.html), as family axes on the Zain Mint skeleton, and its four named weights.
export const LEGACY_AXES = Object.freeze([
  { tag: 'STEM', name: 'Weight', key: 'weight', min: 0.04, max: 0.2, default: 0.085 }, { tag: 'CNTR', name: 'Contrast', key: 'contrast', min: 0.3, max: 1, default: 0.82 },
  { tag: 'WIDE', name: 'Width', key: 'width', min: 0.7, max: 1.4, default: 1 }, { tag: 'XHGT', name: 'X-height', key: 'x_height', min: 0.4, max: 0.6, default: 0.5 },
  { tag: 'ROND', name: 'Roundness', key: 'roundness', min: 2, max: 4, default: 2.4 }, { tag: 'APER', name: 'Aperture', key: 'aperture', min: 0, max: 1, default: 0.6 }]);
export const LEGACY_WEIGHTS = Object.freeze({ Light: 0.058, Regular: 0.085, Medium: 0.112, Bold: 0.145 });
export { PROJECT_SCHEMA, KEEP_SCHEMA };
export const KEEP_KEY = KEEP_PREFIX + LEGACY_SOURCE, PRESET_KEY = PRESET_PREFIX + LEGACY_SOURCE;

/** A Type forge desk state -> { family, text }. Unknown keys are ignored, as the old desk ignored them. */
export function fromLegacyState(state, name = 'Zain Mint') {
  if (!state || typeof state !== 'object') throw new Error('legacy: state must be an object');
  const params = {};
  for (const k of LEGACY_KEYS) if (state[k] !== undefined && state[k] !== '' && Number.isFinite(+state[k])) params[k] = +state[k];
  if (state.style) params.style = String(state.style);
  const id = 'zain-mint-' + LEGACY_KEYS.map((k) => (params[k] ?? 'd')).join('-').replace(/\./g, 'p');
  return {
    text: typeof state.text === 'string' ? state.text : '',
    family: { schema: FAMILY_SCHEMA, id: id.toLowerCase().replace(/[^a-z0-9-]/g, ''), name, ground: '#ebe5d8',
      skeleton: { source: 'zain-mint', params: { ...Object.fromEntries(LEGACY_AXES.map((a) => [a.key, a.default])), ...params } },
      axes: LEGACY_AXES.map((a) => ({ tag: a.tag, name: a.name, min: a.min, max: a.max, default: Math.max(a.min, Math.min(a.max, params[a.key] ?? a.default)), target: `skeleton.params.${a.key}` })), bindings: { fill: { material: 'ink', params: { color: '#15130f' } } },
      recipe: { from: 'studio.session/1 type', legacy: { ...state } } },
  };
}

/** Back to the desk state, so a family on a Zain Mint skeleton can be saved where the old Studio reads it. */
export function toLegacyState(family, text = '', loc = {}) {
  if (family?.skeleton?.source !== 'zain-mint') return null;
  const p = instance(family, loc).skeleton.params ?? {}, out = { text };
  for (const k of LEGACY_KEYS) if (p[k] !== undefined) out[k] = p[k];
  out.style = p.style ?? '';
  return out;
}

/** The raw value of localStorage['studio.v1.type'] -> { ok, family, text } or { ok: false, reason }. */
export function readKeptSession(raw) {
  let doc; try { doc = JSON.parse(raw); } catch { return { ok: false, reason: 'not JSON' }; }
  if (doc?.schema !== KEEP_SCHEMA || doc.source !== LEGACY_SOURCE || !doc.state) return { ok: false, reason: `not a ${KEEP_SCHEMA} Type forge session` };
  return { ok: true, savedAt: doc.savedAt ?? null, ...fromLegacyState(doc.state) };
}

/** The raw value of localStorage['studio.presets.v1.type'] -> [{ name, savedAt, family, text }]. Bad entries are skipped. */
export function readPresets(raw) {
  let list; try { list = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(list)) return [];
  return list.filter((p) => p && typeof p.name === 'string' && p.state && typeof p.state === 'object')
    .map((p) => ({ name: p.name, savedAt: p.savedAt ?? null, ...fromLegacyState(p.state, `Zain Mint ${p.name}`) }));
}

/** A Studio project file's text -> { ok, family, text, skipped } using the site's own reader. */
export function readProjectFile(text) {
  const r = siteReadProject(text, [LEGACY_SOURCE]);
  if (!r.ok) return r;
  if (!r.known.includes(LEGACY_SOURCE)) return { ok: false, reason: 'the project keeps no Type forge session', skipped: r.skipped };
  return { ok: true, skipped: r.skipped, ...fromLegacyState(r.doc.sessions[LEGACY_SOURCE]) };
}

/** Read anything a visitor drops on the room: an engine session, a family, a project, a kept session or a preset list. */
export function openAny(text) {
  let doc; try { doc = JSON.parse(text); } catch { return { ok: false, reason: 'not JSON' }; }
  if (doc?.schema === SESSION_SCHEMA) return { ok: true, kind: 'session', family: doc.family, text: doc.text ?? '', loc: doc.loc ?? {} };
  if (doc?.schema === FAMILY_SCHEMA) return { ok: true, kind: 'family', family: doc, text: '' };
  if (doc?.schema === PROJECT_SCHEMA) return { kind: 'project', ...readProjectFile(text) };
  if (doc?.schema === KEEP_SCHEMA) return { kind: 'kept', ...readKeptSession(text) };
  if (Array.isArray(doc)) { const p = readPresets(text); return p.length ? { ok: true, kind: 'presets', presets: p, ...p[0] } : { ok: false, reason: 'no readable presets' }; }
  return { ok: false, reason: 'not a type engine, Studio project, session or preset file' };
}

export const session = (family, text, loc = {}) => ({ schema: SESSION_SCHEMA, family, text, loc });
