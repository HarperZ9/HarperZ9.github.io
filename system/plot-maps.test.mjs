// plot-maps.test.mjs — the generative cartography module, pure and node-run.
// Run: node --test system/plot-maps.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  elevationField, fieldToLuma, ridgelines, buildPlotMap, plotMapSVG, PLOT_STUDIES,
} from "./plot-maps.js";

test("the elevation field is deterministic, normalized, and seed-sensitive", () => {
  const a = elevationField("aurora", 64, 48);
  const b = elevationField("aurora", 64, 48);
  const c = elevationField("kiln", 64, 48);
  assert.deepEqual(Array.from(a.field.slice(0, 32)), Array.from(b.field.slice(0, 32)), "same seed, same field");
  assert.notDeepEqual(Array.from(a.field.slice(0, 32)), Array.from(c.field.slice(0, 32)), "different seed, different field");
  let mn = Infinity, mx = -Infinity;
  for (const v of a.field) { if (v < mn) mn = v; if (v > mx) mx = v; }
  assert.ok(mn >= 0 && mx <= 1 && mx - mn > 0.5, `field spans [0,1] with real range (got ${mn.toFixed(3)}..${mx.toFixed(3)})`);
  assert.ok(a.seaLevel > 0.05 && a.seaLevel < 0.95, "sea level sits inside the distribution");
});

test("every study produces a sheet with every promised layer, non-empty", () => {
  for (const study of Object.keys(PLOT_STUDIES)) {
    const plot = buildPlotMap("aurora", { study });
    const names = plot.layers.map((l) => l.name);
    // contours-light renders under the name "contours"; everything else keeps its key.
    for (const want of PLOT_STUDIES[study].layers) {
      const name = want === "contours-light" ? "contours" : want;
      assert.ok(names.includes(name), `${study}: layer ${name} present`);
    }
    for (const l of plot.layers) {
      assert.ok(l.polylines.length > 0, `${study}/${l.name}: has polylines`);
      assert.ok(l.weight > 0, `${study}/${l.name}: has a stroke weight`);
    }
    assert.ok(plot.meta.strokes > 30, `${study}: a real sheet, not a sketch (${plot.meta.strokes} strokes)`);
  }
});

test("the sheet is deterministic end to end", () => {
  const a = buildPlotMap("membrane", { study: "topo", levels: 12 });
  const b = buildPlotMap("membrane", { study: "topo", levels: 12 });
  assert.equal(JSON.stringify(a.layers), JSON.stringify(b.layers));
  assert.notEqual(
    JSON.stringify(buildPlotMap("membrane", { study: "topo" }).layers),
    JSON.stringify(buildPlotMap("portal", { study: "topo" }).layers),
    "seeds differentiate whole sheets",
  );
});

test("every coordinate stays inside the unit sheet", () => {
  for (const study of Object.keys(PLOT_STUDIES)) {
    const plot = buildPlotMap("bounds-check", { study });
    for (const layer of plot.layers) {
      for (const line of layer.polylines) {
        for (const [x, y] of line) {
          assert.ok(x >= -1e-9 && x <= 1 + 1e-9 && y >= -1e-9 && y <= 1 + 1e-9,
            `${study}/${layer.name}: point (${x}, ${y}) escapes the sheet`);
        }
      }
    }
  }
});

test("ridgelines respect the horizon: later (farther) rows never dip below earlier ink at a column", () => {
  const { field } = elevationField("ridge-check", 96, 72);
  const lines = ridgelines(field, 96, 72, { rows: 24, sampleStep: 2 });
  assert.ok(lines.length > 10, "a ridge stack, not a single stroke");
  // Reconstruct per-column minima in emission order: each new segment's points must sit ABOVE
  // (smaller y than) anything already drawn at that column, within tolerance — that IS the
  // hidden-line property.
  const seen = new Map();
  for (const line of lines) {
    for (const [x, y] of line) {
      const col = Math.round(x * 200);
      const prior = seen.get(col);
      if (prior !== undefined) assert.ok(y <= prior + 1e-6, `column ${col}: ink at ${y} below existing horizon ${prior}`);
      seen.set(col, prior === undefined ? y : Math.min(prior, y));
    }
  }
});

test("water hatching exists only when the study asks for it, and only below sea level", () => {
  const plot = buildPlotMap("aurora", { study: "topo" });
  const water = plot.layers.find((l) => l.name === "water");
  assert.ok(water && water.polylines.length > 0, "topo carries water hatching");
  const ridge = buildPlotMap("aurora", { study: "ridge" });
  assert.ok(!ridge.layers.some((l) => l.name === "water"), "ridge carries none");
});

test("the SVG is a plotter sheet: real units, one group per layer, stroke counts declared", () => {
  const plot = buildPlotMap("aurora", { study: "chart" });
  const svg = plotMapSVG(plot, { widthMm: 210 });
  assert.ok(svg.startsWith("<svg"), "svg root");
  assert.ok(svg.includes('width="210mm"'), "physical units");
  for (const layer of plot.layers) assert.ok(svg.includes(`id="${layer.name}"`), `group ${layer.name}`);
  assert.ok(/data-strokes="\d+"/.test(svg), "per-layer stroke counts declared");
  assert.ok(svg.includes("seed aurora"), "the seed is in the sheet's own record");
  // No NaN coordinates ever reach the path data.
  assert.ok(!svg.includes("NaN"), "no NaN in path data");
});

test("contour threshold is honoured, on either scale, and the levels knob is real", async () => {
  // The defect: contourFromLuma accepted opts.threshold and marched five fixed levels anyway, so
  // 14 requested contour levels were the same 5 re-traced and the coast was nowhere near sea
  // level. Two different thresholds must now produce different geometry; the byte scale and the
  // unit scale must agree; and asking a topo sheet for more levels must actually buy more.
  const { contourFromLuma } = await import("./plotter.js");
  const w = 64, h = 64;
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const v = Math.round((x / (w - 1)) * 255);   // horizontal ramp: iso-lines are verticals
      const i = (y * w + x) * 4;
      px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
    }
  }
  const lo = contourFromLuma(px, w, h, 4, { threshold: 51 });
  const hi = contourFromLuma(px, w, h, 4, { threshold: 229 });
  assert.ok(lo.length && hi.length, "both thresholds trace something");
  assert.notEqual(JSON.stringify(lo), JSON.stringify(hi), "different thresholds, different geometry");
  // On a ramp the iso-line's x position IS the threshold.
  const meanX = (ls) => { let s = 0, n = 0; for (const l of ls) for (const p of l) { s += p[0]; n += 1; } return s / n; };
  assert.ok(meanX(lo) < meanX(hi), "the iso-line moved with the threshold");
  const unit = contourFromLuma(px, w, h, 4, { threshold: 0.2 });
  assert.equal(JSON.stringify(unit), JSON.stringify(contourFromLuma(px, w, h, 4, { threshold: 51 })),
    "0-1 and 0-255 scales agree");
  const few = buildPlotMap("aurora", { study: "topo", levels: 6 });
  const many = buildPlotMap("aurora", { study: "topo", levels: 24 });
  const contours = (p) => (p.layers.find((l) => l.name === "contours") || { polylines: [] }).polylines.length;
  assert.ok(contours(many) > contours(few), `more levels, more contours (${contours(few)} -> ${contours(many)})`);
});

test("the paper takes the sheet's own aspect: no more silent squash", async () => {
  // Cartographic sheets are 4:3; composed sheets are square; an image sheet takes the picture's
  // ratio. Before aspect rode in the meta, every composed sheet was exported at 0.75 and lost a
  // quarter of its height.
  const carto = buildPlotMap("aurora", { study: "topo" });
  assert.equal(carto.meta.aspect, 0.75);
  assert.ok(plotMapSVG(carto, { widthMm: 210 }).includes('height="158mm"') || plotMapSVG(carto, { widthMm: 210 }).includes('height="157mm"'), "4:3 paper");
  const { composeSheet } = await import("./plot-compose.js");
  const field = composeSheet("aspect-check", { candidates: 1 });
  assert.equal(field.meta.aspect, 1, "composed sheets are square");
  assert.ok(plotMapSVG(field, { widthMm: 210 }).includes('height="210mm"'), "square paper for a square sheet");
  const fake = { layers: [{ name: "x", polylines: [[[0.1, 0.1], [0.9, 0.9]]], weight: 1, tone: "ink" }], meta: { seed: "s", study: "img", aspect: 1.25, strokes: 1, points: 2 } };
  assert.ok(plotMapSVG(fake, { widthMm: 200 }).includes('height="250mm"'), "an image sheet keeps the picture's ratio");
});

test("fieldToLuma remaps through the provided function and clamps", () => {
  const luma = fieldToLuma(new Float32Array([0, 0.5, 1]), 3, 1, (v) => v * 2);
  assert.equal(luma[0], 0);
  assert.equal(luma[4], 255);   // 0.5 * 2 clamped to 1
  assert.equal(luma[8], 255);
  assert.equal(luma[3], 255);   // alpha opaque
});
