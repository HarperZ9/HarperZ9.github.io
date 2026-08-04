// plot-maps.js: generative, algorithmic plot maps — pen-plotter cartography from a seed.
//
// Where plotter.js plots WHATEVER the canvas shows (image-driven: luma in, polylines out), this
// module is the generative half: a seeded elevation field in, a composed map sheet out. It
// deliberately drives the SAME downstream pipeline (contourFromLuma's marching squares,
// hatchFromLuma, flowlinesFromLuma, orderPaths, toPlotterSVG) so every capability the plotter
// path already earned — chained contours, pen ordering, plotter-grade SVG — works on generated
// cartography unchanged.
//
// Method sources (studio-v3 research digest, lane 2): flow fields per Tyler Hobbs' grid-of-angles;
// contouring by marching squares; hidden-line ridgelines by horizon tracking; hatch fills for
// tonal water; the vpype conventions (single-stroke paths, ordered, real units) for export.
// Everything is deterministic from the seed string: same seed, same map, re-checkable.

import { contourFromLuma, hatchFromLuma, flowlinesFromLuma, orderPaths, toPlotterSVG } from "./plotter.js";

// ── Seeded field ─────────────────────────────────────────────────────────────
// FNV-1a string hash → mulberry32 PRNG, the same recipe the rest of the site uses.
function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Value noise on a seeded lattice, smoothstep-interpolated, then fBm. Pure and allocation-light:
// the lattice is a function of cell coords + seed, no stored grid.
function latticeValue(seed, xi, yi) {
  let h = seed ^ Math.imul(xi, 0x9E3779B1) ^ Math.imul(yi, 0x85EBCA77);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE3D);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function smooth(t) { return t * t * (3 - 2 * t); }
function valueNoise(seed, x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const fx = smooth(x - xi), fy = smooth(y - yi);
  const a = latticeValue(seed, xi, yi), b = latticeValue(seed, xi + 1, yi);
  const c = latticeValue(seed, xi, yi + 1), d = latticeValue(seed, xi + 1, yi + 1);
  return (a + (b - a) * fx) + ((c + (d - c) * fx) - (a + (b - a) * fx)) * fy;
}

/**
 * elevationField(seedStr, w, h, opts) → { field: Float32Array in [0,1], seaLevel }
 * fBm over seeded value noise; `ridged` folds each octave into sharp crests (mountain grammar).
 * seaLevel is chosen from the field's own distribution so roughly opts.waterFrac of the sheet is
 * water — a map with no coast and a map that is all ocean are both dead sheets.
 */
export function elevationField(seedStr, w, h, opts = {}) {
  const { octaves = 5, baseFreq = 3, ridged = false, waterFrac = 0.3 } = opts;
  const seed = hash32(String(seedStr));
  const field = new Float32Array(w * h);
  let mn = Infinity, mx = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const u = x / w, v = y / h;
      let amp = 1, freq = baseFreq, sum = 0, norm = 0;
      for (let o = 0; o < octaves; o++) {
        let n = valueNoise(seed + o * 101, u * freq, v * freq);
        if (ridged) n = 1 - Math.abs(2 * n - 1);
        sum += n * amp; norm += amp;
        amp *= 0.5; freq *= 2;
      }
      const e = sum / norm;
      field[y * w + x] = e;
      if (e < mn) mn = e;
      if (e > mx) mx = e;
    }
  }
  const span = mx - mn || 1;
  for (let i = 0; i < field.length; i++) field[i] = (field[i] - mn) / span;
  // Sea level from the empirical distribution: the waterFrac-quantile of a coarse sample.
  const sample = [];
  for (let i = 0; i < field.length; i += 17) sample.push(field[i]);
  sample.sort((a, b) => a - b);
  const seaLevel = sample[Math.min(sample.length - 1, Math.floor(sample.length * waterFrac))];
  return { field, seaLevel };
}

// Field → RGBA luma bytes, the lingua franca of the plotter.js primitives. `map` remaps each
// value first (used to isolate water, invert for hatching density, etc.).
export function fieldToLuma(field, w, h, map) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < field.length; i++) {
    const v = Math.max(0, Math.min(1, map ? map(field[i]) : field[i]));
    const b = Math.round(v * 255);
    px[i * 4] = b; px[i * 4 + 1] = b; px[i * 4 + 2] = b; px[i * 4 + 3] = 255;
  }
  return px;
}

// ── Hidden-line ridgelines (horizon tracking) ────────────────────────────────
// The digest's cheapest occlusion win: walk elevation rows front to back, project each row up by
// its elevation, keep a running horizon per column, and emit only the segments that rise above
// it. Output: one polyline per visible ridge segment, front rows occluding back rows.
export function ridgelines(field, w, h, opts = {}) {
  const { rows = 60, lift = 0.32, sampleStep = 2 } = opts;
  const horizon = new Float32Array(Math.ceil(w / sampleStep)).fill(Infinity);
  const lines = [];
  for (let r = 0; r < rows; r++) {
    // Front row first: the BOTTOM of the sheet is nearest the viewer.
    const y = h - 1 - Math.floor((r / Math.max(1, rows - 1)) * (h - 1));
    const screenBase = (y / h);
    let current = null;
    for (let sx = 0; sx < horizon.length; sx++) {
      const x = Math.min(w - 1, sx * sampleStep);
      const e = field[y * w + x];
      const sy = screenBase - e * lift;   // screen y in [.. , 1], smaller = higher
      if (sy < horizon[sx] - 1e-4) {
        horizon[sx] = sy;
        const px = x / w, py = Math.max(0, sy);
        if (current) current.push([px, py]);
        else current = [[px, py]];
      } else if (current) {
        if (current.length > 1) lines.push(current);
        current = null;
      }
    }
    if (current && current.length > 1) lines.push(current);
  }
  return lines;
}

// ── The map sheet ────────────────────────────────────────────────────────────
// STUDIES are the composition grammars: which layers a sheet carries and how they read.
export const PLOT_STUDIES = Object.freeze({
  topo:  { label: "Topographic",  layers: ["water", "contours", "coast", "frame"] },
  flow:  { label: "Flow field",   layers: ["flow", "contours-light", "frame"] },
  ridge: { label: "Ridgelines",   layers: ["ridge", "frame"] },
  chart: { label: "Chart",        layers: ["water", "coast", "graticule", "soundings", "frame"] },
});

const FRAME_MARGIN = 0.04;

function frameLayer() {
  const m = FRAME_MARGIN;
  return [[[m, m], [1 - m, m], [1 - m, 1 - m], [m, 1 - m], [m, m]]];
}

function graticuleLayer(rng) {
  const m = FRAME_MARGIN, lines = [];
  const nx = 6 + Math.floor(rng() * 3), ny = 4 + Math.floor(rng() * 3);
  for (let i = 1; i < nx; i++) {
    const x = m + (i / nx) * (1 - 2 * m);
    for (let t = 0; t < 1; t += 0.05) lines.push([[x, m + t * (1 - 2 * m)], [x, Math.min(1 - m, m + (t + 0.018) * (1 - 2 * m))]]);
  }
  for (let i = 1; i < ny; i++) {
    const y = m + (i / ny) * (1 - 2 * m);
    for (let t = 0; t < 1; t += 0.05) lines.push([[m + t * (1 - 2 * m), y], [Math.min(1 - m, m + (t + 0.018) * (1 - 2 * m)), y]]);
  }
  return lines;
}

// Depth soundings: sparse seeded point marks over water (little v ticks, a nautical-chart read).
function soundingsLayer(field, w, h, seaLevel, rng) {
  const lines = [];
  for (let i = 0; i < 240; i++) {
    const x = rng(), y = rng();
    const e = field[Math.floor(y * (h - 1)) * w + Math.floor(x * (w - 1))];
    if (e >= seaLevel) continue;
    const s = 0.004 + (seaLevel - e) * 0.012;
    lines.push([[x - s, y - s], [x, y]], [[x, y], [x + s, y - s]]);
  }
  return lines;
}

// Clip normalized polylines to the frame's inner box (drop out-of-frame points, split runs).
function clipToFrame(polylines) {
  const m = FRAME_MARGIN, out = [];
  for (const line of polylines) {
    let run = null;
    for (const [x, y] of line) {
      if (x >= m && x <= 1 - m && y >= m && y <= 1 - m) {
        if (run) run.push([x, y]);
        else run = [[x, y]];
      } else if (run) { if (run.length > 1) out.push(run); run = null; }
    }
    if (run && run.length > 1) out.push(run);
  }
  return out;
}

/**
 * buildPlotMap(seedStr, opts) → { layers: [{name, polylines, weight, tone}], meta }
 * The whole sheet, deterministic from the seed. opts: { study, res, levels, density }.
 * Coordinates are normalized [0,1]²; renderPlotMap/plotMapSVG scale them out.
 */
export function buildPlotMap(seedStr, opts = {}) {
  const study = PLOT_STUDIES[opts.study] ? opts.study : "topo";
  const res = Math.max(64, Math.min(420, opts.res || 220));
  const levels = Math.max(4, Math.min(28, opts.levels || 14));
  const density = Math.max(0.2, Math.min(2.5, opts.density || 1));
  const rng = mulberry(hash32(String(seedStr) + ":" + study));
  const w = res, h = Math.round(res * 0.75);
  const { field, seaLevel } = elevationField(seedStr, w, h, {
    ridged: study === "ridge" || rng() < 0.35,
    waterFrac: study === "chart" ? 0.45 : 0.3,
  });
  const norm = (line) => line.map(([x, y]) => [x / w, y / h]);
  const layers = [];
  const wants = PLOT_STUDIES[study].layers;

  if (wants.includes("water")) {
    // Hatch only below sea level: land maps to white (above every hatch band), water darkens
    // with depth so hatchFromLuma's banded thresholds (0.72 single, 0.45 cross, 0.2 dense) give
    // shallow water one direction and deep water a weave. Its angle option is in DEGREES.
    const waterLuma = fieldToLuma(field, w, h, (v) => (v >= seaLevel ? 1 : 0.15 + 0.55 * (v / Math.max(1e-6, seaLevel))));
    const hatch = hatchFromLuma(waterLuma, w, h, 4, { spacing: Math.max(3, Math.round(6 / density)), angle: 45 });
    layers.push({ name: "water", polylines: clipToFrame(hatch.map(norm)), weight: 0.6, tone: "support" });
  }
  const contourKinds = wants.includes("contours") ? "contours" : (wants.includes("contours-light") ? "contours-light" : null);
  if (contourKinds) {
    const luma = fieldToLuma(field, w, h);
    const minor = [], major = [];
    const lo = seaLevel + 0.02;
    for (let i = 0; i < levels; i++) {
      const t = lo + ((i + 0.5) / levels) * (0.985 - lo);
      const paths = contourFromLuma(luma, w, h, 4, { threshold: t * 255 });
      (i % 5 === 4 ? major : minor).push(...paths.map(norm));
    }
    const light = contourKinds === "contours-light";
    layers.push({ name: "contours", polylines: clipToFrame(minor), weight: light ? 0.45 : 0.7, tone: "ink" });
    if (major.length) layers.push({ name: "index-contours", polylines: clipToFrame(major), weight: light ? 0.8 : 1.4, tone: "ink" });
  }
  if (wants.includes("coast")) {
    const luma = fieldToLuma(field, w, h);
    const coast = contourFromLuma(luma, w, h, 4, { threshold: seaLevel * 255 });
    layers.push({ name: "coast", polylines: clipToFrame(coast.map(norm)), weight: 1.8, tone: "ink" });
  }
  if (wants.includes("flow")) {
    const luma = fieldToLuma(field, w, h);
    const lines = flowlinesFromLuma(luma, w, h, 4, { lines: Math.round(240 * density), maxSteps: 160 });
    layers.push({ name: "flow", polylines: clipToFrame(lines.map(norm)), weight: 0.7, tone: "ink" });
  }
  if (wants.includes("ridge")) {
    layers.push({ name: "ridge", polylines: clipToFrame(ridgelines(field, w, h, { rows: Math.round(46 * density) + 14 })), weight: 0.9, tone: "ink" });
  }
  if (wants.includes("graticule")) layers.push({ name: "graticule", polylines: graticuleLayer(rng), weight: 0.4, tone: "support" });
  if (wants.includes("soundings")) layers.push({ name: "soundings", polylines: clipToFrame(soundingsLayer(field, w, h, seaLevel, rng)), weight: 0.6, tone: "support" });
  if (wants.includes("frame")) layers.push({ name: "frame", polylines: frameLayer(), weight: 1.6, tone: "ink" });

  let strokes = 0, points = 0;
  for (const l of layers) { strokes += l.polylines.length; points += l.polylines.reduce((a, p) => a + p.length, 0); }
  return {
    layers,
    meta: { seed: String(seedStr), study, res: [w, h], levels, density, seaLevel: +seaLevel.toFixed(4), strokes, points },
  };
}

// ── Render to a 2D canvas: ink on the site's calm ground ─────────────────────
export function renderPlotMap(ctx, plot, W, H, palette = {}) {
  const ink = palette.ink || "#e8e6e1";
  const support = palette.support || "rgba(232,230,225,0.45)";
  const ground = palette.ground || "#0d1b1c";
  ctx.fillStyle = ground;
  ctx.fillRect(0, 0, W, H);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const layer of plot.layers) {
    ctx.strokeStyle = layer.tone === "support" ? support : ink;
    ctx.lineWidth = Math.max(0.5, layer.weight * (W / 900));
    ctx.beginPath();
    for (const line of layer.polylines) {
      for (let i = 0; i < line.length; i++) {
        const [x, y] = line[i];
        if (i === 0) ctx.moveTo(x * W, y * H);
        else ctx.lineTo(x * W, y * H);
      }
    }
    ctx.stroke();
  }
}

// ── Plotter-grade SVG: one <g> per layer, ordered paths, real units ──────────
export function plotMapSVG(plot, opts = {}) {
  const Wmm = opts.widthMm || 210, Hmm = Math.round(Wmm * 0.75);
  const scale = (line) => line.map(([x, y]) => [x * Wmm, y * Hmm]);
  const groups = plot.layers.map((layer) => {
    const ordered = orderPaths(layer.polylines.map(scale));
    const d = ordered.map((line) =>
      "M" + line.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" L")).join(" ");
    return `  <g id="${layer.name}" fill="none" stroke="black" stroke-width="${(layer.weight * 0.35).toFixed(2)}" data-strokes="${ordered.length}">\n    <path d="${d}"/>\n  </g>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Wmm} ${Hmm}" width="${Wmm}mm" height="${Hmm}mm">\n` +
    `  <!-- seed ${plot.meta.seed} · study ${plot.meta.study} · ${plot.meta.strokes} strokes · deterministic -->\n` +
    groups.join("\n") + "\n</svg>\n";
}

export { toPlotterSVG };   // re-export so callers can reach the shared exporter through one door
