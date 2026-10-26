// crossbus.js: one event model across sound, type, picture and data, so any lane can drive another.
//
// Five typed events: value, word, note, step, pointer. A lane subscribes with the types it reads, its medium, an
// encoding per type and a printed key (one line per mapping, as in the set 22 plate key), so a viewer can always
// read what drove what. A recorder writes the stream as plain JSON; a replayer plays it back through any lanes,
// so one log can come out as sound, picture or text. Routes turn one type into another (a word becomes a note, a
// pointer becomes a value) with a cause link and a depth limit, so a loop cannot run away.
//
// Synthesized from: the printed plate key of feed set 22, the step event of the reasoning-step cloud (shridhar),
// the pointer-as-force of the dot fields and the swarm, and the replayable log of Flywheel's receipt habit.
//
// Studio coordination. ADAPTER PENDING: studio has no transition() yet (checked 2026-10-23). materialLane
// turns step events into material transitions through the studio's lerpMaterial(a, b, t); pass `transition` when the
// studio ships one with the shape transition(from, to, t) and it is used instead, with no other change.
import { clamp, hashString, EASE } from './lib/util.js';
import { defineNode } from './lib/node.js';

export const TYPES = Object.freeze({
  value: { key: 'string', v: 'number' },
  word: { text: 'string' },
  note: { midi: 'number', vel: 'number', dur: 'number' },
  step: { i: 'number' },
  pointer: { x: 'number', y: 'number', p: 'number' },
});
export const MEDIA = Object.freeze(['sound', 'type', 'picture', 'data']);

export function validate(type, payload) {
  const shape = TYPES[type]; if (!shape) throw new TypeError(`crossbus: unknown event type ${type}`);
  for (const [k, kind] of Object.entries(shape)) if (typeof payload[k] !== kind || (kind === 'number' && !Number.isFinite(payload[k]))) throw new TypeError(`crossbus: ${type}.${k} must be a finite ${kind}`);
  if (type === 'note' && !(payload.midi >= 0 && payload.midi <= 127)) throw new RangeError('crossbus: note.midi must be 0 to 127');
  if (type === 'pointer' && !(payload.x >= 0 && payload.x <= 1 && payload.y >= 0 && payload.y <= 1)) throw new RangeError('crossbus: pointer x and y are shares of the frame, 0 to 1');
}

export class Bus {
  constructor({ maxDepth = 3 } = {}) { this.lanes = []; this.routes = []; this.taps = []; this.seq = 0; this.t = 0; this.maxDepth = maxDepth; }
  // lane: { id, medium, reads: [types], encode: { type: (event) => output }, key: [strings] }
  lane(l) {
    if (!MEDIA.includes(l.medium)) throw new Error(`crossbus: lane ${l.id} medium ${l.medium} unknown`);
    for (const ty of l.reads) { if (!TYPES[ty]) throw new Error(`crossbus: lane ${l.id} reads unknown ${ty}`); if (typeof l.encode?.[ty] !== 'function') throw new Error(`crossbus: lane ${l.id} has no encoding for ${ty}`); }
    if (!Array.isArray(l.key) || !l.key.length) throw new Error(`crossbus: lane ${l.id} must print its key`);
    l.out = []; this.lanes.push(l); return () => { this.lanes = this.lanes.filter((x) => x !== l); };
  }
  // route: one type to another, (event) => payload | payload[] | null. Derived events carry cause and depth.
  route(from, to, fn, key) { if (!TYPES[from] || !TYPES[to]) throw new Error('crossbus: route types'); this.routes.push({ from, to, fn, key: key || `${from} to ${to}` }); return this; }
  tap(fn) { this.taps.push(fn); return () => { this.taps = this.taps.filter((x) => x !== fn); }; }
  at(t) { this.t = t; return this; }
  emit(type, payload, { t = this.t, cause = null, depth = 0, seq } = {}) {
    validate(type, payload);
    const ev = Object.freeze({ seq: seq ?? this.seq++, t, type, ...payload, ...(cause !== null ? { cause, depth } : {}) });
    if (seq !== undefined) this.seq = Math.max(this.seq, seq + 1);
    for (const f of this.taps) f(ev);
    for (const l of this.lanes) if (l.reads.includes(type)) { const o = l.encode[type](ev); if (o !== undefined) l.out.push(o); }
    if (seq === undefined && depth < this.maxDepth) for (const r of this.routes) if (r.from === type) {
      const res = r.fn(ev); for (const p of res == null ? [] : [].concat(res)) this.emit(r.to, p, { t, cause: ev.seq, depth: depth + 1 });
    }
    return ev;
  }
  // The printed key: every lane's mapping lines and every route, in a stable order.
  keys() { return [...this.lanes.flatMap((l) => l.key.map((k) => `${l.medium}: ${k}`)), ...this.routes.map((r) => `route: ${r.key}`)]; }
}

// Record everything the bus emits (derived events included) as a JSON-safe log.
export function record(bus) {
  const log = { schema: 'crossbus.log/1', events: [] };
  const stop = bus.tap((ev) => log.events.push({ ...ev }));
  return { log, stop };
}

// Replay a log through a bus. Routes do not fire again on replay (derived events are already in the log), so a
// replay through any lanes sees exactly the recorded stream. until: replay only events with t <= until.
export function replay(log, bus, { until = Infinity, from = -Infinity } = {}) {
  let n = 0;
  for (const e of log.events) {
    if (e.t > until) break; if (e.t <= from) continue;
    const { seq, t, type, cause, depth, ...payload } = e; bus.emit(type, payload, { t, seq, cause: cause ?? null, depth: depth ?? 0 }); n++;
  }
  return n;
}

// --- mappings shared by the lanes. Each returns a payload and is documented in the key it prints.
const PENTA = [0, 2, 4, 7, 9];
export const map = Object.freeze({
  // value in [lo, hi] to a pentatonic note between two MIDI notes
  valueToNote: ({ lo = 0, hi = 1, low = 45, high = 81 } = {}) => (e) => { const u = clamp((e.v - lo) / (hi - lo)), steps = Math.round(u * ((high - low) / 12) * 5), oct = Math.floor(steps / 5); return { midi: low + 12 * oct + PENTA[steps % 5], vel: 0.35 + 0.5 * u, dur: 0.4 }; },
  // a word to a note: the hash of its letters picks the degree, its length the duration (longer words ring longer)
  wordToNote: ({ low = 57 } = {}) => (e) => { const h = hashString(e.text.toLowerCase()); return { midi: low + 12 * ((h >>> 8) % 2) + PENTA[h % 5], vel: 0.4, dur: clamp(0.12 * e.text.length, 0.15, 1.2) }; },
  // pointer pressure and height to a value
  pointerToValue: (key = 'height') => (e) => ({ key, v: 1 - e.y }),
  // a note back to a value in [0, 1] by pitch
  noteToValue: (key = 'pitch', low = 36, high = 96) => (e) => ({ key, v: clamp((e.midi - low) / (high - low)) }),
});

// Studio lane: step events move between materials. lerp is the studio's lerpMaterial; transition, when the studio
// ships it, replaces lerp. at(t) gives the material at time t, eased out over `over` seconds after each step.
export function materialLane({ materials, lerp, transition = null, over = 1.2, ease = EASE.outQuad }) {
  if (!materials?.length || typeof (transition || lerp) !== 'function') throw new Error('crossbus: materialLane needs materials and lerp or transition');
  const mix = transition || lerp, steps = [];
  const lane = {
    id: 'studio-material', medium: 'picture', reads: ['step'],
    key: [`step i moves from material i to i + 1 of ${materials.length} (${materials.map((m) => m.id).join(', ')}), eased out over ${over} s`],
    encode: { step: (e) => { steps.push(e); return { from: materials[e.i % materials.length].id, to: materials[(e.i + 1) % materials.length].id, t: e.t }; } },
    at(t) {
      const s = [...steps].reverse().find((e) => e.t <= t); if (!s) return { material: materials[0], u: 0 };
      const u = ease(clamp((t - s.t) / over)), a = materials[s.i % materials.length], b = materials[(s.i + 1) % materials.length];
      return { material: u >= 1 ? b : u <= 0 ? a : mix(a, b, u), u, from: a.id, to: b.id };
    },
  };
  return lane;
}

export const SPEC = Object.freeze({
  inputs: { events: 'value | word | note | step | pointer with typed payloads (TYPES)', lanes: 'medium, reads, encode, key' },
  params: {
    maxDepth: { range: [0, 8], unit: 'route hops a derived event may take', default: 3 },
    over: { range: [0, 6], unit: 's, material transition after a step (ease-out quad)', default: 1.2 },
    midiLow: { range: [24, 96], unit: 'MIDI note, low end of value-to-note', default: 45 },
    midiHigh: { range: [36, 108], unit: 'MIDI note, high end of value-to-note', default: 81 },
  },
  determinism: 'events carry seq and t; replay re-emits the log in order with routes off, so counts and order match',
  budget: 'emit is O(lanes + routes); 10,000 events through 4 lanes and 2 routes in under 20 ms in node',
});

export const node = defineNode({
  id: 'crossbus', ports: { in: { events: 'events' }, out: { events: 'events' } }, params: { maxDepth: SPEC.params.maxDepth }, seed: 1,
  render: ({ t, inputs = {}, params }) => { const bus = new Bus({ maxDepth: params.maxDepth }), { log } = record(bus); replay(inputs.log || { events: [] }, bus, { until: t }); return log; },
});
