// estuary-recombination.mjs: relational topology, perceptual metamers, and
// cross-medium recombination layered on top of estuary-field.mjs.
// Zero-dependency ESM module with deterministic receipts and accessible parity.

import {
  ESTUARY_PROPERTIES, blendVectors, clamp01, createGenotype,
  createRng, evaluateField, haloclineWeight, normalizeWeights,
} from './estuary-field.mjs';

export const OBSERVER_MATRICES = Object.freeze({
  'visual-luminance': Object.freeze([Object.freeze([0.35, 0.25, 0.15, 0.15, 0.10]), Object.freeze([0.20, 0.30, 0.10, 0.10, 0.30])]),
  'temporal-cadence': Object.freeze([Object.freeze([0.10, 0.40, 0.10, 0.05, 0.35]), Object.freeze([0.05, 0.35, 0.15, 0.10, 0.35])]),
  'structural-density': Object.freeze([Object.freeze([0.25, 0.10, 0.25, 0.35, 0.05]), Object.freeze([0.30, 0.05, 0.25, 0.35, 0.05])]),
});

const ROUND = (v, d = 4) => Number(Number(v).toFixed(d));
const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function resolveObserver(observer) {
  if (typeof observer === 'string' && OBSERVER_MATRICES[observer]) return { id: observer, matrix: OBSERVER_MATRICES[observer] };
  if (Array.isArray(observer) && observer.length > 0) return { id: 'custom', matrix: observer };
  if (observer?.channels?.length > 0) return { id: String(observer.id || 'custom'), matrix: observer.channels };
  return { id: 'visual-luminance', matrix: OBSERVER_MATRICES['visual-luminance'] };
}

function rmsDistance(a, b) {
  if (!a.length) return 0;
  let sq = 0;
  for (let i = 0; i < a.length; i++) sq += (a[i] - b[i]) ** 2;
  return Math.sqrt(sq / a.length);
}

// Project two domain vectors through an observer matrix and flag true metamers.
export function detectMetamers(vectorA, vectorB, observer = 'visual-luminance', thresholds = {}) {
  const a = normalizeWeights(vectorA?.weights || vectorA);
  const b = normalizeWeights(vectorB?.weights || vectorB);
  const { id, matrix } = resolveObserver(observer);
  const vecA = ESTUARY_PROPERTIES.map((p) => a[p]);
  const vecB = ESTUARY_PROPERTIES.map((p) => b[p]);
  const proj = (w) => matrix.map((row) => clamp01(ESTUARY_PROPERTIES.reduce((s, p, i) => s + w[p] * (Number(row[i]) || 0), 0)));
  const projA = proj(a), projB = proj(b);
  const domainDistance = ROUND(rmsDistance(vecA, vecB));
  const perceptualDistance = ROUND(rmsDistance(projA, projB));
  const domainMin = Number.isFinite(thresholds.domainMin) ? thresholds.domainMin : 0.25;
  const perceptualMax = Number.isFinite(thresholds.perceptualMax) ? thresholds.perceptualMax : 0.08;
  const isMetamer = domainDistance > domainMin && perceptualDistance < perceptualMax;
  const sep = clamp01((domainDistance - perceptualDistance) / Math.max(domainMin, 1e-6));
  return Object.freeze({
    observer: id,
    projectionA: Object.freeze(projA.map((v) => ROUND(v))),
    projectionB: Object.freeze(projB.map((v) => ROUND(v))),
    domainDistance, perceptualDistance, isMetamer,
    metamerScore: ROUND(isMetamer ? sep : sep * 0.5),
  });
}

function normalizeGridInput(grid, width, height) {
  const src = grid?.grid || grid;
  const cells = Array.isArray(src) ? src : (Array.isArray(src?.cells) ? src.cells : []);
  const w = Math.max(1, Math.trunc(width ?? src?.width ?? Math.round(Math.sqrt(cells.length)) ?? 1));
  const h = Math.max(1, Math.trunc(height ?? src?.height ?? Math.ceil(cells.length / w) ?? 1));
  const energy = new Float64Array(w * h), halo = new Float64Array(w * h), opacity = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const c = cells[i];
    if (typeof c === 'number') {
      energy[i] = clamp01(c);
      halo[i] = 4 * energy[i] * (1 - energy[i]);
      opacity[i] = energy[i];
    } else if (c?.weights) {
      const e = ESTUARY_PROPERTIES.reduce((s, p) => s + clamp01(c.weights[p] ?? 0), 0) / ESTUARY_PROPERTIES.length;
      energy[i] = e;
      halo[i] = Number.isFinite(c.halocline) ? clamp01(c.halocline) : 4 * e * (1 - e);
      opacity[i] = clamp01(0.45 * e + 0.35 * (c.weights.cad ?? 0) + 0.2 * (c.weights.measure ?? 0) - 0.15 * (c.weights.refraction ?? 0));
    }
  }
  return { w, h, energy, halo, opacity };
}

function computeMirrorSymmetry(energy, w, h) {
  let hDiff = 0, hSum = 0, vDiff = 0, vSum = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = energy[y * w + x], hm = energy[y * w + (w - 1 - x)], vm = energy[(h - 1 - y) * w + x];
      hDiff += Math.abs(a - hm); hSum += a + hm;
      vDiff += Math.abs(a - vm); vSum += a + vm;
    }
  }
  const horizontal = hSum > 1e-9 ? clamp01(1 - hDiff / hSum) : 1;
  const vertical = vSum > 1e-9 ? clamp01(1 - vDiff / vSum) : 1;
  return { horizontal, vertical, symmetry: clamp01(0.5 * (horizontal + vertical)) };
}

function computeSeamsAndLaplacian(energy, halo, w, h) {
  let lapSum = 0, gradSum = 0, maxGrad = 0, ridgeCount = 0;
  const n = w * h;
  const at = (arr, x, y) => arr[Math.max(0, Math.min(h - 1, y)) * w + Math.max(0, Math.min(w - 1, x))];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const e = energy[y * w + x];
      const nb = (at(energy, x - 1, y) + at(energy, x + 1, y) + at(energy, x, y - 1) + at(energy, x, y + 1)) * 0.25;
      lapSum += Math.abs(nb - e);
      const gxH = (at(halo, x + 1, y) - at(halo, x - 1, y)) * 0.5, gyH = (at(halo, x, y + 1) - at(halo, x, y - 1)) * 0.5;
      const gxE = (at(energy, x + 1, y) - at(energy, x - 1, y)) * 0.5, gyE = (at(energy, x, y + 1) - at(energy, x, y - 1)) * 0.5;
      const g = Math.hypot(gxH, gyH) + 0.5 * Math.hypot(gxE, gyE);
      gradSum += g;
      if (g > maxGrad) maxGrad = g;
      if (g >= 0.22) ridgeCount++;
    }
  }
  return {
    diffusion: clamp01(1 - (lapSum / n) * 2),
    seams: Object.freeze({ intensity: ROUND(clamp01((gradSum / n) * 3.5)), maxGradient: ROUND(maxGrad), ridgeCount, ridgeRatio: ROUND(ridgeCount / n) }),
  };
}

function floodSpread(labels, canEnter, w, h, seedQueue) {
  for (let head = 0; head < seedQueue.length; head++) {
    const cur = seedQueue[head], cx = cur % w, cy = (cur - cx) / w;
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx, ny = cy + dy, ni = ny * w + nx;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && canEnter(ni, labels)) {
        labels[ni] = labels[cur];
        seedQueue.push(ni);
      }
    }
  }
}

function labelComponents(mask, w, h) {
  const labels = new Int32Array(w * h);
  let count = 0;
  for (let i = 0; i < w * h; i++) {
    if (!mask[i] || labels[i]) continue;
    labels[i] = ++count;
    floodSpread(labels, (ni, l) => mask[ni] && !l[ni], w, h, [i]);
  }
  return { labels, count };
}

function computeNegativeSpace(energy, w, h) {
  const n = w * h;
  let maxE = 0, lowTotal = 0;
  for (let i = 0; i < n; i++) if (energy[i] > maxE) maxE = energy[i];
  const peakThresh = Math.max(0.35, maxE * 0.6), lowThresh = Math.min(0.22, peakThresh * 0.45);
  const peakMask = new Uint8Array(n), lowMask = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (energy[i] >= peakThresh) peakMask[i] = 1;
    if (energy[i] <= lowThresh) { lowMask[i] = 1; lowTotal++; }
  }
  const peaks = labelComponents(peakMask, w, h), lows = labelComponents(lowMask, w, h);
  const domain = new Int32Array(peaks.labels);
  const seeds = [];
  for (let i = 0; i < n; i++) if (domain[i] > 0) seeds.push(i);
  floodSpread(domain, (ni, l) => !l[ni] && !lowMask[ni], w, h, seeds);
  const touches = Array.from({ length: lows.count + 1 }, () => new Set());
  const sizes = new Int32Array(lows.count + 1), sumX = new Float64Array(lows.count + 1), sumY = new Float64Array(lows.count + 1);
  for (let i = 0; i < n; i++) {
    const id = lows.labels[i];
    if (!id) continue;
    const x = i % w, y = (i - x) / w;
    sizes[id]++; sumX[id] += (x + 0.5) / w; sumY[id] += (y + 0.5) / h;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx, ny = y + dy;
      if (nx >= 0 && nx < w && ny >= 0 && ny < h && domain[ny * w + nx] > 0) touches[id].add(domain[ny * w + nx]);
    }
  }
  let betweenPeaks = 0, largestCorridor = 0, bestId = 0;
  for (let id = 1; id <= lows.count; id++) {
    if (sizes[id] > largestCorridor) largestCorridor = sizes[id];
    if (touches[id].size >= 2) { betweenPeaks++; if (!bestId || sizes[id] > sizes[bestId]) bestId = id; }
  }
  const centroid = bestId ? Object.freeze({ x: ROUND(sumX[bestId] / sizes[bestId]), y: ROUND(sumY[bestId] / sizes[bestId]) }) : null;
  return Object.freeze({ ratio: ROUND(lowTotal / n), corridorCount: lows.count, largestCorridor, peakCount: peaks.count, betweenPeaks, centroid });
}

// Compute continuous relational topology metrics over an estuary field grid.
export function analyzeFieldTopology(grid, width, height) {
  const { w, h, energy, halo, opacity } = normalizeGridInput(grid, width, height);
  const n = w * h;
  let energySum = 0, opacitySum = 0;
  for (let i = 0; i < n; i++) { energySum += energy[i]; opacitySum += opacity[i]; }
  const weight = clamp01(energySum / n), meanOpacity = clamp01(opacitySum / n);
  const mirror = computeMirrorSymmetry(energy, w, h);
  const { diffusion, seams } = computeSeamsAndLaplacian(energy, halo, w, h);
  return Object.freeze({
    weight: ROUND(weight), opacity: ROUND(meanOpacity), transparency: ROUND(clamp01(1 - meanOpacity)),
    diffusion: ROUND(diffusion), symmetry: ROUND(mirror.symmetry), asymmetry: ROUND(clamp01(1 - mirror.symmetry)),
    mirror: Object.freeze({ horizontal: ROUND(mirror.horizontal), vertical: ROUND(mirror.vertical) }),
    seams, negativeSpace: computeNegativeSpace(energy, w, h),
  });
}

function fnv1a32(str, init) {
  let h = init >>> 0;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619) >>> 0;
  return h.toString(16).padStart(8, '0');
}

function buildReceipt(genA, genB, mix, seed) {
  const canonical = JSON.stringify({
    a: { id: genA.id, x: ROUND(genA.x), y: ROUND(genA.y), weights: genA.weights },
    b: { id: genB.id, x: ROUND(genB.x), y: ROUND(genB.y), weights: genB.weights },
    mix: ROUND(clamp01(mix), 6), seed,
  });
  return Object.freeze({
    algorithm: 'fnv1a-64-dual',
    digest: `fnv1a64:${fnv1a32(canonical, 0x811c9dc5)}${fnv1a32(`${canonical}#${seed}`, 0x9e3779b1)}`,
    mix: ROUND(clamp01(mix), 6), seed,
  });
}

function buildAcousticHaptic(blended, topology, rng) {
  const w = blended.weights;
  const baseHz = 110 + 330 * w.sound + 45 * blended.couplings.acousticAdvection;
  const freqsHz = [], amps = [];
  for (let k = 1; k <= 5; k++) {
    freqsHz.push(ROUND(baseHz * k * (1 + 0.018 * w.cad * (k * k - 1)) * (1 + (rng() - 0.5) * 0.004), 2));
    amps.push(ROUND(clamp01((1 / Math.pow(k, 1.15 - 0.35 * w.refraction)) * (0.65 + 0.35 * w.measure)), 4));
  }
  const tempoBpm = ROUND(56 + 88 * (0.55 * w.fluid + 0.45 * w.sound), 2);
  const beatMs = 60000 / tempoBpm;
  return {
    acoustic: Object.freeze({
      freqsHz: Object.freeze(freqsHz), amps: Object.freeze(amps),
      damping: ROUND(clamp01(0.12 + 0.68 * (1 - 0.5 * w.sound) * (0.4 + 0.6 * w.fluid))), tempoBpm,
    }),
    haptic: Object.freeze({
      pulsesMs: Object.freeze([
        Math.max(12, Math.round(beatMs * (0.14 + 0.16 * w.cad))),
        Math.max(12, Math.round(beatMs * (0.10 + 0.12 * (1 - blended.halocline)))),
        Math.max(12, Math.round(beatMs * (0.12 + 0.18 * w.measure + (rng() - 0.5) * 0.02))),
        Math.max(12, Math.round(beatMs * (0.16 + 0.14 * w.fluid))),
      ]),
      intensity: ROUND(clamp01(0.15 + 0.45 * topology.weight + 0.25 * w.cad + 0.15 * blended.halocline)),
    }),
  };
}

function buildAccessibleSummary(genA, genB, h, w, topology, metamers) {
  const dominantProperties = Object.freeze([...ESTUARY_PROPERTIES].sort((a, b) => w[b] - w[a]).slice(0, 2));
  const active = metamers.filter((m) => m.isMetamer).map((m) => m.observer);
  const metamerSummary = active.length ? `Perceptual metamer detected under ${active.join(', ')}.` : 'No perceptual metamers detected across observers.';
  const seamSummary = `Seams at ${(topology.seams.intensity * 100).toFixed(0)}% intensity across ${topology.seams.ridgeCount} ridge cells.`;
  const negativeSpaceSummary = `Negative space covers ${(topology.negativeSpace.ratio * 100).toFixed(0)}% with ${topology.negativeSpace.betweenPeaks} corridor(s) between peaks.`;
  const summary = `Recombined ${genA.name} and ${genB.name} at mix ${ROUND(h, 2)}: dominant properties ${dominantProperties.join(' and ')}. ${metamerSummary} ${seamSummary} ${negativeSpaceSummary}`;
  return Object.freeze({ summary, ariaLabel: summary, dominantProperties, weights: w, metamerSummary, seamSummary, negativeSpaceSummary });
}

// Recombine two elements across visual, acoustic, haptic, and accessible mediums.
export function recombineAcrossMediums(elemA, elemB, mix = 0.5, seed = 1, options = {}) {
  const toG = (e, id, x) => (e?.weights ? createGenotype(e) : createGenotype({ id, name: id, x, y: 0.5, radius: 0.34, weights: e || {} }));
  const genA = toG(elemA, 'element-a', 0.3), genB = toG(elemB, 'element-b', 0.7);
  const steepness = Number.isFinite(options.steepness) ? options.steepness : 2.0;
  const safeSeed = (seed >>> 0) || 1;
  const h = haloclineWeight(mix, steepness);
  const blended = blendVectors(genA.weights, genB.weights, mix, { steepness });
  const w = blended.weights;
  const field = evaluateField([genA, genB], { width: 10, height: 6, seed: safeSeed, reducedMotion: true });
  const topology = analyzeFieldTopology(field.grid);
  const metamers = Object.freeze(Object.keys(OBSERVER_MATRICES).map((obs) => detectMetamers(genA.weights, genB.weights, obs)));
  const visual = Object.freeze({
    ior: ROUND(1 + 0.52 * w.refraction + 0.14 * blended.couplings.causticShear),
    viscosity: ROUND(clamp01(0.1 + 0.65 * w.cad + 0.25 * (1 - w.fluid))),
    alpha: topology.opacity, transparency: topology.transparency,
    diffusionSigma: ROUND(0.5 + 3.5 * topology.diffusion * (0.4 + 0.6 * w.fluid)),
    seamHighlight: ROUND(clamp01(0.5 * blended.halocline + 0.5 * topology.seams.intensity)),
  });
  const { acoustic, haptic } = buildAcousticHaptic(blended, topology, createRng(safeSeed));
  const accessible = buildAccessibleSummary(genA, genB, h, w, topology, metamers);
  return Object.freeze({
    mix: ROUND(h), weights: w, topology, metamers, visual, acoustic, haptic, accessible,
    receipt: buildReceipt(genA, genB, mix, safeSeed),
  });
}
