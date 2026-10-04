// node --test system/media-engine/scene.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { createSceneRequest, toRawParams, fromRawChannels, RAW_PARAMS_KEYS } from "./scene.mjs";
import { reconcileFrame, frameReceipt, verifyReceipt } from "./receipt.mjs";

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

test("reconcileFrame gives two verdicts: byte identity and tolerance, and refuses what it cannot compare", async () => {
  const a = new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]);
  const same = await reconcileFrame(a, a);
  assert.equal(same.identity, "MATCH");
  assert.equal(same.tolerance.verdict, "verified");
  assert.equal(same.tolerance.metrics.rmse, 0);
  // One channel off by 51 levels: the bytes drift and the error is far outside the bounds.
  const b = new Uint8Array([51, 0, 0, 255, 255, 255, 255, 255]);
  const far = await reconcileFrame(a, b);
  assert.equal(far.identity, "DRIFT");
  assert.equal(far.tolerance.verdict, "refuted");
  assert.equal(far.tolerance.metrics.max_error, 0.2);
  // One level off on one channel: DRIFT for the bytes, verified for the tolerance (the contract's case).
  const near = await reconcileFrame(a, new Uint8Array([1, 0, 0, 255, 255, 255, 255, 255]));
  assert.equal(near.identity, "DRIFT");
  assert.equal(near.tolerance.verdict, "verified");
  assert.equal((await reconcileFrame(a, new Uint8Array(4))).tolerance.verdict, "unverifiable", "different sizes");
  assert.equal((await reconcileFrame(a, null)).tolerance.verdict, "unverifiable");
});

test("a frame receipt is a sealed superstack receipt that says plainly when no reference drew it", async () => {
  const px = new Uint8Array([1, 2, 3, 255]);
  const plain = await frameReceipt({ plugin: "x", t: 1.3 }, px, { width: 1, height: 1 });
  assert.equal(plain.schema, "superstack.receipt/1");
  assert.deepEqual(verifyReceipt(plain), []);
  assert.equal(plain.reconcile, null);
  assert.equal(plain.time.t, 917280000, "1.3 s in flicks");
  assert.ok(plain.does_not_prove.some((s) => /No reference renderer/.test(s)));
  const checked = await frameReceipt({ plugin: "x" }, px, { reference: { backend: "wasm-raw", rgba: px, kind: "raster3d" } });
  assert.deepEqual(verifyReceipt(checked), []);
  assert.equal(checked.reconcile.reference.backend, "wasm-raw");
  assert.equal(checked.reconcile.identity, "MATCH");
  assert.equal(checked.reconcile.tolerance.verdict, "verified");
  const refused = await frameReceipt({ plugin: "x" }, px, { reference: { backend: "none", reason: "no reference renderer for scene kind sound" } });
  assert.deepEqual(verifyReceipt(refused), []);
  assert.equal(refused.reconcile.tolerance.verdict, "unverifiable");
  assert.match(refused.reconcile.tolerance.reason, /scene kind sound/);
  // A flipped byte in a sealed receipt breaks the seal.
  const forged = { ...checked, content_sha256: "0".repeat(64) };
  assert.ok(verifyReceipt(forged).length > 0);
});
