// Pure DSP core for the v3 instruments. No WebAudio here: every function writes samples into Float32Arrays, so the same
// instrument renders in a browser (wrapped in an AudioBuffer), in the superframe's Node runtime and in tests.
export const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
export const dbToGain = (db) => Math.pow(10, db / 20);

export function rng(seed = 1) { let s = (seed >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }

// Velocity response: 0..1 in, a gain and a brightness factor out. curve > 1 makes soft notes softer.
export function velocity(v, { curve = 1.6, floorDb = -30 } = {}) { const u = clamp(v, 0, 1); return { gain: dbToGain(floorDb * (1 - Math.pow(u, 1 / curve))), bright: 0.35 + 0.65 * u }; }

// Biquad (RBJ cookbook), direct form 1, state kept so it can run sample by sample or over a block.
export class Biquad {
  constructor(type, f, q, sr, gainDb = 0) { this.sr = sr; this.x1 = this.x2 = this.y1 = this.y2 = 0; this.set(type, f, q, gainDb); }
  set(type, f, q, gainDb = 0) {
    const w = 2 * Math.PI * clamp(f, 5, this.sr * 0.49) / this.sr, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q), A = Math.pow(10, gainDb / 40); let b0, b1, b2, a0, a1, a2;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; a0 = 1 + al; a1 = -2 * c; a2 = 1 - al; }
    else { b0 = 1 + al * A; b1 = -2 * c; b2 = 1 - al * A; a0 = 1 + al / A; a1 = -2 * c; a2 = 1 - al / A; } // peak
    this.b0 = b0 / a0; this.b1 = b1 / a0; this.b2 = b2 / a0; this.a1 = a1 / a0; this.a2 = a2 / a0;
  }
  tick(x) { const y = this.b0 * x + this.b1 * this.x1 + this.b2 * this.x2 - this.a1 * this.y1 - this.a2 * this.y2; this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y; return y; }
  run(buf) { for (let i = 0; i < buf.length; i++) buf[i] = this.tick(buf[i]); return buf; }
}

// State-variable filter (Chamberlin, 2x oversampled) for swept filters: lowpass, bandpass and highpass outputs at once.
export class SVF {
  constructor(sr) { this.sr = sr; this.lo = this.bp = 0; }
  tick(x, f, q) { const F = 2 * Math.sin(Math.PI * Math.min(f, this.sr / 6) / (2 * this.sr)), d = 1 / q; let hp;
    for (let k = 0; k < 2; k++) { this.lo += F * this.bp; hp = x - this.lo - d * this.bp; this.bp += F * hp; } return { lo: this.lo, bp: this.bp, hp }; }
}

// Envelopes. adsr returns gain at time t (s) for a note held `hold` seconds.
export function adsr(t, hold, { a = 0.005, d = 0.2, s = 0.6, r = 0.3 } = {}) {
  if (t < 0) return 0; const held = t < a ? t / a : t < a + d ? 1 - (1 - s) * ((t - a) / d) : s;
  if (t < hold) return held; const at = Math.min(held, hold < a ? hold / a : hold < a + d ? 1 - (1 - s) * ((hold - a) / d) : s); return at * Math.exp(-(t - hold) * 6.9 / Math.max(0.001, r));
}
export const expDecay = (t, tau) => (t < 0 ? 0 : Math.exp(-t / tau));

// Saturation, with a simple 2x oversample (linear up, half-band average down) to keep aliasing down on bright input.
export function softclip(buf, drive = 1, { asym = 0 } = {}) {
  const n = Math.tanh(drive); let prev = 0;
  for (let i = 0; i < buf.length; i++) { const x = buf[i], mid = (prev + x) / 2; const f = (v) => Math.tanh(drive * (v + asym * v * v)) / n; buf[i] = 0.5 * (f(mid) + f(x)); prev = x; }
  return buf;
}

// Band-limited saw by additive partials (exact below Nyquist), cached per frequency bucket. Used by pads.
const sawCache = new Map();
export function sawTable(f, sr, size = 2048) {
  const key = `${sr}:${Math.round(12 * Math.log2(f / 55))}`; if (sawCache.has(key)) return sawCache.get(key);
  const t = new Float32Array(size), H = Math.max(1, Math.floor(sr / 2 / (f * 1.06)));
  for (let h = 1; h <= H; h++) { const a = 1 / h * (h > H * 0.7 ? Math.cos((h - H * 0.7) / (H * 0.3) * Math.PI / 2) ** 2 : 1); for (let i = 0; i < size; i++) t[i] += a * Math.sin(2 * Math.PI * h * i / size); }
  let pk = 0; for (const v of t) pk = Math.max(pk, Math.abs(v)); for (let i = 0; i < size; i++) t[i] /= pk; sawCache.set(key, t); return t;
}
export function tableRead(t, ph) { const n = t.length, x = (ph - Math.floor(ph)) * n, i = x | 0, f = x - i; return t[i] + (t[(i + 1) % n] - t[i]) * f; }

// A fractional delay line with linear interpolation, for waveguides and choruses.
export class Delay {
  constructor(maxSamples) { this.b = new Float32Array(maxSamples + 2); this.w = 0; }
  write(x) { this.b[this.w] = x; this.w = (this.w + 1) % this.b.length; }
  read(d) { const n = this.b.length, p = this.w - 1 - d, i = Math.floor(p), f = p - i, a = this.b[((i % n) + n) % n], b = this.b[(((i + 1) % n) + n) % n]; return a + (b - a) * f; }
}

// Mix a mono note into a stereo pair with constant-power pan.
export function panInto(L, R, src, at, pan = 0, gain = 1) {
  const a = (clamp(pan, -1, 1) + 1) * Math.PI / 4, gl = Math.cos(a) * gain, gr = Math.sin(a) * gain;
  for (let i = 0; i < src.length && at + i < L.length; i++) { if (at + i < 0) continue; L[at + i] += src[i] * gl; R[at + i] += src[i] * gr; }
}

// Fade the ends so no note starts or stops on a step.
export function edges(buf, sr, a = 0.002, r = 0.01) { const na = Math.floor(a * sr), nr = Math.floor(r * sr), n = buf.length;
  for (let i = 0; i < na && i < n; i++) buf[i] *= i / na; for (let i = 0; i < nr && i < n; i++) buf[n - 1 - i] *= i / nr; return buf; }
