// Living neural, Seed sound, Music and Physics on the shell (4 October 2026), in Chrome at desktop
// and phone widths: one bar each, Undo and Redo over the settings in their inspectors, the settings
// kept across a reload, and Start fresh back to the first ones.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8814';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const BARS = {
  neural: ['Play', ['primary', 'undo', 'redo', 'export']],
  sound: ['Play', ['primary', 'undo', 'redo', 'export']],
  music: ['Play', ['primary', 'undo', 'redo', 'export']],
  discovery: ['Discover and verify', ['primary', 'undo', 'redo', 'export']],
};
const wait = (page, ms) => page.waitForTimeout(ms);
async function clickIn(page, sel) { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); }
const activeOf = (page, attr) => page.evaluate((a) => {
  const b = [...document.querySelectorAll(`[${a}]`)].find((x) => x.classList.contains('active') || x.getAttribute('aria-pressed') === 'true');
  return b ? b.getAttribute(a) : null;
}, attr);
async function setSeed(page, id, v) {
  await page.evaluate(([i, v]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

      for (const [source, [label, order]] of Object.entries(BARS)) {
        await page.goto(`${base}/studio.html?source=${source}`); await wait(page, 4000);
        const got = await page.evaluate(() => ({
          order: [...document.querySelectorAll('#inspector-actions > [data-action]')].map((b) => b.dataset.action),
          primary: (document.querySelector('#inspector-actions [data-action="primary"]') || {}).textContent,
        }));
        assert.deepEqual(got.order, order, `${tag} ${source} bar order`);
        assert.equal(got.primary, label, `${tag} ${source} main action`);
      }

      // Living neural: the instrument chip and the seed.
      await page.goto(`${base}/studio.html?source=neural`); await wait(page, 4000);
      const firstSeed = await page.inputValue('#neural-seed');
      await clickIn(page, '[data-neural-instrument="solid"]'); await wait(page, 1500);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1500);
      assert.equal(await activeOf(page, 'data-neural-instrument'), 'field', `${tag} Undo returns the field`);
      await clickIn(page, '[data-action="redo"]'); await wait(page, 1500);
      assert.equal(await activeOf(page, 'data-neural-instrument'), 'solid', `${tag} Redo brings the solid back`);
      await setSeed(page, 'neural-seed', 'kept-neural'); await wait(page, 1500);
      await page.reload(); await wait(page, 4500);
      assert.equal(await page.inputValue('#neural-seed'), 'kept-neural', `${tag} a reload keeps the neural seed`);
      assert.equal(await activeOf(page, 'data-neural-instrument'), 'solid', `${tag} and its instrument`);
      const fresh = page.locator('[data-action="fresh"]'); await fresh.scrollIntoViewIfNeeded(); await fresh.click(); await wait(page, 1500);
      assert.equal(await page.inputValue('#neural-seed'), firstSeed, `${tag} Start fresh returns the first seed`);
      assert.equal(await activeOf(page, 'data-neural-instrument'), 'field', `${tag} and the field`);

      // Seed sound: the seed.
      await page.goto(`${base}/studio.html?source=sound`); await wait(page, 4000);
      const soundSeed = await page.inputValue('#sound-seed');
      await setSeed(page, 'sound-seed', 'kept-sound'); await wait(page, 1500);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1500);
      assert.equal(await page.inputValue('#sound-seed'), soundSeed, `${tag} Undo returns the sound's first seed`);
      await clickIn(page, '[data-action="redo"]'); await wait(page, 1500);
      await page.reload(); await wait(page, 4500);
      assert.equal(await page.inputValue('#sound-seed'), 'kept-sound', `${tag} a reload keeps the sound seed`);

      // Music: the visual mode.
      await page.goto(`${base}/studio.html?source=music`); await wait(page, 5000);
      await clickIn(page, '[data-music-mode="harmonograph"]'); await wait(page, 1500);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1500);
      assert.equal(await activeOf(page, 'data-music-mode'), 'particles', `${tag} Undo returns the particles`);
      await clickIn(page, '[data-action="redo"]'); await wait(page, 1500);
      await page.reload(); await wait(page, 5500);
      assert.equal(await activeOf(page, 'data-music-mode'), 'harmonograph', `${tag} a reload keeps the music mode`);

      // Physics: a system brings its own terms; Undo returns the first system and its terms.
      await page.goto(`${base}/studio.html?source=discovery`); await wait(page, 4500);
      const sys0 = await activeOf(page, 'data-disc-system');
      const terms0 = await page.inputValue('#disc-terms');
      await clickIn(page, '#disc-systems [data-disc-system]:not(.active)'); await wait(page, 2000);
      const sys1 = await activeOf(page, 'data-disc-system');
      assert.notEqual(sys1, sys0);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 2000);
      assert.equal(await activeOf(page, 'data-disc-system'), sys0, `${tag} Undo returns the first system`);
      assert.equal(await page.inputValue('#disc-terms'), terms0, `${tag} and its terms`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio instruments: pass`);
      await ctx.close();
    }
  } catch (err) {
    failures++;
    console.error(err);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})();
