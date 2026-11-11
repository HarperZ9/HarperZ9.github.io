// voices.js: three voices the lounge pieces needed and the engine's v3 set did not have in this form. All are pure DSP
// (they write samples into Float32Arrays, like world/sound/sound/v3/instruments), so they render the same in Node, in a
// worker and in tests. Composed and synthesized here; no recording is sampled.
//   tine       an electric piano after the tine-and-pickup instruments: a 1:1 FM body whose brightness falls after the
//              strike, a short high "tine" partial (a 1:14 FM pair), two copies a few cents apart for slow movement, a
//              damper on release (with the small noise of the felt landing), and a DC blocker after the pickup's
//              asymmetry. The bell and the bark both grow with velocity. The FM index stays under about 1.3, where
//              the fundamental is still the strongest partial; above that the note thins out and reads an octave high. The engine's keys.note has the body
//              and a fixed bark partial; it leaves a DC offset from its squared term and has no detune or damper.
//   softBass   a plucked upright-style bass: eight partials shaped by where the string is plucked, upper partials dying
//              first, a short scoop into the pitch and a soft finger noise. The engine's bass is an 808, which is the
//              wrong instrument for this idiom.
//   brush      a brushed kit: the sweep (a brush drawn in a circle on the snare head), the tap, a quiet ride cymbal,
//              a feathered kick and a pedal hi-hat. The engine's funk kit hits with sticks.
import { mtof, rng, velocity, expDecay, edges, Biquad, clamp } from '../../world/sound/sound/v3/instruments/core.js';

export const TINE = { bell: 0.55, tine: 1, decay: 2.2, drive: 0.4, tone: 5600, detune: 2.5, release: 1 };

export function tine(m, vel, dur, p = TINE, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), f = mtof(m), len = Math.floor((dur + 0.45) * sr), x = new Float32Array(len), r = rng(seed * 7919 + Math.round(m * 31));
  const track = Math.min(1, 196 / f), I0 = (0.5 + 1.8 * p.bell) * V.bright * (0.4 + 0.6 * track), tau = p.decay * (0.4 + 0.9 * track), tineOn = 14 * f < sr * 0.42;
  const w = 2 * Math.PI * f / sr, d = Math.pow(2, p.detune / 1200), lp = new Biquad('lp', p.tone * (0.55 + 0.45 * V.bright), 0.6, sr), thump = new Biquad('lp', 500, 0.7, sr), damper = new Biquad('bp', 900, 1, sr);
  let a = r() * 6.28, b = r() * 6.28, hp1 = 0, hpy = 0; const k = Math.exp(-2 * Math.PI * 18 / sr);
  for (let i = 0; i < len; i++) {
    const t = i / sr, held = t < dur ? 1 : expDecay(t - dur, 0.07), I = I0 * (0.36 + 0.64 * expDecay(t, 0.35)) + 0.1, env = expDecay(t, tau) * held * Math.min(1, t / 0.002);
    a += w; b += w * d;
    let y = 0.8 * Math.sin(a + I * Math.sin(a)) + 0.2 * Math.sin(b + I * Math.sin(b));   // the quiet copy moves the tone without ever cancelling the fundamental
    if (tineOn) y += p.tine * 0.55 * V.bright * V.bright * Math.sin(a + 0.9 * V.bright * expDecay(t, 0.05) * Math.sin(14 * a)) * expDecay(t, 0.07 + 0.09 * V.bright);   // the bell: clearer and longer the harder the key is struck
    const nz = r() * 2 - 1; y = y * env + 0.12 * V.bright * thump.tick(nz) * expDecay(t, 0.004);
    if (t >= dur) y += 0.05 * (p.release ?? 1) * V.bright * damper.tick(nz) * expDecay(t - dur, 0.012);   // the damper falling back on the tine
    y = Math.tanh((y + p.drive * (0.8 + 0.8 * V.bright) * y * y) * (1.1 + p.drive));   // the pickup: off-axis, so even harmonics rise with level
    const o = y - hp1 + k * hpy; hp1 = y; hpy = o;             // DC blocker at 18 Hz
    x[i] = lp.tick(o);
  }
  const g = V.gain * 0.5; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.001, 0.03);
}

export function softBass(m, vel, dur, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.3 }), f0 = mtof(m), len = Math.floor((dur + 0.25) * sr), x = new Float32Array(len), r = rng(seed * 104729 + Math.round(m * 17));
  const H = [], pluck = 0.21 * (0.85 + 0.3 * r()); for (let h = 1; h <= 8 && h * f0 < 2400; h++) H.push({ h, a: Math.abs(Math.sin(Math.PI * h * pluck)) / Math.pow(h, 1.25) * (h > 1 ? 0.5 + 0.5 * V.bright : 1) * Math.pow(10, (r() - 0.5) * 3 / 20), tau: 1.9 / (1 + 0.45 * Math.pow(h - 1, 1.2)), ph: (r() - 0.5) * 0.9 });   // no two plucks land in the same place
  const lp = new Biquad('lp', 900 + 1300 * V.bright, 0.7, sr), fn = new Biquad('bp', 700, 1.2, sr);
  for (let i = 0; i < len; i++) {
    const t = i / sr, f = f0 * Math.pow(2, -0.25 * expDecay(t, 0.025) / 12), env = Math.min(1, t / 0.006) * (t < dur ? 1 : expDecay(t - dur, 0.06)); let y = 0;
    for (const q of H) { q.ph += 2 * Math.PI * f * q.h / sr; y += q.a * Math.sin(q.ph) * expDecay(t, q.tau); }
    x[i] = lp.tick(Math.tanh(1.4 * y * env) + 0.25 * V.bright * fn.tick(r() * 2 - 1) * expDecay(t, 0.006));
  }
  const g = V.gain * 0.6; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.001, 0.02);
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
