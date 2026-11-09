// lib/medium/timing.mjs: timing as its own layer (BLEED section 14). When a change happens is kept apart from what
// changes: a timing layer is a named curve (its law) with a weight, mapping a tick's local clock to progress 0..1.
// Weighted timing layers combine, and a timing layer can be lifted off one element and laid on another.
//   sqrt_t      diffusion: progress grows with the square root of time (a stain spreading)
//   exp         Newton's cooling or heating: 1 - exp(-t / tau)
//   logistic    a slow start, a turn, a slow finish (a season)
//   beat        a pulse train at a tempo (the Hum v4 grid is 112 BPM); progress steps on each beat
//   linear      constant rate
export const CURVES = {
  sqrt_t: (t, { tau = 4 } = {}) => Math.min(1, Math.sqrt(Math.max(0, t) / tau)),
  exp: (t, { tau = 2 } = {}) => 1 - Math.exp(-Math.max(0, t) / tau),
  logistic: (t, { tau = 4, mid = 0.5 } = {}) => { const x = (Math.max(0, t) / tau - mid) * 10; return Math.min(1, Math.max(0, (1 / (1 + Math.exp(-x)) - 1 / (1 + Math.exp(mid * 10))) / (1 / (1 + Math.exp(-(1 - mid) * 10)) - 1 / (1 + Math.exp(mid * 10))))); },
  beat: (t, { bpm = 112, beats = 8, soft = 0.25 } = {}) => { const b = Math.max(0, t) * bpm / 60, i = Math.floor(b), f = b - i, step = Math.min(1, f / soft); return Math.min(1, (i + step * step * (3 - 2 * step)) / beats); },
  linear: (t, { tau = 4 } = {}) => Math.min(1, Math.max(0, t) / tau),
};

// a timing layer: { curve: name, weight, params }; several combine by weight into one progress value
export const timing = (curve, weight = 1, params = {}) => { if (!CURVES[curve]) throw new Error(`timing: no curve "${curve}" (one of ${Object.keys(CURVES).join(', ')})`); return { curve, weight, params }; };
export function progress(layers, t) {
  let s = 0, w = 0;
  for (const L of layers) { s += L.weight * CURVES[L.curve](t, L.params); w += L.weight; }
  return w > 0 ? s / w : 0;
}
