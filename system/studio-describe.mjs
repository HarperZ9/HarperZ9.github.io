// studio-describe.mjs: the words for the Studio's live readouts, computed from the numbers they draw.
//   motionDescription(hist)         the motion sparkline: hist[i] is the hash change (0..1 of 64 bits) of measured
//                                   frame i, oldest first; the last entry is now
//   spectrumDescription(bars, hzPer) the audio strip: bars[i] in 0..1 is the linear band i, hzPer hertz wide
//   bandDescription(features)       the strip in the music view, built from bass, mid and treble levels
import { describeCurve, describeRows, sig } from "./chart-describe.mjs";
import { describeSpectrum } from "./chart-describe-sound.mjs";

// x is frames before now; "at now" reads badly, so the formatter carries its own "at" form.
const ago = Object.assign((x) => (x === 0 ? "now" : `${-x} frames ago`), { at: (x) => (x === 0 ? "now" : `${-x} frames ago`) });

export function motionDescription(hist) {
  const n = hist.length, pts = Array.from(hist, (v, i) => [i - (n - 1), v]);
  return describeCurve(pts, { name: "Motion", x: { fmt: ago }, y: { fmt: (v) => `${Math.round(v * 64)} of 64 bits` } });
}

export function spectrumDescription(bars, hzPer) {
  return describeSpectrum(bars, (i) => (i + 0.5) * hzPer, { y: { fmt: sig } });
}

export function bandDescription(f) {
  return describeRows([{ label: "bass", value: f.bass || 0 }, { label: "mid", value: f.mid || 0 }, { label: "treble", value: f.treble || 0 }], { form: "bars", ordered: false });
}
