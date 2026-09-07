import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeSpatialView, spatialViewUrl } from './spatial-view.js';

const atlas = () => ({ version: 1, world: 'atlas', scene: 'scene-18', paused: true, mode: 1,
  camera: { yaw: .25, pitch: -.15, distance: 3 },
  controls: { depthScale: .65, splatScale: 1.2, exposure: 1.1, opacityScale: .92, gamma: 2.2, holoStrength: .08, iridescence: .42 },
  compare: { mode: 'side', mix: .4 } });

test('share URLs reopen the selected collection and retain an edited view', () => {
  const url = new URL(spatialViewUrl(atlas(), 'https://example.com/studio.html?unrelated=private#old'));
  assert.equal(url.pathname, '/studio.html');
  assert.equal(url.searchParams.get('source'), 'spatial');
  assert.equal(url.searchParams.get('scene'), 'scene-18');
  assert.deepEqual(decodeSpatialView(url.searchParams.get('view')), atlas());
  assert.equal(url.searchParams.has('unrelated'), false);
  assert.equal(url.hash, '');
});

test('unknown fields and asset locations never enter a share link', () => {
  const input = atlas(); input.privateNote = 'PRIVATE'; input.controls.asset = 'https://example.com/PRIVATE';
  assert.equal(spatialViewUrl(input, 'https://example.com/').includes('PRIVATE'), false);
});

test('malformed views cannot select external worlds or unbounded render settings', () => {
  for (const change of [
    v => { v.world = 'https://example.com/model'; },
    v => { v.scene = '../../private'; },
    v => { v.camera.distance = 100000; },
    v => { v.controls.depthScale = -1; },
    v => { v.controls.gamma = null; },
    v => { v.mode = 99; },
    v => { v.compare.mix = '0.5'; },
  ]) {
    const input = atlas(); change(input);
    assert.throws(() => decodeSpatialView(JSON.stringify(input)), /Unsupported/);
  }
  assert.throws(() => decodeSpatialView(' '.repeat(4000) + JSON.stringify(atlas())), /Unsupported/);
});
