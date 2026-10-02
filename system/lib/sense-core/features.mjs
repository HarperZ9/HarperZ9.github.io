// sense.js — the measurimeter's pure senses. Everything the model is GIVEN about a frame,
// measured from the real pixels, as numbers a viewer can watch and a node test can recompute.
//
// These are ADDITIVE to shared-frame/eye.js. They never touch the gated dHash / `features` there
// (those stay bit-identical to coherence-membrane and to eye.test.mjs). This module is the richer,
// honest readout layered on top: a faithful downsample (the truth, not a summary), dominant colours,
// edge density (Sobel), light/dark regions, a plain-language description, and the audio RMS math.
//
// Pure + browser-free so node can import and test the maths directly. The browser passes real
// canvas pixels (Uint8ClampedArray RGBA); the tests pass synthetic typed arrays.

import { srgbToLinear as _srgbToLinear, linearRgbToOklab as _linearRgbToOklab } from "./colour-perceptual.mjs";

// ── (1) The faithful representation: box-average to an n×n RGB grid ───────────
// The ACTUAL frame, downsampled — the real pixels averaged into n×n cells. Not an invented
// description: a true, lower-resolution copy. This is the representation a native model consumes.
// `boxAverage` is the pure core (tested in node); `representation` wraps it for a canvas-like source.
export function boxAverage(px, w, h, ch, n) {
  const grid = [];
  for (let gy = 0; gy < n; gy++) {
    const y0 = Math.floor(gy * h / n), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / n));
    const row = [];
    for (let gx = 0; gx < n; gx++) {
      const x0 = Math.floor(gx * w / n), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / n));
      let r = 0, g = 0, b = 0, count = 0;
      for (let yy = y0; yy < y1; yy++) {
        const base = yy * w;
        for (let xx = x0; xx < x1; xx++) {
          const i = (base + xx) * ch;
          r += px[i]; g += px[i + 1]; b += px[i + 2]; count++;
        }
      }
      count = count || 1;
      row.push([Math.round(r / count), Math.round(g / count), Math.round(b / count)]);
    }
    grid.push(row);
  }
  return { grid, w: n, h: n };
}

// Accepts a {data,width,height} (ImageData-like) OR a canvas. Returns {grid:[[ [r,g,b], ... ]], w, h}.
// Pass a `read` fn (canvas,w,h)->RGBA bytes to bridge a real canvas; defaults to .data on the source.
export function representation(source, n = 32, read) {
  let px, w, h;
  if (read && typeof source.getContext === "function") {
    w = source.width; h = source.height; px = read(source, w, h);
  } else if (source.data) {
    px = source.data; w = source.width; h = source.height;
  } else {
    throw new Error("representation: pass an ImageData-like {data,width,height} or a canvas + read fn");
  }
  return boxAverage(px, w, h, 4, n);
}

// ── (2) Richer measured features (additive — eye.js's `features` is untouched) ─
// Colour words, rule R-hue-v1 (Track A step T1). The earlier HSV hue buckets named an eosin pink
// "red", a hematoxylin purple "indigo" and a dark slate "blue". Words now come from OKLCh:
//   - achromatic when chroma C < 0.035 (build-color's achromatic threshold): black below L 0.35,
//     white at L 0.85 and above, grey between (build-color's lightness bands, collapsed);
//   - otherwise the hue sector of the nearest prototype hue among pink, red, orange, yellow, green,
//     blue and purple (prototypes: build-color's 11 basic colours);
//   - brown for dark orange, dark yellow and dark brownish red; red for dark pink. Every split is the
//     mean of two prototype values, so no constant here was tuned by hand.
// Nearest prototype in OKLab (the earlier proposal) was rejected: it names lime "yellow", cyan
// "white" and sky blue "pink". Every word ships with its margin, the OKLab distance to the boundary
// that decided it, so a reader can tell a confident word from a coin toss.
const BASIC_PROTOTYPES = Object.freeze({
  red: [255, 0, 0], orange: [255, 165, 0], yellow: [255, 255, 0], green: [0, 128, 0],
  blue: [0, 0, 255], purple: [128, 0, 128], pink: [255, 192, 203], brown: [139, 69, 19],
  white: [255, 255, 255], grey: [128, 128, 128], black: [0, 0, 0],
});
const HUE_BEARING = ["pink", "red", "orange", "yellow", "green", "blue", "purple"];
const C_ACHROMATIC = 0.035, L_BLACK = 0.35, L_WHITE = 0.85;

function oklchOfBytes(r, g, b) {
  const [L, a, bb] = _linearRgbToOklab(_srgbToLinear(r / 255), _srgbToLinear(g / 255), _srgbToLinear(b / 255));
  let h = Math.atan2(bb, a) * 180 / Math.PI;
  if (h < 0) h += 360;
  return { L, C: Math.hypot(a, bb), h };
}
const PROTO_LCH = Object.freeze(Object.fromEntries(
  Object.entries(BASIC_PROTOTYPES).map(([n, v]) => [n, oklchOfBytes(v[0], v[1], v[2])])));
const L_BROWN_SPLIT = (PROTO_LCH.orange.L + PROTO_LCH.brown.L) / 2;
const H_RED_BROWN = (PROTO_LCH.red.h + PROTO_LCH.brown.h) / 2;
const L_DARK_PINK = (PROTO_LCH.red.L + PROTO_LCH.purple.L) / 2;
const circDeg = (a, b) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };
// OKLab distance from a colour at chroma c to a hue ray `deg` degrees away (the chord).
const arcDist = (c, deg) => 2 * c * Math.sin(Math.min(deg, 90) * Math.PI / 360);

// The word and its margin for one sRGB byte triple. Pure and deterministic.
export function colourWord(r, g, b) {
  const { L, C, h } = oklchOfBytes(r, g, b);
  if (C < C_ACHROMATIC) {
    const mC = C_ACHROMATIC - C;
    if (L < L_BLACK) return { name: "black", margin: Math.min(mC, L_BLACK - L) };
    if (L >= L_WHITE) return { name: "white", margin: Math.min(mC, L - L_WHITE) };
    return { name: "grey", margin: Math.min(mC, L - L_BLACK, L_WHITE - L) };
  }
  const ds = HUE_BEARING.map((n) => [circDeg(h, PROTO_LCH[n].h), n])
    .sort((x, y) => (x[0] - y[0]) || (x[1] < y[1] ? -1 : x[1] > y[1] ? 1 : 0));
  const sector = ds[0][1];
  let margin = Math.min(arcDist(C, (ds[1][0] - ds[0][0]) / 2), C - C_ACHROMATIC);
  const brownish = sector === "orange" || sector === "yellow" || (sector === "red" && h >= H_RED_BROWN);
  if (sector === "red") margin = Math.min(margin, arcDist(C, Math.abs(h - H_RED_BROWN)));
  if (brownish) {
    margin = Math.min(margin, Math.abs(L - L_BROWN_SPLIT));
    if (L < L_BROWN_SPLIT) return { name: "brown", margin };
  }
  if (sector === "pink") {
    margin = Math.min(margin, Math.abs(L - L_DARK_PINK));
    if (L < L_DARK_PINK) return { name: "red", margin };
  }
  return { name: sector, margin };
}

// The basic colour word for sRGB bytes (0..255): one of black, white, grey, red, orange, yellow,
// green, blue, purple, pink, brown.
export function colourName(r, g, b) {
  return colourWord(r, g, b).name;
}

function hsvToRgbBytes(hDeg, s, v) {
  const h = (((hDeg % 360) + 360) % 360) / 60, i = Math.floor(h), f = h - i;
  const p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6];
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// Kept for callers that hold HSV: converts back to sRGB bytes and names the colour by R-hue-v1.
export function hueName(hDeg, sat, val) {
  const [r, g, b] = hsvToRgbBytes(hDeg, sat, val);
  return colourName(r, g, b);
}

function rgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: mx === 0 ? 0 : d / mx, v: mx };
}

function toHex(r, g, b) {
  return "#" + [r, g, b].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
}

// Dominant colours via a coarse 4×4×4 RGB histogram (64 bins). Returns up to `k` bins by population,
// each as {hex, r, g, b, frac} — the average colour of the bin, weighted by how much of the frame it is.
export function dominantColors(px, w, h, ch, k = 5) {
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

// Edge density via a Sobel gradient magnitude on luma, thresholded. Fraction of interior pixels with
// a strong edge → "busy" vs "smooth". (eye.js has an `applyEdges` renderer; this only measures.)
export function edgeDensity(px, w, h, ch, threshold = 48) {
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

// Light/dark region split: fraction of pixels brighter / darker than the mid + the mean luma.
export function regionSplit(px, w, h, ch) {
  const n = w * h; let sum = 0, light = 0, dark = 0;
  for (let i = 0; i < n; i++) {
    const o = i * ch, g = (px[o] * 299 + px[o + 1] * 587 + px[o + 2] * 114) / 1000;
    sum += g; if (g > 160) light++; else if (g < 96) dark++;
  }
  return { light: light / n, dark: dark / n, meanLuma: sum / n / 255 };
}

// The richer feature bundle. ADDITIVE: this is layered on top of eye.js's gated `features(...)`;
// it never replaces it. `aspect` + `orientation` describe the frame's shape.
export function richFeatures(px, w, h, ch = 4) {
  const dom = dominantColors(px, w, h, ch, 5);
  const top = dom[0] || { r: 0, g: 0, b: 0 };
  const hsv = rgbToHsv(top.r, top.g, top.b);
  const word = colourWord(top.r, top.g, top.b);
  const regions = regionSplit(px, w, h, ch);
  const aspect = h ? w / h : 1;
  return {
    dominantColors: dom.map(d => d.hex),
    dominantSwatches: dom,                       // full {hex,r,g,b,frac} for the swatch meters
    hueName: word.name,
    hueMargin: +word.margin.toFixed(4),
    hueDeg: hsv.h,
    edgeDensity: edgeDensity(px, w, h, ch),
    lightRegions: regions.light,
    darkRegions: regions.dark,
    meanLuma: regions.meanLuma,
    aspect,
    orientation: aspect > 1.15 ? "wide" : aspect < 0.87 ? "tall" : "square",
    width: w, height: h,
  };
}

// ── describeFrame: one specific sentence grounding the model's "what I see" ───
// Names the dominant hue + busy/smooth + light/dark/orientation — built only from measured numbers.
export function describeFrame(f) {
  const busy = f.edgeDensity > 0.22 ? "busy, high-edge" : f.edgeDensity < 0.07 ? "smooth, low-edge" : "moderately textured";
  const tone = f.meanLuma > 0.62 ? "bright" : f.meanLuma < 0.32 ? "dark" : "mid-toned";
  const shape = f.orientation === "wide" ? "a wide" : f.orientation === "tall" ? "a tall" : "a square";
  const hue = f.hueName || "neutral";
  return `${shape}, ${tone}, ${busy} frame dominated by ${hue}.`;
}

// ── (3) Audio: RMS level math (pure, node-testable on a synthetic buffer) ─────
// RMS of a normalized waveform (Float32, -1..1) — the VU/level the model is given. Returns 0..~1.
export function rms(buffer) {
  if (!buffer || !buffer.length) return 0;
  let sum = 0;
  for (let i = 0; i < buffer.length; i++) sum += buffer[i] * buffer[i];
  return Math.sqrt(sum / buffer.length);
}

// RMS from a byte time-domain buffer (Web Audio getByteTimeDomainData: 0..255, 128 = silence).
export function rmsFromBytes(bytes) {
  if (!bytes || !bytes.length) return 0;
  let sum = 0;
  for (let i = 0; i < bytes.length; i++) { const v = (bytes[i] - 128) / 128; sum += v * v; }
  return Math.sqrt(sum / bytes.length);
}

// Reduce a frequency-magnitude buffer (getByteFrequencyData, 0..255) to `bands` averaged bands (0..1).
export function spectrumBands(freq, bands = 8) {
  const out = new Array(bands).fill(0);
  if (!freq || !freq.length) return out;
  const per = freq.length / bands;
  for (let b = 0; b < bands; b++) {
    const lo = Math.floor(b * per), hi = Math.max(lo + 1, Math.floor((b + 1) * per));
    let sum = 0; for (let i = lo; i < hi; i++) sum += freq[i];
    out[b] = sum / (hi - lo) / 255;
  }
  return out;
}

// Rough dominant pitch: the bin with the most energy → Hz, given the sample rate + FFT size.
export function dominantPitchHz(freq, sampleRate, fftSize) {
  if (!freq || !freq.length) return 0;
  let peak = 0, peakVal = 0;
  for (let i = 1; i < freq.length; i++) if (freq[i] > peakVal) { peakVal = freq[i]; peak = i; }
  if (peakVal < 8) return 0; // essentially silence
  return Math.round(peak * sampleRate / fftSize);
}

/* ── granular perception (2026-07-10) ─────────────────────────────────────────
   Detail features rich enough for a NO-VISION reader to reconstruct the frame:
   a spatial 3x3 grid with per-cell tone/texture/hue, an NxN hex color map, an
   edge-orientation histogram, mirror-symmetry scores, and an ASCII luminance
   render. All pure and deterministic; callers pass (px, w, h, ch) as usual.
   For live use, feed a downsampled read (<=~200px wide) - these are
   description-grade features, not archival measurements. */

function lumaAt(px, ch, w, x, y) {
  const i = (y * w + x) * ch;
  return (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
}

// Per-cell tone, texture, and hue over an n x n grid. One pass over the frame.
export function regionGrid(px, w, h, ch = 4, cells = 3) {
  const grid = [];
  for (let cy = 0; cy < cells; cy++) {
    const row = [];
    for (let cx = 0; cx < cells; cx++) {
      const x0 = Math.floor(cx * w / cells), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cells));
      const y0 = Math.floor(cy * h / cells), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / cells));
      let sum = 0, edge = 0, count = 0, r = 0, g = 0, b = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * w + x) * ch;
          r += px[i]; g += px[i + 1]; b += px[i + 2];
          const l = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
          sum += l;
          if (x > x0 && y > y0) {
            const gx = l - lumaAt(px, ch, w, x - 1, y);
            const gy = l - lumaAt(px, ch, w, x, y - 1);
            if (Math.hypot(gx, gy) >= 24) edge++;
          }
          count++;
        }
      }
      const mr = Math.round(r / count), mg = Math.round(g / count), mb = Math.round(b / count);
      row.push({
        luma: +(sum / count / 255).toFixed(3),
        edge: +(edge / count).toFixed(3),
        hue: colourName(mr, mg, mb),
        hex: "#" + [mr, mg, mb].map((v) => v.toString(16).padStart(2, "0")).join(""),
      });
    }
    grid.push(row);
  }
  return grid;
}

// NxN mean-colour hex map - a recreatable low-res pixel image of the frame.
export function colorGridHex(px, w, h, ch = 4, cells = 16) {
  const rows = [];
  for (let cy = 0; cy < cells; cy++) {
    const row = [];
    for (let cx = 0; cx < cells; cx++) {
      const x0 = Math.floor(cx * w / cells), x1 = Math.max(x0 + 1, Math.floor((cx + 1) * w / cells));
      const y0 = Math.floor(cy * h / cells), y1 = Math.max(y0 + 1, Math.floor((cy + 1) * h / cells));
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * ch; r += px[i]; g += px[i + 1]; b += px[i + 2]; count++;
      }
      row.push("#" + [r, g, b].map((v) => Math.round(v / count).toString(16).padStart(2, "0")).join(""));
    }
    rows.push(row);
  }
  return rows;
}

// Edge-orientation histogram: fraction of strong edges near horizontal /
// vertical / the two diagonals, plus the dominant direction name.
// Angles are taken with y pointing UP on the displayed image (Track A step T1): the earlier version
// used image rows (y down) with names that assume y up, so a rising "/" edge read "falling diagonal".
// `coherence` is the length of the mean doubled-angle unit vector (0 = no preferred orientation,
// 1 = one orientation). Below COHERENCE_FLOOR the frame has no dominant orientation and says "none"
// (an isotropic disk used to read "rising diagonal" through a tie rule).
const COHERENCE_FLOOR = 0.2;
export function edgeOrientations(px, w, h, ch = 4, threshold = 40) {
  const bins = [0, 0, 0, 0]; // 0=horizontal edge, 1=rising diagonal, 2=vertical, 3=falling diagonal
  let strong = 0, vx = 0, vy = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const sx = -lumaAt(px, ch, w, x - 1, y - 1) - 2 * lumaAt(px, ch, w, x - 1, y) - lumaAt(px, ch, w, x - 1, y + 1)
        + lumaAt(px, ch, w, x + 1, y - 1) + 2 * lumaAt(px, ch, w, x + 1, y) + lumaAt(px, ch, w, x + 1, y + 1);
      const sy = -lumaAt(px, ch, w, x - 1, y - 1) - 2 * lumaAt(px, ch, w, x, y - 1) - lumaAt(px, ch, w, x + 1, y - 1)
        + lumaAt(px, ch, w, x - 1, y + 1) + 2 * lumaAt(px, ch, w, x, y + 1) + lumaAt(px, ch, w, x + 1, y + 1);
      const mag = Math.hypot(sx, sy);
      if (mag < threshold) continue;
      strong++;
      // Gradient angle with y up (negate the row-wise sy) -> edge angle (perpendicular), folded
      // into 4 bins over 180 degrees.
      const a = (Math.atan2(-sy, sx) * 180 / Math.PI + 90 + 360) % 180;
      bins[Math.round(a / 45) % 4]++;
      const t = a * Math.PI / 90; // twice the edge angle, in radians
      vx += Math.cos(t); vy += Math.sin(t);
    }
  }
  const total = strong || 1;
  const names = ["horizontal", "rising diagonal", "vertical", "falling diagonal"];
  const norm = bins.map((v) => +(v / total).toFixed(3));
  const domIdx = bins.indexOf(Math.max(...bins));
  const coherence = strong ? Math.hypot(vx, vy) / strong : 0;
  return { horizontal: norm[0], risingDiagonal: norm[1], vertical: norm[2], fallingDiagonal: norm[3],
    dominant: strong && coherence >= COHERENCE_FLOOR ? names[domIdx] : "none",
    coherence: +coherence.toFixed(3), strongEdgeCount: strong };
}

// Mirror symmetry per axis as the Pearson correlation between luma and its mirror image, in [-1, 1]
// (Track A step T1). `horizontal` mirrors left-right and `vertical` mirrors top-bottom. 1 = exactly
// mirrored; near 0 = no relation (white noise); negative = the two halves run opposite ways. A flat
// frame has nothing to correlate and reports null. The earlier score, 1 - mean |difference| / 255,
// had no chance baseline: a low-contrast frame scored near 1 whatever its layout, and noise 0.78.
export const MIRROR_THRESHOLD = 0.9;
export function symmetryScores(px, w, h, ch = 4) {
  const n = w * h;
  const flat = { horizontal: null, vertical: null, measure: "pearson-luma-mirror" };
  if (!n) return flat;
  const l = new Float64Array(n);
  let mean = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = lumaAt(px, ch, w, x, y); l[y * w + x] = v; mean += v; }
  mean /= n;
  let varSum = 0, hCov = 0, vCov = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = l[y * w + x] - mean;
      varSum += d * d;
      hCov += d * (l[y * w + (w - 1 - x)] - mean);
      vCov += d * (l[(h - 1 - y) * w + x] - mean);
    }
  }
  if (!(varSum > 1e-9 * n)) return flat;
  const r = (c) => +Math.max(-1, Math.min(1, c / varSum)).toFixed(3);
  return { horizontal: r(hCov), vertical: r(vCov), measure: "pearson-luma-mirror" };
}

// ASCII luminance render: the no-vision view of the frame. `cols` characters
// wide; rows follow the aspect at the ~2:1 character cell. The ramp runs
// dark -> bright.
const ASCII_RAMP = " .:-=+*#%@";
export function asciiRender(px, w, h, ch = 4, cols = 64) {
  const rows = Math.max(2, Math.round(cols * (h / w) * 0.5));
  const out = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    for (let rx = 0; rx < cols; rx++) {
      const x0 = Math.floor(rx * w / cols), x1 = Math.max(x0 + 1, Math.floor((rx + 1) * w / cols));
      const y0 = Math.floor(ry * h / rows), y1 = Math.max(y0 + 1, Math.floor((ry + 1) * h / rows));
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += lumaAt(px, ch, w, x, y); count++; }
      const t = sum / count / 255;
      line += ASCII_RAMP[Math.min(ASCII_RAMP.length - 1, Math.floor(t * ASCII_RAMP.length))];
    }
    out.push(line);
  }
  return out.join("\n");
}

/* ── reconstruction-grade perception (2026-07-10) ─────────────────────────────
   Three channels that upgrade the packet from "described" to "reconstructable":
   a braille luminance render (8x the spatial resolution of ASCII per char), a
   connected-component shape inventory (what objects are there and where), and
   a measured reconstruction-fidelity score (does the packet genuinely carry
   the image). All pure, deterministic, canvas-free. */

// Braille dot bit for cell position [dy][dx] inside a 2x4 dot cell (U+2800 block layout:
// dots 1,2,3,7 run down the left column; 4,5,6,8 down the right).
const BRAILLE_DOT_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

// Unicode braille luminance render: each char encodes a 2x4 dot cell, so a `cols`-wide
// render carries 8x the spatial resolution of the same-width ASCII render. Dots switch on
// where the cell's mean luminance clears a 2-level ordered threshold (a 0.25 / 0.75
// checkerboard), so mid-tones dither into a texture instead of banding. Deterministic.
export function brailleRender(px, w, h, ch = 4, cols = 48) {
  if (!w || !h || !cols) return "";
  cols = Math.max(1, Math.floor(cols));
  const rows = Math.max(1, Math.round(cols * (h / w) * 0.5)); // same visual aspect as asciiRender
  const dw = cols * 2, dh = rows * 4;                          // the underlying dot grid
  const out = [];
  for (let ry = 0; ry < rows; ry++) {
    let line = "";
    for (let rx = 0; rx < cols; rx++) {
      let bits = 0;
      for (let dy = 0; dy < 4; dy++) {
        for (let dx = 0; dx < 2; dx++) {
          const gx = rx * 2 + dx, gy = ry * 4 + dy;
          const x0 = Math.floor(gx * w / dw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / dw));
          const y0 = Math.floor(gy * h / dh), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / dh));
          let sum = 0, count = 0;
          for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += lumaAt(px, ch, w, x, y); count++; }
          const t = sum / count / 255;
          // 2-level ordered pattern: alternate 0.25 / 0.75 thresholds on the dot checkerboard.
          if (t >= (((gx + gy) & 1) ? 0.75 : 0.25)) bits |= BRAILLE_DOT_BITS[dy][dx];
        }
      }
      line += String.fromCharCode(0x2800 + bits);
    }
    out.push(line);
  }
  return out.join("\n");
}

// Connected-component shape inventory: "what objects are there and where" - the channel a
// no-vision reader needs most. Works on its own coarse grid (<= 96 cells on the long side)
// quantized by luminance ladder (greys) or hue bin x 2 luma levels (colours), then 4-connected
// flood fill. Returns up to `maxShapes` components sorted by area, each:
//   { areaFrac, bbox: [x0,y0,x1,y1] as 0..1 frame fractions, cx, cy (centroid 0..1),
//     hue (named), luma (0..1), edge (fraction of cells bordering a different label) }.
export function shapeInventory(px, w, h, ch = 4, maxShapes = 8) {
  if (!w || !h) return [];
  const scale = Math.min(1, 96 / Math.max(w, h));
  const gw = Math.max(1, Math.round(w * scale));
  const gh = Math.max(1, Math.round(h * scale));
  const cells = gw * gh;
  const R = new Float64Array(cells), G = new Float64Array(cells), B = new Float64Array(cells);
  // Box-average downsample: one pass over the pixels.
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor(gy * h / gh), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / gh));
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * w / gw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / gw));
      let r = 0, g = 0, b = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        const base = y * w;
        for (let x = x0; x < x1; x++) { const i = (base + x) * ch; r += px[i]; g += px[i + 1]; b += px[i + 2]; count++; }
      }
      const idx = gy * gw + gx;
      R[idx] = r / count; G[idx] = g / count; B[idx] = b / count;
    }
  }
  // Quantized label per cell: greys ride a 4-step luma ladder (0..3); saturated colours get
  // 8 hue bins x 2 luma levels (4..19). Same-label neighbours merge into one component.
  const labels = new Int32Array(cells);
  for (let i = 0; i < cells; i++) {
    const l = (R[i] * 299 + G[i] * 587 + B[i] * 114) / 1000;
    const hsv = rgbToHsv(R[i], G[i], B[i]);
    if (hsv.s < 0.15 || hsv.v < 0.12) labels[i] = Math.min(3, (l / 64) | 0);
    // Hue bins of 45 degrees centred on 0 (Track A step T1): bins that started AT 0 split a red whose
    // hue crosses 0/360 (354 and 6 degrees) into separate components.
    else labels[i] = 4 + (Math.floor(((hsv.h + 22.5) % 360) / 45) % 8) * 2 + (l >= 128 ? 1 : 0);
  }
  // 4-connected flood fill (iterative, O(cells)).
  const comp = new Int32Array(cells).fill(-1);
  const found = [];
  const stack = [];
  for (let seed = 0; seed < cells; seed++) {
    if (comp[seed] !== -1) continue;
    const id = found.length, lab = labels[seed];
    let area = 0, sx = 0, sy = 0, sr = 0, sg = 0, sb = 0, boundary = 0;
    let bx0 = gw, by0 = gh, bx1 = -1, by1 = -1;
    comp[seed] = id; stack.push(seed);
    while (stack.length) {
      const c = stack.pop();
      const cy = (c / gw) | 0, cx = c - cy * gw;
      area++; sx += cx + 0.5; sy += cy + 0.5; sr += R[c]; sg += G[c]; sb += B[c];
      if (cx < bx0) bx0 = cx; if (cy < by0) by0 = cy;
      if (cx > bx1) bx1 = cx; if (cy > by1) by1 = cy;
      let isBoundary = false;
      if (cx > 0) { const n = c - 1; if (labels[n] === lab) { if (comp[n] === -1) { comp[n] = id; stack.push(n); } } else isBoundary = true; }
      if (cx < gw - 1) { const n = c + 1; if (labels[n] === lab) { if (comp[n] === -1) { comp[n] = id; stack.push(n); } } else isBoundary = true; }
      if (cy > 0) { const n = c - gw; if (labels[n] === lab) { if (comp[n] === -1) { comp[n] = id; stack.push(n); } } else isBoundary = true; }
      if (cy < gh - 1) { const n = c + gw; if (labels[n] === lab) { if (comp[n] === -1) { comp[n] = id; stack.push(n); } } else isBoundary = true; }
      if (isBoundary) boundary++;
    }
    found.push({ area, sx, sy, sr, sg, sb, boundary, bx0, by0, bx1, by1 });
  }
  return found
    .sort((a, b) => b.area - a.area)
    .slice(0, Math.max(0, maxShapes))
    .map((s) => {
      const mr = s.sr / s.area, mg = s.sg / s.area, mb = s.sb / s.area;
      return {
        areaFrac: +(s.area / cells).toFixed(4),
        bbox: [
          +(s.bx0 / gw).toFixed(3), +(s.by0 / gh).toFixed(3),
          +((s.bx1 + 1) / gw).toFixed(3), +((s.by1 + 1) / gh).toFixed(3),
        ],
        cx: +(s.sx / s.area / gw).toFixed(3),
        cy: +(s.sy / s.area / gh).toFixed(3),
        hue: colourName(Math.round(mr), Math.round(mg), Math.round(mb)),
        luma: +(((mr * 299 + mg * 587 + mb * 114) / 1000) / 255).toFixed(3),
        edge: +(s.boundary / s.area).toFixed(3),
      };
    });
}

// dHash-style 64-bit perceptual hash usable at small buffer sizes: box-average the luma to a
// 9x8 grid, then emit one bit per horizontal neighbour pair (left < right). Local to this
// module on purpose - the gated dHash in shared-frame/eye.js stays untouched.
export function phash64(pxBuf, w, h, ch = 4) {
  const gw = 9, gh = 8;
  const g = [];
  for (let gy = 0; gy < gh; gy++) {
    const y0 = Math.floor(gy * h / gh), y1 = Math.max(y0 + 1, Math.floor((gy + 1) * h / gh));
    const row = [];
    for (let gx = 0; gx < gw; gx++) {
      const x0 = Math.floor(gx * w / gw), x1 = Math.max(x0 + 1, Math.floor((gx + 1) * w / gw));
      let sum = 0, count = 0;
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { sum += lumaAt(pxBuf, ch, w, x, y); count++; }
      row.push(sum / count);
    }
    g.push(row);
  }
  const bits = new Uint8Array(64);
  let k = 0;
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits[k++] = g[y][x] < g[y][x + 1] ? 1 : 0;
  return bits;
}

// THE measurable claim: does the detail packet genuinely carry the image? Rebuild a synthetic
// frame from detail.colorGrid16 ALONE (nearest-neighbour upscale to a 64x64 canvas-free RGBA
// buffer), perceptual-hash both the reconstruction and the original (box-averaged to the same
// 64x64) with the same phash64 routine, and score the bit agreement.
// Returns { score: 1 - hamming/64, hamming, bits: 64 }. Score near 1 = the packet carries the
// image; a grid taken from a DIFFERENT frame scores measurably lower. If the packet has no
// colour grid the score is an honest null, never a fabricated number.
export function reconstructionFidelity(px, w, h, ch = 4, detail) {
  const grid = detail && detail.colorGrid16;
  if (!grid || !grid.length || !grid[0] || !grid[0].length) return { score: null, hamming: null, bits: 64 };
  const S = 64;
  const gh = grid.length, gw = grid[0].length;
  const recon = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    const gy = Math.min(gh - 1, (y * gh / S) | 0);
    for (let x = 0; x < S; x++) {
      const gx = Math.min(gw - 1, (x * gw / S) | 0);
      const hex = grid[gy][gx];
      const i = (y * S + x) * 4;
      recon[i] = parseInt(hex.slice(1, 3), 16);
      recon[i + 1] = parseInt(hex.slice(3, 5), 16);
      recon[i + 2] = parseInt(hex.slice(5, 7), 16);
      recon[i + 3] = 255;
    }
  }
  const { grid: og } = boxAverage(px, w, h, ch, S);
  const orig = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4, c = og[y][x];
      orig[i] = c[0]; orig[i + 1] = c[1]; orig[i + 2] = c[2]; orig[i + 3] = 255;
    }
  }
  const a = phash64(orig, S, S, 4), b = phash64(recon, S, S, 4);
  let hamming = 0;
  for (let i = 0; i < 64; i++) if (a[i] !== b[i]) hamming++;
  return { score: +(1 - hamming / 64).toFixed(4), hamming, bits: 64 };
}

// The full detail bundle - everything above off one buffer read.
export function perceptionDetail(px, w, h, ch = 4) {
  return {
    grid3: regionGrid(px, w, h, ch, 3),
    // Finer spatial channels for machine readers: a 5x5 region read and a
    // 24x24 hex map. Fidelity keeps scoring against colorGrid16 so the
    // metric stays comparable across time.
    grid5: regionGrid(px, w, h, ch, 5),
    colorGrid16: colorGridHex(px, w, h, ch, 16),
    colorGrid24: colorGridHex(px, w, h, ch, 24),
    edgeOrientations: edgeOrientations(px, w, h, ch),
    symmetry: symmetryScores(px, w, h, ch),
    ascii: asciiRender(px, w, h, ch, 64),
    shapes: shapeInventory(px, w, h, ch, 12),
    braille: brailleRender(px, w, h, ch, 48),
  };
}

// Long-form deterministic description: a paragraph a no-vision reader can
// draw from. Built ONLY from measured numbers, no invention.
const CELL_NAMES = [
  ["top-left", "top-center", "top-right"],
  ["middle-left", "center", "middle-right"],
  ["bottom-left", "bottom-center", "bottom-right"],
];
export function describeFrameLong(rich, detail) {
  const parts = [describeFrame(rich)];
  const sw = rich.dominantSwatches || [];
  if (sw.length) {
    parts.push("Palette: " + sw.slice(0, 5)
      .map((s) => colourName(s.r, s.g, s.b) + " " + s.hex + " " + (s.frac * 100).toFixed(0) + "%")
      .join(", ") + ".");
  }
  if (detail && detail.grid3) {
    const flat = [];
    detail.grid3.forEach((row, y) => row.forEach((c, x) => flat.push({ ...c, name: CELL_NAMES[y][x] })));
    const brightest = flat.reduce((a, b) => (b.luma > a.luma ? b : a));
    const darkest = flat.reduce((a, b) => (b.luma < a.luma ? b : a));
    const busiest = flat.reduce((a, b) => (b.edge > a.edge ? b : a));
    parts.push("Light mass sits " + brightest.name + " (" + brightest.hue + ", luma " + brightest.luma
      + "); the darkest cell is " + darkest.name + " (luma " + darkest.luma
      + "); detail concentrates " + busiest.name + " (edge " + busiest.edge + ").");
    parts.push("Cells by row, hue/luma: "
      + detail.grid3.map((row) => row.map((c) => c.hue + " " + c.luma).join(" | ")).join(" // ") + ".");
  }
  if (detail && Array.isArray(detail.shapes) && detail.shapes.length) {
    const ordinal = ["largest", "second", "third"];
    const clauses = detail.shapes.slice(0, 3).map((s, i) => {
      const xi = Math.min(2, Math.floor(s.cx * 3)), yi = Math.min(2, Math.floor(s.cy * 3));
      return "the " + ordinal[i] + " form sits " + CELL_NAMES[yi][xi] + ", " + s.hue
        + ", covering " + (s.areaFrac * 100).toFixed(0) + "% of the frame";
    });
    parts.push("Shapes: " + clauses.join("; ") + ".");
  }
  if (detail && detail.edgeOrientations && detail.edgeOrientations.dominant !== "none") {
    const e = detail.edgeOrientations;
    parts.push("Edges lean " + e.dominant + " (coherence " + e.coherence + "; h " + e.horizontal
      + ", v " + e.vertical + ", diagonals rising " + e.risingDiagonal + " / falling " + e.fallingDiagonal + ").");
  }
  if (detail && detail.symmetry) {
    const s = detail.symmetry;
    if (s.horizontal == null && s.vertical == null) {
      parts.push("Composition is flat (no luma variation to mirror).");
    } else {
      const mh = s.horizontal != null && s.horizontal >= MIRROR_THRESHOLD;
      const mv = s.vertical != null && s.vertical >= MIRROR_THRESHOLD;
      const lowH = s.horizontal == null || s.horizontal < 0.5;
      const lowV = s.vertical == null || s.vertical < 0.5;
      const sym = mh && mv ? "mirrored both ways" : mh ? "mirrored left-right" : mv ? "mirrored top-bottom"
        : lowH && lowV ? "asymmetric" : "loosely balanced";
      parts.push("Composition reads " + sym + " (mirror correlation h " + s.horizontal + ", v " + s.vertical + ").");
    }
  }
  // Fidelity clause ONLY when the caller passes a measured detail.fidelity (this function
  // never computes it - the caller runs reconstructionFidelity and hands the result in).
  if (detail && detail.fidelity && typeof detail.fidelity.score === "number") {
    const f = detail.fidelity;
    parts.push("A frame rebuilt from this packet's colour grid alone matches the original at "
      + f.score.toFixed(2) + " (" + (f.bits - f.hamming) + " of " + f.bits + " hash bits).");
  }
  return parts.join(" ");
}
