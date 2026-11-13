// struck.js: keyboard and mallet voices over the measured layer (measured.js, plucked.js), each fitted to single notes of
// a real instrument (measured-data.js names the source and licence of each table). Levels are matched to the tine
// electric piano on the bench phrase, so a piece can swap one for another without moving its mix.
//   piano       an acoustic piano (University of Iowa, three strengths): stretched partials (the measured inharmonicity
//               rises with pitch), two decay speeds, the hammer's burst, levels that brighten with strength because each
//               strength was measured. Designed here: the damper (a short stop when the key is let go, slower in the
//               bass), the sustain pedal (held notes ring to the next chord), a slow beat between the unison strings
//   vibraphone  bars struck with soft and hard mallets (VCSL, CC0, four strengths; the University of Iowa set is held
//               back to judge it); the damper pedal; designed: a motor tremolo when asked for
//   wurlitzer   a reed electric piano (Wurlitzer EP200, Greg Sullivan's samples, CC BY 3.0, four strengths)
//   tx81z       an FM electric piano of the 1980s kind, sampled from a Yamaha TX81Z (VCSL, CC0, three strengths)
// The tine electric piano stays in voices.js; its soft and barked forms are played by this file's caller.
import { rng, velocity, expDecay, edges, Biquad, mtof } from '../../world/sound/sound/v3/instruments/core.js';
import { plucked } from './plucked.js';
import { TABLES } from './measured.js';

export function piano(m, vel, dur, { pedal = 0.5 } = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.5 }), hold = dur + pedal, low = Math.max(0, Math.min(1, (60 - m) / 36));
  const x = plucked(TABLES.piano, m, vel, hold, { release: 0.09 + 0.25 * low, attack: 0.0015, beat: 0.12, spread: 1.5, tail: 0.9 + 0.8 * low, kmax: 48, thump: 1 }, sr, seed), r = rng(seed * 31 + m), thunk = new Biquad('bp', 220, 1.2, sr);
  for (let i = Math.round(hold * sr); i < x.length; i++) x[i] += 0.01 * thunk.tick(r() * 2 - 1) * expDecay(i / sr - hold, 0.012);   // the damper landing
  const g = V.gain * 0.455; for (let i = 0; i < x.length; i++) x[i] *= g; return edges(x, sr, 0.0008, 0.04);
}
export function vibraphone(m, vel, dur, { motor = 0 } = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), x = plucked(TABLES.vibraphone, m, vel, dur, { release: 0.14, attack: 0.001, beat: 0.04, spread: 1, tail: 1.6, kmax: 24, thump: 1 }, sr, seed);
  if (motor) for (let i = 0; i < x.length; i++) x[i] *= 1 - motor * 0.5 * (1 - Math.cos(2 * Math.PI * 4.6 * i / sr));
  const g = V.gain * 0.78; for (let i = 0; i < x.length; i++) x[i] *= g; return edges(x, sr, 0.0005, 0.05);
}
export function wurlitzer(m, vel, dur, _p = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), x = plucked(TABLES.epianoreed, m, vel, dur, { release: 0.06, attack: 0.0015, beat: 0.04, spread: 1, tail: 0.5, kmax: 40, thump: 1 }, sr, seed);
  const g = V.gain * 0.423; for (let i = 0; i < x.length; i++) x[i] *= g; return edges(x, sr, 0.001, 0.03);
}
export function tx81z(m, vel, dur, _p = {}, sr = 48000, seed = 1) {
  const V = velocity(vel, { curve: 1.4 }), x = plucked(TABLES.epianofm, m, vel, dur, { release: 0.08, attack: 0.001, beat: 0, spread: 0.5, tail: 0.6, kmax: 40, thump: 1 }, sr, seed);
  const g = V.gain * 0.508; for (let i = 0; i < x.length; i++) x[i] *= g; return edges(x, sr, 0.001, 0.03);
}
// a piano spreads across the stereo field by pitch, low on the left, as heard from the player's bench
export const pianoPan = (m) => Math.max(-0.7, Math.min(0.7, (m - 62) / 30));
export { mtof };
