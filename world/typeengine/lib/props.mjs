// lib/props.mjs: the property types of a panel of light.
//
// On a monitor every medium ends as light on one flat grid of pixels. So a letter is not made "of glass" or "of
// sound": it is made of properties that any material can supply. A material declares which properties it provides
// and which it consumes; any provider feeds any consumer through a type-checked adapter (lib/adapters.mjs).
//
// Frames are w x h pixels, y down, linear light. Every value carries its type in `prop`, so a value that crosses
// an edge is checked by name, never by shape alone. Provenance is a property too, but only data: no adapter turns
// it into pixels, and the renderer refuses it in a drawing slot (tests/props.test.mjs).

const F32 = (v) => v instanceof Float32Array;

function frame(v) {
  if (!v || typeof v !== 'object') return 'value must be an object';
  if (!(Number.isInteger(v.w) && v.w > 0 && Number.isInteger(v.h) && v.h > 0)) return `w and h must be positive integers (got ${v?.w} x ${v?.h})`;
  return null;
}
const grid = (ch) => (v) => frame(v) ?? (!F32(v.data) ? 'data must be a Float32Array' : v.data.length !== v.w * v.h * ch ? `data length ${v.data.length} is not w*h*${ch}` : null);

export const PROPS = Object.freeze({
  // Coverage and field
  'coverage': { group: 'coverage', doc: 'Ink coverage per pixel, 0..1. { w, h, data: Float32Array(w*h) }', check: grid(1), sf: 'field' },
  'field.sdf': { group: 'coverage', doc: 'Signed distance to the letter edge in px, negative inside. { w, h, data }', check: grid(1), sf: 'field' },
  'field.scalar': { group: 'coverage', doc: 'Any scalar over the frame, 0..1 by convention (tone, thickness, a data profile). { w, h, data }', check: grid(1), sf: 'field' },
  // Surface
  'surface.albedo': { group: 'surface', doc: 'Reflected colour, linear RGBA, straight alpha. { w, h, data: Float32Array(w*h*4) }', check: grid(4), sf: 'raster' },
  'surface.normal': { group: 'surface', doc: 'Unit normals, z toward the viewer. { w, h, data: Float32Array(w*h*3) }', check: grid(3), sf: null },
  'surface.height': { group: 'surface', doc: 'Height or thickness in px. { w, h, data }', check: grid(1), sf: 'field' },
  // Structure
  'structure.strokes': { group: 'structure', doc: 'Centre lines in px. { w, h, strokes: [{ pts: [[x, y]...], width, closed? }] }',
    check: (v) => frame(v) ?? (!Array.isArray(v.strokes) ? 'strokes must be an array' : v.strokes.some((s) => !Array.isArray(s.pts) || !(s.width > 0)) ? 'each stroke needs pts and a positive width' : null), sf: 'vector' },
  'structure.cells': { group: 'structure', doc: 'A cell grid over the frame. { w, h, cell (px), cols, rows, data: Float32Array(cols*rows) } coverage per cell',
    check: (v) => frame(v) ?? (!(v.cell > 0) ? 'cell must be positive' : !F32(v.data) || v.data.length !== v.cols * v.rows ? 'data must be cols*rows' : null), sf: null },
  'structure.particles': { group: 'structure', doc: 'Points. { w, h, n, x, y: Float32Array(n), size?: px radius, tone?: 0..1 }',
    check: (v) => frame(v) ?? (!F32(v.x) || !F32(v.y) || v.x.length !== v.n || v.y.length !== v.n ? 'x and y must be Float32Array(n)' : null), sf: 'particles' },
  'structure.graph': { group: 'structure', doc: 'Nodes and edges. { w, h, nodes: [[x, y]...], edges: [[i, j]...] }',
    check: (v) => frame(v) ?? (!Array.isArray(v.nodes) || !Array.isArray(v.edges) ? 'nodes and edges must be arrays' : v.edges.some(([i, j]) => !(i < v.nodes.length && j < v.nodes.length)) ? 'an edge points past the nodes' : null), sf: 'vector' },
  // Light
  'light.emission': { group: 'light', doc: 'Emitted light, linear RGB plus coverage in alpha; may exceed 1 before tonemapping. { w, h, data: w*h*4 }', check: grid(4), sf: 'raster' },
  'light.refraction': { group: 'light', doc: 'Where each pixel looks through to, as px offsets (green channel). { w, h, data: w*h*2 }', check: grid(2), sf: 'field' },
  'light.dispersion': { group: 'light', doc: 'Per-channel offsets, R G B. { w, h, data: w*h*6 }', check: grid(6), sf: null },
  // Motion
  'motion.velocity': { group: 'motion', doc: 'Flow in px per second. { w, h, data: w*h*2 }', check: grid(2), sf: 'field' },
  'motion.phase': { group: 'motion', doc: 'Phase in cycles, 0..1, read against a clock. { w, h, data }', check: grid(1), sf: 'field' },
  'motion.clock': { group: 'motion', doc: 'A clock. { t (s), duration (s), fps }', check: (v) => (!(v?.t >= 0) || !(v.duration > 0) || !(v.fps > 0) ? 't >= 0, duration > 0, fps > 0' : null), sf: 'time' },
  // Sound
  'sound.spectrum': { group: 'sound', doc: 'Magnitude by row (high rows high pitch) and column (time). { rows, cols, fLow, fHigh, colSec, data: Float32Array(rows*cols) }',
    check: (v) => (!(v?.rows > 1 && v.cols > 1) ? 'rows and cols must be > 1' : !F32(v.data) || v.data.length !== v.rows * v.cols ? 'data must be rows*cols' : !(v.fHigh > v.fLow) ? 'fHigh must exceed fLow' : null), sf: 'field' },
  'sound.onsets': { group: 'sound', doc: 'Onset times in s with strengths 0..1. { duration, t: Float64Array, s: Float64Array }',
    check: (v) => (!(v?.duration > 0) ? 'duration must be > 0' : !(v.t instanceof Float64Array) || !(v.s instanceof Float64Array) || v.t.length !== v.s.length ? 't and s must be Float64Arrays of one length' : null), sf: 'events' },
  'sound.pcm': { group: 'sound', doc: 'Samples. { rate, channels: [Float32Array...] } planar, -1..1', check: (v) => (!(v?.rate > 0) || !Array.isArray(v.channels) || !F32(v.channels[0]) ? 'rate > 0 and Float32Array channels' : null), sf: 'audio' },
  // Data
  'data.series': { group: 'data', doc: 'A series of raw values. { y: Float64Array, label?, unit? }', check: (v) => (!(v?.y instanceof Float64Array) || v.y.length < 2 ? 'y must be a Float64Array of 2 or more' : null), sf: 'series' },
  'data.values': { group: 'data', doc: 'Named numbers. { values: { name: number } }', check: (v) => (!v?.values || Object.values(v.values).some((x) => !Number.isFinite(x)) ? 'values must be finite numbers' : null), sf: null },
  // Provenance: data only
  'provenance': { group: 'provenance', doc: 'Where a thing came from. { source, licence, recipe?, sha256? }. Never drawn.', check: (v) => (typeof v?.source !== 'string' || typeof v.licence !== 'string' ? 'source and licence must be strings' : null), sf: null, dataOnly: true },
});

export const PROP_NAMES = Object.freeze(Object.keys(PROPS));
export const GROUPS = Object.freeze([...new Set(Object.values(PROPS).map((p) => p.group))]);

/** Tag a value with its property type and check it. Throws with the reason on a bad value. */
export function as(prop, value) {
  const P = PROPS[prop];
  if (!P) throw new TypeError(`props: unknown property type "${prop}"`);
  const e = P.check(value);
  if (e) throw new TypeError(`props: ${prop}: ${e}`);
  return Object.assign(value, { prop });
}

/** Check a tagged value; returns an error string or null. */
export function checkProp(prop, value) {
  const P = PROPS[prop];
  if (!P) return `unknown property type "${prop}"`;
  if (value?.prop && value.prop !== prop) return `expected ${prop}, got ${value.prop}`;
  return P.check(value);
}

// Constructors, so materials and adapters never build shapes by hand.
export const make = {
  coverage: (w, h, data = new Float32Array(w * h)) => as('coverage', { w, h, data }),
  sdf: (w, h, data = new Float32Array(w * h)) => as('field.sdf', { w, h, data }),
  scalar: (w, h, data = new Float32Array(w * h)) => as('field.scalar', { w, h, data }),
  albedo: (w, h, data = new Float32Array(w * h * 4)) => as('surface.albedo', { w, h, data }),
  normal: (w, h, data = new Float32Array(w * h * 3)) => as('surface.normal', { w, h, data }),
  height: (w, h, data = new Float32Array(w * h)) => as('surface.height', { w, h, data }),
  emission: (w, h, data = new Float32Array(w * h * 4)) => as('light.emission', { w, h, data }),
  refraction: (w, h, data = new Float32Array(w * h * 2)) => as('light.refraction', { w, h, data }),
  dispersion: (w, h, data = new Float32Array(w * h * 6)) => as('light.dispersion', { w, h, data }),
  velocity: (w, h, data = new Float32Array(w * h * 2)) => as('motion.velocity', { w, h, data }),
  phase: (w, h, data = new Float32Array(w * h)) => as('motion.phase', { w, h, data }),
  clock: (t = 0, duration = 4, fps = 24) => as('motion.clock', { t, duration, fps }),
  strokes: (w, h, strokes = []) => as('structure.strokes', { w, h, strokes }),
  cells: (w, h, cell, cols, rows, data = new Float32Array(cols * rows)) => as('structure.cells', { w, h, cell, cols, rows, data }),
  particles: (w, h, x, y, extra = {}) => as('structure.particles', { w, h, n: x.length, x, y, ...extra }),
  graph: (w, h, nodes, edges) => as('structure.graph', { w, h, nodes, edges }),
  spectrum: (rows, cols, data, o = {}) => as('sound.spectrum', { rows, cols, data, fLow: 600, fHigh: 7000, colSec: 0.014, ...o }),
  onsets: (duration, t, s) => as('sound.onsets', { duration, t: Float64Array.from(t), s: Float64Array.from(s) }),
  pcm: (rate, channels) => as('sound.pcm', { rate, channels }),
  series: (y, extra = {}) => as('data.series', { y: Float64Array.from(y), ...extra }),
  values: (values) => as('data.values', { values }),
  provenance: (source, licence, extra = {}) => as('provenance', { source, licence, ...extra }),
};

/** The schema as plain JSON (for docs, the room and agents). */
export function schemaJson() {
  return { schema: 'typeengine.props/1', groups: GROUPS, props: Object.fromEntries(PROP_NAMES.map((n) => [n, { group: PROPS[n].group, doc: PROPS[n].doc, superframe: PROPS[n].sf, dataOnly: !!PROPS[n].dataOnly }])) };
}
