// Distill, a picture by colour: the study the front page shows, run by the same code on the fixed example and on a
// visitor's own picture. The palette is The Playground's study palette (superframe/lib/study/palette.mjs, taken at a
// pinned commit): weighted k-means in CIELAB over a histogram of the pixels, with a named seed, so the same pixels
// always give the same swatches. This file adds the three things the panel shows beside it: where the colour sits
// around the hue circle, the picture rebuilt from the swatches alone, and how far the rebuild is from the original.
// Pure: no DOM. It takes pixels (RGBA bytes) and returns numbers and pixels.
import { palette, binOf } from "../../../media/raw-native/pick-e025300/superframe/lib/study/palette.mjs";
import { rgb8ToLab, lch, dE76, hex } from "../../../media/raw-native/pick-e025300/superframe/lib/study/cmath.mjs";

export const READ_WIDTH = 640;        // a larger picture is read at this width
export const STEP = 2.3;              // delta E (CIE76) of about one just noticeable difference
export const HUE_BINS = 36;
// a bar's height for a hue's weight: the square root, so a thin band of strong colour still shows beside a large
// field of one hue; a taller bar always means more of that hue
export const barOf = (weight) => (weight > 0 ? Math.sqrt(weight) : 0);
const r1 = (v) => Math.round(v * 10) / 10, r3 = (v) => Math.round(v * 1000) / 1000;

export function study(rgba, w, h, { k = 10 } = {}) {
  const pal = palette({ rgba, w, h }, { k, seed: "study/palette" });
  const n = w * h, rebuilt = new Uint8ClampedArray(rgba.length), labOf = new Map();
  const hueW = new Float64Array(HUE_BINS), hueRgb = Array.from({ length: HUE_BINS }, () => [0, 0, 0]);
  let sum = 0, within = 0, far = 0, max = 0, opaque = 0, chroma = 0;
  for (let i = 0; i < n; i++) {
    const p = 4 * i, R = rgba[p], G = rgba[p + 1], B = rgba[p + 2];
    if (rgba[p + 3] < 128) continue;
    const key = (R << 16) | (G << 8) | B;
    let lab = labOf.get(key); if (!lab) { lab = rgb8ToLab(R, G, B); labOf.set(key, lab); }
    const sw = pal.swatches[pal.binToSwatch.get(binOf(R, G, B))];
    rebuilt[p] = sw.rgb[0]; rebuilt[p + 1] = sw.rgb[1]; rebuilt[p + 2] = sw.rgb[2]; rebuilt[p + 3] = 255;
    const d = dE76(lab, sw.lab); sum += d; if (d <= STEP) within++; if (d > 10) far++; if (d > max) max = d; opaque++;
    // the hue circle: each pixel adds its chroma (how far it is from grey) to the bin of its hue
    const [, C, hue] = lch(lab), b = Math.min(HUE_BINS - 1, Math.floor((((hue % 360) + 360) % 360) / (360 / HUE_BINS)));
    hueW[b] += C; chroma += C; const t = hueRgb[b]; t[0] += R * C; t[1] += G * C; t[2] += B * C;
  }
  const top = Math.max(...hueW, 1e-9);
  return {
    width: w, height: h, pixels: opaque,
    swatches: pal.swatches.map((s) => ({ hex: s.hex, share: r1(s.share * 100) })),
    spectrum: [...hueW].map((v, b) => ({ hue: b * (360 / HUE_BINS), weight: r3(v / top), share: r3(chroma ? v / chroma : 0), hex: v ? hex(hueRgb[b].map((c) => Math.round(c / v))) : "#808080" })),
    difference: opaque ? { mean: r1(sum / opaque), within: r1((within / opaque) * 100), far: r1((far / opaque) * 100), max: r1(max) } : null,
    rebuilt,
  };
}

// The difference in plain words. Every number in the sentence is one the study measured.
export function differenceWords(d, count = 10) {
  if (!d) return "This picture has no opaque pixels to measure.";
  const size = d.mean <= STEP ? "smaller than the smallest step most people can see" : d.mean <= 5 ? "a step you can see when the two sit side by side" : d.mean <= 10 ? "a clear change of colour" : "a large change of colour";
  return `${count === 10 ? "Ten" : count} swatches bring back ${d.within} percent of the picture to within the smallest step most people can see. Across the whole picture the average miss is ${d.mean} (delta E, where ${STEP} is about that smallest step): ${size}. ${d.far === 0 ? "No part" : `${d.far} percent`} of the picture is off by more than 10, and that is the colour ${count === 10 ? "ten" : count} swatches cannot carry.`;
}
export function partsWords(s) {
  const lead = s.swatches[0];
  return `${s.swatches.length} swatches. The largest, ${lead.hex}, covers ${lead.share} percent of the picture.`;
}
