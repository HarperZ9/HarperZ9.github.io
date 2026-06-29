// system/graph/runtime.js
// Telos node graph runtime. Pure ES module, no DOM, no GPU.
// It is intentionally small: typed node ids/ports, dependency ordering,
// deterministic receipts, and honest failure records.

const RECEIPT_SCHEMA = "project-telos.graph-evaluation-receipt/v1";

export function makeNode(id, type, params = {}) {
  return { id, type, params };
}

export function evaluateGraph(graph, registry, context = {}) {
  const g = normalizeGraph(graph);
  const reg = registry || {};
  const graphHash = stableGraphHash(g);
  const order = topologicalOrder(g);

  if (!order.ok) {
    return failureResult({
      graphHash,
      failureCode: "cycle_detected",
      message: "Graph contains a dependency cycle.",
      receipts: [failureReceipt({ graphHash, failureCode: "cycle_detected", message: "Graph contains a dependency cycle." })],
    });
  }

  const values = {};
  const receipts = [];
  const nodesById = new Map(g.nodes.map(node => [node.id, node]));
  const incoming = incomingByNode(g.edges);

  for (const nodeId of order.nodes) {
    const node = nodesById.get(nodeId);
    const op = reg[node.type];
    if (!op || typeof op.evaluate !== "function") {
      const receipt = failureReceipt({
        graphHash,
        nodeId,
        nodeType: node.type,
        failureCode: "unknown_node_type",
        message: "No evaluator registered for node type " + node.type + ".",
        context,
      });
      receipts.push(receipt);
      return failureResult({ graphHash, failureCode: "unknown_node_type", receipts });
    }

    const inputs = {};
    for (const edge of incoming.get(nodeId) || []) {
      const from = parseEndpoint(edge.from);
      const to = parseEndpoint(edge.to);
      inputs[to.port] = values[endpointKey(from.nodeId, from.port)];
    }

    let output;
    try {
      output = op.evaluate(node, inputs, context);
    } catch (err) {
      const failureCode = err && err.failureCode ? String(err.failureCode) : "node_eval_failed";
      const receipt = failureReceipt({
        graphHash,
        nodeId,
        nodeType: node.type,
        failureCode,
        message: err && err.message ? err.message : "Node evaluation failed.",
        context,
      });
      receipts.push(receipt);
      return failureResult({ graphHash, failureCode, receipts });
    }

    const out = output && typeof output === "object" ? output : { value: output };
    for (const [port, value] of Object.entries(out)) {
      values[endpointKey(nodeId, port)] = value;
    }

    receipts.push({
      schema: RECEIPT_SCHEMA,
      graphHash,
      nodeId,
      nodeType: node.type,
      verificationVerdict: "MATCH",
      backend: context.backend || "unknown",
      tier: context.tier || "unknown",
      inputHash: stableValueHash(inputs),
      outputHash: stableValueHash(out),
    });
  }

  const outputs = {};
  for (const out of g.outputs) {
    outputs[out] = values[out];
  }

  return {
    status: "MATCH",
    graphHash,
    outputs,
    receipts,
    evaluationOrder: order.nodes,
    telemetry: {
      nodeCount: g.nodes.length,
      edgeCount: g.edges.length,
      backend: context.backend || "unknown",
      tier: context.tier || "unknown",
    },
  };
}

export function stableGraphHash(graph) {
  return fnv1a(stableStringify(normalizeGraph(graph)));
}

function normalizeGraph(graph) {
  const g = graph || {};
  return {
    id: String(g.id || "graph"),
    nodes: Array.isArray(g.nodes) ? g.nodes.map(n => ({
      id: String(n.id),
      type: String(n.type),
      params: n.params && typeof n.params === "object" ? n.params : {},
    })) : [],
    edges: Array.isArray(g.edges) ? g.edges.map(e => ({
      from: String(e.from),
      to: String(e.to),
    })) : [],
    outputs: Array.isArray(g.outputs) ? g.outputs.map(String) : [],
  };
}

function topologicalOrder(graph) {
  const nodes = graph.nodes.map(n => n.id);
  const deps = new Map(nodes.map(id => [id, new Set()]));
  const dependents = new Map(nodes.map(id => [id, new Set()]));

  for (const edge of graph.edges) {
    const from = parseEndpoint(edge.from);
    const to = parseEndpoint(edge.to);
    if (!deps.has(to.nodeId) || !deps.has(from.nodeId)) continue;
    deps.get(to.nodeId).add(from.nodeId);
    dependents.get(from.nodeId).add(to.nodeId);
  }

  const ready = nodes.filter(id => deps.get(id).size === 0);
  const out = [];
  while (ready.length) {
    const id = ready.shift();
    out.push(id);
    for (const child of dependents.get(id)) {
      deps.get(child).delete(id);
      if (deps.get(child).size === 0) ready.push(child);
    }
  }

  return { ok: out.length === nodes.length, nodes: out };
}

function incomingByNode(edges) {
  const map = new Map();
  for (const edge of edges) {
    const to = parseEndpoint(edge.to);
    if (!map.has(to.nodeId)) map.set(to.nodeId, []);
    map.get(to.nodeId).push(edge);
  }
  return map;
}

function parseEndpoint(endpoint) {
  const idx = endpoint.indexOf(".");
  if (idx < 1) return { nodeId: endpoint, port: "value" };
  return { nodeId: endpoint.slice(0, idx), port: endpoint.slice(idx + 1) || "value" };
}

function endpointKey(nodeId, port) {
  return nodeId + "." + port;
}

function failureResult({ graphHash, failureCode, receipts }) {
  return {
    status: "UNVERIFIABLE",
    graphHash,
    failureCode,
    outputs: {},
    receipts: receipts || [],
    evaluationOrder: [],
    telemetry: { nodeCount: 0, edgeCount: 0 },
  };
}

function failureReceipt({ graphHash, nodeId = null, nodeType = null, failureCode, message, context = {} }) {
  return {
    schema: RECEIPT_SCHEMA,
    graphHash,
    nodeId,
    nodeType,
    verificationVerdict: "UNVERIFIABLE",
    failureCode,
    message,
    backend: context.backend || "unknown",
    tier: context.tier || "unknown",
  };
}

function stableValueHash(value) {
  return fnv1a(stableStringify(value));
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

function fnv1a(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
}

export default { evaluateGraph, makeNode, stableGraphHash };
