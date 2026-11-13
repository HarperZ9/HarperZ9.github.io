// mask.js: does one layer cover another. Masking is a loud sound hiding a quieter one in the same frequency band. The ear
// here uses the simplest honest stand-in: for each octave band, the level of the signal minus the level of the masker (a
// signal-to-masker ratio in dB), taken over the frames where the signal is sounding. It is a band-energy comparison, not a
// model of the inner ear's excitation pattern, so it misses masking that spreads from one band up into the next.
//   over       signal minus masker per band in dB; under 0 the masker is louder than the signal in that band
//   leadOver   the same, weighted by where the signal keeps its energy: the number that says whether a lead line is heard
import { mono, powerFrames, db } from './spectrum.js';

const BANDS = [125, 250, 500, 1000, 2000, 4000, 8000];

function bandFrames(x, sr, n = 4096) {
  const st = powerFrames(x, sr, { n, hop: n / 2 });
  return st.frames.map((p) => BANDS.map((c) => { let s = 0; const a = Math.max(1, Math.round(c / Math.SQRT2 / st.binHz)), b = Math.min(p.length - 1, Math.round(c * Math.SQRT2 / st.binHz)); for (let k = a; k < b; k++) s += p[k]; return s; }));
}

// signal and masker are channel arrays of the same length. activeDb: frames where the signal is quieter than this under its
// own loudest frame are skipped, so rests do not count as masked notes.
export function masking(signal, masker, sr, { activeDb = -25 } = {}) {
  const S = bandFrames(mono(signal), sr), M = bandFrames(mono(masker), sr), tot = S.map((f) => f.reduce((a, b) => a + b, 0)), top = Math.max(...tot, 1e-20), gate = top * Math.pow(10, activeDb / 10);
  const s = new Float64Array(BANDS.length), m = new Float64Array(BANDS.length); let frames = 0;
  for (let i = 0; i < S.length && i < M.length; i++) { if (tot[i] < gate) continue; frames++; for (let b = 0; b < BANDS.length; b++) { s[b] += S[i][b]; m[b] += M[i][b]; } }
  const st = s.reduce((a, b) => a + b, 0) || 1e-20, over = BANDS.map((_, b) => db((s[b] || 1e-20) / (m[b] || 1e-20)));
  const leadOver = BANDS.reduce((a, _, b) => a + (s[b] / st) * over[b], 0), worstBand = over.indexOf(Math.min(...over));
  return { bands: BANDS, over, share: Array.from(s, (v) => v / st), leadOver, worstBandHz: BANDS[worstBand], worstOver: over[worstBand], activeFrames: frames };
}
