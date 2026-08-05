// plot-replay.test.mjs — the replay stream, pure and node-run.
// Run: node --test system/plot-replay.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { sheetStrokeStream, createReplay, PEN_NAMES } from "./plot-replay.js";
import { buildPlotMap, sheetTransform, penIndexFor, passesFor } from "./plot-maps.js";

// A straight n-point line across the sheet: known length, known order.
const line = (n, y = 0.5) => Array.from({ length: n }, (_, i) => [i / Math.max(1, n - 1), y]);

// A real sheet with all three pens loaded: water (support, pen 0), contours (pen 1),
// index-contours/coast/frame (heavy, pen 2). Small res keeps the suite fast.
const topo = () => buildPlotMap("aurora", { study: "topo", res: 96, levels: 8 });

test("stream order respects pens: every pen-0 entry precedes pen-1, boundaries mark the swaps", () => {
  const { entries, totals, penBoundaries } = sheetStrokeStream(topo());
  assert.ok(entries.length > 50, "a real stream, not a sketch");
  for (let i = 1; i < entries.length; i++) {
    assert.ok(entries[i].pen >= entries[i - 1].pen, `entry ${i}: pen ${entries[i].pen} after pen ${entries[i - 1].pen}`);
  }
  assert.equal(totals.pens, 3, "topo loads all three pens");
  assert.deepEqual(penBoundaries.map((b) => b.pen), [0, 1, 2]);
  assert.equal(penBoundaries[0].index, 0, "the first pen starts the stream");
  for (const b of penBoundaries) {
    assert.equal(entries[b.index].pen, b.pen, `boundary of pen ${b.pen} points at its first entry`);
    if (b.index > 0) assert.ok(entries[b.index - 1].pen < b.pen, `pen ${b.pen} boundary sits on a real swap`);
  }
  assert.equal(PEN_NAMES.length, 3, "every pen index has a name to announce");
});

test("passes repeat consecutively and multiply the point totals exactly", () => {
  // weight 1.0 → 2 passes; weight 1.5 → 3. The pass model is plot-maps' own (passesFor).
  const plot = { layers: [{ name: "a", polylines: [line(5), line(3)], weight: 1.0, tone: "ink" }], meta: { aspect: 1 } };
  const s = sheetStrokeStream(plot);
  assert.equal(s.totals.strokes, 4, "2 strokes × 2 passes");
  assert.equal(s.totals.points, 16, "(5+3) points × 2 passes");
  // Pass 2 follows pass 1 immediately — the whole layer again, strokes in order.
  assert.deepEqual(s.entries.map((e) => [e.passIndex, e.line.length]), [[0, 5], [0, 3], [1, 5], [1, 3]]);
  const heavy = sheetStrokeStream({ layers: [{ name: "h", polylines: [line(4)], weight: 1.5, tone: "ink" }], meta: {} });
  assert.equal(heavy.totals.strokes, 3);
  assert.equal(heavy.totals.points, 12, "4 points × 3 passes");
});

test("within a pen, layer order and stroke order hold; support runs first regardless of declaration order", () => {
  const plot = {
    layers: [
      { name: "inkA", polylines: [line(4), line(6)], weight: 0.5, tone: "ink" },
      { name: "wash", polylines: [line(3)], weight: 0.6, tone: "support" },   // declared later, plots FIRST
      { name: "inkB", polylines: [line(5)], weight: 0.5, tone: "ink" },
    ],
    meta: { aspect: 1 },
  };
  const s = sheetStrokeStream(plot);
  assert.deepEqual(s.entries.map((e) => e.layerName), ["wash", "inkA", "inkA", "inkB"]);
  assert.deepEqual(s.entries.map((e) => e.line.length), [3, 4, 6, 5], "stroke order inside a layer is kept");
  assert.deepEqual(s.penBoundaries, [{ pen: 0, index: 0 }, { pen: 1, index: 1 }]);
});

test("the step budget slices mid-line: a long stroke arrives in connected pieces, never in one tick", () => {
  const plot = { layers: [{ name: "long", polylines: [line(100)], weight: 0.5, tone: "ink" }], meta: { aspect: 1 } };
  const rep = createReplay(plot);
  const items = [];
  let r;
  do { r = rep.step(7); items.push(...r.batch); } while (!r.done);
  assert.ok(items.length >= 14, `a 100-point line at budget 7 must arrive in many slices (got ${items.length})`);
  assert.equal(items[0].from, 0, "the stroke starts at its first point");
  assert.equal(items[items.length - 1].to, 99, "and ends at its last");
  for (let i = 1; i < items.length; i++) {
    assert.equal(items[i].from, items[i - 1].to, `slice ${i} resumes exactly where slice ${i - 1} parked`);
  }
  // Conservation at segment level: shared boundary points overlap, segments never do.
  const segs = items.reduce((a, it) => a + (it.to - it.from), 0);
  assert.equal(segs, 99, "every segment drawn exactly once, none lost, none doubled");
});

test("a full run conserves the stream exactly: strokes, points, and segments all reconcile", () => {
  const stream = sheetStrokeStream(topo());
  const rep = createReplay(null, { stream });
  let strokes = 0, points = 0, segs = 0, prev = null;
  let r;
  do {
    r = rep.step(113);
    const pens = new Set(r.batch.map((it) => it.pen));
    assert.ok(pens.size <= 1, "a step never mixes pens");
    for (const it of r.batch) {
      const continues = prev && prev.to < prev.line.length - 1;
      if (continues) {
        assert.equal(it.line, prev.line, "an unfinished stroke is what continues");
        assert.equal(it.from, prev.to, "with no gap and no re-draw");
        points += it.to - it.from;
      } else {
        assert.equal(it.from, 0, "a fresh stroke starts at point 0");
        strokes += 1;
        points += it.to - it.from + 1;
      }
      segs += it.to - it.from;
      prev = it;
    }
  } while (!r.done);
  assert.equal(strokes, stream.totals.strokes, "every stream entry drawn once");
  assert.equal(points, stream.totals.points, "every point laid once");
  assert.equal(segs, stream.totals.points - stream.totals.strokes, "segments = points minus one pen-down per stroke");
});

test("progress is monotonic, exact at the end, and done latches", () => {
  const rep = createReplay(topo());
  let last = 0, r;
  do {
    r = rep.step(500);
    assert.ok(r.progress >= last, `progress went backwards: ${r.progress} after ${last}`);
    assert.ok(r.progress <= 1, "progress never overshoots");
    last = r.progress;
  } while (!r.done);
  assert.equal(r.progress, 1, "a finished run reads exactly 1.0 — integer accounting, no float residue");
  const after = rep.step(500);
  assert.equal(after.done, true);
  assert.equal(after.progress, 1);
  assert.equal(after.batch.length, 0, "a finished replay stays finished");
});

test("penChanged fires exactly (pens - 1) times, ascending, and a step pauses at the swap", () => {
  const plot = topo();
  const rep = createReplay(plot);
  const changes = [];
  let r;
  do {
    // A budget far above the whole sheet: the pen boundary must still stop the step.
    r = rep.step(1e9);
    if (r.penChanged != null) changes.push(r.penChanged);
  } while (!r.done);
  assert.deepEqual(changes, [1, 2], "pen 0 opens silently; each later pen announces once");
  assert.equal(changes.length, rep.totals.pens - 1);
});

test("seek(f) then run-to-end reproduces the tail of a full run, point for point", () => {
  const plot = {
    layers: [
      { name: "wash", polylines: [line(6)], weight: 0.6, tone: "support" },  // pen 0, 6 points
      { name: "figure", polylines: [line(9)], weight: 0.5, tone: "ink" },    // pen 1, 9 points
    ],
    meta: { aspect: 1 },
  };
  // Budget 1 makes every step lay exactly one point, so batches align point-for-point and the
  // tail comparison needs no batching arithmetic.
  const runAll = (rep) => {
    const seq = [], pens = [];
    let r;
    do {
      r = rep.step(1);
      if (r.penChanged != null) pens.push(r.penChanged);
      for (const it of r.batch) seq.push([it.line, it.from, it.to, it.pen]);
    } while (!r.done);
    return { seq, pens };
  };
  const full = runAll(createReplay(plot));
  assert.equal(full.seq.length, 15, "budget 1 lays one point per step");
  const half = createReplay(plot);
  half.seek(0.5);   // 7 of 15 points laid: mid-figure? no — 6 wash + 1 figure, pen already swapped
  const tail = runAll(half);
  assert.deepEqual(tail.seq, full.seq.slice(7), "the tail is the same performance");
  assert.deepEqual(tail.pens, [], "the swap before the seek point does not re-announce");
  const early = createReplay(plot);
  early.seek(0.2);  // 3 of 15: still inside the wash, the swap is ahead
  const rest = runAll(early);
  assert.deepEqual(rest.seq, full.seq.slice(3));
  assert.deepEqual(rest.pens, [1], "a swap ahead of the seek point still announces");
});

test("seek clamps to [0,1] and reset restarts the identical performance", () => {
  const plot = { layers: [{ name: "a", polylines: [line(8), line(4)], weight: 0.5, tone: "ink" }], meta: { aspect: 1 } };
  const rep = createReplay(plot);
  rep.seek(2);   // clamped to 1: the sheet is finished
  let r = rep.step(10);
  assert.equal(r.done, true);
  assert.equal(r.progress, 1);
  assert.equal(r.batch.length, 0);
  rep.seek(-0.5);   // clamped to 0: the top
  r = rep.step(5);
  assert.equal(r.batch[0].from, 0);
  assert.equal(r.progress, 5 / 12);
  rep.reset();
  const a = [];
  do { r = rep.step(3); a.push(...r.batch.map((it) => [it.from, it.to])); } while (!r.done);
  rep.reset();
  const b = [];
  do { r = rep.step(3); b.push(...r.batch.map((it) => [it.from, it.to])); } while (!r.done);
  assert.deepEqual(a, b, "reset means the same run again, not a similar one");
});

test("an empty sheet is done immediately, and degenerate one-point lines count as empty", () => {
  for (const plot of [
    { layers: [], meta: {} },
    { layers: [{ name: "dots", polylines: [[[0.5, 0.5]], [[0.2, 0.2]]], weight: 1, tone: "ink" }], meta: {} },
  ]) {
    const s = sheetStrokeStream(plot);
    assert.deepEqual(s.totals, { strokes: 0, points: 0, pens: 0 });
    assert.deepEqual(s.penBoundaries, []);
    const r = createReplay(plot).step(100);
    assert.deepEqual(r, { batch: [], done: true, progress: 1, penChanged: null });
  }
});

test("sheetTransform letterboxes exactly as renderPlotMap did: the rect numbers, not just the shape", () => {
  // A square sheet in a wide canvas centres horizontally.
  const sq = sheetTransform({ meta: { aspect: 1 } }, 1000, 600);
  assert.equal(sq.sw, 600); assert.equal(sq.sh, 600);
  assert.equal(sq.ox, 200); assert.equal(sq.oy, 0);
  assert.deepEqual(sq.rect, { x: 200, y: 0, w: 600, h: 600 });
  assert.equal(sq.tx(0), 200); assert.equal(sq.tx(1), 800);
  assert.equal(sq.ty(0), 0); assert.equal(sq.ty(1), 600);
  // A 4:3 sheet in a 4:3 canvas fills it edge to edge.
  const carto = sheetTransform({ meta: { aspect: 0.75 } }, 800, 600);
  assert.deepEqual(carto.rect, { x: 0, y: 0, w: 800, h: 600 });
  // No meta at all falls back to the cartographic 0.75, same as renderPlotMap always has.
  const bare = sheetTransform({}, 400, 400);
  assert.deepEqual(bare.rect, { x: 0, y: 50, w: 400, h: 300 });
  // A zoomed view maps its centre to the canvas centre and clamps the rect to the canvas.
  const z = sheetTransform({ meta: { aspect: 1 } }, 1000, 1000, { view: { zoom: 2, cx: 0.25, cy: 0.5 } });
  assert.equal(z.tx(0.25), 500, "the view centre lands mid-canvas");
  assert.deepEqual(z.rect, { x: 0, y: 0, w: 1000, h: 1000 });
});

test("the pen model the replay imports is the one the SVG declares", () => {
  assert.equal(penIndexFor({ tone: "support", weight: 2 }), 0, "support is always the fine pen, whatever its weight");
  assert.equal(penIndexFor({ tone: "ink", weight: 0.5 }), 1);
  assert.equal(penIndexFor({ tone: "ink", weight: 1.2 }), 2);
  assert.equal(passesFor({ weight: 0.5 }), 1);
  assert.equal(passesFor({ weight: 0.9 }), 2);
  assert.equal(passesFor({ weight: 1.4 }), 3);
  // And the stream applies it per entry, not per guess.
  const { entries } = sheetStrokeStream(topo());
  const plot = topo();
  for (const e of entries) {
    const src = plot.layers.find((l) => l.name === e.layerName);
    assert.equal(e.pen, penIndexFor(src), `${e.layerName}: stream pen matches the model`);
    assert.ok(e.passIndex < passesFor(src), `${e.layerName}: pass index inside the declared count`);
  }
});

test("sheetGcode: pen-ordered, paused at every pen change, y-flipped, deterministic", async () => {
  const { sheetGcode, sheetStrokeStream } = await import("./plot-replay.js");
  const { composeSheet } = await import("./plot-compose.js");
  const plot = composeSheet("gcode-check", { candidates: 1 });
  const g = sheetGcode(plot, { widthMm: 210 });
  const { totals } = sheetStrokeStream(plot);
  const pauses = (g.match(/^M0 ; pen change/gm) || []).length;
  assert.equal(pauses, totals.pens - 1, "one pause per pen change, none before the first pen");
  assert.ok(!g.includes("NaN"), "no NaN coordinates");
  assert.ok(g.includes("seed gcode-check"), "provenance rides in the file");
  assert.equal(sheetGcode(plot, { widthMm: 210 }), g, "same sheet, same bytes");
  // Y-flip: a sheet-space point near the TOP (small y) must emit a LARGE machine Y.
  const yTop = sheetGcode({ layers: [{ name: "a", polylines: [[[0.5, 0.05], [0.6, 0.05]]], weight: 1, tone: "ink" }], meta: { aspect: 1 } }, { widthMm: 100 });
  assert.ok(yTop.includes("Y95.000"), "top of the sheet is far-Y at the machine");
});

test("the G-code paper and the SVG paper are the same paper", async () => {
  const { sheetGcode } = await import("./plot-replay.js");
  const { plotMapSVG } = await import("./plot-maps.js");
  // aspect 0.75 at 210mm is 157.5mm: unrounded in one file and rounded in the other made the two
  // exports disagree about the sheet by half a millimetre.
  const plot = { layers: [{ name: "a", polylines: [[[0.1, 0.1], [0.9, 0.9]]], weight: 1, tone: "ink" }], meta: { seed: "paper", study: "x", aspect: 0.75, strokes: 1, points: 2 } };
  const svgH = /height="(\d+)mm"/.exec(plotMapSVG(plot, { widthMm: 210 }))[1];
  const gcode = sheetGcode(plot, { widthMm: 210 });
  const gMatch = /sheet 210mm x ([\d.]+)mm/.exec(gcode);
  assert.ok(gMatch, "the g-code declares its paper");
  assert.equal(Number(gMatch[1]), Number(svgH), "both exports declare the same height");
});
