// system/graph/nodes/media-nodes.js
// First graph-native Telos media nodes. These wrap existing engine primitives
// instead of inventing parallel effect or transform systems.

import { runEffect, isEffectKey } from "../../studio-effects.js";
import { meshStats, transformMesh } from "../../mesh-transform.js";
import { createMediaDocument, validateMediaDocument } from "../../media/ir.js";

export function createMediaNodeRegistry() {
  return Object.freeze({
    constant: { evaluate: evaluateConstant },
    passthrough: { evaluate: evaluatePassthrough },
    math: { evaluate: evaluateMath },
    "image-effect": { evaluate: evaluateImageEffect },
    "mesh-transform": { evaluate: evaluateMeshTransform },
    "shader-source": { evaluate: evaluateShaderSource },
    "render-target": { evaluate: evaluateRenderTarget },
  });
}

function evaluateConstant(node) {
  return { value: node.params.value };
}

function evaluatePassthrough(_node, inputs) {
  return { value: inputs.value };
}

function evaluateMath(node, inputs) {
  const op = node.params.op || "add";
  const a = finite(inputs.a, finite(node.params.a, 0));
  const b = finite(inputs.b, finite(node.params.b, 0));
  if (op === "add") return { value: a + b };
  if (op === "subtract") return { value: a - b };
  if (op === "multiply") return { value: a * b };
  if (op === "divide") return { value: b === 0 ? null : a / b };
  throw graphNodeError("unsupported_math_op", "Unsupported math op: " + op);
}

function evaluateImageEffect(node, inputs) {
  const doc = requireMediaDocument(inputs.image, "media.image");
  const imageData = doc.data && doc.data.imageData;
  if (!imageData || !imageData.data || !Number.isFinite(imageData.width) || !Number.isFinite(imageData.height)) {
    throw graphNodeError("missing_image_data", "image-effect requires media.image data.imageData.");
  }
  const effect = String(node.params.effect || "grayscale");
  if (!isEffectKey(effect)) {
    throw graphNodeError("unsupported_effect", "Unsupported Studio effect: " + effect);
  }
  const cloned = cloneImageData(imageData);
  const out = runEffect(cloned, effect);
  return {
    image: createMediaDocument("media.image", {
      ...doc.data,
      imageData: out,
    }, {
      ...doc.meta,
      operation: "image-effect:" + effect,
      graphNodeType: "image-effect",
    }),
  };
}

function evaluateMeshTransform(node, inputs) {
  const doc = requireMediaDocument(inputs.mesh, "media.mesh");
  const mesh = doc.data && doc.data.mesh;
  if (!mesh || !Array.isArray(mesh.vertices) || !Array.isArray(mesh.faces)) {
    throw graphNodeError("missing_mesh_data", "mesh-transform requires media.mesh data.mesh.");
  }
  const transformed = transformMesh(mesh, {
    scale: node.params.scale,
    rotateX: node.params.rotateX,
    rotateY: node.params.rotateY,
    rotateZ: node.params.rotateZ,
    translateX: node.params.translateX,
    translateY: node.params.translateY,
    translateZ: node.params.translateZ,
    normalize: node.params.normalize,
  });
  return {
    mesh: createMediaDocument("media.mesh", {
      ...doc.data,
      mesh: transformed,
      stats: meshStats(transformed),
    }, {
      ...doc.meta,
      operation: "mesh-transform",
      graphNodeType: "mesh-transform",
    }),
  };
}

function evaluateShaderSource(node) {
  const source = String(node.params.source || "");
  if (!source) throw graphNodeError("missing_shader_source", "shader-source requires source text.");
  return {
    shader: createMediaDocument("media.shader", {
      source,
      stage: String(node.params.stage || "fragment"),
      language: String(node.params.language || "wgsl"),
      uniforms: node.params.uniforms || {},
      resources: node.params.resources || [],
    }, {
      operation: "shader-source",
      graphNodeType: "shader-source",
    }),
  };
}

function evaluateRenderTarget(node, inputs, context = {}) {
  const input = inputs.input;
  const validation = validateMediaDocument(input);
  if (!validation.ok) {
    throw graphNodeError("unsupported_media_kind", "render-target requires a Canonical Media IR input.");
  }
  return {
    receipt: createMediaDocument("media.receipt", {
      target: String(node.params.target || "preview"),
      sourceKind: input.kind,
      backend: context.backend || "unknown",
      tier: context.tier || "unknown",
      status: "MATCH",
    }, {
      operation: "render-target",
      graphNodeType: "render-target",
    }),
  };
}

function requireMediaDocument(value, expectedKind) {
  const validation = validateMediaDocument(value);
  if (!validation.ok) {
    throw graphNodeError(validation.failureCode, "Expected " + expectedKind + " Canonical Media IR.");
  }
  if (value.kind !== expectedKind) {
    throw graphNodeError("unsupported_media_kind", "Expected " + expectedKind + ", received " + value.kind + ".");
  }
  return value;
}

function cloneImageData(imageData) {
  return new ImageData(new Uint8ClampedArray(imageData.data), imageData.width, imageData.height);
}

function graphNodeError(failureCode, message) {
  const err = new Error(message);
  err.failureCode = failureCode;
  return err;
}

function finite(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export default { createMediaNodeRegistry };
