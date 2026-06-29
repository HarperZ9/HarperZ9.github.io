// system/media/ir.test.mjs
// Canonical Media IR tests. No DOM, no GPU, no browser-only APIs.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_MEDIA_KINDS,
  createMediaDocument,
  validateMediaDocument,
  buildConversionReceipt,
} from "./ir.js";

test("CANONICAL_MEDIA_KINDS names the first universal media document classes", () => {
  for (const kind of [
    "media.scene",
    "media.mesh",
    "media.splat",
    "media.volume",
    "media.image",
    "media.video",
    "media.audio",
    "media.vector",
    "media.table",
    "media.shader",
    "media.graph",
    "media.receipt",
  ]) {
    assert.ok(CANONICAL_MEDIA_KINDS.includes(kind), kind);
  }
});

test("createMediaDocument creates a validated canonical IR envelope", () => {
  const doc = createMediaDocument("media.mesh", {
    vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]],
    faces: [[0, 1, 2]],
  }, {
    sourceFormat: "obj",
    units: "unitless",
  });

  assert.equal(doc.schema, "project-telos.canonical-media-ir/v1");
  assert.equal(doc.kind, "media.mesh");
  assert.equal(doc.meta.sourceFormat, "obj");
  assert.equal(validateMediaDocument(doc).ok, true);
});

test("validateMediaDocument rejects unknown media kinds without throwing", () => {
  const result = validateMediaDocument({ schema: "project-telos.canonical-media-ir/v1", kind: "media.unknown", data: {} });

  assert.equal(result.ok, false);
  assert.equal(result.failureCode, "unknown_media_kind");
});

test("buildConversionReceipt records conserved and dropped fields plus hashes", async () => {
  const input = createMediaDocument("media.vector", { paths: ["M0 0L1 1"] }, { sourceFormat: "svg" });
  const output = createMediaDocument("media.image", { width: 1, height: 1 }, { sourceFormat: "png" });

  const receipt = await buildConversionReceipt({
    adapterId: "svg-to-png",
    adapterVersion: "0.1.0",
    direction: "export",
    input,
    output,
    conservedFields: ["dimensions"],
    droppedFields: ["vector-editability"],
    fidelityVerdict: "DRIFT",
    roundTrip: { supported: false, verdict: "UNVERIFIABLE" },
  });

  assert.equal(receipt.schema, "project-telos.conversion-receipt/v1");
  assert.equal(receipt.adapterId, "svg-to-png");
  assert.equal(receipt.direction, "export");
  assert.deepEqual(receipt.conservedFields, ["dimensions"]);
  assert.deepEqual(receipt.droppedFields, ["vector-editability"]);
  assert.equal(receipt.fidelityVerdict, "DRIFT");
  assert.equal(receipt.roundTrip.verdict, "UNVERIFIABLE");
  assert.ok(receipt.originHash.length >= 8);
  assert.ok(receipt.resultHash.length >= 8);
  assert.ok(["sha-256", "fnv1a-fallback"].includes(receipt.hashAlgo));
});
