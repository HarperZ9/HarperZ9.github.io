// The film's one picture and every budget it is put through, computed on the CPU when the
// scene loads (pure, deterministic, runs in Node). The picture is a dusk sky over a lighthouse
// at VGA's 320 x 200: a smooth gradient from amber at the horizon to deep navy overhead, the
// case where banding shows worst, with a little grain, as a photograph has.
//
// Budgets: median cut to 256 colours (Heckbert's rule as script.md states it, in RGB), the 16
// EGA colours with no dither, raw-native's CPU reference of its dither pass (bayer8 and blue,
// web/shaders/dither/dither.mjs), and plain Floyd and Steinberg error diffusion (left to right,
// the four published weights, no clamp; nearest colour measured in Oklab).
import { ditherRef, resolvePalette, plateLab } from "../../../raw-native/tree-c6b114d/web/shaders/dither/dither.mjs";
import { nearestIndex } from "../../../raw-native/tree-c6b114d/web/shaders/reference/retro-palettes.mjs";
import { BAYER } from "../../../raw-native/tree-c6b114d/web/shaders/reference/retro-dither.mjs";
import { blueNoise64 } from "../../../raw-native/tree-c6b114d/web/shaders/dither/bluenoise.mjs";

export const W = 320, H = 200;
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const enc = (l) => { const c = Math.max(0, Math.min(1, l)); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// The dusk picture as sRGB bytes (RGBA). Colours are mixed in linear light.
export function dusk(seed = 1987) {
  const r = rng(seed), out = new Uint8Array(W * H * 4);
  const top = [0.006, 0.012, 0.05], mid = [0.09, 0.06, 0.16], low = [0.85, 0.36, 0.08], sea = [0.012, 0.02, 0.05];
  const HZ = 132;   // horizon row
  const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let c;
    if (y < HZ) {
      const u = y / HZ;   // 0 at the top, 1 at the horizon
      c = u < 0.55 ? mix(top, mid, (u / 0.55) ** 1.4) : mix(mid, low, ((u - 0.55) / 0.45) ** 1.8);
      // The sun's glow, just under the horizon to the left.
      const d = Math.hypot(x - 96, (y - HZ) * 1.6), g = Math.exp(-d / 46) * 0.5;
      c = c.map((v, i) => v + g * [1, 0.55, 0.2][i]);
    } else {
      const u = (y - HZ) / (H - HZ);
      c = mix([0.2, 0.09, 0.05], sea, u ** 0.6);
      // The sun's path on the water: a soft column that breaks into ripples.
      const w = Math.exp(-(((x - 96) / (10 + u * 26)) ** 2)) * (0.5 + 0.5 * Math.sin(y * 1.7 + x * 0.05)) * (1 - u) * 0.45;
      c = c.map((v, i) => v + w * [1, 0.5, 0.18][i]);
    }
    // The lighthouse on its rock, as a silhouette, with the lamp lit.
    const rock = y > HZ - 6 && y < HZ + 9 && Math.abs(x - 236) < 26 + (y - HZ + 6) * 1.6;
    const tower = x > 228 - (y - 60) * 0.04 && x < 244 + (y - 60) * 0.04 && y > 60 && y < HZ;
    const lamp = Math.abs(x - 236) < 7 && y > 50 && y <= 60;
    if (tower || rock) c = [0.01, 0.008, 0.012];
    if (lamp) c = [1.4, 1.0, 0.55];
    const beam = Math.exp(-(((x - 236) / 60) ** 2) - (((y - 55) / 9) ** 2)) * 0.18;
    c = c.map((v, i) => v + beam * [1, 0.85, 0.6][i]);
    const p = (y * W + x) * 4, n = (r() - 0.5) * 2.4 / 255;   // grain
    for (let i = 0; i < 3; i++) out[p + i] = Math.round(Math.max(0, Math.min(1, enc(c[i]) + n)) * 255);
    out[p + 3] = 255;
  }
  return out;
}

export function distinct(bytes) {
  const s = new Set();
  for (let p = 0; p < bytes.length; p += 4) s.add((bytes[p] << 16) | (bytes[p + 1] << 8) | bytes[p + 2]);
  return s.size;
}

// Median cut, Heckbert 1982 as the script states it: every colour in a box; cut the box at the
// median of its longest side; keep cutting the biggest piece (most pixels) until there are K
// boxes. Returns the boxes in the order they were made, each with its pixels' bounds and mean.
export function medianCut(bytes, K = 256) {
  const n = bytes.length / 4, idx = Array.from({ length: n }, (_, i) => i);
  const box = (ids) => {
    const lo = [255, 255, 255], hi = [0, 0, 0], sum = [0, 0, 0];
    for (const i of ids) for (let k = 0; k < 3; k++) { const v = bytes[i * 4 + k]; lo[k] = Math.min(lo[k], v); hi[k] = Math.max(hi[k], v); sum[k] += v; }
    return { ids, lo, hi, mean: sum.map((s) => Math.round(s / ids.length)) };
  };
  const boxes = [box(idx)], steps = [boxes.map((b) => [b.lo, b.hi])];
  while (boxes.length < K) {
    let bi = -1;
    for (let i = 0; i < boxes.length; i++) if (Math.max(...boxes[i].hi.map((h, k) => h - boxes[i].lo[k])) > 0 && (bi < 0 || boxes[i].ids.length > boxes[bi].ids.length)) bi = i;
    if (bi < 0) break;
    const b = boxes[bi], ext = b.hi.map((h, k) => h - b.lo[k]), ax = ext.indexOf(Math.max(...ext));
    const ids = b.ids.slice().sort((p, q) => bytes[p * 4 + ax] - bytes[q * 4 + ax]), m = ids.length >> 1;
    boxes.splice(bi, 1, box(ids.slice(0, m)), box(ids.slice(m)));
    if ((boxes.length & (boxes.length - 1)) === 0) steps.push(boxes.map((x) => [x.lo, x.hi]));
  }
  const map = new Uint16Array(n);
  boxes.forEach((b, j) => { for (const i of b.ids) map[i] = j; });
  return { palette: boxes.map((b) => b.mean), counts: boxes.map((b) => b.ids.length), map, steps };
}

// Floyd and Steinberg: each pixel's rounding error passed on to the neighbours not yet drawn,
// 7/16 ahead, 3/16 below-behind, 5/16 below, 1/16 below-ahead; left to right, every row.
export function floydSteinberg(bytes, palName = "ega") {
  const pal = resolvePalette(palName), lab = plateLab(bytes, W, H), err = new Float32Array(W * H * 3), out = new Uint16Array(W * H);
  const push = (p, e, k) => { for (let c = 0; c < 3; c++) err[p * 3 + c] += e[c] * k; };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = y * W + x, c = lab[p].map((v, k) => v + err[p * 3 + k]);
    const i = nearestIndex(c[0], c[1], c[2], pal), e = c.map((v, k) => v - pal[i].lab[k]);
    out[p] = i;
    if (x + 1 < W) push(p + 1, e, 7 / 16);
    if (y + 1 < H) { if (x > 0) push(p + W - 1, e, 3 / 16); push(p + W, e, 5 / 16); if (x + 1 < W) push(p + W + 1, e, 1 / 16); }
  }
  return out;
}

// Indices plus a palette to RGBA bytes, upscaled by an integer factor so the bilinear image
// paint keeps hard pixel edges.
export function toImage(indices, palette, f = 2) {
  const w = W * f, h = H * f, data = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const c = palette[indices[Math.floor(y / f) * W + Math.floor(x / f)]], o = (y * w + x) * 4;
    data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}
export function bytesImage(bytes, f = 2) {
  const idx = Uint32Array.from({ length: W * H }, (_, i) => i), pal = Array.from({ length: W * H }, (_, i) => [bytes[i * 4], bytes[i * 4 + 1], bytes[i * 4 + 2]]);
  return toImage(idx, pal, f);
}

// Every budget of the picture, as indices and palettes (RGB bytes).
export function budgets() {
  const src = dusk(), ega = resolvePalette("ega").map((e) => e.rgb);
  const mc = medianCut(src, 256);
  return {
    src, N: distinct(src), mc, ega,
    egaNone: ditherRef(src, W, H, { palette: "ega", mode: "none" }),
    egaBayer: ditherRef(src, W, H, { palette: "ega", mode: "bayer8" }),
    egaBlue: ditherRef(src, W, H, { palette: "ega", mode: "blue" }),
    egaFS: floydSteinberg(src, "ega"),
    bayer8: BAYER[8], blue: blueNoise64(),
  };
}
