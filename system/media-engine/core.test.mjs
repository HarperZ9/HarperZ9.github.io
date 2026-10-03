// node --test system/media-engine/core.test.mjs
// The engine core with the browser globals stubbed: receipts and the reference backend path.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine, registerReferenceBackend, REFERENCE_BACKEND, sceneKindOf } = await import("./core.mjs");

const pixels = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
const flat = (backends) => ({
  id: "flat-" + backends.join("-"), version: "1.0.0", backends,
  create() { return { frame() {}, readPixels: () => pixels, dispose() {} }; },
});

test("a 3D-capable plugin gets a reconcile result against the registered reference backend", async () => {
  const engine = createEngine({ reduced: true });
  const plugin = flat(["webgl2", REFERENCE_BACKEND]);
  const h = engine.register(plugin).mount({}, plugin.id, { seed: "s" });
  const before = await h.receipt(1, { reference: true });
  assert.equal(before.referenceBackend, "wasm-raw");
  assert.equal(before.reconcile.verdict, "UNVERIFIABLE");
  assert.match(before.reconcile.reason, /not registered/);
  // A fast path registered without exact: true is refused as a reference.
  registerReferenceBackend("wasm-raw", { render: async () => pixels });
  const fast = await h.receipt(1, { reference: true });
  assert.equal(fast.reconcile.verdict, "UNVERIFIABLE");
  assert.match(fast.reconcile.reason, /not an exact path/);
  registerReferenceBackend("wasm-raw", { exact: true, render: async () => pixels });
  const after = await h.receipt(1, { reference: true });
  assert.equal(after.reconcile.verdict, "MATCH");
  assert.equal(after.reconcile.kind, "raster3d");
  assert.equal(after.reconcile.rmse, 0);
  h.dispose(); engine.dispose();
});

test("a 2D plugin never asks for the rasterizer reference", async () => {
  const engine = createEngine({ reduced: true });
  const plugin = flat(["canvas2d"]);
  const h = engine.register(plugin).mount({}, plugin.id, {});
  const r = await h.receipt(1, { reference: true });
  assert.equal(r.referenceBackend, null);
  assert.equal(r.reconcile.reason, "no reference backend");
  h.dispose(); engine.dispose();
});

test("the scene kind picks the reference, not the plugin's backend list", async () => {
  registerReferenceBackend("wasm-raw", { exact: true, render: async () => pixels });
  const engine = createEngine({ reduced: true });
  // A WebGL2-only plugin that declares a 3D rasterized scene is still checked against wasm-raw.
  const gl = { ...flat(["webgl2"]), id: "gl-scene", sceneKind: "raster3d" };
  const h = engine.register(gl).mount({}, gl.id, {});
  const r = await h.receipt(1, { reference: true });
  assert.equal(r.referenceBackend, "wasm-raw");
  assert.equal(r.reconcile.verdict, "MATCH");
  // A kind with no registered reference says so.
  const snd = { ...flat(["webaudio"]), id: "tone", sceneKind: "sound" };
  const h2 = engine.register(snd).mount({}, snd.id, {});
  const r2 = await h2.receipt(1, { reference: true });
  assert.equal(r2.referenceBackend, null);
  assert.equal(r2.reconcile.verdict, "UNVERIFIABLE");
  assert.match(r2.reconcile.reason, /no reference renderer for scene kind sound/);
  assert.equal(sceneKindOf(flat(["wasm-raw"])), "raster3d");
  assert.equal(sceneKindOf(flat(["canvas2d"])), null);
  h.dispose(); h2.dispose(); engine.dispose();
});
