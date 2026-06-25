// vision-biomimetic.test.mjs -- node-testable PURE math for Telos's biomimetic-vision readouts.
// Every test asserts a concrete vision-science property: SSIM self-identity + ordering, spectral-residual
// saliency locating a blob, Laplacian-pyramid reconstruction + fine-octave flatness, DoG edge response,
// CSF peak/falloff, Gabor orientation selectivity, and WPIR fidelity ordering. Synthetic typed arrays;
// no canvas. Mirrors the contract sense.test.mjs holds for the rest of sense-core.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  srgbToLinear, toLinearLuma, gaussianBlur, gaussianPyramid, laplacianPyramid,
  dogEdges, gaborOrientationEnergy, spectralResidualSaliency, csfWeight,
  ssim, wpir, perCellSpatialCoords, redundancyFlags,
} from "./lib/sense-core/vision-biomimetic.mjs";

// -- fixtures ------------------------------------------------------------------
function flat(w, h, v = 0.5) { return new Float32Array(w * h).fill(v); }
function fromFn(w, h, fn) {
  const a = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) a[y * w + x] = fn(x, y);
  return a;
}
// A reproducible deterministic pseudo-noise (NO Math.random): a hash of the index, mapped to [-amp,amp].
function deterministicNoise(w, h, amp) {
  return fromFn(w, h, (x, y) => {
    const s = Math.sin((x * 12.9898 + y * 78.233) * 43758.5453);
    return (s - Math.floor(s)) * 2 * amp - amp; // fractional part -> [-amp, amp]
  });
}
function addNoise(src, w, h, amp) {
  const n = deterministicNoise(w, h, amp), out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.max(0, Math.min(1, src[i] + n[i]));
  return out;
}
function maxIndex(a) { let mi = 0; for (let i = 1; i < a.length; i++) if (a[i] > a[mi]) mi = i; return mi; }

// -- (0) linearize -----------------------------------------------------------
test("srgbToLinear: anchors (0,1) and is monotone with the 0.04045 break", () => {
  assert.equal(srgbToLinear(0), 0);
  assert.ok(Math.abs(srgbToLinear(1) - 1) < 1e-9);
  assert.ok(Math.abs(srgbToLinear(0.04045) - 0.04045 / 12.92) < 1e-7); // linear segment endpoint
  // mid-grey 0.5 sRGB -> ~0.2140 linear (well-known value), and linearization darkens midtones
  assert.ok(srgbToLinear(0.5) < 0.5 && Math.abs(srgbToLinear(0.5) - 0.2140) < 0.005);
});

test("toLinearLuma: linear weights, white->1, black->0", () => {
  const white = new Uint8ClampedArray([255, 255, 255, 255]);
  const black = new Uint8ClampedArray([0, 0, 0, 255]);
  assert.ok(Math.abs(toLinearLuma(white, 1, 1)[0] - 1) < 1e-6);
  assert.equal(toLinearLuma(black, 1, 1)[0], 0);
});

// -- (6) SSIM ------------------------------------------------------------------
test("ssim(x,x) === 1; drops for a noised copy; drops further for an unrelated image", () => {
  const W = 32, H = 32;
  const img = fromFn(W, H, (x) => (x < W / 2 ? 0.2 : 0.8)); // a clean step
  const self = ssim(img, img, W, H).mssim;
  assert.ok(Math.abs(self - 1) < 1e-6, `ssim(x,x)=${self} ~ 1`);

  const noised = ssim(img, addNoise(img, W, H, 0.15), W, H).mssim;
  assert.ok(noised < 1 - 1e-3, `noised SSIM ${noised} < 1`);

  const unrelated = ssim(img, fromFn(W, H, (x, y) => ((x + y) & 1 ? 0.9 : 0.05)), W, H).mssim; // checkerboard
  assert.ok(unrelated < noised, `unrelated ${unrelated} < noised ${noised}`);
});

// -- (4) spectral-residual saliency ---------------------------------------------
test("spectralResidualSaliency: a single bright blob peaks AT the blob, ~0 on the flat field", () => {
  const W = 64, H = 64, cx = 20, cy = 44, rad = 5;
  const img = fromFn(W, H, (x, y) => (Math.hypot(x - cx, y - cy) <= rad ? 1 : 0.1));
  const { map } = spectralResidualSaliency(img, W, H);
  const peak = maxIndex(map), px = peak % W, py = (peak / W) | 0;
  assert.ok(Math.hypot(px - cx, py - cy) <= rad + 3, `peak (${px},${py}) is at the blob (${cx},${cy})`);
  // a far corner (the flat field) is near zero relative to the normalized peak (== 1)
  const corner = map[2 * W + 2];
  assert.ok(corner < 0.3, `flat-field corner saliency ${corner} is low`);
});

// -- (1) Laplacian pyramid ------------------------------------------------------
test("laplacianPyramid: summed bands reconstruct the original within tolerance", () => {
  const W = 32, H = 32;
  const img = fromFn(W, H, (x, y) => 0.5 + 0.3 * Math.sin(x / 3) * Math.cos(y / 4));
  const { reconstruct } = laplacianPyramid(img, W, H, 5);
  const r = reconstruct();
  let maxErr = 0;
  for (let i = 0; i < W * H; i++) maxErr = Math.max(maxErr, Math.abs(r.data[i] - img[i]));
  assert.ok(maxErr < 1e-4, `Laplacian reconstruction max error ${maxErr} < 1e-4`);
});

test("laplacianPyramid: a flat field has ~0 bandpass energy at fine octaves", () => {
  const W = 32, H = 32;
  const { energy } = laplacianPyramid(flat(W, H, 0.5), W, H, 5);
  assert.ok(energy[0] < 1e-10, `finest-octave bandpass energy ${energy[0]} ~ 0`);
  assert.ok(energy[1] < 1e-10, `next-octave bandpass energy ${energy[1]} ~ 0`);
});

// -- (2) DoG edges -----------------------------------------------------------
test("dogEdges: ~0 energy on a flat field, high along a step edge", () => {
  const W = 32, H = 32;
  const flatE = dogEdges(flat(W, H, 0.5), W, H, 1, 3).energy;
  const step = fromFn(W, H, (x) => (x < W / 2 ? 0.1 : 0.9));
  const stepE = dogEdges(step, W, H, 1, 3).energy;
  assert.ok(flatE < 1e-9, `flat DoG energy ${flatE} ~ 0`);
  assert.ok(stepE > 100 * (flatE + 1e-9), `step DoG energy ${stepE} >> flat`);
  assert.ok(stepE > 1e-4, `step DoG energy ${stepE} is materially nonzero`);
});

// -- (5) CSF -----------------------------------------------------------------
test("csfWeight peaks in 3-5 cpd, lower at 0.5 and 30 cpd, falls with eccentricity", () => {
  const peak = csfWeight(4, 0), low = csfWeight(0.5, 0), high = csfWeight(30, 0);
  assert.ok(peak > low, `peak ${peak} > low-freq ${low}`);
  assert.ok(peak > high, `peak ${peak} > high-freq ${high}`);
  // the maximum over a sweep really lands in the 3-5 cpd band
  let bestU = 0, bestV = -1;
  for (let u = 0.25; u <= 30; u += 0.25) { const v = csfWeight(u, 0); if (v > bestV) { bestV = v; bestU = u; } }
  assert.ok(bestU >= 3 && bestU <= 5, `CSF peak at ${bestU} cpd is in 3-5`);
  // eccentricity reduces sensitivity at the foveal peak frequency
  assert.ok(csfWeight(4, 20) < csfWeight(4, 0), "peripheral sensitivity < foveal");
});

// -- (3) Gabor orientation energy ----------------------------------------------
test("gaborOrientationEnergy: a vertical grating peaks at the aligned (90deg) orientation", () => {
  const W = 32, H = 32;
  // Vertical bars: luminance varies along X, constant along Y -> a "vertical" grating (90deg bars).
  const vert = fromFn(W, H, (x) => (Math.floor(x / 2) & 1 ? 0.9 : 0.1));
  const e = gaborOrientationEnergy(vert, W, H, [0, 45, 90, 135]);
  const best = Object.entries(e).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(best, "90", `vertical grating peaks at 90deg (energies ${JSON.stringify(e)})`);
  // and a horizontal grating peaks at 0deg (the orthogonal control)
  const horiz = fromFn(W, H, (x, y) => (Math.floor(y / 2) & 1 ? 0.9 : 0.1));
  const eh = gaborOrientationEnergy(horiz, W, H, [0, 45, 90, 135]);
  const bestH = Object.entries(eh).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(bestH, "0", `horizontal grating peaks at 0deg (energies ${JSON.stringify(eh)})`);
});

// -- (7) WPIR ------------------------------------------------------------------
test("wpir: high (~1) when reconstruction ~ original, lower when degraded", () => {
  const W = 32, H = 32;
  const orig = fromFn(W, H, (x, y) => 0.5 + 0.3 * Math.sin(x / 3) * Math.cos(y / 4));
  const cols = 8, rows = 8;
  const weights = new Array(cols * rows).fill(1);
  const good = wpir(orig, orig, W, H, weights, cols, rows);
  const bad = wpir(addNoise(orig, W, H, 0.25), orig, W, H, weights, cols, rows);
  assert.ok(good > 0.999, `WPIR(identical) ${good} ~ 1`);
  assert.ok(bad < good, `WPIR(degraded) ${bad} < WPIR(identical) ${good}`);
  // CSF weighting is honored: zero-weight cells must not change a perfect score
  const partial = new Array(cols * rows).fill(0).map((_, i) => (i < 4 ? 1 : 0));
  assert.ok(wpir(orig, orig, W, H, partial, cols, rows) > 0.999, "weighted WPIR still 1 on identical input");
});

// -- (8) per-cell coords + redundancy ------------------------------------------
test("perCellSpatialCoords: row-major fractional coords tile the unit square", () => {
  const cells = perCellSpatialCoords(4, 2);
  assert.equal(cells.length, 8);
  assert.deepEqual(cells[0], { xFrac: 0, yFrac: 0, wFrac: 0.25, hFrac: 0.5 });
  assert.deepEqual(cells[7], { xFrac: 0.75, yFrac: 0.5, wFrac: 0.25, hFrac: 0.5 });
});

test("redundancyFlags: a uniform field is all-redundant; a sharp split flags only interior-uniform cells", () => {
  // 3x3 uniform grid -> every cell matches its neighbours -> all redundant.
  const uni = Array.from({ length: 9 }, () => [50, 0, 0]);
  assert.ok(redundancyFlags(uni, 3, 3, 5).every(Boolean), "uniform grid is fully redundant");
  // A grid where one cell is far in LAB from its neighbours is NOT redundant; its uniform neighbours are.
  const labs = Array.from({ length: 9 }, () => [50, 0, 0]);
  labs[4] = [90, 40, 40]; // centre cell distinct
  const f = redundancyFlags(labs, 3, 3, 5);
  assert.equal(f[4], false, "the distinct centre cell is not redundant");
  // a corner (neighbours are the uniform 50,0,0 cells) stays redundant
  assert.equal(f[0], true, "a uniform corner neighbouring only uniform cells is redundant");
});

// -- helper sanity: Gaussian blur conserves a constant field --------------------
test("gaussianBlur preserves a constant field (normalized kernel, clamped edges)", () => {
  const W = 16, H = 16, b = gaussianBlur(flat(W, H, 0.7), W, H, 2);
  for (let i = 0; i < W * H; i++) assert.ok(Math.abs(b[i] - 0.7) < 1e-6);
});

test("gaussianPyramid halves dimensions each octave", () => {
  const W = 32, H = 32, levels = gaussianPyramid(flat(W, H), W, H, 4);
  assert.deepEqual(levels.map(l => l.w), [32, 16, 8, 4]);
  assert.deepEqual(levels.map(l => l.h), [32, 16, 8, 4]);
});
