// system/engine/world-package.test.mjs
// Tests for the certified world package container. No DOM or GPU required.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  WORLD_PACKAGE_SCHEMA,
  SPLAT_RECORD_FLOATS,
  SPLAT_RECORD_BYTES,
  validateWorldPackage,
  parseSplatRecords,
  clampToBudget,
  buildRunReceipt,
} from "./world-package.js";

const SHA = "a".repeat(64);

function goodManifest() {
  return {
    schema: WORLD_PACKAGE_SCHEMA,
    lane: "authored",
    title: "Folded light, inhabited",
    seed: "gallery-opening",
    disclosure: "Authored spatial scene generated from this site's own seeded engine.",
    camera: { maxX: 0.045, maxY: 0.03, maxDolly: 0.12 },
    layers: [
      { name: "deep_veil", depth: 0.95 },
      { name: "mid_veil", depth: 0.55 },
      { name: "near_veil", depth: 0.2 },
    ],
    splats: { count: 3, kinds: ["dust", "beam"] },
    receipts: { "folded-light.splats.bin": SHA },
  };
}

test("a complete manifest validates", () => {
  assert.deepEqual(validateWorldPackage(goodManifest()), { ok: true });
});

test("validation names the failing field", () => {
  const cases = [
    [(m) => { m.schema = "nope"; }, "wrong_schema"],
    [(m) => { m.lane = "scan"; }, "unknown_lane"],
    [(m) => { m.title = " "; }, "missing_title"],
    [(m) => { m.seed = ""; }, "missing_seed"],
    [(m) => { m.disclosure = "short"; }, "missing_disclosure"],
    [(m) => { m.camera.maxX = 3; }, "camera_boundary_out_of_range"],
    [(m) => { m.layers = []; }, "missing_layers"],
    [(m) => { m.layers[1].depth = -1; }, "layer_depth_out_of_range"],
    [(m) => { m.splats.count = 1.5; }, "bad_splat_count"],
    [(m) => { m.splats.kinds = ["architecture"]; }, "unknown_splat_kind"],
    [(m) => { m.receipts["folded-light.splats.bin"] = "beef"; }, "bad_receipt_hash"],
  ];
  for (const [mutate, code] of cases) {
    const m = goodManifest();
    mutate(m);
    const verdict = validateWorldPackage(m);
    assert.equal(verdict.ok, false);
    assert.equal(verdict.failureCode, code);
    assert.ok(verdict.field, `${code} should name a field`);
  }
});

test("splat records parse and torn blocks are refused", () => {
  const block = new Float32Array(2 * SPLAT_RECORD_FLOATS);
  block[0] = 0.5;
  const parsed = parseSplatRecords(block, 2);
  assert.equal(parsed.count, 2);
  assert.equal(parsed.data[0], 0.5);

  const torn = new Uint8Array(SPLAT_RECORD_BYTES + 4);
  assert.throws(() => parseSplatRecords(torn), /not a multiple/);
  assert.throws(() => parseSplatRecords(block, 3), /declares 3 records, found 2/);
});

test("budget clamp keeps records from the front and reports drops", () => {
  const block = new Float32Array(5 * SPLAT_RECORD_FLOATS);
  for (let i = 0; i < 5; i += 1) block[i * SPLAT_RECORD_FLOATS] = i;
  const parsed = parseSplatRecords(block, 5);

  const untouched = clampToBudget(parsed, 9);
  assert.equal(untouched.count, 5);
  assert.equal(untouched.dropped, 0);

  const clamped = clampToBudget(parsed, 2);
  assert.equal(clamped.count, 2);
  assert.equal(clamped.dropped, 3);
  assert.equal(clamped.data.length, 2 * SPLAT_RECORD_FLOATS);
  assert.equal(clamped.data[SPLAT_RECORD_FLOATS], 1);
});

test("the run receipt carries lane, boundary, and disclosure", () => {
  const receipt = buildRunReceipt(goodManifest(), {
    splatsDrawn: 2,
    splatsDropped: 1,
    controls: { parallax: 0.7 },
  });
  assert.equal(receipt.schema, "zentropy.world-package-run/v1");
  assert.equal(receipt.lane, "authored");
  assert.equal(receipt.splats_drawn, 2);
  assert.equal(receipt.splats_dropped_for_budget, 1);
  assert.equal(receipt.controls.parallax, 0.7);
  assert.equal(receipt.camera_boundary.maxX, 0.045);
  assert.match(receipt.disclosure, /Authored/);
  assert.equal(receipt.receipts["folded-light.splats.bin"], SHA);
});
