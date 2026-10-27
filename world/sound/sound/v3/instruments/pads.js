// Long atmospheric pads with movement: several band-limited saws per note, detuned and spread, through a state-variable
// filter that drifts on two slow, unrelated LFOs; a slow swell; a chorus made of two modulated delays. The motion never
// repeats exactly within a phrase because the two LFO rates are not in a simple ratio.
import { mtof, rng, velocity, SVF, sawTable, tableRead, Delay, edges } from './core.js';

export const meta = {
  id: 'pads', title: 'Atmospheric pad', kind: 'pad',
  params: {
    voices: { min: 1, max: 7, default: 5, unit: 'saws per note' }, detune: { min: 0, max: 30, default: 11, unit: 'cents' }, cutoff: { min: 300, max: 6000, default: 1400, unit: 'Hz' },
    motion: { min: 0, max: 1, default: 0.5, doc: 'filter drift depth' }, reso: { min: 0.5, max: 6, default: 1.2 }, attack: { min: 0.05, max: 6, default: 2.2, unit: 's' },
    release: { min: 0.2, max: 8, default: 3, unit: 's' }, chorus: { min: 0, max: 1, default: 0.5 }, air: { min: 0, max: 1, default: 0.2, doc: 'filtered noise breath' },
  },
  presets: {
    'atlantic-drift': { voices: 6, detune: 13, cutoff: 1800, motion: 0.6, reso: 1.4, attack: 3, release: 4, chorus: 0.6, air: 0.25 },
    'night-glass': { voices: 4, detune: 7, cutoff: 3200, motion: 0.4, reso: 2.2, attack: 1.2, release: 2.5, chorus: 0.4, air: 0.1 },
    'low-cathedral': { voices: 7, detune: 18, cutoff: 900, motion: 0.7, reso: 1, attack: 4.5, release: 6, chorus: 0.7, air: 0.35 },
  },
};

export function chord(notes, vel, dur, p, sr = 48000, seed = 5) {
  const V = velocity(vel, { curve: 1.2 }), r = rng(seed), len = Math.floor((dur + p.release) * sr), L = new Float32Array(len), R = new Float32Array(len);
  const osc = []; for (const m of notes) for (let k = 0; k < p.voices; k++) { const c = p.voices === 1 ? 0 : (k / (p.voices - 1) - 0.5) * 2 * p.detune, f = mtof(m) * Math.pow(2, c / 1200);
    osc.push({ f, t: sawTable(f, sr), ph: r(), pan: p.voices === 1 ? 0 : (k / (p.voices - 1) - 0.5) * 1.6 }); }
  const fl = new SVF(sr), fr = new SVF(sr), l1 = 0.07 + r() * 0.03, l2 = 0.031 + r() * 0.02, norm = 1 / Math.sqrt(osc.length);
  for (let i = 0; i < len; i++) {
    const t = i / sr, env = Math.min(1, t / p.attack) ** 2 * (t < dur ? 1 : Math.exp(-(t - dur) * 4.6 / p.release));
    let a = 0, b = 0; for (const o of osc) { const v = tableRead(o.t, o.ph); o.ph += o.f / sr; a += v * (1 - o.pan) * 0.5; b += v * (1 + o.pan) * 0.5; }
    const fc = p.cutoff * Math.pow(2, p.motion * (1.1 * Math.sin(2 * Math.PI * l1 * t) + 0.7 * Math.sin(2 * Math.PI * l2 * t + 1.3)));
    const n = p.air * (r() * 2 - 1) * 0.15;
    L[i] = fl.tick(a * norm + n, fc, p.reso).lo * env; R[i] = fr.tick(b * norm + n, fc * 1.02, p.reso).lo * env;
  }
  if (p.chorus > 0) { const dl = new Delay(Math.ceil(0.04 * sr)), dr = new Delay(Math.ceil(0.04 * sr));
    for (let i = 0; i < len; i++) { const t = i / sr, ml = (0.012 + 0.004 * Math.sin(2 * Math.PI * 0.27 * t)) * sr, mr = (0.014 + 0.004 * Math.sin(2 * Math.PI * 0.21 * t + 2)) * sr;
      dl.write(L[i]); dr.write(R[i]); L[i] += p.chorus * 0.5 * dr.read(mr); R[i] += p.chorus * 0.5 * dl.read(ml); } }
  let pk = 0; for (let i = 0; i < len; i++) pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); const g = pk ? 0.5 * V.gain / pk : 0;
  for (let i = 0; i < len; i++) { L[i] *= g; R[i] *= g; } edges(L, sr, 0.005, 0.05); edges(R, sr, 0.005, 0.05);
  return { L, R, sr, seconds: len / sr };
}
