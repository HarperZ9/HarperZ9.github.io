import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateGraph, makeNode } from "../runtime.js";
import { createMediaDocument } from "../../media/ir.js";
import { createMediaNodeRegistry } from "./media-nodes.js";

globalThis.ImageData = class ImageData {
  constructor(dataOrWidth, width, height) {
    if (typeof dataOrWidth === "number") {
      this.width = dataOrWidth;
      this.height = width;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    } else {
      this.data = dataOrWidth;
      this.width = width;
      this.height = height;
    }
  }
};

function image(width, height, pixels) {
  return new ImageData(new Uint8ClampedArray(pixels), width, height);
}

const TRI_MESH = {
  vertices: [[0, 0, 0], [2, 0, 0], [0, 2, 0]],
  faces: [[0, 1, 2]],
};

test("media node registry runs an image effect as a graph node and emits media.image IR", () => {
  const registry = createMediaNodeRegistry();
  const graph = {
    id: "effect-graph",
    nodes: [
      makeNode("source", "constant", { value: createMediaDocument("media.image", { imageData: image(1, 1, [10, 20, 30, 255]) }) }),
      makeNode("invert", "image-effect", { effect: "invert" }),
    ],
    edges: [{ from: "source.value", to: "invert.image" }],
    outputs: ["invert.image"],
  };

  const result = evaluateGraph(graph, registry, { backend: "cpu", tier: "low" });
  const out = result.outputs["invert.image"];

  assert.equal(result.status, "MATCH");
  assert.equal(out.kind, "media.image");
  assert.deepEqual([...out.data.imageData.data], [245, 235, 225, 255]);
  assert.equal(out.meta.operation, "image-effect:invert");
  assert.equal(result.receipts.at(-1).nodeType, "image-effect");
});

test("media node registry transforms mesh IR and preserves topology", () => {
  const registry = createMediaNodeRegistry();
  const graph = {
    id: "mesh-graph",
    nodes: [
      makeNode("source", "constant", { value: createMediaDocument("media.mesh", { mesh: TRI_MESH }) }),
      makeNode("xf", "mesh-transform", { scale: 2, rotateZ: 90, translateX: 1 }),
    ],
    edges: [{ from: "source.value", to: "xf.mesh" }],
    outputs: ["xf.mesh"],
  };

  const result = evaluateGraph(graph, registry, { backend: "cpu", tier: "low" });
  const out = result.outputs["xf.mesh"];

  assert.equal(result.status, "MATCH");
  assert.equal(out.kind, "media.mesh");
  assert.deepEqual(out.data.mesh.faces, TRI_MESH.faces);
  assert.ok(Math.abs(out.data.mesh.vertices[1][0] - 1) < 1e-9);
  assert.ok(Math.abs(out.data.mesh.vertices[1][1] - 4) < 1e-9);
  assert.equal(out.meta.operation, "mesh-transform");
});

test("unsupported media inputs fail with a normalized graph failure code", () => {
  const registry = createMediaNodeRegistry();
  const graph = {
    id: "bad-effect-graph",
    nodes: [
      makeNode("source", "constant", { value: createMediaDocument("media.mesh", { mesh: TRI_MESH }) }),
      makeNode("invert", "image-effect", { effect: "invert" }),
    ],
    edges: [{ from: "source.value", to: "invert.image" }],
    outputs: ["invert.image"],
  };

  const result = evaluateGraph(graph, registry);

  assert.equal(result.status, "UNVERIFIABLE");
  assert.equal(result.failureCode, "unsupported_media_kind");
  assert.equal(result.receipts.at(-1).failureCode, "unsupported_media_kind");
  assert.match(result.receipts.at(-1).message, /media.image/);
});

test("shader-source and render-target nodes emit inspectable IR placeholders", () => {
  const registry = createMediaNodeRegistry();
  const graph = {
    id: "shader-graph",
    nodes: [
      makeNode("shader", "shader-source", { stage: "fragment", source: "fn main() -> void {}", language: "wgsl" }),
      makeNode("target", "render-target", { target: "preview" }),
    ],
    edges: [{ from: "shader.shader", to: "target.input" }],
    outputs: ["shader.shader", "target.receipt"],
  };

  const result = evaluateGraph(graph, registry, { backend: "webgpu", tier: "high" });

  assert.equal(result.status, "MATCH");
  assert.equal(result.outputs["shader.shader"].kind, "media.shader");
  assert.equal(result.outputs["target.receipt"].kind, "media.receipt");
  assert.equal(result.outputs["target.receipt"].data.sourceKind, "media.shader");
});
