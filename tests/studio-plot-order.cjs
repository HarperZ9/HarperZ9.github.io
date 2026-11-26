// Plot maps' archive picker orders the corpus the way the archive page does (14 October 2026).
// The last control of session-archive.html missing from the Studio: "Order the archive". For each
// of the page's five orderings, the work ids in the Studio's picker, in order, equal the ids in the
// page's grid, in order. A band filter keeps the ordering (the page's order, narrowed to the band).
// Choosing an order never changes the work on the canvas. Desktop and phone; no page or console
// errors. The pages draw with 2D canvases only, so no GPU is involved.
//
// Why the chips are pressed from the keyboard (15 November 2026). Choosing a material is a making action, so the
// Studio folds its readings panel and opens it again after 4 s of quiet (QUIET_MS in system/studio-readings.js).
// On a phone-sized page that fold is about 1,400 px of page height, and the stage is sticky over the controls. The
// test used to sleep 1.5 s and then click each chip with the pointer, which sat inside that 4 s window: on a loaded
// runner the catalogue took longer to fill, the first click met the panel opening, the page's geometry changed
// between Playwright's hit test and the press, the press landed off the chip, and the wait for aria-pressed ran
// out (Firefox, phone, main run 43679620109; passed unchanged on a rerun). The order of the list is what this test
// holds, so it now waits for the readings to be open again (the named signal the sleep stood in for) and presses
// each chip with focus and Enter, which reaches the same handler through a real key press and does not depend on
// where the chip is on the screen.
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
const press = async (page, chip) => { await chip.focus(); await page.keyboard.press('Enter'); };

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

      // The archive fragment's own orders.
      const arc = await ctx.newPage(); watch(arc);
      await arc.goto(`${base}/system/studio-fragments/session-archive.htm`);
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
      // the material click folded the readings; they open again once the page has been quiet, and the layout is then at rest
      await page.waitForFunction(() => document.getElementById('studio-panel').dataset.readings === 'open');
      const first = await chosen(page);
      for (const [key] of ORDERS) {
        const chip = page.locator(`[data-plot-order="${key}"]`);
        await press(page, chip);
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
      await press(page, page.locator('[data-plot-order="spectrum"]'));
      await page.waitForFunction(() => document.querySelector('[data-plot-order="spectrum"]').getAttribute('aria-pressed') === 'true');
      // the picker rebuilds its list and marks the band in one step, so the band's mark means the list is the new one
      await press(page, page.locator('[data-plot-band="warm"]'));
      await page.waitForFunction(() => document.querySelector('[data-plot-band="warm"]').classList.contains('active'));
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
