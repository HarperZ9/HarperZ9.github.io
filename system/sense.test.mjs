// sense.test.mjs — the measurimeter's pure senses, recomputed in node so the numbers the model is
// given are re-checkable (the same contract eye.test.mjs holds for the gated dHash).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boxAverage, representation, richFeatures, describeFrame,
  hueName, dominantColors, edgeDensity, regionSplit,
  rms, rmsFromBytes, spectrumBands, dominantPitchHz,
} from "./sense.js";

// Build an RGBA buffer of w×h from a (x,y)->[r,g,b] function.
function mkRGBA(w, h, fn) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, c = fn(x, y);
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return px;
}

test("representation box-averages a known horizontal gradient into n×n cells", () => {
  // 4×4 frame: left half pure red (255,0,0), right half pure blue (0,0,255).
  const W = 4, H = 4;
  const px = mkRGBA(W, H, x => (x < 2 ? [255, 0, 0] : [0, 0, 255]));
  const { grid, w, h } = representation({ data: px, width: W, height: H }, 2);
  assert.equal(w, 2); assert.equal(h, 2);
  // 2×2 grid: left column averages the red half exactly, right column the blue half.
  assert.deepEqual(grid[0][0], [255, 0, 0]);
  assert.deepEqual(grid[0][1], [0, 0, 255]);
  assert.deepEqual(grid[1][0], [255, 0, 0]);
  assert.deepEqual(grid[1][1], [0, 0, 255]);
});

test("boxAverage of a smooth ramp gives the cell mean (a known midpoint)", () => {
  // 2×1 frame: pixel0 = 0, pixel1 = 100 (grayscale ramp) -> one cell = mean 50.
  const px = new Uint8ClampedArray([0, 0, 0, 255, 100, 100, 100, 255]);
  const { grid } = boxAverage(px, 2, 1, 4, 1);
  assert.deepEqual(grid[0][0], [50, 50, 50]);
});

test("dominantColors finds the majority colour first", () => {
  // 75% teal-ish, 25% amber-ish.
  const W = 4, H = 4;
  const px = mkRGBA(W, H, x => (x < 3 ? [0, 160, 160] : [240, 170, 40]));
  const dom = dominantColors(px, W, H, 4, 3);
  assert.ok(dom.length >= 2);
  assert.ok(dom[0].frac >= dom[1].frac, "sorted by population");
  assert.ok(dom[0].b > 100 && dom[0].g > 100, "majority bin is the teal-ish colour");
});

test("hueName names hues and reads greys/blacks honestly", () => {
  assert.equal(hueName(180, 0.8, 0.7), "teal");       // pure teal sits at 180°
  assert.equal(hueName(30, 0.9, 0.9), "orange");
  assert.equal(hueName(0, 0.02, 0.5), "grey");        // desaturated -> grey, not red
  assert.equal(hueName(0, 0.9, 0.05), "near-black");  // no value -> black
});

test("edgeDensity: a flat field is smooth (~0), striped is busy (high)", () => {
  const W = 16, H = 16;
  const flat = mkRGBA(W, H, () => [120, 120, 120]);
  // Vertical stripes (period 4) give clean, non-cancelling Sobel edges at every transition.
  // (A 1px checkerboard sits at Nyquist and Sobel correctly reads it as 0 — not a useful fixture.)
  const stripes = mkRGBA(W, H, x => ((Math.floor(x / 2) & 1) ? [255, 255, 255] : [0, 0, 0]));
  assert.ok(edgeDensity(flat, W, H, 4) < 0.02, "flat field has no edges");
  assert.ok(edgeDensity(stripes, W, H, 4) > 0.4, "stripes are highly edged");
});

test("regionSplit separates a half-light / half-dark frame", () => {
  const W = 4, H = 4;
  const px = mkRGBA(W, H, x => (x < 2 ? [255, 255, 255] : [0, 0, 0]));
  const r = regionSplit(px, W, H, 4);
  assert.ok(Math.abs(r.light - 0.5) < 1e-6);
  assert.ok(Math.abs(r.dark - 0.5) < 1e-6);
  assert.ok(Math.abs(r.meanLuma - 0.5) < 1e-6);
});

test("describeFrame names the dominant hue AND busy/smooth, in one sentence", () => {
  // Busy + teal-dominant: a wide frame of teal vertical stripes (real edges, teal majority).
  const W = 32, H = 16;
  const busyTeal = mkRGBA(W, H, x => ((Math.floor(x / 2) & 1) ? [0, 190, 190] : [0, 120, 120]));
  const fb = richFeatures(busyTeal, W, H, 4);
  const sb = describeFrame(fb);
  assert.match(sb, /teal/, "names the dominant hue");
  assert.match(sb, /busy/, "calls it busy");
  assert.match(sb, /wide/, "names the wide orientation");

  // Smooth + flat grey: a square, low-edge frame.
  const smooth = mkRGBA(16, 16, () => [128, 128, 128]);
  const fs = richFeatures(smooth, 16, 16, 4);
  const ss = describeFrame(fs);
  assert.match(ss, /smooth/, "calls a flat field smooth");
  assert.match(ss, /grey/, "names grey for a desaturated field");
  // one sentence: ends with a single period, no interior sentence breaks
  assert.equal((ss.match(/\./g) || []).length, 1);
});

test("rms of silence is 0; rms of a full-scale square wave is 1", () => {
  assert.equal(rms(new Float32Array(64)), 0);
  const sq = new Float32Array(64).map((_, i) => (i & 1 ? 1 : -1));
  assert.ok(Math.abs(rms(sq) - 1) < 1e-9, "±1 square wave RMS == 1");
  const half = new Float32Array(64).fill(0.5);
  assert.ok(Math.abs(rms(half) - 0.5) < 1e-9);
});

test("rmsFromBytes: 128 (Web Audio silence) -> 0; full swing -> ~1", () => {
  const silent = new Uint8Array(64).fill(128);
  assert.equal(rmsFromBytes(silent), 0);
  const swing = new Uint8Array(64).map((_, i) => (i & 1 ? 255 : 0)); // 0/255 around 128
  assert.ok(rmsFromBytes(swing) > 0.98, "alternating 0/255 ~ full-scale");
});

test("spectrumBands averages a freq buffer into N bands (0..1)", () => {
  const freq = new Uint8Array(64).fill(255); // all energy
  const bands = spectrumBands(freq, 8);
  assert.equal(bands.length, 8);
  for (const b of bands) assert.ok(Math.abs(b - 1) < 1e-9);
  assert.deepEqual(spectrumBands(new Uint8Array(0), 4), [0, 0, 0, 0]);
});

test("dominantPitchHz maps the peak bin to Hz; silence -> 0", () => {
  const freq = new Uint8Array(1024); freq[10] = 250; // peak at bin 10
  // 48000 Hz, fftSize 2048 -> bin width 23.4375 Hz -> ~234 Hz
  assert.equal(dominantPitchHz(freq, 48000, 2048), Math.round(10 * 48000 / 2048));
  assert.equal(dominantPitchHz(new Uint8Array(1024), 48000, 2048), 0);
});
