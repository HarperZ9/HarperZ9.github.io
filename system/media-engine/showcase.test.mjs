// node --test system/media-engine/showcase.test.mjs
// The showcase plugin owns an orbit scene that draws a view exactly as a directly made scene does,
// and draws only the frames its host armed.
import test from "node:test";
import assert from "node:assert/strict";

// A 2D canvas whose context records every call with its arguments.
function recordingCanvas(w = 360, h = 360) {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(String(k) + JSON.stringify(a, (key, v) => (v && v.calls ? "[canvas]" : v))); return { width: 10 }; }),
    set: (t, k, v) => { calls.push("set " + String(k) + "=" + JSON.stringify(v)); t[k] = v; return true; },
  });
  return { width: w, height: h, calls, getContext: () => ctx };
}
globalThis.document = { hidden: false, addEventListener() {}, removeEventListener() {}, createElement: () => recordingCanvas() };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine } = await import("./core.mjs");
const { showcase } = await import("./plugins/showcase.mjs");
const { makeScene } = await import("../showcase/orbit-render.js?v=20260925-studio-plate");

const STATES = Array.from({ length: 40 }, (_, i) => ({ x: Math.cos(i / 6), y: Math.sin(i / 5) * 0.7 }));
const VIEW = { groundAlpha: 0, seedLine: "seed 1 kepler", icLine: "ic", note: "n",
  law: { text: "H = 0.5 v^2 - 1/r", series: STATES.map((s) => s.x * 1e-6 + 1) }, refusal: { series: STATES.map((s, i) => 1 - i * 0.01) } };

function drive(scene) {
  scene.setTrajectory(STATES, ["x", "y"]);
  scene.reveal(25);
}

test("the plugin's scene draws a view call for call as a scene made directly", () => {
  const direct = recordingCanvas();
  const ds = makeScene(direct);
  drive(ds);
  ds.draw(VIEW);
  const via = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(showcase);
  const h = engine.mount(via, "showcase", {});
  drive(h.instance.scene);
  h.instance.setParams({ view: VIEW });
  h.drawNow();
  assert.ok(direct.calls.length > 20);
  assert.deepEqual(via.calls, direct.calls);
  h.dispose(); engine.dispose();
});

test("only an armed frame draws", () => {
  const canvas = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(showcase);
  const h = engine.mount(canvas, "showcase", { params: { view: VIEW } });
  h.drawNow();
  assert.equal(canvas.calls.length, 0, "mounting with a view arms nothing");
  h.instance.setParams({ view: VIEW });
  h.drawNow();
  const n = canvas.calls.length;
  assert.ok(n > 0);
  h.drawNow();
  assert.equal(canvas.calls.length, n);
  h.dispose(); engine.dispose();
});
