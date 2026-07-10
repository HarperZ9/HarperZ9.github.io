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
      const hsv = rgbToHsv(mr, mg, mb);
      row.push({
        luma: +(sum / count / 255).toFixed(3),
        edge: +(edge / count).toFixed(3),
        hue: hueName(hsv.h, hsv.s, hsv.v),
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
export function edgeOrientations(px, w, h, ch = 4, threshold = 40) {
  const bins = [0, 0, 0, 0]; // 0=horizontal edge, 1=rising diagonal, 2=vertical, 3=falling diagonal
  let strong = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const sx = -lumaAt(px, ch, w, x - 1, y - 1) - 2 * lumaAt(px, ch, w, x - 1, y) - lumaAt(px, ch, w, x - 1, y + 1)
        + lumaAt(px, ch, w, x + 1, y - 1) + 2 * lumaAt(px, ch, w, x + 1, y) + lumaAt(px, ch, w, x + 1, y + 1);
      const sy = -lumaAt(px, ch, w, x - 1, y - 1) - 2 * lumaAt(px, ch, w, x, y - 1) - lumaAt(px, ch, w, x + 1, y - 1)
        + lumaAt(px, ch, w, x - 1, y + 1) + 2 * lumaAt(px, ch, w, x, y + 1) + lumaAt(px, ch, w, x + 1, y + 1);
      const mag = Math.hypot(sx, sy);
      if (mag < threshold) continue;
      strong++;
      // Gradient angle -> edge angle (perpendicular). Fold into 4 bins over 180 degrees.
      const a = (Math.atan2(sy, sx) * 180 / Math.PI + 90 + 360) % 180;
      bins[Math.round(a / 45) % 4]++;
    }
  }
  const total = strong || 1;
  const names = ["horizontal", "rising diagonal", "vertical", "falling diagonal"];
  const norm = bins.map((v) => +(v / total).toFixed(3));
  const domIdx = norm.indexOf(Math.max(...norm));
  return { horizontal: norm[0], risingDiagonal: norm[1], vertical: norm[2], fallingDiagonal: norm[3],
    dominant: strong ? names[domIdx] : "none", strongEdgeCount: strong };
}

// Mirror-symmetry scores (0..1): 1 = perfectly mirrored luminance.
export function symmetryScores(px, w, h, ch = 4) {
  let hDiff = 0, vDiff = 0, count = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < Math.floor(w / 2); x++) {
      hDiff += Math.abs(lumaAt(px, ch, w, x, y) - lumaAt(px, ch, w, w - 1 - x, y));
      count++;
    }
  }
  let vDiffTotal = 0, vCount = 0;
  for (let y = 0; y < Math.floor(h / 2); y++) {
    for (let x = 0; x < w; x++) {
      vDiffTotal += Math.abs(lumaAt(px, ch, w, x, y) - lumaAt(px, ch, w, x, h - 1 - y));
      vCount++;
    }
  }
  return {
    horizontal: +(1 - hDiff / (count * 255 || 1)).toFixed(3),
    vertical: +(1 - vDiffTotal / (vCount * 255 || 1)).toFixed(3),
  };
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

// The full detail bundle - everything above off one buffer read.
export function perceptionDetail(px, w, h, ch = 4) {
  return {
    grid3: regionGrid(px, w, h, ch, 3),
    colorGrid16: colorGridHex(px, w, h, ch, 16),
    edgeOrientations: edgeOrientations(px, w, h, ch),
    symmetry: symmetryScores(px, w, h, ch),
    ascii: asciiRender(px, w, h, ch, 64),
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
      .map((s) => {
        const hsv = rgbToHsv(s.r, s.g, s.b);
        return hueName(hsv.h, hsv.s, hsv.v) + " " + s.hex + " " + (s.frac * 100).toFixed(0) + "%";
      }).join(", ") + ".");
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
  if (detail && detail.edgeOrientations && detail.edgeOrientations.dominant !== "none") {
    const e = detail.edgeOrientations;
    parts.push("Edges lean " + e.dominant + " (h " + e.horizontal + ", v " + e.vertical
      + ", diagonals " + e.risingDiagonal + "/" + e.fallingDiagonal + ").");
  }
  if (detail && detail.symmetry) {
    const s = detail.symmetry;
    const sym = s.horizontal > 0.9 && s.vertical > 0.9 ? "strongly symmetric both ways"
      : s.horizontal > 0.9 ? "mirrored left-right" : s.vertical > 0.9 ? "mirrored top-bottom"
      : s.horizontal < 0.6 && s.vertical < 0.6 ? "asymmetric" : "loosely balanced";
    parts.push("Composition reads " + sym + " (mirror scores h " + s.horizontal + ", v " + s.vertical + ").");
  }
  return parts.join(" ");
}
