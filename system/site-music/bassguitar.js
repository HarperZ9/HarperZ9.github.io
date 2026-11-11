// bassguitar.js: an electric bass guitar played with the fingers, and a sub bass.
// The string is the measured layer (measured.js, plucked.js): the level of every partial at the pluck, how fast each one
// dies away and the string's inharmonicity, measured from single notes of a real bass guitar recorded directly from its
// pickups at four strengths (Karoryfer Samples, Black And Blue Basses, CC0). Rounds two and three built the string from
// a formula with constants written from memory and put an amplifier and cabinet after it; the cabinet is gone, because
// the reference is the instrument itself and the mix already shapes the low end.
// What makes it a played string and not a stamped one is this file's own:
//   strings     four strings (E1, A1, D2, G2). A note is played on the lowest string that keeps the hand under the eighth fret
//   the pluck   the string is sharp for a moment when it is let go (up to 20 cents on a hard note) and settles in 40 ms;
//               no two plucks land in the same place, so the partial levels and phases move a little
//   level       a harder pluck reads the table at a higher strength, and can rattle against a fret for the first 30 ms
//   finger      plain note        ghost   muted with the left hand: its own measured table of muted notes, stopped early
//   pop         pulled and snapped: brighter, shorter        slap    struck with the thumb: a click and a strong start
//   hammer      the left hand lands a new note on a string already sounding: no new attack
//   slideFrom   the pitch starts on another note and glides over 70 ms while the string keeps sounding, with finger noise
// The sub is the opposite voice: one sine and a trace of its second harmonic, slow to start and stop.
import { mtof, rng, velocity, expDecay, edges, Biquad, clamp } from '../../world/sound/sound/v3/instruments/core.js';
import { plucked } from './plucked.js';
import { TABLES } from './measured.js';

// tilt: dB per octave above 250 Hz added to the measured levels; ring: multiplies the measured decay rates; lift: moves
// the strength the table is read at; click: the noise of the finger or thumb on the string
const STYLE = { finger: { table: 'bassguitar', tilt: 0, ring: 1, click: 0.16, gain: 1, lift: 0 }, ghost: { table: 'bassmuted', tilt: 0, ring: 1, click: 0.3, gain: 0.29, lift: 0 }, pop: { table: 'bassguitar', tilt: 4, ring: 1.6, click: 0.5, gain: 0.6, lift: 0.2 }, slap: { table: 'bassguitar', tilt: 2, ring: 1.2, click: 1.1, gain: 1, lift: 0.15 }, hammer: { table: 'bassguitar', tilt: -1.5, ring: 1.1, click: 0, gain: 0.8, lift: -0.15 } };
const OPEN = [28, 33, 38, 43], GAIN = 0.245, CLICK = 3;
export const stringFor = (m) => { let s = 0; while (s < 3 && m - OPEN[s] > 7) s++; return { string: s, fret: Math.max(0, m - OPEN[s]) }; };

export function bassGuitar(m, vel, dur, { style = 'finger', slideFrom = null } = {}, sr = 48000, seed = 1) {
  const S = STYLE[style] || STYLE.finger, V = velocity(vel, { curve: 1.3 }), ghost = style === 'ghost', hammer = style === 'hammer', hold = ghost ? Math.min(dur, 0.09) : dur, r = rng(seed * 7001 + Math.round(m * 29) + 3);
  const x = plucked(TABLES[S.table], m, clamp(vel + S.lift, 0, 1), dur, { hold, release: ghost ? 0.015 : 0.045, attack: hammer ? 0.012 : 0.003, from: slideFrom, glide: 0.025, cents: hammer ? 0 : 6 + 14 * vel * vel, tilt: S.tilt, ring: S.ring }, sr, seed);
  const click = new Biquad('bp', style === 'slap' || style === 'pop' ? 2600 : 1400, 0.9, sr), squeak = new Biquad('bp', 2300, 3, sr), rattle = vel > 0.72 && !ghost && !hammer ? (vel - 0.72) * 2.2 : 0;
  for (let i = 0; i < x.length; i++) { const t = i / sr, n = r() * 2 - 1; let y = x[i]; if (rattle) y *= 1 + rattle * expDecay(t, 0.03) * Math.sign(Math.sin(2 * Math.PI * 310 * t));   // the string chattering on a fret
    x[i] = y + CLICK * S.click * V.bright * click.tick(n) * expDecay(t, 0.004) + (slideFrom !== null ? 0.25 * squeak.tick(n) * expDecay(t, 0.025) * (1 - expDecay(t, 0.008)) : 0); }
  new Biquad('hp', 28, 0.7, sr).run(x);
  const g = V.gain * S.gain * GAIN; for (let i = 0; i < x.length; i++) x[i] *= g; return edges(x, sr, 0.0008, 0.015);
}

export function sub(m, vel, dur, { slideFrom = null } = {}, sr = 48000) {
  const V = velocity(vel, { curve: 1.2 }), f0 = mtof(m), len = Math.floor((dur + 0.25) * sr), x = new Float32Array(len), from = slideFrom === null ? f0 : mtof(slideFrom); let ph = 0;
  for (let i = 0; i < len; i++) { const t = i / sr, f = f0 * Math.pow(from / f0, expDecay(t, 0.05)); ph += 2 * Math.PI * f / sr;
    x[i] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.min(1, t / 0.02) * (t < dur ? 1 : expDecay(t - dur, 0.07)) * (0.75 + 0.25 * expDecay(t, 1.2)); }
  const g = V.gain * 0.55; for (let i = 0; i < len; i++) x[i] = Math.tanh(1.1 * x[i]) * g; return edges(x, sr, 0.002, 0.03);
}
