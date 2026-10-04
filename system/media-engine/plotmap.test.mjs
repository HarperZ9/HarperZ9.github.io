// node --test system/media-engine/plotmap.test.mjs
// The plotmap plugin draws the host's plot sheet through plot-maps exactly as a direct call does,
// and drawNow() draws in the same task so the Studio perceives the frame it just drew.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine } = await import("./core.mjs");
const { plotmap } = await import("./plugins/plotmap.mjs");
const { buildPlotMap, renderPlotMap } = await import("../plot-maps.js");

// A 2D context that records every call with its arguments, so two draws can be compared.
function recordingCanvas(w = 240, h = 180) {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(String(k) + JSON.stringify(a)); return { addColorStop() {} }; }),
    set: (t, k, v) => { calls.push("set " + String(k) + "=" + JSON.stringify(v)); t[k] = v; return true; },
  });
  return { width: w, height: h, calls, getContext: () => ctx };
}

test("the plugin draws the same calls as plot-maps directly, and returns the same content rect", () => {
  const sheet = buildPlotMap("aurora", { study: "basin", levels: 10, density: 1, res: 120 });
  const direct = recordingCanvas();
  const rectDirect = renderPlotMap(direct.getContext(), sheet, direct.width, direct.height, {}, { view: undefined });
  const viaPlugin = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(plotmap);
  const h = engine.mount(viaPlugin, "plotmap", { params: { sheet } });
  h.drawNow();
  assert.deepEqual(viaPlugin.calls, direct.calls);
  assert.deepEqual(h.instance.lastRect, rectDirect);
  h.dispose(); engine.dispose();
});

test("no sheet, no drawing", () => {
  const canvas = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(plotmap);
  const h = engine.mount(canvas, "plotmap", {});
  h.drawNow();
  assert.equal(canvas.calls.length, 0);
  h.dispose(); engine.dispose();
});
