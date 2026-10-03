// system/media/ir.js
// Canonical Media IR for the Telos universal media engine.
// Pure ES module, no DOM, no GPU. This is the language between adapters,
// graph nodes, renderers, receipts, CLI/MCP surfaces, and editor state.
//
// Receipts: payload hashes are always SHA-256 (Web Crypto when present, the
// pure module otherwise; both give the same digest), and every conversion receipt is sealed with
// `receiptSha256` over its canonical bytes (project-telos.canonical-bytes/v1), so a verifier in any
// language can re-derive it. The earlier FNV-1a 32-bit fallback is gone.
import { sha256HexAsync, utf8Bytes } from "../../shared-frame/sha256.js";
import { sealReceipt } from "../../shared-frame/canonical.js";

export const IR_SCHEMA = "project-telos.canonical-media-ir/v1";
export const CONVERSION_RECEIPT_SCHEMA = "project-telos.conversion-receipt/v1";

export const CANONICAL_MEDIA_KINDS = Object.freeze([
  "media.scene",
  "media.mesh",
  "media.splat",
  "media.volume",
  "media.image",
  "media.video",
  "media.audio",
  "media.vector",
  "media.table",
  "media.shader",
  "media.graph",
  "media.receipt",
]);

export const FIDELITY_VERDICTS = Object.freeze(["MATCH", "DRIFT", "UNVERIFIABLE"]);

export function createMediaDocument(kind, data = {}, meta = {}) {
  return Object.freeze({
    schema: IR_SCHEMA,
    kind: String(kind || ""),
    data,
    meta: {
      ...meta,
      createdAt: meta.createdAt || new Date(0).toISOString(),
    },
  });
}

export function validateMediaDocument(doc) {
  if (!doc || typeof doc !== "object") {
    return { ok: false, failureCode: "not_an_object" };
  }
  if (doc.schema !== IR_SCHEMA) {
    return { ok: false, failureCode: "wrong_schema" };
  }
  if (!CANONICAL_MEDIA_KINDS.includes(doc.kind)) {
    return { ok: false, failureCode: "unknown_media_kind" };
  }
  if (!("data" in doc)) {
    return { ok: false, failureCode: "missing_data" };
  }
  return { ok: true };
}

export async function buildConversionReceipt(opts = {}) {
  const fidelityVerdict = normalizeVerdict(opts.fidelityVerdict);
  const origin = await hashValue(opts.input);
  const result = await hashValue(opts.output);
  const roundTrip = normalizeRoundTrip(opts.roundTrip, fidelityVerdict);

  return sealReceipt({
    schema: CONVERSION_RECEIPT_SCHEMA,
    adapterId: String(opts.adapterId || "unknown"),
    adapterVersion: String(opts.adapterVersion || "0.0.0"),
    direction: opts.direction === "export" ? "export" : "import",
    conservedFields: arrayOfStrings(opts.conservedFields),
    droppedFields: arrayOfStrings(opts.droppedFields),
    fidelityVerdict,
    originHash: origin.hash,
    resultHash: result.hash,
    hashAlgo: "sha-256",
    roundTrip,
    warnings: arrayOfStrings(opts.warnings),
    failureCode: opts.failureCode ? String(opts.failureCode) : null,
  });
}

// SHA-256 of a value's stable JSON. `opts.subtle` overrides the Web Crypto source; null forces the
// pure path (the file:// case). The digest is the same either way.
export async function hashValue(value, opts = {}) {
  const bytes = utf8Bytes(stableStringify(value));
  const subtle = Object.prototype.hasOwnProperty.call(opts, "subtle") ? opts.subtle : undefined;
  return { hash: await sha256HexAsync(bytes, subtle), hashAlgo: "sha-256" };
}

export function normalizeVerdict(value) {
  return FIDELITY_VERDICTS.includes(value) ? value : "UNVERIFIABLE";
}

export function stableStringify(value) {
  if (value === undefined) return "\"[undefined]\"";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (value instanceof Uint8Array) return JSON.stringify(Array.from(value));
  if (ArrayBuffer.isView(value)) return JSON.stringify(Array.from(value));
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  return "{" + Object.keys(value).sort().map(k => JSON.stringify(k) + ":" + stableStringify(value[k])).join(",") + "}";
}

function normalizeRoundTrip(roundTrip, fallbackVerdict) {
  const r = roundTrip && typeof roundTrip === "object" ? roundTrip : {};
  return Object.freeze({
    supported: r.supported === true,
    verdict: normalizeVerdict(r.verdict || (r.supported ? fallbackVerdict : "UNVERIFIABLE")),
    notes: arrayOfStrings(r.notes),
  });
}

function arrayOfStrings(value) {
  return Array.isArray(value) ? value.map(String) : [];
}

export default {
  CANONICAL_MEDIA_KINDS,
  FIDELITY_VERDICTS,
  createMediaDocument,
  validateMediaDocument,
  buildConversionReceipt,
  hashValue,
  normalizeVerdict,
  stableStringify,
};
