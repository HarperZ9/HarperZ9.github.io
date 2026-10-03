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

// Reconcile a frame against a reference render of the same request: RMSE and maximum error over
// RGB on a 0..1 scale (the scale raw-native's certificates use), and a verdict against a tolerance.
// Different sizes, or a missing reference, read UNVERIFIABLE rather than a number.
export function reconcile(rgba, reference, { tolerance = 2 / 255 } = {}) {
  if (!rgba || !reference || rgba.length !== reference.length || !rgba.length) {
    return { verdict: "UNVERIFIABLE", rmse: null, maxError: null, pixels: 0, tolerance };
  }
  let sq = 0, max = 0, n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      const d = Math.abs(rgba[i + c] - reference[i + c]) / 255;
      sq += d * d; if (d > max) max = d; n++;
    }
  }
  const rmse = Math.sqrt(sq / n);
  return { verdict: rmse <= tolerance ? "MATCH" : "DRIFT", rmse: +rmse.toFixed(6), maxError: +max.toFixed(6), pixels: n / 3, tolerance };
}

// frameReceipt: what was asked for (plugin, version, params, seed, time, backend) and what came out
// (a SHA-256 of the RGBA bytes). Re-rendering the same request on the same backend and device class
// must give the same pixel hash; across GPUs it may not, and the receipt names the backend so a
// mismatch is attributable rather than silent.
//
// referenceBackend names the exact backend the frame was checked against ("wasm-raw" for the
// raw-native core) and reconcile carries the result; with no reference both say so explicitly.
export async function frameReceipt(request, rgba, { referenceBackend = null, reconcile: rec = null } = {}) {
  const req = await hashValue(request);
  const pixels = rgba ? await sha256HexAsync(rgba) : null;
  return {
    schema: "media-engine.frame-receipt.v2",
    request,
    requestHash: req.hash,
    hashAlgo: req.hashAlgo,
    pixelHash: pixels,
    pixelBytes: rgba ? rgba.length : 0,
    referenceBackend,
    reconcile: rec || { verdict: "UNVERIFIABLE", rmse: null, maxError: null, pixels: 0, reason: referenceBackend ? "reference render failed" : "no reference backend" },
  };
}

export { stableStringify };
