// sense-parity.test.mjs: the fast edgeDensity and dominantColors in sense-core/features.mjs must
// return exactly what the original per-pixel closures returned. The originals are copied below
// verbatim (2026-10-03, origin/main acee015) and every case compares with strict equality, so a
// perception packet built from the same pixels cannot change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { edgeDensity, dominantColors, richFeatures } from "./lib/sense-core/features.mjs";
import { mulberry32 } from "./media-engine/seed.mjs";

function toHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}
function dominantColorsRef(px, w, h, ch, k = 5) {
  const n = w * h;
  const bins = new Map(); // key -> {r,g,b,count}
  for (let i = 0; i < n; i++) {
    const o = i * ch, r = px[o], g = px[o + 1], b = px[o + 2];
    const key = (r >> 6) * 16 + (g >> 6) * 4 + (b >> 6);
    let e = bins.get(key);
    if (!e) { e = { r: 0, g: 0, b: 0, count: 0 }; bins.set(key, e); }
    e.r += r; e.g += g; e.b += b; e.count++;
  }
  return [...bins.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, k)
    .map(e => ({
      hex: toHex(e.r / e.count, e.g / e.count, e.b / e.count),
      r: Math.round(e.r / e.count), g: Math.round(e.g / e.count), b: Math.round(e.b / e.count),
      frac: e.count / n,
    }));
}
function edgeDensityRef(px, w, h, ch, threshold = 48) {
  if (w < 3 || h < 3) return 0;
  const luma = (x, y) => { const i = (y * w + x) * ch; return (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000; };
  let strong = 0, total = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const sx = -luma(x - 1, y - 1) - 2 * luma(x - 1, y) - luma(x - 1, y + 1)
        + luma(x + 1, y - 1) + 2 * luma(x + 1, y) + luma(x + 1, y + 1);
      const sy = -luma(x - 1, y - 1) - 2 * luma(x, y - 1) - luma(x + 1, y - 1)
        + luma(x - 1, y + 1) + 2 * luma(x, y + 1) + luma(x + 1, y + 1);
      if (Math.hypot(sx, sy) >= threshold) strong++;
      total++;
    }
  }
  return total ? strong / total : 0;
}

const rng = mulberry32;
function frame(w, h, ch, fn) {
  const px = new Uint8ClampedArray(w * h * ch);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * ch, c = fn(x, y);
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; if (ch === 4) px[i + 3] = 255;
  }
  return px;
}
const CASES = [];
for (const ch of [4, 3]) {
  const r = rng(7 + ch);
  CASES.push([`noise ch${ch}`, 97, 61, ch, frame(97, 61, ch, () => [r() * 256, r() * 256, r() * 256])]);
  // Low-amplitude noise puts many Sobel magnitudes near the threshold.
  CASES.push([`near-threshold noise ch${ch}`, 120, 80, ch, frame(120, 80, ch, () => { const v = 100 + r() * 24; return [v, v, v]; })]);
  CASES.push([`gradient ch${ch}`, 256, 9, ch, frame(256, 9, ch, x => [x, 255 - x, (x * 7) & 255])]);
  CASES.push([`rings ch${ch}`, 200, 150, ch, frame(200, 150, ch, (x, y) => { const d = Math.hypot(x - 100, y - 75); return [128 + 127 * Math.sin(d / 3), 128 + 127 * Math.cos(d / 5), d & 255]; })]);
  // A grey step of exactly 12 levels gives a Sobel magnitude of exactly 48, the threshold itself.
  CASES.push([`exact-threshold step ch${ch}`, 16, 8, ch, frame(16, 8, ch, x => x < 8 ? [0, 0, 0] : [12, 12, 12])]);
  CASES.push([`flat ch${ch}`, 5, 5, ch, frame(5, 5, ch, () => [40, 40, 40])]);
  CASES.push([`tiny ch${ch}`, 2, 2, ch, frame(2, 2, ch, () => [1, 2, 3])]);
  // Many tied bins: equal-count colour blocks test the first-seen order on ties.
  CASES.push([`tied bins ch${ch}`, 64, 4, ch, frame(64, 4, ch, x => { const k = x >> 3; return [k * 32, 255 - k * 32, (k * 97) & 255]; })]);
}

test("edgeDensity: the fast path counts exactly what the per-tap closure counted", () => {
  for (const [name, w, h, ch, px] of CASES) {
    for (const t of [48, 1, 30.5]) assert.equal(edgeDensity(px, w, h, ch, t), edgeDensityRef(px, w, h, ch, t), `${name} t=${t}`);
  }
});

test("the exact-threshold step counts as an edge in both", () => {
  const [, w, h, ch, px] = CASES.find(c => c[0] === "exact-threshold step ch4");
  assert.ok(edgeDensityRef(px, w, h, ch) > 0);
  assert.equal(edgeDensity(px, w, h, ch), edgeDensityRef(px, w, h, ch));
});

test("dominantColors: typed bins give the same swatches, fractions and tie order as the Map", () => {
  for (const [name, w, h, ch, px] of CASES) {
    for (const k of [5, 64]) assert.deepEqual(dominantColors(px, w, h, ch, k), dominantColorsRef(px, w, h, ch, k), `${name} k=${k}`);
  }
});

test("richFeatures carries the reference edge density and swatches", () => {
  const [, w, h, , px] = CASES.find(c => c[0] === "rings ch4");
  const f = richFeatures(px, w, h, 4);
  assert.equal(f.edgeDensity, edgeDensityRef(px, w, h, 4));
  assert.deepEqual(f.dominantSwatches, dominantColorsRef(px, w, h, 4, 5));
});
