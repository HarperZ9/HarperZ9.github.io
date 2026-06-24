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
const HUE_NAMES = [
  [15, "red"], [45, "orange"], [70, "amber"], [90, "yellow"], [160, "green"],
  [200, "teal"], [255, "blue"], [290, "indigo"], [330, "magenta"], [360, "red"],
];
// Name a hue (degrees 0..360) + saturation/value, so greys read honestly as "grey", not a stray hue.
export function hueName(hDeg, sat, val) {
  if (val < 0.12) return "near-black";
  if (sat < 0.12) return val > 0.8 ? "near-white" : "grey";
  for (const [edge, name] of HUE_NAMES) if (hDeg < edge) return name;
  return "red";
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
  const regions = regionSplit(px, w, h, ch);
  const aspect = h ? w / h : 1;
  return {
    dominantColors: dom.map(d => d.hex),
    dominantSwatches: dom,                       // full {hex,r,g,b,frac} for the swatch meters
    hueName: hueName(hsv.h, hsv.s, hsv.v),
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

// ── (4) The COMPLETE high-D readout the connected model operates from ──────────
// `multiScaleGrids` is the spatial truth at three resolutions (8×8, 16×16, 32×32) — the "more than a
// single 32×32 / 1D→10D" structure the brief asks for: each grid is the real pixels box-averaged to
// that resolution, so the model receives a genuine coarse→fine pyramid of WHERE the colour is, not a
// scalar summary. Pure: takes RGBA bytes (+ w,h,ch) and returns nested [[ [r,g,b], … ]] arrays.
export function multiScaleGrids(px, w, h, ch = 4, scales = [8, 16, 32]) {
  const out = {};
  for (const n of scales) out["grid" + n] = boxAverage(px, w, h, ch, n).grid;
  return out;
}

// assembleFullPerception — the single COMPLETE sensory-state object the model is given EVERY turn.
// Pure + browser-free so node can recompute it from a synthetic {data,width,height} (the same contract
// the rest of this module holds). It derives the measured channels from the pixels itself (rich
// features + eye-style scalars are passed in by the browser where they already exist; here we accept
// a `pre` bundle for the gated advisory scalars so we never re-implement eye.js's gated maths).
//   px,w,h,ch : the real frame pixels (RGBA) — the lossless source of every grid + colour + edge number.
//   pre       : { contrast, structure, balance, coverage, phash, motion, audio, source } — the
//               already-measured advisory scalars (gated eye.js features + live meters). Optional;
//               missing fields read as null so the readout is honest about what isn't available.
export function assembleFullPerception(px, w, h, ch = 4, pre = {}) {
  const rich = richFeatures(px, w, h, ch);
  const regions = { light: rich.lightRegions, dark: rich.darkRegions, meanLuma: rich.meanLuma };
  const num = v => (typeof v === "number" && isFinite(v)) ? v : null;
  return {
    dimensions: { w, h, orientation: rich.orientation, aspect: rich.aspect },
    phash: pre.phash != null ? String(pre.phash) : null,
    contrast: num(pre.contrast),
    structure: num(pre.structure),     // entropy (gated eye.js advisory)
    balance: num(pre.balance),
    coverage: num(pre.coverage),
    edgeDensity: num(rich.edgeDensity),
    light: num(regions.light),
    dark: num(regions.dark),
    meanLuma: num(regions.meanLuma),
    dominantColours: (rich.dominantSwatches || []).map(s => ({ hex: s.hex, fraction: s.frac })),
    hueName: rich.hueName || "unknown",
    motion: num(pre.motion),
    audio: pre.audio || null,
    source: pre.source || "unknown",
    multiScale: multiScaleGrids(px, w, h, ch, [8, 16, 32]),
  };
}
