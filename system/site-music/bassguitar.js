// bassguitar.js: an electric bass guitar played with the fingers, through an amplifier, and a sub bass.
// The string. A plucked steel string heard through a pickup: twenty partials, each a little sharper than a whole multiple
// of the fundamental because a stiff string is not ideal (inharmonicity, B about 1e-4 on a bass string; from memory),
// shaped by two combs, one from where the finger plucks and one from where the pickup sits. High partials die first.
// What makes it a played string and not a stamped one:
//   strings     four strings (E1, A1, D2, G2). A note is played on the lowest string that keeps the hand under the eighth
//               fret; a thicker string is darker, and a note high on a string rings shorter
//   the pluck   the string is sharp for a moment when it is let go (up to 20 cents on a hard note) and settles in 40 ms;
//               no two plucks land in the same place, so the comb, the phases and the partial levels move a little
//   level       a harder pluck is brighter, and can rattle against a fret for the first 30 ms
//   finger      plain note        ghost   muted with the left hand: a low thud, gone in 60 ms
//   pop         pulled and snapped: bright, hard-edged        slap    struck with the thumb: a click and a strong low end
//   hammer      the left hand lands a new note on a string already sounding: no new attack
//   slideFrom   the pitch starts on another note and glides over 70 ms while the string keeps sounding, with finger noise
// The amplifier. A compressor-like sustain (level over a threshold is halved in dB), a soft clip, then the cabinet: a
// gentle body around 140 Hz, a dip around 450 Hz and a top rolled off above 3.4 kHz.
// The sub is the opposite voice: one sine and a trace of its second harmonic, slow to start and stop.
import { mtof, rng, velocity, expDecay, edges, Biquad } from '../../world/sound/sound/v3/instruments/core.js';

const STYLE = { finger: { bright: 0.8, tau: 2.2, click: 0.16, gain: 0.62 }, ghost: { bright: 0.2, tau: 0.03, click: 0.35, gain: 0.5 }, pop: { bright: 1.25, tau: 1.1, click: 0.5, gain: 0.55 }, slap: { bright: 1.05, tau: 1.6, click: 1.1, gain: 0.62 }, hammer: { bright: 0.55, tau: 1.8, click: 0, gain: 0.5 } };
const OPEN = [28, 33, 38, 43];
export const stringFor = (m) => { let s = 0; while (s < 3 && m - OPEN[s] > 7) s++; return { string: s, fret: Math.max(0, m - OPEN[s]) }; };

export function bassGuitar(m, vel, dur, { style = 'finger', slideFrom = null } = {}, sr = 48000, seed = 1) {
  const S = STYLE[style] || STYLE.finger, V = velocity(vel, { curve: 1.3 }), ghost = style === 'ghost', f0 = mtof(m), hold = ghost ? Math.min(dur, 0.05) : dur, len = Math.floor((hold + 0.22) * sr), x = new Float32Array(len), r = rng(seed * 7001 + Math.round(m * 29) + 3);
  const { string, fret } = stringFor(m), pluck = (style === 'pop' ? 0.08 : 0.17) * (0.88 + 0.24 * r()), pickup = 0.13, B = 0.00012 * (1 + 0.25 * (1 - string / 3)), bright = S.bright * (0.15 + 1.0 * V.bright) * (0.86 + 0.07 * string), ring = S.tau * (1 - 0.035 * fret), H = [];
  for (let h = 1; h <= 20 && h * f0 < 5200; h++) H.push({ k: h * Math.sqrt(1 + B * h * h), a: Math.abs(Math.sin(Math.PI * h * pluck) * Math.sin(Math.PI * h * pickup)) / Math.pow(h, 1.95 - 0.95 * bright) * (h === 1 ? 1.6 : 1) * Math.pow(10, (r() - 0.5) * 3 / 20), tau: ring / (1 + 0.22 * Math.pow(h - 1, 1.15)), ph: (r() - 0.5) * 0.9 });
  const click = new Biquad('bp', style === 'slap' || style === 'pop' ? 2600 : 1400, 0.9, sr), squeak = new Biquad('bp', 2300, 3, sr), from = slideFrom === null ? f0 : mtof(slideFrom), sharp = (6 + 14 * vel * vel) * (style === 'hammer' ? 0 : 1), rattle = vel > 0.72 && !ghost && style !== 'hammer' ? (vel - 0.72) * 2.2 : 0, attack = style === 'hammer' ? 0.012 : 0.003;
  let follow = 0; const ka = 1 - Math.exp(-1 / (0.004 * sr)), kr = 1 - Math.exp(-1 / (0.09 * sr)), thr = 0.28;
  for (let i = 0; i < len; i++) {
    const t = i / sr, glide = expDecay(t, 0.025), f = (ghost ? 0.5 : 1) * f0 * Math.pow(from / f0, glide) * Math.pow(2, sharp * expDecay(t, 0.04) / 1200), env = Math.min(1, t / attack) * (t < hold ? 1 : expDecay(t - hold, ghost ? 0.01 : 0.045)); let y = 0;
    for (const q of H) { q.ph += 2 * Math.PI * f * q.k / sr; y += q.a * Math.sin(q.ph) * expDecay(t, q.tau); }
    const n = r() * 2 - 1; if (rattle) y *= 1 + rattle * expDecay(t, 0.03) * Math.sign(Math.sin(2 * Math.PI * 310 * t));   // the string chattering on a fret
    y = y * env + S.click * V.bright * click.tick(n) * expDecay(t, 0.004) + (slideFrom !== null ? 0.05 * squeak.tick(n) * glide * (1 - expDecay(t, 0.008)) : 0);
    const a = Math.abs(y); follow += (a > follow ? ka : kr) * (a - follow); x[i] = Math.tanh(1.3 * y * (follow > thr ? Math.sqrt(thr / follow) : 1));   // sustain, then the amplifier's soft clip
  }
  new Biquad('peak', 140, 0.9, sr, 4).run(x); new Biquad('peak', 450, 1.2, sr, -3).run(x); new Biquad('lp', 3400, 0.7, sr).run(x); new Biquad('lp', 5200, 0.7, sr).run(x); new Biquad('hp', 28, 0.7, sr).run(x);
  const g = V.gain * S.gain; for (let i = 0; i < len; i++) x[i] *= g; return edges(x, sr, 0.0008, 0.015);
}

export function sub(m, vel, dur, { slideFrom = null } = {}, sr = 48000) {
  const V = velocity(vel, { curve: 1.2 }), f0 = mtof(m), len = Math.floor((dur + 0.25) * sr), x = new Float32Array(len), from = slideFrom === null ? f0 : mtof(slideFrom); let ph = 0;
  for (let i = 0; i < len; i++) { const t = i / sr, f = f0 * Math.pow(from / f0, expDecay(t, 0.05)); ph += 2 * Math.PI * f / sr;
    x[i] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.min(1, t / 0.02) * (t < dur ? 1 : expDecay(t - dur, 0.07)) * (0.75 + 0.25 * expDecay(t, 1.2)); }
  const g = V.gain * 0.55; for (let i = 0; i < len; i++) x[i] = Math.tanh(1.1 * x[i]) * g; return edges(x, sr, 0.002, 0.03);
}
