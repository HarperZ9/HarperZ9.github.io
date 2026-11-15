// rooms.test.mjs: the parts of a room that run without a browser.   node --test world/site/surfaces/rooms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import registry from './registry.mjs';
import { createBus } from './bus.mjs';
import { KEYS, RANGE, TEXT, contrast, readState, still, writeState } from './room-forge.mjs';
import { DEFAULTS } from '../../../system/type-forge/forge.mjs';

test('the forge is a room in the registry, light, and reads no element table', () => {
  const row = registry.SURFACES.forge;
  assert.equal(row.room, 'type'); assert.equal(row.table, false); assert.equal(row.home, 'playground'); assert.equal(row.form, 'live');
  assert.deepEqual(row.takes, ['palette']); assert.deepEqual(row.gives, ['text', 'font', 'svg']);
  assert.equal(registry.TOOLS.find((t) => t.id === 'system/type-forge').mounted, 'forge');
});

test('the sliders start at the forge\'s own defaults', () => {
  for (const k of KEYS) assert.equal(RANGE[k][5], DEFAULTS[k], k);
});

test('the address gives the same face back, and numbers out of range are clamped', () => {
  const s = readState(new URLSearchParams('tf=0.145,0.82,1.2,0.5,2.4,0.6&caps=runic&line=Hello'));
  assert.equal(s.weight, 0.145); assert.equal(s.width, 1.2); assert.equal(s.caps, 'runic'); assert.equal(s.text, 'Hello');
  assert.deepEqual(readState(new URLSearchParams(Object.entries(writeState(s)).filter(([, v]) => v !== null))), s);
  const wild = readState(new URLSearchParams('tf=9,-1,x,0.5,2.4,0.6&caps=gothic'));
  assert.equal(wild.weight, 0.2); assert.equal(wild.contrast, 0.3); assert.equal(wild.width, 1); assert.equal(wild.caps, ''); assert.equal(wild.text, TEXT);
  assert.equal(readState(new URLSearchParams('tf=0.1,0.5')).weight, 0.085, 'a short list is ignored whole');
  assert.equal(writeState(readState(new URLSearchParams())).line, null, 'the default line stays out of the address');
});

test('contrast gives the known answers', () => {
  assert.equal(contrast('#000000', '#ffffff'), 21); assert.equal(contrast('#ffffff', '#000000'), 21); assert.equal(contrast('#777777', '#777777'), 1);
  assert.ok(Math.abs(contrast('#767676', '#ffffff') - 4.54) < 0.01);
});

test('the still is the default face as outlines, in whole units', () => {
  const s = still();
  assert.ok((s.html.match(/<path /g) || []).length >= 9); assert.ok(!/\d\.\d/.test(s.html.replace(/viewBox="[^"]*"/, ''))); assert.match(s.caption, /65 glyphs/);
});

test('the bus carries the forge\'s line to the lettering and refuses what the forge does not give', () => {
  const bus = createBus({ now: () => '2026-11-15T00:00:00Z' }), heard = [];
  bus.join('lettering', (env) => heard.push(env));
  const ok = bus.send('forge', 'text', { text: 'Low tide' }, { recipe: { text: 'Low tide' } });
  assert.equal(ok.ok, true); assert.deepEqual(ok.heard, ['lettering']); assert.equal(heard[0].value.text, 'Low tide'); assert.equal(heard[0].from.module, 'forge');
  assert.equal(bus.send('forge', 'blend', {}).ok, false);
});
