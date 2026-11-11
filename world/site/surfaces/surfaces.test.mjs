// node --test world/site/surfaces/surfaces.test.mjs
// The numbers behind the bench, the charts as markup, the registry's contract and the recipe, without a browser.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { mixValue, mixRule, indexElements, orderCells, blendTable, driveFor, materialFor, makeRecipe, readRecipe, quantile, DRIVES, GROUND_RANK } from './elements-data.mjs';
import { propertyChart, compareChart, pos, valueAt, sheetInk, span, GROUND } from './charts.mjs';
import { runRecipe, recipeGraph } from './recipe.mjs';
import { studioBlend } from './surface-blend.mjs';
import { contrast } from '../../studio/lib/blend.mjs';
import { validate } from '../../studio/lib/schema.mjs';
import registry, { TOOLS, SURFACES, CAPABILITIES, MEDIA, EMPTY, chain, toolsFor, pagesFor } from './registry.mjs';

const root = new URL('../../../', import.meta.url);
const data = JSON.parse(readFileSync(new URL('world/ui/shell/organic/data/elements.json', root), 'utf8'));
const ix = indexElements(data);

test('the table: 160 elements on 7 sheets, 19 properties, and a spread for each', () => {
  assert.equal(data.elements.length, 160); assert.equal(ix.sheets.length, 7); assert.equal(ix.spread.size, 19);
  const s = ix.spread.get('marks/ink coverage'), v = data.elements.flatMap((e) => e.properties.filter((p) => p.name === 'marks/ink coverage').map((p) => p.value)).sort((a, b) => a - b);
  assert.equal(s.count, v.length); assert.equal(s.min, v[0]); assert.equal(s.max, v.at(-1)); assert.equal(s.median, quantile(v, 0.5));
  assert.ok(s.lo <= s.min && s.hi >= s.max, 'the axis holds every interval');
});

test('position has meaning: firmest ground first, then most evidence', () => {
  let n = 0;
  for (const s of ix.sheets) { const c = orderCells(ix, s.id); n += c.length;
    for (let i = 1; i < c.length; i++) { const a = c[i - 1], b = c[i], ra = GROUND_RANK[a.ground], rb = GROUND_RANK[b.ground];
      assert.ok(ra < rb || (ra === rb && (a.evidence ?? 0) >= (b.evidence ?? 0)), `${a.id} before ${b.id}`); } }
  assert.equal(n, 160, 'every element has a cell');
});

test('the property chart shows every measured value where the data puts it, and marks the unmeasured', () => {
  const el = ix.byId.get('water'), html = propertyChart(ix, el, { settings: { coverage: 0.7 } });
  for (const p of el.properties) {
    assert.ok(html.includes(`data-prop="${p.name}"`)); assert.ok(html.includes(`data-value="${p.value}"`), p.name);
    assert.ok(html.includes(`class="pc-at" style="left:${pos(ix.spread.get(p.name), p.value)}%"`), `${p.name} sits at its value`);
    assert.ok(html.includes(`n ${p.n}, ${p.instrument}`));
  }
  assert.ok(html.includes(`class="pc-set" style="left:${pos(ix.spread.get('marks/ink coverage'), 0.7)}%"`), 'the visitor setting is marked');
  assert.match(html, /is-un[^>]*data-prop="flow\/mean speed"[\s\S]*?not measured/, 'water has no flow measurement, and the chart says so');
  const none = propertyChart(ix, data.elements.find((e) => !e.properties.length));
  assert.equal((none.match(/pc-un">not measured/g) || []).length, Object.keys(DRIVES).length);
});

test('axis positions invert: a control at a place gives back the value', () => {
  for (const s of ix.spread.values()) for (const v of [s.min, s.median, s.max]) assert.ok(Math.abs(valueAt(s, pos(s, v)) - v) <= Math.abs(v) * 2e-3 + (s.hi - s.lo) * 1e-4, `${s.name} ${v}`);
});

test('the compare chart places every element that has the property, low to high, and names the rest', () => {
  const html = compareChart(ix, 'flow/mean speed'), vals = [...html.matchAll(/class="cmp-row[^"]*" data-id="[^"]+" data-value="([^"]+)"/g)].map((m) => +m[1]);
  assert.equal(vals.length, 53); assert.deepEqual(vals, [...vals].sort((a, b) => a - b)); assert.equal((html.match(/class="cmp-un"/g) || []).length, 107);
});

test('category marks stand 3:1 off the ground, and each sheet has its own shape', () => {
  for (const s of ix.sheets) assert.ok(contrast(sheetInk(s.colour), GROUND) >= 3, s.id);
  const html = compareChart(ix, 'spatial/edge softness'), shapes = new Set([...html.matchAll(/<svg class="mk"[^>]*>(.*?)<\/svg>/g)].map((m) => m[1]));
  const sheets = new Set(ix.spread.get('spatial/edge softness').members.map((m) => m.sheet));
  assert.equal(shapes.size, sheets.size, 'as many shapes as sheets on the chart');
});

test('the blend table: parts side by side, a computed mix, measured links', () => {
  const t = blendTable(ix, ['water', 'ink', 'light'], [2, 1, 1]);
  assert.deepEqual(t.weights, [0.5, 0.25, 0.25]);
  const val = (id, n) => ix.byId.get(id).properties.find((p) => p.name === n)?.value;
  for (const r of t.rows) { let acc = 0, tw = 0; ['water', 'ink', 'light'].forEach((id, i) => { const v = val(id, r.name); if (v != null) { acc += t.weights[i] * v; tw += t.weights[i]; } });
    assert.equal(r.computed.label, 'computed'); assert.equal(r.computed.rule, mixRule(r.name));
    if (r.computed.rule === 'weighted') assert.ok(Math.abs(r.computed.value - acc / tw) < 1e-12, r.name); }
  assert.equal(t.rows.find((r) => r.name === 'spatial/wave orientation').computed.rule, 'circular'); assert.equal(t.rows.find((r) => r.name === 'frame/aspect').computed.rule, 'geometric');
  const some = blendTable(ix, ['water', 'air']).rows.filter((r) => r.parts.includes(null));
  for (const r of some) assert.equal(r.computed.of, 1, 'an unmeasured part stays empty and is left out of the mix');
  const wl = t.links.find((l) => l.a === 'water' && l.b === 'light');
  assert.equal(wl.ab.weight, ix.byId.get('water').links.find((l) => l.to === 'light').weight); assert.equal(wl.ab.label, 'measured');
});

test('the mix rule follows the kind of quantity: angles wrap, ratios multiply', () => {
  const near = (a, b, e = 1e-6) => Math.abs(a - b) < e, ang = 'spatial/wave orientation';
  const wrap = mixValue(ang, [5, 175], [1, 1]); assert.ok(near(wrap, 0) || near(wrap, 180), `5 and 175 degrees meet at 0, not 90 (got ${wrap})`);
  assert.ok(near(mixValue(ang, [170, 10], [3, 1]), 175, 1.5), 'weights pull along the short way round');
  assert.ok(near(mixValue(ang, [30, 60], [1, 1]), 45)); assert.ok(near(mixValue(ang, [80, 100], [1, 1]), 90));
  assert.equal(mixValue(ang, [0, 90], [1, 1]), 0, 'opposite directions have no mean; the first part stands');
  assert.ok(near(mixValue('frame/aspect', [2, 0.5], [1, 1]), 1), '2:1 and 1:2 mix to square');
  assert.ok(near(mixValue('marks/ink coverage', [0.2, 0.6], [3, 1]), 0.3));
});

test('an orientation property has a circular spread, so the chart is right if the data ever wraps', () => {
  const s = ix.spread.get('spatial/wave orientation'); assert.equal(s.circular, true); assert.equal(s.lo, 0); assert.equal(s.hi, 180);
  const wrapped = indexElements({ sheets: data.sheets, elements: [2, 4, 176, 178, 179].map((v, i) => ({ id: 'e' + i, sheet: 'material', links: [], properties: [{ name: 'spatial/wave orientation', value: v, iqr: [170, 10], n: 1, instrument: 'test' }] })) }).spread.get('spatial/wave orientation');
  assert.ok(wrapped.median > 175 || wrapped.median < 5, `the middle of 2, 4, 176, 178, 179 is near 0, not 90 (got ${wrapped.median})`);
  assert.equal(span(wrapped, 170, 10, 'x').match(/<i /g).length, 2, 'an interval that passes 180 is drawn in two pieces');
  assert.equal(span(wrapped, 30, 60, 'x').match(/<i /g).length, 1);
});

test('every element becomes a valid studio material, and the studio blends them', () => {
  for (const e of data.elements) { const v = validate(materialFor(ix, e)); assert.ok(v.ok, `${e.id}: ${v.errors?.join('; ')}`); }
  const b = studioBlend(ix, ['water', 'ink', 'light'], [1, 1, 1]);
  assert.match(b.palette.mix, /^#[0-9a-f]{6}$/); assert.equal(b.material.from.blend.length, 3);
  assert.equal(driveFor(ix, ix.byId.get('water')).source.coverage, 'measured'); assert.equal(driveFor(ix, ix.byId.get('water')).source.speed, 'table median');
  assert.equal(driveFor(ix, ix.byId.get('water'), { coverage: 0.9 }).source.coverage, 'set');
});

test('the recipe runs on the node graph runtime, has a stable hash, and reads back', () => {
  const r = makeRecipe(ix, ['water', 'ink'], [0.7, 0.3], { water: { coverage: 0.8, bogus: 1 } });
  const a = runRecipe(ix, r), b = runRecipe(ix, JSON.parse(JSON.stringify(r)));
  assert.ok(a.ok); assert.equal(a.hash, b.hash); assert.deepEqual(a.order, ['e0', 'e1', 'mix']); assert.equal(recipeGraph(ix, r).edges.length, 2);
  assert.notEqual(runRecipe(ix, makeRecipe(ix, ['water', 'ink'], [0.3, 0.7], {})).hash, a.hash, 'a different recipe has a different hash');
  const back = readRecipe(ix, r); assert.deepEqual(back.ids, ['water', 'ink']); assert.deepEqual(back.weights, [0.7, 0.3]); assert.deepEqual(back.settings.water, { coverage: 0.8 });
  assert.throws(() => readRecipe(ix, { format: 'something else' })); assert.throws(() => readRecipe(ix, { format: 'bench.recipe/1', elements: [{ id: 'not-an-element' }] }));
  assert.ok(!/thumb|http/.test(JSON.stringify(r)), 'a recipe carries no reference image or link');
});

test('the registry: every tool folder has a row, every surface keeps the contract, and tools chain', () => {
  const dirs = [];
  const hasCode = (d) => readdirSync(d, { withFileTypes: true }).some((f) => (f.isDirectory() ? hasCode(new URL(f.name + '/', d)) : /\.(m?js)$/.test(f.name)));
  for (const top of ['world', 'system']) for (const f of readdirSync(new URL(top + '/', root), { withFileTypes: true })) if (f.isDirectory() && f.name !== 'fonts' && hasCode(new URL(`${top}/${f.name}/`, root))) dirs.push(`${top}/${f.name}`);
  const rows = new Set(TOOLS.map((t) => t.id));
  assert.deepEqual(dirs.filter((d) => !rows.has(d)), [], 'no tool folder is missing from the registry');
  for (const t of TOOLS) { assert.ok(existsSync(new URL(t.id + '/', root)), t.id); assert.ok(t.offers.length && t.offers.every((c) => CAPABILITIES.includes(c)), `${t.id} offers`);
    assert.ok([...t.takes, ...t.gives].every((m) => MEDIA.includes(m)), `${t.id} media`); assert.ok(t.mounted === null || typeof t.mounted === 'string'); }
  for (const s of Object.values(SURFACES)) { assert.ok(s.offers.every((c) => CAPABILITIES.includes(c)) && [...s.takes, ...s.gives].every((m) => MEDIA.includes(m)), s.id);
    for (const t of s.tools) assert.ok(rows.has(t), `${s.id} names ${t}`); }
  assert.equal(SURFACES.sound.load, null, 'the sound layer has a place and nothing behind it');
  for (const t of TOOLS.filter((x) => typeof x.mounted === 'string' && x.mounted !== 'frame')) assert.ok(Object.values(SURFACES).some((s) => s.load && s.tools.includes(t.id)), `${t.id} says mounted, and a surface loads it`);
  assert.deepEqual([...EMPTY].sort(), ['fabricate', 'print', 'weave']);
  assert.deepEqual(chain('elements', 'png'), ['well']); assert.deepEqual(chain('elements', 'type'), ['blend', 'lettering']); assert.deepEqual(chain('elements', 'palette'), ['blend']);
  assert.deepEqual(chain('settings', 'json'), ['recipe']); assert.deepEqual(chain('elements', 'motion'), ['blend', 'motion']); assert.equal(chain('elements', 'wav'), null, 'nothing reaches sound yet');
  assert.equal(chain('elements', 'gcode'), null); assert.deepEqual(chain('palette', 'png'), ['plot']);
});

test('an element says which tools draw it and which pages use it', () => {
  const water = toolsFor(ix.byId.get('water')).map((t) => t.tool), bare = toolsFor(data.elements.find((e) => !e.properties.length));
  assert.ok(water.includes('world/studio') && water.includes('world/lettering') && water.includes('system/instruments'));
  assert.ok(bare.some((t) => /only its colour/.test(t.why)));
  const uses = JSON.parse(readFileSync(new URL('world/site/surfaces/uses.json', root), 'utf8'));
  assert.deepEqual(pagesFor('pigment', uses).map((p) => p.path), ['swatches.html']); assert.deepEqual(pagesFor('ink', uses).map((p) => p.path).sort(), ['accession.html', 'swatches.html']);
  assert.deepEqual(uses.benches, ['elements.html']); assert.ok(registry.mount && registry.unmountAll);
});
