// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// meter.mjs: beats per bar (3 or 4) and the downbeat phase, from three independent readings of the beat series.
//
//   1. Accent contrast. Per beat: onset strength at the beat, the rise of low-band energy (sub plus low) across
//      the beat, and the harmonic change (cosine distance of beat-averaged chroma to the previous beat). Each is
//      z-scored and summed into a downbeat salience d_i. For m beats per bar and phase p, the contrast is the mean
//      of d on beats i = p (mod m) minus the mean on the rest; the best phase counts.
//   2. Bar self-similarity. Beat-synchronous vectors (chroma plus normalised bands) repeat at the bar: the mean
//      cosine similarity at lag m, against the mean over lags 2 to 6.
//   3. Bar periodicity of the onset envelope: its autocorrelation at m beat periods over that at one period.
//
// Readings 1 and 2 vote for 3 against 4, each in units of its own permutation null (200 seeded shuffles of the
// beat order); the 4 side takes the stronger of 4 and 2. Reading 3 is reported, not voted. A total above 2 null deviations says 3; otherwise 4 is reported,
// and `identified` is false when the total is within 2 either way. 2 folds into 4.

// z-score with a floor on the spread, in the reading's own units: a nearly constant series stays nearly zero
// instead of having its noise blown up to unit size (the 'pulse' synthetic, one chord on every beat, showed this)
const z = (a, floor = 1e-9) => { const n = a.length, m = a.reduce((s, v) => s + v, 0) / n, sd = Math.max(floor, Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / n)); return a.map(v => (v - m) / sd); };
function mulberry(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function shuffleIdx(n, r) { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const cos = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return x && y ? d / Math.sqrt(x * y) : 0; };

export function beatVectors({ flux, low, sub, chroma, fps, beats }) {
  const idx = beats.map(t => Math.round(t * fps)), n = flux.length, out = [];
  for (let i = 0; i < idx.length; i++) {
    const a = idx[i], b = i + 1 < idx.length ? idx[i + 1] : Math.min(n, a + (a - (idx[i - 1] ?? a - 50)));
    // accent as the flux summed over +-40 ms: a sum does not depend on where the attack falls inside a 10 ms
    // frame, where a maximum does (a beat period that is not a whole number of frames aliased into a fake bar)
    let acc = 0; for (let k = a - 4; k <= a + 4; k++) if (k >= 0 && k < n) acc += flux[k];
    const e = k => 10 ** ((low[Math.max(0, Math.min(n - 1, k))] ) / 10) + 10 ** ((sub[Math.max(0, Math.min(n - 1, k))]) / 10);
    // low-band rise: 60 ms before against 60 ms after, skipping the 40 ms around the beat for the same reason
    let pre = 0, post = 0; for (let k = 3; k <= 8; k++) { pre += e(a - k); post += e(a + k - 1); }
    const ch = new Float64Array(12); let cnt = 0;
    for (let k = a; k < Math.max(a + 1, b) && k < n; k++) { for (let c = 0; c < 12; c++) ch[c] += chroma[k * 12 + c]; cnt++; }
    if (cnt) for (let c = 0; c < 12; c++) ch[c] /= cnt;
    // band levels as the mean over the whole beat interval (a single frame at the beat aliases like the accent did)
    let lo = 0, su = 0, cn = 0; for (let k = a; k < Math.max(a + 1, b) && k < n; k++) { lo += low[k]; su += sub[k]; cn++; }
    out.push({ accent: acc, lowRise: 10 * Math.log10((post + 1e-12) / (pre + 1e-12)), chroma: ch, low: cn ? lo / cn : low[Math.min(n - 1, a)], sub: cn ? su / cn : sub[Math.min(n - 1, a)] });
  }
  return out;
}

function autocorrAt(env, lag) {
  const n = env.length; let m = 0; for (const v of env) m += v; m /= n;
  let s = 0, s0 = 0; const L = Math.round(lag);
  for (let t = 0; t < n; t++) s0 += (env[t] - m) ** 2;
  for (let t = L; t < n; t++) s += (env[t] - m) * (env[t - L] - m);
  return s0 ? (s / (n - L)) / (s0 / n) : 0;
}

export function inferMeter({ flux, low, sub, chroma, fps, beats, period }) {
  if (beats.length < 16) return { beatsPerBar: 4, phase: 0, confidence: 0, evidence: { note: 'fewer than 16 beats' } };
  const V = beatVectors({ flux, low, sub, chroma, fps, beats });
  const hc = V.map((v, i) => (i ? 1 - cos(v.chroma, V[i - 1].chroma) : 0));
  const za = z(V.map(v => v.accent), 0.3), zl = z(V.map(v => v.lowRise), 1.5), zh = z(hc, 0.02), d = za.map((a, i) => a + zl[i] + zh[i]);
  const contrast = {}, phase = {};
  for (const m of [2, 3, 4, 5, 6]) {
    let best = -Infinity, bp = 0;
    for (let p = 0; p < m; p++) {
      let on = 0, cn = 0, off = 0, co = 0;
      d.forEach((v, i) => { if (i % m === p) { on += v; cn++; } else { off += v; co++; } });
      const c = on / cn - off / co; if (c > best) { best = c; bp = p; }
    }
    contrast[m] = +best.toFixed(4); phase[m] = bp;
  }
  // beat-synchronous vector: chroma (unit length) and the two low bands (z-scored over the track)
  const lz = z(V.map(v => v.low), 3), sz = z(V.map(v => v.sub), 3);
  const vec = V.map((v, i) => { const n = Math.hypot(...v.chroma) || 1; return [...Array.from(v.chroma, c => c / n), 0.5 * lz[i], 0.5 * sz[i]]; });
  const selfsim = {};
  for (const m of [2, 3, 4, 5, 6]) { let s = 0, c = 0; for (let i = m; i < vec.length; i++) { s += cos(vec[i], vec[i - m]); c++; } selfsim[m] = +(s / c).toFixed(4); }
  const periodic = {};
  for (const m of [2, 3, 4, 5, 6]) periodic[m] = +autocorrAt(flux, m * period * fps).toFixed(4);
  // Votes for 3 against 4, each in units of its own null: the same statistic on 200 seeded shuffles of the beat
  // order, which keeps every value and destroys any bar structure. A duple bar (2) also supports 4, so the 4 side
  // takes the stronger of 2 and 4. The onset periodicity reading is reported and not voted: on a waltz, every beat
  // carries an onset, so its 3-against-4 sign follows the tempo, not the meter (found on the synthetic sweep).
  // The 3 side was briefly max(3, 6) (a six-beat group as two bars of 3); on Hum v3 and the 150 BPM DAW clip it
  // turned identified 4/4 readings into unidentified ones and made one meterless synthetic read 3, so it was
  // reverted (2026-10-24). 6 stays in the evidence for reading.
  const four = r => Math.max(r[4], r[2]), three = r => r[3];
  const contrastOf = (dd, m) => { let best = -Infinity; for (let p = 0; p < m; p++) { let on = 0, cn = 0, off = 0, co = 0; dd.forEach((v, i) => { if (i % m === p) { on += v; cn++; } else { off += v; co++; } }); best = Math.max(best, on / cn - off / co); } return best; };
  const simOf = (vv, m) => { let s = 0, c = 0; for (let i = m; i < vv.length; i++) { s += cos(vv[i], vv[i - m]); c++; } return s / c; };
  const rnd = mulberry(0x5eed);
  const nullSd = (stat) => { const xs = []; for (let k = 0; k < 200; k++) xs.push(stat(shuffleIdx(d.length, rnd))); const m = xs.reduce((a, b) => a + b, 0) / xs.length; return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / xs.length) || 1; };
  const sdA = nullSd(ix => { const dd = ix.map(i => d[i]); return contrastOf(dd, 3) - Math.max(contrastOf(dd, 4), contrastOf(dd, 2)); });
  const sdS = nullSd(ix => { const vv = ix.map(i => vec[i]); return simOf(vv, 3) - Math.max(simOf(vv, 4), simOf(vv, 2)); });
  // an effect must also clear a floor in raw units before it can vote (0.25 z of salience, 0.05 of cosine), so a
  // tiny but regular measurement artefact cannot outvote silence on a track with no bar cue at all
  const shrink = (x, f) => Math.sign(x) * Math.max(0, Math.abs(x) - f);
  const votes = { accent: shrink(three(contrast) - four(contrast), 0.25) / sdA, selfsim: shrink(three(selfsim) - four(selfsim), 0.05) / sdS };
  const total = votes.accent + votes.selfsim;
  // below 2 null deviations in total, the bar is not identified; 4 is reported with low confidence
  const beatsPerBar = total > 2 ? 3 : 4;
  const ph = beatsPerBar === 3 ? phase[3] : (contrast[4] >= contrast[2] ? phase[4] : phase[2]);
  return {
    beatsPerBar, phase: ph, confidence: +Math.tanh(Math.max(0, Math.abs(total) - 2) / 3).toFixed(3), margin: +total.toFixed(3), identified: Math.abs(total) > 2,
    evidence: { contrast, selfsim, periodic, votes: Object.fromEntries(Object.entries(votes).map(([k, v]) => [k, +v.toFixed(3)])) },
  };
}
