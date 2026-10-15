// The Finish layer (studio-finish.js, 14 October 2026), at desktop and phone widths: raw-native's
// post stack laid over the stage. Chrome runs on SwiftShader (forced), so CI and a local run use
// the same software adapter. raw-native's roadmap M1 criterion 9 (the Studio layer): on the
// committed frame set (960 x 600, fixed seeds) every look's output, read back from the layer's own
// WebGPU canvas, is within one 8-bit code of the engine's CPU reference, and a control with a
// shifted reference fails. Also: the overlay covers exactly the source canvas, leaves for a source
// with its own surface and comes back, Off hides it, and without WebGPU the source draws as it is
// and the rail says why. No page or console errors. BROWSER=firefox runs the fallback path.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const browserLib = require('./lib/browser.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8807';
const OUT = process.env.FINISH_EVIDENCE || '';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false, checks: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true, checks: false },
];
const ARGS = ['--enable-unsafe-webgpu', '--enable-unsafe-swiftshader', '--use-webgpu-adapter=swiftshader'];

async function pick(page, source) {
  const sw = page.locator('#source-switch'); await sw.scrollIntoViewIfNeeded(); await sw.click();
  await page.locator(`#studio-source button[data-source="${source}"]`).click();
}
async function choose(page, look) {
  const det = page.locator('#finish-group');
  if (!(await det.evaluate((d) => d.open))) { const s = page.locator('#finish-group > summary'); await s.scrollIntoViewIfNeeded(); await s.click(); }
  const sel = page.locator('#finish-look'); await sel.scrollIntoViewIfNeeded(); await sel.selectOption(look);
  await page.waitForFunction((l) => {
    const f = window.__studioFinish; if (l === 'off') return !f || f.state().state === 'off';
    return f && f.state().chosen === l && f.state().state !== 'starting';
  }, look, { timeout: 120000 });
}
const finish = (page) => page.evaluate(() => window.__studioFinish.state());
const rects = (page) => page.evaluate(() => {
  const r = (id) => { const e = document.getElementById(id); if (!e) return null; const b = e.getBoundingClientRect(); return [b.left, b.top, b.width, b.height]; };
  return { canvas: r('studio-canvas'), overlay: r('finish-canvas'), hidden: !!(document.getElementById('finish-canvas') || {}).hidden };
});

(async () => {
  const launch = browserLib.name === 'chromium' ? { args: ARGS } : {};
  if (process.env.BROWSER_CHANNEL) launch.channel = process.env.BROWSER_CHANNEL;
  const browser = await browserLib.launch(launch);
  const evidence = { site: base, browser: browserLib.name, views: {} };
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`${base}/studio.html`); await page.waitForTimeout(4000);
      const gpu = await page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
      const rec = (evidence.views[view.name] = { gpu });
      await choose(page, 'classic');
      let st = await finish(page);
      if (!gpu) {
        assert.equal(st.state, 'unavailable', `${tag} without an adapter the layer stays off: ${JSON.stringify(st)}`);
        assert.match(await page.textContent('#finish-status'), /^Off: .*The source draws as it is\.$/, `${tag} the rail says why`);
        rec.fallback = st;
      } else {
        assert.equal(st.state, 'on', `${tag} the layer runs: ${JSON.stringify(st)}`);
        // The overlay shows once the layer has drawn a few frames over a source canvas on stage.
        const shown = await page.waitForFunction(() => { const s = window.__studioFinish.state(); return s.frames > 3 && s.overlay; }, null, { timeout: 60000 })
          .then(() => true, () => false);
        const g = await rects(page);
        assert.ok(shown && !g.hidden && g.overlay, `${tag} the overlay shows: ${JSON.stringify({ state: await finish(page), rects: g, source: await page.evaluate(() => window.__studioActiveSource) })}`);
        for (let i = 0; i < 4; i++) assert.ok(Math.abs(g.overlay[i] - g.canvas[i]) <= 1, `${tag} the overlay covers the source canvas: ${JSON.stringify(g)}`);
        assert.match(await page.textContent('#finish-status'), /^Classic tube on raw-native \d+\.\d+\.\d+ \(WebGPU\)/);
        rec.rects = g; rec.adapter = st.adapter;
        // A source with its own surface: the layer steps aside, and returns with the source canvas.
        await pick(page, 'viewer'); await page.waitForTimeout(800);
        assert.ok((await rects(page)).hidden, `${tag} the overlay hides for the Verified viewer`);
        await pick(page, 'atelier');
        await page.waitForFunction(() => !document.getElementById('finish-canvas').hidden, null, { timeout: 20000 });
        if (view.checks) {
          rec.checks = {};
          for (const look of ['classic', 'tube', 'film', 'dither']) {
            const r = await page.evaluate((l) => window.__studioFinish.check(l), look);
            rec.checks[look] = r;
            assert.ok(r.pass, `${tag} ${look}: every channel within one code of the CPU reference: ${JSON.stringify(r.worst)} over ${r.over}`);
            assert.equal(r.frames.length, 4, `${tag} ${look}: the four committed frames`);
            const c = await page.evaluate((l) => window.__studioFinish.check(l, { frames: ['bars'], control: true }), look);
            assert.ok(!c.pass && c.over > 0, `${tag} ${look}: the control with a shifted reference fails`);
            rec.checks[look + '-control'] = { pass: c.pass, over: c.over, maxCode: c.maxCode };
          }
          // The upload fallback (bytes read from the canvas, written as half floats) gives the same result.
          const viaBytes = await page.evaluate(() => window.__studioFinish.check('classic', { upload: 'bytes' }));
          rec.checks['classic-bytes'] = viaBytes;
          assert.ok(viaBytes.pass, `${tag} classic through the byte upload: ${JSON.stringify(viaBytes.worst)} over ${viaBytes.over}`);
          rec.uploads = (await finish(page)).uploads;
        }
        // Off: the overlay goes and the rail says so.
        await choose(page, 'off');
        assert.ok((await rects(page)).hidden, `${tag} Off hides the overlay`);
        assert.equal(await page.textContent('#finish-status'), 'Off: the source draws as it is.');
      }
      assert.deepEqual(errors, [], `${tag} no page or console errors`);
      await ctx.close();
      // Without WebGPU: the layer stays off and the source still draws.
      const ctx2 = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      await ctx2.addInitScript(() => { try { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }); } catch (_) {} });
      const p2 = await ctx2.newPage();
      const errors2 = [];
      p2.on('pageerror', (e) => errors2.push(String(e.message || e)));
      p2.on('console', (m) => { if (m.type() === 'error') errors2.push(m.text()); });
      await p2.goto(`${base}/studio.html`); await p2.waitForTimeout(4000);
      await choose(p2, 'film');
      const s2 = await finish(p2);
      assert.equal(s2.state, 'unavailable', `${tag} no WebGPU: the layer is off: ${JSON.stringify(s2)}`);
      assert.equal(await p2.textContent('#finish-status'), 'Off: this browser has no WebGPU. The source draws as it is.');
      const drawn = await p2.evaluate(() => {
        const c = document.getElementById('studio-canvas'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
        let lit = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) lit++;
        return lit / (d.length / 4);
      });
      assert.ok(drawn > 0.01, `${tag} no WebGPU: the source canvas still draws (${drawn})`);
      rec.noWebGPU = { state: s2.state, lit: drawn };
      assert.deepEqual(errors2, [], `${tag} no WebGPU: no page or console errors`);
      await ctx2.close();
      console.log(`${tag} ok${gpu ? ` on ${rec.adapter}` : ' (fallback only)'}`);
    }
  } catch (e) {
    failures++;
    console.error(e && e.stack || e);
  } finally {
    await browser.close();
  }
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(evidence, null, 1) + '\n');
  if (failures) { console.error('studio-finish: FAILED'); process.exit(1); }
  console.log('studio-finish: passed');
})();
