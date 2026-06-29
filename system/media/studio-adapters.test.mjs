import test from "node:test";
import assert from "node:assert/strict";

import { createAdapterRegistry } from "./adapters.js";
import { createStudioMediaAdapters } from "./studio-adapters.js";

function file(name, type = "", size = 0) {
  return { name, type, size };
}

const formats = [{
  id: "obj",
  extensions: [".obj"],
  mime: ["model/obj"],
  mediaKind: "media.mesh",
  exporter: "obj",
  outputMime: "model/obj",
  outputExtension: ".obj",
}];

test("createStudioMediaAdapters wraps Studio importer results into Canonical Media IR", async () => {
  const importers = {
    async importFile(input) {
      return {
        kind: "obj",
        meta: { name: input.name, vertexCount: 3, faceCount: 1 },
        mesh: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] },
        drewToCanvas: true,
        receipt: { inputFormat: "obj", originHash: "abc", hashAlgo: "sha-256" },
      };
    },
  };
  const registry = createAdapterRegistry(createStudioMediaAdapters({ importers, formats }));

  const result = await registry.import(file("cube.obj", "model/obj", 120));

  assert.equal(result.status, "MATCH");
  assert.equal(result.adapterId, "studio:obj");
  assert.equal(result.ir.kind, "media.mesh");
  assert.equal(result.ir.data.mesh.vertices.length, 3);
  assert.equal(result.ir.meta.studioKind, "obj");
  assert.equal(result.ir.meta.sourceFormat, "obj");
  assert.ok(result.receipt.conservedFields.includes("mesh"));
});

test("createStudioMediaAdapters wraps Studio exporters and preserves export receipts", async () => {
  const exporters = {
    async exportWithReceipt(name, _canvas, extra) {
      assert.equal(name, "obj");
      assert.equal(extra.mesh.faces.length, 1);
      return {
        blobOrString: "v 0 0 0\nf 1 2 3\n",
        receipt: {
          conserved: ["positions", "faces"],
          dropped: ["materials"],
          discriminatorPassed: true,
        },
      };
    },
  };
  const registry = createAdapterRegistry(createStudioMediaAdapters({ exporters, formats }));
  const ir = {
    schema: "project-telos.canonical-media-ir/v1",
    kind: "media.mesh",
    data: { mesh: { vertices: [[0, 0, 0], [1, 0, 0], [0, 1, 0]], faces: [[0, 1, 2]] } },
    meta: {},
  };

  const result = await registry.export("studio:obj", ir, { canvas: {} });

  assert.equal(result.status, "MATCH");
  assert.equal(result.bytes, "v 0 0 0\nf 1 2 3\n");
  assert.equal(result.mime, "model/obj");
  assert.equal(result.extension, ".obj");
  assert.deepEqual(result.receipt.roundTrip, { supported: true, verdict: "MATCH", notes: [] });
  assert.ok(result.receipt.conservedFields.includes("positions"));
  assert.ok(result.receipt.droppedFields.includes("materials"));
});

test("createStudioMediaAdapters maps Studio parser failures to UNVERIFIABLE receipt IR", async () => {
  const importers = {
    async importFile(input) {
      return {
        kind: "error",
        meta: { name: input.name, error: "corrupt header" },
        mesh: null,
        drewToCanvas: false,
        pluginPoint: "Parser error: corrupt header",
        receipt: { inputFormat: "obj", originHash: "abc", hashAlgo: "sha-256" },
      };
    },
  };
  const registry = createAdapterRegistry(createStudioMediaAdapters({ importers, formats }));

  const result = await registry.import(file("broken.obj", "model/obj", 4));

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.ir.kind, "media.receipt");
  assert.equal(result.ir.data.failureCode, "studio_import_failed");
  assert.ok(result.receipt.droppedFields.includes("all-fields"));
});
