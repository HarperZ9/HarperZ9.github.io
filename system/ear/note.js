// note.js: does a line sound played or stamped out. A synthetic instrument gives itself away with notes that are all the
// same: the same attack every time, a spectrum that does not move while the note sounds, the same brightness loud or
// soft, and two notes of one pitch that are copies of each other. These measures put numbers on each, for one layer
// (a lead or a bass) and the list of notes the score wrote for it: [{ t0, t1, m }] in seconds and MIDI pitch.
//   attack         time for the level to rise from 10 to 90 percent of the note's peak, in ms; and its spread over notes
//   flux           how much the spectrum changes from frame to frame inside the sustained part of a note (0 for a frozen
//                  tone; vibrato, breath and a decaying string all raise it)
//   decay tilt     the brightness at the end of a note against its start, in octaves (negative: it darkens as it decays)
//   level slope    how brightness follows level across notes, in octaves of spectral centroid per 10 dB
//   repeat         for notes of the same pitch, how alike their first 150 ms are as waveforms (1 is a copy), and the
//                  share of such pairs that are copies (0.97 or more); a neighbour's tail can blur one pair, not most of them
//   inharmonicity  for a string: the coefficient B in f_k = k f0 sqrt(1 + B k^2), from the measured partials
import { decimate, powerFrames, peaks, mtof } from './spectrum.js';

const meanOf = (a) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0), sdOf = (a) => { const m = meanOf(a); return Math.sqrt(meanOf(a.map((v) => (v - m) ** 2))); };

// Brightness: the centre of the partials, weighted by power. Only spectral peaks within 40 dB of the strongest count, so
// the harmonics are measured and a bed of breath noise is not.
function centroidOf(p, binHz, top = 8000) { let num = 0, den = 0; for (const q of peaks(p, binHz, { max: 24, floorDb: -40, fmax: top })) { num += q.f * q.a * q.a; den += q.a * q.a; } return den ? num / den : 0; }
function cosine(a, b, n) { let ab = 0, aa = 0, bb = 0; for (let k = 1; k < n; k++) { const x = Math.sqrt(a[k]), y = Math.sqrt(b[k]); ab += x * y; aa += x * x; bb += y * y; } return aa && bb ? ab / Math.sqrt(aa * bb) : 1; }

export function inharmonicity(x, sr, f0, { partials = 10 } = {}) {
  const n = 1 << Math.floor(Math.log2(Math.min(x.length, 65536))); if (n < 4096) return null;
  const st = powerFrames(x.subarray(0, n), sr, { n, hop: n }), pk = peaks(st.frames[0], st.binHz, { max: 60, fmin: f0 * 0.7, fmax: Math.min(sr / 2.2, f0 * (partials + 1)), floorDb: -70 }), pts = [];
  for (let k = 1; k <= partials; k++) { const p = pk.filter((q) => Math.abs(q.f / (k * f0) - 1) < 0.04).sort((a, b) => b.a - a.a)[0]; if (p) pts.push([k * k, (p.f / k) ** 2]); }
  if (pts.length < 4) return null; const mx = meanOf(pts.map((q) => q[0])), my = meanOf(pts.map((q) => q[1])), slope = pts.reduce((s, q) => s + (q[0] - mx) * (q[1] - my), 0) / pts.reduce((s, q) => s + (q[0] - mx) ** 2, 0);
  return slope / (my - slope * mx);
}

export function noteStats(x, sr, notes, { maxPairs = 16 } = {}) {
  const F = Math.round(0.002 * sr), env = []; for (let s = 0; s + F <= x.length; s += F) { let e = 0; for (let i = s; i < s + F; i++) e += x[i] * x[i]; env.push(Math.sqrt(e / F)); }
  const n = 2048, hop = 512, st = powerFrames(x, sr, { n, hop }), frameAt = (t) => Math.max(0, Math.min(st.frames.length - 1, Math.round((t * sr - n / 2) / hop))), rows = [];
  for (const nt of notes) {
    const a = Math.max(0, Math.floor((nt.t0 - 0.12) * sr / F)), b = Math.min(env.length, Math.ceil(nt.t1 * sr / F)); if (b - a < 20) continue;
    let pk = 0, at = a; for (let i = a; i < Math.min(b, a + Math.round(0.45 * sr / F)); i++) if (env[i] > pk) { pk = env[i]; at = i; } if (pk < 1e-5) continue;
    let i10 = at, i90 = at; for (let i = at; i >= a; i--) { if (env[i] >= 0.9 * pk) i90 = i; if (env[i] >= 0.1 * pk) i10 = i; else break; }
    const onset = i10 * F / sr, f0 = frameAt(onset + 0.08), f1 = Math.max(f0 + 1, frameAt(nt.t1 - 0.04)), cents = [], flux = [];
    for (let f = f0; f <= f1 && f < st.frames.length; f++) { cents.push(centroidOf(st.frames[f], st.binHz)); if (f > f0) flux.push(1 - cosine(st.frames[f], st.frames[f - 1], Math.round(6000 / st.binHz))); }
    const third = Math.max(1, Math.floor(cents.length / 3)), cStart = meanOf(cents.slice(0, third)), cEnd = meanOf(cents.slice(-third)); let e = 0, c = 0; for (let i = at; i < b; i++) { e += env[i] * env[i]; c++; }
    rows.push({ t0: nt.t0, m: nt.m, onset, attackMs: (i90 - i10) * F / sr * 1000, levelDb: 10 * Math.log10(e / c + 1e-12), centroid: meanOf(cents), flux: meanOf(flux), tilt: cStart && cEnd && cents.length >= 6 ? Math.log2(cEnd / cStart) : null, seconds: nt.t1 - nt.t0 });
  }
  // brightness against level, across notes, with pitch held apart: log2(centroid) = a + b * level + c * pitch, by least squares.
  // b times 10 is the slope in octaves per 10 dB. Pitch is in the fit because a higher note is brighter whatever its level.
  const P = rows.filter((r) => r.centroid > 0), N = P.length; let levelSlope = null;
  if (N >= 6) { const X = P.map((r) => [1, r.levelDb, r.m]), Y = P.map((r) => Math.log2(r.centroid)), A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], B = [0, 0, 0];
    X.forEach((x, i) => { for (let u = 0; u < 3; u++) { B[u] += x[u] * Y[i]; for (let v = 0; v < 3; v++) A[u][v] += x[u] * x[v]; } });
    const det = (M) => M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) - M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) + M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]), D = det(A), spread = sdOf(P.map((r) => r.levelDb));
    if (sdOf(P.map((r) => r.m)) < 0.5) { const mx = meanOf(P.map((r) => r.levelDb)), my = meanOf(Y); if (spread > 1) levelSlope = 10 * P.reduce((q, r, i) => q + (r.levelDb - mx) * (Y[i] - my), 0) / P.reduce((q, r) => q + (r.levelDb - mx) ** 2, 0); }   // one pitch: a plain line
    else if (Math.abs(D) > 1e-9 && spread > 1) { const A1 = A.map((row, u) => [row[0], B[u], row[2]]); levelSlope = 10 * det(A1) / D; } }
  // notes of the same pitch, compared as waveforms from their own onsets, at a reduced rate, over a small range of lags
  // (the waveform is differenced twice first, which lifts the upper partials: two notes that share only a fundamental do not pass as copies)
  const k = Math.max(1, Math.floor(sr / 12000)), y0 = decimate(x, k), y = new Float32Array(y0.length), r = sr / k; for (let i = 2; i < y.length; i++) y[i] = y0[i] - 2 * y0[i - 1] + y0[i - 2];
  const W = Math.round(0.15 * r), lagMax = Math.round(0.006 * r), sims = [], byPitch = new Map();
  for (const row of rows) { const key = Math.round(row.m); if (!byPitch.has(key)) byPitch.set(key, []); byPitch.get(key).push(row); }
  outer: for (const list of byPitch.values()) for (let i = 0; i + 1 < list.length; i++) {
    const p = Math.round(list[i].onset * r), q0 = Math.round(list[i + 1].onset * r); if (p + W >= y.length || q0 + W + lagMax >= y.length || q0 - lagMax < 0) continue; let aa = 0; for (let s = 0; s < W; s++) aa += y[p + s] * y[p + s]; let best = 0;
    for (let lag = -lagMax; lag <= lagMax; lag++) { let ab = 0, bb = 0; const q = q0 + lag; for (let s = 0; s < W; s++) { ab += y[p + s] * y[q + s]; bb += y[q + s] * y[q + s]; } const c = aa && bb ? ab / Math.sqrt(aa * bb) : 0; if (c > best) best = c; }
    sims.push(best); if (sims.length >= maxPairs) break outer;
  }
  const long = rows.filter((q) => q.seconds > 0.25), tilts = long.map((q) => q.tilt).filter((v) => v !== null);
  return { notes: rows.length, attackMs: meanOf(rows.map((q) => q.attackMs)), attackSpreadMs: sdOf(rows.map((q) => q.attackMs)), flux: meanOf(long.map((q) => q.flux)), decayTilt: tilts.length ? meanOf(tilts) : null, levelSlope,
    repeatPairs: sims.length, repeatMean: sims.length ? meanOf(sims) : null, repeatMax: sims.length ? Math.max(...sims) : null, copyShare: sims.length ? sims.filter((v) => v >= 0.97).length / sims.length : 0, rows };
}
