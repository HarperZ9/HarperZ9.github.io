// node --test world/site/surfaces/bus.test.mjs
// The exchange envelope, the registry's row fields and the kernel's parity with its BuildLang source, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { SURFACES, MEDIA, HOMES, FORMS, LIGHT_BYTES } from './registry.mjs';
import { createBus, refusal, accepts, sessionId, isSessionId, sessionIdsIn, canonical, SESSION } from './bus.mjs';
import { fnv1a, sessionHash } from './bus-kernel.mjs';

const root = new URL('../../../', import.meta.url);
const json = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
const AT = '2026-11-15T12:00:00.000Z';
const bus = () => createBus({ now: () => AT });
const palette = { ink: '#1b2a41', ground: '#f3ead7', mix: '#1b2a41' };
const good = () => ({ medium: 'palette', refs: ['ink', 'paper'], value: palette, from: { module: 'blend', surface: 'playground', form: 'live', at: AT, recipe: { elements: ['ink', 'paper'], weights: [1, 1] } } });

test('every registry row says where the module stands', () => {
  const uses = json('world/site/surfaces/uses.json');
  for (const s of Object.values(SURFACES)) {
    assert.ok(HOMES.includes(s.home), `${s.id} home`);
    if (!s.load) { assert.equal(s.state, 'placeholder'); assert.equal(s.form, null); assert.equal(s.weight, null); continue; }
    assert.equal(s.state, 'ready'); assert.ok(FORMS.includes(s.form), `${s.id} form`);
    assert.ok(s.form === 'live' ? s.evidence === null : ['date', 'command', 'file', 'sha256'].every((k) => s.evidence?.[k]), `${s.id}: a replay or captured module carries its evidence record`);
    assert.ok(s.plain === null || /^\/[\w./-]*$/.test(s.plain), `${s.id} plain`);
    // the census measured what the adapter reaches; a module over the limit is marked heavy, and no light one is over
    const m = uses.modules[s.id];
    assert.ok(m && m.bytes > 0, `${s.id} is in the census`);
    assert.equal(s.weight, m.bytes > LIGHT_BYTES ? 'heavy' : 'light', `${s.id} reaches ${m.bytes} bytes`);
    assert.deepEqual({ home: m.home, form: m.form, state: m.state, weight: m.weight, plain: m.plain }, { home: s.home, form: s.form, state: s.state, weight: s.weight, plain: s.plain }, `${s.id}: the census is stale; run node scripts/surface-census.mjs --write`);
  }
  assert.equal(uses.format, 'surfaces.uses/2');
  assert.deepEqual(Object.keys(uses.modules), Object.keys(SURFACES));
});

test('the output of one module is accepted by the takes of another, and by no module that does not take it', () => {
  const b = bus(), heard = { plot: [], chart: [], loom: [], blend: [] };
  for (const id of Object.keys(heard)) b.join(id, (env, sid) => heard[id].push([env, sid]));
  const sent = b.send('blend', 'palette', palette, { refs: ['ink', 'paper'], recipe: { elements: ['ink', 'paper'] } });
  assert.equal(sent.ok, true);
  assert.deepEqual(sent.heard.sort(), ['loom', 'plot'], 'plot and loom take a palette');
  assert.equal(heard.plot.length, 1); assert.equal(heard.loom.length, 1);
  assert.equal(heard.chart.length, 0, 'the chart takes elements and settings, not a palette');
  assert.equal(heard.blend.length, 0, 'a module does not hear itself');
  const [env, sid] = heard.plot[0];
  assert.deepEqual(Object.keys(env), ['medium', 'refs', 'value', 'from']);
  assert.deepEqual(Object.keys(env.from), ['module', 'surface', 'form', 'at', 'recipe']);
  assert.deepEqual(env.from, { module: 'blend', surface: 'playground', form: 'live', at: AT, recipe: { elements: ['ink', 'paper'] } });
  assert.equal(env.value, palette); assert.equal(sid, sent.id);
  assert.ok(Object.isFrozen(env) && Object.isFrozen(env.from) && Object.isFrozen(env.refs), 'a listener cannot rewrite what was sent');
  assert.ok(accepts('plot', env) && !accepts('chart', env) && !accepts('no-such-module', env));
  // the vocabulary and the rows agree: everything a module gives or takes is a medium
  for (const s of Object.values(SURFACES)) for (const g of [...s.gives, ...s.takes]) assert.ok(MEDIA.includes(g), `${s.id}: ${g}`);
  // leaving stops the hearing
  const c = bus(), got = [], leave = c.join('plot', (e) => got.push(e));
  c.send('blend', 'palette', palette); leave(); c.send('blend', 'palette', { ...palette, ink: '#000000' });
  assert.equal(got.length, 1);
});

test('a malformed envelope is refused, with the reason, and nobody hears it', () => {
  assert.equal(refusal(good()), null);
  const cases = [
    [null, /an envelope is an object/], [[], /an envelope is an object/],
    [{ ...good(), extra: 1 }, /no field named extra/],
    [(({ refs, ...e }) => e)(good()), /lacks refs/],
    [{ ...good(), medium: 'smell' }, /not a medium/],
    [{ ...good(), refs: 'ink' }, /refs is a list/], [{ ...good(), refs: ['ink', 7] }, /refs is a list/],
    [{ ...good(), refs: ['session.xyz'] }, /not a session id/],
    [{ ...good(), value: undefined }, /no value/],
    [{ ...good(), from: null }, /who made/],
    [{ ...good(), from: (({ recipe, ...f }) => f)(good().from) }, /from lacks recipe/],
    [{ ...good(), from: { ...good().from, module: 'nobody' } }, /no module named/],
    [{ ...good(), from: { ...good().from, module: 'sound' } }, /nothing behind it/],
    [{ ...good(), medium: 'wav' }, /does not give wav/],
    [{ ...good(), from: { ...good().from, surface: 'basement' } }, /not one of the surfaces/],
    [{ ...good(), from: { ...good().from, form: 'staged' } }, /not a form/],
    [{ ...good(), from: { ...good().from, form: 'captured' } }, /is live in the registry/],
    [{ ...good(), from: { ...good().from, at: 'yesterday' } }, /ISO time/],
  ];
  for (const [env, why] of cases) {
    assert.match(refusal(env), why);
    const b = bus(), heard = []; b.join('plot', (e) => heard.push(e));
    const out = b.deliver(env);
    assert.equal(out.ok, false); assert.match(out.why, why); assert.equal(heard.length, 0); assert.deepEqual(b.ids(), []);
  }
  // a session id nobody made in this tab is refused too
  const b = bus(), heard = []; b.join('plot', (e) => heard.push(e));
  const out = b.deliver({ ...good(), refs: ['session.0123456789abcdef'] });
  assert.equal(out.ok, false); assert.match(out.why, /not made in this tab/); assert.equal(heard.length, 0);
  assert.throws(() => b.join('nobody', () => {}), /no module named/);
});

test('a value made in the page gets a session id and never enters a shipped table', () => {
  const elementsPath = 'world/ui/shell/organic/data/elements.json', before = readFileSync(new URL(elementsPath, root), 'utf8');
  const b = bus(), first = b.send('blend', 'palette', palette, { refs: ['ink', 'paper'], recipe: { elements: ['ink', 'paper'] } });
  assert.ok(isSessionId(first.id), first.id); assert.match(first.id, /^session\.[0-9a-f]{16}$/);
  assert.equal(first.id, sessionId('palette', palette, { elements: ['ink', 'paper'] }));
  // the same value and recipe give the same id, in key order or out of it; a different value or recipe gives another
  assert.equal(b.send('blend', 'palette', { mix: '#1b2a41', ground: '#f3ead7', ink: '#1b2a41' }, { recipe: { elements: ['ink', 'paper'] } }).id, first.id);
  assert.notEqual(b.send('blend', 'palette', { ...palette, ink: '#000000' }, { recipe: { elements: ['ink', 'paper'] } }).id, first.id);
  assert.notEqual(b.send('blend', 'palette', palette, { recipe: { elements: ['ink', 'water'] } }).id, first.id);
  assert.equal(b.ids().length, 3);
  // a later value can refer to it, and the bus gives it back; a shipped id is not a derived value
  const next = b.send('plot', 'image', { piece: 'flow-comb' }, { refs: [first.id, 'ink'] });
  assert.equal(next.ok, true); assert.deepEqual(b.derived(first.id).value, palette); assert.equal(b.derived('ink'), undefined);
  // nothing was written: the shipped element table is byte for byte what it was, and the registry holds no session id
  assert.equal(readFileSync(new URL(elementsPath, root), 'utf8'), before);
  assert.deepEqual(sessionIdsIn({ MEDIA, HOMES, FORMS, rows: Object.values(SURFACES).map(({ load, ...r }) => r) }), []);
  // every table that ships is free of session ids, as values and as keys
  for (const p of [elementsPath, 'world/site/surfaces/uses.json', 'world/site/surfaces/moods.json', 'site-src/world/demos.json', 'site-src/world/addresses.json'])
    assert.deepEqual(sessionIdsIn(json(p)), [], `${p} holds a session id`);
  assert.equal(sessionIdsIn({ a: ['x', { 'session.0123456789abcdef': 1 }], b: 'session.0123456789abcdef' }).length, 2, 'the scan finds a planted id and a planted key');
  // closing the page forgets them
  b.clear(); assert.deepEqual(b.ids(), []);
  assert.equal(canonical({ b: 1, a: [1, { d: null, c: 'x' }] }), '{"a":[1,{"c":"x","d":null}],"b":1}');
  assert.ok(SESSION === 'session.' && !isSessionId('session.XYZ') && !isSessionId('ink'));
});

test('the kernel matches its BuildLang source of record', () => {
  const expected = readFileSync(new URL('./src/bus_kernel.expected', import.meta.url), 'utf8').replace(/\r/g, '');
  const enc = (s) => new TextEncoder().encode(s), all = Uint8Array.from({ length: 256 }, (_, i) => i);
  const mine = [['empty', enc('')], ['a', enc('a')], ['abc', enc('abc')], ['bytes', all], ['palette', enc('{"medium":"palette"}')]].map(([n, b]) => `${n} ${sessionHash(b)}`).join('\n') + '\n';
  assert.equal(mine, expected);
  assert.equal(fnv1a(enc('a'), 1, 2166136261), 0xe40c292c, 'the published FNV-1a 32-bit value for "a"');
  // when a BuildLang compiler is on hand (BUILDC names it), the program is run again and must print the same lines
  const buildc = process.env.BUILDC;
  if (!buildc) return;
  const run = spawnSync(buildc, ['run', fileURLToPath(new URL('./src/bus_kernel.bld', import.meta.url))], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.replace(/\r/g, ''), expected);
});
