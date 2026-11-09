// types.mjs: the port types. Every value that crosses an edge of a superframe graph is one of these.
// Each type has a short check (returns an error string or null) and a describe() for docs and the CLI.
// Coordinates are pixels in a w x h frame, y down. Light is linear (not sRGB) inside the graph; sRGB happens at export.

export const TYPES = Object.freeze({
  field: {
    doc: 'Scalar or vector grid. { w, h, channels: 1 | 2, data: Float32Array(w*h*channels) }. Scalar fields are 0..1 by convention; vector fields are signed px per unit.',
    check: v => grid(v, v?.channels ?? 1, 'field'),
  },
  raster: {
    doc: 'Float RGBA picture. { w, h, data: Float32Array(w*h*4) }, linear light, straight (not premultiplied) alpha, 0..1 (light may exceed 1 before export).',
    check: v => grid(v, 4, 'raster'),
  },
  vector: {
    doc: 'Paths. { w, h, paths: [{ pts: [[x, y], ...], closed?, width?, widths?: number[], fill?: hex, stroke?: hex }] } in px of the w x h frame.',
    check: v => (dims(v) ?? (Array.isArray(v.paths) ? null : 'vector: paths must be an array')),
  },
  glyphs: {
    doc: 'Lettering. { text, w, h, mask: Float32Array(w*h) coverage 0..1, outlines?: vector paths }. text is the real-text equivalent and is always kept.',
    check: v => dims(v) ?? (typeof v.text !== 'string' ? 'glyphs: text must be a string (the real-text equivalent)' : v.mask?.length !== v.w * v.h ? 'glyphs: mask must be w*h' : null),
  },
  particles: {
    doc: 'Point set. { w, h, n, x: Float32Array(n), y: Float32Array(n), size?: Float32Array(n) px radius, tone?: Float32Array(n) 0..1 }.',
    check: v => dims(v) ?? (v.x?.length !== v.n || v.y?.length !== v.n ? 'particles: x and y must have n entries' : null),
  },
  audio: {
    doc: 'Sample buffer. { rate, channels: [Float32Array, ...] } planar, -1..1. rate is one of the superstack sample rates (48000 by default).',
    check: v => (!(v?.rate > 0) ? 'audio: rate must be positive' : !Array.isArray(v.channels) || !v.channels.length || !(v.channels[0] instanceof Float32Array) ? 'audio: channels must be Float32Arrays' : null),
  },
  events: {
    doc: 'Timed events (MIDI-like). { duration (s), events: [{ t (s), voice, args: { note (MIDI), dur (s), vel 0..1, ... }, role? }] }. Same shape as the studio score.',
    check: v => (!Array.isArray(v?.events) ? 'events: events must be an array' : !(v.duration >= 0) ? 'events: duration must be >= 0' : null),
  },
  series: {
    doc: 'Data series. { y: Float64Array, x?: Float64Array, label?, unit? }. Raw values, not normalised.',
    check: v => (!(v?.y?.length >= 2) ? 'series: needs at least two values' : null),
  },
  material: {
    doc: 'A studio material (schema studio.material/1, studio/lib/schema.mjs): core physical and perceptual numbers plus lane hints.',
    check: v => (v?.schema !== 'studio.material/1' ? 'material: schema must be studio.material/1 (normalise it first)' : null),
  },
  text: {
    doc: 'Language. { text, lang?: BCP 47 tag, role?: content | description }. Words as a medium: they can be set as glyphs, spoken through a spectrogram, or read as they are.',
    check: v => (typeof v?.text !== 'string' ? 'text: text must be a string' : null),
  },
  motion: {
    doc: 'Moving picture. { w, h, fps, frames: [Float32Array(w*h*4)] linear RGBA, captions?: [{ from, to (frame indices), text }] }. Captions carry the words a story tells, so motion always has a text equivalent.',
    check: v => (dims(v) ?? (!(v.fps > 0) ? 'motion: fps must be positive' : !Array.isArray(v.frames) || !v.frames.length ? 'motion: needs frames' : v.frames.some(f => !(f instanceof Float32Array) || f.length !== v.w * v.h * 4) ? 'motion: every frame must be Float32Array(w*h*4)' : null)),
  },
  score: {
    doc: 'A criterion. { name, value, target?: [lo, hi], pass?: bool, metrics: { name: number } }. Quality-spec and gate readings travel as scores, so a graph can be steered by a goal.',
    check: v => (typeof v?.name !== 'string' || !Number.isFinite(v.value) ? 'score: needs a name and a finite value' : null),
  },
  distribution: {
    doc: 'A probability distribution as a value. { kind: normal | uniform | lognormal | choice, mean?, sd?, min?, max?, options?, weights? }. A node can sample it (seeded) or hold it (its mean or mode).',
    check: v => (!['normal', 'uniform', 'lognormal', 'choice'].includes(v?.kind) ? 'distribution: kind must be normal, uniform, lognormal or choice' : null),
  },
  time: {
    doc: 'A clock. { t (s), duration (s), fps }. Nodes that animate read it; a still renders at t.',
    check: v => (!(v?.t >= 0) || !(v.duration > 0) ? 'time: t >= 0 and duration > 0' : null),
  },
});

export const TYPE_NAMES = Object.freeze(Object.keys(TYPES));

function dims(v) {
  if (!v || typeof v !== 'object') return 'value must be an object';
  if (!(Number.isInteger(v.w) && v.w > 0 && Number.isInteger(v.h) && v.h > 0)) return `w and h must be positive integers (got ${v.w} x ${v.h})`;
  return null;
}
function grid(v, ch, name) {
  const e = dims(v); if (e) return `${name}: ${e}`;
  if (!(v.data instanceof Float32Array)) return `${name}: data must be a Float32Array`;
  if (v.data.length !== v.w * v.h * ch) return `${name}: data length ${v.data.length} is not w*h*${ch} = ${v.w * v.h * ch}`;
  return null;
}

export function checkValue(type, v) {
  const T = TYPES[type];
  if (!T) return `unknown port type "${type}"`;
  return T.check(v);
}

// Constructors, so adapters never build these shapes by hand.
export const make = {
  field: (w, h, data = new Float32Array(w * h), channels = 1) => ({ w, h, channels, data }),
  raster: (w, h, data = new Float32Array(w * h * 4)) => ({ w, h, data }),
  vector: (w, h, paths = []) => ({ w, h, paths }),
  particles: (w, h, x, y, extra = {}) => ({ w, h, n: x.length, x, y, ...extra }),
  audio: (rate, channels) => ({ rate, channels }),
  events: (events, duration = events.reduce((a, e) => Math.max(a, e.t + (e.args?.dur ?? 0)), 0)) => ({ duration, events }),
  series: (y, extra = {}) => ({ y: Float64Array.from(y), ...extra }),
  time: (t = 1, duration = 2, fps = 24) => ({ t, duration, fps }),
};
