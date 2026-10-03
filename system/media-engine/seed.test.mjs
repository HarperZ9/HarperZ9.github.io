// node --test system/media-engine/seed.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { makeRng, mulberry32, fnv1a32, rngFrom } from "./seed.mjs";
import { frameReceipt, stableStringify, verifyBytes } from "./receipt.mjs";

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

// The eighteen module copies this replaced were checked against these functions before removal;
// the pins below were computed from the removed plotter.js copy (main before this change).
test("mulberry32, fnv1a32 and rngFrom keep the streams the replaced copies drew", () => {
  assert.deepEqual(Array.from({ length: 3 }, mulberry32(58)), [0.49995423946529627, 0.6492740425746888, 0.7108881543390453]);
  assert.equal(fnv1a32("folded-light"), 135105734);
  assert.equal(fnv1a32(""), 0x811c9dc5);
  assert.equal(fnv1a32(42), fnv1a32("42"));
  assert.deepEqual(Array.from({ length: 2 }, rngFrom("dye-transfer")), Array.from({ length: 2 }, mulberry32(fnv1a32("dye-transfer"))));
  assert.deepEqual(Array.from({ length: 2 }, rngFrom(null)), Array.from({ length: 2 }, rngFrom(1)));
  const own = () => 0.5;
  assert.equal(rngFrom(own), own, "a function seed passes through");
  assert.deepEqual(Array.from({ length: 2 }, mulberry32(-1)), Array.from({ length: 2 }, mulberry32(0xffffffff)));
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

test("verifyBytes names MATCH, DRIFT and UNVERIFIABLE", async () => {
  const bytes = new TextEncoder().encode("abc");
  const abc = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
  assert.equal((await verifyBytes(bytes, abc)).verdict, "MATCH");
  assert.equal((await verifyBytes(bytes, "0".repeat(64))).verdict, "DRIFT");
  assert.equal((await verifyBytes(bytes, "")).verdict, "UNVERIFIABLE");
});
