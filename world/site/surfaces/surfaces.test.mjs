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
import registry, { TOOLS, LOOSE, SURFACES, CAPABILITIES, MEDIA, EMPTY, chain, toolsFor, pagesFor } from './registry.mjs';

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
  assert.deepEqual([...EMPTY].sort(), ['print'], 'weave and fabricate have tools on the site (single files, listed as LOOSE); print still has none');
  for (const t of LOOSE) { assert.ok(existsSync(new URL(t.id, root)), t.id); assert.ok(t.offers.every((c) => CAPABILITIES.includes(c)) && t.mounted === null); }
  assert.equal(TOOLS.find((t) => t.id === 'world/feed-23').mounted, 'well'); assert.equal(LOOSE.filter((t) => t.overlap).length, 2, 'two overlaps with bench code are named');
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

// Paint optics, conservation and the reaction (km.mjs, glaze.mjs, well-sim.mjs).
const { pigment, layer, onGround, glaze, apart, PAPER, mixture, srgbToLin, linToHex, BAND_RGB } = await import('./km.mjs'), SP = await import('../../superframe/lib/medium/spectral.mjs');
const { paintOf, glazeOf, orderGap } = await import('./glaze.mjs');
const { createSim, STEP, TOLERANCE } = await import('./well-sim.mjs');

test('a pigment worked out from a colour and an opacity gives that colour back over white, and opacity times it over black', () => {
  for (const [lin, o] of [[[0.5, 0.2, 0.1], 0.5], [[0.9, 0.8, 0.1], 0.05], [[0.08, 0.19, 0.2], 0.39], [[0.3, 0.3, 0.3], 0.9]]) {
    const L = layer(pigment(lin, o), 1), w = onGround([L], [1, 1, 1]), b = onGround([L], [0, 0, 0]);
    lin.forEach((c, i) => { assert.ok(Math.abs(w[i] - c) < 1e-6, `over white ${w[i]} for ${c}`); assert.ok(Math.abs(b[i] - o * c) < 1e-6, `over black ${b[i]} for ${o * c}`);
      assert.ok(L.R[i] >= 0 && L.T[i] >= 0 && L.R[i] + L.T[i] <= 1 + 1e-9, 'a layer sends back and lets through no more light than reached it'); });
  }
  const none = layer(pigment([0.5, 0.2, 0.1], 0), 0); assert.deepEqual(none.T.map((t) => +t.toFixed(9)), [1, 1, 1], 'no thickness, no change');
});

test('glazing order changes the overlap when the pigments scatter, and does not when they do not', () => {
  const lin = [[0.5, 0.2, 0.1], [0.08, 0.19, 0.2]], gap = (o) => { const a = pigment(lin[0], o), b = pigment(lin[1], o); return apart(glaze(a, b), glaze(b, a)); };
  assert.ok(gap(0.5) > 20, `scattering pigments: the two orders are ${gap(0.5).toFixed(1)} of 255 apart`);
  assert.ok(gap(0) < 0.5, `pure absorbers: the two orders are ${gap(0).toFixed(3)} of 255 apart`);
  let last = 0; for (const o of [0.02, 0.1, 0.3, 0.6]) { const g = gap(o); assert.ok(g > last, 'more opacity, more difference between the orders'); last = g; }
  // the elements themselves: opacity is the measured ink coverage, and a setting on coverage moves it
  const water = paintOf(ix, ix.byId.get('water')), fire = paintOf(ix, ix.byId.get('fire-heat'));
  assert.equal(water.opacity, ix.byId.get('water').properties.find((p) => p.name === 'marks/ink coverage').value); assert.equal(water.opacityFrom, 'measured');
  assert.ok(orderGap(water, fire) > 20); assert.notEqual(glazeOf(water, fire).hex, glazeOf(fire, water).hex);
  const clear = (id) => paintOf(ix, ix.byId.get(id), { coverage: 0 }); assert.ok(orderGap(clear('water'), clear('fire-heat')) < 0.5, 'with coverage set to nothing the same pair is order-free');
  assert.equal(paintOf(ix, data.elements.find((e) => !e.properties.length)).opacityFrom, 'table median', 'an unmeasured coverage is marked');
  assert.ok(PAPER.every((c) => c > 0.6), 'the paper is light');
});

const drive = { speed: 0.5, curl: 0.5, coherence: 0.4, bleed: 0.5, scale: 0.5 };
const pair = (link, d = drive) => [{ weight: 1, drive: d, links: [0, link] }, { weight: 1, drive: d, links: [link, 0] }];
const shake = (s, steps = 600) => { for (let i = 0; i < steps; i++) { if (i % 40 === 0) s.stir(0.3 + 0.4 * ((i * 37 % 100) / 100), 0.5, 3, 2); if (i === 100) s.pour(0, 0.6, 0.4); if (i === 200) s.tilt(1, 0); if (i === 400) s.tilt(0, 0); s.step(STEP); } return s; };

test('the well keeps the amount of each pigment through stirring, pouring and tilting', () => {
  const s = createSim(); s.set(pair(0)); s.seed(); const start = s.put();
  shake(s); const put = s.put(), now = s.amounts();
  assert.ok(put[0] > start[0] * 1.01 && Math.abs(put[1] - start[1]) < 1e-12, 'a pour adds to what was put in, for that pigment only');
  for (const i of [0, 1]) assert.ok(Math.abs(now[i] - put[i]) / put[i] <= TOLERANCE, `pigment ${i}: ${now[i]} against ${put[i]}`);
  assert.ok(s.error() <= TOLERANCE, `worst pigment is ${s.error()} out, the tolerance is ${TOLERANCE}`);
  // the control: the same run without the correction leaves the tolerance, so this test can fail
  const raw = createSim({ conserve: false }); raw.set(pair(0)); raw.seed(); shake(raw);
  assert.ok(raw.error() > TOLERANCE * 100, `without the correction the amount drifts by ${raw.error()}`);
  assert.ok(s.drift() > TOLERANCE && s.drift() < 0.05, `the worst single step was ${s.drift()} out before it was scaled back`);
});

test('a link grows a product at the scale the pair sets; no link grows none', () => {
  const linked = createSim({ reduced: true }); linked.set(pair(0.9)); linked.seed(); linked.settle();
  const none = createSim({ reduced: true }); none.set(pair(0)); none.seed(); none.settle();
  assert.ok(linked.product() > 0.01, `a strong link grows a product (${linked.product()})`); assert.equal(none.product(), 0);
  assert.ok(linked.RV.every((v) => v >= 0 && v <= 1), 'the product stays a share between 0 and 1');
  assert.ok(linked.error() <= TOLERANCE, 'the reaction takes no pigment away');
  const fine = createSim({ reduced: true }); fine.set(pair(0.9, { ...drive, scale: 0 })); fine.seed(); fine.settle();
  const broad = createSim({ reduced: true }); broad.set(pair(0.9, { ...drive, scale: 1 })); broad.seed(); broad.settle();
  assert.ok(broad.grain > fine.grain, 'a longer measured wave gives the reaction larger features');
  // feature size, measured: the mean width of the product's strokes along rows through the middle, in reaction cells
  const width = (s) => { let n = 0, on = 0; for (let y = 40; y < 180; y += 4) for (let x = 1; x < 288; x++) { const a = s.RV[y * 288 + x] > 0.15; if (a) on++; if (a !== (s.RV[y * 288 + x - 1] > 0.15)) n++; } return 2 * on / n; };
  assert.ok(width(broad) > width(fine) * 1.15, `the broad pattern's strokes are wider (${width(broad).toFixed(1)} cells against ${width(fine).toFixed(1)})`);
});

// Grounds: which one a blend lies on, and the rule each keeps (grounds.mjs).
const { GROUNDS, RULES, NOT_BUILT, groundFor, mixOn } = await import('./grounds.mjs');

test('the ground follows the blend: the first material with a ground, else the page; a choice stands', () => {
  const g = (ids, choice, night) => groundFor(ix, ids, choice, night);
  assert.deepEqual([g(['water', 'ink']).id, g(['water', 'ink']).pigments], ['water', ['ink']], 'ink on water');
  assert.deepEqual([g(['ink', 'paper']).id, g(['ink', 'paper']).pigments], ['paper', ['ink']], 'ink on paper: ink has no ground of its own, paper has');
  assert.deepEqual([g(['light', 'glass', 'fire-heat']).id, g(['light', 'glass', 'fire-heat']).pigments], ['light', ['glass', 'fire-heat']]);
  assert.deepEqual([g(['water']).id, g(['water']).pigments, g(['water'], null, true).id], ['paper', ['water'], 'water'], 'one element alone is the pigment; the ground follows the page');
  assert.equal(g(['fire-heat', 'ink']).id, 'paper'); assert.equal(g(['fire-heat', 'ink'], null, true).id, 'water'); assert.match(g(['fire-heat', 'ink']).why, /no ground of its own yet/);
  const mine = g(['water', 'ink'], 'glass'); assert.deepEqual([mine.id, mine.auto, mine.pigments, mine.why], ['glass', false, ['water', 'ink'], 'your choice']);
  const onTable = Object.keys(GROUNDS).filter((id) => !GROUNDS[id].made);   // the rest are made: reached by an operation or a chain
  for (const id of [...onTable, ...NOT_BUILT]) assert.equal(ix.byId.get(id)?.sheet, 'material', `${id} is on the material sheet`);
  for (const id of Object.keys(GROUNDS)) if (GROUNDS[id].made) assert.ok(!ix.byId.has(id), `${id} is made, and is not an element on the table`);
  assert.equal(onTable.length + NOT_BUILT.length, data.elements.filter((e) => e.sheet === 'material').length, 'every material is either a ground or named as not built');
  assert.ok(new Set(Object.values(GROUNDS).map((x) => x.group.split(',')[0])).size >= 5, 'five kinds of ground');
  const r = makeRecipe(ix, ['water', 'ink'], [1, 1], {}, 'glass'); assert.equal(r.ground, 'glass'); assert.equal(readRecipe(ix, r).ground, 'glass');
  assert.equal(readRecipe(ix, makeRecipe(ix, ['water', 'ink'], [1, 1], {})).ground, null); assert.equal(readRecipe(ix, { ...r, ground: 'not-a-ground' }).ground, null);
});

test('each ground keeps its stated rule on red and green', () => {
  const red = [0.6, 0.04, 0.03], green = [0.04, 0.45, 0.05], P = [red, green].map((lin) => ({ lin, pig: pigment(lin, 0.4) })), Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  const both = (id) => mixOn(id, P), one = (id, i) => mixOn(id, [P[i]]), swap = (id) => mixOn(id, [P[1], P[0]]);
  for (const [id, g] of Object.entries(GROUNDS)) { const m = both(id), gap = apart(m, swap(id));
    if (!RULES[g.rule].ordered) assert.ok(gap < 0.01, `${id}: the order does not matter (${gap})`);
    if (g.rule === 'layers') { assert.ok(Y(m) < Y(one(id, 1)) && Y(swap(id)) < Y(one(id, 0)), `${id}: a wash over another is darker than the same wash alone on the ground`); assert.ok(gap > 5, `${id}: and the order shows (${gap.toFixed(1)} of 255)`); }
    if (g.rule === 'transmit') { assert.ok(Y(m) < Math.min(Y(one(id, 0)), Y(one(id, 1))), `${id}: two filters are darker than either`); m.forEach((x, c) => assert.ok(Math.abs(x - one(id, 0)[c] * one(id, 1)[c] / g.base[c]) < 1e-9, 'filters multiply')); }
    if (g.rule === 'additive') { assert.ok(Y(m) > Math.max(Y(one(id, 0)), Y(one(id, 1))), `${id}: two lights are brighter than either`); assert.ok(m[0] > 0.4 && m[1] > 0.3 && m[2] < 0.1, `${id}: red and green go toward yellow (${m.map((x) => x.toFixed(2))})`); }
    if (g.rule === 'volume') m.forEach((x, c) => assert.ok(x >= Math.min(red[c], green[c], g.base[c]) - 1e-9 && x <= Math.max(red[c], green[c], g.base[c]) + 1e-9, `${id}: an average lies between its parts`));
    if (g.rule === 'mixture') assert.ok(Y(m) < Y(mixOn('air', P)), 'a true mixture in water is darker than the plain average in air');
    if (g.rule === 'partitive') m.forEach((x, c) => assert.ok(Math.abs(x - (0.18 * red[c] + 0.18 * green[c] + 0.64 * g.base[c])) < 1e-9, 'marks average by area')); }
  // wet mixing is the site's spectral model (world/superframe/lib/medium/spectral.mjs), called and not copied: the same numbers as its own mixKM,
  // one pigment alone keeps its colour, and blue and yellow go to a green, which a mean of red, green and blue values cannot give
  const lin = (h) => [1, 3, 5].map((i) => srgbToLin(parseInt(h.slice(i, i + 2), 16) / 255)), blue = lin('#2a4fb0'), yellow = lin('#f2d21b'), mixed = mixture([blue, yellow]);
  assert.deepEqual(mixture([blue, yellow], [1, 3]), SP.spectrumRGB(SP.mixKM([{ R: SP.upsample(blue), c: 1 }, { R: SP.upsample(yellow), c: 3 }])).map((x) => Math.min(1, Math.max(0, x))));
  assert.ok(apart(mixture([blue]), blue) < 1.5, 'one pigment alone keeps its colour through the spectrum and back'); assert.ok(mixed[1] > 1.5 * mixed[0] && mixed[1] > mixed[2], `blue and yellow mix to a green (${linToHex(mixed)})`);
  const geo = blue.map((b, c) => Math.sqrt(b * yellow[c])); assert.ok(apart(mixed, geo) > 20, 'which is not what the earlier rule (a geometric mean per channel) gave'); assert.equal(BAND_RGB.length, 48);
  const paperBoth = both('paper'); assert.ok(paperBoth[0] < 0.2 && paperBoth[1] < 0.2 && paperBoth[2] < 0.1, `on paper red and green go toward a dark brown (${paperBoth.map((x) => x.toFixed(2))})`);
});

// States, operations and chains (states.mjs): data only, checked for being consistent with itself and the grounds.
test('the state table is consistent: every move lands on a material, every chain can be walked, proposals are labelled', async () => {
  const { STATES, OPERATIONS, MATERIALS, CHAINS, LIVING, SENSES, apply, walk } = await import('./states.mjs');
  for (const [id, m] of Object.entries(MATERIALS)) { assert.ok(STATES[m.state], `${id} has a state`); if (m.ground) assert.ok(GROUNDS[m.ground], `${id} shows on a ground that exists`);
    for (const [op, to] of Object.entries(m.to)) { assert.ok(OPERATIONS.includes(op), `${id}: ${op}`); assert.ok(MATERIALS[to], `${id} ${op} leads to ${to}`); } }
  for (const s of Object.values(STATES)) { assert.ok(RULES[s.rule]); for (const g of s.grounds) assert.ok(GROUNDS[g], `${g} is a ground`); }
  assert.deepEqual(walk(CHAINS['fibre-sheet']), ['wood', 'wood-chips', 'pulp', 'wet-sheet', 'fibre-sheet']); assert.deepEqual(walk(CHAINS.glass), ['stone', 'sand', 'melt', 'glass']);
  for (const [id, c] of Object.entries(CHAINS)) assert.equal(walk(c)?.at(-1), id, `the chain for ${id} ends in ${id}`);
  assert.equal(apply('water', 'heat'), 'vapour'); assert.equal(apply('vapour', 'cool'), 'water'); assert.equal(apply('melt', 'cool'), 'glass'); assert.equal(apply('glass', 'press'), null);
  for (const p of Object.values(LIVING)) { assert.equal(p.label, 'proposed, not measured'); assert.match(p.hex, /^#[0-9a-f]{6}$/); assert.ok(p.settle.length > 20 && p.made.split('. ').length === 1, 'one line on how it is made, and what would settle the guess'); }
  assert.equal(SENSES.label, 'proposed, data only'); assert.equal(SENSES.seeToHear.length, SENSES.hearToSee.length);
});

test('the well leaves as files for other trades, written by the site own writers: a plot, plotter moves, a relief, a palette', async () => {
  const { FILES, RELIEF, makeFile, lumaGrid } = await import('./take-files.mjs'), { buildGrid, stlTriangleCount } = await import('../../../system/relief-stl.js'), { toGplPalette } = await import('../../../system/exporters-disciplines.js');
  // a picture that is dark on the left and light on the right
  const w = 320, h = 240, half = (dark, light) => { const d = new Uint8Array(w * h * 4); for (let i = 0; i < w * h; i++) { const v = i % w < w / 2 ? dark : light; d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v; d[i * 4 + 3] = 255; } return { data: d, w, h }; };
  const pic = half(30, 230), pal = [{ name: 'water', hex: '#3f7f7a' }, { name: 'fire heat', hex: '#e2703a' }];
  assert.deepEqual(FILES.map((f) => f.kind), ['plot-svg', 'plot-gcode', 'relief-stl', 'palette-gpl']); for (const f of FILES) assert.ok(f.says.length > 40 && !f.says.includes('\u2014'), `${f.kind} says what it is`);
  const svg = makeFile('plot-svg', pic, pal, 'water-fire'), code = makeFile('plot-gcode', pic, pal, 'water-fire');
  assert.match(svg.body, /<svg[^>]+xmlns/); assert.ok(svg.facts.lines > 50, `the plot has pen lines (${svg.facts.lines})`); assert.ok(!/fill="(?!none)/.test(svg.body), 'and no fills: a pen cannot fill');
  assert.ok(makeFile('plot-svg', half(30, 30)).facts.lines > 1.5 * svg.facts.lines, 'a darker picture gets more lines'); assert.equal(makeFile('plot-svg', half(250, 250)).facts.lines, 0, 'and a white one none');
  assert.match(code.body, /^G21$/m); assert.equal((code.body.match(/^G0 /gm) || []).length >= svg.facts.lines, true, 'one travel move to the start of every line'); assert.equal(code.facts.points, svg.facts.points);
  // the relief: a closed solid of the stated size, thin where the picture is light (a lithophane)
  const stl = makeFile('relief-stl', pic), dv = new DataView(stl.body), n = stlTriangleCount(RELIEF.w, RELIEF.h); assert.equal(stl.body.byteLength, 84 + 50 * n); assert.equal(dv.getUint32(80, true), n);
  const g = lumaGrid(pic, RELIEF.w, RELIEF.h); assert.ok(Math.abs(g[0] - 30 / 255) < 1e-6 && Math.abs(g[RELIEF.w - 1] - 230 / 255) < 1e-6);
  const grid = buildGrid(g, RELIEF.w, RELIEF.h, RELIEF), zs = Array.from(grid.zs ?? grid.z ?? grid.heights ?? []); if (zs.length) assert.ok(zs[0] > zs[RELIEF.w - 1], 'dark is thick and light is thin');
  let zmax = 0; for (let t = 0; t < n; t++) for (let v = 0; v < 3; v++) zmax = Math.max(zmax, dv.getFloat32(84 + 50 * t + 12 + v * 12 + 8, true)); assert.ok(zmax <= RELIEF.maxMM + 1e-3 && zmax > RELIEF.maxMM * 0.8, `the thickest point is within the stated ${RELIEF.maxMM} mm (${zmax.toFixed(2)})`);
  const gpl = makeFile('palette-gpl', null, pal, 'water-fire'); assert.equal(gpl.body, toGplPalette({ dominantSwatches: pal.map((c) => ({ hex: c.hex, frac: 0.5 })) }, 'water-fire')); assert.match(gpl.body, /^GIMP Palette\nName: water-fire\n/); assert.match(gpl.body, / 63 127 122\t#3f7f7a/);
  assert.throws(() => makeFile('relief-stl', null), /no picture/); assert.throws(() => makeFile('nothing', pic), /no such file kind/);
  const src = readFileSync(new URL('./take-files.mjs', import.meta.url), 'utf8'); assert.ok(!/fetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(src), 'the file has no way to send anything');
});

