// estuary-homology.test.mjs: unit tests for 2D Betti numbers, circular phase
// monodromy winding, and cross-medium homeomorphism certification.
// Run: node --test tests/estuary-homology.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createGenotype, evaluateField } from '../world/site/surfaces/estuary-field.mjs';
import {
  analyzeLanternHomology,
  certifyHomeomorphism,
  computeBettiNumbers,
  computeMonodromyWinding,
  perimeterLoopIndices,
} from '../world/site/surfaces/estuary-homology.mjs';

const MODULE_URL = new URL('../world/site/surfaces/estuary-homology.mjs', import.meta.url);
const LOCAL_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|file:\/\/)/;

test('computeBettiNumbers computes exact beta0 and beta1 on canonical 2D grids', () => {
  const empty = computeBettiNumbers([0, 0, 0, 0, 0, 0, 0, 0, 0], 3, 3, 0.5);
  assert.equal(empty.beta0, 0);
  assert.equal(empty.beta1, 0);
  assert.equal(empty.eulerCharacteristic, 0);

  const solid = computeBettiNumbers([1, 1, 1, 1, 1, 1, 1, 1, 1], 3, 3, 0.5);
  assert.equal(solid.beta0, 1);
  assert.equal(solid.beta1, 0);
  assert.equal(solid.eulerCharacteristic, 1);

  // Single 3x3 ring enclosing one interior aperture.
  const ring = computeBettiNumbers([
    1, 1, 1,
    1, 0, 1,
    1, 1, 1,
  ], 3, 3, 0.5);
  assert.equal(ring.beta0, 1);
  assert.equal(ring.beta1, 1);
  assert.equal(ring.eulerCharacteristic, 0);

  // Figure-8 (5x3) with two enclosed apertures.
  const figureEight = computeBettiNumbers([
    1, 1, 1, 1, 1,
    1, 0, 1, 0, 1,
    1, 1, 1, 1, 1,
  ], 5, 3, 0.5);
  assert.equal(figureEight.beta0, 1);
  assert.equal(figureEight.beta1, 2);
  assert.equal(figureEight.eulerCharacteristic, -1);

  // Open C-shape touches border: 1 component, 0 enclosed holes.
  const openC = computeBettiNumbers([
    1, 1, 1,
    1, 0, 0,
    1, 1, 1,
  ], 3, 3, 0.5);
  assert.equal(openC.beta0, 1);
  assert.equal(openC.beta1, 0);

  // Diagonal diamond: 4-connected foreground yields 4 components, 8-connected background yields 0 holes.
  const diamond = computeBettiNumbers([
    0, 1, 0,
    1, 0, 1,
    0, 1, 0,
  ], 3, 3, 0.5);
  assert.equal(diamond.beta0, 4);
  assert.equal(diamond.beta1, 0);
});

test('computeBettiNumbers handles multiple islands and evaluateField grids', () => {
  // 7x3 grid: left 3x3 ring (1 island, 1 hole), gap column, right 3x3 solid (1 island, 0 holes).
  const twoIslands = computeBettiNumbers([
    1, 1, 1, 0, 1, 1, 1,
    1, 0, 1, 0, 1, 1, 1,
    1, 1, 1, 0, 1, 1, 1,
  ], 7, 3, 0.5);
  assert.equal(twoIslands.beta0, 2);
  assert.equal(twoIslands.beta1, 1);

  const genA = createGenotype({ id: 'a', x: 0.25, y: 0.5, radius: 0.2, weights: { refraction: 0.9, fluid: 0.9, measure: 0.9, cad: 0.9, sound: 0.9 } });
  const genB = createGenotype({ id: 'b', x: 0.78, y: 0.5, radius: 0.2, weights: { refraction: 0.9, fluid: 0.9, measure: 0.9, cad: 0.9, sound: 0.9 } });
  const field = evaluateField([genA, genB], { width: 10, height: 6, seed: 7, reducedMotion: true });
  const betti = computeBettiNumbers(field, 10, 6, 0.45);
  assert.equal(betti.beta0, 2, 'two separated high-energy blobs yield beta0=2');
  assert.equal(betti.beta1, 0);
});

test('computeMonodromyWinding detects integer winding numbers and phase flips', () => {
  const flat = computeMonodromyWinding([0.3, 0.35, 0.32, 0.31]);
  assert.equal(flat.winding, 0);
  assert.equal(flat.hasSingularity, false);
  assert.equal(flat.direction, 'none');

  // Counter-clockwise +1 vortex around 8 points in [0, 2*pi).
  const ccw = Array.from({ length: 8 }, (_, k) => (k * Math.PI * 2) / 8);
  const resCcw = computeMonodromyWinding(ccw);
  assert.equal(resCcw.winding, 1);
  assert.equal(resCcw.hasSingularity, true);
  assert.equal(resCcw.direction, 'ccw');

  // Clockwise -1 vortex using reversed loopIndices.
  const revIdx = [0, 7, 6, 5, 4, 3, 2, 1];
  const resCw = computeMonodromyWinding(ccw, revIdx);
  assert.equal(resCw.winding, -1);
  assert.equal(resCw.hasSingularity, true);
  assert.equal(resCw.direction, 'cw');

  // Double winding (+2) over 12 points.
  const doubleVortex = Array.from({ length: 12 }, (_, k) => ((k * Math.PI * 4) / 12) % (Math.PI * 2));
  const resDouble = computeMonodromyWinding(doubleVortex);
  assert.equal(resDouble.winding, 2);
  assert.equal(resDouble.hasSingularity, true);

  // Exact pi phase flip singularity.
  const flip = computeMonodromyWinding([0, Math.PI, 0, Math.PI]);
  assert.equal(flip.phaseFlip, true);
  assert.equal(flip.hasSingularity, true);
});

test('certifyHomeomorphism distinguishes preserved topology from tears and punctures', () => {
  const diskA = computeBettiNumbers([1, 1, 1, 1, 1, 1, 1, 1, 1], 3, 3, 0.5);
  const diskB = computeBettiNumbers([0, 0, 0, 0, 1, 0, 0, 0, 0], 3, 3, 0.5);
  const preserved = certifyHomeomorphism(diskA, diskB);
  assert.equal(preserved.status, 'HOMEOMORPHIC_PRESERVED');
  assert.equal(preserved.preserved, true);
  assert.equal(preserved.deltaBeta0, 0);
  assert.equal(preserved.deltaBeta1, 0);

  const ring = computeBettiNumbers([1, 1, 1, 1, 0, 1, 1, 1, 1], 3, 3, 0.5);
  const punctured = certifyHomeomorphism(diskA, ring);
  assert.equal(punctured.status, 'TOPOLOGY_CHANGED');
  assert.equal(punctured.preserved, false);
  assert.equal(punctured.deltaBeta0, 0);
  assert.equal(punctured.deltaBeta1, 1);
  assert.ok(punctured.summary.includes('deltaBeta0=0'));
  assert.ok(punctured.summary.includes('deltaBeta1=+1'));

  const torn = certifyHomeomorphism(ring, { beta0: 2, beta1: 0 });
  assert.equal(torn.status, 'TOPOLOGY_CHANGED');
  assert.equal(torn.deltaBeta0, 1);
  assert.equal(torn.deltaBeta1, -1);
  assert.ok(torn.summary.includes('deltaBeta0=+1'));
  assert.ok(torn.summary.includes('deltaBeta1=-1'));
});

test('perimeterLoopIndices and analyzeLanternHomology produce deterministic lattice metrics', () => {
  const loop = perimeterLoopIndices(4, 3);
  assert.deepEqual([...loop], [0, 1, 2, 3, 7, 11, 10, 9, 8, 4]);

  const apertures = Array.from({ length: 9 }, (_, i) => ({
    energy: i === 4 ? 0.1 : 0.9,
    spectrum: { harmonicPhase: (i * 0.4) % (Math.PI * 2) },
  }));
  const h1 = analyzeLanternHomology(apertures, 3, 3, 0.45);
  const h2 = analyzeLanternHomology(apertures, 3, 3, 0.45);
  assert.deepEqual(h1, h2);
  assert.equal(h1.beta0, 1);
  assert.equal(h1.beta1, 1);
  assert.equal(typeof h1.winding, 'number');
});

test('estuary-homology.mjs satisfies size, zero-em-dash, and zero-local-path hygiene', () => {
  const src = readFileSync(MODULE_URL, 'utf8');
  assert.ok(src.split('\n').length < 220, 'estuary-homology.mjs must stay under 220 lines');
  assert.equal(src.includes('\u2014'), false, 'module must contain zero em dashes');
  assert.equal(LOCAL_PATH_RE.test(src), false, 'module must contain zero local paths');
});
