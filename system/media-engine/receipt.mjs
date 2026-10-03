// system/media-engine/receipt.mjs
// The one receipt layer for engine frames and for receipted media files.
//
// Hashing goes through shared-frame/sha256.js (Web Crypto when present, a pure SHA-256 otherwise),
// and requests are canonicalised by system/media/ir.js, so a frame receipt and a media-document
// receipt hash the same way. Two modules (studio-spatial.js, spatial-atlas.js) used to carry their
// own Web Crypto digest; they now call digestOrNull() below.

import { hashValue, stableStringify } from "../media/ir.js";
import { sha256HexAsync } from "../../shared-frame/sha256.js";

// SHA-256 hex of bytes through Web Crypto only, or null where there is none (an insecure context).
// Callers that must report UNVERIFIABLE rather than compute a digest in script use this one.
export async function digestOrNull(bytes) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return null;
  const buf = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// SHA-256 hex of bytes, always: Web Crypto when present, the shared pure implementation otherwise.
export function digest(bytes) { return sha256HexAsync(bytes); }

// Compare bytes against an expected SHA-256 and name the verdict the site uses everywhere.
export async function verifyBytes(bytes, expected) {
  const hex = await digestOrNull(bytes);
  if (hex == null || !expected) return { verdict: "UNVERIFIABLE", hash: hex };
  return { verdict: hex === expected ? "MATCH" : "DRIFT", hash: hex };
}

// frameReceipt: what was asked for (plugin, version, params, seed, time, backend) and what came out
// (a SHA-256 of the RGBA bytes). Re-rendering the same request on the same backend and device class
// must give the same pixel hash; across GPUs it may not, and the receipt names the backend so a
// mismatch is attributable rather than silent.
export async function frameReceipt(request, rgba) {
  const req = await hashValue(request);
  const pixels = rgba ? await sha256HexAsync(rgba) : null;
  return {
    schema: "media-engine.frame-receipt.v1",
    request,
    requestHash: req.hash,
    hashAlgo: req.hashAlgo,
    pixelHash: pixels,
    pixelBytes: rgba ? rgba.length : 0,
  };
}

export { stableStringify };
