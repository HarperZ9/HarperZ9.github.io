// measured.js: the measured layer of the voices. The tables in measured-data.js hold what real instruments were measured
// to do, note by note: the level of each harmonic, how the harmonics die away on a plucked string, how much they wander
// on a blown note, and the noise between them. This file reads a table at any pitch and strength:
//   around         the reference notes that bracket a pitch and a strength, with a weight for each (at most four)
//   harmonicsAt    harmonic levels in dB at that pitch and strength. A table in the "frequency" domain is read as a
//                  spectral envelope (level against frequency in Hz), so a body's resonances stay where they are while
//                  the pitch moves; a table in the "harmonic" domain is read by harmonic number, which suits a string
//                  heard through a pickup
//   NoiseBank      white noise through seven band filters, set to the measured noise level of each band
// A voice built on this layer plays a sum of harmonics at the measured levels plus noise at the measured levels. The
// performance (breath, slurs, scoops, vibrato, plucks, slides) is the voice's own.
import { mtof, clamp, Biquad } from '../../world/sound/sound/v3/instruments/core.js';
import { TABLES } from './measured-data.js';
export { TABLES };

const pick = (list, key, v) => { let i = 0; while (i + 1 < list.length && list[i + 1][key] <= v) i++; const j = Math.min(list.length - 1, i + 1), a = list[i][key], b = list[j][key]; return [i, j, j === i || b === a ? 0 : clamp((v - a) / (b - a), 0, 1)]; };
export function around(table, m, vel) {
  const [la, lb, lf] = pick(table.layers, 'vel', vel), out = [];
  for (const [L, w] of [[table.layers[la], 1 - lf], [table.layers[lb], lf]]) { if (w <= 0) continue; const [i, j, f] = pick(L.notes, 'm', m); if (f < 1) out.push({ note: L.notes[i], w: w * (1 - f) }); if (f > 0) out.push({ note: L.notes[j], w: w * f }); }
  return out;
}
// One reference note's value for harmonic k of a note at f0: by frequency (its envelope read at k f0) or by harmonic number.
function read(note, arr, k, f0, byFrequency, falls) {
  const n = arr.length, p = byFrequency ? k * f0 / mtof(note.m) : k; if (p <= 1) return arr[0]; if (p >= n) return arr[n - 1] - (falls ? 30 * Math.log2(p / n) : 0);
  const i = Math.floor(p), f = p - i; return arr[i - 1] + (arr[i] - arr[i - 1]) * f;
}
// Fill out[0 .. K-1] for harmonics 1 to K. key 'db' is normalised so the harmonics together hold unit power; 'dec' and
// 'sh' are read by harmonic number whatever the table's domain.
export function harmonicsAt(table, m, vel, K, out, key = 'db', near = around(table, m, vel)) {
  const f0 = mtof(m), byF = key === 'db' && table.domain === 'frequency'; let total = 0;
  for (let k = 1; k <= K; k++) { let s = 0; for (const { note, w } of near) s += w * read(note, note[key], k, f0, byF, key === 'db'); out[k - 1] = s; total += Math.pow(10, s / 10); }
  if (key === 'db') { const off = 10 * Math.log10(total || 1); for (let k = 0; k < K; k++) out[k] -= off; }
  return out;
}
export const valueAt = (table, m, vel, key, near = around(table, m, vel)) => near.reduce((s, { note, w }) => s + w * note[key], 0);
export const bandsAt = (table, m, vel, out = new Float32Array(7), near = around(table, m, vel)) => { for (let b = 0; b < 7; b++) { let s = 0; for (const { note, w } of near) s += w * note.nb[b]; out[b] = s; } return out; };

export const CENTRES = [141, 283, 566, 1131, 2263, 4525, 9051];   // centres of the noise bands, Hz (edges 100 to 12800, an octave each)
const calib = new Map();
export class NoiseBank {
  // r: a random source returning 0 to 1. Each band filter is measured once per sample rate, so a gain of 1 gives unit power.
  constructor(sr, r) {
    this.r = r; this.f = CENTRES.map((c) => new Biquad('bp', Math.min(c, 0.42 * sr), 1.2, sr)); this.g = new Float32Array(7);
    if (!calib.has(sr)) { let s = 987654321; const u = () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296 * 2 - 1; }, fs = CENTRES.map((c) => new Biquad('bp', Math.min(c, 0.42 * sr), 1.2, sr)), e = new Float64Array(7), N = 48000;
      for (let i = 0; i < N; i++) { const n = u(); for (let b = 0; b < 7; b++) { const y = fs[b].tick(n); e[b] += y * y; } } calib.set(sr, Array.from(e, (v) => 1 / Math.sqrt(v / N))); }
    this.c = calib.get(sr);
  }
  set(db, scale = 1) { for (let b = 0; b < 7; b++) this.g[b] = scale * Math.pow(10, db[b] / 20) * this.c[b]; }
  tick() { const n = this.r() * 2 - 1; let s = 0; for (let b = 0; b < 7; b++) s += this.g[b] * this.f[b].tick(n); return s; }
}
