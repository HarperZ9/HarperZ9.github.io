// SPDX-License-Identifier: FSL-1.1-MIT
// Copyright 2026 Zain Dana Harper
//
// substrate/provenance: receipts for any asset a lane makes (a chart, a plate, a clip, a file),
// with lineage to the assets it came from and a licence basis that can only tighten.
//
// It adds no hash or JSON code of its own. The canonical form, SHA-256 and seal are the vendored
// superstack v0.2.0 file (vendor/superstack.mjs, pinned in vendor/SUPERSTACK.sha256), so an asset
// receipt and a superstack frame receipt hash the same way. The licence rule (the most
// restrictive input wins, and a missing licence reads "unknown") is a JS port of the idea in
// open-archives licence.py, written fresh here.
//
//   const rec = assetReceipt({ name: "fig-1", producer: "fw-report", content: bytes, licence: "CC-BY-4.0" });
//   verifyAsset(rec, bytes)   // [] when the seal and the content hash hold

import { canonicalSha256, sha256, seal } from "./vendor/superstack.mjs";

export const ASSET_SCHEMA = "substrate.asset/1";
const HEX64 = /^[0-9a-f]{64}$/;
const enc = new TextEncoder();

// Licences ordered from least to most restrictive. "unknown" ranks last: an asset whose terms
// nobody recorded is treated as the strictest case until someone records them.
export const LICENCE_ORDER = Object.freeze([
  "CC0-1.0", "MIT", "CC-BY-4.0", "CC-BY-SA-4.0", "CC-BY-NC-4.0", "CC-BY-NC-SA-4.0",
  "CC-BY-ND-4.0", "CC-BY-NC-ND-4.0", "all-rights-reserved", "unknown",
]);
const NO_DERIVATIVES = new Set(["CC-BY-ND-4.0", "CC-BY-NC-ND-4.0", "all-rights-reserved", "unknown"]);

const ALIASES = {
  "public domain": "CC0-1.0", pd: "CC0-1.0", cc0: "CC0-1.0", "cc-0": "CC0-1.0",
  "cc by": "CC-BY-4.0", "cc-by": "CC-BY-4.0", "cc by-sa": "CC-BY-SA-4.0", "cc-by-sa": "CC-BY-SA-4.0",
  "cc by-nc": "CC-BY-NC-4.0", "cc-by-nc": "CC-BY-NC-4.0", "cc by-nc-sa": "CC-BY-NC-SA-4.0",
  "cc by-nd": "CC-BY-ND-4.0", "cc by-nc-nd": "CC-BY-NC-ND-4.0", arr: "all-rights-reserved",
  "all rights reserved": "all-rights-reserved", copyright: "all-rights-reserved",
};

// Any spelling to an id in LICENCE_ORDER. Anything unrecognised is "unknown", never a guess.
export function normaliseLicence(value) {
  if (value == null || value === "") return "unknown";
  const s = String(value).trim();
  if (LICENCE_ORDER.includes(s)) return s;
  const low = s.toLowerCase().replace(/\s+4\.0$/, "").replace(/_/g, "-");
  if (ALIASES[low]) return ALIASES[low];
  const upper = s.toUpperCase();
  const hit = LICENCE_ORDER.find((id) => id.toUpperCase() === upper || id.toUpperCase() === upper + "-4.0");
  return hit || "unknown";
}

const rank = (id) => LICENCE_ORDER.indexOf(normaliseLicence(id));

// The basis of a work made from several inputs: the most restrictive one.
export function licenceBasis(licences) {
  const list = (licences || []).map(normaliseLicence);
  if (!list.length) return "unknown";
  return list.reduce((a, b) => (rank(b) > rank(a) ? b : a));
}

// True when a derivative of this licence may be made without asking the holder.
export const derivable = (licence) => !NO_DERIVATIVES.has(normaliseLicence(licence));

const toBytes = (content) => {
  if (content instanceof Uint8Array) return content;
  if (typeof content === "string") return enc.encode(content);
  if (content instanceof ArrayBuffer) return new Uint8Array(content);
  if (ArrayBuffer.isView(content)) return new Uint8Array(content.buffer, content.byteOffset, content.byteLength);
  throw new TypeError("provenance: content must be bytes or a string");
};

// A sealed receipt for one asset. `inputs` are the receipts of the assets it was made from.
export function assetReceipt({
  name, producer, version = null, media = "application/octet-stream", content, licence, creator = null,
  title = null, source = null, operation = null, inputs = [],
}) {
  if (!name || !producer) throw new TypeError("provenance: name and producer are required");
  const bytes = toBytes(content);
  const own = normaliseLicence(licence);
  const ins = inputs.map((r) => ({
    name: r.name, receipt_sha256: r.receipt_sha256, content_sha256: r.content_sha256, basis: r.licence.basis,
  }));
  const basis = licenceBasis([own, ...ins.map((i) => i.basis)]);
  const blocked = ins.filter((i) => !derivable(i.basis)).map((i) => i.name);
  return seal({
    schema: ASSET_SCHEMA,
    name: String(name), producer: { name: String(producer), version },
    media, bytes: bytes.length, content_sha256: sha256(bytes),
    title, creator, source, operation,
    licence: { own, basis, derivable: derivable(basis), blocked_inputs: blocked },
    inputs: ins,
    covers: ["the content bytes", "the fields of this receipt", ins.length ? "the receipt hashes of its inputs" : "no inputs"],
  });
}

// Problems with a receipt, as sorted short codes. An empty list means it holds.
// With `content`, the bytes are re-hashed and compared too.
export function verifyAsset(rec, content) {
  if (!rec || typeof rec !== "object") return ["type"];
  const errs = [];
  if (rec.schema !== ASSET_SCHEMA) errs.push("schema");
  for (const k of ["content_sha256", "receipt_sha256"]) if (!HEX64.test(rec[k] || "")) errs.push("hex:" + k);
  const body = {};
  for (const k of Object.keys(rec)) if (k !== "receipt_sha256") body[k] = rec[k];
  if (!errs.length && canonicalSha256(body) !== rec.receipt_sha256) errs.push("seal");
  const ins = Array.isArray(rec.inputs) ? rec.inputs : [];
  const want = licenceBasis([rec.licence && rec.licence.own, ...ins.map((i) => i.basis)]);
  if (!rec.licence || rec.licence.basis !== want) errs.push("licence:basis");
  if (content !== undefined) {
    const b = toBytes(content);
    if (sha256(b) !== rec.content_sha256) errs.push("content");
    if (b.length !== rec.bytes) errs.push("bytes");
  }
  return errs.sort();
}

// Walk a receipt's inputs through `store` (receipt_sha256 -> receipt). Every input must be found,
// must verify, and must carry the content hash the child recorded.
export function verifyLineage(rec, store) {
  const lookup = store instanceof Map ? (h) => store.get(h) : (h) => store[h];
  const errors = [];
  let depth = 0;
  const seen = new Set();
  const walk = (r, d) => {
    depth = Math.max(depth, d);
    for (const e of verifyAsset(r)) errors.push(`${r.name}:${e}`);
    for (const i of r.inputs || []) {
      if (seen.has(i.receipt_sha256)) continue;
      seen.add(i.receipt_sha256);
      const parent = lookup(i.receipt_sha256);
      if (!parent) { errors.push(`${r.name}:missing-input:${i.name}`); continue; }
      if (parent.content_sha256 !== i.content_sha256) errors.push(`${r.name}:input-content:${i.name}`);
      walk(parent, d + 1);
    }
  };
  walk(rec, 0);
  return { ok: errors.length === 0, errors, depth };
}

// A TASL line (title, author, source, licence) for credits.
export function attribution(rec) {
  const t = rec.title || rec.name;
  const parts = [`"${t}"`, rec.creator ? `by ${rec.creator}` : "creator not recorded"];
  if (rec.source) parts.push(`from ${rec.source}`);
  parts.push(rec.licence.basis === "unknown" ? "licence unknown" : `licence ${rec.licence.basis}`);
  return parts.join(", ");
}

const xmlText = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const STAMP_RE = /<metadata id="substrate-asset">([\s\S]*?)<\/metadata>/;

// Put the receipt inside the SVG as <metadata>. An existing stamp is replaced.
export function stampSvg(svg, rec) {
  const node = `<metadata id="substrate-asset">${xmlText(JSON.stringify(rec))}</metadata>`;
  if (STAMP_RE.test(svg)) return svg.replace(STAMP_RE, node);
  const open = svg.match(/<svg\b[^>]*>/);
  if (!open) throw new TypeError("provenance: not an SVG document");
  const at = open.index + open[0].length;
  return svg.slice(0, at) + node + svg.slice(at);
}

// The receipt stamped into an SVG, or null.
export function readSvgStamp(svg) {
  const m = String(svg).match(STAMP_RE);
  if (!m) return null;
  const json = m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
  try { return JSON.parse(json); } catch (err) {
    throw new SyntaxError("provenance: the SVG stamp is not valid JSON: " + err.message);
  }
}
