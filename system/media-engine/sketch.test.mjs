// node --test system/media-engine/sketch.test.mjs
// The sketch plugin draws the host's sketch through plot-maps, guides first, and drawNow() draws in
// the same task so the Studio can perceive the frame it just drew.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine } = await import("./core.mjs");
const { sketch } = await import("./plugins/sketch.mjs");
const { createSketch } = await import("../sketch.js");

// A 2D context that accepts every call and records the method names.
function recordingCanvas(w = 200, h = 200) {
  const calls = [];
  const ctx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(String(k)); return { addColorStop() {} }; }), set: (t, k, v) => { t[k] = v; return true; } });
  return { width: w, height: h, calls, getContext: () => ctx };
}

test("drawNow draws the sketch synchronously and exposes the sheet it drew", () => {
  const s = createSketch();
  s.beginStroke(0.2, 0.2); s.extendStroke(0.5, 0.4); s.extendStroke(0.8, 0.8); s.endStroke();
  const canvas = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(sketch);
  const h = engine.mount(canvas, "sketch", { params: { sketch: s } });
  assert.equal(h.instance.lastSheet, null);
  h.drawNow();
  const sheet = h.instance.lastSheet;
  assert.ok(sheet && sheet.meta.strokes === 1, "the sheet of the one stroke");
  assert.equal(sheet.meta.geometryHash, s.toSheet({ register: "drawn" }).meta.geometryHash);
  assert.ok(canvas.calls.length > 0, "plot-maps drew on the canvas");
  assert.equal(h.stats.frames, 1);
  h.dispose(); engine.dispose();
});

test("no sketch, no drawing", () => {
  const canvas = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(sketch);
  const h = engine.mount(canvas, "sketch", {});
  h.drawNow();
  assert.equal(canvas.calls.length, 0);
  h.dispose(); engine.dispose();
});
