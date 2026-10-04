// node --test system/media-engine/poster.test.mjs
// The Studio's Poster source draws through the "poster" engine plugin: the plugin's frame is
// renderPoster's frame call for call, and it draws only the frames its host armed.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine } = await import("./core.mjs");
const { poster } = await import("./plugins/poster.mjs");
const { renderPoster, defaultPosterState } = await import("../poster.js");

// A canvas whose 2D context records every call and property write; measureText answers by length.
function recordingCanvas() {
  const log = [];
  const ctx = new Proxy({}, {
    get: (t, k) => {
      if (k in t) return t[k];
      if (k === "measureText") return (s) => { log.push(["measureText", s]); return { width: String(s).length * 10 }; };
      return (...a) => { log.push([String(k), ...a]); return { addColorStop() {} }; };
    },
    set: (t, k, v) => { log.push(["=" + String(k), v]); t[k] = v; return true; },
  });
  const canvas = { log, getContext: () => ctx };
  let w = 0, h = 0;
  Object.defineProperty(canvas, "width", { get: () => w, set: (v) => { log.push(["=width", v]); w = v; } });
  Object.defineProperty(canvas, "height", { get: () => h, set: (v) => { log.push(["=height", v]); h = v; } });
  return canvas;
}
const deps = { renderSpecimen: (cv, seed, layers) => cv.getContext("2d").fillRect(seed.length, layers.length, 1, 1) };

test("the plugin's frame is renderPoster's frame, call for call", () => {
  for (const format of ["a3", "square", "wide"]) {
    const state = { ...defaultPosterState("aurora"), format };
    const a = recordingCanvas(), b = recordingCanvas();
    const engine = createEngine({ reduced: true }).register(poster);
    const h = engine.mount(a, "poster", {});
    h.instance.setParams({ state, deps });
    h.drawNow();
    const direct = renderPoster(b, state, deps);
    assert.deepEqual(a.log, b.log, format);
    assert.deepEqual(h.instance.lastResult, direct, format);
    h.dispose(); engine.dispose();
  }
});

test("only armed frames draw: engine still frames leave the shared canvas alone", () => {
  const c = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(poster);
  const h = engine.mount(c, "poster", {});
  h.drawNow();
  assert.equal(c.log.length, 0);
  h.instance.setParams({ state: defaultPosterState("aurora"), deps });
  h.drawNow();
  const n = c.log.length;
  assert.ok(n > 0);
  h.drawNow();
  assert.equal(c.log.length, n);
  h.dispose(); engine.dispose();
});
