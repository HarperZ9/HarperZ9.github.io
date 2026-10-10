// SPDX-License-Identifier: FSL-1.1-MIT
// Loudness and peak meters, ITU-R BS.1770 and EBU Tech 3341/3342.
//
//   integrated(chans, rate)  gated programme loudness (LUFS), the superstack-bs1770/1 algorithm
//   momentary / shortTerm    400 ms and 3 s sliding loudness, one value per 100 ms hop
//   loudnessRange            EBU Tech 3342 LRA (LU) from the short-term series
//   truePeak(chans, rate)    dBTP from 4x oversampling with the interpolator in TP_FIR
//
// `chans` is an array of channel buffers (one for mono, two for stereo). The
// K-weighting coefficients come from the vendored superstack contract, so the
// meter and the contract cannot drift apart. Pure; runs in Node and browsers.
import { kWeighting } from "../../third_party/superstack/superstack.mjs";
import { TP_FIR, TP_FIR_SOURCE } from "./truepeak-fir.mjs";

export const METER = "raw-native-bs1770/1";
export const TRUE_PEAK = "raw-native-truepeak/1";
export { TP_FIR_SOURCE };
const loud = (p) => (p > 0 ? -0.691 + 10 * Math.log10(p) : -Infinity);
const nullIfInf = (x) => (Number.isFinite(x) ? x : null);

function kFiltered(x, rate) {
  const [s, h] = kWeighting(rate);
  const z = new Float64Array(x.length);
  let a1 = 0, a2 = 0, b1 = 0, b2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = x[i];
    const m = s[0] * v + s[1] * a1 + s[2] * a2 - s[3] * b1 - s[4] * b2;
    a2 = a1; a1 = v;
    const o = h[0] * m + h[1] * b1 + h[2] * b2 - h[3] * y1 - h[4] * y2;
    b2 = b1; b1 = m; y2 = y1; y1 = o;
    z[i] = o;
  }
  return z;
}

// Mean-square power of each 100 ms hop per channel, summed over channels
// (weight 1 for L and R). Blocks are then sums of consecutive hops.
function hopPowers(chans, rate) {
  const hop = rate / 10, n = chans[0].length, hops = Math.floor(n / hop);
  const out = new Float64Array(hops);
  for (const x of chans) {
    const z = kFiltered(x, rate);
    for (let h = 0; h < hops; h++) {
      let acc = 0;
      for (let j = h * hop; j < (h + 1) * hop; j++) acc += z[j] * z[j];
      out[h] += acc;
    }
  }
  return { hopSums: out, hop };
}

function blocks(chans, rate, nHops) {
  if (!(chans.length === 1 || chans.length === 2) || rate % 10) return null;
  const { hopSums, hop } = hopPowers(chans, rate);
  const len = hop * nHops, out = [];
  for (let i = 0; i + nHops <= hopSums.length; i++) {
    let acc = 0;
    for (let k = 0; k < nHops; k++) acc += hopSums[i + k];
    out.push(acc / len);
  }
  return out;
}

// Integrated loudness: absolute gate -70 LUFS, relative gate -10 LU.
export function integrated(chans, rate) {
  const p = blocks(chans, rate, 4);
  if (!p) return null;
  const g1 = p.filter((v) => loud(v) > -70);
  if (!g1.length) return null;
  let acc = 0;
  for (const v of g1) acc += v;
  const rel = loud(acc / g1.length) - 10;
  const g2 = g1.filter((v) => loud(v) > rel);
  acc = 0;
  for (const v of g2) acc += v;
  return loud(acc / g2.length);
}

export const momentary = (chans, rate) => (blocks(chans, rate, 4) || []).map((v) => nullIfInf(loud(v)));
export const shortTerm = (chans, rate) => (blocks(chans, rate, 30) || []).map((v) => nullIfInf(loud(v)));

// EBU Tech 3342: short-term values gated at -70 LUFS absolute and -20 LU
// relative; LRA is the spread between their 10th and 95th percentiles.
export function loudnessRange(chans, rate) {
  const p = blocks(chans, rate, 30);
  if (!p) return null;
  const g1 = p.filter((v) => loud(v) > -70);
  if (!g1.length) return null;
  let acc = 0;
  for (const v of g1) acc += v;
  const rel = loud(acc / g1.length) - 20;
  const ls = g1.filter((v) => loud(v) > rel).map(loud).sort((a, b) => a - b);
  const pct = (q) => ls[Math.min(ls.length - 1, Math.max(0, Math.round((q / 100) * (ls.length - 1))))];
  return pct(95) - pct(10);
}

// True peak: each channel is upsampled 4x by the polyphase interpolator and
// the largest magnitude of the interpolated samples is the peak (BS.1770 Annex 2).
export function truePeakLinear(chans) {
  const P = 4, taps = TP_FIR.length / P;
  let peak = 0;
  for (const x of chans) {
    const n = x.length;
    for (let i = 0; i < n + taps; i++) {
      for (let p = 0; p < P; p++) {
        let acc = 0;
        for (let k = 0; k < taps; k++) {
          const j = i - k;
          if (j >= 0 && j < n) acc += TP_FIR[p + P * k] * x[j];
        }
        const a = Math.abs(acc);
        if (a > peak) peak = a;
      }
    }
  }
  return peak;
}
export const truePeak = (chans) => { const p = truePeakLinear(chans); return p > 0 ? 20 * Math.log10(p) : null; };

export function samplePeak(chans) {
  let m = 0;
  for (const x of chans) for (let i = 0; i < x.length; i++) { const a = Math.abs(x[i]); if (a > m) m = a; }
  return m > 0 ? 20 * Math.log10(m) : null;
}

// Everything a mix report needs, in one pass per measure.
export function measure(chans, rate) {
  const st = shortTerm(chans, rate), mo = momentary(chans, rate);
  const max = (a) => a.reduce((m, v) => (v !== null && (m === null || v > m) ? v : m), null);
  return {
    meter: METER, true_peak_meter: TRUE_PEAK,
    integrated_lufs: nullIfInf(integrated(chans, rate) ?? -Infinity),
    loudness_range_lu: loudnessRange(chans, rate),
    max_momentary_lufs: max(mo), max_short_term_lufs: max(st),
    true_peak_dbtp: truePeak(chans), sample_peak_dbfs: samplePeak(chans),
  };
}
