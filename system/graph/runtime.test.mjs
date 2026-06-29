// system/graph/runtime.test.mjs
// Tests for the Telos node graph runtime: typed ports, dependency order,
// deterministic receipts, and honest cycle failures.

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  evaluateGraph,
  makeNode,
  stableGraphHash,
} from "./runtime.js";

const registry = {
  const: {
    evaluate(node) {
      return { value: node.params.value };
    },
  },
  add: {
    evaluate(_node, inputs) {
      return { value: inputs.a + inputs.b };
    },
  },
  mul: {
    evaluate(_node, inputs) {
      return { value: inputs.a * inputs.b };
    },
  },
};

test("evaluateGraph evaluates nodes in dependency order and returns requested outputs", () => {
  const graph = {
    id: "math-graph",
    nodes: [
      makeNode("a", "const", { value: 2 }),
      makeNode("b", "const", { value: 3 }),
      makeNode("sum", "add"),
      makeNode("product", "mul"),
    ],
    edges: [
      { from: "a.value", to: "sum.a" },
      { from: "b.value", to: "sum.b" },
      { from: "sum.value", to: "product.a" },
      { from: "b.value", to: "product.b" },
    ],
    outputs: ["product.value"],
  };

  const result = evaluateGraph(graph, registry, { backend: "cpu", tier: "low" });

  assert.equal(result.status, "MATCH");
  assert.equal(result.outputs["product.value"], 15);
  assert.deepEqual(result.evaluationOrder, ["a", "b", "sum", "product"]);
  assert.equal(result.receipts.length, 4);
  assert.equal(result.receipts.at(-1).nodeId, "product");
  assert.equal(result.receipts.at(-1).backend, "cpu");
});

test("evaluateGraph returns UNVERIFIABLE with cycle_detected for cyclic graphs", () => {
  const graph = {
    id: "cycle",
    nodes: [
      makeNode("a", "add"),
      makeNode("b", "add"),
    ],
    edges: [
      { from: "a.value", to: "b.a" },
      { from: "b.value", to: "a.a" },
    ],
    outputs: ["a.value"],
  };

  const result = evaluateGraph(graph, registry);

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.failureCode, "cycle_detected");
  assert.deepEqual(result.outputs, {});
  assert.equal(result.receipts[0].verificationVerdict, "UNVERIFIABLE");
});

test("evaluateGraph records missing node types as typed receipts instead of throwing", () => {
  const graph = {
    id: "missing-node-type",
    nodes: [makeNode("x", "does-not-exist")],
    edges: [],
    outputs: ["x.value"],
  };

  const result = evaluateGraph(graph, registry);

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.failureCode, "unknown_node_type");
  assert.equal(result.receipts[0].nodeId, "x");
  assert.equal(result.receipts[0].failureCode, "unknown_node_type");
});

test("evaluateGraph preserves normalized failure codes thrown by node evaluators", () => {
  const graph = {
    id: "typed-failure",
    nodes: [makeNode("x", "typed-fail")],
    edges: [],
    outputs: ["x.value"],
  };
  const typedRegistry = {
    "typed-fail": {
      evaluate() {
        const err = new Error("specific failure");
        err.failureCode = "unsupported_media_kind";
        throw err;
      },
    },
  };

  const result = evaluateGraph(graph, typedRegistry);

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.failureCode, "unsupported_media_kind");
  assert.equal(result.receipts[0].failureCode, "unsupported_media_kind");
});

test("stableGraphHash is deterministic and independent of object key order", () => {
  const a = {
    id: "same",
    nodes: [{ id: "n", type: "const", params: { x: 1, y: 2 } }],
    edges: [],
  };
  const b = {
    edges: [],
    nodes: [{ type: "const", params: { y: 2, x: 1 }, id: "n" }],
    id: "same",
  };

  assert.equal(stableGraphHash(a), stableGraphHash(b));
});
