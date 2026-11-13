// voices.js: three voices the lounge pieces needed and the engine's v3 set did not have in this form. All are pure DSP
// (they write samples into Float32Arrays, like world/sound/sound/v3/instruments), so they render the same in Node, in a
// worker and in tests. Composed and synthesized here; no recording is played back. The pitched voices read tables of numbers measured from
// recordings of real instruments (measured-data.js names each source and licence).
//   tine       an electric piano of the tine kind over the measured layer (measured.js, plucked.js): partial levels and
//              decay rates measured from single notes of a 1977 Rhodes Mark I (Discord SFZ GM Bank, CC0, recorded by Jeff
//              Learman), with the hammer's thump and a damper on release. The reference holds one strength per key, so
//              how the tone brightens with a harder strike is this file's own rule (a tilt of the measured levels), not
//              a measurement. Before round four it was an FM pair tuned by ear-less guesswork, and the ear's identity
//              judge heard it as an electric piano in one note of seven.
//   (the upright bass moved to upright.js in round five)
//   brush      a brushed kit: the sweep (a brush drawn in a circle on the snare head), the tap, a quiet ride cymbal,
//              a feathered kick and a pedal hi-hat. The engine's funk kit hits with sticks.
import { mtof, rng, velocity, expDecay, edges, Biquad, clamp } from '../../world/sound/sound/v3/instruments/core.js';
import { plucked } from './plucked.js';
import { TABLES } from './measured.js';

export const TINE = { bell: 0.55, decay: 2.2, tone: 5600, release: 1 };
const TINE_GAIN = 0.346, MEASURED_AT = 0.7, TINE_EARLY = 0;   // TINE_EARLY: how much of the measured early decay (dec0) to use; 0 keeps round four's single rate, so the strike's brightness with velocity survives the first 200 ms   // the reference notes were struck at one strength, about this velocity

export function tine(m, vel, dur, p = TINE, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), r = rng(seed * 7919 + Math.round(m * 31)), at = velocity(MEASURED_AT, { curve: 1.4 }), tilt = 9 * (V.bright - at.bright) * (0.5 + p.bell);
  const x = plucked(TABLES.epiano, m, MEASURED_AT, dur, { release: 0.07, attack: 0.002, tilt, ring: 2.2 / p.decay, spread: 1, beat: 0.05, tail: 0.45, kmax: 40, early: TINE_EARLY }, sr, seed), len = x.length;
  const lp = new Biquad('lp', p.tone * (0.55 + 0.45 * V.bright), 0.6, sr), thump = new Biquad('lp', 500, 0.7, sr), damper = new Biquad('bp', 900, 1, sr);
  for (let i = 0; i < len; i++) { const t = i / sr, nz = r() * 2 - 1; let y = x[i] + 0.15 * V.bright * thump.tick(nz) * expDecay(t, 0.004);   // the hammer's thump
    if (t >= dur) y += 0.2 * (p.release ?? 1) * V.bright * damper.tick(nz) * expDecay(t - dur, 0.012);   // the damper falling back on the tine
    x[i] = lp.tick(y); }
  const g = V.gain * TINE_GAIN; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.001, 0.03);
}

const RIDE = [1, 1.47, 2.09, 2.56, 3.14, 3.93, 4.71, 5.62, 6.83, 8.21];   // our own inharmonic ratios for a small dark ride
export const brush = {
  // a brush drawn across the head: band-limited noise that swells and falls twice, never a hard edge
  sweep(dur, vel, sr = 48000, seed = 1) {
    const V = velocity(vel, { curve: 1.2 }), len = Math.floor(dur * sr), x = new Float32Array(len), r = rng(seed * 31 + 5), bp = new Biquad('bp', 2400, 0.45, sr), hp = new Biquad('hp', 700, 0.7, sr), lp = new Biquad('lp', 6500, 0.6, sr);
    for (let i = 0; i < len; i++) { const u = i / len, env = Math.pow(Math.sin(Math.PI * u), 0.8) * (0.62 + 0.38 * Math.cos(4 * Math.PI * u - 0.6)); x[i] = lp.tick(hp.tick(bp.tick(r() * 2 - 1))) * env; }
    const g = V.gain * 0.5; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.01, 0.02);
  },
  // a brush tap: a short noise burst with a little of the shell under it; soft taps are darker
  tap(vel, sr = 48000, seed = 1) {
    const V = velocity(vel, { curve: 1.4 }), len = Math.floor(0.22 * sr), x = new Float32Array(len), r = rng(seed * 17 + 3), bp = new Biquad('bp', 1900 + 1500 * V.bright, 0.7, sr), lp = new Biquad('lp', 3000 + 5000 * V.bright, 0.6, sr); let ph = 0;
    for (let i = 0; i < len; i++) { const t = i / sr; ph += 2 * Math.PI * 188 / sr; x[i] = lp.tick(bp.tick(r() * 2 - 1)) * 2.2 * expDecay(t, 0.03 + 0.03 * V.bright) + 0.22 * Math.sin(ph) * expDecay(t, 0.05); }
    let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); const g = V.gain * 0.55 / (pk || 1); for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.0005, 0.02);
  },
  // a small dark ride: noise ringing through ten narrow resonators, plus the stick's ping. Driving the resonators with noise
  // (and not adding fixed sine partials) keeps the cymbal from reading as a held chord when it is struck on every beat.
  ride(vel, sr = 48000, seed = 1) {
    const V = velocity(vel, { curve: 1.3 }), len = Math.floor(1.1 * sr), x = new Float32Array(len), r = rng(seed * 13 + 1), hp = new Biquad('hp', 5200, 0.7, sr);
    const res = RIDE.map((q, k) => ({ f: new Biquad('bp', 1040 * q * (1 + 0.012 * (r() - 0.5)), 28 + 4 * k, sr), g: 1 / (1 + 0.2 * k), tau: 0.5 / (1 + 0.1 * k) }));
    for (let i = 0; i < len; i++) { const t = i / sr, n = r() * 2 - 1, strike = expDecay(t, 0.012) + 0.08 * expDecay(t, 0.4); let s = 0; for (const q of res) s += q.f.tick(n * strike) * q.g * (0.5 + 0.5 * expDecay(t, q.tau));
      x[i] = s * 6 + hp.tick(n) * (0.5 * expDecay(t, 0.006) * V.bright + 0.06 * expDecay(t, 0.3)); }
    new Biquad('lp', 5000 + 4500 * V.bright, 0.6, sr).run(x); new Biquad('hp', 900, 0.7, sr).run(x);
    let pk = 0; for (const v of x) pk = Math.max(pk, Math.abs(v)); const g = V.gain * 0.42 / (pk || 1); for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.0005, 0.05);
  },
  kick(vel, sr = 48000) {
    const V = velocity(vel, { curve: 1.3 }), len = Math.floor(0.4 * sr), x = new Float32Array(len); let ph = 0;
    for (let i = 0; i < len; i++) { const t = i / sr; ph += 2 * Math.PI * 50 * (1 + 0.9 * expDecay(t, 0.018)) / sr; x[i] = Math.sin(ph) * expDecay(t, 0.11) * Math.min(1, t / 0.003); }
    new Biquad('lp', 700 + 900 * V.bright, 0.7, sr).run(x); const g = V.gain * 0.8; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.001, 0.03);
  },
  pedal(vel, sr = 48000, seed = 1) {
    const V = velocity(vel), len = Math.floor(0.12 * sr), x = new Float32Array(len), r = rng(seed * 11 + 2), hp = new Biquad('hp', 6000, 0.8, sr), lp = new Biquad('lp', 11000, 0.6, sr);
    for (let i = 0; i < len; i++) x[i] = lp.tick(hp.tick(r() * 2 - 1)) * expDecay(i / sr, 0.022);
    const g = V.gain * 0.3; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.0005, 0.01);
  },
};
export { clamp };
