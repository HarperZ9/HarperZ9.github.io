// DOM-less contracts for the plotter: deterministic per (frame, seed),
// ink lands where the image is dark, SVG output is plotter-shaped.
import test from "node:test";
import assert from "node:assert/strict";
import { flowlinesFromLuma, hatchFromLuma, toPlotterSVG } from "./plotter.js";

function frame(w, h, paint) {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const v = paint(x, y);
    const i = (y * w + x) * 4;
    px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
  }
  return px;
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
