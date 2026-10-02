// resample-int.mjs: the Telos resampling filter `resample-int/v1` (Track A steps T4 and T6).
//
// Browsers pick their own drawImage kernel, so a packet built from a browser-resized frame changes with
// the browser. This filter is an exact-area box filter in linear light, computed in integers: each
// output pixel is the area-weighted mean of the Q24 linear values of the source pixels it covers, rounded
// half up. Along x, output column X covers source span [X w / w2, (X + 1) w / w2); in units of 1 / w2 of a
// source pixel the overlap of X with source column i is an integer, so every weight and every sum is an
// exact integer below 2^53 for frames up to 2^24 pixels. Node, every browser and the Python twin
// (tests/telos-track-a/py/resample_int.py) therefore return identical values. ASCII only.
import { floorDiv } from "./oklab-int.mjs";

export const RESAMPLE_SCHEMA = "resample-int/v1";

// Integer overlap of each output index with each source index along one axis: rows of [i0, weights...].
function axisWeights(src, dst) {
  const out = [];
  for (let X = 0; X < dst; X++) {
    const a = X * src, b = (X + 1) * src; // output span in units of 1/dst source pixel
    const i0 = floorDiv(a, dst), i1 = floorDiv(b - 1, dst);
    const w = [];
    for (let i = i0; i <= i1; i++) w.push(Math.min(b, (i + 1) * dst) - Math.max(a, i * dst));
    out.push({ i0, w });
  }
  return out;
}

// Resample Q24 linear planes (Float64Array, w * h * 3) to w2 x h2. Returns a new Float64Array.
export function resampleAreaLinear(lin, w, h, w2, h2) {
  if (!(w >= 1 && h >= 1 && w2 >= 1 && h2 >= 1)) throw new Error("resampleAreaLinear: sizes must be >= 1");
  if (w * h > 16777216 || w2 * h2 > 16777216) throw new Error("resampleAreaLinear: image_too_large");
  const ax = axisWeights(w, w2), ay = axisWeights(h, h2);
  // Horizontal pass: tmp[y][X] = sum_i ox * lin (integer, <= 2^24 * w).
  const tmp = new Float64Array(h * w2 * 3);
  for (let y = 0; y < h; y++) {
    for (let X = 0; X < w2; X++) {
      const { i0, w: wx } = ax[X];
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < wx.length; k++) {
        const q = (y * w + i0 + k) * 3, f = wx[k];
        r += f * lin[q]; g += f * lin[q + 1]; b += f * lin[q + 2];
      }
      const t = (y * w2 + X) * 3;
      tmp[t] = r; tmp[t + 1] = g; tmp[t + 2] = b;
    }
  }
  // Vertical pass and normalisation by the total weight w * h, rounded half up.
  const out = new Float64Array(w2 * h2 * 3);
  const den = 2 * w * h;
  for (let Y = 0; Y < h2; Y++) {
    const { i0, w: wy } = ay[Y];
    for (let X = 0; X < w2; X++) {
      let r = 0, g = 0, b = 0;
      for (let k = 0; k < wy.length; k++) {
        const t = ((i0 + k) * w2 + X) * 3, f = wy[k];
        r += f * tmp[t]; g += f * tmp[t + 1]; b += f * tmp[t + 2];
      }
      const o = (Y * w2 + X) * 3;
      out[o] = floorDiv(2 * r + w * h, den);
      out[o + 1] = floorDiv(2 * g + w * h, den);
      out[o + 2] = floorDiv(2 * b + w * h, den);
    }
  }
  return out;
}

// Output size for a scale factor s: max(1, round half up of w s) by max(1, round half up of h s).
// s is passed as a rational num / den so the rounding is exact.
export function scaledSize(w, h, num, den) {
  return [Math.max(1, floorDiv(2 * w * num + den, 2 * den)), Math.max(1, floorDiv(2 * h * num + den, 2 * den))];
}

// Output size for a long-edge target: the long edge becomes `longEdge`, the other side scales with it.
export function longEdgeSize(w, h, longEdge) {
  const L = Math.max(w, h);
  return scaledSize(w, h, longEdge, L);
}
