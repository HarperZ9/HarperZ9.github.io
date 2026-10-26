// system/media-engine/seed.mjs
// The one seeded-randomness layer for every visual surface. Its only import is contracts.mjs, the
// vendored superstack v0.2.0 file (pinned by SHA-256 in SUPERSTACK.sha256), so a plotter, a glitch
// op or a worker can load it without pulling the receipt or WebGL code along.
//
// The seed rule is the contract's, `xmur3-mulberry32/1`: xmur3 over UTF-16 code units, then
// mulberry32. The site drew its seeded plates this way before the contract existed, and the
// contract fixed its rule to UTF-16 units so those streams stay where they were; the contract's
// vectors include this module's first draws for "folded-light". The FNV-1a path (rngFrom) is the
// legacy rule `fnv1a32-mulberry32`, kept under its own id so older artefacts keep their draws.
//
// Before this module the same PRNG was pasted into eighteen modules under four names and the same
// FNV-1a string hash into nine. Every copy was checked against these functions over 12 seeds x
// 2,000 draws and 6 strings before it was replaced, so a seed that drew a plate before draws the
// same plate now.

import { Mulberry32, xmur3 as contractXmur3, SEED_RULE, substream } from "./contracts.mjs";

export { SEED_RULE, substream };

// The legacy rule id for rngFrom and every module that hashes a string with fnv1a32 first.
export const LEGACY_SEED_RULE = "fnv1a32-mulberry32";

// mulberry32 (Tommy Ettinger, CC0). Any number in (read as uint32), a stream of floats in [0, 1).
export function mulberry32(seed) {
  const m = new Mulberry32(seed);
  return () => m.nextFloat();
}

// FNV-1a over UTF-16 code units, 32 bits. Any value is read as a string first. The contract keeps
// FNV out of receipts; here it only turns a string into a legacy seed or a bucket key.
export function fnv1a32(value) {
  let h = 0x811c9dc5;
  const s = String(value);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// The same FNV-1a value as 8 lowercase hex digits, for modules that content-address with it.
export function fnv1a32Hex(value) { return fnv1a32(value).toString(16).padStart(8, "0"); }

// A stream from a seed of any type: a function passes through (callers inject their own rng),
// anything else is hashed with FNV-1a and fed to mulberry32. null and undefined mean seed 1.
// This is the glitch-ops contract, kept exactly.
export function rngFrom(seed) {
  if (typeof seed === "function") return seed;
  return mulberry32(fnv1a32(seed == null ? 1 : seed));
}

// xmur3 of a string: the contract's seed_u32. (The Atelier's copy returned a function that kept
// mixing on each call; every caller called it once, which is this value.)
export const xmur3 = contractXmur3;

// The contract's default rule: a string seed (any value is read as a string) to a float stream.
export function makeRng(seed) { return mulberry32(contractXmur3(String(seed))); }

// A float in [0, 1) fixed by the seed alone, for plugins that want one scalar (a shader seed).
export function seedScalar(seed) { return makeRng(seed)(); }
