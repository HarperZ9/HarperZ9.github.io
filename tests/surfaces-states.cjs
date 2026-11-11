// States on the bench, checked in a browser: operations, the fibre chain, living pigments, and what the page says.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surfaces-states.cjs
//
// What it holds:
//   1. The ground and its Heat, Cool and Grind controls are in view with the well at 1280 by 720.
//   2. Each required change of state (stone to sand, sand to melt, melt to glass, water to vapour, water to ice)
//      changes the picture past STATE_FLOOR, lands on the ground and the rule the state table names, keeps the amount
//      of every pigment within the solver's tolerance, and the page says what happened, by which rule, labelled computed.
//   3. With motion on, the change is a front: half way through, the side it starts from has changed far more than
//      the far side; the controls wait while it crosses.
//   4. The state and the chain so far are shown, saved in the recipe, and restored from it (the well itself starts fresh).
//   5. The fibre chain can be walked step by step; the sheet's fibres run one way; writing lays ink on it.
//   6. Living pigments can be chosen, are marked proposed with what would settle each, and fade only as a stated guess.
//   7. A silent, generated signal pours pigment into the well by the proposed mapping. Nothing makes an audio context.
//   8. The site's brush engine paints into the well by pointer and by keyboard, and a recipe lays the strokes again.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const launch = { ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };
const STATE_FLOOR = 6;   // a change of state: mean absolute difference per channel, 0 to 255, on a 96 by 72 read of the well
const FLOOR = 1.5;       // any other act that must show
const TOLERANCE = 1e-4;  // the solver's own (well-sim.mjs)
const out = {};
// One error is known and is not the bench's: the lettering library (world/lettering, the raked technique) can rebuild a word
// after its host was replaced, when the blend changes twice within its 160 ms resize timer. It is counted and reported, not hidden.
const KNOWN = /Failed to execute 'getImageData' on 'CanvasRenderingContext2D': Value is not of type 'long'/;
const own = (errors) => { const k = errors.filter((e) => KNOWN.test(e)).length; if (k) out.letteringRebuildErrors = (out.letteringRebuildErrors || 0) + k; return errors.filter((e) => !KNOWN.test(e)); };

const noAudio = () => { window.__audio = 0; for (const k of ['AudioContext', 'webkitAudioContext']) { const C = window[k]; if (C) window[k] = function (...a) { window.__audio++; return new C(...a); }; } };
async function open(browser, path, view = {}) {
  const ctx = await browser.newContext({ viewport: { width: view.w || 1280, height: view.h || 720 }, colorScheme: 'light', reducedMotion: view.reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => { errors.push(e.message); if (process.env.BENCH_STACK) console.error(e.stack); });
  await page.addInitScript(noAudio);
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForSelector('#parts[data-surface-live="bench"]', { state: 'attached', timeout: 45000 });
  await page.evaluate(() => { window.W = () => window.__bench.value().surfaces.well; window.pic = (w = 96, h = 72) => Array.from(window.W().value().well.read(w, h));
    window.diff = (a, b) => { let s = 0, n = 0; for (let i = 0; i < a.length; i += 4) { s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); n += 3; } return +(s / n).toFixed(2); }; });
  return { ctx, page, errors };
}
const info = (page) => page.evaluate(() => { const v = window.W().value(); return { ground: v.ground, state: v.state, chain: v.chain, did: v.did, why: document.querySelector('.sf-why').textContent, error: v.well.conservation().error, living: v.living, written: v.written }; });
const setGround = (page, ground) => page.evaluate((g) => { const p = document.querySelector('[data-ground]'); p.value = g; p.dispatchEvent(new Event('change', { bubbles: true })); }, ground);
// one operation under reduced motion: the picture before and after, and where it landed
async function operate(page, op) {
  const before = await page.evaluate(() => window.pic());
  await page.click(`[data-op="${op}"]`); await page.waitForFunction(() => !window.W().value().well.changing() && !document.querySelector('[data-op]:not([disabled])')?.closest('[aria-busy]'), null, { timeout: 20000 });
  await page.waitForTimeout(60);
  return { ...(await info(page)), change: await page.evaluate((b) => window.diff(b, window.pic()), before) };
}

(async () => {
  const browser = await chromium.launch(launch);
  try {
    // 1, 2, 4: the required changes, under reduced motion so each still can be compared
    const { ctx, page, errors } = await open(browser, '/elements.html?e=stone-sand,fire-heat,water', { reduced: true });
    const view = await page.evaluate(() => Object.fromEntries(['[data-ground]', '[data-op="heat"]', '[data-op="cool"]', '[data-op="grind"]', '.sf-water'].map((q) => { const r = document.querySelector(q).getBoundingClientRect(); return [q, [Math.round(r.top), Math.round(r.bottom)]]; })));
    out.inView = view; for (const [q, [top, bottom]] of Object.entries(view)) assert.ok(top >= 0 && bottom <= 720, `${q} is in view at 1280 by 720 (${top} to ${bottom})`);
    const rules = await page.evaluate(async () => { const { GROUNDS } = await import('/world/site/surfaces/grounds.mjs'), { MATERIALS, STATES } = await import('/world/site/surfaces/states.mjs');
      return Object.fromEntries(Object.entries(MATERIALS).filter(([, m]) => m.ground).map(([id, m]) => [id, { ground: m.ground, rule: GROUNDS[m.ground].rule, state: m.state, stateRule: STATES[m.state].rule }])); });
    assert.equal((await info(page)).ground, 'stone-sand', 'stone is the first material in the blend, so it is the ground');
    out.changes = {};
    const steps = [[null, 'grind', 'sand'], [null, 'heat', 'melt'], [null, 'cool', 'glass'], ['water', 'heat', 'vapour'], ['water', 'cool', 'ice']];
    for (const [start, op, to] of steps) {
      if (start) await setGround(page, start);
      const r = await operate(page, op), want = rules[to]; out.changes[`${op} to ${to}`] = { change: r.change, ground: r.ground, rule: want.rule, error: r.error };
      assert.equal(r.ground, want.ground, `${op}: lands on ${want.ground}`); assert.equal(r.state, want.state, `${op}: the state is ${want.state}`);
      assert.ok(r.change >= STATE_FLOOR, `${op} to ${to} changes the picture (${r.change} of 255, floor ${STATE_FLOOR})`);
      assert.ok(r.error <= TOLERANCE, `${op} to ${to} keeps every pigment's amount (${r.error})`);
      assert.match(r.did, new RegExp(`was \\w+ and became ${to}: .+ kept through it\\. Computed by the bench's state table, not measured\\.$`), `${op}: the page says what happened and by which rule`);
      assert.ok(r.why.includes(`State: ${want.state}.`) && r.why.includes('Computed.'), `${op}: the state is shown beside the well`);
      assert.equal(await page.evaluate(async (g) => (await import('/world/site/surfaces/grounds.mjs')).GROUNDS[g].rule, r.ground), want.rule);
    }
    assert.equal(rules.vapour.rule, 'volume', 'vapour uses the rule air and mist use'); assert.equal(rules.ice.rule, 'transmit'); assert.equal(rules.sand.rule, rules.sand.stateRule);
    // the chain so far is shown, saved and restored
    await setGround(page, 'stone-sand'); await operate(page, 'grind'); const mid = await operate(page, 'heat');
    assert.deepEqual(mid.chain.ops, ['grind', 'heat']); assert.ok(mid.why.includes('Chain so far: stone, ground to sand, heated to melt.'), 'the chain so far is shown beside the well');
    const saved = await page.evaluate(() => window.__bench.value().surfaces.recipe.value().recipe);
    assert.deepEqual([saved.ground, saved.chain.from, saved.chain.ops], ['melt', 'stone', ['grind', 'heat']], 'the recipe holds the ground and the chain');
    const meltPic = await page.evaluate(() => window.pic());
    await page.evaluate(() => window.__bench.update({ elements: ['water'], ground: null, chain: null })); assert.equal((await info(page)).ground, 'paper');
    const back = await page.evaluate(async (doc) => { const { readRecipe } = await import('/world/site/surfaces/elements-data.mjs'), r = readRecipe(await window.__surfaces.elements(), doc);
      window.__bench.update({ elements: r.ids, weights: r.weights, settings: r.settings, ground: r.ground, chain: r.chain, living: r.living, written: r.written }); await new Promise((f) => setTimeout(f, 80));
      const v = window.W().value(); return { ground: v.ground, chain: v.chain, why: document.querySelector('.sf-why').textContent }; }, saved);
    assert.equal(back.ground, 'melt'); assert.deepEqual(back.chain.ops, ['grind', 'heat']); assert.ok(back.why.includes('Chain so far: stone, ground to sand, heated to melt.'), 'the recipe restores the state and the chain');
    // the restored well starts fresh on that ground: it is the picture Start again gives there, and it is not the stirred well that was saved
    const again = await page.evaluate(() => { const a = window.pic(); document.querySelector('[data-act="again"]').click(); return window.diff(a, window.pic()); });
    out.restored = { againstFresh: again, againstSaved: await page.evaluate((b) => window.diff(b, window.pic()), meltPic) }; assert.ok(again < FLOOR, `the restored well is a fresh start on melt (${again} of 255 from Start again)`);
    await setGround(page, 'paper');
    const idle = await page.evaluate(() => [...document.querySelectorAll('[data-op]')].map((b) => [b.dataset.op, b.disabled, b.title]));
    assert.ok(idle.length === 3 && idle.every(([, off, why]) => off && /no row in the state table/.test(why)), 'a ground the table has no row for says why nothing can be done to it');

    // 5: the fibre chain, walked
    out.fibre = { steps: [] };
    for (const [i, g] of ['wood', 'wood-chips', 'pulp', 'wet-sheet', 'fibre-sheet'].entries()) {
      const before = await page.evaluate(() => window.pic()); await page.click(`[data-chain="fibre-sheet"][data-step="${i}"]`); await page.waitForFunction(() => !window.W().value().well.changing()); await page.waitForTimeout(60);
      const r = await info(page), change = await page.evaluate((b) => window.diff(b, window.pic()), before); out.fibre.steps.push({ ground: r.ground, change });
      assert.equal(r.ground, g, `step ${i + 1} of the fibre chain is ${g}`); assert.ok(change >= STATE_FLOOR, `and it shows (${change})`); assert.ok(r.error <= TOLERANCE);
      assert.equal(await page.evaluate(() => document.querySelector('[data-chain="fibre-sheet"][aria-current="step"]')?.dataset.step), String(i), 'the step the well is on is marked');
    }
    assert.ok((await info(page)).why.includes('Chain so far: wood, ground to wood chips, soaked in water to pulp, pressed to wet fibre sheet, dried to fibre sheet.'));
    // the bare sheet's fibres run one way: brightness changes faster down the sheet than along it
    await page.evaluate(() => window.__bench.update({ elements: ['type'] })); await page.waitForTimeout(80);
    out.fibre.grain = await page.evaluate(() => { const w = 384, h = 288, p = window.pic(w, h), Y = (x, y) => p[(y * w + x) * 4] + p[(y * w + x) * 4 + 1] + p[(y * w + x) * 4 + 2]; let ax = 0, ay = 0;
      for (let y = 4; y < 60; y++) for (let x = 4; x < 100; x++) { ax += Math.abs(Y(x + 1, y) - Y(x, y)); ay += Math.abs(Y(x, y + 1) - Y(x, y)); } return +(ay / ax).toFixed(2); });
    assert.ok(out.fibre.grain > 1.5, `across the fibres the sheet varies ${out.fibre.grain} times as fast as along them, in a bare corner`);
    const unwritten = await page.evaluate(() => window.pic(192, 144));
    await page.click('[data-act="write"]'); await page.waitForFunction((b) => window.diff(b, window.pic(192, 144)) > 0.5, unwritten, { timeout: 20000 });
    out.fibre.written = await page.evaluate((b) => window.diff(b, window.pic(192, 144)), unwritten); assert.ok(out.fibre.written >= 0.8, `writing lays ink on the sheet (${out.fibre.written} of 255 over the whole well)`);
    assert.equal((await info(page)).written, true); assert.equal(await page.evaluate(() => window.__bench.value().surfaces.recipe.value().recipe.written), true);
    await setGround(page, 'water'); assert.equal(await page.evaluate(() => document.querySelector('[data-act="write"]').disabled), true, 'writing needs a ground that takes layers, and the control says so');
    await setGround(page, 'fibre-sheet'); await page.click('[data-act="write"]');

    // 6: living pigments
    const bare = await page.evaluate(() => window.pic());
    await page.click('[data-living="dandelion"]'); await page.waitForTimeout(80);
    const liv = await page.evaluate((b) => ({ change: window.diff(b, window.pic()), slots: document.querySelectorAll('.sf-slots [data-slot]').length, notes: document.querySelector('.sf-living-notes').textContent, head: document.querySelector('.sf-living-h').textContent,
      recipe: window.__bench.value().surfaces.recipe.value().recipe.living, still: document.querySelector('.sf-still').textContent }), bare);
    out.living = { change: liv.change }; assert.ok(liv.change >= FLOOR, `a living pigment shows in the well (${liv.change})`); assert.equal(liv.slots, 2); assert.match(liv.head, /proposed, not measured/);
    assert.match(liv.notes, /Its colour here is a guess, proposed, not measured\. What would settle it: a reflectance spectrum/); assert.deepEqual(liv.recipe, [{ id: 'dandelion', label: 'proposed, not measured' }]); assert.match(liv.still, /dandelion #e2b72e, proposed/);
    const fresh = await page.evaluate(() => window.pic()); await page.check('[data-light]'); await page.waitForTimeout(80);
    const faded = await page.evaluate((b) => ({ change: window.diff(b, window.pic()), words: document.querySelector('.sf-fade').textContent, error: window.W().value().well.conservation().error }), fresh);
    out.living.fade = faded.change; assert.ok(faded.change >= FLOOR, `left in the light it fades (${faded.change})`); assert.match(faded.words, /dandelion 100%.*the speed here is ours.*Not measured\./); assert.ok(faded.error <= TOLERANCE, 'fading changes the colour, not the amount');
    // 8: the site's brush engine paints into the well, by pointer and by keyboard; the recipe replays the painting
    await page.evaluate(() => window.__bench.update({ elements: ['water', 'fire-heat'], ground: 'paper', chain: null, living: [], written: false })); await page.waitForTimeout(80);
    const brushes = await page.evaluate(() => [...document.querySelectorAll('[data-brush] option')].map((o) => o.value).filter(Boolean)); assert.ok(brushes.length >= 5, 'the engine presets are offered as brushes');
    const unpainted = await page.evaluate(() => window.pic()), box = await (await page.$('.sf-water canvas')).boundingBox(), pt = (x, y) => [box.x + box.width * x, box.y + box.height * y];
    await page.selectOption('[data-brush]', brushes.includes('billow') ? 'billow' : brushes[0]);
    await page.mouse.move(...pt(0.15, 0.2)); await page.mouse.down(); for (let i = 1; i <= 12; i++) await page.mouse.move(...pt(0.15 + 0.06 * i, 0.2 + 0.05 * i)); await page.mouse.up(); await page.waitForTimeout(80);
    const p1 = await page.evaluate((b) => ({ change: window.diff(b, window.pic()), strokes: window.W().value().strokes.length, error: window.W().value().well.conservation().error, how: document.querySelector('.sf-how').textContent }), unpainted);
    out.brush = { pointer: p1.change }; assert.ok(p1.change >= FLOOR, `a brush stroke by pointer shows (${p1.change})`); assert.equal(p1.strokes, 1); assert.ok(p1.error <= TOLERANCE, 'brushed pigment is kept like any other'); assert.match(p1.how, /Drag to paint/);
    const beforeKeys = await page.evaluate(() => window.pic()); await page.focus('.sf-water'); for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown', ' ']) await page.keyboard.press(k); await page.waitForTimeout(80);
    const p2 = await page.evaluate((b) => ({ change: window.diff(b, window.pic()), strokes: window.W().value().strokes.length, cursor: !document.querySelector('.sf-cursor').hidden }), beforeKeys);
    out.brush.keyboard = p2.change; assert.ok(p2.change >= 0.3, `the keyboard paints too (${p2.change})`); assert.equal(p2.strokes, 5); assert.ok(p2.cursor, 'and the brush has a visible place');
    const painted = await page.evaluate(() => window.pic()), kept = await page.evaluate(() => window.__bench.value().surfaces.recipe.value().recipe); assert.equal(kept.strokes.length, 5, 'the recipe records the strokes');
    await page.evaluate(() => window.__bench.update({ elements: ['ink'], strokes: [] })); await page.waitForTimeout(60);
    const replayed = await page.evaluate(async (doc) => { const { readRecipe } = await import('/world/site/surfaces/elements-data.mjs'), r = readRecipe(await window.__surfaces.elements(), doc);
      window.__bench.update({ elements: r.ids, weights: r.weights, settings: r.settings, ground: r.ground, chain: r.chain, living: r.living, written: r.written, strokes: r.strokes }); await new Promise((f) => setTimeout(f, 100));
      const withStrokes = window.pic(); document.querySelector('[data-act="again"]').click(); await new Promise((f) => setTimeout(f, 60)); return { withStrokes, bare: window.pic(), left: window.W().value().strokes.length }; }, kept);
    out.brush.replayAgainstBare = await page.evaluate(([a, b]) => window.diff(a, b), [replayed.withStrokes, replayed.bare]); assert.ok(out.brush.replayAgainstBare >= FLOOR, `a recipe lays its strokes again on a fresh well (${out.brush.replayAgainstBare} from the same well without them)`);
    out.brush.replayAgainstPainted = await page.evaluate(([a, b]) => window.diff(a, b), [replayed.withStrokes, painted]); assert.equal(replayed.left, 0, 'Start again clears the painting');
    await page.selectOption('[data-brush]', '');
    // 7: a picture from a silent signal
    const quiet = await page.evaluate(() => window.pic()); await page.click('[data-signal="chord"]'); await page.waitForTimeout(80);
    const sg = await page.evaluate((b) => ({ change: window.diff(b, window.pic()), signal: window.W().value().signal, words: document.querySelector('.sf-signal').textContent, amounts: window.W().value().well.amounts(), error: window.W().value().well.conservation().error }), quiet);
    out.signal = { change: sg.change, pours: sg.signal.pours }; assert.ok(sg.change >= FLOOR, `a chord, never played, changes the picture (${sg.change})`); assert.deepEqual([...sg.signal.classes].sort((a, b) => a - b), [0, 4, 7], 'its pigments are C, E and G');
    assert.match(sg.words, /never played.*Computed by a proposed rule, not measured\./); assert.ok(sg.amounts.slice(0, 3).every((a) => a > 0) && sg.error <= TOLERANCE, 'what the signal poured is in the well, and kept');
    await page.click('[data-signal=""]'); await page.waitForTimeout(60); assert.equal(await page.evaluate(() => window.W().value().signal), null);
    assert.equal(await page.evaluate(() => window.__audio), 0, 'no audio context'); assert.deepEqual(own(errors), [], 'no page error from the bench');
    await ctx.close();

    // 3: with motion on, the change is a front
    const m = await open(browser, '/elements.html?e=water,ink');
    assert.equal((await info(m.page)).ground, 'water'); await m.page.waitForTimeout(600);
    const start = await m.page.evaluate(() => window.pic()); await m.page.click('[data-op="heat"]');
    assert.equal(await m.page.evaluate(() => [...document.querySelectorAll('[data-op]')].every((b) => b.disabled)), true, 'the controls wait while the change crosses');
    await m.page.waitForFunction(() => (window.W().value().well.changing()?.f ?? 1) >= 0.5, null, { timeout: 30000, polling: 50 });
    const half = await m.page.evaluate((a) => { const b = window.pic(), band = (y0, y1) => { let s = 0, n = 0; for (let y = y0; y < y1; y++) for (let x = 0; x < 96; x++) for (let c = 0; c < 3; c++) { s += Math.abs(a[(y * 96 + x) * 4 + c] - b[(y * 96 + x) * 4 + c]); n++; } return +(s / n).toFixed(2); };
      return { f: window.W().value().well.changing()?.f ?? 1, top: band(0, 18), bottom: band(54, 72) }; }, start);
    out.front = half; assert.ok(half.f < 0.9, `the picture was read part way through (${half.f})`);
    assert.ok(half.bottom > half.top + STATE_FLOOR, `heat rises from the bottom: half way, the bottom has changed by ${half.bottom} and the top by ${half.top}`);
    await m.page.waitForFunction(() => !window.W().value().well.changing(), null, { timeout: 30000 }); await m.page.waitForTimeout(100);
    const end = await info(m.page); assert.equal(end.ground, 'cloud-mist'); assert.equal(end.chain.of, 'water', 'water stays the ground through its change; ink stays the pigment'); assert.ok(end.error <= TOLERANCE, `the pigment is kept across the front (${end.error})`);
    assert.equal(await m.page.evaluate(() => window.W().value().pigments.join()), 'ink'); assert.equal(await m.page.evaluate(() => document.querySelector('[data-op="cool"]').disabled), false, 'and the controls come back');
    assert.equal(await m.page.evaluate(() => window.__audio), 0); assert.deepEqual(own(m.errors), []);
    await m.ctx.close();
    console.log(JSON.stringify(out, null, 1)); console.log('surfaces-states: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(JSON.stringify(out, null, 1)); console.error(e); process.exit(1); });
