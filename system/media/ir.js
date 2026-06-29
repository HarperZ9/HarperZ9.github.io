// system/media/ir.js
// Canonical Media IR for the Telos universal media engine.
// Pure ES module, no DOM, no GPU. This is the language between adapters,
// graph nodes, renderers, receipts, CLI/MCP surfaces, and editor state.

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

  return Object.freeze({
    schema: CONVERSION_RECEIPT_SCHEMA,
    adapterId: String(opts.adapterId || "unknown"),
    adapterVersion: String(opts.adapterVersion || "0.0.0"),
    direction: opts.direction === "export" ? "export" : "import",
    conservedFields: arrayOfStrings(opts.conservedFields),
    droppedFields: arrayOfStrings(opts.droppedFields),
    fidelityVerdict,
    originHash: origin.hash,
    resultHash: result.hash,
    hashAlgo: origin.hashAlgo === result.hashAlgo ? origin.hashAlgo : origin.hashAlgo + "+" + result.hashAlgo,
    roundTrip,
    warnings: arrayOfStrings(opts.warnings),
    failureCode: opts.failureCode ? String(opts.failureCode) : null,
  });
}

export async function hashValue(value, opts = {}) {
  const bytes = utf8(stableStringify(value));
  if (opts.forceFallback) return { hash: fnv1a(bytes), hashAlgo: "fnv1a-fallback" };
  try {
    const subtle = globalThis.crypto && globalThis.crypto.subtle;
    if (subtle && typeof subtle.digest === "function") {
      const buf = await subtle.digest("SHA-256", bytes);
      return { hash: toHex(new Uint8Array(buf)), hashAlgo: "sha-256" };
    }
  } catch (_) {
    // fall through to honest fallback
  }
  return { hash: fnv1a(bytes), hashAlgo: "fnv1a-fallback" };
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

function utf8(str) {
  if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(str);
  const out = [];
  for (let i = 0; i < str.length; i++) out.push(str.charCodeAt(i) & 0xff);
  return new Uint8Array(out);
}

function toHex(bytes) {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2, "0");
  return hex;
}

function fnv1a(bytes) {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ("00000000" + h.toString(16)).slice(-8);
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
