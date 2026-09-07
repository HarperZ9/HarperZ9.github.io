import test from 'node:test';
import assert from 'node:assert/strict';
const codec = await import('./loom-project.js').catch(() => null);
const input = (perCell = false) => ({
  settings: { structureId: perCell ? 'jacquard' : 'plain', sett: 120, tone: 60, warp: 'rust', warpColor: '#123456', weft: 'image', speed: 24, epi: 24, weave: false, woven: 3, view: 'cloth', zoom: 1 },
  draft: { ends: 2, picks: 3, shafts: 2, treadles: 2, perCell,
    threading: [1, 0], treadling: [1, 0, 1], tieup: [[true, true], [false, true]],
    liftAt: (e, p) => [[1, 0], [1, 1], [1, 0]][p][e],
    lumaAt: (e, p) => [0.2, 0.4, 0.6, 0.8, 0, 1][p * 2 + e], pickTone: [0.3, 0.7, 0.5] },
  colors: { warpHex: '#123456', weftHexes: ['#abcdef', '#112233'], weftIndexAt: p => [1, 1, 0][p] },
  source: null, edited: true, imported: true,
});
test('an edited shaft draft and noncyclic weft mapping survive a project file', () => {
  assert.ok(codec, 'Loom needs a native project codec');
  const restored = codec.decodeLoomProject(codec.encodeLoomProject(input()));
  assert.deepEqual(restored.draft.threading, [1, 0]);
  assert.deepEqual(restored.draft.tieup, [[true, true], [false, true]]);
  assert.deepEqual([0, 1, 2].map(p => restored.colors.weftHexAt(p)), ['#112233', '#112233', '#abcdef']);
  assert.equal(restored.draft.liftAt(0, 0), true);
  restored.draft.tieup[1][1] = false;
  assert.equal(restored.draft.liftAt(0, 0), false, 'Reopened lift reads the live edited arrays');
  assert.equal(restored.source, null);
});
test('per-thread lift data is preserved instead of invented as a shaft draft', () => {
  assert.ok(codec);
  const restored = codec.decodeLoomProject(codec.encodeLoomProject(input(true)));
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => +restored.draft.liftAt(i % 2, Math.floor(i / 2))), [1, 0, 1, 1, 1, 0]);
  assert.deepEqual(Array.from({ length: 6 }, (_, i) => restored.draft.lumaAt(i % 2, Math.floor(i / 2))), [0.2, 0.4, 0.6, 0.8, 0, 1]);
});
test('unsupported versions, indices, dimensions and external image URLs are rejected', () => {
  assert.ok(codec);
  const valid = JSON.parse(codec.encodeLoomProject(input()));
  for (const mutate of [r => r.version = 2, r => r.draft.ends = 1e8, r => r.draft.threading[0] = 2,
    r => r.draft.treadling[0] = -1, r => r.draft.tieup[0] = [], r => r.colors.indices[0] = 9,
    r => r.source = 'https://example.com/secret', r => r.settings.zoom = 100,
    r => r.draft.luma[0] = null, r => r.settings.epi = 7]) {
    const changed = structuredClone(valid); mutate(changed);
    assert.throws(() => codec.decodeLoomProject(JSON.stringify(changed)));
  }
});
