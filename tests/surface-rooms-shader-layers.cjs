// The shader room's layer stack in a browser (#shader): layers added, blended, mixed, moved, removed and linked.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms-shader-layers.cjs
//
// What it holds:
//   1. Every blend draws what the CPU copy of the blend (system/shader-stack.js blendOne) says, pixel by pixel, from the
//      base frame and the layer's own frame, to within 2 levels in 255.
//   2. A three-layer stack changes the frame; a blend change changes it; a higher mix on an added layer brightens it.
//   3. Planted control: a layer at mix 0 gives the same bytes as the stack without that layer, and a mix of 0.05 does
//      not, so the check can tell the two apart.
//   4. Lower, raise and remove reorder the stack and the frame follows.
//   5. The address carries the stack: a new tab opens the same layers and, at time 0, the same bytes.
//   6. Other rooms' outputs are layers with a continuous mix: the blend's colours, the pen study's picture and the
//      type forge's line each move the frame further from the base as their mix rises.
//   7. Frame time with four layers at 1280 by 800, measured with a read-back each frame, and the room's own readout.
//   8. At 375, 583, 1280 and 2560 px wide nothing in the opened room runs past the right edge.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const LIVE = '#shader[data-room-live]';
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + path, { waitUntil: 'load' });
  await page.waitForSelector(LIVE); await page.waitForFunction(() => window.__rooms.handles.shader.value().ok && +document.querySelector('#shader .rm-host').dataset.frames >= 1);
  return { ctx, page, errors };
}
const value = (page) => page.evaluate(() => window.__rooms.handles.shader.value());
const leave = async (ctx, page) => { await page.evaluate(() => window.__rooms?.handles.shader?.destroy()).catch(() => {}); await page.waitForTimeout(800); await ctx.close(); };
// wait until the room has drawn a frame after the last change. The change may have drawn already, so the test asks for
// one more frame (a pointer leaving the frame draws one, and the pointer is not over it in this test)
async function drawn(page) {
  const n = await page.evaluate(() => { const k = +document.querySelector('#shader .rm-host').dataset.frames; document.querySelector('#shader .shd-frame').dispatchEvent(new Event('pointerleave')); return k; });
  await page.waitForFunction((k) => +document.querySelector('#shader .rm-host').dataset.frames > k, n);
}
async function hold(page) { // pause at time 0, so every frame after this is the same moment
  if ((await value(page)).running) await page.click('#shader [data-run]');
  await page.click('#shader [data-rewind]'); await drawn(page);
}
// the whole frame as bytes: an FNV hash, the mean level, and the RGB of every sampled pixel
const grab = (page) => page.evaluate(() => {
  const c = document.querySelector('#shader .shd-frame'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height;
  const x = k.getContext('2d', { willReadFrequently: true }); x.drawImage(c, 0, 0); const d = x.getImageData(0, 0, k.width, k.height).data;
  let h = 0x811c9dc5, sum = 0; const samples = [];
  for (let i = 0; i < d.length; i++) { h = Math.imul(h ^ d[i], 0x01000193) >>> 0; if ((i & 3) !== 3) sum += d[i]; }
  for (let s = 0; s < 400; s++) { const px = ((s * 7919) % (k.width * k.height)) * 4; samples.push([d[px], d[px + 1], d[px + 2]]); }
  return { hash: h, mean: sum / (k.width * k.height * 3), samples };
});
const slide = (part) => (page, i, v) => page.evaluate(([sel, v]) => { const r = document.querySelector(sel); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); }, [`#shd-l${i}-${part}`, v]);
const setMix = slide('mix'), setKnob = slide('key');
async function addLayer(page, src, blend, mix) {
  const n = (await value(page)).layers.length;
  await page.click('#shader [data-l-add]');
  await page.selectOption(`#shd-l${n}-src`, src); await page.selectOption(`#shd-l${n}-blend`, blend); await setMix(page, n, mix);
  await drawn(page);
}
const distance = (a, b) => a.samples.reduce((s, p, i) => s + Math.abs(p[0] - b.samples[i][0]) + Math.abs(p[1] - b.samples[i][1]) + Math.abs(p[2] - b.samples[i][2]), 0) / (a.samples.length * 3);

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    let link = '', linkedHash = 0;
    { // 1: each blend, against the CPU copy
      const { ctx, page, errors } = await open(browser, '/playground/?room=shader&shp=bands#shader');
      await hold(page);
      const layerOwn = await grab(page);                                     // the bands shader alone, at time 0
      await page.selectOption('#shd-start', 'interference'); await drawn(page);
      const baseOwn = await grab(page);                                      // the base alone, at time 0
      assert.notEqual(layerOwn.hash, baseOwn.hash);
      const blends = await page.evaluate(async () => (await import('/system/shader-stack.js')).BLENDS);
      await addLayer(page, 's:bands', 'normal', 1);
      const worst = {};
      for (const [id] of blends) {
        for (const [mix, key] of [[1, 0], [0.5, 0], [0.8, 0.6]]) {
          await page.selectOption('#shd-l0-blend', id); await setMix(page, 0, mix); await setKnob(page, 0, key); await drawn(page);
          const got = await grab(page);
          const want = await page.evaluate(([id, mix, key, b, l]) => import('/system/shader-stack.js').then(({ blendOne, weightOf }) => b.map((p, i) => {
            const s = l[i].map((v) => v / 255), w = weightOf(mix, key, s); return p.map((v, c) => { const a = v / 255; return Math.round((a + (blendOne(id, a, s[c]) - a) * w) * 255); }); })),
          [id, mix, key, baseOwn.samples, layerOwn.samples]);
          let far = 0; got.samples.forEach((p, i) => p.forEach((v, c) => { far = Math.max(far, Math.abs(v - want[i][c])); }));
          worst[`${id}@${mix}/${key}`] = far;
          assert.ok(far <= 2, `${id} at mix ${mix}, key ${key} draws what the blend says: worst pixel ${far} levels off`);
        }
      }
      out.blendCases = Object.keys(worst).length; out.blendWorst = Math.max(...Object.values(worst));
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 2 to 5 and 7
      const { ctx, page, errors } = await open(browser, '/playground/?room=shader&shp=interference#shader');
      await hold(page);
      const plain = await grab(page);
      await addLayer(page, 's:bands', 'screen', 0.6);
      await addLayer(page, 's:lamp', 'multiply', 0.8);
      await addLayer(page, 's:water', 'difference', 0.5);
      assert.equal((await value(page)).layers.length, 3);
      assert.match(await page.textContent('#shader .shd-count'), /3 of 7/);
      const three = await grab(page);
      assert.notEqual(three.hash, plain.hash, 'three layers change the frame');
      await page.selectOption('#shd-l2-blend', 'add'); await drawn(page);
      const added = await grab(page);
      assert.notEqual(added.hash, three.hash, 'a blend change changes the frame');
      await setMix(page, 2, 0.2); await drawn(page); const low = await grab(page);
      await setMix(page, 2, 0.9); await drawn(page); const high = await grab(page);
      assert.ok(high.mean > low.mean + 1, `more of an added layer is brighter (${low.mean.toFixed(1)} to ${high.mean.toFixed(1)})`);
      // the key: the added layer's own light now decides how much of it lands, so its dark parts add less
      await setKnob(page, 2, 0.4); await drawn(page); const keyed = await grab(page);
      assert.ok(keyed.mean < high.mean - 0.5, `a keyed layer adds less where it is dark (${high.mean.toFixed(1)} to ${keyed.mean.toFixed(1)})`);
      out.addMean = [+low.mean.toFixed(1), +high.mean.toFixed(1), +keyed.mean.toFixed(1)];
      // 3: the planted control
      await setMix(page, 1, 0); await drawn(page); const zero = await grab(page);
      await setMix(page, 1, 0.05); await drawn(page); const faint = await grab(page);
      await page.click('#shader [data-l-rm="1"]'); await drawn(page); const without = await grab(page);
      assert.equal((await value(page)).layers.length, 2);
      assert.equal(zero.hash, without.hash, 'a layer at mix 0 leaves the same bytes as the stack without it');
      assert.notEqual(faint.hash, without.hash, 'and a mix of 0.05 does not, so the check can tell');
      // 4: order: the top layer lowered under the other is a different frame, and raised back is the same frame
      const before = await grab(page);
      await page.click('#shader [data-l-lower="1"]'); await drawn(page);
      assert.deepEqual((await value(page)).layers.map((L) => L.src), ['s:water', 's:bands']);
      assert.notEqual((await grab(page)).hash, before.hash, 'order matters to the frame');
      await page.click('#shader [data-l-raise="0"]'); await drawn(page);
      assert.equal((await grab(page)).hash, before.hash, 'raised back, the frame is as it was');
      // 5: the link
      await page.waitForFunction(() => /[?&]ly=/.test(location.search));
      link = await page.evaluate(() => location.pathname + location.search + location.hash); linkedHash = before.hash; out.link = link.length;
      assert.equal(await page.evaluate(() => new URLSearchParams(location.search).get('ly')), 'screen.60.s:bands,add.90-40.s:water');
      // 7: frame time
      await addLayer(page, 'palette', 'overlay', 0.5); await addLayer(page, 's:lamp', 'lighten', 0.5);
      assert.equal((await value(page)).layers.length, 4);
      out.frameMs4At1280 = +(await page.evaluate(() => document.querySelector('#shader .rm-host').shaderMeasure(1280, 10))).toFixed(2);
      out.renderer = await page.evaluate(() => { const g = document.createElement('canvas').getContext('webgl'), e = g && g.getExtension('WEBGL_debug_renderer_info'); return e ? g.getParameter(e.UNMASKED_RENDERER_WEBGL) : 'unknown'; });
      assert.ok(out.frameMs4At1280 > 0 && Number.isFinite(out.frameMs4At1280), 'a frame time is measured');
      await page.click('#shader [data-run]'); await page.waitForFunction(() => +document.querySelector('#shader .rm-host').dataset.frameMs > 0, null, { timeout: 15000 });
      out.readoutMs = +(await page.evaluate(() => document.querySelector('#shader .rm-host').dataset.frameMs));
      assert.match(await page.textContent('#shader .shd-clock'), /ms a frame/);
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 5: the link in a new tab, paused at time 0 by reduced motion: the same layers and the same bytes
      const { ctx, page, errors } = await open(browser, link, { reducedMotion: 'reduce' });
      await page.waitForFunction(() => window.__rooms.handles.shader.value().layers.length === 2);
      assert.deepEqual((await value(page)).layers, [{ src: 's:bands', blend: 'screen', mix: 0.6, key: 0 }, { src: 's:water', blend: 'add', mix: 0.9, key: 0.4 }]);
      assert.deepEqual((await value(page)).makers, ['shader', 'shader']);
      await hold(page);
      assert.equal((await grab(page)).hash, linkedHash, 'the link opens the same frame');
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 6: estuaries: the blend's colours, the pen study's picture, the forge's line
      const { ctx, page, errors } = await open(browser, '/playground/?room=shader&shp=interference#shader');
      await page.click('#sx-start'); await page.waitForSelector('html[data-surface-page-ready]');
      await page.waitForFunction(() => +document.querySelector('#shader .rm-host').dataset.palette >= 2);
      await page.waitForFunction(() => document.querySelector('#sx-hosts [data-part="plot"] canvas.pl'));
      await page.evaluate(() => window.__rooms.send('forge', 'text', { text: 'Estuary' }));
      await page.waitForFunction(() => window.__rooms.handles.shader.value().text === 'Estuary');
      await hold(page);
      const plain = await grab(page), rows = {};
      for (const [k, src] of ['palette', 'pic:plot', 'text'].entries()) {
        await addLayer(page, src, 'normal', 0);
        const d = [];
        for (const m of [0, 0.25, 0.5, 1]) { await setMix(page, k, m); await drawn(page); d.push(+distance(await grab(page), plain).toFixed(2)); }
        rows[src] = d;
        assert.equal(d[0], 0, `${src} at mix 0 leaves the frame`);
        assert.ok(d[1] > 0 && d[2] > d[1] && d[3] > d[2], `${src} moves the frame further as its mix rises: ${d.join(', ')}`);
        await setMix(page, k, 0); await drawn(page);
      }
      assert.deepEqual((await value(page)).makers, ['blend', 'plot', 'forge'], 'each layer carries the module that makes it');
      out.estuary = rows;
      assert.match(await page.textContent('#shd-l1-src option:checked'), /pen study/i);
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 8: right edge
      const over = {};
      for (const width of [375, 583, 1280, 2560]) {
        const { ctx, page } = await open(browser, '/playground/?room=shader&ly=screen.50.s:bands,multiply.80.pic:loom,add.30.p:Gold%2520Ground%252C%2520Lamp%2520Moving#shader', { viewport: { width, height: 900 } });
        await page.waitForFunction(() => +document.querySelector('#shader .rm-host').dataset.layers === 3);
        const m = await page.evaluate(() => {
          const W = document.documentElement.clientWidth, bad = [];
          for (const el of document.querySelectorAll('#shader *')) {
            if (!el.checkVisibility?.() || el.closest('pre, textarea, .shd-gutter, select, option, optgroup')) continue;
            const r = el.getBoundingClientRect(); if (r.width && (r.right > W + 1 || r.left < -1)) bad.push(`${el.tagName.toLowerCase()}.${el.className || ''} ${Math.round(r.left)}..${Math.round(r.right)}`);
          }
          return { scroll: document.documentElement.scrollWidth - W, bad: bad.slice(0, 8), count: bad.length };
        });
        over[width] = m.count;
        assert.equal(m.scroll, 0, `no sideways scroll at ${width} px`);
        assert.deepEqual(m.bad, [], `nothing runs past the right edge at ${width} px`);
        await leave(ctx, page);
      }
      out.overEdge = over;
    }
    console.log('surface-rooms-shader-layers: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
