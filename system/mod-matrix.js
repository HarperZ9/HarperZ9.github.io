// mod-matrix.js: everything drives everything. A route patches one source
// (an audio band, an LFO character, the cursor, a knob) into one target
// parameter with a signed depth. The pure half lives here: source evaluation
// and offset arithmetic, in normalized units; the page owns sliders and
// applies offsets as a fraction of each target's range without ever writing
// the DOM value, so the user's set point survives underneath the motion.
// LFOs are stateless functions of time, so a patch reloads identically.

export const MOD_SOURCES = [
  { id: "bass", label: "Bass", centered: false },
  { id: "mid", label: "Mid", centered: false },
  { id: "treble", label: "Treble", centered: false },
  { id: "level", label: "Level", centered: false },
  { id: "lfo-slow", label: "LFO slow sine", centered: true },
  { id: "lfo-sine", label: "LFO sine", centered: true },
  { id: "lfo-tri", label: "LFO triangle", centered: true },
  { id: "lfo-hold", label: "LFO random hold", centered: true },
  { id: "cursor-x", label: "Cursor X", centered: false },
  { id: "cursor-y", label: "Cursor Y", centered: false },
  { id: "knobA", label: "Knob A", centered: false },
  { id: "knobB", label: "Knob B", centered: false },
  { id: "knobC", label: "Knob C", centered: false },
];

function hold(t, rate, seed) {
  const step = Math.floor(t * rate) + seed * 977;
  const h = Math.sin(step * 127.1) * 43758.5453;
  return (h - Math.floor(h)) - 0.5;
}

// Source values for one frame. env: {bass,mid,treble,level,mx,my,knobA,knobB,
// knobC} all 0..1. Centered sources return -0.5..0.5; the rest 0..1.
export function evalSources(t, env) {
  const tri = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1;
  return {
    bass: env.bass || 0, mid: env.mid || 0, treble: env.treble || 0, level: env.level || 0,
    "lfo-slow": 0.5 * Math.sin(t * 2 * Math.PI * 0.08),
    "lfo-sine": 0.5 * Math.sin(t * 2 * Math.PI * 0.5),
    "lfo-tri": 0.5 * tri(t * 2.0),
    "lfo-hold": hold(t, 1.5, 1),
    "cursor-x": env.mx === undefined ? 0.5 : env.mx,
    "cursor-y": env.my === undefined ? 0.5 : env.my,
    knobA: env.knobA || 0, knobB: env.knobB || 0, knobC: env.knobC || 0,
  };
}

// Offsets per target, in fractions of the target's range, clamped to +-1.
// routes: [{src, tgt, depth}] with depth -1..1. Unknown sources contribute 0.
export function computeOffsets(routes, sourceValues) {
  const out = {};
  for (const r of routes || []) {
    if (!r || !r.tgt || typeof r.depth !== "number") continue;
    const meta = MOD_SOURCES.find((s) => s.id === r.src);
    const raw = sourceValues[r.src];
    if (raw === undefined || !meta) continue;
    const v = raw * r.depth;
    out[r.tgt] = Math.max(-1, Math.min(1, (out[r.tgt] || 0) + v));
  }
  return out;
}

// A modulated read: base slider value plus its offset as a range fraction,
// clamped to the slider's own bounds.
export function modValue(base, min, max, offset) {
  if (!offset) return base;
  const v = base + offset * (max - min);
  return Math.max(min, Math.min(max, v));
}

export function describeRoute(route) {
  const s = MOD_SOURCES.find((x) => x.id === route.src);
  return (s ? s.label : route.src) + " → " + route.tgtLabel + " " +
    (route.depth >= 0 ? "+" : "") + Math.round(route.depth * 100) + "%";
}
