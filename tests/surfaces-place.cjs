// The bench as a place, and the newest grounds and brushes, checked in a browser.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surfaces-place.cjs
//
// What it holds:
//   1. Nothing jumps when a tool opens. At 1280, 3840 and 390 wide, the well, its one line, the ground and brush
//      menus, every operation, every tool under the well and the take-away's home keep their places to the pixel while
//      a visitor picks a brush, a ground, a weave, an operation, a signal, a living pigment and a third element. On the
//      two wide screens the table keeps its place too.
//   2. The one line always says the blend, the ground and its state, whole, in at most two lines of text.
//   3. A soft brush's paint shows on paper and on stone (the picture with the brush layer against the same picture
//      without it); with the old tooth gate it nearly vanished. The share of the
//      well's paint that sits in the brush layer, outside the solver's conserved amount, is reported.
//   4. The woven ground: threads from the blend change the picture, the weave shows, and the well's solver spreads a
//      wash by the weave the visitor chose.
const assert = require('node:assert/strict');
const { launch, open, diff, FLOOR } = require('./lib/surfaces-probe.cjs');
const out = {};
const HOMES = ['.sf-stage', '.sf-water', '.sf-line', 'select[data-ground]', 'select[data-brush]', '[data-op="heat"]', '[data-op="grind"]', '[data-op="dry"]', '[data-act="level"]', '[data-act="again"]',
  '[data-act="write"]', 'select[data-weave]', '[data-act="woven"]', '.bn-take-home [data-take="png"]'];

// where each home is on the page (not on the screen), so a page that has not scrolled can be compared before and after
const where = (homes) => homes.map((q) => { const e = document.querySelector(q); if (!e) return [q, null]; const r = e.getBoundingClientRect(); return [q, [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width)]]; });
// acts as a visitor does, without the scrolling a test driver adds
const ACTS = [
  ['a brush', () => { const s = document.querySelector('select[data-brush]'); s.value = 'bristle'; s.dispatchEvent(new Event('change', { bubbles: true })); }],
  ['the woven ground', () => { const s = document.querySelector('select[data-ground]'); s.value = 'thread-textile'; s.dispatchEvent(new Event('change', { bubbles: true })); }],
  ['threads from the blend', () => document.querySelector('[data-act="woven"]').click()],
  ['a satin weave', () => { const s = document.querySelector('select[data-weave]'); s.value = 'satin5'; s.dispatchEvent(new Event('change', { bubbles: true })); }],
  ['stone, then grind', () => { const s = document.querySelector('select[data-ground]'); s.value = 'stone-sand'; s.dispatchEvent(new Event('change', { bubbles: true })); document.querySelector('[data-op="grind"]').click(); }],
  ['a silent signal', () => document.querySelector('[data-signal="chord"]').click()],
  ['back to the blend', () => document.querySelector('[data-signal=""]').click()],
  ['a living pigment', () => document.querySelector('[data-living="dandelion"]').click()],
  ['a third element', () => window.__bench.update({ elements: ['water', 'ink', 'city-architecture'] })],
  ['the sound ground', () => { const s = document.querySelector('select[data-ground]'); s.value = 'sound'; s.dispatchEvent(new Event('change', { bubbles: true })); }],
];

(async () => {
  const browser = await launch();
  try {
    for (const view of [{ w: 1280, h: 800 }, { w: 3840, h: 2160 }, { w: 390, h: 844, phone: true }]) {
      const { ctx, page, errors } = await open(browser, '/elements.html?e=water,ink', { ...view, reduced: true }, view.phone ? { isMobile: true, hasTouch: true } : {});
      const homes = view.phone ? HOMES : [...HOMES, '.bn-cell[data-id="water"]'], first = await page.evaluate(where, homes), moved = [], lines = [];
      assert.ok(first.every(([, b]) => b), `${view.w}: every home exists (${first.filter(([, b]) => !b).map(([q]) => q)})`);
      for (const [name, act] of ACTS) {
        await page.evaluate(act); await page.waitForTimeout(150);
        const now = await page.evaluate(where, homes); now.forEach(([q, b], i) => { const a = first[i][1]; if (!b || Math.abs(b[0] - a[0]) > 1 || Math.abs(b[1] - a[1]) > 1 || Math.abs(b[2] - a[2]) > 1) moved.push(`${name}: ${q} ${JSON.stringify(a)} to ${JSON.stringify(b)}`); });
        lines.push(await page.evaluate(() => { const l = document.querySelector('.sf-line'), v = window.__bench.value().surfaces.well.value(), parts = [...document.querySelectorAll('.sf-slots [data-slot]')].map((b) => b.textContent);
          return { text: l.textContent, whole: l.scrollHeight <= l.clientHeight + 1, lines: Math.round(l.scrollHeight / parseFloat(getComputedStyle(l).lineHeight)), ground: v.ground, parts }; }));
      }
      out[`place ${view.w}`] = { moved: moved.length, lines: Math.max(...lines.map((l) => l.lines)), sample: lines.at(-1).text };
      assert.deepEqual(moved, [], `${view.w}: nothing moves when a tool opens`);
      const { GROUNDS } = await page.evaluate(async () => ({ GROUNDS: Object.fromEntries(Object.entries((await import('/world/site/surfaces/grounds.mjs')).GROUNDS).map(([k, g]) => [k, g.name])) }));
      for (const l of lines) { assert.ok(l.whole, `${view.w}: the line is whole (${l.text})`); assert.ok(l.text.includes(GROUNDS[l.ground]), `${view.w}: the line names the ground (${l.text})`); for (const p of l.parts) assert.ok(l.text.includes(p), `${view.w}: the line names ${p}`); }
      assert.deepEqual(errors, []); await ctx.close();
    }

    // 3 and 4 on one page, under reduced motion
    const { ctx, page, errors } = await open(browser, '/elements.html?e=water,ink', { w: 1280, h: 900, reduced: true });
    const brush = await page.evaluate(async () => { const b = window.__bench, W = () => b.value().surfaces.well.value(), rd = () => Array.from(W().well.read(192, 144)), o = {};
      const df = (a, c) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); return +(s / (a.length / 4 * 3)).toFixed(2); };
      const zig = Array.from({ length: 40 }, (_, i) => [0.15 + 0.7 * i / 39, 0.5 + 0.2 * Math.sin(i / 3)]);
      for (const g of ['paper', 'stone-sand']) for (const name of ['haze', 'sponge']) {
        b.update({ ground: g, strokes: [] }); W().paint(name, zig, 1); const now = rd(); W().well.gain({ brush: 0 }); const bare = rd(); W().well.gain({ brush: 1, catch: 1 }); const old = rd(); W().well.gain({ catch: 0 });
        o[`${name} on ${g}`] = { shows: df(bare, now), withTheOldGate: df(bare, old) }; }
      b.update({ ground: 'paper', strokes: [] }); W().paint('bristle', zig, 0); const held = W().well.brushed(), field = W().well.amounts();
      o.outside = { brushLayer: +held[0].toFixed(5), solver: +field[0].toFixed(5), share: +(held[0] / (held[0] + field[0])).toFixed(4) };
      return o; });
    out.brush = brush;
    for (const [k, v] of Object.entries(brush)) if (k !== 'outside') { assert.ok(v.shows >= 0.3, `${k} shows (${v.shows} of 255 over the whole well, for one stroke)`); assert.ok(v.shows > 3 * v.withTheOldGate, `${k}: three times or more what the old gate let through (${v.withTheOldGate})`); }
    const loom = await page.evaluate(async () => { const b = window.__bench, W = () => b.value().surfaces.well.value(), rd = () => Array.from(W().well.read(192, 144)), o = {};
      const df = (a, c) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); return +(s / (a.length / 4 * 3)).toFixed(2); };
      b.update({ elements: ['water', 'fire-heat', 'ink'], ground: 'thread-textile', loom: { weave: 'twill22', woven: false }, strokes: [] }); const undyed = rd();
      b.update({ loom: { weave: 'twill22', woven: true } }); o.threadsFromTheBlend = df(undyed, rd()); o.said = document.querySelector('[data-act="woven"]').getAttribute('aria-pressed');
      b.update({ loom: { weave: 'plain', woven: false } }); o.plainAgainstTwill = df(undyed, rd());
      // the solver's own links for the ground in the well: how much faster a wash runs across than down
      const spread = (weave) => { b.update({ loom: { weave, woven: false } }); const L = W().well.sim.medium.links; let e = 0, d = 0; for (let i = 0; i < L.e.length; i++) { e += L.e[i]; d += L.s[i]; } return +(e / d).toFixed(2); };
      o.spreadAcrossOverDown = { satin: spread('satin5'), plain: spread('plain') };
      const r = await (await import('/world/site/surfaces/elements-data.mjs')).makeRecipe(await window.__surfaces.elements(), ['water', 'ink'], [1, 1], {}, 'thread-textile', { loom: { weave: 'satin5', woven: true } }); o.recipe = r.loom;
      return o; });
    out.loom = loom; assert.ok(loom.threadsFromTheBlend >= FLOOR && loom.said === 'true', `threads from the blend change the cloth (${loom.threadsFromTheBlend})`); assert.ok(loom.plainAgainstTwill >= FLOOR, `the weave shows (${loom.plainAgainstTwill})`);
    assert.ok(loom.spreadAcrossOverDown.satin > 1.5 * loom.spreadAcrossOverDown.plain, `in the well, a wash runs along the satin's weft (${JSON.stringify(loom.spreadAcrossOverDown)})`); assert.deepEqual(loom.recipe, { weave: 'satin5', woven: true });
    assert.deepEqual(errors, []); await ctx.close();
    // 5: the Studio's loom, plot map and cubes, mounted by their parts, each draw the well; read in the middle of each sheet, so a drawing crowded into a corner fails
    { const { ctx, page, errors } = await open(browser, '/elements.html?e=water,fire-heat,ink', { w: 1280, h: 900, reduced: true });
      await page.evaluate(() => window.__bench.update({ ground: 'paper' }));
      await page.waitForFunction(() => ['loom', 'ridges', 'voxels'].every((k) => window.__bench.value().surfaces[k].value().drawn > 0), null, { timeout: 30000 });
      const studio = await page.evaluate(() => Object.fromEntries(['loom', 'ridges', 'voxels'].map((k) => { const v = window.__bench.value().surfaces[k].value(), W = v.canvas.width, H = v.canvas.height, d = v.canvas.getContext('2d').getImageData(W >> 2, H >> 2, W >> 1, H >> 1).data; let lo = 765, hi = 0;
        for (let i = 0; i < d.length; i += 16) { const y = d[i] + d[i + 1] + d[i + 2]; lo = Math.min(lo, y); hi = Math.max(hi, y); } return [k, { range: hi - lo, facts: v.facts }]; })));
      out.studio = studio; for (const [k, v] of Object.entries(studio)) assert.ok(v.range > 60, `the ${k} lane drew the well (range ${v.range})`);
      assert.ok(studio.ridges.facts.lines > 20 && studio.voxels.facts.voxels > 100 && studio.loom.facts.ends === 96, 'each lane says what it drew');
      assert.deepEqual(errors, []); await ctx.close(); }
    console.log(JSON.stringify(out, null, 1));
    console.log('surfaces-place: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exit(1); });
