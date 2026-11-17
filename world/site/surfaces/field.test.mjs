// field.test.mjs: the field on The Playground, the parts that run without a browser.
//   node --test world/site/surfaces/field.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import registry from './registry.mjs';
import * as W from './world-field.mjs';
import { still, readState, writeState, settled } from './room-field.mjs';
import manifest from '../../../site-src/world/surfaces/playground.mjs';

const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');

test('the field is carried unchanged from superframe: the copy hashes to its pin', () => {
  const pin = JSON.parse(read('./world-field.vendored.json')), body = read('./world-field.mjs').replace(/\r\n/g, '\n');
  const sha = (s) => createHash('sha256').update(s).digest('hex');
  assert.equal(sha(body), pin.sha256, 'world-field.mjs changed: carry a fresh build from superframe and change the pin with it');
  assert.notEqual(sha(body.replace('Luneburg', 'Lunebrug')), pin.sha256, 'planted: a one-word edit breaks the pin');
  assert.match(body.split('\n')[0], /built by packages\/world\/bundle\.mjs/);
});

test('the field is a registry module on The Playground, light, reading no element table', () => {
  const row = registry.SURFACES.field;
  assert.equal(row.room, 'field'); assert.equal(row.table, false); assert.equal(row.weight, 'light'); assert.equal(row.form, 'live'); assert.equal(row.home, 'playground');
  assert.deepEqual(row.takes, ['palette']); assert.deepEqual(row.gives, ['numbers', 'image']);
  const r = manifest.rooms.find((x) => x.id === 'field');
  assert.ok(r && r.anchor === 'field' && !/—/.test(r.say + r.exchange + r.heading), 'the words carry no em dash');
});

test('every element can carry every property, and the scene starts with each property carried by something', () => {
  const s = W.createScene();
  for (const el of s.elements) assert.deepEqual(Object.keys(el.carries).sort(), [...W.PROPERTY_IDS].sort());
  for (const p of W.PROPERTY_IDS.filter((p) => p !== 'circuit')) assert.ok(s.elements.some((e) => e.carries[p] > 0), `${p} is carried`);
});

test('the still is the settled scene: rays, rims, dimensions and the scene in words', () => {
  const { html, caption } = still();
  assert.ok((html.match(/<path/g) || []).length >= 17 + 2, 'a path per ray and per dimension');
  assert.ok((html.match(/<circle/g) || []).length >= 4, 'a rim per element');
  assert.match(html, /aria-label="Light enters from the left in 17 rays/); assert.match(html, /mm ± /);
  assert.match(caption, /every one simulated/); assert.ok(!/—/.test(html + caption));
});

test('the address gives the same field back', () => {
  const s = settled(readState(new URLSearchParams()));
  s.set('glass', { carries: { flow: 0.25, measure: 0.5 } });
  const q = new URLSearchParams(writeState(s, 'glass')), back = readState(q);
  assert.equal(back.chosen, 'glass'); assert.equal(back.weights.glass.flow, 0.25); assert.equal(back.weights.glass.measure, 0.5); assert.equal(back.weights.water.lens, 1);
  assert.equal(readState(new URLSearchParams('fw=1,2,3&fe=nobody')).chosen, 'water', 'a damaged address opens the default field');
});

test('continuity holds in the copy the page runs, and its control fails', () => {
  const f = (w) => { const s = W.createScene({ size: { ...W.SIZE, nx: 40, ny: 24 } }); s.set('water', { carries: { lens: w } }); return s.n2Point(0.95, 0.6); };
  assert.ok(W.continuity(f, { n: 40 }).continuous);
  assert.equal(W.continuity((w) => (w > 0.5 ? 1 : 0)).continuous, false);
});
