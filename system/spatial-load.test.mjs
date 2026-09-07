import test from 'node:test';
import assert from 'node:assert/strict';
import { spatialSceneLoad } from './spatial-load.js';
import { makeHardwareRenderPlan } from './engine/render-plan.js';

const viewport = { width: 1280, height: 720 };
test('atlas workload budgets for the largest selectable scene, not a collection sum', () => {
  assert.deepEqual(spatialSceneLoad({ mode: 'ngsf-atlas', scenes: [{ gaussian_count: 300 }, { gaussian_count: 900 }] }, viewport),
    { ...viewport, splats: 900, meshes: 0, postPasses: 0 });
});
test('hybrid workload includes support, structural depth and color mesh passes', () => {
  assert.deepEqual(spatialSceneLoad({ mode: 'textured-hybrid', splats: { count: 23850 },
    textured: { color_order: ['sky', 'water', 'city'], structural: ['city', 'water'] } }, viewport),
    { ...viewport, splats: 23850, meshes: 6, postPasses: 0 });
});
test('actual loaded complexity changes the hardware budget for a demanding world', () => {
  const manifest = { mode: 'procedural-veils', splats: { count: 900000 }, layers: Array(8).fill({}) };
  const plan = makeHardwareRenderPlan({ webgl2: {} }, spatialSceneLoad(manifest, { width: 2000, height: 1500 }));
  assert.equal(plan.sceneLoad, 7.95);
  assert.equal(plan.splatBudget, 90000);
});
test('invalid manifest counts cannot become a misleadingly small workload', () => {
  for (const value of [-1, NaN, Infinity, '300', 2.5]) {
    assert.throws(() => spatialSceneLoad({ mode: 'ngsf-atlas', scenes: [{ gaussian_count: value }] }, viewport), /Invalid/);
  }
});
test('incomplete or unknown world modes produce explicit workload refusals', () => {
  for (const manifest of [null, {}, { mode: 'unknown', splats: { count: 1 }, layers: [] },
    { mode: 'ngsf-atlas' }, { mode: 'ngsf-atlas', scenes: [null] },
    { mode: 'textured-hybrid', splats: { count: 1 } },
    { mode: 'textured-hybrid', splats: { count: 1 }, textured: { color_order: [], structural: null } },
    { mode: 'procedural-veils', splats: { count: 1 } }]) {
    assert.throws(() => spatialSceneLoad(manifest, viewport), /Invalid spatial package workload/);
  }
});
