// bassguitar.js: an electric bass guitar played with the fingers, and a sub bass.
// The bass guitar is a plucked steel string heard through a pickup. Twenty partials, each a little sharper than a whole
// multiple of the fundamental because a stiff string is not ideal (inharmonicity), shaped twice by a comb: once by where
// the finger plucks and once by where the pickup sits. High partials die first. Four ways to play a note:
//   finger   the plain note: round, with a soft click from the fingertip
//   ghost    a muted note: the left hand rests on the string, so it thumps and is gone in a tenth of a second
//   pop      the string pulled and let go against the frets: bright, hard-edged, usually an octave up
//   slap     the thumb strikes the string: a click and a strong low end
// slideFrom (a MIDI note) starts the pitch there and glides to the note over 70 ms, as a finger slides along the string.
// The sub is the opposite voice: one sine and a trace of its second harmonic, slow to start and stop, for the bottom
// octave only.
import { mtof, rng, velocity, expDecay, edges, Biquad } from '../../world/sound/sound/v3/instruments/core.js';

const STYLE = { finger: { bright: 0.8, tau: 2.2, click: 0.16, gain: 0.6 }, ghost: { bright: 0.25, tau: 0.035, click: 0.3, gain: 0.5 }, pop: { bright: 1.25, tau: 1.1, click: 0.45, gain: 0.55 }, slap: { bright: 1.05, tau: 1.6, click: 1.1, gain: 0.62 } };

export function bassGuitar(m, vel, dur, { style = 'finger', slideFrom = null } = {}, sr = 48000, seed = 1) {
  const S = STYLE[style] || STYLE.finger, V = velocity(vel, { curve: 1.3 }), f0 = mtof(m), hold = style === 'ghost' ? Math.min(dur, 0.07) : dur, len = Math.floor((hold + 0.2) * sr), x = new Float32Array(len), r = rng(seed * 7001 + Math.round(m * 29));
  const pluck = style === 'pop' ? 0.08 : 0.17, pickup = 0.13, B = 0.00012, bright = S.bright * (0.6 + 0.4 * V.bright), H = [];
  for (let h = 1; h <= 20 && h * f0 < 5200; h++) H.push({ k: h * Math.sqrt(1 + B * h * h), a: Math.abs(Math.sin(Math.PI * h * pluck) * Math.sin(Math.PI * h * pickup)) / Math.pow(h, 1.9 - 0.9 * bright) * (h === 1 ? 1.6 : 1), tau: S.tau / (1 + 0.22 * Math.pow(h - 1, 1.15)), ph: 0 });
  const click = new Biquad('bp', style === 'slap' || style === 'pop' ? 2600 : 1400, 0.9, sr), lp = new Biquad('lp', 1800 + 3800 * bright, 0.7, sr), from = slideFrom === null ? f0 : mtof(slideFrom);
  for (let i = 0; i < len; i++) {
    const t = i / sr, f = f0 * Math.pow(from / f0, expDecay(t, 0.025)), env = Math.min(1, t / 0.003) * (t < hold ? 1 : expDecay(t - hold, style === 'ghost' ? 0.012 : 0.045)); let y = 0;
    for (const q of H) { q.ph += 2 * Math.PI * f * q.k / sr; y += q.a * Math.sin(q.ph) * expDecay(t, q.tau); }
    x[i] = lp.tick(Math.tanh(1.2 * y) * env + S.click * V.bright * click.tick(r() * 2 - 1) * expDecay(t, 0.004));
  }
  new Biquad('hp', 24, 0.7, sr).run(x);   // every partial starts at the same phase, which leaves a small offset; this takes it out
  const g = V.gain * S.gain; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.0008, 0.015);
}

export function sub(m, vel, dur, { slideFrom = null } = {}, sr = 48000) {
  const V = velocity(vel, { curve: 1.2 }), f0 = mtof(m), len = Math.floor((dur + 0.25) * sr), x = new Float32Array(len), from = slideFrom === null ? f0 : mtof(slideFrom); let ph = 0;
  for (let i = 0; i < len; i++) { const t = i / sr, f = f0 * Math.pow(from / f0, expDecay(t, 0.05)); ph += 2 * Math.PI * f / sr;
    x[i] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.min(1, t / 0.02) * (t < dur ? 1 : expDecay(t - dur, 0.07)) * (0.75 + 0.25 * expDecay(t, 1.2)); }
  const g = V.gain * 0.55; for (let i = 0; i < len; i++) x[i] = Math.tanh(1.1 * x[i]) * g; return edges(x, sr, 0.002, 0.03);
}
