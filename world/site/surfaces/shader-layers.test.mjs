// shader-layers.test.mjs: the shader room's layer stack, the parts that run without a browser.
//   node --test world/site/surfaces/shader-layers.test.mjs
// The browser half (pixels, the planted mix-0 control, the address in a new tab, frame time) is tests/surface-rooms-shader.cjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { BLENDS, MAX_LAYERS, PALETTE_GLSL, PICTURE_MAKERS, DEFAULT_LAYER, propertiesOf, decodeLayers, encodeLayers, layerRow, moveLayer, stackLayer, validSrc, wantsLibrary } from './shader-layers.mjs';
import { blendOne, blendIndex, compositeSource, weightOf } from '../../../system/shader-stack.js';
import registry from './registry.mjs';
import { createBus } from './bus.mjs';

test('the stack offers at least the six blends asked for, and seven layers over the base', () => {
  const ids = BLENDS.map(([id]) => id);
  for (const id of ['normal', 'add', 'multiply', 'screen', 'overlay', 'difference']) assert.ok(ids.includes(id), id);
  assert.equal(new Set(ids).size, ids.length); assert.equal(MAX_LAYERS, 7);
});

test('each blend does what its name says, on the CPU copy of the composite', () => {
  const a = 0.25, b = 0.6;
  assert.equal(blendOne('normal', a, b), b); assert.equal(blendOne('add', a, b), 0.85); assert.equal(blendOne('add', 0.7, 0.6), 1);
  assert.equal(blendOne('multiply', a, b), 0.15); assert.ok(Math.abs(blendOne('screen', a, b) - 0.7) < 1e-12);
  assert.equal(blendOne('overlay', a, b), 2 * a * b); assert.ok(Math.abs(blendOne('overlay', 0.75, b) - (1 - 2 * 0.25 * 0.4)) < 1e-12);
  assert.ok(Math.abs(blendOne('difference', a, b) - 0.35) < 1e-12); assert.equal(blendOne('lighten', a, b), b); assert.equal(blendOne('darken', a, b), a);
  assert.equal(blendIndex('nonsense'), 0, 'an unknown blend draws as normal');
});

test('the composite shader reads every layer and has one branch per blend, in the order of the list', () => {
  const s = compositeSource();
  for (let i = 0; i <= MAX_LAYERS; i++) assert.match(s, new RegExp(`uniform sampler2D uL${i};`));
  const branches = (s.match(/if \(m < (\d)\.5\)/g) || []).length;
  assert.equal(branches, BLENDS.length - 1, 'one test per blend but the last, which is the fall-through');
  assert.ok(s.includes('mix(c, bl(uMode[1], c, s.rgb), weight(uMix[1], uKey[1], s))'), 'a layer at mix 0 has weight 0 and leaves c as it was');
  assert.ok(!/[—–]/.test(s), 'no dash rule broken in the composite');
});

test('a stack survives the address, presets with commas included, and a damaged part is dropped', () => {
  const layers = [{ src: 's:bands', blend: 'screen', mix: 0.5, key: 0 }, { src: 'pic:well', blend: 'multiply', mix: 0.33, key: 0.8 }, { src: 'p:Gold Ground, Lamp Moving', blend: 'overlay', mix: 1, key: 0 }, { src: 'palette', blend: 'add', mix: 0, key: 1 }, { src: 'text', blend: 'difference', mix: 0.07, key: 0 }];
  const packed = encodeLayers(layers);
  assert.ok(!packed.split(',').some((p) => !/^[a-z]+\.\d+(-\d+)?\./.test(p)), packed);
  assert.deepEqual(decodeLayers(packed), layers);
  // through URLSearchParams and the room's own comma rewrite, as rooms.mjs address() writes it
  const q = new URLSearchParams(); q.set('ly', packed); const written = q.toString().replace(/%2C/g, ',');
  assert.deepEqual(decodeLayers(new URLSearchParams(written).get('ly')), layers);
  assert.equal(encodeLayers([]), null);
  assert.deepEqual(decodeLayers('screen.50.s:nope,glow.50.s:bands,add.50.pic:sun,add.500.s:bands,,add.40.s:lamp'), [{ src: 's:lamp', blend: 'add', mix: 0.4, key: 0 }]);
  assert.match(packed, /^screen\.50\.s:bands,multiply\.33-80\.pic:well,/, 'the key is written only where it is set');
  assert.deepEqual(decodeLayers('add.40-101.s:lamp'), [], 'a key over 100 is refused');
  assert.equal(decodeLayers(Array(12).fill('add.10.s:bands').join(',')).length, MAX_LAYERS, 'never more than the stack holds');
  assert.equal(wantsLibrary(layers), true); assert.equal(wantsLibrary(layers.slice(0, 2)), false);
});

test('a layer\'s own light steers its weight as far as its key asks', () => {
  assert.equal(weightOf(0.5, 0, [0, 0, 0]), 0.5, 'key 0: the mix, everywhere');
  assert.equal(weightOf(0.5, 1, [0, 0, 0]), 0, 'key 1: nothing where the layer is black');
  assert.ok(Math.abs(weightOf(0.5, 1, [1, 1, 1]) - 0.5) < 1e-12, 'key 1: the whole mix where it is white');
  assert.ok(Math.abs(weightOf(1, 0.5, [0.5, 0.5, 0.5]) - 0.75) < 1e-12);
  assert.equal(weightOf(0.8, 0.3, [0.2, 0.9, 0.4], 0), 0, 'a clear pixel adds nothing');
  assert.ok(compositeSource().includes('float weight(float m, float k, vec4 s){ return m * s.a * mix(1.0, dot(s.rgb, vec3(0.2126, 0.7152, 0.0722)), k); }'), 'the GLSL weight is the same formula');
});

test('every source is an element with properties: the registry row of the module that makes it', () => {
  assert.deepEqual(propertiesOf('palette'), { maker: 'blend', name: 'The blend table', medium: 'palette', offers: [...registry.SURFACES.blend.offers], gives: [...registry.SURFACES.blend.gives] });
  assert.equal(propertiesOf('text').maker, 'forge'); assert.equal(propertiesOf('pic:loom').medium, 'image'); assert.equal(propertiesOf('s:bands').maker, 'shader');
  for (const [id] of PICTURE_MAKERS) assert.ok(propertiesOf(`pic:${id}`).offers.length > 0, id);
  assert.deepEqual(stackLayer({ src: 'palette', blend: 'add', mix: 1, key: 0.5 }, { library: null, pictureOf: () => null, textCanvas: () => null }).props, propertiesOf('palette'));
});

test('layers move one place at a time and the ends hold', () => {
  const L = ['a', 'b', 'c'];
  assert.deepEqual(moveLayer(L, 1, 1), ['a', 'c', 'b']); assert.deepEqual(moveLayer(L, 1, -1), ['b', 'a', 'c']);
  assert.equal(moveLayer(L, 0, -1), L); assert.equal(moveLayer(L, 2, 1), L); assert.deepEqual(L, ['a', 'b', 'c']);
});

test('every source is drawn as a shader or a picture with its blend and mix kept', () => {
  const canvas = { width: 4, height: 4 }, ctx = { library: [{ name: 'X', glsl: 'void mainImage(out vec4 O, in vec2 U){O=vec4(1.0);}' }], pictureOf: (id) => (id === 'well' ? canvas : null), textCanvas: () => canvas };
  assert.deepEqual(stackLayer({ src: 'palette', blend: 'add', mix: 0.2 }, ctx), { kind: 'shader', glsl: PALETTE_GLSL, blend: 'add', mix: 0.2, key: 0, props: propertiesOf('palette') });
  assert.equal(stackLayer({ src: 'pic:well', blend: 'screen', mix: 1 }, ctx).source(), canvas);
  assert.equal(stackLayer({ src: 'pic:loom', blend: 'screen', mix: 1 }, ctx).source(), null, 'a picture that is not there yet draws nothing');
  assert.equal(stackLayer({ src: 'text', blend: 'normal', mix: 1 }, ctx).source(), canvas);
  assert.match(stackLayer({ src: 's:bands', blend: 'normal', mix: 1 }, ctx).glsl, /iPalette/);
  assert.equal(stackLayer({ src: 'p:X', blend: 'normal', mix: 1 }, ctx).kind, 'shader');
  assert.equal(stackLayer({ src: 'p:X', blend: 'normal', mix: 1 }, { ...ctx, library: null }).source, null, 'a preset waits for the library');
  assert.match(PALETTE_GLSL, /^\/\/.*\nvoid mainImage\(out vec4 O, in vec2 U\)/);
  for (const [id] of PICTURE_MAKERS) assert.ok(validSrc(`pic:${id}`) && registry.SURFACES[id].gives.includes('image'), `${id} gives a picture`);
  assert.ok(validSrc(DEFAULT_LAYER.src));
});

test('a layer row has its source, blend, a 0 to 1 mix slider and its moves, each labelled', () => {
  const html = layerRow({ src: 'pic:loom', blend: 'overlay', mix: 0.42 }, 1, 3, { state: 'the loom’s weave' });
  for (const id of ['shd-l1-src', 'shd-l1-blend', 'shd-l1-mix', 'shd-l1-key']) { assert.match(html, new RegExp(`id="${id}"`)); assert.match(html, new RegExp(`<label for="${id}"`)); }
  assert.match(html, /type="range"[^>]*min="0" max="1" step="0.01" value="0.42"/, 'the mix is continuous, not a switch');
  assert.match(html, /<option value="pic:loom" selected>/); assert.match(html, /<option value="overlay" selected>/); assert.match(html, />42%</);
  assert.match(html, /data-l-lower="1"(?! disabled)/); assert.match(html, /data-l-raise="1"(?! disabled)/); assert.match(html, /data-l-rm="1"/);
  assert.match(layerRow(DEFAULT_LAYER, 0, 1), /data-l-lower="0" disabled/); assert.match(layerRow(DEFAULT_LAYER, 0, 1), /data-l-raise="0" disabled/);
});

test('the type forge\'s line reaches the shader room on the bus', () => {
  assert.ok(registry.SURFACES.shader.takes.includes('text'));
  const bus = createBus({ now: () => '2026-11-16T00:00:00Z' }), heard = [];
  bus.join('shader', (env) => heard.push(env.value.text));
  const out = bus.send('forge', 'text', { text: 'Estuary' });
  assert.ok(out.ok && out.heard.includes('shader')); assert.deepEqual(heard, ['Estuary']);
});
