// system/media/studio-adapters.js
// Bridges the existing Studio import/export registries into the Canonical Media IR.
// This keeps current file support while making format work graph/CLI/MCP-ready.

import { StudioImporters } from "../importers.js";
import { StudioExporters } from "../exporters.js";
import { createMediaDocument, normalizeVerdict } from "./ir.js";

export const DEFAULT_STUDIO_FORMATS = Object.freeze([
  { id: "png", extensions: [".png", ".jpg", ".jpeg", ".gif", ".webp", ".avif", ".bmp"], mime: ["image/"], mediaKind: "media.image", exporter: "png", outputMime: "image/png", outputExtension: ".png" },
  { id: "svg", extensions: [".svg"], mime: ["image/svg"], mediaKind: "media.vector", exporter: "svg", outputMime: "image/svg+xml", outputExtension: ".svg" },
  { id: "video", extensions: [".mp4", ".mov", ".ogv"], mime: ["video/"], mediaKind: "media.video" },
  { id: "webm", extensions: [".webm"], mime: ["video/webm"], mediaKind: "media.video", exporter: "webm", outputMime: "video/webm", outputExtension: ".webm" },
  { id: "obj", extensions: [".obj"], mime: ["model/obj", "application/object"], mediaKind: "media.mesh", exporter: "obj", outputMime: "model/obj", outputExtension: ".obj" },
  { id: "gltf", extensions: [".gltf", ".glb"], mime: ["model/gltf+json", "model/gltf-binary"], mediaKind: "media.mesh", exporter: "gltf", outputMime: "model/gltf+json", outputExtension: ".gltf" },
  { id: "ply", extensions: [".ply"], mime: ["application/ply"], mediaKind: "media.mesh" },
  { id: "audio", extensions: [".wav", ".mp3", ".ogg", ".flac", ".aac", ".m4a"], mime: ["audio/"], mediaKind: "media.audio" },
  { id: "json", extensions: [".json"], mime: ["application/json"], mediaKind: "media.table", exporter: "json", outputMime: "application/json", outputExtension: ".json" },
  { id: "csv", extensions: [".csv"], mime: ["text/csv"], mediaKind: "media.table" },
]);

export function createStudioMediaAdapters(opts = {}) {
  const importers = opts.importers || StudioImporters;
  const exporters = opts.exporters || StudioExporters;
  const formats = opts.formats || DEFAULT_STUDIO_FORMATS;
  return formats.map(format => createStudioFormatAdapter(format, importers, exporters));
}

export function createStudioFormatAdapter(format, importers = StudioImporters, exporters = StudioExporters) {
  const fmt = normalizeFormat(format);
  const adapter = {
    id: "studio:" + fmt.id,
    version: "0.1.0",
    match: input => matchesFormat(input, fmt),
    "import": async (input, context = {}) => importThroughStudio(fmt, importers, input, context),
    canRoundTrip: ir => !!fmt.exporter && ir && ir.kind === fmt.mediaKind,
    fidelity: ir => ({ verdict: ir && ir.kind === fmt.mediaKind ? "MATCH" : "UNVERIFIABLE" }),
  };
  if (fmt.exporter) {
    adapter.export = async (ir, context = {}) => exportThroughStudio(fmt, exporters, ir, context);
  }
  return Object.freeze(adapter);
}

async function importThroughStudio(fmt, importers, input, context) {
  const canvas = context.canvas || null;
  const result = await importers.importFile(input, canvas, context.importOptions || context.receiptOptions || {});
  if (result.kind === "unknown" || result.kind === "error") {
    const failureCode = result.kind === "error" ? "studio_import_failed" : "unknown_format";
    return {
      ir: createFailureIR(fmt, input, result, failureCode),
      conservedFields: [],
      droppedFields: ["all-fields"],
      fidelityVerdict: "UNVERIFIABLE",
      warnings: compact([result.pluginPoint, result.meta && result.meta.error]),
    };
  }

  const mediaKind = mediaKindForStudioResult(result, fmt);
  return {
    ir: createMediaDocument(mediaKind, dataForStudioResult(result), {
      sourceFormat: sourceFormatFor(input, fmt),
      studioKind: result.kind,
      sourceName: input && input.name ? String(input.name) : "",
    }),
    conservedFields: conservedFieldsFor(result, mediaKind),
    droppedFields: droppedFieldsFor(result, mediaKind),
    fidelityVerdict: "MATCH",
    warnings: [],
  };
}

async function exportThroughStudio(fmt, exporters, ir, context) {
  if (!ir || ir.kind !== fmt.mediaKind) {
    return {
      bytes: "",
      mime: fmt.outputMime,
      extension: fmt.outputExtension,
      conservedFields: [],
      droppedFields: ["all-fields"],
      fidelityVerdict: "UNVERIFIABLE",
      warnings: ["IR kind does not match adapter media kind."],
    };
  }

  const canvas = context.canvas || {};
  const extra = extraForIR(ir, context.extra || {});
  const exported = typeof exporters.exportWithReceipt === "function"
    ? await exporters.exportWithReceipt(fmt.exporter, canvas, extra, context.exportOptions || context.receiptOptions || {})
    : { blobOrString: await exporters.export(fmt.exporter, canvas, extra), receipt: null };
  const receipt = exported.receipt || {};
  const discriminator = receipt.discriminatorPassed;
  const verdict = normalizeVerdict(discriminator === false ? "DRIFT" : "MATCH");

  return {
    bytes: exported.blobOrString,
    mime: fmt.outputMime,
    extension: fmt.outputExtension,
    conservedFields: arrayOrDefault(receipt.conserved, conservedFieldsForIR(ir)),
    droppedFields: arrayOrDefault(receipt.dropped, []),
    fidelityVerdict: verdict,
    roundTrip: { supported: true, verdict },
    warnings: discriminator === false ? ["Structural discriminator failed for Studio export."] : [],
  };
}

function createFailureIR(fmt, input, result, failureCode) {
  return createMediaDocument("media.receipt", {
    status: "UNVERIFIABLE",
    failureCode,
    studioKind: result.kind,
    meta: result.meta || {},
    pluginPoint: result.pluginPoint || null,
    sourceReceipt: result.receipt || null,
  }, {
    sourceFormat: sourceFormatFor(input, fmt),
    studioKind: result.kind,
    sourceName: input && input.name ? String(input.name) : "",
  });
}

function dataForStudioResult(result) {
  return {
    studioKind: result.kind,
    meta: result.meta || {},
    mesh: result.mesh || null,
    drewToCanvas: result.drewToCanvas === true,
    sourceReceipt: result.receipt || null,
  };
}

function extraForIR(ir, base) {
  const extra = { ...base };
  if (ir.data && ir.data.mesh && !extra.mesh) extra.mesh = ir.data.mesh;
  if (ir.kind === "media.vector" && !extra.vector) {
    extra.vector = ir.data && (ir.data.svg || ir.data.vector || ir.data.text);
  }
  if ((ir.kind === "media.table" || ir.kind === "media.receipt") && extra.data === undefined) {
    extra.data = ir.data;
  }
  return extra;
}

function mediaKindForStudioResult(result, fmt) {
  switch (result.kind) {
    case "image": return "media.image";
    case "video": return "media.video";
    case "svg": return "media.vector";
    case "obj":
    case "gltf":
    case "ply": return "media.mesh";
    case "audio": return "media.audio";
    case "data": return "media.table";
    default: return fmt.mediaKind || "media.receipt";
  }
}

function conservedFieldsFor(result, mediaKind) {
  const fields = ["metadata"];
  if (result.mesh) fields.push("mesh");
  if (result.drewToCanvas) fields.push("preview");
  if (mediaKind === "media.audio") fields.push("audio-buffer");
  if (mediaKind === "media.table") fields.push("table-preview");
  if (mediaKind === "media.vector") fields.push("vector-raster-preview");
  return fields;
}

function conservedFieldsForIR(ir) {
  if (ir.kind === "media.mesh") return ["mesh", "metadata"];
  if (ir.kind === "media.vector") return ["vector", "metadata"];
  if (ir.kind === "media.table") return ["table", "metadata"];
  if (ir.kind === "media.image") return ["pixels", "metadata"];
  if (ir.kind === "media.video") return ["frames", "metadata"];
  if (ir.kind === "media.audio") return ["audio", "metadata"];
  return ["metadata"];
}

function droppedFieldsFor(result, mediaKind) {
  if (mediaKind === "media.mesh") return ["materials", "animation"];
  if (mediaKind === "media.image") return ["layers"];
  if (mediaKind === "media.video") return ["full-timeline"];
  if (mediaKind === "media.audio") return ["sample-accurate-edit-graph"];
  return [];
}

function matchesFormat(input, fmt) {
  const name = input && input.name ? String(input.name).toLowerCase() : "";
  const type = input && input.type ? String(input.type).toLowerCase() : "";
  if (fmt.extensions.some(ext => name.endsWith(ext))) return true;
  return fmt.mime.some(prefix => type === prefix || type.startsWith(prefix));
}

function sourceFormatFor(input, fmt) {
  const name = input && input.name ? String(input.name).toLowerCase() : "";
  const type = input && input.type ? String(input.type) : "";
  const ext = fmt.extensions.find(e => name.endsWith(e));
  if (ext) return ext.slice(1);
  return type || fmt.id;
}

function normalizeFormat(format) {
  return Object.freeze({
    id: String(format.id || "unknown"),
    extensions: (format.extensions || []).map(v => String(v).toLowerCase()),
    mime: (format.mime || []).map(v => String(v).toLowerCase()),
    mediaKind: String(format.mediaKind || "media.receipt"),
    exporter: format.exporter ? String(format.exporter) : null,
    outputMime: String(format.outputMime || "application/octet-stream"),
    outputExtension: String(format.outputExtension || ""),
  });
}

function arrayOrDefault(value, fallback) {
  return Array.isArray(value) ? value.map(String) : fallback;
}

function compact(values) {
  return values.filter(v => v !== undefined && v !== null && String(v).length > 0).map(String);
}

export default {
  DEFAULT_STUDIO_FORMATS,
  createStudioMediaAdapters,
  createStudioFormatAdapter,
};
