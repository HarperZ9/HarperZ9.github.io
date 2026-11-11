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
import { GROUNDS } from './grounds.mjs';

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
// Every property in plain words: a short name, and one line a visitor with no signal-processing background can follow.
export const TERMS = Object.freeze({
  'spatial/dominant wavelength': ['Wave length', 'Pictures of this element tend to repeat at one spacing more than any other, like ripples a set distance apart. This is that distance, as a share of the picture\'s width. Small means fine ripples.'],
  'spatial/edge softness': ['Edge softness', 'How gradually one tone turns into the next. A low number is a hard edge, like cut paper. A high number is a slow fade, like mist.'],
  'spatial/peak strength': ['Wave strength', 'How much that one repeating spacing stands out from everything else in the picture. Near zero, there is no clear repeat. Higher, the ripples are plain to see.'],
  'spatial/spectral slope beta': ['Roughness slope', 'How the picture\'s detail is shared between large shapes and fine grain. A high slope means mostly large, smooth shapes. A low slope means a lot of fine grain.'],
  'spatial/wave orientation': ['Wave angle', 'The direction the repeating ripples run, in degrees. 0 and 180 are the same direction, so this number goes round in a circle.'],
  'colour/mean saturation': ['Saturation', 'How strong the colour is on average, from 0 (grey) to 1 (as vivid as the screen can show).'],
  'frame/aspect': ['Frame shape', 'The width of the picture divided by its height. 1 is square, above 1 is wide, below 1 is tall.'],
  'layout/dark-mark rows': ['Rows', 'How many separate dark bands lie across the picture from top to bottom, like lines of writing.'],
  'marks/edge density': ['Edge density', 'The share of the picture that is an edge between two tones. More edges means busier, finer marks.'],
  'marks/ink coverage': ['Ink coverage', 'The share of the picture covered by marks, from 0 (bare) to 1 (covered).'],
  'flow/direction coherence': ['One direction', 'In film of this element, how much of the movement goes the same way. Low is movement in all directions. High is everything moving together.'],
  'flow/mean divergence': ['Spreading', 'Whether movement in the film tends to spread outward from points (above zero) or draw inward (below zero). Near zero, neither.'],
  'flow/mean speed': ['Flow speed', 'How fast things move between one film frame and the next, on average.'],
  'flow/mean |curl|': ['Turning', 'How much the movement in the film turns on itself, like an eddy, whichever way it turns.'],
  'flow/mean |div|': ['Spreading and gathering', 'How much the movement spreads out or draws in, counted together, whichever of the two it is.'],
  'layout/row pitch': ['Row spacing', 'The distance from one dark row to the next, as a share of the picture\'s height.'],
  'flow/vorticity share': ['Share of turning', 'Of all the movement in the film, the part that is turning and not travelling.'],
  'marks/light ground': ['Light ground', 'The share of the picture that is light, unmarked ground.'],
  'radial/concentricity': ['Rings', 'How strongly the picture is arranged in rings around a centre, from 0 (no rings) to 1.'],
});
// The other words the bench uses, for the glossary under the charts.
export const WORDS = Object.freeze([
  ['Measured', 'Read from studied pictures and film by a named instrument. The number comes with how many were read.'],
  ['Computed', 'Worked out on this page from measured numbers. A computed number is always labelled so.'],
  ['Median', 'The middle value: half of the measurements are below it and half above.'],
  ['Interquartile range', 'The span that holds the middle half of the measurements. A short bar means they agree; a long bar means they vary.'],
  ['n', 'How many pictures or films the number was measured on.'],
  ['Instrument', 'The method that took the measurement. "f^2-whitened spectrum" looks at how often patterns repeat at each size; "Farneback optical flow" follows movement between film frames; "deterministic image measures" counts marks, edges and colour directly.'],
  ['Log scale', 'An axis where each step multiplies the value instead of adding to it, so very small and very large values both fit.'],
  ['Link', 'How many studies found two elements together.'],
  ['Ground', 'How much is measured about an element: grounded (a law has a measured weight), partial (properties are measured), thought (nothing measured yet).'],
  ['Reaction', 'Computed. Where two elements with a measured link have mixed in the well, a third pigment grows between them in a pattern of its own. It follows a reaction and diffusion rule (Gray-Scott): one substance feeds, another grows on it and decays. The link sets how strongly it grows; with no link there is only mixing. The pair\'s wave length sets the size of the pattern by its rank in the table, and their edge softness sets whether it grows as separate spots or as joined, winding forms. The product\'s colour is worked out from the pair: their midpoint in OKLab, a little lighter, with its hue turned further the stronger the link.'],
  ['Kubelka-Munk', 'The standard model of how a layer of paint handles light, named for the two people who published it in 1931. Each pigment has two numbers per colour: absorption, the light it takes away, and scattering, the light it turns back. From them a layer gets a reflectance (the light it sends back) and a transmittance (the light it lets through), and layers stack by a formula in which the order matters whenever a pigment scatters. On paper, the well and the glaze swatches are both painted this way. Computed.'],
  ['Glaze', 'One thin, see-through wash of pigment laid over another, so the overlap shows both and has a hue of its own.'],
  ['Opacity', 'Computed. How much of its own colour a pigment keeps over black. Here it is the element\'s measured ink coverage, used as it is; an element with no measured coverage takes the table\'s median. The absorption and scattering of each pigment are worked out from its measured colour and this opacity.'],
  ['Ground', 'Computed. What the pigment lies on. A ground is one of the table\'s materials, and each has its own rule for how colours combine. Paper, stone and metal plate: paint layers (see Kubelka-Munk); on stone and metal the pigment sits on top, beads and pools. Glass: light comes through, each wash is a filter, and the filters multiply. Water: pigments mix by the geometric mean of the light they send back. Air and cloud mist: pigment hangs like smoke and the eye gets the plain average. Light and screen pixel: colours add, so red and green go toward yellow. Data: each pigment is a separate mark in a lattice and the eye averages the marks. If the blend holds a material that has a ground, the first one is the ground and the rest lie on it; if not, the ground follows the page, paper by day and water by night. You can choose another, and the recipe keeps your choice.'],
  ['Paper and tooth', 'Paper is the absorbent ground. Its tooth is the fine up and down of the surface.'],
  ['Granulation', 'Computed. Pigment settling into the low points of the paper\'s tooth, which shows as fine grain. It is stronger for an element with a low roughness slope, by its rank in the table.'],
  ['Dried edge', 'Computed. As a wash dries, pigment is carried to its edge and leaves a darker rim. The rim appears a few seconds after the water is left alone, is stronger for an element with hard measured edges, and is absent where the wash met another wet wash.'],
  ['Wet into wet', 'Computed. Where a wash meets another that is still wet, its edge is wider and softer and its pigment spreads faster. The spread follows the element\'s edge softness and flow speed.'],
  ['Conserved', 'The well keeps the amount of each pigment. Carrying and spreading do not keep it exactly, so every step ends by scaling each pigment back to what was put in: the start, plus every pour. The total then stays within one part in ten thousand.'],
  ['OKLab', 'A way of writing colours as numbers so that equal steps in the numbers look like equal steps to the eye.'],
]);
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
    // An orientation goes round: its middle and its quartiles are taken around the circular mean, on a fixed 0 to 180 axis.
    if (mixRule(s.name) === 'circular') {
      const m = mixValue(s.name, v, v.map(() => 1)), near = v.map((x) => { let d = ((x - m) % 180 + 180) % 180; if (d > 90) d -= 180; return d; }).sort((a, b) => a - b);
      const back = (d) => +(((m + d) % 180 + 180) % 180).toFixed(6);
      Object.assign(s, { circular: true, log: false, lo: 0, hi: 180, median: back(quantile(near, 0.5)), q1: back(quantile(near, 0.25)), q3: back(quantile(near, 0.75)) });
    }
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
  const sat = ix.spread.get(DRIVES.saturation.prop), soft = Math.min(1, rel('softness'));
  return { wavelength: v.wavelength, orientation: v.orientation, peak: rel('peak'), beta: v.beta, softness: v.softness, coverage: v.coverage, density: v.density,
    saturation: sat ? Math.min(2.4, v.saturation / sat.median) : 1, rows: v.rows, speed: rel('speed'), curl: rel('curl'), coherence: v.coherence,
    // The paint the well lays down, each from a measured property by a stated rule (computed):
    //   opacity      ink coverage, as it is: a pigment that covers more of the frame hides more of what is under it
    //   granulation  the roughness slope, by rank: fine grain (a low slope) settles into the paper's tooth
    //   rim, bleed   edge softness, by rank: hard edges dry to a dark rim, soft edges bleed
    //   scale        the wave length, by rank: the size of the reaction's features
    opacity: Math.min(0.92, Math.max(0, v.coverage)), granulation: 1 - Math.min(1, rel('beta')), rim: 1 - soft, bleed: soft, scale: Math.min(1, rel('wavelength')) };
}

// How a property's values are combined into a mix. The rule follows the kind of quantity:
//   circular   an orientation, where 0 and 180 degrees are the same direction: the mean of the doubled angles as
//              directions, halved. A plain average of 5 and 175 would give 90, the one direction neither has.
//   geometric  a ratio (frame aspect is width over height): the mean of the logarithms, so 2:1 and 1:2 mix to 1:1.
//   weighted   everything else (shares, counts, speeds, lengths): the weighted arithmetic mean.
const RULES = { 'spatial/wave orientation': 'circular', 'frame/aspect': 'geometric' };
export const RULE_WORD = { circular: 'circular mean, 0 and 180 degrees being one direction', geometric: 'geometric mean, as it is a ratio', weighted: 'weighted mean' };
export const mixRule = (name) => RULES[name] || 'weighted';
export function mixValue(name, values, weights) {
  const tw = weights.reduce((a, b) => a + b, 0) || 1, rule = mixRule(name);
  if (rule === 'circular') { let x = 0, y = 0; values.forEach((v, i) => { const a = 2 * v * Math.PI / 180; x += weights[i] * Math.cos(a); y += weights[i] * Math.sin(a); });
    if (Math.hypot(x, y) < 1e-9 * tw) return values[0];           // opposite directions cancel: no mean exists, so the first part stands
    const d = Math.atan2(y, x) * 90 / Math.PI; return +((d % 180 + 180) % 180).toFixed(6); }
  if (rule === 'geometric' && values.every((v) => v > 0)) return Math.exp(values.reduce((s, v, i) => s + weights[i] * Math.log(v), 0) / tw);
  return values.reduce((s, v, i) => s + weights[i] * v, 0) / tw;
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
    const have = parts.map((p, i) => (p ? [p.value, w[i]] : null)).filter(Boolean);
    rows.push({ name, parts: parts.map((p) => (p ? { value: p.value, iqr: p.iqr || null, n: p.n ?? null } : null)),
      computed: have.length ? { value: mixValue(name, have.map((h) => h[0]), have.map((h) => h[1])), of: have.length, label: 'computed', rule: mixRule(name) } : null });
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
export function makeRecipe(ix, ids, weights, settings, ground = null) {
  return { format: RECIPE_FORMAT, ...(ground && GROUNDS[ground] ? { ground } : {}), elements: ids.map((id, i) => ({ id, name: ix.byId.get(id)?.name ?? id, weight: +(+(weights?.[i] ?? 1)).toFixed(3), settings: { ...(settings?.[id] ?? {}) } })) };
}
export function readRecipe(ix, doc) {
  if (!doc || doc.format !== RECIPE_FORMAT || !Array.isArray(doc.elements)) throw new Error(`recipe: not a ${RECIPE_FORMAT} file`);
  const parts = doc.elements.filter((p) => ix.byId.has(p?.id)).slice(0, 4);
  if (!parts.length) throw new Error('recipe: none of its elements are in this table');
  const settings = {};
  for (const p of parts) { settings[p.id] = {}; for (const [k, v] of Object.entries(p.settings || {})) if (k in DRIVES && Number.isFinite(v)) settings[p.id][k] = v; }
  return { ground: GROUNDS[doc.ground] ? doc.ground : null, ids: parts.map((p) => p.id), weights: parts.map((p) => (Number.isFinite(p.weight) && p.weight >= 0 ? p.weight : 1)), settings };
}
