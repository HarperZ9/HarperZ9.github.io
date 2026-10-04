// The full Retro Engine in the Studio (4 October 2026). The author: "this page is the hub for where
// all of these modules should exist." Every control of retro.html's engine section must be in the
// Studio's Retro source (shown, in a section that opens, or shown on demand as on retro.html), the
// whole shader shelf must be there, the engine must park when another source takes the stage and
// come back, and a frame handed over from the Studio must arrive as the engine's upload.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8816';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
// Controls by key; a control shown on demand on retro.html (the six "your colours", shown when the
// palette is set to Your colours) counts as present when it is in the page under the same rule.
function controls(root) {
  const key = (el) => el.id ? '#' + el.id : (el.dataset.src ? `[data-src="${el.dataset.src}"]` : el.tagName.toLowerCase() + ':' + (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 40));
  const r = document.querySelector(root);
  return r ? [...r.querySelectorAll('button, input, select, textarea')].map(key) : [];
}
async function pick(page, source) {
  const sw = page.locator('#source-switch');
  if ((await sw.getAttribute('aria-expanded')) !== 'true') { await sw.scrollIntoViewIfNeeded(); await sw.click(); }
  const tab = page.locator(`#studio-source button[data-source="${source}"]`);
  await tab.waitFor({ state: 'visible', timeout: 5000 });
  await tab.click();
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

      await page.goto(`${base}/retro.html`); await wait(page, 4000);
      const want = [...new Set(await page.evaluate(controls, '#engine'))];
      assert.ok(want.length > 120, `${tag} retro.html has its engine controls (${want.length})`);

      await page.goto(`${base}/studio.html?source=retro`); await wait(page, 6000);
      const got = new Set([...(await page.evaluate(controls, '#retro-mount')), ...(await page.evaluate(controls, '.studio-retro-preview'))]);
      const missing = want.filter((k) => !got.has(k));
      assert.deepEqual(missing, [], `${tag} every retro.html engine control is in the Studio`);
      const presets = await page.evaluate(() => document.querySelectorAll('#re-preset optgroup:not([data-yours]) option').length);
      assert.ok(presets >= 254, `${tag} the whole shader shelf is in the Studio (${presets})`);
      assert.equal(await page.evaluate(() => document.getElementById('studio-canvas').dataset.retro !== undefined), true, `${tag} the stage shows the engine's own output`);
      await page.selectOption('#re-palette', 'yours');
      assert.equal(await page.locator('#re-yourpal-row .re-color').first().isVisible(), true, `${tag} Your colours shows its six colours on demand`);
      assert.doesNotMatch(await page.textContent('#src-retro'), /on its own page/, `${tag} no "on its own page" deferral`);

      // Another source takes the stage: the engine parks and gives the canvas back, then returns.
      await pick(page, 'sketch'); await wait(page, 1500);
      assert.equal(await page.evaluate(() => document.getElementById('studio-canvas').dataset.retro === undefined && document.querySelector('.studio-retro-preview').hidden), true, `${tag} the engine parks`);
      // Its keys stay quiet while parked: R (randomize) must not reach it.
      const code = await page.inputValue('#re-code');
      await page.locator('body').press('r'); await wait(page, 300);
      assert.equal(await page.inputValue('#re-code'), code, `${tag} R does nothing to a parked engine`);
      await pick(page, 'retro'); await wait(page, 2500);
      assert.equal(await page.evaluate(() => document.getElementById('studio-canvas').dataset.retro !== undefined), true, `${tag} the engine comes back`);

      // The Studio's To Retro hands the frame over in this page, as the engine's upload.
      await pick(page, 'sketch'); await wait(page, 1500);
      // On a phone, To Retro sits under the deck's More controls.
      await page.evaluate(() => { const d = document.getElementById('deck-more'); if (d) d.open = true; });
      await page.locator('#rt-retro').scrollIntoViewIfNeeded(); await page.locator('#rt-retro').click(); await wait(page, 4000);
      assert.equal(page.url().includes('studio.html'), true, `${tag} the hand-off stays in the Studio`);
      assert.equal(await page.getAttribute('.re-tab[data-src="upload"]', 'aria-selected'), 'true', `${tag} the frame arrives as the upload source`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio retro hub: pass`);
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
