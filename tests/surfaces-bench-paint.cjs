// Paint, grounds, the reaction, frame time and the other pages that mount surfaces, checked in a browser.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surfaces-bench-paint.cjs
//
// What it holds (numbered as in surfaces-bench.cjs, where these checks lived until the file passed 300 lines):
//   9. Two other pages mount surfaces through the registry. Nothing on any of these pages makes an audio context.
//  10. Paint. The well's shader and the swatch kernel give the same colour for the same layers. Glazing order changes
//      the overlap when the pigments scatter and not when they do not. The paper, its tooth, granulation and the dried
//      rim each change the picture past a stated floor. The amount of each pigment is kept. Frame time is reported.
//   3b. A measured link grows a reaction; with the link switched off there is only mixing.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { launch, open, layoutProbe, contrastProbe, brightestGround, diff, FLOOR, PAINT_FLOOR } = require('./lib/surfaces-probe.cjs');
const out = {};

(async () => {
  const browser = await launch();
  try {
    // one page, under reduced motion so the well is a still that can be compared; three elements on paper, chosen
    const { ctx, page, errors } = await open(browser, '/elements.html?e=water,ink,light', { w: 1280, h: 900, reduced: true });
    await page.evaluate(() => window.__bench.update({ elements: ['water', 'ink', 'light'], weights: [2, 1, 1], settings: {}, ground: 'paper' }));
    const read = () => page.evaluate(() => Array.from(window.__bench.value().surfaces.well.value().well.read()));
    // 3b: a measured link grows a reaction; switching the link off leaves only mixing
    const rx = await page.evaluate(async () => { const b = window.__bench, w = () => b.value().surfaces.well, rd = () => Array.from(w().value().well.read());
      const df = (a, c) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); return +(s / (a.length / 4 * 3)).toFixed(2); };
      const ix = await window.__surfaces.elements(), o = {};
      for (const [name, ids] of [['linked', ['light', 'city-architecture']], ['unlinked', ['water', 'ink']]]) {
        b.update({ elements: ids, settings: {} }); const L = ix.byId.get(ids[0]).links.find((l) => l.to === ids[1])?.weight ?? 0;
        w().update({ elements: ids, linkScale: 1 }); const on = rd(), grown = w().value().well.product();
        w().update({ elements: ids, linkScale: 0 }); const off = rd(), none = w().value().well.product();
        w().update({ elements: ids, linkScale: 1 }); o[name] = { link: L, moved: df(on, off), product: +grown.toFixed(4), productOff: +none.toFixed(4) }; }
      b.update({ elements: ['water', 'ink', 'light'], weights: [2, 1, 1], settings: {} }); return o; });
    out.reaction = rx; assert.ok(rx.linked.link >= 50 && rx.linked.moved >= FLOOR, `a strong link changes the picture (${JSON.stringify(rx.linked)})`);
    assert.equal(rx.unlinked.link, 0); assert.ok(rx.unlinked.moved < 0.01 && rx.unlinked.product === 0, 'with no measured link there is only mixing');
    // 10: paint
    const paint = await page.evaluate(async () => { const b = window.__bench, well = () => b.value().surfaces.well.value().well, ix = await window.__surfaces.elements(), o = {};
      const km = await import('/world/site/surfaces/km.mjs'), gz = await import('/world/site/surfaces/glaze.mjs');
      const rd = () => Array.from(well().read(192, 144)), df = (a, c) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); return +(s / (a.length / 4 * 3)).toFixed(2); };
      const srgb = (lin) => lin.map((c) => Math.round(km.linToSrgb(Math.min(1, Math.max(0, c))) * 255)), far = (a, c) => Math.max(...a.map((x, i) => Math.abs(x - c[i])));
      // two flat unit layers, second over first: the shader's answer and the kernel's
      const probe = (ids, settings) => { b.update({ elements: ids, settings }); const P = ids.map((id) => gz.paintOf(ix, ix.byId.get(id), settings[id])); return { shader: well().optics([1, 1, 0, 0]), kernel: srgb(km.glaze(P[1].pig, P[0].pig)) }; };
      const ab = probe(['water', 'fire-heat'], {}), ba = probe(['fire-heat', 'water'], {}), clear = { water: { coverage: 0 }, 'fire-heat': { coverage: 0 } }, ab0 = probe(['water', 'fire-heat'], clear), ba0 = probe(['fire-heat', 'water'], clear);
      o.shaderAgainstKernel = Math.max(far(ab.shader, ab.kernel), far(ba.shader, ba.kernel), far(ab0.shader, ab0.kernel)); o.orderGapScattering = far(ab.shader, ba.shader); o.orderGapNoScattering = far(ab0.shader, ba0.shader);
      // what each paper effect adds, on two hard-edged washes; then the ground
      b.update({ elements: ['type', 'fire-heat'], settings: { type: { softness: 0.4 }, 'fire-heat': { softness: 0.4 } } }); const base = rd(); o.effects = {};
      for (const k of ['tooth', 'granulation', 'rim']) { well().gain({ [k]: 0 }); o.effects[k] = df(base, rd()); well().gain({ [k]: 1 }); }
      o.restored = df(base, rd()); o.conservation = well().conservation();
      b.update({ elements: ['water', 'fire-heat'], settings: {} }); return o; });
    out.paint = paint;
    assert.ok(paint.shaderAgainstKernel <= 2, `the shader and the swatch kernel agree to ${paint.shaderAgainstKernel} of 255`);
    assert.ok(paint.orderGapScattering >= 20, `with scattering, the order changes the overlap (${paint.orderGapScattering} of 255)`); assert.ok(paint.orderGapNoScattering <= 1, `with no scattering it does not (${paint.orderGapNoScattering} of 255)`);
    for (const k of ['tooth', 'granulation', 'rim']) assert.ok(paint.effects[k] >= PAINT_FLOOR, `${k} changes the picture (${paint.effects[k]}, floor ${PAINT_FLOOR})`);
    assert.ok(paint.restored < 0.01); assert.ok(paint.conservation.error <= 1e-4, `pigment is kept (${paint.conservation.error})`);
    // the ground control: a chosen ground stands and says so; given back, the ground follows the blend and says why
    const before = await read(); assert.equal(await page.getAttribute('.sf-water', 'data-ground'), 'paper'); assert.match(await page.textContent('.sf-why'), /your choice/);
    await page.selectOption('select[data-ground]', 'glass'); out.paint.ground = +diff(before, await read()).toFixed(2); assert.ok(out.paint.ground >= FLOOR, `the ground control changes the picture (${out.paint.ground})`);
    assert.equal(await page.evaluate(() => window.__bench.value().ground), 'glass', 'the bench knows the choice');
    await page.selectOption('select[data-ground]', ''); const auto = await page.evaluate(() => { const v = window.__bench.value().surfaces.well.value(); return { ground: v.ground, auto: v.auto, why: v.why, pigments: v.pigments, said: document.querySelector('.sf-why').textContent }; });
    out.paint.follow = auto; assert.deepEqual([auto.ground, auto.auto, auto.pigments], ['water', true, ['fire-heat']], 'water is the first material, so fire heat lies on it'); assert.match(auto.said, /first material/);
    await page.selectOption('select[data-ground]', 'paper'); assert.ok(diff(before, await read()) < 0.01, 'and paper comes back as it was');
    // every ground: it changes the picture, and the shader keeps the ground's stated rule on two flat layers
    const grounds = await page.evaluate(async () => { const { GROUNDS, mixOn } = await import('/world/site/surfaces/grounds.mjs'), gz = await import('/world/site/surfaces/glaze.mjs'), km = await import('/world/site/surfaces/km.mjs');
      const b = window.__bench, ix = await window.__surfaces.elements(), well = () => b.value().surfaces.well.value().well, P = ['water', 'fire-heat'].map((id) => gz.paintOf(ix, ix.byId.get(id))), o = {};
      const rd = () => Array.from(well().read()), df = (a, c) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - c[i]) + Math.abs(a[i + 1] - c[i + 1]) + Math.abs(a[i + 2] - c[i + 2]); return +(s / (a.length / 4 * 3)).toFixed(2); };
      const base = rd(), seen = [];
      for (const id of Object.keys(GROUNDS)) { b.update({ ground: id }); const px = rd(), want = mixOn(id, P).map((c) => Math.round(km.linToSrgb(Math.min(1, Math.max(0, c))) * 255)), got = well().optics([1, 1, 0, 0]);
        o[id] = { rule: GROUNDS[id].rule, moved: df(base, px), nearestOther: Math.min(99, ...seen.map((s) => df(s, px))), shaderAgainstRule: Math.max(...got.map((x, i) => Math.abs(x - want[i]))) }; seen.push(px); }
      b.update({ ground: 'paper' }); return o; });
    out.grounds = grounds; assert.equal(Object.keys(grounds).length, 23, 'nineteen grounds, the woven cloth, film stock, sound and the hot plate');
    for (const [id, g] of Object.entries(grounds)) { if (id !== 'paper') assert.ok(g.moved >= FLOOR, `${id} changes the picture (${g.moved})`); assert.ok(g.nearestOther >= FLOOR, `${id} is its own picture (${g.nearestOther} from the nearest other ground)`);
      assert.ok(g.shaderAgainstRule <= 2, `${id}: the shader keeps the ${g.rule} rule (${g.shaderAgainstRule} of 255)`); }
    // the glaze swatches in the blend table: painted, and their overlap is the colour the table names
    await page.waitForFunction(() => { const c = [...document.querySelectorAll('.bl-glazes canvas')]; return c.length === 2 && c.every((x) => x.dataset.painted); }, null, { timeout: 15000 });
    const sw = await page.evaluate(async () => { const km = await import('/world/site/surfaces/km.mjs'), well = window.__bench.value().surfaces.well.value().well;
      return { gap: +document.querySelector('.bl-glazes li').dataset.gap, said: document.querySelector('.bl-gap').textContent.slice(0, 60), swatches: [...document.querySelectorAll('.bl-glazes canvas')].map((c) => { const hex = c.dataset.hex, want = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        const d = c.getContext('2d').getImageData(Math.round(c.width * 0.42), Math.round(c.height * 0.4), Math.round(c.width * 0.16), Math.round(c.height * 0.2)).data, m = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) m[k] += d[i + k] / (d.length / 4);
        const first = c.dataset.under === 'water' && c.dataset.on === 'paper', shader = well.optics(first ? [1, 1, 0, 0] : [0, 0, 0, 0]);   // the well holds water then fire heat: its probe is fire heat over water
        return { top: c.dataset.top, under: c.dataset.under, hex, painted: Math.max(...m.map((x, k) => Math.abs(x - want[k]))), shader: first ? Math.max(...shader.map((x, k) => Math.abs(x - want[k]))) : null }; }) }; });
    out.paint.swatches = sw; assert.equal(sw.swatches.length, 2); assert.notEqual(sw.swatches[0].hex, sw.swatches[1].hex, 'the two orders are two colours');
    for (const w of sw.swatches) assert.ok(w.painted <= 16, `${w.top} over ${w.under}: the painted overlap is the named colour, within the paper's grain (${w.painted.toFixed(1)} of 255)`);
    assert.ok(sw.swatches.find((w) => w.shader != null).shader <= 2, 'the well\'s shader gives the swatch\'s colour for the same two layers'); assert.ok(sw.gap >= 20 && /order changes/.test(sw.said));
    assert.deepEqual(errors, []); await ctx.close();

    // 10b: frame time with motion on, a linked pair growing its reaction, on paper and on dark water (reported; the bound on the step is loose, and the frame time is not asserted because it depends on the machine)
    { const o = await open(browser, '/elements.html?e=light,city-architecture', { w: 1280, h: 720 });
      await o.page.evaluate(() => window.__bench.update({ ground: 'paper' }));
      const tm = async () => { await o.page.evaluate(() => { const w = window.__bench.value().surfaces.well.value().well; w.stir(0.5, 0.5, 0.4, 0.2); w.timing(); window.__tm = { frames: 0, sim: 0, frame: 0 }; });
        // The count is by frames, not by the clock: a shared runner with software GL draws a frame several times slower than a desk machine
        // (the first form of this check asked for 20 frames in 4 seconds and failed there on the frame count alone).
        for (let i = 0; i < 30; i++) { await o.page.waitForTimeout(2000); const n = await o.page.evaluate(() => { const w = window.__bench.value().surfaces.well.value().well, t = w.timing(), a = window.__tm; w.touch(); a.sim += t.sim * t.frames; a.frame += t.frame * t.frames; a.frames += t.frames; return a.frames; }); if (n >= 24) break; }
        return o.page.evaluate(() => { const w = window.__bench.value().surfaces.well.value().well, a = window.__tm, t = { frames: a.frames, sim: a.frames ? a.sim / a.frames : 0, frame: a.frames ? a.frame / a.frames : 0 }; return { frames: t.frames, simMs: +t.sim.toFixed(2), frameMs: +t.frame.toFixed(2), product: +w.product().toFixed(4), kept: w.conservation().error }; }); };
      const paper = await tm(); await o.page.selectOption('select[data-ground]', 'water'); const water = await tm();
      out.frame = { note: 'software GL in this browser; sim is the JavaScript step, frame the time between frames', grid: await o.page.evaluate(() => window.__bench.value().surfaces.well.value().well.reactionGrid), paper, water };
      assert.ok(paper.frames >= 24 && water.frames >= 24, `the well keeps drawing with motion on (${paper.frames} and ${water.frames} frames)`); assert.ok(paper.simMs < 33, `the simulation step stays under two frames at 60 a second, whatever the machine (${paper.simMs} ms; 3.7 on a desk machine, 12.6 on the shared runner)`); assert.ok(paper.kept <= 1e-4 && water.kept <= 1e-4, 'pigment is kept with motion on'); assert.deepEqual(o.errors, []);
      await o.ctx.close(); }
    // 9: two other pages mount through the registry
    for (const [path, want, ids] of [['/swatches.html', ['well', 'plate', 'chart'], 'pigment,ink,paper'], ['/accession.html', ['living', 'lettering', 'motion', 'well'], 'type,ink,paper']]) {
      const o = await open(browser, path, { w: 1280, h: 800, reduced: true });
      const r = await o.page.evaluate(() => ({ mounted: window.__surfaces.mounted(), link: document.querySelector('.sf-more a')?.getAttribute('href'), canvas: !!document.querySelector('[data-surface] .sf-water canvas'), audio: window.__audio,
        sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      const c = await o.page.evaluate(contrastProbe, await brightestGround(o.page)); r.contrast = c.worst.ratio; r.brightest = c.brightest; assert.ok(c.worst.ratio >= 4.5, `${path}: worst text contrast ${c.worst.ratio} (${c.worst.text})`);
      out[path] = r; assert.deepEqual(r.mounted.sort(), [...want].sort()); assert.equal(r.link, '/elements.html?e=' + ids); assert.ok(r.canvas); assert.equal(r.audio, 0); assert.ok(r.sideways <= 0); assert.deepEqual(o.errors, []);
      if (path === '/swatches.html') { const a = await o.page.evaluate(() => Array.from(window.__surfaces.mounted && document.querySelector('.sf-water canvas').toDataURL().length ? [document.querySelector('.sf-water canvas').toDataURL()] : []));
        await o.page.locator('input[data-drive="coverage"]').focus(); for (let i = 0; i < 30; i++) await o.page.keyboard.press('ArrowLeft');
        const b = await o.page.evaluate(() => document.querySelector('.sf-water canvas').toDataURL()); assert.notEqual(a[0], b, 'the chart control on the swatch page changes its well'); }
      await o.page.evaluate(() => window.__surfaces.unmountAll()); assert.equal(await o.page.evaluate(() => document.querySelectorAll('[data-surface] canvas').length), 0, `${path}: teardown leaves no canvas`);
      await o.ctx.close();
    }
    console.log(JSON.stringify(out, null, 1));
    console.log('surfaces-bench-paint: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.log(JSON.stringify(out, null, 1)); console.error(e); process.exit(1); });
