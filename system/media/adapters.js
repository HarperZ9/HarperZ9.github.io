// system/media/adapters.js
// Format Adapter Contract registry for the Telos universal media engine.
// Adapters bridge external formats to Canonical Media IR and always emit
// conversion receipts. Unknown formats resolve to UNVERIFIABLE, not exceptions.

import {
  createMediaDocument,
  buildConversionReceipt,
  normalizeVerdict,
} from "./ir.js";

export function createAdapterRegistry(initialAdapters = []) {
  const adapters = new Map();

  function register(adapter) {
    validateAdapter(adapter);
    adapters.set(adapter.id, adapter);
    return adapter;
  }

  async function importWithAdapters(input, context = {}) {
    const adapter = find(input);
    if (!adapter) return createUnknownFormatResult(input);

    const raw = await adapter.import(input, context);
    const ir = raw.ir || createMediaDocument("media.receipt", { value: raw.data || null }, { sourceFormat: adapter.id });
    const roundTrip = roundTripFor(adapter, ir, raw.fidelityVerdict);
    const receipt = await buildConversionReceipt({
      adapterId: adapter.id,
      adapterVersion: adapter.version || "0.0.0",
      direction: "import",
      input,
      output: ir,
      conservedFields: raw.conservedFields,
      droppedFields: raw.droppedFields,
      fidelityVerdict: raw.fidelityVerdict,
      roundTrip,
      warnings: raw.warnings,
    });

    return {
      status: receipt.fidelityVerdict,
      adapterId: adapter.id,
      ir,
      receipt,
      warnings: raw.warnings || [],
    };
  }

  async function exportWithAdapter(adapterId, ir, context = {}) {
    const adapter = adapters.get(adapterId);
    if (!adapter || typeof adapter.export !== "function") {
      return createUnknownFormatResult({ name: String(adapterId || "unknown"), ir }, "unknown_adapter");
    }

    const raw = await adapter.export(ir, context);
    const roundTrip = roundTripFor(adapter, ir, raw.fidelityVerdict);
    const receipt = await buildConversionReceipt({
      adapterId: adapter.id,
      adapterVersion: adapter.version || "0.0.0",
      direction: "export",
      input: ir,
      output: raw.bytes,
      conservedFields: raw.conservedFields,
      droppedFields: raw.droppedFields,
      fidelityVerdict: raw.fidelityVerdict,
      roundTrip,
      warnings: raw.warnings,
    });

    return {
      status: receipt.fidelityVerdict,
      adapterId: adapter.id,
      bytes: raw.bytes,
      mime: raw.mime || "application/octet-stream",
      extension: raw.extension || "",
      receipt,
      warnings: raw.warnings || [],
    };
  }

  function find(input) {
    const list = Array.from(adapters.values()).reverse();
    return list.find(adapter => {
      try { return adapter.match(input); } catch (_) { return false; }
    }) || null;
  }

  for (const adapter of initialAdapters) register(adapter);

  return Object.freeze({
    register,
    find,
    import: importWithAdapters,
    export: exportWithAdapter,
    list: () => Array.from(adapters.values()),
  });
}

export async function createUnknownFormatResult(input, failureCode = "unknown_format") {
  const sourceFormat = sourceFormatFor(input);
  const ir = createMediaDocument("media.receipt", {
    status: "UNVERIFIABLE",
    failureCode,
    sourceName: input && input.name ? String(input.name) : "",
  }, {
    sourceFormat,
  });
  const receipt = await buildConversionReceipt({
    adapterId: "unknown",
    adapterVersion: "0.0.0",
    direction: "import",
    input,
    output: ir,
    conservedFields: [],
    droppedFields: ["all-fields"],
    fidelityVerdict: "UNVERIFIABLE",
    failureCode,
    roundTrip: { supported: false, verdict: "UNVERIFIABLE" },
    warnings: ["No format adapter matched this input."],
  });
  return {
    status: "UNVERIFIABLE",
    failureCode,
    adapterId: "unknown",
    ir,
    receipt: { ...receipt, failureCode },
    warnings: ["No format adapter matched this input."],
  };
}

function validateAdapter(adapter) {
  if (!adapter || typeof adapter !== "object") {
    throw new TypeError("format adapter must be an object");
  }
  if (!adapter.id || typeof adapter.id !== "string") {
    throw new TypeError("format adapter id must be a string");
  }
  if (typeof adapter.match !== "function") {
    throw new TypeError("format adapter match must be a function");
  }
  if (typeof adapter.import !== "function" && typeof adapter.export !== "function") {
    throw new TypeError("format adapter must implement import or export");
  }
}

function roundTripFor(adapter, ir, fallbackVerdict) {
  let supported = false;
  try {
    supported = typeof adapter.canRoundTrip === "function" && adapter.canRoundTrip(ir) === true;
  } catch (_) {
    supported = false;
  }
  let verdict = supported ? normalizeVerdict(fallbackVerdict) : "UNVERIFIABLE";
  try {
    if (supported && typeof adapter.fidelity === "function") {
      const res = adapter.fidelity(ir) || {};
      verdict = normalizeVerdict(res.verdict || verdict);
    }
  } catch (_) {
    verdict = "UNVERIFIABLE";
  }
  return { supported, verdict };
}

function sourceFormatFor(input) {
  if (input && input.type) return String(input.type);
  if (input && input.name && String(input.name).includes(".")) {
    const parts = String(input.name).split(".");
    return parts[parts.length - 1].toLowerCase();
  }
  return "unknown";
}

export default { createAdapterRegistry, createUnknownFormatResult };
