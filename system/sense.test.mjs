// sense.test.mjs — the measurimeter's pure senses, recomputed in node so the numbers the model is
// given are re-checkable (the same contract eye.test.mjs holds for the gated dHash).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  boxAverage, representation, richFeatures, describeFrame,
  hueName, dominantColors, edgeDensity, regionSplit,
  rms, rmsFromBytes, spectrumBands, dominantPitchHz,
  multiScaleGrids, assembleFullPerception,
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

test("multiScaleGrids returns 8/16/32 colour pyramids of the real pixels", () => {
  // 32×32 frame: left half red, right half blue — every grid must preserve that split.
  const W = 32, H = 32;
  const px = mkRGBA(W, H, x => (x < 16 ? [255, 0, 0] : [0, 0, 255]));
  const g = multiScaleGrids(px, W, H, 4);
  for (const [key, n] of [["grid8", 8], ["grid16", 16], ["grid32", 32]]) {
    assert.ok(g[key], `${key} present`);
    assert.equal(g[key].length, n, `${key} has n rows`);
    assert.equal(g[key][0].length, n, `${key} has n cols`);
    // a left cell reads red, a right cell reads blue (the split survives every resolution)
    assert.deepEqual(g[key][0][0], [255, 0, 0], `${key} left cell is red`);
    assert.deepEqual(g[key][0][n - 1], [0, 0, 255], `${key} right cell is blue`);
  }
});

test("assembleFullPerception: complete shape — dimensions, multiScale, colours w/ fractions, scalars", () => {
  // 32×32 teal-majority frame so dominant colours + hue are well-defined.
  const W = 32, H = 24;
  const px = mkRGBA(W, H, x => (x < 24 ? [0, 160, 160] : [240, 170, 40]));
  const pre = { phash: "abc123", contrast: 0.5, structure: 0.7, balance: 0.9, coverage: 0.3, motion: 0.125, audio: null, source: "2D fractal" };
  const fp = assembleFullPerception(px, W, H, 4, pre);

  // dimensions block
  assert.equal(fp.dimensions.w, W);
  assert.equal(fp.dimensions.h, H);
  assert.equal(fp.dimensions.orientation, "wide");          // 32/24 ≈ 1.33 → wide
  assert.ok(Math.abs(fp.dimensions.aspect - W / H) < 1e-9);

  // multi-scale pyramid present at all three resolutions
  assert.ok(fp.multiScale && fp.multiScale.grid8 && fp.multiScale.grid16 && fp.multiScale.grid32);
  assert.equal(fp.multiScale.grid8.length, 8);
  assert.equal(fp.multiScale.grid16.length, 16);
  assert.equal(fp.multiScale.grid32.length, 32);

  // dominant colours: array of {hex, fraction}, fractions are numbers in (0,1]
  assert.ok(Array.isArray(fp.dominantColours) && fp.dominantColours.length >= 1);
  for (const c of fp.dominantColours) {
    assert.match(c.hex, /^#[0-9a-f]{6}$/);
    assert.equal(typeof c.fraction, "number");
    assert.ok(c.fraction > 0 && c.fraction <= 1);
  }

  // core scalars are carried through / measured
  assert.equal(fp.phash, "abc123");
  assert.equal(fp.contrast, 0.5);
  assert.equal(fp.structure, 0.7);
  assert.equal(fp.balance, 0.9);
  assert.equal(fp.coverage, 0.3);
  assert.equal(fp.motion, 0.125);
  assert.equal(typeof fp.edgeDensity, "number");
  assert.equal(typeof fp.light, "number");
  assert.equal(typeof fp.dark, "number");
  assert.equal(typeof fp.meanLuma, "number");
  assert.equal(typeof fp.hueName, "string");
  assert.equal(fp.source, "2D fractal");
  assert.equal(fp.audio, null);
});

test("assembleFullPerception: missing advisory scalars read as null (honest), not faked", () => {
  const W = 8, H = 8;
  const px = mkRGBA(W, H, () => [128, 128, 128]);
  const fp = assembleFullPerception(px, W, H, 4, {});   // no `pre`
  assert.equal(fp.phash, null);
  assert.equal(fp.contrast, null);
  assert.equal(fp.structure, null);
  assert.equal(fp.balance, null);
  assert.equal(fp.coverage, null);
  assert.equal(fp.motion, null);
  assert.equal(fp.source, "unknown");
  // but the pixel-derived truth is still complete
  assert.ok(fp.multiScale.grid8 && fp.multiScale.grid16 && fp.multiScale.grid32);
  assert.equal(typeof fp.edgeDensity, "number");
});
