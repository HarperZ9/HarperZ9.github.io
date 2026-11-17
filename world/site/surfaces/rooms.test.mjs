// rooms.test.mjs: the parts of a room that run without a browser.   node --test world/site/surfaces/rooms.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import registry from './registry.mjs';
import { createBus } from './bus.mjs';
import { KEYS, RANGE, TEXT, contrast, readState, still, writeState } from './room-forge.mjs';
import { DEFAULTS } from '../../../system/type-forge/forge.mjs';
import * as sound from './room-sound.mjs';
import { PIECES, PIECE_IDS } from '../../../system/site-music/pieces.js';
import { DEFAULT_MOODS } from '../../../system/site-music/index.js';
import { encodeWav } from '../../../world/sound/sound/wav.js';

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

test('sound is a room in the registry, heavy, and reads no element table', () => {
  const row = registry.SURFACES.sound;
  assert.equal(row.room, 'sound'); assert.equal(row.table, false); assert.equal(row.weight, 'heavy'); assert.equal(row.form, 'live'); assert.equal(row.state, 'ready');
  assert.deepEqual(row.takes, ['blend', 'text']); assert.deepEqual(row.gives, ['score', 'wav']);
  assert.equal(registry.TOOLS.find((t) => t.id === 'system/site-music').mounted, 'sound');
});

test("the sound room's address gives the same piece, band, seed and length back", () => {
  const s = sound.readState(new URLSearchParams('piece=clear-line&arr=alt&seed=4821&bars=32'));
  assert.deepEqual(s, { piece: 'clear-line', named: true, arr: 'alt', seed: 4821, bars: 32 });
  const again = sound.readState(new URLSearchParams(Object.entries(sound.writeState(s)).filter(([, v]) => v !== null)));
  assert.deepEqual(again, s);
  const wild = sound.readState(new URLSearchParams('piece=polka&arr=third&seed=0&bars=7'), 'glass-hour');
  assert.deepEqual(wild, { piece: 'glass-hour', named: false, arr: 'main', seed: null, bars: 16 });
  assert.equal(sound.readState(new URLSearchParams('seed=100000')).seed, null, 'a seed past the range is not a seed');
  assert.equal(sound.writeState(wild).bars, null, 'the default length stays out of the address');
});

test('a line of text always gives the same seed, inside the range', () => {
  assert.equal(sound.seedOf('Low tide'), sound.seedOf('  Low tide ')); assert.notEqual(sound.seedOf('Low tide'), sound.seedOf('High water'));
  for (const t of ['', 'a', 'Adhesion, rhythm and 2026 figures.', 'żółć']) { const n = sound.seedOf(t); assert.ok(Number.isInteger(n) && n >= 1 && n <= sound.SEED_MAX, t); }
});

test('a blend chooses the piece of its first part that has one, by share', () => {
  assert.deepEqual(sound.pieceFor(['ink', 'glass', 'type'], [1, 1, 1]), { order: ['ink', 'glass', 'type'], element: 'glass', piece: 'glass-hour', passed: ['ink'] });
  assert.equal(sound.pieceFor(['ink', 'glass', 'type'], [0.2, 0.3, 0.5]).piece, 'clear-line');
  assert.equal(sound.pieceFor(['water', 'ink']).piece, 'low-tide');
  assert.deepEqual(sound.pieceFor(['ink', 'paper'], [1, 1]), { order: ['ink', 'paper'], element: null, piece: null, passed: ['ink', 'paper'] });
  for (const id of Object.values(DEFAULT_MOODS)) assert.ok(PIECES[id], `${id} is a piece`);
});

test('the sound still lists every piece with eight bars, and no held-bar mark', () => {
  const s = sound.still();
  assert.equal((s.html.match(/<li>/g) || []).length, PIECE_IDS.length);
  for (const id of PIECE_IDS) assert.ok(s.html.includes(PIECES[id].title) && s.html.includes(`${PIECES[id].bpm} beats a minute`), id);
  for (const code of s.html.match(/<code>[^<]*<\/code>/g)) { assert.equal(code.split(' | ').length, 8); assert.ok(!code.includes('=')); }
});

test('the stated file size is the size of a 16-bit stereo file of that length', async () => {
  const { TAIL } = await import('../../../system/site-music/render.js'), { LEAD_IN } = await import('../../../system/site-music/piece.js');
  assert.equal(sound.TAIL, TAIL); assert.equal(sound.LEAD_IN, LEAD_IN);
  assert.equal(sound.samples('glass-hour', 16), 3 * 48000 + 16 * 115200 + 12 * 48000);
  const n = sound.samples('low-tide', 16), ch = [new Float32Array(n), new Float32Array(n)];
  const wav = encodeWav({ numberOfChannels: 2, length: n, sampleRate: sound.SR, getChannelData: (c) => ch[c] }), v = new DataView(wav);
  assert.equal(wav.byteLength, sound.wavBytes('low-tide', 16));
  assert.equal(String.fromCharCode(...new Uint8Array(wav, 0, 4)), 'RIFF'); assert.equal(v.getUint16(22, true), 2); assert.equal(v.getUint32(24, true), 48000); assert.equal(v.getUint16(34, true), 16);
});

test("the bus carries the blend and the forge's line to sound, and sound gives a score", () => {
  const bus = createBus({ now: () => '2026-11-15T00:00:00Z' }), heard = [];
  bus.join('sound', (env) => heard.push(env.medium));
  assert.deepEqual(bus.send('forge', 'text', { text: 'Low tide' }, { recipe: { text: 'Low tide' } }).heard, ['sound']);
  assert.deepEqual(bus.send('blend', 'blend', { elements: ['ink', 'glass'], weights: [1, 1], settings: {} }, { refs: ['ink', 'glass'], recipe: {} }).heard, ['sound']);
  assert.deepEqual(heard, ['text', 'blend']);
  assert.equal(bus.send('sound', 'score', { piece: 'low-tide' }, { recipe: { piece: 'low-tide' } }).ok, true);
  assert.equal(bus.send('sound', 'image', {}).ok, false);
});

test('the shader room is a room in the registry, light, and reads no element table', async () => {
  const row = registry.SURFACES.shader;
  assert.equal(row.room, 'shader'); assert.equal(row.table, false); assert.equal(row.weight, 'light'); assert.equal(row.form, 'live');
  assert.deepEqual(row.takes, ['palette', 'image', 'text']); assert.ok(row.gives.includes('image') && row.gives.includes('png'));
  for (const id of ['system/shader-runner.js', 'system/shader-presets.js']) assert.equal(registry.LOOSE.find((t) => t.id === id).mounted, 'shader');
  for (const taker of ['loom', 'ridges', 'voxels']) assert.ok(registry.SURFACES[taker].takes.includes('image'), `${taker} takes a picture`);
});

test('a shader survives the trip through the address, and a damaged link gives nothing', async () => {
  const shader = await import('./room-shader.mjs'), { STARTS } = await import('./shader-starts.mjs');
  for (const s of STARTS) { const packed = await shader.encodeSource(s.glsl); assert.match(packed, /^[zb]\.[A-Za-z0-9_-]+$/); assert.equal(await shader.decodeSource(packed), s.glsl); assert.ok(packed.length < s.glsl.length, `${s.id} is shorter in the address`); }
  assert.equal(await shader.decodeSource('b.' + Buffer.from('void mainImage(){} // żółć').toString('base64url')), 'void mainImage(){} // żółć');
  assert.equal(await shader.decodeSource('z.!!!'), null); assert.equal(await shader.decodeSource('q.AAAA'), null);
  assert.deepEqual(shader.knobsOf(new URLSearchParams('k=0.1,0.5,1')), [0.1, 0.5, 1]); assert.deepEqual(shader.knobsOf(new URLSearchParams('k=2,0,0')), [0.5, 0.5, 0.5]);
});

test('compile errors are read by line, in order, without repeats', async () => {
  const { errorsOf } = await import('./room-shader.mjs');
  assert.deepEqual(errorsOf("line 12: 'zzz' : undeclared identifier\nline 12: 'zzz' : undeclared identifier\nline 3: '=' : dimension mismatch"),
    [{ line: 12, message: "'zzz' : undeclared identifier" }, { line: 3, message: "'=' : dimension mismatch" }]);
  assert.deepEqual(errorsOf('WebGL is unavailable in this browser.'), [{ line: 0, message: 'WebGL is unavailable in this browser.' }]); assert.deepEqual(errorsOf(''), []);
});

test('every start is a whole shader, and every input the room lists is one the runner declares', async () => {
  const { STARTS } = await import('./shader-starts.mjs'), { INPUTS, still } = await import('./room-shader.mjs'), { readFileSync } = await import('node:fs');
  const runner = readFileSync(new URL('../../../system/shader-runner.js', import.meta.url), 'utf8'), wrap = runner.slice(runner.indexOf('function wrap'), runner.indexOf('export const DEFAULT_FRAG'));
  assert.equal(new Set(STARTS.map((s) => s.id)).size, STARTS.length);
  for (const s of STARTS) { assert.match(s.glsl, /void mainImage\(out vec4 \w+, in vec2 \w+\)/, s.id); assert.ok(!/[\u2014\u2013]/.test(s.glsl + s.name), `${s.id} has no dash rule broken`); assert.ok(s.glsl.startsWith('//'), `${s.id} says what it does first`); }
  for (const [names] of INPUTS) for (const n of names.split(', ')) assert.ok(new RegExp(`uniform \\w+ ${n.replace(/\[\d+\]/, '')}\\b`).test(wrap), `the runner declares ${n}`);
  const declared = [...wrap.matchAll(/uniform \w+ (\w+)/g)].map((m) => m[1]), listed = INPUTS.flatMap(([names]) => names.split(', ').map((n) => n.replace(/\[\d+\]/, '')));
  assert.deepEqual(declared.filter((d) => !listed.includes(d)), [], 'the room lists every input the runner declares');
  assert.equal((wrap.match(/\\n" \+/g) || []).length, 13, 'the preamble is thirteen lines, the number taken off a compile error');
  assert.match(runner, /export const PREAMBLE_LINES = 13;/);
  assert.match(still().html, /void mainImage/); assert.ok(!still().html.includes('<script'));
});

test('a picture travels as its maker\'s name, and the bus carries it to the loom, the plot map and the cubes', () => {
  const bus = createBus({ now: () => '2026-11-15T00:00:00Z' }), heard = [];
  for (const n of ['loom', 'ridges', 'voxels', 'shader']) bus.join(n, (env) => heard.push([n, env.value.of]));
  const out = bus.send('shader', 'image', { width: 640, height: 400, of: 'shader' }, { recipe: { shader: 'abc' } });
  assert.equal(out.ok, true); assert.deepEqual(out.heard.sort(), ['loom', 'ridges', 'voxels']);
  assert.deepEqual(bus.send('well', 'image', { width: 8, height: 8, of: 'well' }, { recipe: {} }).heard.sort(), ['loom', 'ridges', 'shader', 'voxels']);
  assert.equal(bus.send('shader', 'text', { text: 'x' }).ok, false);
});
