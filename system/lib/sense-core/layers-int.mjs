// layers-int.mjs: Telos layer text on the integer OKLab path, `oklab-int/v2`.
//
// The layer encoders behind the resolution spec's token budgets were a Python prototype; this is the
// Telos JavaScript twin, and layers_int.py in the site repository is its Python twin. Both are built on
// integers only, so they produce byte-identical text on every image (checked on the 36 audit frames
// and 1,000 seeded random images). Layers:
//   L0  frame size, achromatic flag (chroma p95 < 0.02), L8 bins at p5/p50/p95 (nearest rank),
//       chroma p95 in thousandths (integer square root). The prototype's mean hue angle is left out
//       because it needs atan2.
//   L1  OKLab L on 8 x 8 cells, a and b on 4 x 4 cells, 6 bits each, 64-symbol alphabet.
//   L2  chromatic branch at N: L on N x N cells, a and b on N/2 x N/2, 6 bits, 64-symbol alphabet;
//       achromatic branch at N: L only, 8 bits, hex.
// Cell values are OKLab of the cell's mean colour in linear light (Q24 means, rounded half up).
// Every layer also runs on Q24 linear planes (the output of resample-int.mjs), L0 takes an
// optional keep(i) predicate (pixels outside drawn overlays), and L3 lists caller overlays. The byte path
// gives the same text as before: it maps bytes through LIN_Q24 and runs the linear path.
// ASCII only.
import { LIN_Q24, oklabQ36FromLinearQ24, binQ36, floorDiv, isqrt, OKLAB_INT_SCHEMA } from "./oklab-int.mjs";

export const LAYER_TEXT_SCHEMA = "oklab-int/v2";
export const B64_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-_";
export const L1_CELLS = 8;
export const L2_CHROMATIC_N = Object.freeze([12, 32]);
export const L2_ACHROMATIC_N = Object.freeze([16, 24]);

// Q24 linear planes of an sRGB byte image: Float64Array of w * h * 3 exact integers.
export function linearQ24FromRgba(px, w, h, ch = 4) {
  const lin = new Float64Array(w * h * 3);
  for (let i = 0; i < w * h; i++) {
    const o = i * ch, q = i * 3;
    lin[q] = LIN_Q24[px[o]]; lin[q + 1] = LIN_Q24[px[o + 1]]; lin[q + 2] = LIN_Q24[px[o + 2]];
  }
  return lin;
}

// Integral images of the Q24 linear channels: (w + 1) x (h + 1) per channel, exact integer sums.
function integralLinear(lin, w, h) {
  const W = w + 1;
  const S = [new Float64Array(W * (h + 1)), new Float64Array(W * (h + 1)), new Float64Array(W * (h + 1))];
  for (let y = 0; y < h; y++) {
    let rr = 0, rg = 0, rb = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      rr += lin[i]; rg += lin[i + 1]; rb += lin[i + 2];
      const o = (y + 1) * W + (x + 1), up = y * W + (x + 1);
      S[0][o] = S[0][up] + rr; S[1][o] = S[1][up] + rg; S[2][o] = S[2][up] + rb;
    }
  }
  return { S, W };
}

// Q24 mean linear colour of each cell of a rows x cols grid (floor-based bounds, as the site's other
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

// L0: per-pixel integer OKLab statistics over the pixels keep(i) admits (all pixels when keep is null).
export function layerL0Linear(lin, w, h, keep = null) {
  const L8 = [], S2 = [];
  for (let i = 0; i < w * h; i++) {
    if (keep && !keep(i)) continue;
    const q = i * 3;
    const [L, a, b] = oklabQ36FromLinearQ24(lin[q], lin[q + 1], lin[q + 2]);
    L8.push(binQ36(L, "L", 8));
    const a16 = floorDiv(a + 524288, 1048576), b16 = floorDiv(b + 524288, 1048576);
    S2.push(a16 * a16 + b16 * b16);
  }
  const n = L8.length;
  if (n === 0) throw new Error("layerL0: no pixel admitted (overlay_covers_frame)");
  const L8s = Int32Array.from(L8).sort(), S2s = Float64Array.from(S2).sort();
  const rank = (p) => floorDiv((n - 1) * p, 100);
  const s95 = S2s[rank(95)];
  const achromatic = s95 * 2500 < 4294967296 ? 1 : 0; // sqrt(s95) / 65536 < 0.02, exactly
  const c95milli = floorDiv(isqrt(s95) * 1000 + 32768, 65536);
  return {
    achromatic,
    text: `L0 ${w}x${h} srgb8 declared:unverified achromatic:${achromatic} `
      + `L8p5/50/95:${L8s[rank(5)]}/${L8s[rank(50)]}/${L8s[rank(95)]} chroma-p95-milli:${c95milli}`,
  };
}

export function layerL0(px, w, h, ch = 4) {
  return layerL0Linear(linearQ24FromRgba(px, w, h, ch), w, h);
}

function chromaticLayer(tag, I, w, h, n) {
  const m = Math.max(1, floorDiv(n, 2));
  const Lv = cellMeans(I, w, h, n, n).map(([r, g, b]) => binQ36(oklabQ36FromLinearQ24(r, g, b)[0], "L", 6));
  const ab = cellMeans(I, w, h, m, m).map(([r, g, b]) => {
    const [, A, B] = oklabQ36FromLinearQ24(r, g, b);
    return b64(binQ36(A, "a", 6)) + b64(binQ36(B, "b", 6));
  });
  return `${tag} ${LAYER_TEXT_SCHEMA} cells:${n}x${n} chroma:${m}x${m} bits:L6,ab6 alphabet:b64\nL:\n`
    + gridRows(Lv, n, n, b64, "") + "\nab:\n" + gridRows(ab, m, m, (s) => s, " ");
}

function achromaticLayer(I, w, h, n) {
  const Lv = cellMeans(I, w, h, n, n).map(([r, g, b]) => binQ36(oklabQ36FromLinearQ24(r, g, b)[0], "L", 8));
  return `L2 ${LAYER_TEXT_SCHEMA} cells:${n}x${n} bits:L8 alphabet:hex branch:achromatic\n` + gridRows(Lv, n, n, hex2, "");
}

// Every layer and both L2 branches, for conformance. The packet a reader gets carries one branch,
// chosen by the L0 achromatic flag (layerPacket below).
export function layerTextAll(px, w, h, ch = 4) {
  const lin = linearQ24FromRgba(px, w, h, ch);
  const I = integralLinear(lin, w, h);
  const parts = [layerL0Linear(lin, w, h).text, chromaticLayer("L1", I, w, h, L1_CELLS)];
  for (const n of L2_CHROMATIC_N) parts.push(chromaticLayer("L2", I, w, h, n));
  for (const n of L2_ACHROMATIC_N) parts.push(achromaticLayer(I, w, h, n));
  return parts.join("\n") + "\n";
}

// L0, L1 and the L2 branch the achromatic flag selects, on Q24 linear planes. n is the chromatic N; the
// achromatic branch uses floor(n / 2) cells per side at 8 bits.
// opts.keep restricts L0 to the pixels it admits; opts.layers picks among "L0", "L1", "L2".
export function layerPacketLinear(lin, w, h, n = 32, opts = {}) {
  const want = new Set(opts.layers || ["L0", "L1", "L2"]);
  const I = integralLinear(lin, w, h);
  const l0 = layerL0Linear(lin, w, h, opts.keep || null);
  const out = { schema: OKLAB_INT_SCHEMA, achromatic: l0.achromatic, layers: {} };
  if (want.has("L0")) out.layers.L0 = l0.text;
  if (want.has("L1")) out.layers.L1 = chromaticLayer("L1", I, w, h, L1_CELLS);
  if (want.has("L2")) out.layers.L2 = l0.achromatic ? achromaticLayer(I, w, h, Math.max(1, floorDiv(n, 2))) : chromaticLayer("L2", I, w, h, n);
  out.text = ["L0", "L1", "L2"].filter((k) => k in out.layers).map((k) => out.layers[k]).join("\n") + "\n";
  return out;
}

export function layerPacket(px, w, h, ch = 4, n = 32) {
  const p = layerPacketLinear(linearQ24FromRgba(px, w, h, ch), w, h, n);
  return { schema: p.schema, achromatic: p.achromatic, text: p.text };
}

// L3, overlay-only form: one line per caller overlay with its inclusive pixel bbox and its area in
// thousandths of the frame (round half up). mask: w * h bytes, nonzero inside. An empty mask lists
// bbox "none".
export function layerL3Overlays(overlays, w, h) {
  const lines = [`L3 overlays:${overlays.length} coords:px bbox:x0,y0,x1,y1 area:permille`];
  for (const o of overlays) {
    let x0 = w, y0 = h, x1 = -1, y1 = -1, count = 0;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (!o.mask[y * w + x]) continue;
      count++;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const permille = floorDiv(2000 * count + w * h, 2 * w * h);
    const box = count ? `${x0},${y0},${x1},${y1}` : "none";
    lines.push(`region id:${o.id} bbox:${box} area:${permille} overlay:true`);
  }
  return lines.join("\n");
}
