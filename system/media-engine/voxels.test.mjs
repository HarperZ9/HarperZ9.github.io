// node --test system/media-engine/voxels.test.mjs
// The voxels plugin draws the host's voxel scene through voxel-forge exactly as a direct call does,
// pick buffer included; drawNow() draws in the same task; and it draws only frames the host armed.
import test from "node:test";
import assert from "node:assert/strict";

globalThis.document = globalThis.document || { hidden: false, addEventListener() {}, removeEventListener() {} };
globalThis.requestAnimationFrame = globalThis.requestAnimationFrame || ((f) => setTimeout(() => f(performance.now()), 0));
globalThis.cancelAnimationFrame = globalThis.cancelAnimationFrame || ((id) => clearTimeout(id));

const { createEngine } = await import("./core.mjs");
const { voxels } = await import("./plugins/voxels.mjs");
const { buildVoxelScene, renderVoxelScene } = await import("../voxel-forge.js");

// A 2D context that records every call with its arguments, so two draws can be compared.
function recordingCtx() {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...a) => { calls.push(String(k) + JSON.stringify(a)); return { addColorStop() {}, data: new Uint8ClampedArray(4) }; }),
    set: (t, k, v) => { calls.push("set " + String(k) + "=" + JSON.stringify(v)); t[k] = v; return true; },
  });
  return { ctx, calls };
}
function recordingCanvas(w = 240, h = 180) {
  const r = recordingCtx();
  return { width: w, height: h, calls: r.calls, getContext: () => r.ctx };
}

for (const study of ["relic", "terrain"]) {
  test(`the plugin draws the same calls as voxel-forge directly, scene and pick buffer (${study})`, () => {
    const scene = buildVoxelScene("aurora", { study, res: 20 });
    const view = { zoom: 1.6, cx: 0.45, cy: 0.55 };
    const direct = recordingCanvas(), directPick = recordingCtx();
    renderVoxelScene(direct.getContext(), scene, direct.width, direct.height, { pickCtx: directPick.ctx, view });
    const viaPlugin = recordingCanvas(), pluginPick = recordingCtx();
    const engine = createEngine({ reduced: true }).register(voxels);
    const h = engine.mount(viaPlugin, "voxels", {});
    h.instance.setParams({ scene, view, pickCtx: pluginPick.ctx });
    h.drawNow();
    assert.ok(direct.calls.length > 100 && directPick.calls.length > 100);
    assert.deepEqual(viaPlugin.calls, direct.calls);
    assert.deepEqual(pluginPick.calls, directPick.calls);
    h.dispose(); engine.dispose();
  });
}

test("only an armed frame draws: the engine's own still frames leave the canvas alone", () => {
  const scene = buildVoxelScene("aurora", { study: "relic", res: 16 });
  const canvas = recordingCanvas();
  const engine = createEngine({ reduced: true }).register(voxels);
  const h = engine.mount(canvas, "voxels", { params: { scene } });
  h.drawNow();
  assert.equal(canvas.calls.length, 0, "mounting with params arms nothing");
  h.instance.setParams({ scene });
  h.drawNow();
  const n = canvas.calls.length;
  assert.ok(n > 0);
  h.drawNow();
  assert.equal(canvas.calls.length, n, "a second frame without setParams draws nothing");
  h.dispose(); engine.dispose();
});
