// plot-compose.test.mjs — the self-composing sheet: grammar, metric, and re-roll policy.
// Run: node --test system/plot-compose.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { composeSheet, measureSheet, sheetIsDull, STUDY_FLOORS, STUDY_BUILDERS } from "./plot-compose.js";
import { clipLines } from "./plot-marks.js";

test("every study is registered with a measured floor, and every floor has a study", () => {
  for (const key of Object.keys(STUDY_BUILDERS)) {
    assert.ok(STUDY_FLOORS[key] != null, `${key}: has a measured floor`);
    assert.ok(STUDY_FLOORS[key] > 0.2 && STUDY_FLOORS[key] < 0.95, `${key}: floor is inside the real score range`);
  }
  for (const key of Object.keys(STUDY_FLOORS)) {
    assert.ok(STUDY_BUILDERS[key], `${key}: floor names a real study`);
  }
});

test("the metric refuses an empty sheet and a uniform mat, in any register", () => {
  assert.equal(measureSheet([]).score, 0, "nothing scores nothing");
  const empty = measureSheet([{ name: "x", polylines: [], weight: 1, tone: "ink" }]);
  assert.ok(sheetIsDull(empty, "basin"), "an empty layer is dull");
  // A perfectly uniform grid: full coverage, no spread, no figure.
  const mat = [];
  for (let i = 0; i < 60; i++) {
    const t = i / 59;
    mat.push([[0, t], [1, t]]);
  }
  const m = measureSheet([{ name: "mat", polylines: mat, weight: 1, tone: "ink" }]);
  assert.ok(sheetIsDull(m, "basin"), `a uniform mat is dull (spread ${m.spread})`);
});

test("the metric does not call the plotter's own gesture degenerate", () => {
  // One unbroken 20,000-point trace is TWO strokes and a perfectly good sheet. An earlier
  // version guarded on stroke count and scored it a flat zero.
  const line = [];
  for (let i = 0; i < 20000; i++) {
    const t = i * 0.01;
    line.push([0.5 + 0.3 * Math.sin(t * 1.7), 0.5 + 0.3 * Math.sin(t * 2.3 + 1)]);
  }
  const m = measureSheet([{ name: "trace", polylines: [line], weight: 1, tone: "ink" }]);
  assert.ok(m.score > 0.2, `a single continuous trace scores as a real sheet (got ${m.score})`);
  assert.ok(m.ink > 10, "and its ink is measured");
});

test("the score is a veto product: one failed measure sinks the sheet", () => {
  // All-parallel lines: good coverage, poor direction entropy. A weighted SUM would let this
  // coast; the geometric mean must not.
  const parallel = [];
  for (let i = 0; i < 40; i++) parallel.push([[0.05, 0.05 + i * 0.022], [0.95, 0.05 + i * 0.022]]);
  const flat = measureSheet([{ name: "p", polylines: parallel, weight: 1, tone: "ink" }]);
  assert.ok(flat.direction < 0.2, "all-parallel really does score near zero on direction");
  assert.ok(flat.score < 0.35, `and the product carries that through (got ${flat.score})`);
});

test("a sheet composes itself: study, register and furniture all chosen", () => {
  const s = composeSheet("aurora");
  assert.ok(STUDY_BUILDERS[s.meta.study], "chose a real study");
  assert.ok(s.meta.register, "chose a mark register");
  assert.ok(s.layers.some((l) => l.name === "frame"), "every sheet gets a frame");
  assert.ok(s.meta.strokes > 50, "and real strokes");
  assert.ok(typeof s.meta.cleared === "boolean", "reports whether it cleared its bar");
  assert.ok(s.meta.candidates >= 1, "reports how many candidates it tried");
});

test("composition is deterministic, and different seeds diverge", () => {
  const a = composeSheet("membrane"), b = composeSheet("membrane");
  assert.equal(a.meta.study, b.meta.study);
  assert.equal(a.meta.register, b.meta.register);
  assert.equal(a.meta.strokes, b.meta.strokes);
  assert.equal(JSON.stringify(a.meta.measure), JSON.stringify(b.meta.measure));
  const c = composeSheet("portal");
  assert.notEqual(a.meta.study + a.meta.strokes, c.meta.study + c.meta.strokes, "seeds diverge");
});

test("the re-roll policy actually fires, and never ships a silent failure", () => {
  // Across a spread of seeds some candidates must be rejected: a gate that never rejects is
  // decoration. And any sheet that could not clear its bar must SAY so rather than pretend.
  let rerolled = 0, notCleared = 0;
  for (let i = 0; i < 40; i++) {
    const s = composeSheet("gate-" + i);
    if (s.meta.candidates > 1) rerolled += 1;
    if (!s.meta.cleared) notCleared += 1;
    if (!s.meta.cleared) assert.ok(s.meta.candidates > 1, "a best-effort sheet exhausted its candidates first");
    // Whatever it shipped, the measure that justified it is attached.
    assert.ok(s.meta.measure && typeof s.meta.measure.score === "number");
  }
  assert.ok(rerolled > 0, `the gate rejects real candidates (re-rolled ${rerolled}/40)`);
});

test("forcing a study overrides the grammar but keeps the judgement", () => {
  for (const study of Object.keys(STUDY_BUILDERS)) {
    const s = composeSheet("forced", { study });
    assert.equal(s.meta.study, study, `${study}: honoured`);
    assert.ok(s.meta.measure.score > 0, `${study}: still measured`);
  }
});

test("every composed sheet stays inside the sheet, boundary-exact", () => {
  for (let i = 0; i < 8; i++) {
    const s = composeSheet("bounds-" + i);
    for (const layer of s.layers) {
      for (const line of layer.polylines) {
        for (const [x, y] of line) {
          assert.ok(x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6,
            `${s.meta.study}/${layer.name}: (${x}, ${y}) escapes the sheet`);
        }
      }
    }
  }
});

test("clipping intersects the boundary instead of dropping the vertex", () => {
  // The frayed-margin defect: a stroke crossing the edge must END on the edge, not at whichever
  // sample happened to be the last one inside.
  const clipped = clipLines([[[0, 0.5], [0.5, 0.5], [1, 0.5]]], 0.04, 0.04, 0.96, 0.96);
  assert.equal(clipped.length, 1);
  assert.ok(Math.abs(clipped[0][0][0] - 0.04) < 1e-9, "enters exactly at the margin");
  assert.ok(Math.abs(clipped[0][clipped[0].length - 1][0] - 0.96) < 1e-9, "leaves exactly at the margin");
  // Exit and re-entry splits into two runs, both inside.
  const two = clipLines([[[0.5, 0.5], [0.5, 1.4], [0.6, 1.4], [0.6, 0.5]]], 0.04, 0.04, 0.96, 0.96);
  assert.equal(two.length, 2, "a re-entering stroke splits");
  for (const run of two) for (const p of run) assert.ok(p[1] <= 0.96 + 1e-9, "and stays inside");
});
