// node --test system/media-engine/seed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeRng, frameReceipt, stableStringify } from "./seed.mjs";

// The Atelier's makeRng (system/atelier.js) is an IIFE-scoped classic script, so its first
// draws for "folded-light" are pinned here from a run of that code on 3 October 2026.
test("makeRng reproduces the Atelier stream for a seed", () => {
  const a = makeRng("folded-light"), b = makeRng("folded-light");
  const sa = Array.from({ length: 5 }, a), sb = Array.from({ length: 5 }, b);
  assert.deepEqual(sa, sb);
  assert.deepEqual(sa, [0.9906783360056579, 0.32101074047386646, 0.3623448656871915, 0.8829958774149418, 0.6267387378029525]);
  assert.ok(sa.every((x) => x >= 0 && x < 1));
  assert.notDeepEqual(sa, Array.from({ length: 5 }, makeRng("folded-light ")));
});

test("frameReceipt is canonical: key order does not change the request hash", async () => {
  const px = new Uint8Array([1, 2, 3, 255]);
  const r1 = await frameReceipt({ plugin: "retro", t: 1.3, params: { a: 1, b: 2 } }, px);
  const r2 = await frameReceipt({ params: { b: 2, a: 1 }, t: 1.3, plugin: "retro" }, px);
  assert.equal(r1.requestHash, r2.requestHash);
  assert.equal(r1.pixelHash, r2.pixelHash);
  assert.equal(r1.hashAlgo, "sha-256");
});

test("frameReceipt can fail: one changed pixel or parameter moves the hash", async () => {
  const base = await frameReceipt({ plugin: "retro", t: 1.3 }, new Uint8Array([1, 2, 3, 255]));
  const px = await frameReceipt({ plugin: "retro", t: 1.3 }, new Uint8Array([1, 2, 4, 255]));
  const rq = await frameReceipt({ plugin: "retro", t: 1.31 }, new Uint8Array([1, 2, 3, 255]));
  assert.notEqual(base.pixelHash, px.pixelHash);
  assert.notEqual(base.requestHash, rq.requestHash);
  assert.equal(stableStringify({ b: 1, a: [2, { d: 3, c: 4 }] }), '{"a":[2,{"c":4,"d":3}],"b":1}');
});
