// plot-image.test.mjs — the image-to-strokes primitives: field math, flow, response, placement.
// Run: node --test system/plot-image.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  toneField, resampleField, fitField, levels, blurField, edgeTangentFlow, xdogField,
  traceFlowLines, evenStreamlines, stipplePoints, tspPath, sheetPlacement, sampleField,
} from "./plot-image.js";

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A synthetic test image: a hard vertical edge, dark left half, bright right half.
function edgeField(w = 64, h = 64) {
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) lum[y * w + x] = x < w / 2 ? 0.1 : 0.9;
  return { w, h, lum };
}
// A radial gradient: dark centre, bright rim — isophotes are circles.
function radialField(w = 80, h = 80) {
  const lum = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const d = Math.hypot(x - w / 2, y - h / 2) / (w / 2);
      lum[y * w + x] = Math.min(1, d);
    }
  }
  return { w, h, lum };
}

test("toneField reads RGBA luma and resample preserves mean tone", () => {
  const px = new Uint8ClampedArray(4 * 4 * 4);
  for (let i = 0; i < 16; i += 1) { px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = 128; px[i * 4 + 3] = 255; }
  const f = toneField(px, 4, 4);
  assert.ok(Math.abs(f.lum[0] - 128 / 255) < 1e-3);
  const big = radialField(80, 80);
  const small = resampleField(big, 20, 20);
  const mean = (fld) => fld.lum.reduce((a, b) => a + b, 0) / fld.lum.length;
  assert.ok(Math.abs(mean(big) - mean(small)) < 0.02, "box-average resample keeps the tonal mean");
  assert.equal(fitField(big, 40).w, 40, "fit caps the long edge");
  assert.equal(fitField(big, 200).w, 80, "and never upsamples");
});

test("levels stretches a flat image to full range and gamma bends it", () => {
  const lum = new Float32Array(100).fill(0.5);
  for (let i = 0; i < 50; i += 1) lum[i] = 0.4;
  const f = levels({ w: 10, h: 10, lum }, { clip: 0.01 });
  const lo = Math.min(...f.lum), hi = Math.max(...f.lum);
  assert.ok(lo < 0.05 && hi > 0.95, `a 0.4..0.5 image stretches to full range (got ${lo}..${hi})`);
  const g = levels({ w: 10, h: 10, lum }, { clip: 0.01, gamma: 2 });
  assert.ok(Math.min(...g.lum) < 0.05, "gamma keeps the black point");
  const inv = levels({ w: 10, h: 10, lum }, { clip: 0.01, invert: true });
  assert.ok(inv.lum[0] > 0.9, "invert flips ink and paper");
});

test("the edge-tangent flow runs ALONG an edge, not across it", () => {
  const etf = edgeTangentFlow(edgeField(), { sigma: 2 });
  // At the vertical edge the gradient is horizontal, so the flow must be vertical.
  const a = etf.angle[32 * 64 + 32];
  const vertical = Math.abs(Math.abs(Math.sin(a)) - 1) < 0.15;
  assert.ok(vertical, `flow at a vertical edge is vertical (angle ${a.toFixed(3)})`);
  const cEdge = etf.coherence[32 * 64 + 32];
  const cFlat = etf.coherence[32 * 64 + 8];
  assert.ok(cEdge > cFlat, "coherence is higher on the edge than in the flat");
});

test("the line response fires on the edge and stays quiet in flat regions of any level", () => {
  const x = xdogField(edgeField(), { sigma: 1.2 });
  let onEdge = 0, flatDark = 0, flatBright = 0;
  for (let y = 8; y < 56; y += 1) {
    // The response inks the DARK side of an edge; sample the band around it.
    for (let dx = -3; dx <= 3; dx += 1) onEdge = Math.max(onEdge, x.lum[y * 64 + 32 + dx]);
    flatDark = Math.max(flatDark, x.lum[y * 64 + 10]);
    flatBright = Math.max(flatBright, x.lum[y * 64 + 54]);
  }
  assert.ok(onEdge > 0.5, `edge response is strong (got ${onEdge})`);
  assert.ok(flatDark < 0.05, `dark flat is NOT ink — mass is the tone methods' job (got ${flatDark})`);
  assert.ok(flatBright < 0.05, `bright flat is quiet (got ${flatBright})`);
});

test("traceFlowLines draws the edge once, not four hundred times", () => {
  const field = edgeField();
  const etf = edgeTangentFlow(field, { sigma: 2 });
  const x = xdogField(field, { sigma: 1.2 });
  const lines = traceFlowLines(x, etf, { spacing: 2, maxLines: 500 });
  assert.ok(lines.length >= 1 && lines.length < 60, `coverage grid collapses the edge to few strokes (got ${lines.length})`);
  // The longest stroke should run most of the edge's height.
  const span = Math.max(...lines.map((l) => Math.abs(l[l.length - 1][1] - l[0][1])));
  assert.ok(span > 20, `the stroke follows the edge (vertical span ${span.toFixed(1)})`);
});

test("even streamlines: tone drives separation, and no two lines crowd", () => {
  const field = radialField();
  const etf = edgeTangentFlow(field, { sigma: 3 });
  const lines = evenStreamlines(field, etf, { sepMin: 2, sepMax: 8, maxLines: 800 });
  assert.ok(lines.length > 10, `real coverage (got ${lines.length} lines)`);
  // Density check: ink length in the dark centre ring vs the bright rim ring, per unit area.
  let inner = 0, outer = 0;
  for (const line of lines) {
    for (let i = 1; i < line.length; i += 1) {
      const [ax, ay] = line[i - 1], [bx, by] = line[i];
      const d = Math.hypot(bx - ax, by - ay);
      const r = Math.hypot((ax + bx) / 2 - 40, (ay + by) / 2 - 40);
      if (r < 15) inner += d;
      else if (r < 32) outer += d;
    }
  }
  const innerArea = Math.PI * 15 * 15, outerArea = Math.PI * (32 * 32 - 15 * 15);
  assert.ok(inner / innerArea > (outer / outerArea) * 1.5,
    `dark centre carries denser ink per area (${(inner / innerArea).toFixed(3)} vs ${(outer / outerArea).toFixed(3)})`);
});

test("stipple density follows darkness and the tour visits every point once", () => {
  const field = radialField();
  const pts = stipplePoints(field, mulberry(7), { count: 1200, relax: 2 });
  let inner = 0, outer = 0;
  for (const [x, y] of pts) (Math.hypot(x - 40, y - 40) < 20 ? inner++ : outer++);
  assert.ok(inner > outer, `dots crowd the dark centre (${inner} in, ${outer} out)`);
  const tour = tspPath(pts.slice(0, 400), { sweeps: 2 });
  assert.equal(tour.length, 400, "the tour is a permutation, no point dropped or doubled");
  const seen = new Set(tour.map((p) => p[0] + "," + p[1]));
  assert.equal(seen.size, 400, "every point distinct");
});

test("2-opt strictly shortens the greedy tour", () => {
  const rng = mulberry(11);
  const pts = Array.from({ length: 300 }, () => [rng() * 100, rng() * 100]);
  const len = (tour) => { let L = 0; for (let i = 1; i < tour.length; i += 1) L += Math.hypot(tour[i][0] - tour[i - 1][0], tour[i][1] - tour[i - 1][1]); return L; };
  const greedy = tspPath(pts, { sweeps: 0 });
  const improved = tspPath(pts, { sweeps: 3 });
  assert.ok(len(improved) < len(greedy), `2-opt shortens (${len(improved).toFixed(1)} < ${len(greedy).toFixed(1)})`);
});

test("sheet placement is isotropic: image angles survive onto the sheet", () => {
  const { rect, place, aspect } = sheetPlacement(200, 100, 0.05);
  assert.ok(Math.abs(aspect - 0.5) < 1e-9, "the paper takes the picture's aspect");
  // A 45-degree segment in image space must come out 45 degrees in PHYSICAL units, where
  // X = x·W and Y = y·W·aspect for a paper of width W.
  const [x0, y0] = place(0, 0), [x1, y1] = place(50, 50);
  const dX = x1 - x0, dY = (y1 - y0) * aspect;
  assert.ok(Math.abs(dX - dY) < 1e-9, "isotropic mapping (45° stays 45° on paper)");
  assert.ok(rect.x === 0.05 && rect.w === 0.9, "margins as asked");
  // And bilinear sampling interpolates.
  const f = { w: 2, h: 1, lum: new Float32Array([0, 1]) };
  assert.ok(Math.abs(sampleField(f, 0.5, 0) - 0.5) < 1e-6, "bilinear midpoint");
});
