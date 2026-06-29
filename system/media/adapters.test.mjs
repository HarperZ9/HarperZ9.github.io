// system/media/adapters.test.mjs
// Format Adapter Contract tests for the first agnostic interoperability spine.

import { test } from "node:test";
import assert from "node:assert/strict";
import { createMediaDocument } from "./ir.js";
import {
  createAdapterRegistry,
  createUnknownFormatResult,
} from "./adapters.js";

function makeObjAdapter() {
  return {
    id: "obj",
    version: "0.1.0",
    match(input) {
      return input && input.name && input.name.endsWith(".obj");
    },
    async import(input) {
      return {
        ir: createMediaDocument("media.mesh", { text: input.text }, { sourceFormat: "obj" }),
        conservedFields: ["positions", "faces"],
        droppedFields: ["materials"],
        fidelityVerdict: "MATCH",
      };
    },
    async export(ir) {
      return {
        bytes: "# obj\n" + (ir.data.text || ""),
        mime: "model/obj",
        extension: ".obj",
        conservedFields: ["positions", "faces"],
        droppedFields: ["materials"],
        fidelityVerdict: "MATCH",
      };
    },
    canRoundTrip() { return true; },
    fidelity() { return { verdict: "MATCH" }; },
  };
}

test("createAdapterRegistry dispatches imports through the matching adapter", async () => {
  const registry = createAdapterRegistry();
  registry.register(makeObjAdapter());

  const result = await registry.import({ name: "mesh.obj", text: "v 0 0 0\nf 1 1 1" });

  assert.equal(result.status, "MATCH");
  assert.equal(result.adapterId, "obj");
  assert.equal(result.ir.kind, "media.mesh");
  assert.equal(result.receipt.adapterId, "obj");
  assert.equal(result.receipt.fidelityVerdict, "MATCH");
  assert.deepEqual(result.receipt.conservedFields, ["positions", "faces"]);
});

test("createAdapterRegistry dispatches exports by adapter id and emits receipts", async () => {
  const registry = createAdapterRegistry([makeObjAdapter()]);
  const ir = createMediaDocument("media.mesh", { text: "v 0 0 0" }, { sourceFormat: "obj" });

  const result = await registry.export("obj", ir);

  assert.equal(result.status, "MATCH");
  assert.equal(result.mime, "model/obj");
  assert.equal(result.extension, ".obj");
  assert.equal(result.receipt.direction, "export");
  assert.equal(result.receipt.roundTrip.verdict, "MATCH");
});

test("unknown imports return UNVERIFIABLE adapter receipts instead of throwing", async () => {
  const registry = createAdapterRegistry();

  const result = await registry.import({ name: "asset.zzz", bytes: new Uint8Array([1, 2, 3]) });

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.failureCode, "unknown_format");
  assert.equal(result.receipt.fidelityVerdict, "UNVERIFIABLE");
  assert.equal(result.receipt.adapterId, "unknown");
  assert.deepEqual(result.receipt.droppedFields, ["all-fields"]);
});

test("createUnknownFormatResult is deterministic and preserves source hints", async () => {
  const result = await createUnknownFormatResult({ name: "clip.mystery", type: "application/x-mystery" });

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.ir.kind, "media.receipt");
  assert.equal(result.ir.meta.sourceFormat, "application/x-mystery");
  assert.equal(result.receipt.failureCode, "unknown_format");
});
