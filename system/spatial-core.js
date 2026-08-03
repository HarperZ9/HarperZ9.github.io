// system/spatial-core.js
// Pure helpers for the spatial (hybrid world) renderer: seed derivation, veil
// layer parameters, the camera boundary, and splat kind mapping. No DOM, no
// GPU, node-testable. The GL renderer (spatial-scene.js) and the offline
// builder (art/spatial/build_scene.py) both follow the derivations here; the
// Python builder mirrors seedHash and mulberry32 bit for bit so the committed
// splat block and the browser-side layer fields agree on one seed.

// FNV-1a 32-bit, the same shape the rest of the site uses for seed strings.
export function seedHash(seed) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

// mulberry32: tiny deterministic PRNG over a 32-bit state.
export function mulberry32(state) {
  let a = state >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The splat kind vocabulary, as float ids inside the 40-byte record. Must
// match SPLAT_KINDS in engine/world-package.js and the builder.
export const KIND_IDS = Object.freeze({
  dust: 0,
  beam: 1,
  water: 2,
  stars: 3,
  spark: 4,
  bokeh: 5,
  haze: 6,
  glint: 7,
});

// Derive the folded-veil layer parameters from the scene seed. Each veil is an
// analytic surface the fragment shader draws: fold frequency, phase, drift
// rate, tint, and edge softness. Deterministic: one seed, one scene.
export function veilParams(seed, layers) {
  const rand = mulberry32(seedHash(seed));
  const out = [];
  for (const layer of layers) {
    out.push(Object.freeze({
      name: layer.name,
      depth: Number(layer.depth),
      foldFreq: 2.2 + rand() * 3.4,
      foldPhase: rand() * Math.PI * 2,
      foldTilt: (rand() - 0.5) * 0.9,
      driftRate: 0.05 + rand() * 0.1,
      tint: [0.62 + rand() * 0.3, 0.5 + rand() * 0.28, 0.42 + rand() * 0.3],
      edgeSoft: 0.16 + rand() * 0.2,
    }));
  }
  return out;
}

// Clamp a camera target to the package's declared boundary. The boundary is a
// contract, not a suggestion: the proof holds only inside it.
export function clampCamera(target, boundary) {
  const maxX = Math.abs(Number(boundary.maxX) || 0);
  const maxY = Math.abs(Number(boundary.maxY) || 0);
  const maxDolly = Math.abs(Number(boundary.maxDolly) || 0);
  return {
    x: clamp(Number(target.x) || 0, -maxX, maxX),
    y: clamp(Number(target.y) || 0, -maxY, maxY),
    z: clamp(Number(target.z) || 0, -maxDolly, maxDolly),
  };
}

// Layers draw back to front; ties keep manifest order (stable sort).
export function drawOrder(layers) {
  return layers
    .map((layer, index) => ({ layer, index }))
    .sort((a, b) => (b.layer.depth - a.layer.depth) || (a.index - b.index))
    .map((entry) => entry.layer);
}

// The temporal clock: wall time minus accumulated pause, frozen when asked.
// Kept as data-in data-out so the pause/freeze arithmetic is testable.
export function sceneTime(wallSeconds, motion) {
  if (Number.isFinite(motion.freezeAt)) return motion.freezeAt;
  if (motion.paused) return motion.pausedAt;
  return wallSeconds - motion.offset;
}

export function pauseMotion(wallSeconds, motion) {
  if (motion.paused) return motion;
  return { ...motion, paused: true, pausedAt: wallSeconds - motion.offset };
}

export function resumeMotion(wallSeconds, motion) {
  if (!motion.paused) return motion;
  return { ...motion, paused: false, offset: wallSeconds - motion.pausedAt };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export default {
  seedHash,
  mulberry32,
  KIND_IDS,
  veilParams,
  clampCamera,
  drawOrder,
  sceneTime,
  pauseMotion,
  resumeMotion,
};
