// system/media-engine/seed.mjs
// The one seed and receipt layer for every engine plugin. Pure ES module.
//
// The PRNG is the Atelier's xmur3 + mulberry32 pair (system/atelier.js), so a seed string
// that drew an Atelier plate draws the same stream here. Canonical bytes and SHA-256 come
// from system/media/ir.js, so a frame receipt and a media-document receipt hash the same way.

import { stableStringify, hashValue } from "../media/ir.js";

export function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

export function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed) { return mulberry32(xmur3(String(seed))()); }

// A float in [0, 1) fixed by the seed alone, for plugins that want one scalar (a shader seed).
export function seedScalar(seed) { return makeRng(seed)(); }

async function sha256Bytes(bytes) {
  const subtle = globalThis.crypto && globalThis.crypto.subtle;
  if (!subtle) return null;                       // honest null: no digest, no claim
  const buf = await subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

// frameReceipt: what was asked for (plugin, version, params, seed, time, backend) and what
// came out (a SHA-256 of the RGBA bytes). Re-rendering the same request on the same backend
// and device class must give the same pixel hash; across GPUs it may not, and the receipt
// says which backend drew it so a mismatch is attributable rather than silent.
export async function frameReceipt(request, rgba) {
  const req = await hashValue(request);
  const pixels = rgba ? await sha256Bytes(rgba) : null;
  return {
    schema: "media-engine.frame-receipt.v0",
    request,
    requestHash: req.hash,
    hashAlgo: req.hashAlgo,
    pixelHash: pixels,
    pixelBytes: rgba ? rgba.length : 0,
  };
}

export { stableStringify };
