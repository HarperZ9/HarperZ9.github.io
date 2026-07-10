// typeface.js: a seed authors a display typeface, previewed live in the browser.
//
// This is the in-browser companion to tools/fonts/build_seeded_typeface.py. Both
// derive the same axis set from a seed using the SAME FNV-1a + splitmix mix that
// neural.js uses, so what you preview here is what the Python builder bakes into
// a real .ttf/.woff2 file. The preview renders the visible axes faithfully -
// slant, width (narrowing), and weight - by transforming the loaded display face
// on a canvas. The finer axes (facet chord, corner bevel, per-point breathing)
// are outline-level surgery that only the exported font realizes; they are shown
// as a readout, not faked into the preview.

import { neuralSeed } from "./neural.js";

// weightAt()'s splitmix draw from neural.js, returning the pre-scale magnitude in
// [0, 1): identical to weightAt(seed, index, 1) * 0.5 + 0.5, and to _draw01() in
// the Python builder. Same seed + index -> same axis in preview and in the file.
function draw01(seed, index) {
  let x = (seed ^ Math.imul((index + 0x9e3779b9) >>> 0, 0x85ebca6b)) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 0x2c1b3c6d) >>> 0;
  x ^= x >>> 12;
  x = Math.imul(x, 0x297a2d39) >>> 0;
  x ^= x >>> 15;
  return (x >>> 0) / 4294967295;
}

const lerp = (a, b, u) => a + (b - a) * u;
const round = (v, n) => {
  const k = 10 ** n;
  return Math.round(v * k) / k;
};

// Axis indices. These match _AX in build_seeded_typeface.py exactly.
const AX = {
  slant: 50101,
  narrowing: 50102,
  breathingAmp: 50103,
  breathingPhase: 50104,
  breathingY: 50105,
  facetMinChord: 50106,
  facetStep: 50107,
  facetMaxCuts: 50108,
  bevelCut: 50109,
  bevelMinEdge: 50110,
  weightClass: 50111,
};

/* Derive the full axis set for a seed. Accepts a string (hashed via FNV-1a, as
   the Python builder does) or a number (an already-hashed route seed, as the
   specimen pipeline passes). Ranges are bounded to stay legible. */
export function seedTypeface(seed) {
  const h = typeof seed === "number" ? seed >>> 0 : neuralSeed(seed);
  const u = (name) => draw01(h, AX[name]);
  const narrowing = round(lerp(0.9, 1.03, u("narrowing")), 4);
  const widthClass = Math.max(3, Math.min(6, Math.round(lerp(3, 6, (narrowing - 0.9) / 0.13))));
  return {
    tag: (h >>> 0).toString(16).padStart(8, "0"),
    slant: round(lerp(-0.02, 0.09, u("slant")), 4),
    narrowing,
    breathingAmp: round(lerp(1.5, 8.5, u("breathingAmp")), 3),
    breathingPhase: round(lerp(0.9, 2.7, u("breathingPhase")), 4),
    breathingY: round(lerp(0.005, 0.015, u("breathingY")), 5),
    facetMinChord: Math.round(lerp(150, 290, u("facetMinChord"))),
    facetStep: Math.round(lerp(120, 210, u("facetStep"))),
    facetMaxCuts: 3 + Math.round(u("facetMaxCuts") * 3),
    bevelCut: Math.round(lerp(14, 58, u("bevelCut"))),
    bevelMinEdge: Math.round(lerp(95, 140, u("bevelMinEdge"))),
    weightClass: 520 + Math.round(u("weightClass") * 340),
    widthClass,
  };
}

// Snap a usWeightClass to the nearest 100 the CSS font stack can request.
function cssWeight(weightClass) {
  return Math.max(300, Math.min(900, Math.round(weightClass / 100) * 100));
}

const DISPLAY_STACK = "'Telos Display', 'Kilon', Georgia, serif";

/* Render a seeded type specimen onto a 2D context. Draws a word with the seed's
   slant, width, and weight applied to the loaded display face, plus a small axis
   readout. width/height are the canvas backing size in device pixels. */
export function drawTypefaceSpecimen(ctx, width, height, seed, opts = {}) {
  const ax = seedTypeface(seed);
  const word = opts.word || "Telos";
  const ink = opts.ink || "#f3eefc";
  const bg = opts.bg || "#0b0912";
  const weight = cssWeight(ax.weightClass);

  ctx.save();
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, width, height);

  // Size the word to the frame, accounting for the horizontal narrowing so a
  // condensed seed still fills the plate rather than leaving a wide margin.
  let size = opts.size || Math.round(height * 0.4);
  const fit = (s) => {
    ctx.font = `${weight} ${s}px ${DISPLAY_STACK}`;
    let sum = 0;
    for (const ch of word) sum += ctx.measureText(ch).width * ax.narrowing;
    return sum + size * 0.02 * (word.length - 1);
  };
  const maxW = width * 0.84;
  let total = fit(size);
  if (total > maxW) {
    size = Math.max(8, Math.round(size * (maxW / total)));
    total = fit(size);
  }
  ctx.font = `${weight} ${size}px ${DISPLAY_STACK}`;

  const gap = size * 0.02;
  const baseY = Math.round(height * 0.6);
  // Breathing is sub-percent of the em (font-unit micro-texture); scale it to the
  // rendered em so the preview stays faithful rather than exaggerated.
  const breatheScale = size / 2048;
  let penX = (width - total) / 2;
  ctx.fillStyle = ink;
  ctx.textBaseline = "alphabetic";
  let i = 0;
  for (const ch of word) {
    const glyphW = ctx.measureText(ch).width * ax.narrowing;
    const breathe = Math.sin(i * ax.breathingPhase + baseY * ax.breathingY) * ax.breathingAmp * breatheScale;
    ctx.save();
    ctx.translate(penX, baseY + breathe);
    // scaleX = narrowing (column c=0), shear x by -slant*y so positive slant
    // leans the ascenders forward (canvas y is negative above the baseline).
    ctx.transform(ax.narrowing, 0, -ax.slant, 1, 0, 0);
    ctx.fillText(ch, 0, 0);
    ctx.restore();
    penX += glyphW + gap;
    i += 1;
  }

  // Compact axis readout, so the plate communicates the seeded metric identity.
  const meta = `wght ${ax.weightClass} - wdth ${ax.widthClass} - slnt ${ax.slant} - seed ${ax.tag}`;
  ctx.font = `500 ${Math.max(9, Math.round(height * 0.05))}px 'Hanken Grotesk', system-ui, sans-serif`;
  ctx.fillStyle = "rgba(243,238,252,0.62)";
  ctx.textAlign = "center";
  ctx.fillText(meta, width / 2, Math.round(height * 0.86));
  ctx.restore();
  return ax;
}

/* Specimen-layer adapter: matches the (ctx, width, height, tick, seed, palette)
   contract in generative-field.js so a seed's typeface flows through the gallery
   plates, the print desk, and poster exports like any other instrument. */
export function drawTypeface(ctx, width, height, tick, seed, palette) {
  const ink = (palette && palette.ink) || "#f3eefc";
  drawTypefaceSpecimen(ctx, width, height, seed, { word: "Telos", ink });
}
