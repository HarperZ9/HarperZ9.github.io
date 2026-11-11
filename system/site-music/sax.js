// sax.js: a saxophone-family voice, beside the engine's clarinet-like reed.
// A clarinet's bore is a cylinder closed at the reed: it favours odd harmonics and sounds an octave below a cone of the
// same length. A saxophone's bore is a cone, and a cone closed at its narrow end resonates like a string fixed at both
// ends: every harmonic, odd and even. Dalmont, Gilbert and Kergomard ("Reed instruments, from small to large amplitude
// periodic oscillations and the Helmholtz motion analogy", Acta Acustica 86, 2000) showed that a reed on a cone moves like
// a bowed string, with the reed's place along the bore standing in for the bow's place along the string. Scavone and Cook
// built a waveguide on that idea (the "Saxofony" instrument in their Synthesis ToolKit); this file is our own writing of
// the same structure from the description: one loop a full wavelength long, split in two delay lines at the reed's
// position, a lossy reflection at the bell, and a reed that lets breath in according to the pressure across it.
//   breath    blowing pressure; louder notes are brighter because the reed closes harder
//   noise     turbulence in the mouthpiece, low-passed and scaled by the breath
//   vibrato   enters late in a held note and widens, as a player's does
//   scoop     the note starts flat and bends up into pitch
// The loop length that gives a wanted pitch was found by measuring the rendered pitch with the ear (sax tests).
import { mtof, rng, velocity, Delay, Biquad, edges, clamp } from '../../world/sound/sound/v3/instruments/core.js';

export const SAX = { breath: 0.62, noise: 0.1, vibrato: 0.011, vibRate: 5, vibDelay: 0.45, scoop: 0.6, reed: 0.3, position: 0.4, tone: 3800, body: 4 };
export const TRIM = { a: 3.0, b: 0 };   // loop samples taken off for the filters in the loop; set by measurement

export function sax(m, vel, dur, p = SAX, sr = 48000, seed = 3) {
  const q = { ...SAX, ...p }, V = velocity(vel, { curve: 1.3 }), r = rng(seed * 2971 + Math.round(m * 13)), f0 = mtof(m), len = Math.floor((dur + 0.3) * sr), x = new Float32Array(len), air = new Float32Array(len);
  const max = Math.ceil(sr / mtof(m - 4)) + 16, d0 = new Delay(max), d1 = new Delay(max), nz = new Biquad('lp', 2800, 0.7, sr), tone = new Biquad('lp', q.tone * (0.55 + 0.45 * V.bright), 0.7, sr), body = new Biquad('peak', 1150, 1.1, sr, q.body), hp = new Biquad('hp', 60, 0.7, sr);
  const pmax = (0.5 + 0.45 * q.breath) * (0.7 + 0.4 * V.bright); let lp = 0;
  for (let i = 0; i < len; i++) {
    const t = i / sr, att = Math.min(1, t / 0.05), rel = t < dur ? 1 : Math.exp(-(t - dur) * 22);
    const vib = q.vibrato * Math.min(1, Math.max(0, (t - q.vibDelay) / 0.7)) * (1 + 0.6 * Math.min(1, t / 2.5)), f = f0 * Math.pow(2, -q.scoop * Math.exp(-t / 0.06) / 12) * (1 + vib * Math.sin(2 * Math.PI * q.vibRate * t));
    const noiseNow = r() * 2 - 1, N = sr / f - TRIM.a - TRIM.b * f / 1000, breath = pmax * att * rel * (1 + q.noise * 2.5 * nz.tick(noiseNow));
    const back = d0.read((1 - q.position) * N); lp = 0.5 * (back + lp);                         // the bell: a lossy, inverting reflection
    const bell = -0.95 * lp, at = bell - d1.read(q.position * N), pd = breath - at;              // pressure at the reed, and across it
    d1.write(bell); d0.write(breath - pd * clamp(0.7 + q.reed * pd, -1, 1) - bell);
    air[i] = noiseNow * att * rel; x[i] = lp;                                                                                   // heard at the bell, where every harmonic of the loop arrives
  }
  hp.run(x);
  // blown harder, the reed beats against the mouthpiece and the tone gains edge: a soft clip whose drive rises with velocity
  { let top = 0; for (let i = Math.floor(0.05 * sr); i < len; i++) top = Math.max(top, Math.abs(x[i])); const d = 0.6 + 3.2 * V.bright * V.bright, n = Math.tanh(d); if (top) for (let i = 0; i < len; i++) { const u = clamp(x[i] / top, -1.5, 1.5); x[i] = Math.tanh(d * (u + 0.15 * u * u)) / n; } }
  hp.run(x); body.run(x); tone.run(x);
  let pk = 0; for (let i = Math.floor(0.05 * sr); i < len; i++) pk = Math.max(pk, Math.abs(x[i])); const g = pk ? 0.6 * V.gain / pk : 0;
  // the breath itself, heard beside the tone: air leaving the mouthpiece and the keys, a band of hiss from 2.5 kHz up
  new Biquad('hp', 2500, 0.7, sr).run(air); new Biquad('lp', 9000, 0.7, sr).run(air);
  for (let i = 0; i < len; i++) x[i] = clamp(x[i] * g + 0.05 * q.noise * V.gain * air[i], -1, 1);
  return edges(x, sr, 0.004, 0.05);
}
