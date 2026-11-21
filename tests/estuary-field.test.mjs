// estuary-field.test.mjs: unit tests for the continuous elemental property field.
// Run: node --test tests/estuary-field.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ESTUARY_PROPERTIES,
  PROPERTY_PAIRS,
  blendVectors,
  createGenotype,
  evaluateField,
  expressPhenotype,
  measureContinuity,
  recombineGenotypes,
  toBusEnvelope,
} from '../world/site/surfaces/estuary-field.mjs';
import { createBus, isSessionId } from '../world/site/surfaces/bus.mjs';

const MODULE_PATH = new URL('../world/site/surfaces/estuary-field.mjs', import.meta.url);
const LOCAL_PATH_RE = /(?:[A-Za-z]:\\|\/Users\/|\/home\/|file:\/\/)/;

test('exposes all 5 elemental properties and all 10 unordered pairs', () => {
  assert.deepEqual(ESTUARY_PROPERTIES, ['refraction', 'fluid', 'measure', 'cad', 'sound']);
  assert.equal(PROPERTY_PAIRS.length, 10);
  const unique = new Set(PROPERTY_PAIRS.map(([a, b]) => `${a}:${b}`));
  assert.equal(unique.size, 10);
});

test('continuous blending across all 10 property pairs has zero discontinuities', () => {
  for (const [propA, propB] of PROPERTY_PAIRS) {
    const vecA = { [propA]: 1 };
    const vecB = { [propB]: 1 };

    const checkA = measureContinuity((t) => blendVectors(vecA, vecB, t).weights[propA]);
    const checkB = measureContinuity((t) => blendVectors(vecA, vecB, t).weights[propB]);
    const checkHalo = measureContinuity((t) => blendVectors(vecA, vecB, t).halocline);

    assert.equal(checkA.continuous, true, `${propA} -> ${propB}: ${propA} weight must be continuous`);
    assert.equal(checkB.continuous, true, `${propA} -> ${propB}: ${propB} weight must be continuous`);
    assert.equal(checkHalo.continuous, true, `${propA} -> ${propB}: halocline must be continuous`);

    const genA = createGenotype({ id: propA, x: 0.35, y: 0.5, radius: 0.4, weights: vecA, seed: 11 });
    const genB = createGenotype({ id: propB, x: 0.65, y: 0.5, radius: 0.4, weights: vecB, seed: 29 });

    const fieldCheck = measureContinuity((t) => {
      const child = recombineGenotypes(genA, genB, t);
      const field = evaluateField([child], { width: 6, height: 4, seed: 7, time: 1.2 });
      return field.summary.refractiveIndex + field.summary.flowSpeedMmS * 0.01 +
        field.summary.probeGain + field.summary.spanMm * 0.01 + field.summary.freqHz * 0.001;
    }, { steps: 32 });

    assert.equal(fieldCheck.continuous, true, `${propA} <-> ${propB}: blended field observables must be continuous`);

    const start = blendVectors(vecA, vecB, 0);
    const mid = blendVectors(vecA, vecB, 0.5);
    const end = blendVectors(vecA, vecB, 1);
    assert.equal(start.weights[propA], 1);
    assert.equal(start.weights[propB], 0);
    assert.ok(mid.weights[propA] > 0.25 && mid.weights[propA] < 0.75);
    assert.ok(mid.weights[propB] > 0.25 && mid.weights[propB] < 0.75);
    assert.equal(end.weights[propA], 0);
    assert.equal(end.weights[propB], 1);
  }

  // Negative control: a hard on/off switch must fail continuity.
  const hardSwitch = measureContinuity((t) => (t >= 0.5 ? 1 : 0));
  assert.equal(hardSwitch.continuous, false);
});

test('identical inputs and seeds produce bit-for-bit deterministic field and phenotype output', () => {
  const glass = createGenotype({
    id: 'glass',
    name: 'Luneburg glass',
    x: 0.35,
    y: 0.5,
    radius: 0.3,
    weights: { refraction: 0.9, cad: 0.6, measure: 0.25 },
    seed: 101,
  });
  const water = createGenotype({
    id: 'water',
    name: 'Estuary current',
    x: 0.62,
    y: 0.52,
    radius: 0.34,
    weights: { fluid: 0.85, refraction: 0.45, sound: 0.5, measure: 0.4 },
    seed: 202,
  });

  const field1 = evaluateField([glass, water], { width: 10, height: 6, seed: 42, time: 2.5 });
  const field2 = evaluateField([glass, water], { width: 10, height: 6, seed: 42, time: 2.5 });
  assert.deepEqual(field1, field2);

  const pheno1 = expressPhenotype(field1, { screenReader: true });
  const pheno2 = expressPhenotype(field2, { screenReader: true });
  assert.deepEqual(pheno1, pheno2);

  const fieldDiffSeed = evaluateField([glass, water], { width: 10, height: 6, seed: 99, time: 2.5 });
  const activeIdx = field1.grid.cells.findIndex((c) => c.weights.fluid > 0.1);
  assert.ok(activeIdx >= 0, 'expected at least one active fluid cell');
  assert.notEqual(
    field1.grid.cells[activeIdx].observables.vx,
    fieldDiffSeed.grid.cells[activeIdx].observables.vx,
  );
});

test('reduced-motion, plain, and screen-reader phenotypes preserve full genotype parity', () => {
  const probe = createGenotype({
    id: 'probe',
    name: 'Field probe',
    x: 0.5,
    y: 0.5,
    radius: 0.42,
    weights: { refraction: 0.72, fluid: 0.64, measure: 0.88, cad: 0.55, sound: 0.41 },
    seed: 77,
  });

  const live = expressPhenotype([probe], { reducedMotion: false, seed: 77, time: 3.0 });
  const settled = expressPhenotype([probe], { reducedMotion: true, screenReader: true, seed: 77, time: 3.0 });
  const plain = expressPhenotype([probe], { plain: true, screenReader: true, seed: 77, time: 3.0 });

  assert.equal(live.mode, 'live');
  assert.equal(settled.mode, 'settled');
  assert.equal(plain.mode, 'plain');

  assert.equal(settled.visual.settled, true);
  assert.equal(settled.visual.flowAmplitude, 0);
  assert.equal(settled.visual.waveAmplitude, 0);
  assert.equal(plain.visual, null);

  for (const p of [live, settled, plain]) {
    assert.equal(p.parity.complete, true);
    assert.deepEqual(p.parity.exposedProperties, ESTUARY_PROPERTIES);
    assert.equal(p.readout.items.length, ESTUARY_PROPERTIES.length);
    for (const item of p.readout.items) {
      assert.ok(Number.isFinite(item.weight) && item.weight >= 0 && item.weight <= 1);
      assert.ok(Number.isFinite(item.measurement.value));
      assert.ok(typeof item.measurement.text === 'string' && item.measurement.text.length > 0);
    }
  }

  // Exact measurement parity between live, reduced-motion, and plain phenotypes.
  assert.deepEqual(settled.readout.items, live.readout.items);
  assert.deepEqual(plain.readout.items, live.readout.items);
  assert.ok(settled.readout.ariaLabel.includes('Refraction'));
  assert.ok(settled.readout.ariaLabel.includes('Fluid flow'));
  assert.ok(settled.readout.ariaLabel.includes('Measurement probe'));
  assert.ok(settled.readout.ariaLabel.includes('CAD span'));
  assert.ok(settled.readout.ariaLabel.includes('Sound voice'));
});

test('phenotype bus envelope delivers cleanly through world/site/surfaces/bus.mjs', () => {
  const bus = createBus({ surface: 'playground' });
  const el = createGenotype({
    id: 'estuary',
    weights: { refraction: 0.6, fluid: 0.7, measure: 0.5, cad: 0.4, sound: 0.3 },
  });
  const pheno = expressPhenotype([el], { reducedMotion: true, seed: 5 });
  const env = toBusEnvelope(pheno, { module: 'field', surface: 'playground', form: 'live' });
  const res = bus.deliver(env);
  assert.equal(res.ok, true, res.why || 'bus accepted envelope');
  assert.equal(isSessionId(res.id), true);
});

test('source and generated readouts contain no em dashes and no local paths', () => {
  const source = readFileSync(MODULE_PATH, 'utf8');
  assert.equal(source.includes('\u2014'), false, 'module source must not contain em dashes');
  assert.equal(LOCAL_PATH_RE.test(source), false, 'module source must not contain local paths');

  const el = createGenotype({
    id: 'sample',
    name: 'Sample region',
    weights: { refraction: 0.5, fluid: 0.5, measure: 0.5, cad: 0.5, sound: 0.5 },
  });
  const pheno = expressPhenotype([el], { reducedMotion: true, screenReader: true, seed: 13 });
  const serialized = JSON.stringify(pheno);
  assert.equal(serialized.includes('\u2014'), false, 'phenotype output must not contain em dashes');
  assert.equal(LOCAL_PATH_RE.test(serialized), false, 'phenotype output must not contain local paths');
});
