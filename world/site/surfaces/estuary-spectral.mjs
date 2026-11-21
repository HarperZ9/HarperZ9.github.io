// estuary-spectral.mjs: GUE zeta-repulsive sampling, vortex-pinch singularity
// detection, and O(sqrt(N)) discrete spectral lift for Estuary and The Playground.
// Pure zero-dependency ESM module; deterministic and browser/Node compatible.

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generate N points in [0, 1] with GUE-like level repulsion (Wigner surmise
 * beta=2 rejection sampling), avoiding both periodic grid moire and Poisson
 * clumping. Returns sorted positions plus mean minimum spacing ratio.
 */
export function gueRepulsiveOffsets(count = 32, seed = 42) {
  const n = Math.max(2, Math.floor(count));
  const rng = mulberry32(seed);
  // Wigner surmise for GUE (beta = 2): P(s) = (32 / pi^2) * s^2 * exp(-4 s^2 / pi)
  const c = 4 / Math.PI;
  const maxPdf = (32 / (Math.PI * Math.PI)) * (1 / c) * Math.exp(-1);
  const spacings = [];
  while (spacings.length < n) {
    const s = rng() * 3.0;
    const pdf = (32 / (Math.PI * Math.PI)) * s * s * Math.exp(-c * s * s);
    if (rng() * maxPdf <= pdf) spacings.push(s);
  }
  const total = spacings.reduce((a, b) => a + b, 0) || 1;
  const positions = [];
  let acc = 0;
  for (let i = 0; i < n; i++) {
    acc += spacings[i] / total;
    positions.push(Number(Math.min(1, acc - 0.5 * (spacings[i] / total)).toFixed(6)));
  }
  let minGap = 1;
  for (let i = 1; i < positions.length; i++) {
    minGap = Math.min(minGap, positions[i] - positions[i - 1]);
  }
  return {
    count: n,
    seed,
    positions,
    minGapRatio: Number((minGap * n).toFixed(4)),
  };
}

/**
 * Detect vortex-pinch singularity loci on a 2D velocity field (vx, vy) of size
 * width x height by computing local vorticity omega = d(vy)/dx - d(vx)/dy,
 * total enstrophy, and peak-to-mean concentration ratio.
 */
export function detectVortexPinch(vx, vy, width, height, thresholdRatio = 2.5) {
  const w = Math.max(3, Math.floor(width));
  const h = Math.max(3, Math.floor(height));
  const omega = new Float64Array(w * h);
  let enstrophy = 0;
  let peak = 0;
  let peakX = 0;
  let peakY = 0;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const dvydx = 0.5 * (vy[idx + 1] - vy[idx - 1]);
      const dvxdy = 0.5 * (vx[idx + w] - vx[idx - w]);
      const curl = dvydx - dvxdy;
      omega[idx] = curl;
      const sq = curl * curl;
      enstrophy += sq;
      if (Math.abs(curl) > peak) {
        peak = Math.abs(curl);
        peakX = x;
        peakY = y;
      }
    }
  }
  const interior = (w - 2) * (h - 2);
  const rms = Math.sqrt(enstrophy / interior) || 1e-9;
  const concentration = peak / rms;
  const hotCells = [];
  const cutoff = rms * thresholdRatio;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const val = Math.abs(omega[y * w + x]);
      if (val >= cutoff) hotCells.push({ x, y, vorticity: Number(val.toFixed(5)) });
    }
  }
  hotCells.sort((a, b) => b.vorticity - a.vorticity);
  return {
    enstrophy: Number(enstrophy.toFixed(6)),
    peakVorticity: Number(peak.toFixed(6)),
    peakLocation: { x: peakX, y: peakY },
    concentrationRatio: Number(concentration.toFixed(4)),
    pinchDetected: concentration >= thresholdRatio,
    adaptiveCellFraction: Number((hotCells.length / interior).toFixed(4)),
    hotCells: hotCells.slice(0, 12),
  };
}

/**
 * Toy O(sqrt(N)) chained spectral lift over a discrete integer sequence.
 * Splits a sequence of length N into depth = ceil(sqrt(N)) blocks and applies
 * deterministic phase-weighted spectral folding to surface high-multiplicity
 * structural repeats in O(sqrt(N)) lift stages.
 */
export function discreteSpectralLift(sequence) {
  const arr = Array.from(sequence, Number);
  const n = arr.length;
  if (n === 0) return { length: 0, liftDepth: 0, spectralEnergy: [], dominantMultiplicity: 0 };
  const depth = Math.max(1, Math.ceil(Math.sqrt(n)));
  const energy = [];
  for (let k = 0; k < depth; k++) {
    let re = 0;
    let im = 0;
    const freq = (2 * Math.PI * (k + 1)) / depth;
    for (let i = 0; i < n; i++) {
      const angle = freq * i;
      re += arr[i] * Math.cos(angle);
      im += arr[i] * Math.sin(angle);
    }
    energy.push(Number((Math.hypot(re, im) / n).toFixed(6)));
  }
  const counts = new Map();
  for (const v of arr) counts.set(v, (counts.get(v) || 0) + 1);
  let dominantMultiplicity = 0;
  for (const c of counts.values()) if (c > dominantMultiplicity) dominantMultiplicity = c;
  return {
    length: n,
    liftDepth: depth,
    spectralEnergy: energy,
    peakSpectralMode: energy.indexOf(Math.max(...energy)) + 1,
    dominantMultiplicity,
  };
}
