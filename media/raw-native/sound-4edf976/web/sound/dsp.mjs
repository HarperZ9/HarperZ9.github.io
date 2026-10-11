// SPDX-License-Identifier: FSL-1.1-MIT
// DSP primitives for the sound engine. Everything here is float64, written as
// plain loops in index order, so Node (offline render) and an AudioWorklet
// (live) run the same arithmetic and produce the same samples. No WebAudio
// node is used for signal processing: the browser's own filters and
// compressors differ between engines, and the live path must reconcile with
// the offline reference (superstack SPEC section 8.2). Pure; runs in Node.

export const RATE = 48000;
export const db = (g) => (g > 0 ? 20 * Math.log10(g) : -Infinity);
export const undb = (d) => Math.pow(10, d / 20);
export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const ms = (m, rate = RATE) => Math.round((m * rate) / 1000);
// One-pole smoothing coefficient that covers about 63% of a step in `t` seconds.
export const coef = (t, rate = RATE) => (t <= 0 ? 0 : Math.exp(-1 / (t * rate)));

// A sine wavetable with linear interpolation. Oscillators read it at a phase
// computed from the absolute sample index, so a voice is a pure function of
// time: the live player can start anywhere and land on the same sample.
const TABLE_BITS = 13, TABLE = 1 << TABLE_BITS;
const SINE = new Float64Array(TABLE + 1);
for (let i = 0; i <= TABLE; i++) SINE[i] = Math.sin((2 * Math.PI * i) / TABLE);
export function sinCycles(c) {
  let u = c - Math.floor(c);
  u *= TABLE;
  const i = Math.floor(u), f = u - i;
  return SINE[i] + (SINE[i + 1] - SINE[i]) * f;
}

// Equal-power pan, p in [-1, 1]: the centre is -3.01 dB per side, so a source
// keeps its loudness as it moves across the screen.
export function panGains(p) {
  const a = ((clamp(p, -1, 1) + 1) * Math.PI) / 4;
  return [Math.cos(a), Math.sin(a)];
}
// Screen x (design pixels) to pan. `width` < 1 keeps cues off the hard edges,
// so the mix holds on one speaker and on headphones alike.
export const panOfX = (x, designWidth = 1920, width = 0.6) => clamp(((x - designWidth / 2) / (designWidth / 2)) * width, -1, 1);

// RBJ cookbook biquads (Bristow-Johnson, "Cookbook formulae for audio EQ
// biquad filter coefficients"), normalised so a0 = 1: [b0, b1, b2, a1, a2].
export function biquadCoefs(type, f, q = Math.SQRT1_2, gainDb = 0, rate = RATE) {
  const w = (2 * Math.PI * f) / rate, cw = Math.cos(w), sw = Math.sin(w), al = sw / (2 * q);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  switch (type) {
    case "lowpass": b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case "highpass": b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = b0; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case "bandpass": b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al; break;
    case "peaking": b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A; break;
    case "lowshelf": {
      const s = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) - (A - 1) * cw + s); b1 = 2 * A * ((A - 1) - (A + 1) * cw); b2 = A * ((A + 1) - (A - 1) * cw - s);
      a0 = (A + 1) + (A - 1) * cw + s; a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - s; break;
    }
    case "highshelf": {
      const s = 2 * Math.sqrt(A) * al;
      b0 = A * ((A + 1) + (A - 1) * cw + s); b1 = -2 * A * ((A - 1) + (A + 1) * cw); b2 = A * ((A + 1) + (A - 1) * cw - s);
      a0 = (A + 1) - (A - 1) * cw + s; a1 = 2 * ((A - 1) - (A + 1) * cw); a2 = (A + 1) - (A - 1) * cw - s; break;
    }
    default: throw new Error("biquad: unknown type " + type);
  }
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}

// A direct-form I biquad with its own state; step(x) -> y.
export class Biquad {
  constructor(c) { this.c = c; this.x1 = 0; this.x2 = 0; this.y1 = 0; this.y2 = 0; }
  reset() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  step(x) {
    const [b0, b1, b2, a1, a2] = this.c;
    const y = b0 * x + b1 * this.x1 + b2 * this.x2 - a1 * this.y1 - a2 * this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}

// Filter a whole buffer in place (for cue synthesis, which runs once).
export function filterInPlace(buf, c) {
  const f = new Biquad(c);
  for (let i = 0; i < buf.length; i++) buf[i] = f.step(buf[i]);
  return buf;
}

// Scale a buffer so its largest magnitude is `peak` (no-op on silence).
export function normalizePeak(buf, peak = 1) {
  let m = 0;
  for (let i = 0; i < buf.length; i++) { const a = Math.abs(buf[i]); if (a > m) m = a; }
  if (m > 0) { const g = peak / m; for (let i = 0; i < buf.length; i++) buf[i] *= g; }
  return buf;
}

// Attack and release shaped as a raised cosine over `n` samples: no click.
export const rise = (k, n) => (k >= n ? 1 : k <= 0 ? 0 : 0.5 - 0.5 * Math.cos((Math.PI * k) / n));
