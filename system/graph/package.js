// system/graph/package.js
// Portable graph package helpers. A Telos graph package is a media.graph IR
// document that can move across Studio, CLI, MCP, IDE, TUI, and app surfaces.

import { createMediaDocument, validateMediaDocument } from "../media/ir.js";
import { stableGraphHash } from "./runtime.js";

export const GRAPH_PACKAGE_SCHEMA = "project-telos.graph-package/v1";
export const DEFAULT_TARGET_SURFACES = Object.freeze(["browser", "cli", "mcp", "ide", "tui"]);

export function createGraphPackage(graph, opts = {}) {
  const normalized = normalizeGraph(graph);
  const graphHash = stableGraphHash(normalized);
  const targetSurfaces = normalizeList(opts.targetSurfaces, DEFAULT_TARGET_SURFACES);
  const assets = Array.isArray(opts.assets) ? clone(opts.assets) : [];
  const receipts = Array.isArray(opts.receipts) ? clone(opts.receipts) : [];
  return createMediaDocument("media.graph", {
    packageSchema: GRAPH_PACKAGE_SCHEMA,
    graph: normalized,
    graphHash,
    nodeTypes: nodeTypes(normalized),
    targetSurfaces,
    assets,
    receipts,
    requirements: {
      nodeTypes: nodeTypes(normalized),
      assetCount: assets.length,
      surfaces: targetSurfaces,
    },
  }, {
    packageSchema: GRAPH_PACKAGE_SCHEMA,
    name: opts.name ? String(opts.name) : normalized.id,
    createdAt: opts.createdAt,
    portability: targetSurfaces,
  });
}

export function validateGraphPackage(doc) {
  const base = validateMediaDocument(doc);
  if (!base.ok) return base;
  if (doc.kind !== "media.graph") return { ok: false, failureCode: "wrong_media_kind" };
  if (!doc.data || doc.data.packageSchema !== GRAPH_PACKAGE_SCHEMA) {
    return { ok: false, failureCode: "wrong_graph_package_schema" };
  }
  if (!doc.data.graph || typeof doc.data.graph !== "object") {
    return { ok: false, failureCode: "missing_graph" };
  }

  const graph = normalizeGraph(doc.data.graph);
  const shape = validateGraphShape(graph);
  if (!shape.ok) return shape;

  const expected = stableGraphHash(graph);
  if (doc.data.graphHash !== expected) {
    return { ok: false, failureCode: "graph_hash_mismatch", expected, actual: doc.data.graphHash };
  }

  for (const receipt of doc.data.receipts || []) {
    if (receipt && receipt.graphHash && receipt.graphHash !== expected) {
      return { ok: false, failureCode: "receipt_graph_hash_mismatch", expected, actual: receipt.graphHash };
    }
  }

  return { ok: true };
}

export function materializeGraphPackage(doc) {
  const validation = validateGraphPackage(doc);
  if (!validation.ok) {
    const err = new Error("Invalid graph package: " + validation.failureCode);
    err.failureCode = validation.failureCode;
    err.validation = validation;
    throw err;
  }
  return clone(doc.data.graph);
}

export function createGraphPackageReceipt(pkg, opts = {}) {
  const validation = validateGraphPackage(pkg);
  const ok = validation.ok === true;
  return createMediaDocument("media.receipt", {
    action: String(opts.action || "package"),
    sourceKind: "media.graph",
    packageSchema: GRAPH_PACKAGE_SCHEMA,
    graphHash: pkg && pkg.data ? pkg.data.graphHash : null,
    targetSurfaces: pkg && pkg.data ? normalizeList(pkg.data.targetSurfaces, []) : [],
    verificationVerdict: ok ? "MATCH" : "UNVERIFIABLE",
    failureCode: ok ? null : validation.failureCode,
  }, {
    packageSchema: GRAPH_PACKAGE_SCHEMA,
    operation: "graph-package-receipt",
  });
}

function validateGraphShape(graph) {
  const ids = new Set();
  for (const node of graph.nodes) {
    if (!node.id) return { ok: false, failureCode: "missing_node_id", node };
    if (ids.has(node.id)) return { ok: false, failureCode: "duplicate_node_id", nodeId: node.id };
    ids.add(node.id);
  }
  for (const edge of graph.edges) {
    const from = parseEndpoint(edge.from);
    const to = parseEndpoint(edge.to);
    if (!ids.has(from.nodeId) || !ids.has(to.nodeId)) {
      return { ok: false, failureCode: "unjoinable_graph_edge", edge };
    }
  }
  for (const out of graph.outputs) {
    const endpoint = parseEndpoint(out);
    if (!ids.has(endpoint.nodeId)) {
      return { ok: false, failureCode: "unjoinable_graph_output", output: out };
    }
  }
  return { ok: true };
}

function normalizeGraph(graph) {
  const g = graph || {};
  return {
    id: String(g.id || "graph"),
    nodes: Array.isArray(g.nodes) ? g.nodes.map(node => ({
      id: String(node.id || ""),
      type: String(node.type || ""),
      params: node.params && typeof node.params === "object" ? clone(node.params) : {},
    })) : [],
    edges: Array.isArray(g.edges) ? g.edges.map(edge => ({
      from: String(edge.from || ""),
      to: String(edge.to || ""),
    })) : [],
    outputs: Array.isArray(g.outputs) ? g.outputs.map(String) : [],
  };
}

function nodeTypes(graph) {
  return Array.from(new Set(graph.nodes.map(node => node.type).filter(Boolean))).sort();
}

function parseEndpoint(endpoint) {
  const value = String(endpoint || "");
  const idx = value.indexOf(".");
  if (idx < 1) return { nodeId: value, port: "value" };
  return { nodeId: value.slice(0, idx), port: value.slice(idx + 1) || "value" };
}

function normalizeList(value, fallback) {
  const src = Array.isArray(value) ? value : Array.from(fallback || []);
  return Array.from(new Set(src.map(String).filter(Boolean)));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default {
  GRAPH_PACKAGE_SCHEMA,
  DEFAULT_TARGET_SURFACES,
  createGraphPackage,
  createGraphPackageReceipt,
  materializeGraphPackage,
  validateGraphPackage,
};
