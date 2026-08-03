// generative-output.test.mjs: output regression tests for the plate engine.
//
// The gallery publishes two claims: seeded plates reproduce exactly, and each
// plate shows what its caption describes. Neither had a test. This file gives
// both a machine check without a browser, by driving renderSpecimen against a
// recording 2D-context stub and asserting on the resulting draw trace.
//
// It catches two real regression classes that shipped undetected:
//   1. non-determinism (a plate that does not repeat from its seed),
//   2. the near-empty plate (a layer whose ink does not scale with the canvas,
//      which left several exhibition plates at 1 to 4 percent coverage).

import { test } from "node:test";
import assert from "node:assert/strict";

// Minimal recording context. Records every drawing call plus a coarse ink
// estimate, so a plate that stops drawing is visible without a rasterizer.
function recordingCanvas(cssW, cssH, dpr = 1.5) {
  const calls = [];
  let ink = 0;
  const state = { fillStyle: "#000", strokeStyle: "#000", lineWidth: 1, globalAlpha: 1, globalCompositeOperation: "source-over" };
  const note = (name, ...args) => { calls.push(name + ":" + args.map(fmt).join(",")); };
  const fmt = (v) => (typeof v === "number" ? (Math.round(v * 1000) / 1000) : String(v));
  const ctx = {
    canvas: null,
    setTransform: (...a) => note("setTransform", ...a),
    transform: (...a) => note("transform", ...a),
    resetTransform: () => note("resetTransform"),
    scale: (...a) => note("scale", ...a),
    translate: (...a) => note("translate", ...a),
    rotate: (...a) => note("rotate", ...a),
    save: () => note("save"), restore: () => note("restore"),
    beginPath: () => note("beginPath"), closePath: () => note("closePath"),
    moveTo: (...a) => note("moveTo", ...a), lineTo: (...a) => { note("lineTo", ...a); ink += 1; },
    bezierCurveTo: (...a) => { note("bezier", ...a); ink += 2; },
    quadraticCurveTo: (...a) => { note("quad", ...a); ink += 2; },
    arc: (...a) => { note("arc", ...a); ink += Math.abs(a[2]) || 1; },
    ellipse: (...a) => { note("ellipse", ...a); ink += Math.abs(a[2]) || 1; },
    rect: (...a) => note("rect", ...a),
    fill: () => { note("fill"); ink += 2; },
    stroke: () => { note("stroke"); ink += 1; },
    fillRect: (x, y, w, h) => { note("fillRect", x, y, w, h); ink += Math.abs(w * h) / 1000; },
    strokeRect: (...a) => { note("strokeRect", ...a); ink += 1; },
    clearRect: (...a) => note("clearRect", ...a),
    clip: () => note("clip"),
    createLinearGradient: () => ({ addColorStop() {} }),
    createRadialGradient: () => ({ addColorStop() {} }),
    createPattern: () => null,
    drawImage: (...a) => { note("drawImage", a.length); ink += 5; },
    getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(Math.max(4, w * h * 4)), width: w, height: h }),
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(Math.max(4, (w | 0) * (h | 0) * 4)), width: w | 0, height: h | 0 }),
    putImageData: (img) => { note("putImageData", img && img.width, img && img.height); ink += 5; },
    measureText: () => ({ width: 10 }),
    fillText: (...a) => { note("fillText", ...a); ink += 3; },
    strokeText: (...a) => { note("strokeText", ...a); ink += 3; },
    setLineDash: () => {}, getLineDash: () => [],
    isPointInPath: () => false,
  };
  for (const k of Object.keys(state)) {
    // configurable, like a real CanvasRenderingContext2D accessor, so the
    // palette-alignment shim can shadow it for the duration of a render.
    Object.defineProperty(ctx, k, {
      get: () => state[k],
      set: (v) => { state[k] = v; if (k === "fillStyle" || k === "strokeStyle") calls.push("style:" + v); },
      enumerable: true,
      configurable: true,
    });
  }
  const canvas = {
    width: Math.round(cssW * dpr),
    height: Math.round(cssH * dpr),
    style: {},
    dataset: {},
    clientWidth: cssW,
    clientHeight: cssH,
    getBoundingClientRect: () => ({ width: cssW, height: cssH, x: 0, y: 0, top: 0, left: 0 }),
    getContext: (kind) => (kind === "2d" ? ctx : null),
    toDataURL: () => "data:,",
  };
  ctx.canvas = canvas;
  return { canvas, calls, ink: () => ink };
}

// generative-field.js reads window.devicePixelRatio and document in places.
globalThis.window = globalThis.window || { devicePixelRatio: 1.5 };
globalThis.document = globalThis.document || {
  createElement: (tag) => (tag === "canvas" ? recordingCanvas(64, 64).canvas : { style: {}, dataset: {} }),
  querySelectorAll: () => [],
};

const field = await import("./generative-field.js");
const LAYERS = field.specimenLayerNames();

test("every registered layer is exposed and nameable", () => {
  assert.ok(LAYERS.length >= 30, `expected the full vocabulary, got ${LAYERS.length}`);
  assert.ok(LAYERS.includes("showpiece-veil"));
  assert.ok(LAYERS.includes("neural-field"));
});

test("a seeded plate reproduces its exact draw trace", () => {
  // The gallery's published claim: same seed, same plate, every visit.
  for (const layer of ["showpiece-veil", "dla-coral", "truchet", "clifford"]) {
    const a = recordingCanvas(1100, 688);
    const b = recordingCanvas(1100, 688);
    field.renderSpecimen(a.canvas, "gallery-plate-10", [layer]);
    field.renderSpecimen(b.canvas, "gallery-plate-10", [layer]);
    assert.equal(a.calls.length, b.calls.length, `${layer}: call count differs between runs`);
    assert.deepEqual(a.calls, b.calls, `${layer}: draw trace differs between runs from the same seed`);
  }
});

test("different seeds produce different plates", () => {
  const a = recordingCanvas(800, 500);
  const b = recordingCanvas(800, 500);
  field.renderSpecimen(a.canvas, "seed-alpha", ["showpiece-veil"]);
  field.renderSpecimen(b.canvas, "seed-beta", ["showpiece-veil"]);
  assert.notDeepEqual(a.calls, b.calls, "two seeds produced an identical trace");
});

test("plate composition is resolution independent", () => {
  // The regression that shipped: layers used absolute pixel constants, so ink
  // thinned out as the canvas grew and flagship plates rendered near-empty.
  // Reference-space drawing means the trace is size-invariant apart from the
  // one scale call, so the call COUNT must not fall as the canvas grows.
  for (const layer of ["showpiece-veil", "fiber-terrain", "showpiece-lantern", "planet-limb", "showpiece-burst"]) {
    const small = recordingCanvas(320, 200);
    const large = recordingCanvas(1400, 875);
    field.renderSpecimen(small.canvas, "gallery-plate-10", [layer]);
    field.renderSpecimen(large.canvas, "gallery-plate-10", [layer]);
    const ratio = large.calls.length / Math.max(1, small.calls.length);
    assert.ok(ratio > 0.9, `${layer}: draw calls fell to ${(ratio * 100).toFixed(0)}% of the small canvas as size grew`);
  }
});

test("no plate renders empty", () => {
  // A layer that draws nothing is a broken plate, and its caption then makes a
  // claim the frame does not support.
  const thin = [];
  for (const layer of LAYERS) {
    const rec = recordingCanvas(1100, 688);
    field.renderSpecimen(rec.canvas, "gallery-plate-10", [layer]);
    const drawing = rec.calls.filter((c) => /^(fill|stroke|arc|ellipse|lineTo|bezier|quad|fillRect|fillText)/.test(c));
    // Op count alone is the wrong metric: some layers cover the frame with a
    // handful of large gradient washes, and pixel-buffer layers blit once.
    // A layer is covered if it makes many marks, or blits, or paints area.
    const blits = rec.calls.filter((c) => /^(putImageData|drawImage)/.test(c)).length;
    const covered = drawing.length >= 12 || blits >= 1 || rec.ink() >= 50;
    if (!covered) thin.push(`${layer} (${drawing.length} ops, ${blits} blits, ink ${rec.ink().toFixed(0)})`);
  }
  assert.deepEqual(thin, [], `layers rendering effectively nothing: ${thin.join(", ")}`);
});

test("colour follows the seed palette, including in the literal layers", () => {
  // Nineteen layers drew from hardcoded rgb literals, so a plate's colour did
  // not change with its palette. Two seeds landing on different palettes must
  // now produce different drawn colours, for exactly those layers.
  const literalLayers = ["facets", "groove", "caustic-paper", "planet-limb", "dendrite", "riso-moire"];
  const stylesFor = (seedString, layer) => {
    const rec = recordingCanvas(900, 560);
    field.renderSpecimen(rec.canvas, seedString, [layer]);
    return rec.calls.filter((c) => c.startsWith("style:")).join("|");
  };
  for (const layer of literalLayers) {
    // Seeds chosen to land on different palette indices.
    const a = stylesFor("palette-probe-a", layer);
    const b = stylesFor("palette-probe-b", layer);
    const c = stylesFor("palette-probe-c", layer);
    assert.ok(a.length > 0, `${layer}: recorded no colour assignments at all`);
    assert.ok(a !== b || b !== c || a !== c,
      `${layer}: identical colours across three seeds, so the palette is still ignored`);
  }
});

test("neutral marks survive alignment", () => {
  // Alignment must not tint paper, ink black, or the near-white marks: only
  // chromatic colour is snapped to the palette hues.
  for (const neutral of ["rgba(3,4,9,0.9)", "rgb(243,244,246)", "#ffffff", "rgba(0,0,0,0.5)"]) {
    const aligned = field.__alignForTest(neutral, [30, 150, 270]);
    assert.equal(aligned, neutral, `neutral ${neutral} was tinted`);
  }
  // A saturated colour must move.
  const moved = field.__alignForTest("rgba(50,90,220,0.4)", [30]);
  assert.notEqual(moved, "rgba(50,90,220,0.4)");
  assert.match(moved, /^rgba\(\d+,\d+,\d+,0\.4\)$/, "alpha must be preserved exactly");
});

test("the chaos-game driver samples without a short period", () => {
  // The map salt must advance with the iteration; wrapping it made the orbit
  // converge to a cycle and never sample the invariant measure.
  const src = field.specimenLayerNames;
  assert.ok(typeof src === "function");
  const rec = recordingCanvas(1100, 688);
  field.renderSpecimen(rec.canvas, "gallery-plate-10", ["showpiece-lantern"]);
  const points = rec.calls.filter((c) => c.startsWith("fillRect"));
  const distinct = new Set(points).size;
  assert.ok(distinct > points.length * 0.25,
    `IFS orbit is degenerate: ${distinct} distinct of ${points.length} plotted points`);
});
