// node --test system/media-engine/fractal.test.mjs
// The fractal plugin draws a view exactly as fractal.js does when called directly, draws only frames
// the host armed, and hands a GPU-path failure back to the host instead of throwing into the engine.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));
globalThis.ImageData = globalThis.ImageData || class { constructor(data, w, h) { this.data = data; this.width = w; this.height = h; } };

const { createEngine } = await import("./core.mjs");
const { fractal } = await import("./plugins/fractal.mjs");
const { renderFractal } = await import("../fractal.js?v=20260903a");

// A 2D canvas that keeps the last image put on it.
function imageCanvas(w = 96, h = 72) {
  const c = { width: w, height: h, puts: 0, last: null };
  const ctx = {
    createImageData: (W, H) => new ImageData(new Uint8ClampedArray(W * H * 4), W, H),
    getImageData: (x, y, W, H) => new ImageData(new Uint8ClampedArray(W * H * 4), W, H),
    putImageData: (img) => { c.puts++; c.last = Uint8ClampedArray.from(img.data); },
    fillRect() {}, drawImage() {}, save() {}, restore() {},
  };
  c.getContext = (kind) => (kind === "2d" ? ctx : null);
  return c;
}

const VIEWS = [
  { type: "mandelbrot", cx: -0.5, cy: 0, scale: 3.5, maxIter: 120, palette: "ocean" },
  { type: "julia", cx: 0, cy: 0, scale: 3, maxIter: 90, palette: "ember", jx: -0.8, jy: 0.156 },
  { type: "burningship", cx: -1.75, cy: -0.03, scale: 0.12, maxIter: 150 },
];

for (const view of VIEWS) {
  test(`the CPU path draws what renderFractal draws (${view.type})`, () => {
    const direct = imageCanvas();
    renderFractal(direct, view);
    const via = imageCanvas();
    const engine = createEngine({ reduced: true }).register(fractal);
    const h = engine.mount(via, "fractal", { params: { view, path: "cpu" } });
    assert.equal(via.puts, 0, "mounting arms nothing");
    h.instance.setParams({ view, path: "cpu" });
    h.drawNow();
    assert.equal(via.puts, 1);
    assert.ok(direct.last && direct.last.some((v) => v !== 0));
    assert.deepEqual(via.last, direct.last);
    h.drawNow();
    assert.equal(via.puts, 1, "an unarmed frame draws nothing");
    assert.equal(h.instance.lastError, null);
    h.dispose(); engine.dispose();
  });
}

test("a GPU-path failure is handed back, not thrown", () => {
  const canvas = imageCanvas();   // no WebGL context here, so renderFractalGL throws
  const engine = createEngine({ reduced: true }).register(fractal);
  const h = engine.mount(canvas, "fractal", {});
  h.instance.setParams({ view: VIEWS[0], path: "gl" });
  assert.doesNotThrow(() => h.drawNow());
  assert.ok(h.instance.lastError, "the host sees the failure and falls back to the CPU");
  assert.equal(h.instance.backend, "webgl");
  h.dispose(); engine.dispose();
});
