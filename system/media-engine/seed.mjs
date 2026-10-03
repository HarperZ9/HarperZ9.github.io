// system/media-engine/seed.mjs
// The one seeded-randomness layer for every visual surface. Pure ES module with no imports, so a
// plotter, a glitch op or a worker can load it without pulling the receipt or WebGL code along.
//
// Before this module the same PRNG was pasted into eighteen modules under four names (mulberry32,
// mulberry, rng, rngFrom) and the same FNV-1a string hash into nine (hash32, seedHash). Every copy
// was checked against these functions over 12 seeds x 2,000 draws and 6 strings before it was
// replaced, so a seed that drew a plate before draws the same plate now.

// mulberry32 (Tommy Ettinger). Any number in, a stream of floats in [0, 1) out.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// FNV-1a over UTF-16 code units, 32 bits. Any value is read as a string first.
export function fnv1a32(value) {
  let h = 0x811c9dc5;
  const s = String(value);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// A stream from a seed of any type: a function passes through (callers inject their own rng),
// anything else is hashed with FNV-1a and fed to mulberry32. null and undefined mean seed 1.
// This is the glitch-ops contract, kept exactly.
export function rngFrom(seed) {
  if (typeof seed === "function") return seed;
  return mulberry32(fnv1a32(seed == null ? 1 : seed));
}

// The Atelier's seeding (system/atelier.js): xmur3 string hash into mulberry32.
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

export function makeRng(seed) { return mulberry32(xmur3(String(seed))()); }

// A float in [0, 1) fixed by the seed alone, for plugins that want one scalar (a shader seed).
export function seedScalar(seed) { return makeRng(seed)(); }
