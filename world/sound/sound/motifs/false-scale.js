// The false scale (family F1). A scale climbs where each note is checked only against the note before it.
// Each step is a few cents flat of the last one, so every step reads true and the error is never seen.
// By the top of the scale the pitch is a good way flat of where it claims to be. Then a reference tone arrives.
import { playMotif } from './play.js';
import { mtof } from '../util.js';
import { voice, bell, pad } from '../voices.js';

export const meta = { id: 'false-scale', family: 'F1 The false scale', title: 'The false scale', line: 'Each note passes the check. Only the last one hears the reference.' };

// Frequencies of the climb, for display. driftCents is the error added per step against the previous note.
export function climb(rootMidi = 57, drift = 14, intervals = [0, 2, 4, 5, 7, 9, 11, 12]) {
  const out = []; let f = mtof(rootMidi), prev = 0;
  intervals.forEach((iv, i) => { if (i) f = f * Math.pow(2, (iv - prev) / 12) * Math.pow(2, -drift / 1200); prev = iv; out.push({ f, honest: mtof(rootMidi + iv), off: 1200 * Math.log2(f / mtof(rootMidi + iv)) }); });
  return out;
}

export function render(ctx, dest, t, { root = 57, drift = 14, step = 0.42 } = {}) {
  const notes = climb(root, drift), total = notes.length * step + 2.8;
  // The hum under it: a pad tuned slightly flat of the true root, the whole way through.
  pad(ctx, dest, t, { notes: [root - 12, root - 5], dur: total, vel: 0.12, attack: 0.8, release: 1.2, cutoff: 700, cents: -drift * 1.3 });
  notes.forEach((n, i) => {
    const tt = t + i * step, midi = 69 + 12 * Math.log2(n.f / 440);
    voice(ctx, dest, tt, { note: midi, dur: step * 0.95, vel: 0.2, vowel: 'o', vibrato: 4.6, depth: 6, attack: 0.03, release: 0.12 });
    // The check: a quiet high chime that reads TRUE every time.
    bell(ctx, dest, tt + 0.02, { note: 100, dur: 0.25, vel: 0.05, ratio: 2, index: 40 });
  });
  const tr = t + notes.length * step + 0.25;
  // The reference: the honest pitch of the top note, sustained, beating against the false one.
  const last = notes[notes.length - 1];
  voice(ctx, dest, tr, { note: 69 + 12 * Math.log2(last.honest / 440), dur: 2.2, vel: 0.22, vowel: 'a', vibrato: 0, depth: 0, attack: 0.05, release: 0.8 });
  voice(ctx, dest, tr, { note: 69 + 12 * Math.log2(last.f / 440), dur: 2.2, vel: 0.2, vowel: 'a', vibrato: 0, depth: 0, attack: 0.05, release: 0.8 });
  return { duration: total, climb: notes, endOffCents: last.off };
}
export const play = (engine, opts) => playMotif(engine, { meta, render }, opts);
