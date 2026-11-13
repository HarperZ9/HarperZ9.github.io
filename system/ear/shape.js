// shape.js: the large-scale shape of a piece.
//   repetition    how alike successive phrases are. Each bar is cut into eight steps and each step is reduced to its
//                 energy in eighteen frequency bands; a phrase is the grid of those numbers. Two phrases are compared by
//                 correlation after each band's own average is taken out, so a steady timbre counts for nothing and only
//                 the pattern in time counts. A loop played twice reads near 1; two different performances of the same
//                 chords read lower.
//   entries       how suddenly things arrive, two ways. Level: loudness is read in 3 second windows, and the largest rise
//                 from one window to the one 3 seconds later is reported, counted from the moment the music is
//                 established (the first notes out of silence are an opening, and are left out). Layers: when the layers
//                 are given, the time each one first sounds is found, and the largest group of layers that first sound
//                 within two seconds of each other after the opening is reported, with the share of the music's energy
//                 the group carries. A staged arrangement brings layers in one at a time; a band that starts all at once
//                 reads as one large group.
import { mono, powerFrames } from './spectrum.js';
import { loudnessCurve } from './level.js';

const EDGES = Array.from({ length: 19 }, (_, i) => 60 * Math.pow(2, i * 0.4));   // 60 Hz to 8.8 kHz

// bars: [{ t0, t1 }] in seconds, in order. Returns one feature grid per bar: steps x bands of log energy.
export function barGrids(x, sr, bars, { steps = 8, n = 2048 } = {}) {
  const st = powerFrames(x, sr, { n, hop: n / 4 }), cut = EDGES.map((f) => Math.min(st.frames[0]?.length - 1 || 1, Math.round(f / st.binHz)));
  return bars.map(({ t0, t1 }) => Array.from({ length: steps }, (_, s) => {
    const a = Math.max(0, Math.round((t0 + (t1 - t0) * s / steps) / st.hopSec)), b = Math.max(a + 1, Math.round((t0 + (t1 - t0) * (s + 1) / steps) / st.hopSec)), v = new Float64Array(EDGES.length - 1);
    for (let f = a; f < b && f < st.frames.length; f++) for (let k = 0; k < v.length; k++) for (let q = cut[k]; q < cut[k + 1]; q++) v[k] += st.frames[f][q];
    return Array.from(v, (e) => Math.log10(e / (b - a) + 1e-9));
  }));
}

function correlate(A, B) {   // A, B: phrases as arrays of bar grids of the same shape
  const flat = (P) => { const rows = P.flat(), bands = rows[0].length, mean = new Float64Array(bands); for (const r of rows) for (let k = 0; k < bands; k++) mean[k] += r[k] / rows.length; return rows.flatMap((r) => r.map((v, k) => v - mean[k])); };
  const a = flat(A), b = flat(B); let ab = 0, aa = 0, bb = 0; for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

// Similarity between phrases of `phraseBars` bars, starting at bar `offset`. Returns every pair, the mean of neighbours,
// and the share of all pairs that read as the same performance (at or over `same`).
export function repetition(channels, sr, bars, { phraseBars = 8, offset = 0, same = 0.9 } = {}) {
  const grids = barGrids(mono(channels), sr, bars), phrases = []; for (let s = offset; s + phraseBars <= grids.length; s += phraseBars) phrases.push(grids.slice(s, s + phraseBars));
  const pairs = []; for (let i = 0; i < phrases.length; i++) for (let j = i + 1; j < phrases.length; j++) pairs.push({ a: i, b: j, similarity: correlate(phrases[i], phrases[j]) });
  const near = pairs.filter((p) => p.b === p.a + 1).map((p) => p.similarity), all = pairs.map((p) => p.similarity);
  return { phrases: phrases.length, phraseBars, pairs, adjacentMean: near.length ? near.reduce((s, v) => s + v, 0) / near.length : 0, max: all.length ? Math.max(...all) : 0,
    sameShare: all.length ? all.filter((v) => v >= same).length / all.length : 0 };
}

// The largest rise in 3 second loudness across 3 seconds, between `from` seconds in and `to` seconds before the end.
export function entries(channels, sr, { from = null, to = 0, window = 3, hop = 0.5 } = {}) {
  const c = loudnessCurve(channels, sr, { window, hop }), k = Math.round(window / hop), end = channels[0].length / sr - to; let best = { riseDb: 0, t: 0 };
  if (from === null) { const top = Math.max(...c.map((p) => p.lufs)), first = c.find((p) => p.lufs > top - 12); from = first ? first.t + window / 2 : 0; }   // established: within 12 LU of the loudest window
  for (let i = 0; i + k < c.length; i++) { if (c[i].t - window / 2 < from || c[i + k].t + window / 2 > end) continue; const lo = Math.max(c[i].lufs, -50), d = c[i + k].lufs - lo; if (d > best.riseDb) best = { riseDb: d, t: c[i + k].t - window / 2 }; }
  return { maxRiseDb: best.riseDb, at: best.t, curve: c };
}

// When each layer first sounds (its 400 ms loudness first comes within 20 LU of its own loudest), and the largest group
// that arrives together after the opening. layers: { name: channels }.
export function layerEntries(layers, sr, { within = 2, opening = 2 } = {}) {
  const first = [], energy = {}; let total = 0;
  for (const [name, ch] of Object.entries(layers)) { const c = loudnessCurve(ch, sr, { window: 0.4, hop: 0.1 }), top = Math.max(...c.map((p) => p.lufs)); if (!Number.isFinite(top)) continue;
    const p = c.find((q) => q.lufs > top - 20); let e = 0; for (const x of ch) for (let i = 0; i < x.length; i += 8) e += x[i] * x[i]; energy[name] = e; total += e; first.push({ name, t: p.t - 0.2 }); }
  first.sort((a, b) => a.t - b.t); const t0 = first.length ? first[0].t : 0; let best = { names: [], share: 0, t: 0 };
  for (let i = 0; i < first.length; i++) { if (first[i].t < t0 + opening) continue; const g = first.filter((f) => f.t >= first[i].t && f.t < first[i].t + within), share = g.reduce((s, f) => s + energy[f.name], 0) / (total || 1);
    if (g.length > best.names.length || (g.length === best.names.length && share > best.share)) best = { names: g.map((f) => f.name), share, t: first[i].t }; }
  return { first, together: best.names, togetherCount: best.names.length, togetherShare: best.share, at: best.t };
}
