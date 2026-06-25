// colour-perceptual.test.mjs - the perceptual-colour module recomputed in node so every
// number the model is given (OKLab clusters, CIEDE2000 distances, WPRE) is re-checkable.
// Reference values are the CANONICAL published constants, cited at each assertion.
//
// Placed at system/ top level so the suite glob `system/*.test.mjs` runs it.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  srgbToLinear, linearToSrgb,
  linearRgbToXyz,
  linearRgbToOklab, oklabToOklch,
  oklchToOklab, oklabToLinearRgb, oklchToSrgbByte,
  xyzToLab, srgbByteToLab,
  ciede2000,
  dominantColoursOklab,
  wpre,
  colourVolumeTag,
} from "./lib/sense-core/colour-perceptual.mjs";

// Build a w*h RGBA buffer from an (x,y)->[r,g,b] function (alpha forced opaque).
function mkRGBA(w, h, fn) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, c = fn(x, y);
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2]; px[i + 3] = 255;
  }
  return px;
}

// ── sRGB EOTF ────────────────────────────────────────────────────────────────
test("srgbToLinear: endpoints and monotonicity (IEC 61966-2-1)", () => {
  assert.equal(srgbToLinear(0), 0);
  assert.ok(Math.abs(srgbToLinear(1) - 1) < 1e-12, "srgbToLinear(1) == 1");
  // Strictly increasing across the encoded range, including across the 0.04045 kink.
  let prev = -1;
  for (let c = 0; c <= 1.0001; c += 0.01) {
    const v = srgbToLinear(c);
    assert.ok(v > prev, `monotone at c=${c.toFixed(2)} (${v} > ${prev})`);
    prev = v;
  }
});

test("srgbToLinear round-trips with linearToSrgb across the range", () => {
  for (let c = 0; c <= 1.0001; c += 0.005) {
    const rt = linearToSrgb(srgbToLinear(c));
    assert.ok(Math.abs(rt - c) < 1e-9, `round-trip at c=${c.toFixed(3)} gave ${rt}`);
  }
  // And the inverse direction (linear -> srgb -> linear), including near the 0.0031308 kink.
  for (let v = 0; v <= 1.0001; v += 0.005) {
    const rt = srgbToLinear(linearToSrgb(v));
    assert.ok(Math.abs(rt - v) < 1e-9, `inverse round-trip at v=${v.toFixed(3)} gave ${rt}`);
  }
});

// ── Linear sRGB -> XYZ (D65), CSS Color 4 matrix ──────────────────────────────
test("linearRgbToXyz: white maps to the D65 white point (CSS Color 4 matrix)", () => {
  const [X, Y, Z] = linearRgbToXyz(1, 1, 1);
  // Row sums of the CSS Color 4 matrix == D65 whitepoint XYZ (Y normalized to 1).
  assert.ok(Math.abs(X - 0.9504559) < 1e-4, `Xn ~= 0.95046, got ${X}`);
  assert.ok(Math.abs(Y - 1.0) < 1e-9, `Yn == 1, got ${Y}`);
  assert.ok(Math.abs(Z - 1.0890578) < 1e-4, `Zn ~= 1.08906, got ${Z}`);
});

// ── OKLab (Ottosson reference values) ─────────────────────────────────────────
test("linearRgbToOklab: pure white -> L~1, a~0, b~0 (Ottosson)", () => {
  const [L, a, b] = linearRgbToOklab(1, 1, 1);
  assert.ok(Math.abs(L - 1) < 1e-6, `L ~= 1, got ${L}`);
  assert.ok(Math.abs(a) < 1e-6, `a ~= 0, got ${a}`);
  assert.ok(Math.abs(b) < 1e-6, `b ~= 0, got ${b}`);
});

test("linearRgbToOklab: Ottosson's published primary references (linear rgb)", () => {
  // Cites: https://bottosson.github.io/posts/oklab/ worked examples.
  // linear (1,0,0) -> (0.627955, 0.224863, 0.125846)
  const red = linearRgbToOklab(1, 0, 0);
  assert.ok(Math.abs(red[0] - 0.627955) < 1e-5, `red L ${red[0]}`);
  assert.ok(Math.abs(red[1] - 0.224863) < 1e-5, `red a ${red[1]}`);
  assert.ok(Math.abs(red[2] - 0.125846) < 1e-5, `red b ${red[2]}`);
  // linear (0,1,0) -> (0.866440, -0.233888, 0.179498)
  const grn = linearRgbToOklab(0, 1, 0);
  assert.ok(Math.abs(grn[0] - 0.866440) < 1e-5, `green L ${grn[0]}`);
  assert.ok(Math.abs(grn[1] - (-0.233888)) < 1e-5, `green a ${grn[1]}`);
  assert.ok(Math.abs(grn[2] - 0.179498) < 1e-5, `green b ${grn[2]}`);
  // linear (0,0,1) -> (0.452014, -0.032457, -0.311528)
  const blu = linearRgbToOklab(0, 0, 1);
  assert.ok(Math.abs(blu[0] - 0.452014) < 1e-5, `blue L ${blu[0]}`);
  assert.ok(Math.abs(blu[1] - (-0.032457)) < 1e-5, `blue a ${blu[1]}`);
  assert.ok(Math.abs(blu[2] - (-0.311528)) < 1e-5, `blue b ${blu[2]}`);
});

test("oklabToOklch: chroma is hypot(a,b), hue in [0,360)", () => {
  // A known mid-red (sRGB #ff0000 linearized -> OKLab) has hue ~29 deg, C ~0.2577.
  const [L, a, b] = linearRgbToOklab(srgbToLinear(1), 0, 0);
  const [oL, C, h] = oklabToOklch(L, a, b);
  assert.equal(oL, L);
  assert.ok(Math.abs(C - Math.hypot(a, b)) < 1e-12);
  assert.ok(h >= 0 && h < 360, `hue in range, got ${h}`);
  assert.ok(Math.abs(h - 29.23) < 0.5, `red hue ~29 deg, got ${h}`);
  // Pure grey (a=b=0) yields hue 0 by convention, not NaN.
  const grey = oklabToOklch(0.5, 0, 0);
  assert.equal(grey[1], 0);
  assert.equal(grey[2], 0);
});

// ── CIELAB path ───────────────────────────────────────────────────────────────
test("xyzToLab: D65 white -> L=100, a=0, b=0", () => {
  const [L, a, b] = xyzToLab(0.9505, 1.0, 1.0891);
  assert.ok(Math.abs(L - 100) < 1e-9, `L=100, got ${L}`);
  assert.ok(Math.abs(a) < 1e-9, `a=0, got ${a}`);
  assert.ok(Math.abs(b) < 1e-9, `b=0, got ${b}`);
});

test("srgbByteToLab: sRGB white bytes -> ~CIELAB white", () => {
  const [L, a, b] = srgbByteToLab(255, 255, 255);
  assert.ok(Math.abs(L - 100) < 1e-3, `L ~= 100, got ${L}`);
  // a*/b* are ~0 but not exactly 0: the spec pins the CSS Color 4 lin-sRGB->XYZ matrix
  // and the CIELAB white (Xn=0.9505, Zn=1.0891) as INDEPENDENT rounded constants, whose
  // D65 representations differ in the 4th-5th decimal. The residual chroma (~0.008) is
  // two orders of magnitude below the dE00 < 1 JND threshold, i.e. imperceptible.
  assert.ok(Math.abs(a) < 0.01 && Math.abs(b) < 0.01, `a,b ~= 0, got ${a},${b}`);
});

// ── CIEDE2000 vs Sharma's published supplementary test data ───────────────────
// Cites: Sharma, Wu, Dalal (2005), Table 1.
// https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/dataNprograms/ciede2000testdata.txt
// These 6 pairs exercise distinct code paths: row 1 (RT term, blue region), row 4
// (JND-calibrated dE00==1), row 9 (180-deg hue, mean-hue case), row 17 (large general
// difference, all weighting functions), rows 25 & 30 (typical small differences).
test("ciede2000 reproduces Sharma's published test vectors within 1e-3", () => {
  const vectors = [
    { l1: [50.0000, 2.6772, -79.7751], l2: [50.0000, 0.0000, -82.7485], dE: 2.0425 }, // row 1
    { l1: [50.0000, -1.3802, -84.2814], l2: [50.0000, 0.0000, -82.7485], dE: 1.0000 }, // row 4
    { l1: [50.0000, 2.4900, -0.0010], l2: [50.0000, -2.4900, 0.0009], dE: 7.1792 }, // row 9
    { l1: [50.0000, 2.5000, 0.0000], l2: [73.0000, 25.0000, -18.0000], dE: 27.1492 }, // row 17
    { l1: [60.2574, -34.0099, 36.2677], l2: [60.4626, -34.1751, 39.4387], dE: 1.2644 }, // row 25
    { l1: [36.4612, 47.8580, 18.3852], l2: [36.2715, 50.5065, 21.2231], dE: 1.4146 }, // row 30
  ];
  for (const v of vectors) {
    const got = ciede2000(v.l1, v.l2);
    assert.ok(
      Math.abs(got - v.dE) < 1e-3,
      `dE00 for ${JSON.stringify(v.l1)} vs ${JSON.stringify(v.l2)}: got ${got.toFixed(4)}, expected ${v.dE}`
    );
  }
});

test("ciede2000 is symmetric and zero for identical colours", () => {
  const a = [55, 12, -33], b = [40, -20, 7];
  assert.ok(Math.abs(ciede2000(a, b) - ciede2000(b, a)) < 1e-9, "symmetric");
  assert.ok(ciede2000(a, a) < 1e-12, "zero distance to self");
});

// ── Dominant colours (k-means in OKLab) ───────────────────────────────────────
test("dominantColoursOklab: synthetic 2-colour image -> 2 sensible clusters, correct areas", () => {
  // 8x8: left 3 columns pure red (#ff0000), right 5 columns pure blue (#0000ff).
  const W = 8, H = 8;
  const px = mkRGBA(W, H, x => (x < 3 ? [255, 0, 0] : [0, 0, 255]));
  const clusters = dominantColoursOklab(px, 2, { width: W, height: H });
  assert.equal(clusters.length, 2, "exactly 2 clusters");

  // Area fractions: 3/8 = 0.375 and 5/8 = 0.625 (sorted descending).
  assert.ok(Math.abs(clusters[0].areaFraction - 0.625) < 1e-9, `dominant area 0.625, got ${clusters[0].areaFraction}`);
  assert.ok(Math.abs(clusters[1].areaFraction - 0.375) < 1e-9, `minor area 0.375, got ${clusters[1].areaFraction}`);
  assert.ok(Math.abs(clusters[0].areaFraction + clusters[1].areaFraction - 1) < 1e-9, "areas sum to 1");

  // The dominant cluster is blue (hue ~264 deg in OKLCh), the minor is red (hue ~29 deg).
  const blue = clusters[0], red = clusters[1];
  assert.ok(blue.oklch.h > 230 && blue.oklch.h < 300, `dominant is blue-ish, hue ${blue.oklch.h}`);
  assert.ok(red.oklch.h > 10 && red.oklch.h < 60, `minor is red-ish, hue ${red.oklch.h}`);

  // Spatial centroids (normalized [0,1]): red sits left, blue sits right.
  assert.ok(red.centroidX < 0.5, `red centroid left, got ${red.centroidX}`);
  assert.ok(blue.centroidX > 0.5, `blue centroid right, got ${blue.centroidX}`);
});

test("dominantColoursOklab: deterministic across repeated runs", () => {
  // 3-colour stripe; same input must yield byte-identical cluster output every time.
  const W = 9, H = 4;
  const px = mkRGBA(W, H, x => (x < 3 ? [200, 30, 30] : x < 6 ? [30, 200, 30] : [30, 30, 200]));
  const a = dominantColoursOklab(px, 3, { width: W, height: H });
  const b = dominantColoursOklab(px, 3, { width: W, height: H });
  const c = dominantColoursOklab(px, 3, { width: W, height: H });
  assert.deepEqual(a, b, "run 1 == run 2");
  assert.deepEqual(b, c, "run 2 == run 3");
  assert.equal(a.length, 3, "3 clusters for 3 colours");
});

test("dominantColoursOklab: empty / fully-transparent input -> []", () => {
  assert.deepEqual(dominantColoursOklab(new Uint8ClampedArray(0), 3), []);
  const transparent = new Uint8ClampedArray(4 * 4); // all zero -> alpha 0
  assert.deepEqual(dominantColoursOklab(transparent, 2, { width: 2, height: 2 }), []);
});

// ── WPRE ───────────────────────────────────────────────────────────────────────
test("wpre: ~0 when the palette contains the image's exact colours", () => {
  // 6x6 split image of two exact colours; palette = those exact colours in CIELAB.
  const W = 6, H = 6;
  const RED = [220, 40, 40], BLUE = [40, 60, 200];
  const px = mkRGBA(W, H, x => (x < 3 ? RED : BLUE));
  const palette = [srgbByteToLab(...RED), srgbByteToLab(...BLUE)];
  const score = wpre(px, palette);
  assert.ok(score < 1e-6, `WPRE ~= 0 for exact palette, got ${score}`);
});

test("wpre: larger for a mismatched palette than for the exact palette", () => {
  const W = 6, H = 6;
  const RED = [220, 40, 40], BLUE = [40, 60, 200];
  const px = mkRGBA(W, H, x => (x < 3 ? RED : BLUE));

  const exact = wpre(px, [srgbByteToLab(...RED), srgbByteToLab(...BLUE)]);
  // A single grey palette colour is a poor match for both saturated colours.
  const grey = wpre(px, [srgbByteToLab(128, 128, 128)]);
  assert.ok(grey > exact, `mismatched palette worse: grey ${grey.toFixed(3)} > exact ${exact.toFixed(3)}`);
  assert.ok(grey > 2.0, `mismatched palette clearly above the <2.0 target, got ${grey.toFixed(3)}`);

  // And a near-but-not-exact palette sits between the two.
  const near = wpre(px, [srgbByteToLab(225, 45, 45), srgbByteToLab(45, 65, 205)]);
  assert.ok(near > exact && near < grey, `near palette between exact and grey: ${near.toFixed(3)}`);
});

test("wpre: empty palette or empty image -> 0", () => {
  const px = mkRGBA(2, 2, () => [10, 20, 30]);
  assert.equal(wpre(px, []), 0);
  assert.equal(wpre(new Uint8ClampedArray(0), [[50, 0, 0]]), 0);
});

// ── Colour-volume tag ───────────────────────────────────────────────────────────
test("colourVolumeTag: defaults sRGB/SDR, clamps unknown values", () => {
  assert.deepEqual(colourVolumeTag(), { gamut: "srgb", transfer: "srgb", peakNits: 80 });
  assert.deepEqual(
    colourVolumeTag({ gamut: "rec2020", transfer: "pq", peakNits: 1000 }),
    { gamut: "rec2020", transfer: "pq", peakNits: 1000 }
  );
  // Unknown gamut/transfer fall back to the SDR defaults; bad nits clamp to 80.
  assert.deepEqual(
    colourVolumeTag({ gamut: "cmyk", transfer: "log", peakNits: -5 }),
    { gamut: "srgb", transfer: "srgb", peakNits: 80 }
  );
});

// ── inverse OKLCh -> sRGB path (the palette generator) ────────────────────────
test("oklchToOklab: cylindrical -> rectangular is the inverse of oklabToOklch", () => {
  // Pick an OKLab colour, go to OKLCh and back; should round-trip.
  const Lab = [0.7, 0.1, -0.05];
  const [L, C, h] = oklabToOklch(...Lab);
  const back = oklchToOklab(L, C, h);
  for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - Lab[i]) < 1e-12, `coord ${i}`);
});

test("oklabToLinearRgb: inverts linearRgbToOklab (round-trip in linear sRGB)", () => {
  // A few in-gamut linear-sRGB colours: forward to OKLab, back, compare.
  const samples = [[0.2, 0.5, 0.8], [0.9, 0.1, 0.3], [0.05, 0.05, 0.05], [0.6, 0.6, 0.6]];
  for (const lin of samples) {
    const lab = linearRgbToOklab(...lin);
    const back = oklabToLinearRgb(...lab);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[i] - lin[i]) < 1e-6, `${lin} ch ${i} -> ${back[i]}`);
  }
});

test("oklchToSrgbByte: returns in-range bytes and is hue-sensible", () => {
  for (let h = 0; h < 360; h += 30) {
    const rgb = oklchToSrgbByte(0.72, 0.15, h);
    assert.equal(rgb.length, 3);
    for (const c of rgb) assert.ok(Number.isInteger(c) && c >= 0 && c <= 255, `byte in range, got ${c}`);
  }
  // A high-lightness, near-zero-chroma colour is near-grey (R~G~B).
  const grey = oklchToSrgbByte(0.92, 0.01, 0);
  assert.ok(Math.max(...grey) - Math.min(...grey) < 12, `near-grey, got ${grey}`);
  // A pure red-ish hue (~29 deg in OKLCh) has R as the dominant channel.
  const red = oklchToSrgbByte(0.62, 0.20, 29);
  assert.ok(red[0] > red[1] && red[0] > red[2], `red-dominant, got ${red}`);
});

test("oklchToSrgbByte: black and white anchors", () => {
  const black = oklchToSrgbByte(0, 0, 0);
  assert.deepEqual(black, [0, 0, 0]);
  const white = oklchToSrgbByte(1, 0, 0);
  for (const c of white) assert.ok(c >= 254, `white ~255, got ${white}`);
});
