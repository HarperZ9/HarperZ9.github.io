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
  const anchors = [
    { tilt: -0.55, width: 0.51, offset: -0.10, warp: 0.11, twist: 0.30, bow: -0.04, scale: 1.07, tint: [0.62, 0.55, 0.48] },
    { tilt: 0.45, width: 0.43, offset: 0.12, warp: 0.15, twist: -0.38, bow: 0.03, scale: 1.01, tint: [0.70, 0.56, 0.48] },
    { tilt: -0.18, width: 0.34, offset: 0.02, warp: 0.22, twist: 0.58, bow: 0.06, scale: 0.97, tint: [0.86, 0.62, 0.47] },
    { tilt: 0.28, width: 0.27, offset: -0.08, warp: 0.29, twist: -0.66, bow: 0.09, scale: 0.92, tint: [0.92, 0.72, 0.52] },
  ];
  const out = [];
  for (const layer of layers) {
    const depth = Number(layer.depth);
    const anchor = anchors[out.length % anchors.length];
    out.push(Object.freeze({
      name: layer.name,
      depth,
      // Broad sculptural folds with separate fine ridges: the old high-
      // frequency surface read as screen-wide slats instead of a light object.
      foldFreq: 5.8 + rand() * 4.8,
      ridgeFreq: 16.0 + rand() * 15.0,
      foldPhase: rand() * Math.PI * 2,
      foldTilt: anchor.tilt + (rand() - 0.5) * 0.16,
      driftRate: 0.05 + rand() * 0.1,
      tint: [
        clamp(anchor.tint[0] + (rand() - 0.5) * 0.10, 0.1, 1),
        clamp(anchor.tint[1] + (rand() - 0.5) * 0.09, 0.1, 1),
        clamp(anchor.tint[2] + (rand() - 0.5) * 0.08, 0.1, 1),
      ],
      edgeSoft: 0.09 + rand() * 0.07,
      // Sculptural ribbon grammar. Deep layers stay broader and quieter;
      // near layers pinch into tighter folded foreground forms with more relief.
      ribbonWidth: clamp(anchor.width + rand() * 0.035, 0.24, 0.72),
      ribbonOffset: clamp(anchor.offset + (rand() - 0.5) * 0.10, -0.34, 0.34),
      warpAmp: clamp(anchor.warp + rand() * 0.035, 0.08, 0.34),
      twist: clamp(anchor.twist + (rand() - 0.5) * 0.18, -0.96, 0.96),
      apertureFreq: 2.20 + rand() * 2.55,
      aperturePhase: rand() * Math.PI * 2,
      apertureSoft: 0.12 + rand() * 0.13,
      verticalBow: anchor.bow + (rand() - 0.5) * 0.05,
      surfaceScale: anchor.scale + (rand() - 0.5) * 0.05,
    }));
  }
  return out;
}

export function foldedSurfaceSample(veil, sample = {}) {
  const u = clamp(Number(sample.u), 0, 1);
  const v = clamp(Number(sample.v), 0, 1);
  const time = Number.isFinite(sample.time) ? Number(sample.time) : 0;
  const aspect = Number.isFinite(sample.aspect) && sample.aspect > 0 ? Number(sample.aspect) : 1;
  const drift = Number.isFinite(sample.drift) ? Number(sample.drift) : 0;
  const depth = clamp(Number(veil.depth), 0, 1);
  const pX = u * 2 - 1;
  const pY = v * 2 - 1;
  const ca = Math.cos(veil.foldTilt || 0);
  const sa = Math.sin(veil.foldTilt || 0);
  const axis = pX * ca + pY * sa + (veil.ribbonOffset || 0);
  const crossAxis = -pX * sa + pY * ca;
  const breath = time * (veil.driftRate || 0) * (0.35 + drift);
  const fold = Math.sin(axis * (veil.foldFreq || 1) + (veil.foldPhase || 0) + breath);
  const minor = Math.sin(axis * (veil.foldFreq || 1) * 0.43 - (veil.foldPhase || 0) * 0.7 + crossAxis * 3.4);
  const ribbonWidth = Math.max(0.001, veil.ribbonWidth || 0.42);
  const crossWarp = crossAxis + minor * 0.055 + fold * (veil.twist || 0) * 0.045;
  const ribbon = 1 - smoothstep(ribbonWidth * 0.35, ribbonWidth, Math.abs(crossWarp));
  const core = 1 - smoothstep(ribbonWidth * 0.10, ribbonWidth * 0.36, Math.abs(crossWarp));
  const apertureWave = Math.sin(axis * (veil.apertureFreq || 2) + (veil.aperturePhase || 0) + minor * 0.4) * 0.5 + 0.5;
  const apertureSoft = Number.isFinite(veil.apertureSoft) ? Number(veil.apertureSoft) : 0;
  const hole = smoothstep(0.52 - apertureSoft * 0.16, 0.80, apertureWave) * core;
  const focal = Math.hypot(pX * 1.05, (pY + 0.02 + (depth - 0.55) * 0.14) * 0.86);
  const focalCore = 1 - smoothstep(0.16, 0.36, focal);
  const axisLimit = 0.88 + depth * 0.22;
  const axisTaper = 1 - smoothstep(axisLimit, axisLimit + 0.38, Math.abs(axis));
  const edge = (1 - smoothstep(0.90, 1.0, Math.abs(pX))) *
    (1 - smoothstep(0.90, 1.0, Math.abs(pY)));
  const visible = clamp(ribbon * axisTaper * (1 - hole * 0.28) * (1 - focalCore * 0.60), 0, 1) * edge;
  const spread = mix(1.02, 1.56, depth) * (veil.surfaceScale || 1);
  const sculptAxis = axis + minor * 0.035;
  const sculptCross = crossWarp + fold * (veil.twist || 0) * 0.055;
  const rx = sculptAxis * ca - sculptCross * sa;
  const ry = sculptAxis * sa + sculptCross * ca;
  const bow = (veil.verticalBow || 0) * (1 - pY * pY);
  const relief = (fold * (veil.warpAmp || 0.12) + minor * (veil.warpAmp || 0.12) * 0.35) * (0.25 + ribbon * 0.75);
  const ridge = smoothstep(0.62, 0.98, Math.abs(fold));
  return {
    position: [
      rx * spread * aspect,
      ry * spread + bow + fold * 0.025,
      -(1.2 + depth * 4.0) + relief,
    ],
    axis,
    cross: crossWarp,
    ribbon,
    hole,
    focalAperture: focalCore,
    axisTaper,
    edge,
    visible,
    alpha: visible * (0.18 + ridge * 0.82),
  };
}

export function foldedSurfaceStats(veils, opts = {}) {
  const cols = Math.max(2, Math.floor(Number(opts.cols) || 17));
  const rows = Math.max(2, Math.floor(Number(opts.rows) || 17));
  const aspect = Number.isFinite(opts.aspect) && opts.aspect > 0 ? Number(opts.aspect) : 1;
  let visible = 0, holes = 0, total = 0;
  let maxAbsX = 0, maxAbsY = 0, minZ = Infinity, maxZ = -Infinity;
  const layers = [];
  for (const veil of veils || []) {
    let layerVisible = 0, layerHoles = 0, layerTotal = 0;
    let layerMinZ = Infinity, layerMaxZ = -Infinity;
    for (let y = 0; y < rows; y += 1) {
      for (let x = 0; x < cols; x += 1) {
        const s = foldedSurfaceSample(veil, { u: x / (cols - 1), v: y / (rows - 1), aspect });
        const [px, py, pz] = s.position;
        maxAbsX = Math.max(maxAbsX, Math.abs(px));
        maxAbsY = Math.max(maxAbsY, Math.abs(py));
        minZ = Math.min(minZ, pz);
        maxZ = Math.max(maxZ, pz);
        layerMinZ = Math.min(layerMinZ, pz);
        layerMaxZ = Math.max(layerMaxZ, pz);
        layerTotal += 1;
        total += 1;
        if (s.alpha > 0.03) { layerVisible += 1; visible += 1; }
        if ((s.hole > 0.24 && s.ribbon > 0.20) || s.focalAperture > 0.35) { layerHoles += 1; holes += 1; }
      }
    }
    layers.push(Object.freeze({
      name: veil.name,
      visibleRatio: layerVisible / layerTotal,
      holeRatio: layerHoles / layerTotal,
      zRange: layerMaxZ - layerMinZ,
    }));
  }
  return Object.freeze({
    combinedVisibleRatio: total ? visible / total : 0,
    holeRatio: total ? holes / total : 0,
    maxAbsX,
    maxAbsY,
    minZ,
    maxZ,
    layers,
  });
}

export function veilGridSize(plan = null) {
  const tier = String(plan?.tier || "").toLowerCase();
  const shaderQuality = String(plan?.shaderQuality || "").toLowerCase();
  if (tier === "low" || shaderQuality === "basic") return { cols: 64, rows: 64 };
  return { cols: 96, rows: 96 };
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
  if (!Number.isFinite(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function mix(a, b, t) { return a + (b - a) * t; }

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0 || 1), 0, 1);
  return t * t * (3 - 2 * t);
}

export default {
  seedHash,
  mulberry32,
  KIND_IDS,
  veilParams,
  foldedSurfaceSample,
  foldedSurfaceStats,
  veilGridSize,
  clampCamera,
  drawOrder,
  sceneTime,
  pauseMotion,
  resumeMotion,
};
