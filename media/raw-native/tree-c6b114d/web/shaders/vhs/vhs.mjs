// VHS, simulated in the signal domain (CPU reference of vhs.wgsl.mjs).
//
// A line of R'G'B' is sampled at 4 fsc (NTSC) and split into luma and chroma, as the deck does:
//  - luma is recorded as FM: its bandwidth is about 3 MHz in SP and less at slower speeds, the
//    deck's emphasis leaves ringing at edges, and FM noise rises with frequency, so it shows as
//    fine horizontal streaks;
//  - chroma is recorded "colour-under" at a few hundred kHz with about half a MHz of bandwidth,
//    so colour smears sideways; it lags the luma by a fraction of a microsecond, carries low-
//    frequency noise that streaks along the line, and its phase wobbles line to line (hue);
//  - the transport's time base wanders, so each line is displaced sideways; the head switch a few
//    lines before vertical sync skews the bottom of the picture;
//  - oxide dropouts lose short runs of a line, which the deck's dropout compensator fills from the
//    line above; a mistracked tape puts a rolling band of noise and displacement across the frame.
// Generations multiply the losses. Output: R'G'B' signal values (lines x N), ready for a display
// encode or for the CRT's composite input.
import { lowpassTaps, gaussTaps } from "../common.mjs";
import { hash3 } from "../common.mjs";
import { YIQ, YIQ_INV } from "../crt/signal.mjs";

export const VHS_PRESETS = {
  "sp-fresh": { lumaMHz: 3.0, chromaMHz: 0.5, lumaNoise: 0.012, chromaNoise: 0.01, jitter: 0.25, peaking: 0.35, dropouts: 0.002, chromaDelayNs: 150, phaseNoiseDeg: 1.5, generations: 1 },
  "lp-worn": { lumaMHz: 2.5, chromaMHz: 0.45, lumaNoise: 0.022, chromaNoise: 0.018, jitter: 0.6, peaking: 0.4, dropouts: 0.012, chromaDelayNs: 220, phaseNoiseDeg: 3, generations: 1 },
  "ep-rental": { lumaMHz: 2.2, chromaMHz: 0.4, lumaNoise: 0.03, chromaNoise: 0.028, jitter: 1.0, peaking: 0.45, dropouts: 0.02, chromaDelayNs: 260, phaseNoiseDeg: 4, generations: 3, tracking: 0.6 },
  // Template (c): a worn LP copy, quiet but uneasy; tune toward the author's reference frames.
  thriller: { lumaMHz: 2.4, chromaMHz: 0.42, lumaNoise: 0.02, chromaNoise: 0.016, jitter: 0.7, peaking: 0.42, dropouts: 0.008, chromaDelayNs: 240, phaseNoiseDeg: 3.5, generations: 2, tracking: 0.0 },
};
const base = { fsc: 315 / 88, pixelClockMHz: 13.5, headSwitchLines: 6, headSkew: 6, tracking: 0, seed: 1 };

export function resolveVhs(preset, overrides, src) {
  const p = { ...base, ...(VHS_PRESETS[preset] || preset), ...(overrides || {}) }, fs = 4 * p.fsc;
  const g = Math.max(1, p.generations), N = Math.max(1, Math.round((src.w * fs) / p.pixelClockMHz));
  // Each generation re-records: bandwidths fall roughly as 1/sqrt(g), noise powers add.
  const lumaMHz = p.lumaMHz / Math.sqrt(g), chromaMHz = p.chromaMHz / Math.sqrt(g);
  return { p, fs, N, src, lines: src.h, g,
    // Luma: a windowed sinc long enough that its transition is narrower than its passband (the FM
    // channel's edge, with some ringing). Chroma: gaussian, down 3 dB at the colour-under bandwidth,
    // as a smooth analogue chain is (a narrow sinc would ring by several percent).
    taps: { luma: lowpassTaps(Math.min(0.49, lumaMHz / fs), 32), peak: lowpassTaps(Math.min(0.49, (lumaMHz * 0.45) / fs), 32), chroma: gaussTaps(chromaMHz / fs) },
    lumaNoise: p.lumaNoise * Math.sqrt(g), chromaNoise: p.chromaNoise * Math.sqrt(g), delay: (p.chromaDelayNs * 1e-3 * fs), phaseNoise: (p.phaseNoiseDeg * Math.PI) / 180 * Math.sqrt(g) };
}

export const gauss = (a, b, c) => { const u1 = Math.max(1e-7, hash3(a, b, c)), u2 = hash3(a, b, c + 7919); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); };
// Time-base displacement of line y in samples: slow wander plus line-to-line jitter, and the head
// switch's skew in the bottom lines; inside the tracking band, a larger shove.
export function lineShift(plan, y, f) {
  const { p, lines } = plan, s = p.seed;
  let d = p.jitter * (0.6 * Math.sin(y * 0.031 + f * 0.7 + s) + 0.4 * gauss(y, f, 11 + s));
  const fromBottom = lines - 1 - y;
  if (fromBottom < p.headSwitchLines) d += p.headSkew * ((p.headSwitchLines - fromBottom) / p.headSwitchLines) ** 2;
  if (p.tracking > 0) { const band = trackingBand(plan, y, f); d += band * 12 * gauss(y, f, 23 + s); }
  return d;
}
// 0..1 strength of the mistracking band at line y, rolling up the frame.
export function trackingBand(plan, y, f) {
  const { p, lines } = plan, c = ((f * 3.7) % (lines + 40)) - 20, d = Math.abs(y - c) / 6;
  return p.tracking * Math.max(0, 1 - d * d);
}
const heldYiq = (plan, src, y, k) => {
  const kk = Math.min(plan.N - 1, Math.max(0, k)), x = Math.min(src.width - 1, Math.max(0, Math.floor(((kk + 0.5) * src.width) / plan.N))), i = (y * src.width + x) * 4;
  const r = src.data[i], g = src.data[i + 1], b = src.data[i + 2];
  return [YIQ[0] * r + YIQ[1] * g + YIQ[2] * b, YIQ[3] * r + YIQ[4] * g + YIQ[5] * b, YIQ[6] * r + YIQ[7] * g + YIQ[8] * b];
};
const fir = (taps, get, k) => { const h = (taps.length - 1) / 2; let s = 0; for (let j = -h; j <= h; j++) s += taps[j + h] * get(k + j); return s; };

// Pass 1: the transport. Each line sampled with its time-base displacement, as Y'IQ.
export function sample(plan, src, f) {
  const { N, lines } = plan, out = new Float32Array(N * lines * 4);
  for (let y = 0; y < lines; y++) {
    const sh = lineShift(plan, y, f);
    for (let k = 0; k < N; k++) {
      const kf = k - sh, k0 = Math.floor(kf), t = kf - k0, a = heldYiq(plan, src, y, k0), b = heldYiq(plan, src, y, k0 + 1);
      out.set([a[0] * (1 - t) + b[0] * t, a[1] * (1 - t) + b[1] * t, a[2] * (1 - t) + b[2] * t, 0], (y * N + k) * 4);
    }
  }
  return out;
}
// Pass 2: the tape. Luma through the FM channel (bandwidth, emphasis ringing, rising noise);
// chroma through colour-under (narrow bandwidth, delay, streaky noise, phase wobble).
export function tape(plan, sm, f) {
  const { N, lines, taps } = plan, out = new Float32Array(N * lines * 4), s = plan.p.seed;
  for (let y = 0; y < lines; y++) {
    const rot = plan.phaseNoise * gauss(y, f, 31 + s), cr = Math.cos(rot), sr = Math.sin(rot);
    const at = (k, c) => { const kf = Math.min(N - 1, Math.max(0, k)), k0 = Math.floor(kf), t = kf - k0, k1 = Math.min(N - 1, k0 + 1); return sm[(y * N + k0) * 4 + c] * (1 - t) + sm[(y * N + k1) * 4 + c] * t; };
    for (let k = 0; k < N; k++) {
      const Y = fir(taps.luma, (kk) => at(kk, 0), k), Yl = fir(taps.peak, (kk) => at(kk, 0), k), gk = y * 4096 + k;
      const n = plan.lumaNoise * (gauss(gk, f, 41 + s) - 0.5 * (gauss(gk - 1, f, 41 + s) + gauss(gk + 1, f, 41 + s)));
      const Yo = Y + plan.p.peaking * (Y - Yl) + n;
      const kd = k - plan.delay, I = fir(taps.chroma, (kk) => at(kk, 1), kd), Q = fir(taps.chroma, (kk) => at(kk, 2), kd);
      // Chroma noise: random values every 24 samples along the line, interpolated (streaks).
      const m = k / 24, m0 = Math.floor(m), t = m - m0, cn = (c) => plan.chromaNoise * ((1 - t) * gauss(y, m0, 53 + c + s) + t * gauss(y, m0 + 1, 53 + c + s));
      const band = plan.p.tracking > 0 ? trackingBand(plan, y, f) : 0, tn = band * 0.5 * gauss(gk, f, 61 + s);
      out.set([Yo + tn, I * cr - Q * sr + cn(0), I * sr + Q * cr + cn(1), 0], (y * N + k) * 4);
    }
  }
  return out;
}
// Pass 2: dropouts filled from the line above (the deck's compensator), then R'G'B'.
export function playback(plan, tp, f) {
  const { N, lines } = plan, out = new Float32Array(N * lines * 4);
  for (let y = 0; y < lines; y++) for (let k = 0; k < N; k++) {
    const seg = Math.floor(k / 64), hit = hash3(y, seg, f * 131 + 71) < plan.p.dropouts * plan.g, run = hash3(y, seg, f * 131 + 73) * 64;
    const drop = hit && k - seg * 64 < run && y > 0, q = (drop ? y - 1 : y) * N + k;
    const Y = tp[q * 4], I = tp[q * 4 + 1], Q = tp[q * 4 + 2], M = YIQ_INV;
    out.set([M[0] * Y + M[1] * I + M[2] * Q, M[3] * Y + M[4] * I + M[5] * Q, M[6] * Y + M[7] * I + M[8] * Q, drop ? 1 : 0], (y * N + k) * 4);
  }
  return out;
}
// Display: the signal lines resampled to an output size (linear across, each line held down).
export function toDisplay(plan, sig, w, h) {
  const { N, lines } = plan, o = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ly = Math.min(lines - 1, Math.floor((y * lines) / h)), kf = ((x + 0.5) * N) / w - 0.5, k0 = Math.max(0, Math.min(N - 1, Math.floor(kf))), k1 = Math.min(N - 1, k0 + 1), t = Math.min(1, Math.max(0, kf - k0));
    for (let c = 0; c < 3; c++) { const v = sig[(ly * N + k0) * 4 + c] * (1 - t) + sig[(ly * N + k1) * 4 + c] * t; o[(y * w + x) * 4 + c] = Math.floor(Math.min(1, Math.max(0, v)) * 255 + 0.5); }
    o[(y * w + x) * 4 + 3] = 255;
  }
  return o;
}
export function createVhs(preset, overrides, src) {
  const plan = resolveVhs(preset, overrides, src);
  return { plan, frame(srcFrame, f = 0) { const tp = tape(plan, sample(plan, srcFrame, f), f); return { tp, sig: playback(plan, tp, f) }; } };
}
