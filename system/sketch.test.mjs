// sketch.test.mjs — the freehand source: capture, live symmetry, and the shelf round-trip.
// Run: node --test system/sketch.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { createSketch } from "./sketch.js";

const M = 0.04;

// Feed a whole stroke through the pointer protocol.
function draw(sk, pts) {
  sk.beginStroke(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) sk.extendStroke(pts[i][0], pts[i][1]);
  return sk.endStroke();
}

// A stroke with real movement: a diagonal at a spacing safely above the collapse radius.
const diagonal = (n = 30) => Array.from({ length: n }, (_, i) => [0.2 + i * 0.01, 0.3 + i * 0.008]);

test("capture collapses pointer chatter but keeps the gesture and its endpoints", () => {
  const sk = createSketch();
  // A slow passage: 200 samples inside 0.05 of travel is event rate, not drawing.
  const chatter = Array.from({ length: 200 }, (_, i) => [0.2 + i * 0.00025, 0.5]);
  const stroke = draw(sk, chatter);
  assert.ok(stroke, "a real gesture survives resampling");
  assert.ok(stroke.length < 40, `near-duplicate points collapse (200 in, ${stroke.length} kept)`);
  assert.ok(stroke.length >= 2, "but the gesture itself is kept");
  // Endpoints pinned: smoothing must not pull the stroke off the touch points.
  assert.deepEqual(stroke[0], [0.2, 0.5], "start stays where the pen touched");
  assert.equal(stroke[stroke.length - 1][1], 0.5, "end stays on the drawn line");
});

test("a tap is not a stroke: under 2 resampled points drops", () => {
  const sk = createSketch();
  sk.beginStroke(0.5, 0.5);
  sk.extendStroke(0.5004, 0.5);       // all inside the collapse radius
  sk.extendStroke(0.5008, 0.5001);
  assert.equal(sk.endStroke(), null, "the tap is dropped");
  assert.equal(sk.strokeCount(), 0);
  assert.ok(sk.isEmpty());
});

test("extendStroke without beginStroke is hover, not drawing", () => {
  const sk = createSketch();
  sk.extendStroke(0.3, 0.3);
  sk.extendStroke(0.6, 0.6);
  assert.equal(sk.endStroke(), null);
  assert.equal(sk.strokeCount(), 0);
});

test("symmetry expansion counts: mirror 2, radial k copies, kaleido 2k", () => {
  const sk = createSketch();
  const stroke = draw(sk, diagonal());
  assert.equal(sk.expandStroke(stroke).length, 1, "none: the stroke alone");
  sk.setSymmetry("mirror");
  const mirrored = sk.expandStroke(stroke);
  assert.equal(mirrored.length, 2, "mirror: stroke plus its reflection");
  assert.ok(Math.abs(mirrored[1][0][0] - (1 - stroke[0][0])) < 1e-9, "reflected across the vertical centre");
  sk.setSymmetry("radial", 6);
  assert.equal(sk.expandStroke(stroke).length, 6, "radial k=6: six copies");
  sk.setSymmetry("kaleido", 6);
  assert.equal(sk.expandStroke(stroke).length, 12, "kaleido k=6: twelve copies");
});

test("changing symmetry AFTER drawing re-expands retroactively — the toy", () => {
  const sk = createSketch();
  draw(sk, diagonal());
  draw(sk, diagonal().map(([x, y]) => [x, y + 0.2]));
  assert.equal(sk.expandAll().length, 2, "drawn plain: two strokes");
  sk.setSymmetry("radial", 4);
  assert.equal(sk.expandAll().length, 8, "slide to radial 4: the same drawing, eight strokes");
  sk.setSymmetry("kaleido", 9);
  assert.equal(sk.expandAll().length, 36, "slide again: no redraw needed, 2*2*9");
  assert.equal(sk.strokeCount(), 2, "the raw drawing never changed");
});

test("k clamps to 2..12 and an unknown mode is refused, not guessed", () => {
  const sk = createSketch();
  assert.equal(sk.setSymmetry("radial", 99), true);
  assert.equal(sk.getSymmetry().k, 12, "k clamps high");
  assert.equal(sk.setSymmetry("radial", 0), true);
  assert.equal(sk.getSymmetry().k, 2, "k clamps low");
  assert.equal(sk.setSymmetry("spiral", 4), false, "unknown mode refused");
  assert.equal(sk.getSymmetry().mode, "radial", "and the mode is unchanged");
});

test("undo drops the last stroke; clear empties the sheet", () => {
  const sk = createSketch();
  draw(sk, diagonal());
  draw(sk, diagonal().map(([x, y]) => [y, x]));
  assert.equal(sk.strokeCount(), 2);
  assert.equal(sk.undo(), true);
  assert.equal(sk.strokeCount(), 1);
  sk.clear();
  assert.ok(sk.isEmpty());
  assert.equal(sk.undo(), false, "undo on an empty sheet says so");
});

test("toSheet is deterministic: the same drawing serializes to the same sheet", () => {
  const make = () => {
    const sk = createSketch();
    draw(sk, diagonal());
    draw(sk, diagonal().map(([x, y]) => [x + 0.1, 0.9 - y]));
    sk.setSymmetry("kaleido", 5);
    return sk;
  };
  const a = make().toSheet({ register: "worked" });
  const b = make().toSheet({ register: "worked" });
  assert.equal(JSON.stringify(a.layers), JSON.stringify(b.layers), "byte-identical layers");
  assert.equal(a.meta.geometryHash, b.meta.geometryHash);
  const sk = make();
  assert.equal(
    JSON.stringify(sk.toSheet({ register: "worked" }).layers),
    JSON.stringify(sk.toSheet({ register: "worked" }).layers),
    "and calling twice on one sketch does not advance any hidden rng state",
  );
});

test("geometryHash survives the shelf round-trip and ignores the symmetry view", () => {
  const sk = createSketch();
  draw(sk, diagonal(40));
  draw(sk, diagonal(25).map(([x, y]) => [0.9 - x, y + 0.15]));
  sk.setSymmetry("radial", 7);
  const hash = sk.toSheet().meta.geometryHash;
  const twin = createSketch();
  assert.equal(twin.restore(sk.serialize()), true, "restore accepts its own serialization");
  assert.equal(twin.toSheet().meta.geometryHash, hash, "the restored twin is the same drawing");
  assert.equal(twin.getSymmetry().mode, "radial");
  assert.equal(twin.getSymmetry().k, 7);
  sk.setSymmetry("mirror");
  assert.equal(sk.toSheet().meta.geometryHash, hash, "symmetry is a view, not the drawing");
});

test("restore refuses an unknown version rather than guessing", () => {
  const sk = createSketch();
  draw(sk, diagonal());
  const before = sk.geometryHash();
  assert.equal(sk.restore({ v: 2, strokes: [] }), false, "future version refused");
  assert.equal(sk.restore(null), false);
  assert.equal(sk.restore({ v: 1, strokes: [[[0.1, 0.1], ["bad", 0.2]]] }), false, "malformed point refused");
  assert.equal(sk.geometryHash(), before, "a refused restore leaves the sketch untouched");
});

test("guides are support register, dashed, and inside the margin", () => {
  const sk = createSketch();
  assert.deepEqual(sk.guideLayers("none"), [], "no guide, no layer");
  for (const kind of ["iso", "grid", "zigzag"]) {
    const layers = sk.guideLayers(kind);
    assert.equal(layers.length, 1, `${kind}: one underlay layer`);
    assert.equal(layers[0].tone, "support", `${kind}: support tone`);
    assert.ok(layers[0].polylines.length > 40, `${kind}: dashing broke the lines into many runs`);
    for (const line of layers[0].polylines) {
      for (const [x, y] of line) {
        assert.ok(x >= M - 1e-9 && x <= 1 - M + 1e-9, `${kind}: x ${x} inside the margin`);
        assert.ok(y >= M - 1e-9 && y <= 1 - M + 1e-9, `${kind}: y ${y} inside the margin`);
      }
    }
  }
});

test("every sheet point stays inside the unit square, symmetry and register included", () => {
  const sk = createSketch({ guide: "iso" });
  // Strokes near the edge, so the rotated copies genuinely leave the sheet before clipping.
  draw(sk, diagonal().map(([x, y]) => [x + 0.55, y]));
  draw(sk, diagonal().map(([x, y]) => [x, y + 0.6]));
  sk.setSymmetry("kaleido", 8);
  const sheet = sk.toSheet({ register: "laboured", includeGuides: true });
  for (const layer of sheet.layers) {
    for (const line of layer.polylines) {
      for (const [x, y] of line) {
        assert.ok(x >= -1e-6 && x <= 1 + 1e-6 && y >= -1e-6 && y <= 1 + 1e-6,
          `${layer.name}: (${x}, ${y}) escapes the sheet`);
      }
    }
  }
  assert.ok(sheet.layers.some((l) => l.name === "guide-iso"), "includeGuides carries the underlay");
  assert.ok(sheet.layers.some((l) => l.name === "hand"), "and the drawing");
});

test("an empty sketch produces a frame-only sheet that says so", () => {
  const sheet = createSketch().toSheet();
  assert.equal(sheet.layers.length, 1, "frame only");
  assert.equal(sheet.layers[0].name, "frame");
  assert.equal(sheet.layers[0].weight, 1.5);
  assert.equal(sheet.meta.kind, "sketch");
  assert.equal(sheet.meta.aspect, 1);
  assert.equal(sheet.meta.strokes, 0, "strokes count the drawing, not the furniture");
  assert.equal(sheet.meta.points, 0);
});

test("the register is applied by hand: worked lays more line than clean", () => {
  const make = () => {
    const sk = createSketch();
    draw(sk, diagonal());
    sk.setSymmetry("radial", 3);
    return sk;
  };
  const clean = make().toSheet({ register: "clean" });
  const worked = make().toSheet({ register: "worked" });
  const handOf = (s) => s.layers.find((l) => l.name === "hand");
  assert.ok(handOf(worked).polylines.length > handOf(clean).polylines.length,
    "worked multi-passes every copy");
  assert.equal(worked.meta.register, "worked", "and the sheet records which hand drew it");
  assert.equal(clean.meta.strokes, 1, "raw stroke count is untouched by register or symmetry");
});

test("the fold survives a round-trip taken under a symmetry that does not use it", () => {
  // The defect: setSymmetry assigned k only for radial/kaleido, so a drawing saved under "none"
  // or "mirror" lost its fold — and came back at the default the moment symmetry was turned on.
  const a = createSketch();
  a.setSymmetry("radial", 9);
  a.beginStroke(0.3, 0.3); a.extendStroke(0.6, 0.4); a.extendStroke(0.7, 0.6); a.endStroke();
  a.setSymmetry("none");
  assert.equal(a.getSymmetry().k, 9, "the fold is remembered even while unused");
  const b = createSketch();
  assert.ok(b.restore(a.serialize()), "restores");
  assert.equal(b.getSymmetry().k, 9, "and survives serialize/restore");
  b.setSymmetry("kaleido");
  assert.equal(b.expandStroke([[0.2, 0.2], [0.4, 0.4]]).length, 18, "turning symmetry on uses the remembered fold, not the default");
});
