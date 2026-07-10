// DOM-less contracts for the plotter: deterministic per (frame, seed),
// ink lands where the image is dark, SVG output is plotter-shaped, paths
// come back travel-ordered, pens split by source color, G-code is minimal
// and fixed-decimal.
import test from "node:test";
import assert from "node:assert/strict";
import {
  flowlinesFromLuma, hatchFromLuma, contourFromLuma,
  orderPaths, separatePens, toGcode, toPlotterSVG, plotCanvas,
} from "./plotter.js";

function frame(w, h, paint) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = paint(x, y);
    const i = (y * w + x) * 4;
    px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
  }
  return px;
}

function rgbFrame(w, h, paint) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const [r, g, b] = paint(x, y);
    const i = (y * w + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = 255;
  }
  return px;
}

// Tiny deterministic PRNG for synthetic scatters (mirror of the module's).
function mulberry(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 80, H = 60;
// Left half dark (ink), right half near-white (paper).
const SPLIT = frame(W, H, (x) => (x < W / 2 ? 30 : 245));

test("flowlines are deterministic per seed and differ across seeds", () => {
  const a = flowlinesFromLuma(SPLIT, W, H, 4, { seed: "s1", lines: 200 });
  const b = flowlinesFromLuma(SPLIT, W, H, 4, { seed: "s1", lines: 200 });
  const c = flowlinesFromLuma(SPLIT, W, H, 4, { seed: "s2", lines: 200 });
  assert.deepEqual(a, b, "same seed must reproduce the same plot");
  assert.notDeepEqual(a, c, "a different seed must change the plot");
  assert.ok(a.length > 50, "expected a substantial line count, got " + a.length);
});

test("ink concentrates in the dark half", () => {
  const lines = flowlinesFromLuma(SPLIT, W, H, 4, { seed: "ink", lines: 300 });
  let dark = 0, bright = 0;
  for (const line of lines) for (const [x] of line) (x < W / 2 ? dark++ : bright++);
  assert.ok(dark > bright * 3, `dark ${dark} vs bright ${bright}: ink should follow darkness`);
});

test("hatching produces band-clipped segments only where the frame is dark", () => {
  const lines = hatchFromLuma(SPLIT, W, H, 4, { spacing: 4 });
  assert.ok(lines.length > 20, "expected hatch segments, got " + lines.length);
  for (const [[x0], [x1]] of lines) {
    assert.ok(x0 < W / 2 + 2 && x1 < W / 2 + 2, "hatch leaked into the paper half");
  }
});

test("toPlotterSVG emits single-stroke, fill-free, well-formed SVG", () => {
  const lines = flowlinesFromLuma(SPLIT, W, H, 4, { seed: "svg", lines: 120 });
  const svg = toPlotterSVG(lines, W, H, { seed: "svg", style: "flow" });
  assert.ok(svg.startsWith('<?xml version="1.0"'));
  assert.ok(svg.includes('fill="none"'), "plotter SVG must not fill");
  assert.ok(svg.includes("<polyline points="), "expected polyline paths");
  assert.ok(svg.includes('stroke-linecap="round"'));
  assert.ok(svg.trimEnd().endsWith("</svg>"));
  const opens = (svg.match(/<svg/g) || []).length;
  const closes = (svg.match(/<\/svg>/g) || []).length;
  assert.equal(opens, closes);
});

// ---------------------------------------------------------------- orderPaths

function travelOf(list) {
  let t = 0;
  for (let i = 1; i < list.length; i += 1) {
    const a = list[i - 1][list[i - 1].length - 1];
    const b = list[i][0];
    t += Math.hypot(a[0] - b[0], a[1] - b[1]);
  }
  return t;
}

test("orderPaths cuts pen-up travel on a synthetic scatter", () => {
  const rnd = mulberry(0xC0FFEE);
  const scatter = [];
  for (let i = 0; i < 120; i += 1) {
    const x = rnd() * 400, y = rnd() * 400;
    scatter.push([[x, y], [x + rnd() * 20 - 10, y + rnd() * 20 - 10]]);
  }
  const before = travelOf(scatter);
  const ordered = orderPaths(scatter);
  const after = travelOf(ordered);
  assert.equal(ordered.length, scatter.length, "no path may be dropped or added");
  const pts = (l) => l.reduce((n, p) => n + p.length, 0);
  assert.equal(pts(ordered), pts(scatter), "points must be conserved");
  assert.ok(after < before * 0.7,
    `ordered travel ${after.toFixed(1)} should be < 70% of unordered ${before.toFixed(1)}`);
  assert.deepEqual(orderPaths(scatter), ordered, "ordering must be deterministic");
});

// -------------------------------------------------------------- separatePens

test("separatePens clusters lines by source color, each assigned exactly once", () => {
  const W2 = 90, H2 = 30;
  // Three color fields: red third, near-black third, blue third.
  const px = rgbFrame(W2, H2, (x) => (x < 30 ? [200, 30, 30] : x < 60 ? [15, 15, 15] : [30, 30, 200]));
  const lines = [];
  for (const x0 of [4, 34, 64]) {
    for (const y of [5, 12, 19, 26]) {
      lines.push([[x0, y], [x0 + 10, y], [x0 + 20, y]]);
    }
  }
  const pens = separatePens(px, W2, H2, 4, lines, 3);
  assert.equal(pens.length, 3, "expected penCount clusters");
  const seen = new Set();
  for (const pen of pens) {
    assert.match(pen.color, /^#[0-9a-f]{6}$/, "cluster color must be hex");
    assert.ok(pen.polylines.length > 0, "no pen should come back dry on separable input");
    for (const l of pen.polylines) {
      assert.ok(!seen.has(l), "a polyline was assigned to two pens");
      seen.add(l);
    }
  }
  assert.equal(seen.size, lines.length, "every polyline must be assigned");
  // Region cohesion: the 4 lines of each color field share one pen.
  const penOf = (line) => pens.findIndex((p) => p.polylines.includes(line));
  for (let region = 0; region < 3; region += 1) {
    const ids = new Set();
    for (let i = 0; i < 4; i += 1) ids.add(penOf(lines[region * 4 + i]));
    assert.equal(ids.size, 1, "lines over one color field must share a pen");
  }
  assert.deepEqual(separatePens(px, W2, H2, 4, lines, 3), pens, "clustering must be deterministic");
});

// -------------------------------------------------------------------- toGcode

test("toGcode emits G21/G90, a G0+G1 pair per path, fixed decimals", () => {
  const gLines = [[[0, 0], [10, 0], [10, 10]], [[20, 20], [30, 30]]];
  const g = toGcode(gLines, 100, 80, {});
  assert.ok(g.includes("G21"), "must set millimetres");
  assert.ok(g.includes("G90"), "must set absolute positioning");
  assert.ok(g.includes("M3 S40"), "servo pen-up default");
  assert.ok(g.includes("M3 S90"), "servo pen-down default");
  assert.ok(g.includes("M5"), "servo off in footer");
  const g0 = g.match(/^G0 X\d+\.\d{3} Y\d+\.\d{3}$/gm) || [];
  assert.ok(g0.length >= 3, "G0 travel per path plus return home, got " + g0.length);
  const g1 = g.match(/^G1 X\d+\.\d{3} Y\d+\.\d{3}/gm) || [];
  assert.ok(g1.length >= 3, "G1 draw moves through the points, got " + g1.length);
  assert.ok(/G0 X[\d.]+ Y[\d.]+\nM3 S90\nG1 X/.test(g), "each path: travel, pen down, draw");
  // widthMm 190 over srcW 100 -> k = 1.9; (10,0) -> X19.000, Y(80-0)*1.9 = 152.000.
  assert.ok(g.includes("G1 X19.000 Y152.000 F2500"), "scale + Y flip + feed on first draw move");
  assert.ok(g.trimEnd().endsWith("G0 X0.000 Y0.000"), "must return to origin");
  assert.equal(g, toGcode(gLines, 100, 80, {}), "G-code must be deterministic");
  const gz = toGcode(gLines, 100, 80, { mode: "z" });
  assert.ok(gz.includes("G0 Z5.000"), "z mode raises the pen with Z");
  assert.ok(gz.includes("G1 Z0.000 F2500"), "z mode lowers the pen with Z");
  assert.ok(!gz.includes("M3"), "z mode must not drive a servo");
});

// -------------------------------------------------------------- contour mode

test("contour mode traces a radial gradient deterministically", () => {
  const RAD = frame(W, H, (x, y) => {
    const dx = x - W / 2, dy = y - H / 2;
    return Math.max(0, Math.min(255, Math.round(255 * Math.hypot(dx, dy) / (H * 0.6))));
  });
  const a = contourFromLuma(RAD, W, H, 4, {});
  const b = contourFromLuma(RAD, W, H, 4, {});
  assert.deepEqual(a, b, "contours must be deterministic");
  assert.ok(a.length >= 4, "expected contour polylines across the luma bands, got " + a.length);
  assert.ok(a.some((l) => l.length > 20), "expected at least one long chained ring");
  for (const line of a) {
    for (const [x, y] of line) {
      assert.ok(x >= 0 && y >= 0 && x <= W - 1 && y <= H - 1, "contour point out of bounds");
    }
  }
});

// ----------------------------------------------------- SVG pens + paper sizes

test("toPlotterSVG with pens emits one labelled Inkscape layer per pen", () => {
  const pensIn = [
    { color: "#102030", polylines: [[[0, 0], [10, 10]]] },
    { color: "#a0b0c0", polylines: [[[20, 0], [30, 10]]] },
  ];
  const svg = toPlotterSVG([], W, H, { pens: pensIn });
  assert.equal((svg.match(/<g /g) || []).length, 2, "one group per pen");
  assert.ok(svg.includes('xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"'));
  assert.ok(svg.includes('inkscape:label="pen 1 #102030"'));
  assert.ok(svg.includes('inkscape:label="pen 2 #a0b0c0"'));
  assert.ok(svg.includes('stroke="#102030"') && svg.includes('stroke="#a0b0c0"'));
});

test("paper option letterboxes the art inside a 6% margin", () => {
  const svg = toPlotterSVG([[[0, 0], [W - 1, H - 1]]], W, H, { paper: "a4" });
  assert.ok(svg.includes('width="1122" height="793"'), "a4 landscape units");
  const pts = [...svg.matchAll(/points="([^"]+)"/g)]
    .flatMap((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
  assert.ok(pts.length >= 2);
  const margin = Math.min(1122, 793) * 0.06;
  for (const [x, y] of pts) {
    assert.ok(x >= margin - 0.6 && x <= 1122 - margin + 0.6, "x escaped the margin: " + x);
    assert.ok(y >= margin - 0.6 && y <= 793 - margin + 0.6, "y escaped the margin: " + y);
  }
  const a5 = toPlotterSVG([[[0, 0], [W - 1, H - 1]]], W, H, { paper: "a5" });
  assert.ok(a5.includes('width="793" height="559"'), "a5 units");
  const sq = toPlotterSVG([[[0, 0], [W - 1, H - 1]]], W, H, { paper: "square" });
  assert.ok(sq.includes('width="800" height="800"'), "square units");
});

// ------------------------------------------------ plotCanvas contour + pens

function mockScratch(px) {
  return {
    width: 0,
    height: 0,
    getContext: () => ({
      clearRect() {},
      drawImage() {},
      getImageData: () => ({ data: px }),
    }),
  };
}

test("plotCanvas contour style threads orderPaths and returns pens", () => {
  const canvas = { width: W, height: H };
  const run = () => plotCanvas(canvas, {
    style: "contour", scratch: mockScratch(SPLIT), sampleWidth: W, pens: 2, seed: "c1",
  });
  const res = run();
  assert.ok(res.polylines.length > 0, "contour style must yield polylines");
  assert.equal(res.stats.lines, res.polylines.length);
  assert.ok(Array.isArray(res.pens) && res.pens.length === 2, "penCount 2 -> .pens in the return");
  assert.ok(res.svg.includes("xmlns:inkscape"), "pens flow into the SVG layers");
  assert.deepEqual(run().polylines, res.polylines, "plot must be deterministic per seed");
});
