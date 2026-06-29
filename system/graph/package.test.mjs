import { test } from "node:test";
import assert from "node:assert/strict";

import { makeNode, stableGraphHash } from "./runtime.js";
import {
  GRAPH_PACKAGE_SCHEMA,
  createGraphPackage,
  createGraphPackageReceipt,
  materializeGraphPackage,
  validateGraphPackage,
} from "./package.js";

const GRAPH = {
  id: "portable-effect",
  nodes: [
    makeNode("source", "constant", { valueRef: "asset:image:001" }),
    makeNode("effect", "image-effect", { effect: "dither" }),
    makeNode("preview", "render-target", { target: "preview" }),
  ],
  edges: [
    { from: "source.value", to: "effect.image" },
    { from: "effect.image", to: "preview.input" },
  ],
  outputs: ["effect.image", "preview.receipt"],
};

test("createGraphPackage emits a portable media.graph IR document", () => {
  const pkg = createGraphPackage(GRAPH, {
    name: "Portable Effect",
    assets: [{ id: "asset:image:001", kind: "media.image", ref: "sha256:abc" }],
  });

  assert.equal(pkg.schema, "project-telos.canonical-media-ir/v1");
  assert.equal(pkg.kind, "media.graph");
  assert.equal(pkg.meta.packageSchema, GRAPH_PACKAGE_SCHEMA);
  assert.equal(pkg.meta.name, "Portable Effect");
  assert.equal(pkg.data.graph.id, "portable-effect");
  assert.equal(pkg.data.graphHash, stableGraphHash(GRAPH));
  assert.deepEqual(pkg.data.nodeTypes, ["constant", "image-effect", "render-target"]);
  assert.deepEqual(pkg.data.targetSurfaces, ["browser", "cli", "mcp", "ide", "tui"]);
  assert.equal(pkg.data.assets[0].id, "asset:image:001");
});

test("validateGraphPackage accepts a fresh package and materializes the graph", () => {
  const pkg = createGraphPackage(GRAPH);
  const validation = validateGraphPackage(pkg);
  const graph = materializeGraphPackage(pkg);

  assert.deepEqual(validation, { ok: true });
  assert.deepEqual(graph, pkg.data.graph);
  assert.notEqual(graph, pkg.data.graph, "materialized graph should be a defensive clone");
});

test("validateGraphPackage rejects changed graph contents with graph_hash_mismatch", () => {
  const pkg = createGraphPackage(GRAPH);
  pkg.data.graph.nodes[1].params.effect = "invert";

  const validation = validateGraphPackage(pkg);

  assert.equal(validation.ok, false);
  assert.equal(validation.failureCode, "graph_hash_mismatch");
});

test("validateGraphPackage rejects edges that cannot join to graph nodes", () => {
  const pkg = createGraphPackage({
    id: "broken",
    nodes: [makeNode("a", "constant", { value: 1 })],
    edges: [{ from: "a.value", to: "missing.input" }],
    outputs: ["missing.value"],
  });
  pkg.data.graphHash = stableGraphHash(pkg.data.graph);

  const validation = validateGraphPackage(pkg);

  assert.equal(validation.ok, false);
  assert.equal(validation.failureCode, "unjoinable_graph_edge");
  assert.equal(validation.edge.to, "missing.input");
});

test("createGraphPackageReceipt joins to the package hash without raw payloads", () => {
  const pkg = createGraphPackage(GRAPH);
  const receipt = createGraphPackageReceipt(pkg, { action: "save" });

  assert.equal(receipt.kind, "media.receipt");
  assert.equal(receipt.data.action, "save");
  assert.equal(receipt.data.sourceKind, "media.graph");
  assert.equal(receipt.data.graphHash, pkg.data.graphHash);
  assert.equal(receipt.data.verificationVerdict, "MATCH");
  assert.ok(!("graph" in receipt.data), "receipt should not duplicate raw graph payload");
});
