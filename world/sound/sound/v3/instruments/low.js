// The 808 and the industrial textures, as pure-DSP instruments so they also run outside the browser.
//   b808: a sine with a pitch drop and a glide path, a clean sub kept under 110 Hz, and a driven copy through a band-pass that
//         sweeps, so the distortion's overtones move (the v3 grit 808, written sample by sample)
//   metal: struck modal metal, inharmonic partials with their own decays plus a noise strike; a seeded 'object' picks the ratios
import { mtof, rng, velocity, Biquad, SVF, expDecay, edges } from './core.js';

export const meta808 = {
  id: 'b808', title: '808 with moving harmonics', kind: 'bass',
  params: { drive: { min: 1, max: 12, default: 4 }, harm: { min: 0, max: 1, default: 0.45 }, glide: { min: 0.02, max: 0.6, default: 0.2, unit: 's' },
    decay: { min: 0.3, max: 3, default: 1.2, unit: 's' }, sweepLo: { min: 100, max: 600, default: 180, unit: 'Hz' }, sweepHi: { min: 400, max: 3000, default: 1300, unit: 'Hz' }, drop: { min: 0, max: 24, default: 9, unit: 'semitones' } },
  presets: {
    'dmv-slide': { drive: 5, harm: 0.5, glide: 0.18, decay: 1.4, sweepLo: 180, sweepHi: 1400, drop: 9 },
    'deep-clean': { drive: 1.5, harm: 0.15, glide: 0.25, decay: 1.8, sweepLo: 140, sweepHi: 500, drop: 5 },
    'furnace': { drive: 10, harm: 0.8, glide: 0.3, decay: 1.1, sweepLo: 220, sweepHi: 2200, drop: 14 },
  },
};

export function b808(m, vel, dur, p, { path = [], sr = 48000 } = {}) {
  const V = velocity(vel, { curve: 1.2 }), len = Math.floor((dur + 0.2) * sr), x = new Float32Array(len), f0 = mtof(m);
  const sub = new Biquad('lp', 110, 0.7, sr), svf = new SVF(sr), lp = new Biquad('lp', 5000, 0.6, sr), pts = path.map(([t, mm]) => [t, mtof(mm)]);
  let ph = 0, cur = f0;
  for (let i = 0; i < len; i++) {
    const t = i / sr; let target = f0; for (const [pt, f] of pts) if (t >= pt - p.glide) { const u = Math.min(1, (t - (pt - p.glide)) / p.glide); target = cur * Math.pow(f / cur, u); if (u >= 1) cur = f; }
    const f = target * (1 + (Math.pow(2, p.drop / 12) - 1) * expDecay(t, 0.012));
    ph += 2 * Math.PI * f / sr; const env = Math.min(1, t / 0.004) * (0.4 + 0.6 * expDecay(t, p.decay * 0.5)) * (t < dur ? 1 : expDecay(t - dur, 0.05));
    const s = Math.sin(ph) * env, u = t / Math.max(0.05, dur), fc = p.sweepLo * Math.pow(p.sweepHi / p.sweepLo, u < 0.55 ? u / 0.55 : (1 - u) / 0.45);
    const d = Math.tanh(p.drive * s), h = svf.tick(d, Math.max(60, fc), 1.4).bp;
    x[i] = sub.tick(s) * 0.9 + lp.tick(h) * p.harm;
  }
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); for (let i = 0; i < len; i++) x[i] *= pk ? 0.85 * V.gain / pk : 0; return edges(x, sr, 0.0005, 0.02);
}

export const metaMetal = {
  id: 'metal', title: 'Struck metal (modal)', kind: 'percussion',
  params: { size: { min: 0.3, max: 3, default: 1, doc: 'lower and longer as it grows' }, damp: { min: 0.1, max: 1, default: 0.4 }, partials: { min: 4, max: 16, default: 9 },
    strike: { min: 0, max: 1, default: 0.5, doc: 'noise in the hit' }, object: { min: 1, max: 99, default: 7, doc: 'seed for the partial ratios' } },
  presets: { anvil: { size: 0.8, damp: 0.3, partials: 10, strike: 0.6, object: 7 }, pipe: { size: 1.6, damp: 0.2, partials: 7, strike: 0.3, object: 23 }, 'sheet-scrape': { size: 2.4, damp: 0.7, partials: 14, strike: 0.9, object: 41 } },
};

export function metal(vel, p, sr = 48000) {
  const V = velocity(vel), r = rng(Math.round(p.object)), base = 420 / p.size, modes = [];
  for (let k = 0; k < p.partials; k++) { const ratio = k === 0 ? 1 : 1 + k * (1.3 + r() * 1.4) + r() * 0.5; if (base * ratio < 16000) modes.push({ f: base * ratio, a: 1 / (1 + k * 0.6) * (0.6 + 0.4 * r()), tau: (1.6 * p.size / (1 + k * 0.5)) * (1.2 - p.damp) }); }
  const len = Math.floor(Math.min(4, Math.max(...modes.map((m) => m.tau)) * 5) * sr), x = new Float32Array(len), bp = new Biquad('hp', 900, 0.7, sr);
  for (let i = 0; i < len; i++) { const t = i / sr; let s = 0; for (const m of modes) s += m.a * Math.sin(2 * Math.PI * m.f * t) * Math.exp(-t / m.tau); x[i] = s + p.strike * V.bright * bp.tick(r() * 2 - 1) * Math.exp(-t / 0.006); }
  let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); for (let i = 0; i < len; i++) x[i] *= pk ? 0.7 * V.gain / pk : 0; return edges(x, sr, 0.0003, 0.05);
}
