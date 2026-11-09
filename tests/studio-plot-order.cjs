// Plot maps' archive picker orders the corpus the way the archive page does (14 October 2026).
// The last control of session-archive.html missing from the Studio: "Order the archive". For each
// of the page's five orderings, the work ids in the Studio's picker, in order, equal the ids in the
// page's grid, in order. A band filter keeps the ordering (the page's order, narrowed to the band).
// Choosing an order never changes the work on the canvas. Desktop and phone; no page or console
// errors. The pages draw with 2D canvases only, so no GPU is involved.
const assert = require('node:assert/strict');
const browserLib = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8807';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const ORDERS = [['archived', 'As archived'], ['spectrum', 'By light'], ['tone', 'By tone'], ['colour', 'By colour'], ['kind', 'By kind']];

const pageIds = (page) => page.evaluate(() => [...document.querySelectorAll('[data-archive-grid] .arc-cell img')]
  .map((im) => (/(w\d{3})/.exec(im.getAttribute('src')) || [])[1]));
const studioIds = (page) => page.evaluate(() => [...document.querySelectorAll('#plot-work option')].map((o) => o.value));
const chosen = (page) => page.evaluate(() => document.getElementById('plot-work').value);

(async () => {
  // 2D canvases only: keep the browser off the GPU.
  const launch = browserLib.name === 'chromium' ? { args: ['--disable-gpu'] } : {};
  if (process.env.BROWSER_CHANNEL) launch.channel = process.env.BROWSER_CHANNEL;
  const browser = await browserLib.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const errors = [];
      const watch = (p) => { p.on('pageerror', (e) => errors.push(String(e.message || e))); p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); }); };

      // The archive page's own orders.
      const arc = await ctx.newPage(); watch(arc);
      await arc.goto(`${base}/session-archive.html`);
      await arc.waitForFunction(() => document.querySelectorAll('[data-archive-grid] .arc-cell').length > 100, null, { timeout: 60000 });
      const want = {};
      for (const [key, label] of ORDERS) {
        const b = arc.locator('[data-archive-order] button', { hasText: label });
        await b.scrollIntoViewIfNeeded(); await b.click();
        await arc.waitForFunction((l) => [...document.querySelectorAll('[data-archive-order] button')].some((x) => x.textContent === l && x.getAttribute('aria-pressed') === 'true'), label);
        want[key] = await pageIds(arc);
      }
      const works = await arc.evaluate(() => fetch('art/session-archive/manifest.json?v=20260805-range').then((r) => r.json()));
      await arc.close();

      // The Studio's picker: Plot maps, the Archive material.
      const page = await ctx.newPage(); watch(page);
      await page.goto(`${base}/studio.html?source=plotmaps`);
      await page.waitForFunction(() => window.__studioActiveSource === 'plotmaps', null, { timeout: 60000 });
      const mat = page.locator('[data-plot-material="archive"]'); await mat.scrollIntoViewIfNeeded(); await mat.click();
      await page.waitForFunction(() => document.querySelectorAll('#plot-work option').length > 100, null, { timeout: 60000 });
      await page.waitForTimeout(1500);
      const first = await chosen(page);
      for (const [key] of ORDERS) {
        const chip = page.locator(`[data-plot-order="${key}"]`);
        await chip.scrollIntoViewIfNeeded(); await chip.click();
        await page.waitForFunction((k) => document.querySelector(`[data-plot-order="${k}"]`).getAttribute('aria-pressed') === 'true', key);
        const got = await studioIds(page);
        assert.equal(got.length, want[key].length, `${tag} ${key}: the picker lists every work`);
        assert.deepEqual(got, want[key], `${tag} ${key}: the Studio's order is the archive page's`);
        assert.equal(await chosen(page), first, `${tag} ${key}: the work on the canvas stays chosen`);
      }
      // Control: two orders that must differ do differ (so the equality above is not vacuous).
      assert.notDeepEqual(want.spectrum, want.archived);
      assert.notDeepEqual(want.colour, want.tone);
      // A band narrows the ordering: By light within Warm is the page's By light, warm works only.
      const warm = new Set(works.works.filter((w) => w.measure.family === 'warm').map((w) => w.id));
      await page.locator('[data-plot-order="spectrum"]').click();
      const band = page.locator('[data-plot-band="warm"]'); await band.scrollIntoViewIfNeeded(); await band.click();
      await page.waitForFunction(() => document.querySelector('[data-plot-band="warm"]').classList.contains('active'));
      await page.waitForTimeout(300);
      assert.deepEqual(await studioIds(page), want.spectrum.filter((id) => warm.has(id)), `${tag} warm by light`);
      assert.deepEqual(errors, [], `${tag} no page or console errors`);
      await ctx.close();
      console.log(`${tag} studio plot order: pass`);
    }
  } catch (e) {
    failures++;
    console.error(e && e.stack || e);
  } finally {
    await browser.close();
  }
  if (failures) process.exit(1);
})();
