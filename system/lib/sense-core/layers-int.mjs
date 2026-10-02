// layers-int.mjs: Telos layer text on the integer OKLab path, `oklab-int/v1` (Track A step T3).
//
// The layer encoders behind the resolution spec's token budgets were a Python prototype; this is the
// Telos JavaScript twin, and tests/telos-track-a/py/layers_int.py is its Python twin. Both are built on
// integers only, so they produce byte-identical text on every image (checked on the 36 audit frames
// and 1,000 seeded random images). Layers:
//   L0  frame size, achromatic flag (chroma p95 < 0.02), L8 bins at p5/p50/p95 (nearest rank),
//       chroma p95 in thousandths (integer square root). The prototype's mean hue angle is left out
//       because it needs atan2.
//   L1  OKLab L on 8 x 8 cells, a and b on 4 x 4 cells, 6 bits each, 64-symbol alphabet.
//   L2  chromatic branch at N: L on N x N cells, a and b on N/2 x N/2, 6 bits, 64-symbol alphabet;
//       achromatic branch at N: L only, 8 bits, hex.
// Cell values are OKLab of the cell's mean colour in linear light (Q20 means, rounded half up).
// ASCII only.
import { LIN_Q20, oklabQ36FromLinearQ20, binQ36, floorDiv, isqrt, OKLAB_INT_SCHEMA } from "./oklab-int.mjs";

export const LAYER_TEXT_SCHEMA = "oklab-int/v1";
export const B64_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
export const L1_CELLS = 8;
export const L2_CHROMATIC_N = Object.freeze([12, 32]);
export const L2_ACHROMATIC_N = Object.freeze([16, 24]);

// Integral images of the Q20 linear channels: (w + 1) x (h + 1) per channel, exact integer sums.
function integralLinear(px, w, h, ch) {
  const W = w + 1;
  const S = [new Float64Array(W * (h + 1)), new Float64Array(W * (h + 1)), new Float64Array(W * (h + 1))];
  for (let y = 0; y < h; y++) {
    let rr = 0, rg = 0, rb = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * ch;
      rr += LIN_Q20[px[i]]; rg += LIN_Q20[px[i + 1]]; rb += LIN_Q20[px[i + 2]];
      const o = (y + 1) * W + (x + 1), up = y * W + (x + 1);
      S[0][o] = S[0][up] + rr; S[1][o] = S[1][up] + rg; S[2][o] = S[2][up] + rb;
    }
  }
  return { S, W };
}

// Q20 mean linear colour of each cell of a rows x cols grid (floor-based bounds, as the site's other
// grids), rounded half up. Returns an array of [r, g, b], row-major.
function cellMeans(I, w, h, rows, cols) {
  const { S, W } = I;
  const out = [];
  for (let r = 0; r < rows; r++) {
    const y0 = floorDiv(r * h, rows), y1 = Math.max(y0 + 1, floorDiv((r + 1) * h, rows));
    for (let c = 0; c < cols; c++) {
      const x0 = floorDiv(c * w, cols), x1 = Math.max(x0 + 1, floorDiv((c + 1) * w, cols));
      const count = (y1 - y0) * (x1 - x0);
      const cell = [];
      for (let k = 0; k < 3; k++) {
        const s = S[k][y1 * W + x1] - S[k][y0 * W + x1] - S[k][y1 * W + x0] + S[k][y0 * W + x0];
        cell.push(floorDiv(2 * s + count, 2 * count));
      }
      out.push(cell);
    }
  }
  return out;
}

const b64 = (v) => B64_ALPHABET[v];
const hex2 = (v) => v.toString(16).padStart(2, "0");

function gridRows(values, rows, cols, fmt, sep) {
  const lines = [];
  for (let r = 0; r < rows; r++) lines.push(values.slice(r * cols, (r + 1) * cols).map(fmt).join(sep));
  return lines.join("\n");
}

// L0: per-pixel integer OKLab statistics.
export function layerL0(px, w, h, ch = 4) {
  const n = w * h;
  const L8 = new Int32Array(n), S2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const o = i * ch;
    const [L, a, b] = oklabQ36FromLinearQ20(LIN_Q20[px[o]], LIN_Q20[px[o + 1]], LIN_Q20[px[o + 2]]);
    L8[i] = binQ36(L, "L", 8);
    const a16 = floorDiv(a + 524288, 1048576), b16 = floorDiv(b + 524288, 1048576);
    S2[i] = a16 * a16 + b16 * b16;
  }
  L8.sort();
  S2.sort();
  const rank = (p) => floorDiv((n - 1) * p, 100);
  const s95 = S2[rank(95)];
  const achromatic = s95 * 2500 < 4294967296 ? 1 : 0; // sqrt(s95) / 65536 < 0.02, exactly
  const c95milli = floorDiv(isqrt(s95) * 1000 + 32768, 65536);
  return {
    achromatic,
    text: `L0 ${w}x${h} srgb8 declared:unverified achromatic:${achromatic} `
      + `L8p5/50/95:${L8[rank(5)]}/${L8[rank(50)]}/${L8[rank(95)]} chroma-p95-milli:${c95milli}`,
  };
}

function chromaticLayer(tag, I, w, h, n) {
  const m = Math.max(1, floorDiv(n, 2));
  const Lv = cellMeans(I, w, h, n, n).map(([r, g, b]) => binQ36(oklabQ36FromLinearQ20(r, g, b)[0], "L", 6));
  const ab = cellMeans(I, w, h, m, m).map(([r, g, b]) => {
    const [, A, B] = oklabQ36FromLinearQ20(r, g, b);
    return b64(binQ36(A, "a", 6)) + b64(binQ36(B, "b", 6));
  });
  return `${tag} ${LAYER_TEXT_SCHEMA} cells:${n}x${n} chroma:${m}x${m} bits:L6,ab6 alphabet:b64\nL:\n`
    + gridRows(Lv, n, n, b64, "") + "\nab:\n" + gridRows(ab, m, m, (s) => s, " ");
}

function achromaticLayer(I, w, h, n) {
  const Lv = cellMeans(I, w, h, n, n).map(([r, g, b]) => binQ36(oklabQ36FromLinearQ20(r, g, b)[0], "L", 8));
  return `L2 ${LAYER_TEXT_SCHEMA} cells:${n}x${n} bits:L8 alphabet:hex branch:achromatic\n` + gridRows(Lv, n, n, hex2, "");
}

// Every layer and both L2 branches, for conformance. The packet a reader gets carries one branch,
// chosen by the L0 achromatic flag (layerPacket below).
export function layerTextAll(px, w, h, ch = 4) {
  const I = integralLinear(px, w, h, ch);
  const parts = [layerL0(px, w, h, ch).text, chromaticLayer("L1", I, w, h, L1_CELLS)];
  for (const n of L2_CHROMATIC_N) parts.push(chromaticLayer("L2", I, w, h, n));
  for (const n of L2_ACHROMATIC_N) parts.push(achromaticLayer(I, w, h, n));
  return parts.join("\n") + "\n";
}

// L0, L1 and the L2 branch the achromatic flag selects, at grid size n (n is the chromatic N; the
// achromatic branch uses n / 2 cells per side at 8 bits, which costs about the same tokens).
export function layerPacket(px, w, h, ch = 4, n = 32) {
  const I = integralLinear(px, w, h, ch);
  const l0 = layerL0(px, w, h, ch);
  const l2 = l0.achromatic ? achromaticLayer(I, w, h, Math.max(1, floorDiv(n, 2))) : chromaticLayer("L2", I, w, h, n);
  return { schema: OKLAB_INT_SCHEMA, achromatic: l0.achromatic, text: [l0.text, chromaticLayer("L1", I, w, h, L1_CELLS), l2].join("\n") + "\n" };
}
