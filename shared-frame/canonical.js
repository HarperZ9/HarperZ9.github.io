// canonical.js: canonical bytes for receipts, `project-telos.canonical-bytes/v1`, and their SHA-256.
//
// A receipt verified in another language must hash to the same digest, so its bytes cannot depend on
// how a runtime prints numbers or orders keys. The rules, fixed before the code was written:
//   - UTF-8; object keys sorted by UTF-16 code unit; no insignificant whitespace;
//   - strings escaped as JSON with only `"`, `\`, \b, \f, \n, \r, \t and \u00XX (lowercase hex) for the
//     other C0 controls; everything else written raw; strings with lone surrogates are rejected;
//   - numbers only as safe integers (|n| <= 2^53 - 1), so fractional values travel as fixed-decimal
//     strings chosen by the caller; NaN, infinities, fractions, undefined, functions, typed arrays and
//     non-plain objects are rejected with a CanonicalError naming the path.
// The Python twin (canonical_receipt.py in the site repository) follows the same rules with the
// standard library only. ASCII only.
import { sha256Hex, utf8Bytes } from "./sha256.js";

export const CANONICAL_SCHEMA = "project-telos.canonical-bytes/v1";

export class CanonicalError extends Error {
  constructor(code, path) {
    super(code + " at " + (path || "$"));
    this.name = "CanonicalError";
    this.code = code;
    this.path = path || "$";
  }
}

const ESC = { 0x22: '\\"', 0x5c: "\\\\", 0x08: "\\b", 0x0c: "\\f", 0x0a: "\\n", 0x0d: "\\r", 0x09: "\\t" };

function wellFormed(s) {
  if (typeof s.isWellFormed === "function") return s.isWellFormed();
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const d = s.charCodeAt(i + 1);
      if (!(d >= 0xdc00 && d <= 0xdfff)) return false;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) return false;
  }
  return true;
}

function quote(s, path) {
  if (!wellFormed(s)) throw new CanonicalError("lone_surrogate", path);
  let out = '"';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (ESC[c]) out += ESC[c];
    else if (c < 0x20) out += "\\u00" + c.toString(16).padStart(2, "0");
    else out += s[i];
  }
  return out + '"';
}

function isPlainObject(v) {
  if (v === null || typeof v !== "object") return false;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
}

function enc(v, path) {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "string") return quote(v, path);
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new CanonicalError("non_finite_number", path);
    if (!Number.isInteger(v)) throw new CanonicalError("non_integer_number", path);
    if (!Number.isSafeInteger(v)) throw new CanonicalError("unsafe_integer", path);
    return String(v); // -0 prints "0"
  }
  if (Array.isArray(v)) return "[" + v.map((x, i) => enc(x, path + "[" + i + "]")).join(",") + "]";
  if (isPlainObject(v)) {
    const keys = Object.keys(v).sort();
    return "{" + keys.map((k) => {
      if (v[k] === undefined) throw new CanonicalError("undefined_value", path + "." + k);
      return quote(k, path + "#key") + ":" + enc(v[k], path + "." + k);
    }).join(",") + "}";
  }
  throw new CanonicalError("unsupported_type:" + (v === undefined ? "undefined" : typeof v === "object" ? (v.constructor && v.constructor.name) || "object" : typeof v), path);
}

// The canonical text of a value (throws CanonicalError on anything outside the rules).
export function canonicalString(value) {
  return enc(value, "$");
}

export function canonicalBytes(value) {
  return utf8Bytes(canonicalString(value));
}

// SHA-256 hex over the canonical bytes of a receipt.
export function receiptSha256(value) {
  return sha256Hex(canonicalBytes(value));
}

// Return a frozen copy of `receipt` with `canonical` and `receiptSha256` added, the digest taken over
// every other field (including `canonical`). A verifier drops `receiptSha256` and re-derives it.
export function sealReceipt(receipt) {
  const body = { ...receipt, canonical: CANONICAL_SCHEMA };
  delete body.receiptSha256;
  return Object.freeze({ ...body, receiptSha256: receiptSha256(body) });
}

// Re-derive a sealed receipt's digest. Returns true only when the stored digest matches.
export function verifyReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || typeof receipt.receiptSha256 !== "string") return false;
  const body = { ...receipt };
  delete body.receiptSha256;
  try { return receiptSha256(body) === receipt.receiptSha256; } catch (_) { return false; }
}
