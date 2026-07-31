// DOM-less contracts for the poster workshop: the grounded critique cites
// real numbers and reacts to real conditions; layout math is deterministic.
import test from "node:test";
import assert from "node:assert/strict";
import {
  defaultPosterState, cellAnchor, wrapText, contrastRatio, critiquePoster,
  POSTER_FORMATS, POSTER_CELLS,
} from "./poster.js";

test("default state carries three blocks and a real format", () => {
  const s = defaultPosterState("t");
  assert.equal(s.blocks.length, 3);
  assert.ok(POSTER_FORMATS[s.format]);
  assert.ok(s.blocks.every((b) => POSTER_CELLS.includes(b.cell)));
});

test("cellAnchor maps corners and center inside the margins", () => {
  const m = 0.1;
  assert.deepEqual(cellAnchor("top-left", m), { x: 0.1, y: 0.1, col: 0, row: 0 });
  const c = cellAnchor("center", m);
  assert.ok(Math.abs(c.x - 0.5) < 1e-9 && Math.abs(c.y - 0.5) < 1e-9);
  const br = cellAnchor("bottom-right", m);
  assert.ok(Math.abs(br.x - 0.9) < 1e-9 && Math.abs(br.y - 0.9) < 1e-9);
});

test("wrapText breaks on the measured width", () => {
  const ctx = { measureText: (t) => ({ width: t.length * 10 }) };
  const lines = wrapText(ctx, "one two three four five", 100);
  assert.ok(lines.length >= 2, "should wrap");
  assert.ok(lines.every((l) => l.length * 10 <= 110), "no line grossly over budget");
});

test("contrastRatio matches known WCAG anchors", () => {
  assert.ok(Math.abs(contrastRatio("#ffffff", "#000000") - 21) < 0.1);
  assert.ok(Math.abs(contrastRatio("#777777", "#777777") - 1) < 0.01);
});

function detailWith(cells) {
  // cells: 3x3 array of {luma, edge, hue, hex}
  return { grid3: cells };
}
const calmDark = { luma: 0.08, edge: 0.05, hue: "near-black", hex: "#0a0a10" };
const busyMid = { luma: 0.45, edge: 0.62, hue: "teal", hex: "#3a7a70" };
const bright = { luma: 0.85, edge: 0.1, hue: "near-white", hex: "#e8ecf0" };

test("critique flags type on a busy region and points at the calmest cell", () => {
  const grid = [[calmDark, calmDark, calmDark], [busyMid, calmDark, calmDark], [calmDark, calmDark, calmDark]];
  const boxes = [{ kind: "headline", x0: 0.05, y0: 0.4, x1: 0.3, y1: 0.55, color: "#f2ecf7", cell: "middle-left" }];
  const findings = critiquePoster(boxes, detailWith(grid), null);
  const busy = findings.find((f) => f.text.includes("busy region"));
  assert.ok(busy, "expected a busy-region finding");
  assert.equal(busy.level, "fix");
  assert.ok(busy.text.includes("edge density 0.62"));
});

test("critique fails low-contrast type with the measured ratio", () => {
  const grid = [[bright, bright, bright], [bright, bright, bright], [bright, bright, bright]];
  const boxes = [{ kind: "standfirst", x0: 0.4, y0: 0.4, x1: 0.6, y1: 0.5, color: "#d8dce0", cell: "center" }];
  const findings = critiquePoster(boxes, detailWith(grid), null);
  const low = findings.find((f) => f.level === "fix" && f.text.includes(":1"));
  assert.ok(low, "expected a contrast failure with a ratio");
});

test("critique flags overlapping blocks", () => {
  const grid = [[calmDark, calmDark, calmDark], [calmDark, calmDark, calmDark], [calmDark, calmDark, calmDark]];
  const boxes = [
    { kind: "headline", x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.3, color: "#ffffff", cell: "top-left" },
    { kind: "standfirst", x0: 0.3, y0: 0.2, x1: 0.6, y1: 0.4, color: "#ffffff", cell: "top-center" },
  ];
  const findings = critiquePoster(boxes, detailWith(grid), null);
  assert.ok(findings.some((f) => f.level === "fix" && f.text.includes("overlap")));
});

test("a clean poster earns the structural praise line", () => {
  const grid = [[calmDark, calmDark, calmDark], [calmDark, calmDark, calmDark], [calmDark, calmDark, calmDark]];
  const boxes = [{ kind: "headline", x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.2, color: "#ffffff", cell: "top-left" }];
  const findings = critiquePoster(boxes, detailWith(grid), null);
  assert.ok(findings.some((f) => f.level === "praise"));
  assert.ok(!findings.some((f) => f.level === "fix"));
});
