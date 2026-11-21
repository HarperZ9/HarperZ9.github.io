// estuary-recombination.test.mjs: unit tests for perceptual metamers,
// relational field topology, and cross-medium recombination.
// Run: node --test tests/estuary-recombination.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESTUARY_PROPERTIES,
  createGenotype,
  evaluateField,
  measureContinuity,
} from '../world/site/surfaces/estuary-field.mjs';
import {
  OBSERVER_MATRICES,
  analyzeFieldTopology,
  detectMetamers,
  recombineAcrossMediums,
} from '../world/site/surfaces/estuary-recombination.mjs';

const MODULE_PATH = new URL('../world/site/surfaces/estuary-recombination.mjs', import.meta.url);
const LOCAL_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|file:\/\/)/;

test('detectMetamers flags true metamers and rejects identical or perceptually distinct pairs', () => {
  assert.deepEqual(
    Object.keys(OBSERVER_MATRICES).sort(),
    ['structural-density', 'temporal-cadence', 'visual-luminance'],
  );

  // Fluid vs sound under temporal-cadence: distinct domains, near-identical cadence.
  const cadenceMetamer = detectMetamers({ fluid: 1 }, { sound: 1 }, 'temporal-cadence');
  assert.ok(cadenceMetamer.domainDistance > 0.25);
  assert.ok(cadenceMetamer.perceptualDistance < 0.08);
  assert.equal(cadenceMetamer.isMetamer, true);
  assert.equal(cadenceMetamer.observer, 'temporal-cadence');

  // Refraction vs cad under structural-density: distinct domains, close structural projection.
  const densityMetamer = detectMetamers(
    { refraction: 0.9, measure: 0.1 },
    { cad: 0.85, fluid: 0.1 },
    'structural-density',
  );
  assert.ok(densityMetamer.domainDistance > 0.25);
  assert.ok(densityMetamer.perceptualDistance < 0.08);
  assert.equal(densityMetamer.isMetamer, true);

  // Identical vectors are not metamers (domain distance is 0).
  const identical = detectMetamers({ refraction: 0.7, fluid: 0.3 }, { refraction: 0.7, fluid: 0.3 }, 'visual-luminance');
  assert.equal(identical.domainDistance, 0);
  assert.equal(identical.perceptualDistance, 0);
  assert.equal(identical.isMetamer, false);

  // Perceptually distinct vectors under structural-density.
  const distinct = detectMetamers({ refraction: 1, cad: 1 }, { fluid: 1, sound: 1 }, 'structural-density');
  assert.ok(distinct.perceptualDistance > 0.2);
  assert.equal(distinct.isMetamer, false);

  // Custom observer matrix support.
  const custom = detectMetamers(
    { refraction: 1 },
    { sound: 1 },
    { id: 'equal-ends', channels: [[0.5, 0, 0, 0, 0.5]] },
  );
  assert.equal(custom.observer, 'equal-ends');
  assert.equal(custom.perceptualDistance, 0);
  assert.equal(custom.isMetamer, true);
});

test('analyzeFieldTopology measures weight, transparency, diffusion, symmetry, seams, and negativeSpace', () => {
  // Uniform flat field: maximal diffusion and symmetry, zero seams.
  const flat = new Array(24).fill(0.4);
  const flatTopo = analyzeFieldTopology(flat, 6, 4);
  assert.equal(flatTopo.weight, 0.4);
  assert.equal(flatTopo.transparency, 0.6);
  assert.equal(Number((flatTopo.opacity + flatTopo.transparency).toFixed(4)), 1);
  assert.equal(flatTopo.diffusion, 1);
  assert.equal(flatTopo.symmetry, 1);
  assert.equal(flatTopo.asymmetry, 0);
  assert.equal(flatTopo.seams.intensity, 0);
  assert.equal(flatTopo.seams.ridgeCount, 0);

  // Asymmetric single-corner peak: high asymmetry, low symmetry.
  const corner = new Array(36).fill(0);
  for (let y = 0; y < 3; y++) {
    for (let x = 0; x < 3; x++) corner[y * 6 + x] = 0.9;
  }
  const cornerTopo = analyzeFieldTopology(corner, 6, 6);
  assert.ok(cornerTopo.asymmetry > 0.8, `expected high asymmetry, got ${cornerTopo.asymmetry}`);
  assert.ok(cornerTopo.symmetry < 0.2);
  assert.ok(cornerTopo.seams.ridgeCount > 0);
  assert.ok(cornerTopo.diffusion < 1);

  // Two separated peaks with a low-energy negative-space corridor between them.
  const w = 10, h = 6;
  const twin = new Array(w * h).fill(0.05);
  for (let y = 1; y < 5; y++) {
    for (let x = 0; x < 3; x++) twin[y * w + x] = 0.92;
    for (let x = 7; x < 10; x++) twin[y * w + x] = 0.92;
  }
  const twinTopo = analyzeFieldTopology(twin, w, h);
  assert.equal(twinTopo.negativeSpace.peakCount, 2);
  assert.ok(twinTopo.negativeSpace.betweenPeaks >= 1, 'expected negative-space corridor between peaks');
  assert.ok(twinTopo.negativeSpace.centroid !== null);
  assert.ok(twinTopo.negativeSpace.centroid.x > 0.35 && twinTopo.negativeSpace.centroid.x < 0.65);
  assert.equal(twinTopo.symmetry, 1);
  assert.ok(twinTopo.seams.intensity > 0.15);

  // Direct integration with evaluateField grid output.
  const left = createGenotype({ id: 'left', x: 0.2, y: 0.5, radius: 0.22, weights: { refraction: 0.9, fluid: 0.8, cad: 0.7 } });
  const right = createGenotype({ id: 'right', x: 0.8, y: 0.5, radius: 0.22, weights: { sound: 0.9, measure: 0.8, cad: 0.7 } });
  const field = evaluateField([left, right], { width: 12, height: 6, seed: 19, reducedMotion: true });
  const fieldTopo = analyzeFieldTopology(field.grid);
  assert.ok(fieldTopo.weight > 0 && fieldTopo.weight < 1);
  assert.equal(Number((fieldTopo.opacity + fieldTopo.transparency).toFixed(4)), 1);
  assert.ok(fieldTopo.negativeSpace.betweenPeaks >= 1);
});

test('recombineAcrossMediums emits synchronized visual, acoustic, haptic, accessible, and receipt data', () => {
  const glass = createGenotype({
    id: 'glass',
    name: 'Refractive prism',
    x: 0.25,
    y: 0.5,
    radius: 0.24,
    weights: { refraction: 0.9, cad: 0.65, measure: 0.4, fluid: 0.1, sound: 0.15 },
    seed: 11,
  });
  const tide = createGenotype({
    id: 'tide',
    name: 'Estuary tide',
    x: 0.75,
    y: 0.5,
    radius: 0.24,
    weights: { fluid: 0.92, sound: 0.8, refraction: 0.2, measure: 0.35, cad: 0.1 },
    seed: 23,
  });

  const artifact = recombineAcrossMediums(glass, tide, 0.5, 42);

  // Visual uniforms
  assert.ok(artifact.visual.ior >= 1 && artifact.visual.ior <= 2);
  assert.ok(artifact.visual.viscosity >= 0 && artifact.visual.viscosity <= 1);
  assert.equal(Number((artifact.visual.alpha + artifact.visual.transparency).toFixed(4)), 1);
  assert.ok(artifact.visual.diffusionSigma > 0);
  assert.ok(artifact.visual.seamHighlight >= 0 && artifact.visual.seamHighlight <= 1);

  // Acoustic physical-model partials
  assert.equal(artifact.acoustic.freqsHz.length, 5);
  assert.equal(artifact.acoustic.amps.length, 5);
  for (let i = 1; i < artifact.acoustic.freqsHz.length; i++) {
    assert.ok(artifact.acoustic.freqsHz[i] > artifact.acoustic.freqsHz[i - 1], 'partials must ascend');
    assert.ok(artifact.acoustic.amps[i] > 0 && artifact.acoustic.amps[i] <= 1);
  }
  assert.ok(artifact.acoustic.damping > 0 && artifact.acoustic.damping <= 1);
  assert.ok(artifact.acoustic.tempoBpm >= 56 && artifact.acoustic.tempoBpm <= 144);

  // Haptic pulse envelope
  assert.equal(artifact.haptic.pulsesMs.length, 4);
  for (const ms of artifact.haptic.pulsesMs) {
    assert.ok(Number.isInteger(ms) && ms >= 12);
  }
  assert.ok(artifact.haptic.intensity > 0 && artifact.haptic.intensity <= 1);

  // Accessible parity description
  assert.equal(artifact.accessible.dominantProperties.length, 2);
  assert.deepEqual(Object.keys(artifact.accessible.weights), ESTUARY_PROPERTIES);
  assert.ok(artifact.accessible.summary.includes('dominant properties'));
  assert.ok(artifact.accessible.summary.includes('Seams at'));
  assert.ok(artifact.accessible.summary.includes('Negative space covers'));
  assert.equal(artifact.accessible.ariaLabel, artifact.accessible.summary);

  // Deterministic receipt
  const repeat = recombineAcrossMediums(glass, tide, 0.5, 42);
  assert.deepEqual(artifact, repeat);
  assert.match(artifact.receipt.digest, /^fnv1a64:[0-9a-f]{16}$/);

  const diffMix = recombineAcrossMediums(glass, tide, 0.65, 42);
  const diffSeed = recombineAcrossMediums(glass, tide, 0.5, 99);
  assert.notEqual(artifact.receipt.digest, diffMix.receipt.digest);
  assert.notEqual(artifact.receipt.digest, diffSeed.receipt.digest);
});

test('recombineAcrossMediums varies continuously across mix [0..1]', () => {
  const vecA = { refraction: 0.95, cad: 0.8, measure: 0.3 };
  const vecB = { fluid: 0.9, sound: 0.85, measure: 0.6 };

  const iorCont = measureContinuity((t) => recombineAcrossMediums(vecA, vecB, t, 7).visual.ior, { steps: 32 });
  const bpmCont = measureContinuity((t) => recombineAcrossMediums(vecA, vecB, t, 7).acoustic.tempoBpm, { steps: 32 });
  const hapticCont = measureContinuity((t) => recombineAcrossMediums(vecA, vecB, t, 7).haptic.intensity, { steps: 32 });

  assert.equal(iorCont.continuous, true, 'visual ior must vary continuously');
  assert.equal(bpmCont.continuous, true, 'acoustic tempoBpm must vary continuously');
  assert.equal(hapticCont.continuous, true, 'haptic intensity must vary continuously');
});

test('source and generated artifacts contain zero em dashes and zero local paths', () => {
  const source = readFileSync(MODULE_PATH, 'utf8');
  assert.equal(source.includes('\u2014'), false, 'module source must not contain em dashes');
  assert.equal(LOCAL_PATH_RE.test(source), false, 'module source must not contain local paths');
  assert.ok(source.split('\n').length < 280, 'module source must stay under 280 lines');

  const out = recombineAcrossMediums({ fluid: 1 }, { sound: 1 }, 0.5, 13);
  const serialized = JSON.stringify(out);
  assert.equal(serialized.includes('\u2014'), false, 'artifact output must not contain em dashes');
  assert.equal(LOCAL_PATH_RE.test(serialized), false, 'artifact output must not contain local paths');
});
