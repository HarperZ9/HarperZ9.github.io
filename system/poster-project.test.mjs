import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultPosterState } from './poster.js';
import { encodePosterProject, decodePosterProject, MAX_PROJECT_BYTES } from './poster-project.js';

test('editable typography, positions and art parameters round-trip without runtime objects', () => {
  const state = defaultPosterState('project');
  Object.assign(state.blocks[0], { text: 'First\nSecond', face: 'mono', tracking: -0.03, leading: 1.45, weight: 600, position: { x: 0.25, y: 0.3 } });
  Object.assign(state.art, { retro: { palette: 'gameboy' }, retroMix: 0.75, retroRes: 'fine', fx: ['scanline'], fxAmount: 0.4 });
  const options = { effects: ['scanline'] };
  const reopened = decodePosterProject(encodePosterProject(state, null, options), options);
  assert.deepEqual(reopened.state.blocks, state.blocks);
  assert.deepEqual(reopened.state.art.retro, { palette: 'gameboy' });
  assert.deepEqual(reopened.state.art.fx, ['scanline']);
  assert.equal(reopened.state.art.fxAmount, 0.4);
  assert.equal(reopened.image, null);
  assert(!('image' in reopened.state.art));
});

test('invalid fields and executable-looking URLs cannot enter the project state', () => {
  const original = JSON.parse(encodePosterProject(defaultPosterState('validation'), null));
  const mutations = [
    r => { r.version = 2; }, r => { r.state.format = 'constructor'; },
    r => { r.state.blocks[0].position = { x: -1, y: 0 }; },
    r => { r.state.blocks[0].tracking = '0.2'; }, r => { r.state.blocks[0].size = null; },
    r => { r.state.blocks[0].text = 'x'.repeat(4001); },
    r => { r.state.blocks[0].color = 'url(https://example.invalid/)'; },
    r => { r.state.art.layers = ['unknown-script']; }, r => { r.state.art.fx = ['unknown-effect']; },
    r => { r.image = 'https://example.invalid/private.png'; },
    r => { r.image = 'data:image/svg+xml,<svg onload="alert(1)"/>'; },
  ];
  for (const mutate of mutations) {
    const record = structuredClone(original); mutate(record);
    assert.throws(() => decodePosterProject(JSON.stringify(record)));
  }
  assert.throws(() => decodePosterProject(' '.repeat(MAX_PROJECT_BYTES + 1)));
  assert.throws(() => decodePosterProject('{'));
});

test('large PNG dimensions are rejected before decoding image pixels', () => {
  const record = JSON.parse(encodePosterProject(defaultPosterState('image'), null));
  const png = Buffer.alloc(33);
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).copy(png);
  png.writeUInt32BE(13, 8); png.write('IHDR', 12);
  png.writeUInt32BE(8000, 16); png.writeUInt32BE(8000, 20);
  record.image = 'data:image/png;base64,' + png.toString('base64');
  assert.throws(() => decodePosterProject(JSON.stringify(record)));
});

test('saving cannot silently discard an image or an unrepeatable live seed', () => {
  const state = defaultPosterState('live');
  assert.throws(() => encodePosterProject(state, null));
  state.art.seed = 'fixed'; state.art.image = { width: 1, height: 1 };
  assert.throws(() => encodePosterProject(state, null));
});
