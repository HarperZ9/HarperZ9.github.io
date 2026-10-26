// The crowd of one (family F5). One voice is layered and detuned until it sounds like many, then it collapses
// back to a single voice. The widest-detuned copies leave first, so what remains at the end is the original line.
import { playMotif } from './play.js';
import { rng } from '../util.js';
import { voice } from '../voices.js';

export const meta = { id: 'crowd-of-one', family: 'F5 The crowd of one', title: 'The crowd of one', line: 'Forty voices agree. Count the throats at the end.' };

export function render(ctx, dest, t, { n = 28, note = 55, rise = 3.2, hold = 1.6, collapse = 2.2, spreadCents = 38, seed = 5 } = {}) {
  const r = rng(seed), total = rise + hold + collapse + 1.6, end = t + rise + hold;
  const vowels = ['a', 'o', 'a', 'e', 'o'];
  for (let i = 0; i < n; i++) {
    const k = i / Math.max(n - 1, 1), enter = t + (i === 0 ? 0 : rise * Math.pow(k, 0.8));
    // the crowd leaves widest-first; voice 0 is the one that stays
    const leave = i === 0 ? t + total - 0.4 : end + collapse * (1 - k) * 0.95 + 0.1;
    const cents = i === 0 ? 0 : (r() * 2 - 1) * spreadCents * (0.35 + 0.65 * k);
    const nt = i === 0 ? note : note + (r() < 0.25 ? 12 : r() < 0.15 ? -12 : r() < 0.2 ? 7 : 0);
    voice(ctx, dest, enter + r() * 0.03, { note: nt, dur: Math.max(0.3, leave - enter), vel: i === 0 ? 0.7 : 0.22, vowel: vowels[i % 5], cents, vibrato: 4.5 + r() * 1.8, depth: 8 + r() * 10, attack: 0.25, release: 0.5, pan: (r() * 2 - 1) * Math.min(1, k * 1.2) });
  }
  return { duration: total, voices: n };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
