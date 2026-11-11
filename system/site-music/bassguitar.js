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
export const STYLE = { finger: { table: 'bassguitar', tilt: 0, ring: 1, click: 0.16, gain: 1, lift: 0 }, ghost: { table: 'bassmuted', tilt: 0, ring: 1, click: 0.3, gain: 0.29, lift: 0 }, pop: { table: 'bassguitar', tilt: 4, ring: 1.6, click: 0.5, gain: 0.6, lift: 0.2 }, slap: { table: 'bassguitar', tilt: 2, ring: 1.2, click: 1.1, gain: 1, lift: 0.15 }, hammer: { table: 'bassguitar', tilt: -1.5, ring: 1.1, click: 0, gain: 0.8, lift: -0.15 } };
const OPEN = [28, 33, 38, 43], GAIN = 0.267, CLICK = 3;
// The bass guitar's alternatives, chosen by a piece. Each maps the line's styles to how this bass plays them:
//   finger    as above (measured: two basses, fingered, read at the same pitches and averaged)
//   picked    played with a pick on flatwound strings (measured: Karoryfer Pastabass); a sharper click, a brighter start
//   muted     every note damped by the palm (measured: the muted notes of the first bass), short and round
//   slap      designed over the measured fingered tone: the thumb strikes the string (a click and a strong start), and the
//             line's high notes are popped
//   fretless  designed over the measured fingered tone: no fret, so the note swells a little after the pluck (the "mwah"
//             of a string vibrating against the fingerboard, a resonance that rises from 500 to 1100 Hz), rings longer,
//             and slides in from below more often
// the measured finger burst (plucked.js), scaled: chosen on the fitted basses (see the round five notes)
export const THUMP = { amount: 0, from: 1 };
// how long a ghost note rings under the muting hand before it is stopped (round four stopped it at 90 ms)
export const GHOST = { hold: 0.2, release: 0.06 };
export const BASS_VOICES = {
  finger: (st) => st,
  picked: (st) => (st === 'ghost' ? 'ghost' : st === 'hammer' ? 'hammer' : 'picked'),
  muted: (st) => (st === 'hammer' ? 'hammer' : 'ghostlong'),
  slap: (st) => (st === 'finger' ? 'slap' : st),
  fretless: (st) => (st === 'pop' || st === 'slap' ? 'finger' : st),
};
STYLE.picked = { table: 'basspicked', tilt: 1, ring: 1, click: 0.55, gain: 1, lift: 0 };
STYLE.ghostlong = { table: 'bassmuted', tilt: 0, ring: 1, click: 0.3, gain: 0.8, lift: 0.1 };
export const stringFor = (m) => { let s = 0; while (s < 3 && m - OPEN[s] > 7) s++; return { string: s, fret: Math.max(0, m - OPEN[s]) }; };

export function bassGuitar(m, vel, dur, { style: st0 = 'finger', slideFrom = null, voice = 'finger' } = {}, sr = 48000, seed = 1) {
  const style = (BASS_VOICES[voice] || BASS_VOICES.finger)(st0), fretless = voice === 'fretless', S = STYLE[style] || STYLE.finger, V = velocity(vel, { curve: 1.3 }), ghost = style === 'ghost', hammer = style === 'hammer', r = rng(seed * 7001 + Math.round(m * 29) + 3);
  // a ghost note rings on under the muting hand for up to 0.2 s (the recorded ghost notes ring longer than the 90 ms of round four)
  const hold = ghost ? Math.min(dur, GHOST.hold) : style === 'ghostlong' ? Math.min(dur, 0.55 * dur + 0.05) : dur, from = fretless && slideFrom === null && seed % 3 === 0 ? m - 1 : slideFrom;
  const x = plucked(TABLES[S.table] || TABLES.bassguitar, m, clamp(vel + S.lift, 0, 1), dur, { hold, release: ghost ? GHOST.release : style === 'ghostlong' ? 0.03 : 0.045, attack: hammer ? 0.012 : fretless ? 0.01 : 0.003, from, glide: fretless ? 0.06 : 0.025, cents: hammer || fretless ? 0 : 6 + 14 * vel * vel, tilt: S.tilt - (fretless ? 1 : 0), ring: S.ring * (fretless ? 0.75 : 1), thump: S.thump ?? THUMP.amount, thumpFrom: THUMP.from }, sr, seed);
  if (fretless) { const pk = new Biquad('peak', 500, 2, sr, 6); for (let i = 0; i < x.length; i++) { if (i % 128 === 0) pk.set('peak', 500 + 600 * (1 - Math.exp(-i / sr / 0.12)), 2, 6 * Math.exp(-i / sr / 0.6)); x[i] = pk.tick(x[i]); } }
  const click = new Biquad('bp', style === 'slap' || style === 'pop' ? 2600 : style === 'picked' ? 2200 : 1400, 0.9, sr), squeak = new Biquad('bp', 2300, 3, sr), rattle = vel > 0.72 && !ghost && !hammer ? (vel - 0.72) * 2.2 : 0;
  for (let i = 0; i < x.length; i++) { const t = i / sr, n = r() * 2 - 1; let y = x[i]; if (rattle) y *= 1 + rattle * expDecay(t, 0.03) * Math.sign(Math.sin(2 * Math.PI * 310 * t));   // the string chattering on a fret
    x[i] = y + CLICK * S.click * (fretless ? 0.4 : 1) * V.bright * click.tick(n) * expDecay(t, 0.004) + (slideFrom !== null ? 0.25 * squeak.tick(n) * expDecay(t, 0.025) * (1 - expDecay(t, 0.008)) : 0); }
  new Biquad('hp', 28, 0.7, sr).run(x);
  const g = V.gain * S.gain * GAIN; for (let i = 0; i < x.length; i++) x[i] *= g; return edges(x, sr, 0.0008, 0.015);
}

export function sub(m, vel, dur, { slideFrom = null } = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.2 }), f0 = mtof(m), len = Math.floor((dur + 0.25) * sr), x = new Float32Array(len), from = slideFrom === null ? f0 : mtof(slideFrom); let ph = seed === 1 ? 0 : rng(seed * 131 + m)() * 6.28;   // seed 1 keeps the sub as it was
  for (let i = 0; i < len; i++) { const t = i / sr, f = f0 * Math.pow(from / f0, expDecay(t, 0.05)); ph += 2 * Math.PI * f / sr;
    x[i] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * Math.min(1, t / 0.02) * (t < dur ? 1 : expDecay(t - dur, 0.07)) * (0.75 + 0.25 * expDecay(t, 1.2)); }
  const g = V.gain * 0.55; for (let i = 0; i < len; i++) x[i] = Math.tanh(1.1 * x[i]) * g; return edges(x, sr, 0.002, 0.03);
}
