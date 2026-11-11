// elements-data.mjs: the numbers behind the bench. Pure: no page, no drawing, runs in node and the browser.
//
//   const ix = indexElements(data);        // elements by id, sheets, and every property's spread over the table
//   ix.spread.get('marks/ink coverage')    // { min, q1, median, q3, max, count, log, members: [{ id, value, iqr, n }] }
//   orderCells(ix, 'material')             // the cells of one sheet, in the order the table shows them
//   driveFor(ix, element, settings)        // the twelve numbers the well draws an element from
//   blendTable(ix, ids, weights)           // parts side by side, the computed mix, the measured links
//   materialFor(ix, element, settings)     // the element as a studio material (world/studio/lib/schema.mjs)
//
// A value read from a study is "measured". A value this file works out from measured parts is "computed", and
// every place that shows one says so.
import { byId as studioMaterial, CODE_MATERIAL } from '../../studio/lib/materials.mjs';

export const GROUND_RANK = { grounded: 0, partial: 1, thought: 2 };
export const GROUND_WORD = {
  grounded: 'grounded: at least one of its laws has a measured weight',
  partial: 'partial: properties are measured, no law weight yet',
  thought: 'thought: nothing measured yet',
};

// The properties the well can be driven by: the control's name in plain words, what the number is, and what
// moving it does to the picture. Every other property is charted and compared, and drives nothing.
export const DRIVES = Object.freeze({
  wavelength: { prop: 'spatial/dominant wavelength', label: 'Wave length', what: 'the spacing of the strongest repeating wave, as a share of the frame', does: 'sets the spacing of the wave' },
  orientation: { prop: 'spatial/wave orientation', label: 'Wave angle', what: 'the angle of that wave in degrees', does: 'turns the wave' },
  peak: { prop: 'spatial/peak strength', label: 'Wave strength', what: 'how far the strongest wave stands above the rest of the spectrum', does: 'makes the wave stronger or fainter' },
  beta: { prop: 'spatial/spectral slope beta', label: 'Roughness slope', what: 'how fast fine detail falls away; a higher slope is smoother', does: 'adds or removes fine detail' },
  softness: { prop: 'spatial/edge softness', label: 'Edge softness', what: 'how gradual the edges of marks are', does: 'softens or sharpens every edge' },
  coverage: { prop: 'marks/ink coverage', label: 'Ink coverage', what: 'the share of the frame covered by marks', does: 'covers more or less of the well' },
  density: { prop: 'marks/edge density', label: 'Edge density', what: 'the share of the frame that is an edge', does: 'makes the marks finer or broader' },
  saturation: { prop: 'colour/mean saturation', label: 'Saturation', what: 'mean colour saturation, from 0 (grey) to 1', does: 'strengthens or greys the colour' },
  rows: { prop: 'layout/dark-mark rows', label: 'Rows', what: 'the number of dark rows across the frame', does: 'lays the marks in that many rows' },
  speed: { prop: 'flow/mean speed', label: 'Flow speed', what: 'mean speed of motion between film frames', does: 'sets how fast the water drifts' },
  curl: { prop: 'flow/mean |curl|', label: 'Turning', what: 'how much the motion turns on itself', does: 'sets how much the water turns' },
  coherence: { prop: 'flow/direction coherence', label: 'One direction', what: 'how much of the motion runs the same way', does: 'sets how much of the drift runs one way' },
});
const LOG = new Set(['spatial/dominant wavelength', 'spatial/peak strength', 'spatial/edge softness', 'marks/edge density', 'flow/mean speed', 'flow/mean |curl|', 'flow/mean |div|', 'layout/row pitch']);

export const quantile = (sorted, q) => {
  if (!sorted.length) return null;
  const p = (sorted.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (p - lo);
};
export const fmt = (v) => (v == null ? '' : v === 0 ? '0' : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : String(+v.toPrecision(2)));

export function indexElements(data) {
  const byId = new Map(data.elements.map((e) => [e.id, e]));
  const sheets = [...data.sheets].sort((a, b) => a.order - b.order);
  const spread = new Map();
  for (const e of data.elements) for (const p of e.properties || []) {
    if (!spread.has(p.name)) spread.set(p.name, { name: p.name, instrument: p.instrument, log: LOG.has(p.name), members: [] });
    spread.get(p.name).members.push({ id: e.id, sheet: e.sheet, value: p.value, iqr: p.iqr || null, n: p.n ?? null });
  }
  for (const s of spread.values()) {
    s.members.sort((a, b) => a.value - b.value);
    const v = s.members.map((m) => m.value);
    Object.assign(s, { count: v.length, min: v[0], max: v[v.length - 1], q1: quantile(v, 0.25), median: quantile(v, 0.5), q3: quantile(v, 0.75) });
    // the axis holds every member's interval as well as its value
    s.lo = Math.min(s.min, ...s.members.map((m) => m.iqr?.[0] ?? m.value)); s.hi = Math.max(s.max, ...s.members.map((m) => m.iqr?.[1] ?? m.value));
    if (s.log && s.lo <= 0) s.log = false;
  }
  return { data, byId, sheets, spread, propNames: [...spread.values()].sort((a, b) => b.count - a.count).map((s) => s.name) };
}

// Position carries meaning. A sheet's cells run from the firmest ground to the least: grounded, then partial, then
// thought, and inside each grade the element with the most evidence comes first. So the first cell of a sheet is
// the one the studies say most about, and the last is still only an idea.
export function orderCells(ix, sheetId) {
  return ix.data.elements.filter((e) => e.sheet === sheetId)
    .sort((a, b) => (GROUND_RANK[a.ground] ?? 2) - (GROUND_RANK[b.ground] ?? 2) || (b.evidence ?? 0) - (a.evidence ?? 0) || a.name.localeCompare(b.name));
}

export const propOf = (el, name) => (el.properties || []).find((p) => p.name === name) || null;

// The numbers the well draws from. For each drive: the visitor's setting if there is one, else the element's
// measured median, else the median over the table (marked, so nothing unmeasured passes as measured).
export function driveFor(ix, el, settings = {}) {
  const out = {}, source = {};
  for (const [k, d] of Object.entries(DRIVES)) {
    const p = propOf(el, d.prop), s = ix.spread.get(d.prop);
    if (typeof settings[k] === 'number') { out[k] = settings[k]; source[k] = 'set'; }
    else if (p) { out[k] = p.value; source[k] = 'measured'; }
    else { out[k] = s ? s.median : 0; source[k] = 'table median'; }
  }
  return { values: out, source, shader: toShader(ix, out) };
}
// Measured units to the well's own: shares stay shares; the three that span decades are placed by their rank in
// the table's range, so the weakest measured wave is faint and the strongest is plain.
function toShader(ix, v) {
  const rel = (k) => { const s = ix.spread.get(DRIVES[k].prop); if (!s || s.max === s.min) return 0.5;
    const t = s.log ? Math.log(v[k] / s.min) / Math.log(s.max / s.min) : (v[k] - s.min) / (s.max - s.min); return Math.min(1.2, Math.max(0, t)); };
  const sat = ix.spread.get(DRIVES.saturation.prop);
  return { wavelength: v.wavelength, orientation: v.orientation, peak: rel('peak'), beta: v.beta, softness: v.softness, coverage: v.coverage, density: v.density,
    saturation: sat ? Math.min(2.4, v.saturation / sat.median) : 1, rows: v.rows, speed: rel('speed'), curl: rel('curl'), coherence: v.coherence };
}

// The blend table. For every property any part has: each part's value, interval and n (or null where unmeasured),
// and the mix worked out from the parts that have it, by weight. The mix is computed, never measured.
export function blendTable(ix, ids, weights = null) {
  const els = ids.map((id) => ix.byId.get(id)).filter(Boolean);
  const raw = els.map((_, i) => Math.max(0, +(weights?.[i] ?? 1) || 0)), sum = raw.reduce((a, b) => a + b, 0) || 1, w = raw.map((x) => x / sum);
  const rows = [];
  for (const name of ix.propNames) {
    const parts = els.map((e) => propOf(e, name));
    if (!parts.some(Boolean)) continue;
    let acc = 0, tw = 0; parts.forEach((p, i) => { if (p) { acc += w[i] * p.value; tw += w[i]; } });
    rows.push({ name, parts: parts.map((p) => (p ? { value: p.value, iqr: p.iqr || null, n: p.n ?? null } : null)),
      computed: tw > 0 ? { value: acc / tw, of: parts.filter(Boolean).length, label: 'computed' } : null });
  }
  // links are the table's own measured bridges: how often two elements were found together, each way as recorded
  const links = [];
  for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
    const ab = els[i].links.find((l) => l.to === els[j].id) || null, ba = els[j].links.find((l) => l.to === els[i].id) || null;
    links.push({ a: els[i].id, b: els[j].id, ab: ab ? { weight: ab.weight, label: ab.label } : null, ba: ba ? { weight: ba.weight, label: ba.label } : null });
  }
  return { ids: els.map((e) => e.id), weights: w, rows, links };
}

// An element as a studio material, so the studio's blend, motion and type lanes can take it. The palette's ink is
// the element's measured colour; the core numbers come from its drive values. The starting generators (which
// lettering technique, which timing curve) come from the studio material nearest in kind, named here by hand.
const NEAR = { water: 'shore-water', ink: 'ink-brush', light: 'light', glass: 'glass', paper: 'torn-paper', code: 'code', 'stone-sand': 'raked-concrete',
  'thread-textile': 'rope', 'screen-pixel': 'crt-signal', 'metal-plate': 'engraving', pigment: 'spray', sound: 'chladni', 'film-stock': 'crt-signal',
  'city-architecture': 'art-deco', air: 'light', 'cloud-mist': 'spray', type: 'engraving', data: 'code' };
const BY_SHEET = { material: 'liquid', property: 'glass', process: 'liquid', form: 'engraving', composition: 'art-deco', rules: 'engraving', meaning: 'ink-brush' };
export const nearMaterial = (el) => NEAR[el.id] || BY_SHEET[el.sheet] || 'liquid';
export function materialFor(ix, el, settings = {}) {
  const near = nearMaterial(el), base = near === 'code' ? CODE_MATERIAL : studioMaterial(near) ?? studioMaterial('liquid');
  const d = driveFor(ix, el, settings), s = d.shader, hex = el.colour?.hex || '#8a8a8a';
  return {
    id: el.id, name: el.name, genre: [el.sheet], palette: { ground: '#0c1620', ink: hex, accent: hex }, noiseColour: base.noiseColour,
    core: { ...base.core, flow: Math.min(1, s.speed), order: Math.min(1, Math.max(0, d.values.coherence * 1.6)), line: Math.min(1, s.peak),
      lineDeg: Math.min(180, Math.max(0, d.values.orientation)), particles: Math.min(1, d.values.density * 5), tension: Math.min(1, Math.max(0, 1 - d.values.softness / 15)) },
    // the voices are carried for the sound layer to come; nothing on the bench plays them
    hints: { type: { technique: base.hints.type.technique, face: base.hints.type.face, opts: base.hints.type.opts }, image: { plates: base.hints.image.plates }, motion: { curve: base.hints.motion.curve }, sound: { voices: base.hints.sound.voices } },
    from: { element: el.id, near, mapping: 'computed' },
  };
}

// The take-away recipe: which elements, at what weight, with which settings. Small, readable, and loadable again.
export const RECIPE_FORMAT = 'bench.recipe/1';
export function makeRecipe(ix, ids, weights, settings) {
  return { format: RECIPE_FORMAT, elements: ids.map((id, i) => ({ id, name: ix.byId.get(id)?.name ?? id, weight: +(+(weights?.[i] ?? 1)).toFixed(3), settings: { ...(settings?.[id] ?? {}) } })) };
}
export function readRecipe(ix, doc) {
  if (!doc || doc.format !== RECIPE_FORMAT || !Array.isArray(doc.elements)) throw new Error(`recipe: not a ${RECIPE_FORMAT} file`);
  const parts = doc.elements.filter((p) => ix.byId.has(p?.id)).slice(0, 4);
  if (!parts.length) throw new Error('recipe: none of its elements are in this table');
  const settings = {};
  for (const p of parts) { settings[p.id] = {}; for (const [k, v] of Object.entries(p.settings || {})) if (k in DRIVES && Number.isFinite(v)) settings[p.id][k] = v; }
  return { ids: parts.map((p) => p.id), weights: parts.map((p) => (Number.isFinite(p.weight) && p.weight >= 0 ? p.weight : 1)), settings };
}
