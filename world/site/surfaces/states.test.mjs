// node --test world/site/surfaces/states.test.mjs
// States on the bench, without a browser: what each state does to pigment in the solver, the front a change of state
// crosses the well behind, where the table's operations lead, the fibre sheet's wicking, and what the recipe keeps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createSim, STEP, TOLERANCE, NX, NY } from './well-sim.mjs';
import { GROUNDS, RULES, BEHAVE, behaviour } from './grounds.mjs';
import { MATERIALS, STATES, CHAINS, LIVING, apply, materialOf, replay, tell, walk } from './states.mjs';
import { opsFor, advance, jump, current, validChain, stateWords, didWords, chainsHTML, livingHTML, livingPart, FADE_SECONDS } from './well-ops.mjs';
import { indexElements, makeRecipe, readRecipe, driveFor } from './elements-data.mjs';
import { hexToOk } from '../../studio/lib/blend.mjs';

const ix = indexElements(JSON.parse(readFileSync(new URL('../../ui/shell/organic/data/elements.json', import.meta.url), 'utf8')));
const still = { speed: 0, curl: 0, coherence: 0, bleed: 0.5, scale: 0.5 };   // a pigment that does not move the water by itself
const one = (d = still) => [{ weight: 1, drive: d, links: [0] }];
// where a pigment field is, and how wide: its centre and its variance along x and y, in cells
function shape(F) { let m = 0, cx = 0, cy = 0; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const v = F[y * NX + x]; m += v; cx += v * x; cy += v * y; } cx /= m; cy /= m;
  let vx = 0, vy = 0; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const v = F[y * NX + x]; vx += v * (x - cx) ** 2; vy += v * (y - cy) ** 2; } return { cx, cy, vx: vx / m, vy: vy / m }; }
// one spot of pigment in the middle of still water, on a given ground, left alone for a number of steps
function spot(ground, steps = 240, stir = false) {
  const s = createSim(); s.set(one()); s.seed(); s.clear(); s.pour(0, 0.5, 0.5, 0.9); const put = s.dye[0].reduce((a, b) => a + b, 0);
  s.setMedium(behaviour(ground)); const was = shape(s.dye[0]);
  if (stir) for (let i = 0; i < 6; i++) s.stir(0.5, 0.5, 2.2, 0);
  for (let i = 0; i < steps; i++) s.step(STEP, false);
  const now = shape(s.dye[0]); return { was, now, grow: [now.vx - was.vx, now.vy - was.vy], kept: Math.abs(s.dye[0].reduce((a, b) => a + b, 0) - put) / put, sim: s };
}

test('every material that has a ground shows on a ground of its own state, and the required moves land where the table says', () => {
  for (const [id, m] of Object.entries(MATERIALS)) if (m.ground) { assert.equal(GROUNDS[m.ground].state, m.state, `${id} is a ${m.state} and so is its ground`); assert.ok(STATES[m.state].grounds.includes(m.ground), `${m.ground} is listed under ${m.state}`); }
  const want = [['stone', 'grind', 'sand', 'sand', 'partitive', 'powder'], ['sand', 'heat', 'melt', 'melt', 'mixture', 'liquid'], ['melt', 'cool', 'glass', 'glass', 'transmit', 'solid'],
    ['water', 'heat', 'vapour', 'cloud-mist', 'volume', 'gas'], ['water', 'cool', 'ice', 'ice', 'transmit', 'solid']];
  for (const [from, op, to, ground, rule, state] of want) { const g = MATERIALS[from].ground, nx = advance(g, null, op);
    assert.deepEqual([nx.to, nx.ground, GROUNDS[nx.ground].rule, GROUNDS[nx.ground].state], [to, ground, rule, state], `${from}, ${op}`); assert.equal(apply(from, op), to); assert.ok(RULES[rule]); }
  assert.equal(GROUNDS.ice.group, 'hard, clear'); assert.equal(GROUNDS['cloud-mist'].rule, GROUNDS.air.rule, 'vapour uses the rule air and mist use');
  assert.equal(STATES.powder.rule, GROUNDS.sand.rule); assert.equal(STATES.liquid.rule, GROUNDS.melt.rule); assert.equal(STATES.gas.rule, GROUNDS['cloud-mist'].rule);
});

test('operations: what is offered, where it leads, the chain it leaves, and the words the page says', () => {
  const ops = Object.fromEntries(opsFor('stone-sand').map((o) => [o.op, o])); assert.deepEqual(Object.keys(ops), ['heat', 'cool', 'grind'], 'heat, cool and grind are always shown');
  assert.equal(ops.grind.ok, true); assert.equal(ops.grind.ground, 'sand'); assert.equal(ops.heat.ok, false); assert.match(ops.heat.why, /no heat for stone/);
  assert.ok(opsFor('paper').every((o) => !o.ok && /no row in the state table/.test(o.why)), 'a ground with no material says why nothing can be done');
  assert.deepEqual(opsFor('wood-chips').filter((o) => o.ok).map((o) => o.op), ['dissolve']); assert.match(opsFor('sand').find((o) => o.op === 'grind').why, /stone powder has no ground built yet/);
  let at = { ground: 'stone-sand', chain: null };
  for (const op of ['grind', 'heat', 'cool']) at = advance(at.ground, at.chain, op, 'stone-sand');
  assert.deepEqual(at.chain, { from: 'stone', ops: ['grind', 'heat', 'cool'], of: 'stone-sand' }); assert.equal(at.ground, 'glass'); assert.equal(current(at.ground, at.chain), 'glass');
  assert.equal(tell(at.chain.from, at.chain.ops), 'stone, ground to sand, heated to melt, cooled to glass'); assert.equal(advance('glass', at.chain, 'press'), null);
  assert.match(stateWords('glass', at.chain), /State: <b>solid<\/b>\. A solid holds pigment.*Chain so far: stone, ground to sand, heated to melt, cooled to glass\..*Computed\./);
  assert.match(didWords('water', 'vapour', 'heat'), /^Water was heated and became vapour: heat loosens.*from the bottom up.*kept through it\. Computed by the bench's state table, not measured\.$/);
  assert.match(didWords('water', 'ice', 'cool', true), /shown whole, at once/);
  assert.equal(materialOf('cloud-mist'), 'vapour'); assert.equal(replay('water', ['grind']), null); assert.equal(validChain({ from: 'water', ops: ['grind'] }), false);
});

test('made things are steps to walk: the fibre sheet from wood, glass from stone, ice from water', () => {
  assert.deepEqual(walk(CHAINS['fibre-sheet']).map((m) => MATERIALS[m].ground), ['wood', 'wood-chips', 'pulp', 'wet-sheet', 'fibre-sheet'], 'every step of the fibre chain has a ground');
  assert.deepEqual(walk(CHAINS['fibre-sheet']).map((m) => MATERIALS[m].state), ['solid', 'powder', 'liquid', 'solid', 'solid']);
  assert.deepEqual(jump('fibre-sheet', 2), { ground: 'pulp', chain: { from: 'wood', ops: ['grind', 'dissolve'], of: null } }); assert.equal(jump('fibre-sheet', 9), null);
  let at = jump('fibre-sheet', 0); for (const op of CHAINS['fibre-sheet'].steps) at = advance(at.ground, at.chain, op);
  assert.equal(at.ground, 'fibre-sheet'); assert.equal(tell(at.chain.from, at.chain.ops), 'wood, ground to wood chips, soaked in water to pulp, pressed to wet fibre sheet, dried to fibre sheet');
  const html = chainsHTML('pulp', jump('fibre-sheet', 2).chain); assert.equal((html.match(/aria-current="step"/g) || []).length, 1, 'one step is marked as the present one'); assert.match(html, /aria-current="step">pulp</);
  assert.equal((html.match(/data-chain="fibre-sheet"/g) || []).length, 5); assert.ok(!/disabled/.test(html), 'every step of every chain can be walked to');
});

test('each state treats pigment its own way: a liquid spreads it, a gas spreads and lifts it, a powder holds it', () => {
  const G = ['paper', 'water', 'cloud-mist', 'sand'], r = Object.fromEntries(G.map((g) => [g, spot(g)])), st = Object.fromEntries(G.map((g) => [g, spot(g, 240, true)])), spread = (g) => r[g].grow[0] + r[g].grow[1], rise = (g) => r[g].was.cy - r[g].now.cy;
  assert.ok(spread('water') > spread('paper') * 1.3, `a liquid spreads pigment more than a solid (${spread('water').toFixed(1)} against ${spread('paper').toFixed(1)} cells squared)`);
  assert.ok(spread('cloud-mist') > spread('water'), `a gas more than a liquid (${spread('cloud-mist').toFixed(1)})`);
  assert.ok(spread('sand') < spread('paper') * 0.4, `a powder least (${spread('sand').toFixed(1)})`);
  assert.ok(rise('cloud-mist') > 2 && Math.abs(rise('paper')) < 0.5 && Math.abs(rise('water')) < 0.5, `in a gas the pigment rises (${rise('cloud-mist').toFixed(1)} cells; on paper ${rise('paper').toFixed(2)})`);
  const carried = (g) => Math.abs(st[g].now.cx - st[g].was.cx); assert.ok(carried('water') > carried('sand') * 3, `a stir carries pigment in a liquid, and hardly moves a powder (${carried('water').toFixed(1)} against ${carried('sand').toFixed(2)} cells)`);
  for (const g of Object.keys(r)) assert.ok(r[g].kept <= TOLERANCE, `${g} keeps the amount (${r[g].kept})`);
  for (const s of Object.keys(STATES)) assert.ok(BEHAVE[s], `${s} has a behaviour`);
});

test('a change of state crosses the well behind a front, from the side the operation names, and keeps the pigment', () => {
  const side = { heat: (x, y) => y > 0.5, grind: (x) => x < 0.5, cool: (x, y) => Math.min(x, 1 - x, y, 1 - y) < 0.2, dissolve: (x, y) => y < 0.5, press: (x, y) => Math.min(x, 1 - x, y, 1 - y) > 0.22 };
  for (const [op, first] of Object.entries(side)) {
    const s = createSim(); s.set([{ weight: 1, drive: { speed: 0.5, curl: 0.5, coherence: 0.4, bleed: 0.5 }, links: [0, 0] }, { weight: 1, drive: still, links: [0, 0] }]); s.seed(); s.setMedium(behaviour('stone-sand'));
    s.change(behaviour('sand'), op, 3); let worst = 0, mid = null;
    for (let i = 0; i < 400 && s.changing; i++) { s.stir(0.4, 0.5, 0.5, 0.2); s.step(STEP); worst = Math.max(worst, s.error()); if (!mid && s.changing?.f >= 0.5) mid = Float32Array.from(s.phase); }
    assert.equal(s.changing, null, `${op}: the change ends`); assert.deepEqual([s.medium.carry, s.medium.spread], [BEHAVE.powder.carry, BEHAVE.powder.spread], `${op}: the medium is the new state`);
    assert.ok(s.phase.every((p) => p === 0), 'and the front is put away');
    let a = 0, na = 0, b = 0, nb = 0, part = 0; for (let y = 0; y < NY; y++) for (let x = 0; x < NX; x++) { const p = mid[y * NX + x]; if (p > 0.02 && p < 0.98) part++; if (first((x + 0.5) / NX, (y + 0.5) / NY)) { a += p; na++; } else { b += p; nb++; } }
    assert.ok(a / na > b / nb + 0.35, `${op}: half way, the side the front starts from has gone over and the far side has not (${(a / na).toFixed(2)} against ${(b / nb).toFixed(2)})`);
    assert.ok(part > 40 && part < NX * NY * 0.5, `${op}: the front is a band, not a cut and not a fade of the whole well (${part} cells in it)`);
    assert.ok(worst <= TOLERANCE, `${op}: the amount of each pigment is kept at every step (${worst})`);
  }
  const r = createSim({ reduced: true }); r.set(one()); r.seed(); r.change(behaviour('sand'), 'grind'); assert.equal(r.changing, null, 'under reduced motion the change is whole at once'); assert.equal(r.medium.carry, BEHAVE.powder.carry);
});

test('a fibre sheet wicks a wash along its fibres faster than across them; paper does not', () => {
  const f = spot('fibre-sheet'), p = spot('paper'), w = spot('wet-sheet'), ratio = (r) => r.grow[0] / r.grow[1];
  assert.ok(ratio(f) > 3, `fibre sheet: the spot grows ${ratio(f).toFixed(2)} times as fast along x (the fibres) as along y`);
  assert.ok(ratio(p) > 0.9 && ratio(p) < 1.1, `paper: the same spot grows evenly (${ratio(p).toFixed(2)})`);
  assert.ok(ratio(w) > 1.5 && ratio(w) < ratio(f), `the wet sheet wicks less sharply than the dry one (${ratio(w).toFixed(2)})`);
  assert.deepEqual(GROUNDS['fibre-sheet'].wick, [2.2, 0.35]); assert.ok(f.kept <= TOLERANCE);
});

test('living pigments are proposals: selectable, labelled, with what would settle each; the fade is ours and says so', () => {
  const like = driveFor(ix, { id: '', properties: [] }).shader;
  for (const [id, p] of Object.entries(LIVING)) { const part = livingPart(id, like, hexToOk);
    assert.equal(part.living, true); assert.equal(part.drive.coverage, p.strength); assert.ok(part.drive.opacity > 0 && part.drive.opacity <= 0.92); assert.ok(FADE_SECONDS[part.rate] > 0); assert.ok(!ix.byId.has(id), 'not an element on the table'); }
  assert.ok(FADE_SECONDS.fast < FADE_SECONDS.slow);
  const none = livingHTML([]), two = livingHTML(['dandelion', 'insect-shell'], true, true);
  assert.match(none, /proposed, not measured/); assert.equal((none.match(/data-living=/g) || []).length, 3); assert.ok(!/data-light/.test(none));
  assert.match(two, /Its colour here is a guess, proposed, not measured\. What would settle it: a reflectance spectrum of a dandelion flower dye/); assert.match(two, /data-living="crushed-grass" aria-pressed="false" disabled/);
  assert.match(two, /data-light checked/); assert.ok(!/measured colour|lightfast for/.test(two));
});

test('the recipe keeps the state: the ground, the chain that reached it, the living pigments and the writing', () => {
  const chain = { from: 'stone', ops: ['grind', 'heat'], of: 'stone-sand' }, r = makeRecipe(ix, ['stone-sand', 'ink'], [1, 1], {}, 'melt', { chain, living: ['dandelion', 'nothing'], written: true });
  assert.deepEqual([r.ground, r.chain, r.living, r.written], ['melt', chain, [{ id: 'dandelion', label: 'proposed, not measured' }], true]);
  const back = readRecipe(ix, JSON.parse(JSON.stringify(r))); assert.deepEqual([back.ground, back.chain, back.living, back.written], ['melt', chain, ['dandelion'], true]);
  assert.equal(makeRecipe(ix, ['ink'], [1], {}, 'glass', { chain }).chain, undefined, 'a chain that does not end on the saved ground is not saved');
  assert.equal(readRecipe(ix, { ...r, ground: 'glass' }).chain, null, 'nor read'); assert.equal(readRecipe(ix, { ...r, chain: { from: 'stone', ops: ['press'] } }).chain, null);
  const plain = readRecipe(ix, makeRecipe(ix, ['water'], [1], {})); assert.deepEqual([plain.ground, plain.chain, plain.living, plain.written], [null, null, [], false]);
  assert.equal(readRecipe(ix, { ...r, elements: [{ id: 'ink', weight: 1 }] }).chain.of, null, 'the element that was the ground is only named while it is in the blend');
});

test('a silent signal pours pigment by the proposed mapping: notes to hues, loudness to amount, noise to roughness', async () => {
  const { SIGNALS, tones, analyse, toWell, hueOf, NAMES, RATE } = await import('./signal.mjs'), like = driveFor(ix, { id: '', properties: [] }).shader;
  const chord = toWell(SIGNALS.chord.make(), like), sweep = toWell(SIGNALS.sweep.make(), like), hiss = toWell(SIGNALS.hiss.make(), like);
  assert.deepEqual([...chord.classes].sort((a, b) => a - b), [0, 4, 7], 'a chord of C, E and G gives those three notes as its pigments'); assert.deepEqual(chord.classes.map((c) => NAMES[c]).sort(), ['C', 'E', 'G']);
  assert.equal(new Set(chord.parts.map((p) => p.ok.join())).size, 3, 'each note has its own hue'); assert.deepEqual(chord.parts[0].ok, hueOf(chord.classes[0]));
  const amount = (w) => w.pours.reduce((s, p) => s + p.amount, 0), quiet = toWell(tones([261.63, 329.63, 392.0], 1.2, 0.2), like);
  assert.ok(amount(chord) > amount(quiet) * 2.5, `a louder signal pours more (${amount(chord).toFixed(2)} against ${amount(quiet).toFixed(2)})`); assert.ok(chord.parts[0].drive.coverage > quiet.parts[0].drive.coverage);
  const firstAt = (w, slot) => Math.min(...w.pours.filter((p) => p.slot === slot).map((p) => p.x)), bySlot = sweep.classes.map((c, slot) => [c, firstAt(sweep, slot)]).sort((a, b) => a[1] - b[1]);
  assert.ok(sweep.classes.length >= 3 && bySlot[0][1] < bySlot.at(-1)[1], 'a sweep pours its notes one after another across the well');
  assert.ok(hiss.noisy > 0.6 && chord.noisy < 0.3, `noise is told from tone (${hiss.noisy.toFixed(2)} against ${chord.noisy.toFixed(2)})`); assert.ok(hiss.parts[0].drive.beta < chord.parts[0].drive.beta, 'and gives a rougher pigment');
  assert.ok(Math.abs(analyse(tones([440], 1)).loud - 0.8 / Math.SQRT2) < 0.03 && RATE === 8000); assert.match(chord.label, /never played/);
  const src = readFileSync(new URL('./signal.mjs', import.meta.url), 'utf8'); assert.ok(!/AudioContext|new Audio|createOscillator|\.play\(/.test(src), 'the signal file has no way to make sound');
  const s = createSim({ reduced: true }); s.set(chord.parts); s.seed(); s.clear(); for (const p of chord.pours) s.pour(p.slot, p.x, p.y, p.amount); for (let i = 0; i < 30; i++) s.step(STEP, false); assert.ok(s.error() <= TOLERANCE && s.amounts().slice(0, 3).every((a) => a > 0));
});

test('the site brush engine paints in the well at its own resolution: bristles show, strokes replay, a fluid takes the paint', async () => {
  const B = await import('./brush-field.mjs'), { BRUSHES, OWN, FX, FY, FS, createLayer, beginStroke, replay, cleanStrokes, coverage, dissolve, held } = B;
  const { PRESET_NAMES, PRESETS } = await import('../../feed-23/build/brush/presets.js'), { Surface } = await import('../../feed-23/build/brush/surface.js'), { liveStroke } = await import('../../feed-23/build/brush/stroke.js');
  const { INK_BRUSH } = await import('../../studio/lib/plates-matter.mjs');
  assert.deepEqual(BRUSHES.slice(2), PRESET_NAMES, 'the engine presets are offered as they are'); assert.deepEqual(Object.keys(OWN), ['bristle', 'dry-brush']); assert.equal(FX, NX * FS); assert.ok(FS >= 8, 'the layer is far finer than the solver');
  for (const k of ['tip', 'spacing', 'angle', 'aspect', 'pressure', 'taper']) for (const b of Object.values(OWN)) assert.deepEqual(b[k], INK_BRUSH[k], `the bench brushes are the studio ink brush (${k})`);
  const path = Array.from({ length: 24 }, (_, i) => [0.15 + 0.7 * i / 23, 0.5]), stroke = (L, name, slot = 0, seed = 3) => { const st = beginStroke(L, slot, name, seed); path.forEach(([x, y], i) => st.add(x, y, 0.9, i * 0.02)); return st; };
  // every brush leaves a mark through the engine, and only for the chosen pigment
  const laid = {}; for (const name of BRUSHES) { const L = createLayer(), st = stroke(L, name, 1); assert.ok(st.dabs > 0, `${name} places dabs`); const h = held(L); laid[name] = +h[1].toFixed(6); if (!/smear|blend/.test(name)) assert.ok(h[1] > 0 && h[0] + h[2] + h[3] < 1e-9, `${name} lays only the chosen pigment (${h})`); }
  assert.ok(new Set(Object.values(laid)).size >= 6, `different brushes lay different amounts (${JSON.stringify(laid)})`);
  // the layer is the engine's own Surface painted by the engine's own stroke: the same stroke on a bare engine Surface gives the same alpha, pixel for pixel
  const L = createLayer(), st = stroke(L, 'bristle'), E = createLayer(), own = new Surface(FX, FY), ls = liveStroke(own, PRESETS.billow, { unit: FX, seed: 3, color: '#ff0000' }); stroke(E, 'billow'); path.forEach(([x, y], i) => ls.add({ x: +(x.toFixed(4)) * FX, y: y * FY, t: +(i * 0.02).toFixed(4), p: 0.9 }));
  let worst = 0; for (let i = 3; i < own.px.length; i += 4) worst = Math.max(worst, Math.abs(own.px[i] - E.surface.px[i])); assert.ok(held(E)[0] > 0); assert.equal(worst, 0, 'the bench layer and the engine painting alone agree exactly');
  // bristles: across the stroke, at its middle, the paint rises and falls hair by hair. Count the peaks at the layer's
  // resolution and at the solver's (the same column averaged into cells of FS): the hairs are there only in the first.
  const col = (layer, x) => { const c = coverage(layer), out = []; for (let y = 0; y < FY; y++) out.push(c[(y * FX + x) * 4] / 255); return out; };
  const peaks = (a, floor = 0.04) => { let n = 0; for (let i = 1; i < a.length - 1; i++) if (a[i] > a[i - 1] && a[i] >= a[i + 1] && a[i] - Math.min(...a.slice(Math.max(0, i - 4), i + 5)) > floor) n++; return n; };
  const cells = (a) => Array.from({ length: NY }, (_, j) => a.slice(j * FS, j * FS + FS).reduce((s, v) => s + v, 0) / FS);
  const fine = col(L, FX >> 1), hairs = peaks(fine), coarse = peaks(cells(fine)), H = createLayer(); stroke(H, 'haze'); const soft = peaks(col(H, FX >> 1));
  assert.ok(hairs >= 5, `a bristle stroke shows separate hairs across it (${hairs} peaks)`); assert.ok(coarse * 2 <= hairs, `which the solver cells, ten times coarser, cannot hold (${coarse} peaks against ${hairs})`); assert.ok(soft <= 1, `and a soft round brush has none (${soft})`);
  // a nearly dry brush lays far less paint than a loaded one
  const D = createLayer(); stroke(D, 'dry-brush'); assert.ok(held(D)[0] < 0.6 * held(L)[0] && held(D)[0] > 0, `the dry brush is thin (${held(D)[0]} against ${held(L)[0]})`);
  // paint over paint: a second pigment across the first covers it where they cross, and the four amounts never exceed one coat
  const X = createLayer(); stroke(X, 'bristle', 0); const before = held(X)[0]; const up = beginStroke(X, 1, 'billow', 5); for (let i = 0; i < 24; i++) up.add(0.5, 0.2 + 0.6 * i / 23, 0.9, i * 0.02);
  assert.ok(held(X)[0] < before && held(X)[1] > 0, 'the upper stroke covers part of the lower'); const cx = coverage(X); let most = 0; for (let i = 0; i < cx.length; i += 4) most = Math.max(most, cx[i] + cx[i + 1] + cx[i + 2] + cx[i + 3]); assert.ok(most <= 256, 'one coat at most at any point');
  // replay: the record lays the same layer again, value for value
  const rec = st.done(), again = createLayer(); assert.equal(replay(again, [rec], 2), st.dabs); assert.deepEqual(Array.from(again.surface.px.subarray(0, 400000)), Array.from(L.surface.px.subarray(0, 400000))); let same = true; for (let i = 0; i < L.surface.px.length; i++) if (again.surface.px[i] !== L.surface.px[i]) { same = false; break; } assert.ok(same, 'a replayed stroke is the same stroke');
  assert.equal(replay(createLayer(), [{ ...rec, slot: 3 }], 2), 0, 'a stroke for a pigment that is not there is left out'); assert.equal(beginStroke(L, 0, 'no-such-brush'), null);
  // a fluid ground takes the paint: what leaves the layer enters the solver's field, where it is kept like any other pigment
  const s = createSim(); s.set([{ weight: 1, drive: still, links: [0, 0] }, { weight: 1, drive: still, links: [0, 0] }]); s.seed(); s.clear();
  const had = held(L)[0], moved = dissolve(L, s, 0.25, 2) / (NX * NY); assert.ok(Math.abs(moved - 0.25 * had) < 1e-6 * had + 1e-9, `a quarter leaves the layer (${moved} of ${had})`); assert.ok(Math.abs(held(L)[0] - 0.75 * had) < 1e-5 * had); assert.ok(Math.abs(s.amounts()[0] - moved) < 1e-9 && s.error() <= TOLERANCE);
  dissolve(L, s, 1, 2); assert.equal(L.box, null, 'and all of it, in the end'); assert.ok(Math.abs(s.amounts()[0] - had) < 1e-5 * had, 'nothing is lost on the way'); for (let i = 0; i < 40; i++) s.step(STEP, false); assert.ok(s.error() <= TOLERANCE);
  const r = makeRecipe(ix, ['water', 'ink'], [1, 1], {}, null, { strokes: [rec, { brush: 'no-such-brush', slot: 0, pts: [[0, 0]] }] }); assert.equal(r.strokes.length, 1);
  assert.deepEqual(readRecipe(ix, JSON.parse(JSON.stringify(r))).strokes, cleanStrokes([rec]), 'the recipe keeps the strokes and gives them back'); assert.deepEqual(readRecipe(ix, makeRecipe(ix, ['water'], [1], {})).strokes, []);
});
