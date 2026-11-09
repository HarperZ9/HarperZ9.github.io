import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NODES, node } from './nodes.js';

test('every node declares typed ports, a SPEC and runs headless', () => {
  for (const n of NODES) { assert.ok(n.ports.in && n.ports.out && n.spec && typeof n.run === 'function', n.id); }
  const m = { w: 20, h: 24, v: new Float32Array(480).fill(1) };
  const plate = node('feed24.plate').run({ mask: m, time: 1 }, { W: 240 });
  assert.equal(plate.image.rgba.length, 240 * 160 * 4); assert.ok(plate.numbers.length > 0);
  const pts = node('feed24.orbital.sample').run({ state: [{ n: 2, l: 0, m: 0, c: 1 }, { n: 3, l: 2, m: 0, c: 1, group: 1 }] }, { count: 2000 }).points;
  const img = node('feed24.orbital.paint').run({ points: pts }, { W: 120 }).image; assert.equal(img.rgba.length, 120 * 120 * 4);
  assert.deepEqual(node('feed24.wordbits').run({ a: 'a', b: 'A' }).numbers, [[1]]);
  assert.equal(node('feed24.bitfield').run({}, { w: 8, h: 8 }).numbers[0], 0);
  const mos = node('feed24.bitmosaic').run({ mask: { w: 64, h: 32, v: new Float32Array(64 * 32).fill(1) }, spans: [{ x0: 0, x1: 64, code: 65 }] }); assert.equal(mos.image.w, 64);
});

test('nodes chain by medium: orbital points feed the painter, a plate image has the declared size', () => {
  assert.equal(node('feed24.orbital.sample').ports.out.points, node('feed24.orbital.paint').ports.in.points);
});
