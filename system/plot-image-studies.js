// plot-image-studies.js: eight ways to draw a photograph with one pen, and a judge that measures
// whether the drawing actually carries the picture's tone.
//
// The operator's ask was to cross the boundary between mediums: any picture — a plate from the
// Current Story sequence, a file off the desk, or the live output of another Studio source —
// becomes a plotter drawing, rendered on screen and exported as a sheet a machine can run.
//
// Each method is a real technique from the plotter and non-photorealistic-rendering literature,
// not a filter:
//
//   flowline  evenly-spaced streamlines along the edge-tangent flow. Tone from SEPARATION.
//   engrave   the same, three times, at burin angles gated by tone band. Crosshatch that follows
//             the form instead of lying across it.
//   stipple   weighted dots, relaxed. Tone from COUNT.
//   tsp       one unbroken path through those dots. Zero pen lifts, the whole picture in a stroke.
//   squiggle  scanlines whose frequency and amplitude ride the tone (the SquiggleDraw idiom).
//   spiral    one Archimedean spiral, radius modulated by ink. Also a single stroke.
//   contour   iso-luminance bands: the picture read as terrain.
//   xdog      the line drawing alone — extended difference-of-Gaussians, walked along the flow.
//
// And the judge. plot-compose measures a GENERATED sheet for interestingness, because nothing
// outside it says what that sheet should look like. An image plot is the opposite case: the source
// says exactly what it should look like, so the honest measure is FIDELITY. measureTone correlates
// per-cell stroke length against per-cell source ink and reports Pearson r. That number is a
// receipt — it says how much of the picture actually survived the translation to line, and it is
// what "auto" uses to choose between methods rather than my taste.

import {
  fitField, levels, edgeTangentFlow, xdogField, evenStreamlines, traceFlowLines,
  stipplePoints, tspPath, blurField, fieldToRGBA, sampleField, sheetPlacement,
} from "./plot-image.js";
import { contourFromLuma } from "./plotter.js";
import { clipLines, jitter } from "./plot-marks.js";
import { applyRegister, measureSheet, REGISTERS } from "./plot-compose.js";

export { toneField, fitField } from "./plot-image.js";   // one door for callers that only capture

function hash32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
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

// ── preparing the picture ───────────────────────────────────────────────────
// Three decisions happen here and nowhere else: working resolution (a pen resolves far less than
// a sensor), tonal range (auto levels, because a flat phone photo plots as a grey smear), and the
// flow field every stroke method shares.
export function prepareImage(field, opts = {}) {
  const detail = Math.max(120, Math.min(720, Math.round(opts.detail || 380)));
  const fitted = fitField(field, detail);
  const work = levels(fitted, {
    clip: 0.01,
    gamma: opts.gamma == null ? 1 : opts.gamma,
    black: opts.black, white: opts.white, invert: !!opts.invert,
  });
  const long = Math.max(work.w, work.h);
  const etf = edgeTangentFlow(work, { sigma: Math.max(2, Math.round(long / 105)) });
  const edge = xdogField(work, { sigma: Math.max(1, Math.round(long / 300)) });
  const { aspect, rect, place } = sheetPlacement(work.w, work.h, opts.margin == null ? 0.045 : opts.margin);
  return { field: work, etf, edge, aspect, rect, place };
}

const mapped = (ctx) => (lines) => clipLines(
  lines.map((l) => l.map(([x, y]) => ctx.place(x, y))),
  ctx.rect.x, ctx.rect.y, ctx.rect.x + ctx.rect.w, ctx.rect.y + ctx.rect.h,
);

// ── the eight ───────────────────────────────────────────────────────────────
export const IMAGE_METHODS = Object.freeze({
  flowline: {
    label: "Flowline",
    hint: "evenly-spaced streamlines along the form; tone from separation",
    build(ctx, rng, o) {
      const d = o.density;
      const N = mapped(ctx);
      const lines = evenStreamlines(ctx.field, ctx.etf, {
        sepMin: Math.max(1.15, 1.9 / d), sepMax: Math.max(3, 11 / d),
        maxSteps: 360, maxLines: 6000, inkMin: 0.06,
      });
      return { layers: [{ name: "flow", polylines: N(lines), weight: 0.9, tone: "ink" }] };
    },
  },

  engrave: {
    label: "Engrave",
    hint: "three burin passes, each gated by tone band, all following the form",
    build(ctx, rng, o) {
      const d = o.density;
      const N = mapped(ctx);
      // Angle offsets are relative to the flow, so the crosshatch rotates with the form the way a
      // burin does, instead of sitting on the sheet at fixed degrees like a halftone screen.
      const bands = [
        { off: 0, inkMin: 0.10, sepMin: 2.0, sepMax: 11, weight: 0.7, name: "first-pass" },
        { off: Math.PI / 3, inkMin: 0.44, sepMin: 2.3, sepMax: 7.5, weight: 0.9, name: "second-pass" },
        { off: -Math.PI / 3, inkMin: 0.70, sepMin: 2.6, sepMax: 5, weight: 1.1, name: "third-pass" },
      ];
      const layers = [];
      for (const b of bands) {
        const lines = evenStreamlines(ctx.field, ctx.etf, {
          offset: b.off, inkMin: b.inkMin,
          sepMin: Math.max(1.2, b.sepMin / d), sepMax: Math.max(3, b.sepMax / d),
          maxSteps: 200, maxLines: 3200,
        });
        if (lines.length) layers.push({ name: b.name, polylines: N(lines), weight: b.weight, tone: "ink" });
      }
      return { layers };
    },
  },

  stipple: {
    label: "Stipple",
    hint: "weighted dots, relaxed apart; tone from count",
    build(ctx, rng, o) {
      const N = mapped(ctx);
      const count = Math.round(Math.min(46000, 11000 * o.density));
      const pts = stipplePoints(ctx.field, rng, { count, gamma: 1.4, relax: 3 });
      const r = 0.42;
      return {
        layers: [{
          name: "stipple",
          polylines: N(pts.map(([x, y]) => [[x - r, y], [x + r, y]])),
          weight: 0.8, tone: "ink",
        }],
        note: `${pts.length.toLocaleString()} dots`,
      };
    },
  },

  tsp: {
    label: "One path",
    hint: "a single unbroken tour through every dot — zero pen lifts",
    build(ctx, rng, o) {
      const N = mapped(ctx);
      // Fewer points than the stipple method: a tour's line IS the tone, so dots that would read
      // as separate grains at 40,000 read as a solid mat once they are joined.
      const count = Math.round(Math.min(14000, 4200 * o.density));
      const pts = stipplePoints(ctx.field, rng, { count, gamma: 1.5, relax: 4 });
      const tour = tspPath(pts, { window: 32, sweeps: 3 });
      return {
        layers: [{ name: "tour", polylines: N([tour]), weight: 0.85, tone: "ink" }],
        note: `one path through ${pts.length.toLocaleString()} points`,
      };
    },
  },

  squiggle: {
    label: "Squiggle",
    hint: "scanlines whose frequency and swing ride the tone",
    build(ctx, rng, o) {
      const N = mapped(ctx);
      const { w, h } = ctx.field;
      const rows = Math.max(12, Math.round((h / 7) * o.density));
      const rowH = h / rows;
      const lines = [];
      for (let r = 0; r < rows; r += 1) {
        const y0 = (r + 0.5) * rowH;
        const line = [];
        let phase = r * 1.7;
        const dx = 0.7;
        for (let x = 0; x <= w - 1; x += dx) {
          const ink = 1 - sampleField(ctx.field, x, y0);
          phase += dx * (0.16 + ink * 1.25);
          line.push([x, y0 + Math.sin(phase) * rowH * 0.46 * ink]);
        }
        if (line.length > 3) lines.push(line);
      }
      return { layers: [{ name: "scan", polylines: N(lines), weight: 0.85, tone: "ink" }] };
    },
  },

  spiral: {
    label: "Spiral",
    hint: "one Archimedean spiral from the centre, radius modulated by ink",
    build(ctx, rng, o) {
      const N = mapped(ctx);
      const { w, h } = ctx.field;
      const cx = w / 2, cy = h / 2;
      const R = Math.hypot(w, h) / 2;
      const turns = Math.max(24, Math.round(64 * o.density));
      const perTurn = 300;
      const total = turns * perTurn;
      const pitch = R / turns;
      const line = [];
      for (let i = 0; i <= total; i += 1) {
        const t = i / total;
        const a = t * turns * Math.PI * 2;
        const r0 = t * R;
        const px = cx + Math.cos(a) * r0, py = cy + Math.sin(a) * r0;
        const ink = px < 0 || py < 0 || px > w - 1 || py > h - 1 ? 0 : 1 - sampleField(ctx.field, px, py);
        // The wobble rides ACROSS the winding at a fixed rate, so its amplitude is read as tone
        // while the pitch stays constant — the halftone-spiral trick, one stroke, no pen lift.
        const rr = r0 + Math.sin(a * 26) * pitch * 0.44 * ink;
        line.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
      }
      return { layers: [{ name: "spiral", polylines: N([line]), weight: 0.85, tone: "ink" }] };
    },
  },

  contour: {
    label: "Contour",
    hint: "iso-luminance bands: the picture read as terrain",
    build(ctx, rng, o) {
      const N = mapped(ctx);
      const sm = blurField(ctx.field, 2);
      const px = fieldToRGBA(sm);
      const count = Math.max(5, Math.round(9 * o.density) + 4);
      const minor = [], major = [];
      for (let i = 0; i < count; i += 1) {
        const t = ((i + 0.5) / count) * 255;
        const paths = contourFromLuma(px, sm.w, sm.h, 4, { threshold: t });
        (i % 4 === 3 ? major : minor).push(...paths);
      }
      const layers = [{ name: "bands", polylines: N(minor), weight: 0.65, tone: "ink" }];
      if (major.length) layers.push({ name: "index-bands", polylines: N(major), weight: 1.2, tone: "ink" });
      return { layers, note: `${count} iso-luminance levels` };
    },
  },

  xdog: {
    label: "Line drawing",
    hint: "extended difference-of-Gaussians, walked along the flow",
    build(ctx, rng, o) {
      const N = mapped(ctx);
      const lines = traceFlowLines(ctx.edge, ctx.etf, {
        seedMin: 0.22, spacing: Math.max(1, Math.round(3 / o.density)),
        maxSteps: 150, maxLines: 5000, minPoints: 5,
      });
      return { layers: [{ name: "line", polylines: N(lines), weight: 1, tone: "ink" }] };
    },
  },
});

// ── the judge: does the drawing carry the picture? ──────────────────────────
/**
 * measureTone(layers, field, rect, G) → { r, cells, drawn, want }
 * Pearson correlation between per-cell stroke length and per-cell source ink. r near 1 means the
 * drawing puts its ink where the picture has ink; r near 0 means the method produced something
 * that is not about this image at all. Support furniture is excluded — a frame is not a tonal
 * claim, and counting it would reward every method equally for having one.
 */
export function measureTone(layers, field, rect, G = 20) {
  const drawn = new Float64Array(G * G), want = new Float64Array(G * G);
  for (const layer of layers) {
    if (layer.tone === "support") continue;
    for (const line of layer.polylines) {
      for (let i = 1; i < line.length; i += 1) {
        const [ax, ay] = line[i - 1], [bx, by] = line[i];
        const d = Math.hypot(bx - ax, by - ay);
        const u = ((ax + bx) / 2 - rect.x) / rect.w, v = ((ay + by) / 2 - rect.y) / rect.h;
        if (u < 0 || u >= 1 || v < 0 || v >= 1) continue;
        drawn[Math.floor(v * G) * G + Math.floor(u * G)] += d;
      }
    }
  }
  const { w, h, lum } = field;
  for (let gy = 0; gy < G; gy += 1) {
    const y0 = Math.floor((gy * h) / G), y1 = Math.max(y0 + 1, Math.floor(((gy + 1) * h) / G));
    for (let gx = 0; gx < G; gx += 1) {
      const x0 = Math.floor((gx * w) / G), x1 = Math.max(x0 + 1, Math.floor(((gx + 1) * w) / G));
      let s = 0, n = 0;
      for (let y = y0; y < y1 && y < h; y += 1) for (let x = x0; x < x1 && x < w; x += 1) { s += 1 - lum[y * w + x]; n += 1; }
      want[gy * G + gx] = n ? s / n : 0;
    }
  }
  let ma = 0, mb = 0;
  for (let i = 0; i < drawn.length; i += 1) { ma += drawn[i]; mb += want[i]; }
  ma /= drawn.length; mb /= want.length;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < drawn.length; i += 1) {
    const p = drawn[i] - ma, q = want[i] - mb;
    num += p * q; da += p * p; db += q * q;
  }
  // Zero variance on either side means the comparison is undefined, not perfect. Reporting 0 for
  // "a blank sheet against a blank source" is the honest answer; reporting 1 would be a lie the
  // auto-chooser would then act on.
  const r = da > 1e-12 && db > 1e-12 ? num / Math.sqrt(da * db) : 0;
  return { r: +r.toFixed(3), cells: G * G, drawn: +(ma * drawn.length).toFixed(2) };
}

// A plate mark on the content rect, plus corner ticks. Drawn on the PICTURE's edge rather than the
// paper's, so the margin reads as a mount.
function plateFrame(rect, rng) {
  const { x, y, w, h } = rect;
  const box = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  const t = 0.014;
  const ticks = [
    [[x - t, y], [x, y]], [[x, y - t], [x, y]],
    [[x + w, y], [x + w + t, y]], [[x + w, y - t], [x + w, y]],
    [[x - t, y + h], [x, y + h]], [[x, y + h], [x, y + h + t]],
    [[x + w, y + h], [x + w + t, y + h]], [[x + w, y + h], [x + w, y + h + t]],
  ];
  return [box, ...ticks].map((l) => jitter(l, rng, { wander: 0.0005 }));
}

/**
 * composeFromImage(field, seedStr, opts) → { layers, meta }
 * opts: { method: "auto"|<key>, register, density, detail, gamma, candidates, source }
 *
 * With an explicit method it draws that one. With "auto" it draws several and keeps the one whose
 * tone correlation against the source is highest — a choice made by measurement rather than by
 * preference, and reported with the number that decided it.
 */
export function composeFromImage(field, seedStr, opts = {}) {
  const ctx = prepareImage(field, opts);
  const density = Math.max(0.3, Math.min(2.5, opts.density == null ? 1 : opts.density));
  const keys = Object.keys(IMAGE_METHODS);
  const explicit = opts.method && IMAGE_METHODS[opts.method] ? opts.method : null;
  const rPick = mulberry(hash32(String(seedStr) + "#method"));
  let order = keys.slice();
  // Deterministic shuffle, so "auto" tries a different trio for a different seed and the same
  // trio for the same seed.
  for (let i = order.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rPick() * (i + 1));
    const t = order[i]; order[i] = order[j]; order[j] = t;
  }
  const tries = explicit ? [explicit] : order.slice(0, Math.max(1, Math.min(keys.length, opts.candidates || 3)));

  let best = null;
  const considered = [];
  for (const key of tries) {
    const rng = mulberry(hash32(`${seedStr}#${key}`));
    const built = IMAGE_METHODS[key].build(ctx, rng, { density });
    const layers = built.layers.filter((l) => l.polylines.length);
    if (!layers.length) { considered.push(`${key} 0.000`); continue; }
    const tone = measureTone(layers, ctx.field, ctx.rect);
    considered.push(`${key} ${tone.r}`);
    if (!best || tone.r > best.tone.r) best = { key, layers, tone, note: built.note };
  }
  if (!best) {
    const rng = mulberry(hash32(String(seedStr)));
    best = { key: tries[0] || "flowline", layers: [], tone: { r: 0, cells: 400, drawn: 0 }, note: null };
    best.layers = [{ name: "frame", polylines: plateFrame(ctx.rect, rng), weight: 1.5, tone: "ink" }];
  }

  const registerKeys = Object.keys(REGISTERS);
  const rReg = mulberry(hash32(`${seedStr}#register`));
  const register = opts.register && opts.register !== "auto" && REGISTERS[opts.register]
    ? opts.register
    : registerKeys[Math.min(registerKeys.length - 1, Math.floor(rReg() * registerKeys.length))];
  let layers = applyRegister(best.layers, mulberry(hash32(`${seedStr}#hand`)), register);
  layers = layers.concat([{
    name: "frame",
    polylines: plateFrame(ctx.rect, mulberry(hash32(`${seedStr}#frame`))),
    weight: 1.5, tone: "ink",
  }]);

  let strokes = 0, points = 0;
  for (const l of layers) { strokes += l.polylines.length; for (const p of l.polylines) points += p.length; }
  return {
    layers,
    meta: {
      kind: "image",
      seed: String(seedStr),
      study: best.key,
      method: best.key,
      label: (IMAGE_METHODS[best.key] || {}).label || best.key,
      register,
      aspect: ctx.aspect,
      rect: ctx.rect,
      res: [ctx.field.w, ctx.field.h],
      density,
      strokes, points,
      tone: best.tone,
      note: best.note || null,
      considered,
      chosen: explicit ? "named" : "measured",
      source: opts.source || null,
      measure: measureSheet(layers),
    },
  };
}
