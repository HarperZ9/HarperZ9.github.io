import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeMarbledState } from '../world/site/surfaces/marbled-field.mjs';

test('computeMarbledState shifts phase across temperature regimes and modulates mobility', () => {
  const ice = computeMarbledState({ temperatureK: 255, weights: { refraction: 0.5, fluid: 0.6, measure: 0.5, cad: 0.8, sound: 0.6 } });
  const liquid = computeMarbledState({ temperatureK: 320, weights: { refraction: 0.5, fluid: 0.6, measure: 0.5, cad: 0.8, sound: 0.6 } });
  const plasma = computeMarbledState({ temperatureK: 1100, weights: { refraction: 0.5, fluid: 0.6, measure: 0.5, cad: 0.8, sound: 0.6 } });

  assert.equal(ice.phase, 'solid-crystalline');
  assert.equal(liquid.phase, 'liquid-estuary');
  assert.equal(plasma.phase, 'incandescent-plasma');
  assert.ok(plasma.weights.fluid > ice.weights.fluid, 'higher temperature raises fluid mobility');
  assert.ok(plasma.weights.cad < ice.weights.cad, 'higher temperature softens rigid CAD weight');
});

test('marbled-field.mjs has zero em dashes and zero local paths', () => {
  const src = readFileSync(new URL('../world/site/surfaces/marbled-field.mjs', import.meta.url), 'utf8');
  assert.ok(!src.includes('\u2014'));
  assert.ok(!/[A-Za-z]:\\/.test(src));
});
