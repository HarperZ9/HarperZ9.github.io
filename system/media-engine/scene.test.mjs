// node --test system/media-engine/scene.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createSceneRequest, toRawParams, fromRawChannels, RAW_PARAMS_KEYS } from "./scene.mjs";
import { reconcile, frameReceipt } from "./receipt.mjs";

// raw-native v0.2.0 docs/examples/high-channels.json, camera and frame blocks only.
const HIGH = { schema: "raw-channels/1", frame: { width: 512, height: 512 }, camera: { eye: [0, 9, 3], target: [0, 0.5, 0], up: [0, 1, 0], fovy: 0.9, aspect: 1, prev: null } };

test("one scene request round-trips through raw-native's params and channels shapes", () => {
  const doc = fromRawChannels(HIGH);
  assert.equal(doc.kind, "media.scene");
  const params = toRawParams(doc);
  assert.deepEqual(params, { width: 512, height: 512, eye: [0, 9, 3], target: [0, 0.5, 0], up: [0, 1, 0], fovy: 0.9 });
  assert.ok(Object.keys(params).every((k) => RAW_PARAMS_KEYS.includes(k)));
  const moving = toRawParams(createSceneRequest({ eye: [4, 4, 6] }, { prev: { eye: [4.3, 4, 5.7] } }));
  assert.deepEqual(moving.prev_eye, [4.3, 4, 5.7]);
  assert.throws(() => createSceneRequest({ eye: [1, 2] }), /three finite numbers/);
});

test("reconcile reports RMSE and max error, and refuses to compare what it cannot", () => {
  const a = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);
  assert.equal(reconcile(a, a).verdict, "MATCH");
  assert.equal(reconcile(a, a).rmse, 0);
  const b = new Uint8Array([51, 0, 0, 255, 255, 255, 255, 255]);
  const r = reconcile(a, b);
  assert.equal(r.verdict, "DRIFT");
  assert.equal(r.maxError, 0.2);
  assert.equal(reconcile(a, new Uint8Array(4)).verdict, "UNVERIFIABLE", "different sizes");
  assert.equal(reconcile(a, null).verdict, "UNVERIFIABLE");
});

test("a receipt names its reference backend and says plainly when there was none", async () => {
  const px = new Uint8Array([1, 2, 3, 255]);
  const plain = await frameReceipt({ plugin: "x" }, px);
  assert.equal(plain.referenceBackend, null);
  assert.equal(plain.reconcile.verdict, "UNVERIFIABLE");
  const checked = await frameReceipt({ plugin: "x" }, px, { referenceBackend: "wasm-raw", reconcile: reconcile(px, px) });
  assert.equal(checked.referenceBackend, "wasm-raw");
  assert.equal(checked.reconcile.verdict, "MATCH");
});
