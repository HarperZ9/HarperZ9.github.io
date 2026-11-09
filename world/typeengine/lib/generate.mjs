// lib/generate.mjs: mint a family from a brief. A brief names the materials allowed in each slot, the skeleton
// space, parameter ranges, the inputs (a data series, a sound) and a reference palette taken from a decompose
// descriptor (numbers only). The explorer draws seeded candidates, renders each, scores legibility, contrast and
// novelty, and keeps the best with its full recipe, so any kept family re-renders exactly.
//
// typeengine.brief/1:
//   { id, name, seed, n, keep, slots: { fill: ['glass'], edge: ['glow', null], ... },
//     skeleton: { style: [...], weight: [lo, hi], cut: [...], extra: { n: [lo, hi], wd: [...], C: [...] } },
//     params: { <material>: { <param>: [lo, hi] | [option, ...] } }, ground: [hex...], inputs, reference, axes }
import { rngFrom } from '../../superframe/lib/seed.mjs';
import { MATERIALS } from './materials.mjs';
import { FAMILY_SCHEMA, validateFamily, getPath } from './program.mjs';
import { renderWord } from './render.mjs';
import { legibility, contrast, descriptor, distance } from './score.mjs';

export const BRIEF_SCHEMA = 'typeengine.brief/1';
export const WEIGHTS = Object.freeze({ legibility: 0.55, contrast: 0.15, novelty: 0.3 });
export const KEEP_FLOOR = Object.freeze({ accuracy: 0.9, contrast: 3 });

const pick = (r, a) => a[Math.floor(r() * a.length) % a.length];
const range = (r, [lo, hi], int = false) => { const v = lo + (hi - lo) * r(); return int ? Math.round(v) : Math.round(v * 1000) / 1000; };
const isRange = (v) => Array.isArray(v) && v.length === 2 && v.every((x) => typeof x === 'number');

function sampleParams(r, m, ranges = {}) {
  const out = {};
  for (const [k, spec] of Object.entries(ranges)) {
    if (!(k in m.params)) throw new Error(`brief: ${m.id} has no parameter ${k}`);
    out[k] = isRange(spec) ? range(r, spec, Number.isInteger(m.params[k].default) && Number.isInteger(spec[0])) : pick(r, spec);
  }
  return out;
}

/** One seeded candidate family from a brief. */
export function candidate(brief, i) {
  const r = rngFrom(`${brief.id}/${brief.seed ?? 1}/${i}`), sk = brief.skeleton ?? {}, extra = {};
  for (const [k, v] of Object.entries(sk.extra ?? {})) extra[k] = isRange(v) ? range(r, v) : pick(r, v);
  const skeleton = { source: 'accession', style: pick(r, sk.style ?? ['display']), weight: range(r, sk.weight ?? [600, 800], true), cut: pick(r, sk.cut ?? [null]), extra };
  const bindings = {};
  for (const [slot, opts] of Object.entries(brief.slots)) {
    const id = pick(r, opts); if (!id) continue;
    bindings[slot] = { material: id, params: sampleParams(r, MATERIALS.get(id), brief.params?.[id]) };
    const feed = {};
    for (const [prop, opts] of Object.entries(brief.feeds?.[id] ?? {})) {
      const f = pick(r, opts); if (!f) continue;
      feed[prop] = typeof f === 'string' ? f : { material: f.material, params: sampleParams(r, MATERIALS.get(f.material), f.params) };
    }
    if (Object.keys(feed).length) bindings[slot].feed = feed;
  }
  if (bindings.sound) bindings.sound.from = brief.soundFrom ?? 'letter';
  const f = { schema: FAMILY_SCHEMA, id: `${brief.id}-${i}`, name: `${brief.name} ${i}`, ground: pick(r, brief.ground ?? ['#ebe5d8']), skeleton, bindings,
    regions: brief.regions ?? undefined, inputs: brief.inputs ?? undefined, axes: brief.axes ?? undefined,
    recipe: { brief: brief.id, seed: brief.seed ?? 1, index: i, seedRule: 'xmur3-mulberry32/1' } };
  if (!f.regions) delete f.regions; if (!f.inputs) delete f.inputs; if (!f.axes) delete f.axes;
  // An axis default of '@path' takes the candidate's own value, so the drawn point is the family's default.
  if (f.axes) f.axes = f.axes.map((a) => { const d = typeof a.default === 'string' && a.default.startsWith('@') ? getPath(f, a.default.slice(1)) : a.default; return { ...a, default: d, min: Math.min(a.min, d), max: Math.max(a.max, d) }; });
  const e = validateFamily(f); if (e.length) throw new Error(`candidate ${i}: ${e.join('; ')}`);
  return f;
}

/** Score one family. baseline: the descriptor novelty is measured from (Accession in plain ink); kept: others so far. */
export function scoreFamily(f, { baseline, kept = [], word = 'Accession' } = {}) {
  const L = legibility(f), R = renderWord(f, word, 480, 160, {}), G = renderWord(f, ' ', 480, 160, {}), C = contrast(R.raster, G.raster), D = descriptor(R.raster);
  const nov = Math.min(1, distance(D, baseline) / 1.2) * 0.6 + Math.min(1, kept.length ? Math.min(...kept.map((k) => distance(D, k))) / 0.8 : 1) * 0.4;
  const leg = 0.5 * L.accuracy + 0.5 * Math.max(0, Math.min(1, L.margin / 0.33));
  const total = WEIGHTS.legibility * leg + WEIGHTS.contrast * Math.min(1, C / 4.5) + WEIGHTS.novelty * nov;
  return { total: +total.toFixed(4), legibility: L, contrast: C, novelty: +nov.toFixed(3), descriptor: D.map((v) => +v.toFixed(4)), pass: L.accuracy >= KEEP_FLOOR.accuracy && C >= KEEP_FLOOR.contrast };
}

let base = null;
export function baselineDescriptor() {
  if (base) return base;
  const f = { schema: FAMILY_SCHEMA, id: 'baseline', name: 'Accession', skeleton: { source: 'accession', style: 'display', weight: 700 }, bindings: { fill: { material: 'ink' } } };
  return (base = descriptor(renderWord(f, 'Accession', 480, 160, {}).raster));
}

/** Run a brief: n candidates, scored; returns all scores and the kept families (passing the floor, best first). */
export function explore(brief, { onCandidate } = {}) {
  const baseline = baselineDescriptor(), results = [], keptD = [];
  for (let i = 0; i < (brief.n ?? 12); i++) {
    const f = candidate(brief, i), t0 = Date.now();
    let s; try { s = scoreFamily(f, { baseline, kept: keptD }); } catch (e) { console.error(`[generate] ${f.id} failed:`, e.message); results.push({ family: f, error: e.message }); continue; }
    if (s.pass) keptD.push(s.descriptor);
    const row = { family: f, score: s, ms: Date.now() - t0 }; results.push(row); onCandidate?.(row);
  }
  const kept = results.filter((x) => x.score?.pass).sort((a, b) => b.score.total - a.score.total).slice(0, brief.keep ?? 3);
  return { brief: brief.id, weights: WEIGHTS, floor: KEEP_FLOOR, results, kept };
}
