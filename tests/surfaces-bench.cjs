// The bench, the registry and its take-away, checked in a browser. Paint, grounds and other pages: surfaces-bench-paint.cjs.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surfaces-bench.cjs
//
// What it holds:
//   1. No element name is cut, at 1280, at 3840 and at phone width; the page never scrolls sideways.
//   2. The detail is not a slot: nothing in it is clipped or scrolls inside itself (the blend table may scroll sideways on a phone).
//   3. Every text colour reads at 4.5:1 or better against the brightest pixel the field can show (measured from a
//      screenshot and bounded by the darken ceiling), in day, night and plain view, with no panel behind any reading area.
//   4. The chart's numbers and positions equal the data. The blend table's numbers equal a mix worked out here.
//   5. The well answers: a stir changes the picture, a property control changes it, and going back to the measured
//      values with a fresh start gives the first picture again (under reduced motion, where the well is a still).
//   6. Each element's still is its own: the smallest difference between any two elements with measured properties is
//      reported and must clear a floor; elements with nothing measured are told apart by colour only, and that is reported.
//   7. The take-away saves a picture, a palette and a recipe, the recipe opens again, and no file names a reference image.
//   8. Mount and teardown: the registry reports what is mounted, and unmountAll leaves no canvas and no listener host.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launch, open, layoutProbe, contrastProbe, brightestGround, diff, FLOOR, PAINT_FLOOR } = require('./lib/surfaces-probe.cjs');
const out = {};

(async () => {
  const browser = await launch();
  try {
    // 1, 2: names and the detail, at three sizes
    for (const view of [{ w: 1280, h: 720 }, { w: 3840, h: 2160 }, { w: 390, h: 844, phone: true }]) {
      const { ctx, page, errors } = await open(browser, '/elements.html', view, view.phone ? { isMobile: true, hasTouch: true } : {});
      const r = await page.evaluate(layoutProbe);
      out[`layout ${view.w}`] = { names: r.names, cut: r.cut.length, spill: r.spill, slots: r.slots, sideways: r.sideways };
      assert.equal(r.names, 160, `${view.w}: 160 names`); assert.deepEqual(r.cut, [], `${view.w}: no name is cut`); assert.equal(r.spill, 0, `${view.w}: no name leaves its cell`);
      assert.equal(r.slots, 0, `${view.w}: nothing in the detail is clipped or scrolls inside itself`); assert.ok(r.sideways <= 0, `${view.w}: the page does not scroll sideways`);
      assert.deepEqual(errors, [], `${view.w}: no page error`);
      await ctx.close();
    }
    // 3: contrast in day, night and plain
    for (const mode of ['day', 'night', 'plain']) {
      const { ctx, page } = await open(browser, '/elements.html?e=water,ink', { w: 1280, h: 720, scheme: mode === 'night' ? 'dark' : 'light' });
      if (mode === 'plain') { await page.click('[data-plain-toggle]'); await page.waitForTimeout(300); assert.ok(await page.evaluate(() => document.documentElement.classList.contains('plain')), 'plain view is on'); }
      const c = await page.evaluate(contrastProbe, await brightestGround(page)); out[`contrast ${mode}`] = c;
      assert.equal(c.blend, 'darken', `${mode}: the field is held under its ceiling`);
      assert.ok(c.brightest <= c.ceiling + 0.01, `${mode}: no pixel of the field is brighter than the ceiling (${c.brightest} against ${c.ceiling})`);
      assert.ok(c.worst.ratio >= 4.5, `${mode}: worst text contrast ${c.worst.ratio} (${c.worst.text})`);
      assert.ok(await page.evaluate(() => ['.bn-main', '.bn-side', '.parts-lead'].every((q) => { const cs = getComputedStyle(document.querySelector(q)); return /rgba\(0, 0, 0, 0\)|transparent/.test(cs.backgroundColor) && cs.boxShadow === 'none'; })), `${mode}: no reading area has a panel behind it`);
      if (mode === 'plain') { assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.sf-water')).display), 'none', 'plain view shows no well canvas');
        await page.evaluate(() => window.__bench.update({ ground: 'paper' }));
        const pl = await page.evaluate(() => [...document.querySelectorAll('.bl-glazes figure')].map((f) => ({ canvas: getComputedStyle(f.querySelector('canvas')).display, chip: getComputedStyle(f.querySelector('figcaption i')).display, colour: f.querySelector('figcaption i').style.background, text: f.querySelector('figcaption').textContent })));
        out.plainSwatches = pl; assert.equal(pl.length, 2); for (const f of pl) { assert.equal(f.canvas, 'none'); assert.notEqual(f.chip, 'none'); assert.ok(f.colour && /over .* on /.test(f.text), 'plain view names each glaze, its ground and its colour as a chip'); } }
      await ctx.close();
    }
    // 4 to 8 on one page, under reduced motion so the well is a still that can be compared
    const { ctx, page, errors } = await open(browser, '/elements.html?e=water', { w: 1280, h: 900, reduced: true });
    const chart = await page.evaluate(async () => {
      const ix = await window.__surfaces.elements(), { pos } = await import('/world/site/surfaces/charts.mjs'), el = ix.byId.get('water'), bad = [];
      for (const p of el.properties) { const row = document.querySelector(`.bn-properties .pc-row[data-prop="${p.name}"]`), s = ix.spread.get(p.name);
        if (!row) { bad.push('no row ' + p.name); continue; }
        if (+row.querySelector('.pc-val').dataset.value !== p.value) bad.push('value ' + p.name);
        if (Math.abs(parseFloat(row.querySelector('.pc-at').style.left) - pos(s, p.value)) > 0.01) bad.push('place ' + p.name);
        if (p.iqr && Math.abs(parseFloat(row.querySelector('.pc-iqr').style.left) - pos(s, p.iqr[0])) > 0.01) bad.push('interval ' + p.name);
        if (!row.querySelector('.pc-meta').textContent.includes('n ' + p.n) || !row.querySelector('.pc-meta').textContent.includes(p.instrument)) bad.push('n or instrument ' + p.name);
        if (row.querySelectorAll('.pc-tick').length !== s.count) bad.push('ticks ' + p.name); }
      return { rows: document.querySelectorAll('.bn-properties .pc-row').length, measured: el.properties.length, unmeasured: document.querySelectorAll('.bn-properties .pc-row.is-un').length, bad };
    });
    out.chart = chart; assert.deepEqual(chart.bad, [], 'chart rows equal the data'); assert.ok(chart.unmeasured > 0, 'unmeasured properties are shown as unmeasured');
    const cmp = await page.evaluate(async () => { const ix = await window.__surfaces.elements(), s = ix.spread.get(document.querySelector('.cmp').dataset.prop), rows = [...document.querySelectorAll('.cmp-row')];
      return { rows: rows.length, count: s.count, sorted: rows.every((r, i) => !i || +r.dataset.value >= +rows[i - 1].dataset.value), none: document.querySelectorAll('.cmp-un').length, total: ix.data.elements.length }; });
    out.compare = cmp; assert.equal(cmp.rows, cmp.count); assert.ok(cmp.sorted, 'compare rows run low to high'); assert.equal(cmp.rows + cmp.none, cmp.total, 'every element is either placed or named as unmeasured');

    const read = () => page.evaluate(() => Array.from(window.__bench.value().surfaces.well.value().well.read()));
    const first = await read();
    const box = await page.locator('.sf-water').boundingBox();
    await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width * (0.3 + 0.05 * i), box.y + box.height * (0.5 + 0.02 * i));
    await page.mouse.up();
    const stirred = await read(); out.stir = +diff(first, stirred).toFixed(2); assert.ok(out.stir > 0.5, `a drag changes the well (${out.stir})`);
    await page.locator('.sf-water').focus(); await page.keyboard.press('ArrowRight'); await page.keyboard.press('Space');
    out.keys = +diff(stirred, await read()).toFixed(2); assert.ok(out.keys > 0.2, `the keyboard acts on the well (${out.keys})`);
    await page.click('[data-act="again"]');
    assert.ok(diff(first, await read()) < 0.01, 'Start again gives the first picture');
    const slider = page.locator('.bn-properties input[data-drive="coverage"]');
    await slider.focus(); for (let i = 0; i < 40; i++) await page.keyboard.press('ArrowRight');
    const moved = await read(); out.control = +diff(first, moved).toFixed(2); assert.ok(out.control > 1, `a property control changes the well (${out.control})`);
    const set = await page.evaluate(() => ({ text: document.querySelector('input[data-drive="coverage"]').getAttribute('aria-valuetext'), measured: document.querySelector('.pc-row[data-prop="marks/ink coverage"] .pc-val').dataset.value, state: window.__bench.value().settings.water }));
    assert.ok(set.state.coverage > +set.measured, 'the setting is above the measured value, and the measured value still shows');
    await page.click('[data-act="measured"]');
    assert.ok(diff(first, await read()) < 0.01, 'back to the measured values gives the first picture');

    // 5b: each of the twelve controls, from the table's lowest value to its highest, must move the picture
    const moves = await page.evaluate(async () => { const ix = await window.__surfaces.elements(), { DRIVES } = await import('/world/site/surfaces/elements-data.mjs'), b = window.__bench, o = {};
      const rd = () => Array.from(b.value().surfaces.well.value().well.read());
      const df = (a, c) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); return +(s / (a.length / 4 * 3)).toFixed(2); };
      for (const [k, d] of Object.entries(DRIVES)) { const s = ix.spread.get(d.prop); b.update({ elements: ['water'], settings: { water: { [k]: s.min } } }); const lo = rd();
        b.update({ elements: ['water'], settings: { water: { [k]: s.max } } }); o[k] = df(lo, rd()); }
      b.update({ elements: ['water'], settings: {} }); return o; });
    out.controls = { floor: FLOOR, moves, under: Object.keys(moves).filter((k) => moves[k] < FLOOR) };
    assert.equal(Object.keys(moves).length, 12); assert.deepEqual(out.controls.under, [], 'every control moves the picture past the floor');

    // 6: every element's still, compared with every other
    const stills = await page.evaluate(async () => { const ix = await window.__surfaces.elements(), { driveFor } = await import('/world/site/surfaces/elements-data.mjs'), b = window.__bench, o = {};
      for (const e of ix.data.elements) { b.update({ elements: [e.id], settings: {} });
        o[e.id] = { px: Array.from(b.value().surfaces.well.value().well.read()), measured: (e.properties || []).length, key: e.colour.hex + JSON.stringify(driveFor(ix, e).values) }; }
      return o; });
    // Two elements can only look different if the data that reaches the well differs: the colour and the twelve drive values.
    const ids = Object.keys(stills); let min = { d: 1e9 }, flat = 0, sameData = 0; const close = [], keys = new Set(ids.map((i) => stills[i].key));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const a = stills[ids[i]], b = stills[ids[j]], d = diff(a.px, b.px);
      if (a.key === b.key) { sameData++; assert.ok(d < 0.01, 'the same data gives the same picture'); continue; }
      if (d < min.d) min = { d: +d.toFixed(2), a: ids[i], b: ids[j] };
      if (d < FLOOR) close.push({ a: ids[i], b: ids[j], d: +d.toFixed(2) });
    }
    const flatIds = [];
    for (const id of ids) { const p = stills[id].px; let lo = 255, hi = 0; for (let i = 0; i < p.length; i += 4) { const y = p[i] + p[i + 1] + p[i + 2]; lo = Math.min(lo, y); hi = Math.max(hi, y); } if (hi - lo < 18) { flat++; flatIds.push(id); } }
    out.stills = { elements: ids.length, withMeasuredProperties: ids.filter((i) => stills[i].measured).length, distinctData: keys.size, pairsWithIdenticalData: sameData,
      smallestDifferenceBetweenDifferentData: min, floor: FLOOR, pairsUnderFloor: close.length, close: close.slice(0, 10), flat, flatIds: flatIds.slice(0, 12) };
    assert.equal(flat, 0, 'no still is a flat field');
    assert.ok(min.d >= FLOOR, `two elements with different data look alike: ${JSON.stringify(min)}`);

    // 4: the blend table's numbers
    // from here the ground is chosen (paper), so every element stays a pigment; the choice holds until it is given back
    await page.evaluate(() => window.__bench.update({ elements: ['water', 'ink', 'light'], weights: [2, 1, 1], settings: {}, ground: 'paper' }));
    const bl = await page.evaluate(async () => { const ix = await window.__surfaces.elements(), { mixValue } = await import('/world/site/surfaces/elements-data.mjs'), ids = ['water', 'ink', 'light'], w = [0.5, 0.25, 0.25], bad = [];
      for (const tr of document.querySelectorAll('.bl tbody tr')) { const name = tr.dataset.prop, vs = [], ws = [];
        ids.forEach((id, i) => { const p = ix.byId.get(id).properties.find((x) => x.name === name); if (p) { vs.push(p.value); ws.push(w[i]); } });
        if (Math.abs(+tr.querySelector('.bl-mix').dataset.value - mixValue(name, vs, ws)) > 1e-9) bad.push(name);
        if (name === 'spatial/wave orientation' && !/circular/.test(tr.querySelector('.bl-mix').textContent)) bad.push('rule ' + name);
        if (!/computed/.test(tr.querySelector('.bl-mix').textContent)) bad.push('label ' + name); }
      const links = [...document.querySelectorAll('.bl-links li')].map((li) => li.dataset.pair), wl = ix.byId.get('water').links.find((l) => l.to === 'light');
      return { rows: document.querySelectorAll('.bl tbody tr').length, bad, links, waterLight: wl?.weight, shown: document.querySelector('.bl-links li[data-pair="water|light"]').textContent, parts: window.__bench.value().surfaces.well.value().well.amounts().filter((a) => a > 0.001).length,
        lettered: window.__bench.value().surfaces.lettering.value(), curve: document.querySelector('.sf-motion [data-curve]').dataset.curve, inks: document.querySelector('.sf-plot canvas')?.dataset.inks || null }; });
    out.blend = bl; assert.deepEqual(bl.bad, [], 'blend mix equals the rule for each property worked from the measured parts, and says computed');
    assert.equal(bl.links.length, 3); assert.ok(bl.shown.includes(String(bl.waterLight)), 'the measured link weight is shown'); assert.equal(bl.parts, 3, 'three elements are in the well');
    const study = await (async () => { const [d] = await Promise.all([page.waitForEvent('download'), page.click('[data-save-plot]')]); return { name: d.suggestedFilename(), bytes: fs.readFileSync(await d.path()).length }; })();
    out.study = study; assert.match(study.name, /\.png$/); assert.ok(study.bytes > 2000, 'the pen study saves as a picture');
    await page.locator('.bn-wide').scrollIntoViewIfNeeded(); await page.waitForTimeout(1500);
    await page.waitForFunction(() => ['plate', 'glass', 'living'].every((k) => window.__bench.value().surfaces[k].value().drawn > 0), null, { timeout: 30000 });
    const more = await page.evaluate(async () => { const s = window.__bench.value().surfaces, o = {};
      for (const k of ['plate', 'glass', 'living']) { const c = s[k].value().canvas; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let lo = 765, hi = 0;
        for (let i = 0; i < d.length; i += 4) { const y = d[i] + d[i + 1] + d[i + 2]; if (y < lo) lo = y; if (y > hi) hi = y; } o[k] = { w: c.width, h: c.height, range: hi - lo }; }
      return o; });
    out.more = more; for (const k of ['plate', 'glass']) assert.ok(more[k].range > 30, `the ${k} surface drew a picture (range ${more[k].range})`);
    const lit = await page.evaluate(async () => { const { TARGET } = await import('/world/site/surfaces/surface-more.mjs'), c = document.querySelector('.sf-plate canvas'), l = document.querySelector('.sf-living canvas');
      const d = l.getContext('2d').getImageData(0, 0, l.width, l.height).data; let ink = 0, clear = 0; for (let i = 3; i < d.length; i += 4) { if (d[i] > 200) ink++; else if (d[i] < 8) clear++; }
      return { target: TARGET, raw: { mean: +c.dataset.rawMean, range: +c.dataset.rawRange }, plate: { mean: +c.dataset.mean, range: +c.dataset.range }, living: { ink: +(ink / (d.length / 4)).toFixed(3), clear: +(clear / (d.length / 4)).toFixed(3), background: getComputedStyle(l).backgroundColor } }; });
    out.light = lit; assert.ok(Math.abs(lit.plate.mean - lit.target.mean) < 0.08, `the plate is exposed to its target (${lit.plate.mean})`); assert.ok(lit.plate.range >= lit.target.range - 0.06, `the plate has its range (${lit.plate.range})`);
    assert.ok(lit.living.clear > 0.6 && lit.living.ink > 0.01 && /rgba\(0, 0, 0, 0\)|transparent/.test(lit.living.background), `the living type has no ground of its own (${JSON.stringify(lit.living)})`);
    assert.ok(bl.curve.length > 0, 'the motion lane drew a curve'); assert.ok(bl.inks, 'the pen study drew with the parts as inks');
    // 7: take-away
    const grab = async (sel) => { const [d] = await Promise.all([page.waitForEvent('download'), page.click(sel)]); const p = await d.path(); return { name: d.suggestedFilename(), bytes: fs.readFileSync(p) }; };
    const png = await grab('[data-save="png"]'), pal = await grab('[data-save="palette"]'), rec = await grab('[data-save="recipe"]');
    // 7b: files for other trades, written by the site's own plot, relief and palette writers; each button says what its file is
    const trades = {}; for (const k of ['plot-svg', 'plot-gcode', 'relief-stl', 'palette-gpl']) { const f = await grab(`[data-file="${k}"]`); trades[k] = { name: f.name, bytes: f.bytes.length }; assert.ok(f.bytes.length > 60, `${k} saves a file (${f.bytes.length} bytes)`);
      if (k === 'plot-svg') assert.match(f.bytes.toString('utf8'), /<svg[^>]+xmlns[\s\S]*<(path|polyline)/); if (k === 'plot-gcode') assert.match(f.bytes.toString('utf8'), /^G21$/m); if (k === 'relief-stl') assert.equal(f.bytes.length, 84 + 50 * f.bytes.readUInt32LE(80)); if (k === 'palette-gpl') assert.match(f.bytes.toString('utf8'), /^GIMP Palette/); }
    out.trades = trades; assert.equal(await page.evaluate(() => [...document.querySelectorAll('.tk-trades dd')].every((d) => d.textContent.length > 40)), true); assert.equal(await page.evaluate(() => document.querySelector('.tk-studio a').getAttribute('href')), '/studio.html', 'the bench links to the Studio');
    assert.equal(png.bytes.subarray(1, 4).toString(), 'PNG'); assert.ok(png.bytes.length > 2000, 'the picture has content');
    const recipe = JSON.parse(rec.bytes.toString()), palette = JSON.parse(pal.bytes.toString());
    assert.equal(recipe.format, 'bench.recipe/1'); assert.equal(recipe.ground, 'paper', 'the chosen ground is in the recipe'); assert.deepEqual(recipe.elements.map((e) => e.id), ['water', 'ink', 'light']); assert.match(recipe.graph, /^[0-9a-f]{8}$/);
    assert.equal(palette.colours.length, 4); assert.ok(/computed/.test(palette.colours[3].role));
    assert.ok(!/thumb|https?:|\.jpg|\.webp|\.png/.test(rec.bytes.toString() + pal.bytes.toString()), 'no reference image or link is in a saved file');
    await page.evaluate(() => window.__bench.update({ elements: ['glass'], settings: {}, ground: null }));
    await page.setInputFiles('.tk-load input', { name: 'r.recipe.json', mimeType: 'application/json', buffer: rec.bytes });
    await page.waitForFunction(() => window.__bench.value().elements.join() === 'water,ink,light'); assert.equal(await page.evaluate(() => window.__bench.value().ground), 'paper', 'and opening the recipe brings the ground back');
    out.takeaway = { png: png.bytes.length, recipe: rec.name, palette: pal.name, graph: recipe.graph };
    // 8: mount and teardown
    const td = await page.evaluate(() => { const before = window.__surfaces.mounted(); window.__surfaces.unmountAll();
      return { before, after: window.__surfaces.mounted(), canvases: document.querySelectorAll('#parts canvas').length, left: document.getElementById('parts').children.length, live: document.querySelectorAll('[data-surface-live]').length }; });
    out.teardown = td; assert.ok(td.before.includes('bench') && td.before.includes('well') && td.before.length === 15, `fifteen surfaces, the loom, plot map and cubes among them (${td.before})`); assert.deepEqual(td.after, []); assert.equal(td.canvases, 0); assert.equal(td.left, 0); assert.equal(td.live, 0);
    assert.equal(await page.evaluate(() => window.__audio), 0, 'the bench made no audio context'); assert.deepEqual(errors, []);
    await ctx.close();
    console.log(JSON.stringify(out, null, 1));
    console.log('surfaces-bench: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exit(1); });
