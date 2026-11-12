// sax.js: the saxophone. Its tone is the measured layer (measured.js, blown.js): harmonic and breath-noise levels measured
// from single notes of a real alto saxophone at soft, medium and loud (University of Iowa Musical Instrument Samples,
// free for any project without restrictions), read as a spectral envelope. Rounds two and three used a waveguide (a
// conical bore with a reed, after Scavone and Cook's description) shaped toward targets written from memory. A listener
// did not find it convincing, and the targets had never been checked against an instrument.
// The playing is in blown.js: phrases on one breath, slurs, scoops, late vibrato, breath that brightens the tone.
// A second and third saxophone source (two CC0 sets) are held back from the fit, so the ear's judge can be asked about
// this voice with the recordings it was fitted to left out.
import { blownPhrase, blown, PRE } from './blown.js';
import { TABLES } from './measured.js';

export const SAX = { breath: 0.62, noise: 0.1, vibrato: 0.011, vibRate: 5, vibDelay: 0.45, scoop: 0.6, tone: 0, drift: 4, growl: 0, intake: 1, keys: 1 };
export { PRE };

// notes: [{ t, dur, m, vel, slur }] in seconds from the first note, in order. Returns { x, pre }: mono samples, and how
// many of them come before the first note.
export const saxPhrase = (notes, p = SAX, sr = 48000, seed = 3) => blownPhrase(notes, TABLES.sax, { ...SAX, ...p }, sr, seed);
// One note on its own, without the intake of breath: for tests and for single notes.
export const sax = (m, vel, dur, p = SAX, sr = 48000, seed = 3) => blown(m, vel, dur, TABLES.sax, { ...SAX, ...p }, sr, seed);
