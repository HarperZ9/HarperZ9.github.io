// colour-perceptual.mjs - Telos Studio perception channel: a PURE, zero-dependency,
// science-grounded colour module. Linearize-first, cluster dominant colours in OKLab,
// measure colour distance in CIEDE2000, tag gamut/HDR, and score the palette with WPRE.
//
// Implements SPEC-telos-sensory-engine.md section C (the colour bullet) + move D (WPRE).
// Every transform uses the CANONICAL published formula; constants are cited inline.
//
// Pure: no DOM, no canvas, no Math.random, no Date.now. Node-importable + node-testable.
// Pixels arrive as a Uint8ClampedArray of RGBA bytes (the browser's canvas convention);
// tests pass synthetic typed arrays. No em-dashes anywhere (ASCII hyphens only).

// ── (1) sRGB transfer function (EOTF) ────────────────────────────────────────
// IEC 61966-2-1: the sRGB piecewise gamma. Exponent 2.4, linear-segment slope 12.92,
// offset 0.055, and the breakpoints 0.04045 (encoded) / 0.0031308 (linear).
// Cites: IEC 61966-2-1:1999; CSS Color 4 sec "The Predefined sRGB Color Space".
// Input/output are normalized [0,1]; values outside are handled by the same curve.
export function srgbToLinear(c) {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

export function linearToSrgb(c) {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

// ── (2) Linear sRGB -> CIE XYZ (D65) ─────────────────────────────────────────
// The CSS Color 4 reference matrix (lin-sRGB D65 -> XYZ D65), full published precision.
// Cites: W3C CSS Color Module Level 4, "Converting sRGB colors to and from CIE XYZ"
//   (matrix from w3c/csswg-drafts issue #7675 corrected values).
// https://www.w3.org/TR/css-color-4/
const M_LSRGB_TO_XYZ = [
  [0.41239079926595934, 0.357584339383878, 0.1804807884018343],
  [0.21263900587151027, 0.715168678767756, 0.07219231536073371],
  [0.01933081871559182, 0.11919477979462598, 0.9505321522496607],
];

export function linearRgbToXyz(r, g, b) {
  const m = M_LSRGB_TO_XYZ;
  return [
    m[0][0] * r + m[0][1] * g + m[0][2] * b,
    m[1][0] * r + m[1][1] * g + m[1][2] * b,
    m[2][0] * r + m[2][1] * g + m[2][2] * b,
  ];
}

// ── (3) Linear sRGB -> OKLab ─────────────────────────────────────────────────
// Ottosson OKLab (2020, matrices updated 2021): M1 (lin-sRGB -> LMS), cube root,
// then M2 (l'm's' -> Lab). Hue-stable, no blue-purple drift under interpolation.
// Cites: Bjorn Ottosson, "A perceptual color space for image processing" (2020),
//   https://bottosson.github.io/posts/oklab/  (the 2021 D65-aligned coefficients).
const M1_LSRGB_TO_LMS = [
  [0.4122214708, 0.5363325363, 0.0514459929],
  [0.2119034982, 0.6806995451, 0.1073969566],
  [0.0883024619, 0.2817188376, 0.6299787005],
];
const M2_LMS_TO_OKLAB = [
  [0.2104542553, 0.793617785, -0.0040720468],
  [1.9779984951, -2.428592205, 0.4505937099],
  [0.0259040371, 0.7827717662, -0.808675766],
];

export function linearRgbToOklab(r, g, b) {
  const a1 = M1_LSRGB_TO_LMS;
  const l = a1[0][0] * r + a1[0][1] * g + a1[0][2] * b;
  const m = a1[1][0] * r + a1[1][1] * g + a1[1][2] * b;
  const s = a1[2][0] * r + a1[2][1] * g + a1[2][2] * b;
  // Cube root preserves sign so out-of-gamut negatives stay well-defined.
  const l_ = Math.cbrt(l), m_ = Math.cbrt(m), s_ = Math.cbrt(s);
  const a2 = M2_LMS_TO_OKLAB;
  return [
    a2[0][0] * l_ + a2[0][1] * m_ + a2[0][2] * s_,
    a2[1][0] * l_ + a2[1][1] * m_ + a2[1][2] * s_,
    a2[2][0] * l_ + a2[2][1] * m_ + a2[2][2] * s_,
  ];
}

// OKLab -> OKLCh (cylindrical): L unchanged, C = hypot(a,b), h in DEGREES [0,360).
export function oklabToOklch(L, a, b) {
  const C = Math.hypot(a, b);
  let h = Math.atan2(b, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return [L, C, h];
}

// ── (4) CIE XYZ (D65) -> CIELAB ──────────────────────────────────────────────
// The CIELAB path used by CIEDE2000. D65 reference white (CIE 1931 2-degree):
// Xn=0.9505, Yn=1.0, Zn=1.0891 (per the spec's stated white). delta = 6/29.
// Cites: CIE 15:2004; the f() kink at (6/29)^3 with slope 1/(3 delta^2) and offset 4/29.
const D65_WHITE = { Xn: 0.9505, Yn: 1.0, Zn: 1.0891 };
const LAB_DELTA = 6 / 29;
const LAB_DELTA3 = LAB_DELTA * LAB_DELTA * LAB_DELTA; // (6/29)^3 ~= 0.008856

function labF(t) {
  return t > LAB_DELTA3
    ? Math.cbrt(t)
    : t / (3 * LAB_DELTA * LAB_DELTA) + 4 / 29;
}

export function xyzToLab(X, Y, Z) {
  const fx = labF(X / D65_WHITE.Xn);
  const fy = labF(Y / D65_WHITE.Yn);
  const fz = labF(Z / D65_WHITE.Zn);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Convenience: sRGB byte [0..255] triple -> CIELAB (linearize -> XYZ -> Lab).
export function srgbByteToLab(r8, g8, b8) {
  const r = srgbToLinear(r8 / 255), g = srgbToLinear(g8 / 255), b = srgbToLinear(b8 / 255);
  const [X, Y, Z] = linearRgbToXyz(r, g, b);
  return xyzToLab(X, Y, Z);
}

// ── (5) CIEDE2000 colour difference ──────────────────────────────────────────
// The Luo/Sharma/Dalal reference implementation, with the 4-case mean-hue handling
// and the RT rotation term. Reproduces Sharma's published test vectors.
// Cites: G. Sharma, W. Wu, E. N. Dalal, "The CIEDE2000 Color-Difference Formula:
//   Implementation Notes, Supplementary Test Data, and Mathematical Observations",
//   Color Res. Appl. 30(1), 21-30 (2005). https://hajim.rochester.edu/ece/sites/gsharma/ciede2000/
// kL = kC = kH = 1 (reference conditions). lab = [L, a, b].
const DEG = Math.PI / 180;
const RAD = 180 / Math.PI;

export function ciede2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;

  // Step 1: C, h with the G-compensated a' (boosts low-chroma a to fix grey region).
  const C1ab = Math.hypot(a1, b1);
  const C2ab = Math.hypot(a2, b2);
  const Cbar = (C1ab + C2ab) / 2;
  const Cbar7 = Math.pow(Cbar, 7);
  const G = 0.5 * (1 - Math.sqrt(Cbar7 / (Cbar7 + 6103515625))); // 25^7 = 6103515625
  const a1p = (1 + G) * a1;
  const a2p = (1 + G) * a2;
  const C1p = Math.hypot(a1p, b1);
  const C2p = Math.hypot(a2p, b2);
  const h1p = hueDeg(b1, a1p);
  const h2p = hueDeg(b2, a2p);

  // Step 2: deltas. dh' uses the shortest-arc convention (the |diff|>180 fold).
  const dLp = L2 - L1;
  const dCp = C2p - C1p;
  let dhp;
  if (C1p * C2p === 0) {
    dhp = 0;
  } else if (Math.abs(h2p - h1p) <= 180) {
    dhp = h2p - h1p;
  } else if (h2p - h1p > 180) {
    dhp = h2p - h1p - 360;
  } else {
    dhp = h2p - h1p + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * DEG) / 2);

  // Step 3: weighting functions. Hbar' is the 4-case mean hue.
  const Lbarp = (L1 + L2) / 2;
  const Cbarp = (C1p + C2p) / 2;
  let hbarp;
  const hsum = h1p + h2p;
  if (C1p * C2p === 0) {
    hbarp = hsum;
  } else if (Math.abs(h1p - h2p) <= 180) {
    hbarp = hsum / 2;
  } else if (hsum < 360) {
    hbarp = (hsum + 360) / 2;
  } else {
    hbarp = (hsum - 360) / 2;
  }

  const T = 1
    - 0.17 * Math.cos((hbarp - 30) * DEG)
    + 0.24 * Math.cos((2 * hbarp) * DEG)
    + 0.32 * Math.cos((3 * hbarp + 6) * DEG)
    - 0.20 * Math.cos((4 * hbarp - 63) * DEG);

  const dTheta = 30 * Math.exp(-Math.pow((hbarp - 275) / 25, 2));
  const Cbarp7 = Math.pow(Cbarp, 7);
  const RC = 2 * Math.sqrt(Cbarp7 / (Cbarp7 + 6103515625));
  const SL = 1 + (0.015 * Math.pow(Lbarp - 50, 2)) / Math.sqrt(20 + Math.pow(Lbarp - 50, 2));
  const SC = 1 + 0.045 * Cbarp;
  const SH = 1 + 0.015 * Cbarp * T;
  const RT = -Math.sin(2 * dTheta * DEG) * RC;

  // Step 4: combine (kL = kC = kH = 1).
  const termL = dLp / SL;
  const termC = dCp / SC;
  const termH = dHp / SH;
  return Math.sqrt(
    termL * termL + termC * termC + termH * termH + RT * termC * termH
  );
}

// Hue angle in degrees [0,360) from (b, a'); 0 when both are 0 (the grey convention).
function hueDeg(b, ap) {
  if (b === 0 && ap === 0) return 0;
  let h = Math.atan2(b, ap) * RAD;
  if (h < 0) h += 360;
  return h;
}

// ── (6) Dominant colours via k-means in OKLab ────────────────────────────────
// Linearize-first, cluster in OKLab (hue-stable), report each centroid as OKLCh with
// its area fraction and spatial centroid. DETERMINISTIC: k-means++ seeded with a fixed
// first pick (no Math.random). Cites the spec colour bullet: cluster in OKLab, report
// {oklch, centroid_x, centroid_y, area_frac}.
//
// pixels: Uint8ClampedArray RGBA. opts: { width, height, maxIters=32, sampleStride=1 }.
// Returns up to k clusters sorted by descending areaFraction.
export function dominantColoursOklab(pixels, k = 4, opts = {}) {
  const { width = 0, height = 0, maxIters = 32, sampleStride = 1 } = opts;
  const stride = Math.max(1, Math.floor(sampleStride));
  const n = (pixels.length / 4) | 0;
  if (n === 0 || k < 1) return [];

  // Build the OKLab sample set (+ pixel index for spatial centroids), skipping fully
  // transparent pixels (alpha 0 carries no colour).
  const labs = [];   // flat [L,a,b, L,a,b, ...]
  const idxs = [];   // source pixel index per sample
  for (let p = 0; p < n; p += stride) {
    const o = p * 4;
    if (pixels[o + 3] === 0) continue;
    const r = srgbToLinear(pixels[o] / 255);
    const g = srgbToLinear(pixels[o + 1] / 255);
    const b = srgbToLinear(pixels[o + 2] / 255);
    const lab = linearRgbToOklab(r, g, b);
    labs.push(lab[0], lab[1], lab[2]);
    idxs.push(p);
  }
  const m = idxs.length;
  if (m === 0) return [];
  const realK = Math.min(k, m);

  // k-means++ init, made deterministic: first centre = sample 0, each subsequent centre
  // = the sample with the maximum squared distance to its nearest chosen centre (the
  // farthest-point / D^2-argmax rule with a fixed pick, not a random draw).
  const centres = [labs[0], labs[1], labs[2]];
  for (let c = 1; c < realK; c++) {
    let best = -1, bestD = -1;
    for (let i = 0; i < m; i++) {
      const d = nearestSqDist(labs, i, centres, c);
      if (d > bestD) { bestD = d; best = i; }
    }
    const bo = best * 3;
    centres.push(labs[bo], labs[bo + 1], labs[bo + 2]);
  }

  // Lloyd iterations to convergence (assignment stable) or maxIters.
  const assign = new Int32Array(m).fill(-1);
  for (let it = 0; it < maxIters; it++) {
    let moved = 0;
    for (let i = 0; i < m; i++) {
      const a = nearestCentre(labs, i, centres, realK);
      if (a !== assign[i]) { assign[i] = a; moved++; }
    }
    // Recompute centres as the mean of their members.
    const sumL = new Float64Array(realK);
    const sumA = new Float64Array(realK);
    const sumB = new Float64Array(realK);
    const cnt = new Float64Array(realK);
    for (let i = 0; i < m; i++) {
      const a = assign[i], lo = i * 3;
      sumL[a] += labs[lo]; sumA[a] += labs[lo + 1]; sumB[a] += labs[lo + 2]; cnt[a]++;
    }
    for (let c = 0; c < realK; c++) {
      if (cnt[c] > 0) {
        centres[c * 3] = sumL[c] / cnt[c];
        centres[c * 3 + 1] = sumA[c] / cnt[c];
        centres[c * 3 + 2] = sumB[c] / cnt[c];
      }
    }
    if (moved === 0 && it > 0) break;
  }

  // Aggregate per-cluster: area fraction + spatial centroid (normalized when w/h given).
  const cnt = new Float64Array(realK);
  const sx = new Float64Array(realK);
  const sy = new Float64Array(realK);
  const haveSpatial = width > 0 && height > 0;
  for (let i = 0; i < m; i++) {
    const a = assign[i];
    cnt[a]++;
    if (haveSpatial) {
      const p = idxs[i];
      sx[a] += (p % width);
      sy[a] += Math.floor(p / width);
    }
  }

  const out = [];
  for (let c = 0; c < realK; c++) {
    if (cnt[c] === 0) continue;
    const L = centres[c * 3], a = centres[c * 3 + 1], b = centres[c * 3 + 2];
    const [oL, oC, oh] = oklabToOklch(L, a, b);
    out.push({
      oklch: { L: oL, C: oC, h: oh },
      areaFraction: cnt[c] / m,
      centroidX: haveSpatial ? sx[c] / cnt[c] / width : null,
      centroidY: haveSpatial ? sy[c] / cnt[c] / height : null,
    });
  }
  out.sort((p, q) => q.areaFraction - p.areaFraction);
  return out;
}

// squared OKLab distance from sample i to the nearest of the first `count` centres.
function nearestSqDist(labs, i, centres, count) {
  const lo = i * 3, L = labs[lo], a = labs[lo + 1], b = labs[lo + 2];
  let best = Infinity;
  for (let c = 0; c < count; c++) {
    const co = c * 3;
    const dL = L - centres[co], da = a - centres[co + 1], db = b - centres[co + 2];
    const d = dL * dL + da * da + db * db;
    if (d < best) best = d;
  }
  return best;
}

// index of the nearest of `count` centres to sample i (OKLab Euclidean).
function nearestCentre(labs, i, centres, count) {
  const lo = i * 3, L = labs[lo], a = labs[lo + 1], b = labs[lo + 2];
  let best = Infinity, bi = 0;
  for (let c = 0; c < count; c++) {
    const co = c * 3;
    const dL = L - centres[co], da = a - centres[co + 1], db = b - centres[co + 2];
    const d = dL * dL + da * da + db * db;
    if (d < best) { best = d; bi = c; }
  }
  return bi;
}

// ── (7) WPRE: Weighted Palette Readout Error ─────────────────────────────────
// The colour self-improvement metric (spec move D). For each pixel, dE00 (CIELAB) to its
// NEAREST palette colour; WPRE = 0.6*p95(dE00) + 0.4*(luminance-weighted mean dE00).
// Lower is better; target < 2.0. Cites: SPEC-telos-sensory-engine.md move D (colour metric);
// CIEDE2000 (Sharma 2005); CIELAB L* as the luminance weight.
//
// pixels: Uint8ClampedArray RGBA. paletteLab: array of [L,a,b] CIELAB triples.
// opts: { sampleStride=1 }.
export function wpre(pixels, paletteLab, opts = {}) {
  const { sampleStride = 1 } = opts;
  const stride = Math.max(1, Math.floor(sampleStride));
  const n = (pixels.length / 4) | 0;
  if (n === 0 || !paletteLab || paletteLab.length === 0) return 0;

  const dEs = [];
  let wSum = 0, wErrSum = 0;
  for (let p = 0; p < n; p += stride) {
    const o = p * 4;
    if (pixels[o + 3] === 0) continue;
    const lab = srgbByteToLab(pixels[o], pixels[o + 1], pixels[o + 2]);
    let best = Infinity;
    for (let j = 0; j < paletteLab.length; j++) {
      const d = ciede2000(lab, paletteLab[j]);
      if (d < best) best = d;
    }
    dEs.push(best);
    // Luminance weight = CIELAB L* normalized to [0,1]; +epsilon so pure black still counts.
    const w = lab[0] / 100 + 1e-3;
    wSum += w;
    wErrSum += w * best;
  }
  if (dEs.length === 0) return 0;

  const p95 = percentile(dEs, 0.95);
  const lumMean = wSum > 0 ? wErrSum / wSum : 0;
  return 0.6 * p95 + 0.4 * lumMean;
}

// Linear-interpolated percentile (q in [0,1]) over an unsorted numeric array.
function percentile(arr, q) {
  const a = arr.slice().sort((x, y) => x - y);
  if (a.length === 1) return a[0];
  const pos = q * (a.length - 1);
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  if (lo === hi) return a[lo];
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}

// ── (8) Colour-volume tag (gamut / transfer / peak luminance) ────────────────
// Honest descriptor for the colour volume a payload was measured in (spec: tag
// {gamut, transfer, peak_nits}). This is a passthrough labeller, not a detector:
// it records what the caller declares so downstream HDR/wide-gamut paths can branch.
// Cites: spec colour bullet (gamut/HDR tags); BT.2124/BT.2100 transfer names.
export function colourVolumeTag({ gamut = "srgb", transfer = "srgb", peakNits = 80 } = {}) {
  const GAMUTS = new Set(["srgb", "display-p3", "rec2020"]);
  const TRANSFERS = new Set(["srgb", "pq", "hlg"]);
  return {
    gamut: GAMUTS.has(gamut) ? gamut : "srgb",
    transfer: TRANSFERS.has(transfer) ? transfer : "srgb",
    peakNits: Number.isFinite(peakNits) && peakNits > 0 ? peakNits : 80,
  };
}
