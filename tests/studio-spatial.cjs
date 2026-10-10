// Spatial and Poster on the shell (4 October 2026), in Chrome at desktop and phone widths: one bar
// each, Undo and Redo over their settings, and the work kept across a reload.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8813';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
// A world drawn on a CI runner's software GPU can starve animation frames for many seconds, and
// Playwright's click waits for two still frames before it acts ("waiting for element to be stable",
// 15 s timeouts on main on 10 October 2026). The control is clicked as the browser dispatches a click,
// with no frame wait; the test then waits for the world itself.
async function clickIn(page, sel) {
  await page.locator(sel).first().evaluate((el) => { el.scrollIntoView({ block: 'nearest' }); el.click(); });
}
// Wait until the world says it has drawn: the status line names its receipt (or its failure), and no
// longer says it is loading. A world loads in seconds here and much longer on a runner that draws
// on the CPU, so the limit is 90 s. The world animates, so the frame itself is no signal.
async function settled(page, min = 1500) {
  await wait(page, min);
  await page.waitForFunction(() => {
    const t = (document.getElementById('sp-status') || {}).textContent || '';
    return !/loading/i.test(t) && /receipt|failed|Refusing/.test(t);
  }, null, { timeout: 90000, polling: 500 });
}
const order = (page) => page.evaluate(() => [...document.querySelectorAll('#inspector-actions > [data-action]')].map((b) => b.dataset.action));
const active = (page, attr) => page.getAttribute(`#src-spatial [${attr}].active`, attr);
const POSTER_SEED = '#poster-mount input[maxlength="40"]';
async function posterSeed(page, v) {
  await page.evaluate(([sel, v]) => { const e = document.querySelector(sel); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, [POSTER_SEED, v]);
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

      // Spatial: a world and a slider are steps; both survive a reload.
      await page.goto(`${base}/studio.html?source=spatial`); await settled(page, 4000);
      assert.deepEqual(await order(page), ['primary', 'undo', 'redo', 'export'], `${tag} Spatial bar order`);
      assert.equal(await page.textContent('#inspector-actions [data-action="primary"]'), 'Export run receipt');
      await clickIn(page, '[data-world="crystal-city"]'); await settled(page);
      assert.equal(await active(page, 'data-world'), 'crystal-city');
      await clickIn(page, '[data-action="undo"]'); await settled(page);
      assert.equal(await active(page, 'data-world'), 'atlas', `${tag} Undo returns the Atlas`);
      await clickIn(page, '[data-action="redo"]'); await settled(page);
      assert.equal(await active(page, 'data-world'), 'crystal-city', `${tag} Redo brings Crystal City back`);
      await page.reload(); await settled(page, 4000);
      assert.equal(await active(page, 'data-world'), 'crystal-city', `${tag} a reload keeps the world`);

      // Poster: a seed is a step; Undo puts the first poster back exactly; a reload keeps it.
      await page.goto(`${base}/studio.html?source=poster`); await wait(page, 4000);
      assert.deepEqual(await order(page), ['primary', 'undo', 'redo', 'export'], `${tag} Poster bar order`);
      // The rail keeps its own copy of each action the bar repeats (never remove a control).
      const railShown = await page.evaluate(() => ['poster-critique', 'poster-png', 'poster-plot-svg'].filter((id) => { const b = document.getElementById(id); return b && b.offsetParent; }));
      assert.deepEqual(railShown, ['poster-critique', 'poster-png', 'poster-plot-svg'], `${tag} the rail keeps the Poster actions`);
      const first = await frame(page);
      const firstSeed = await page.inputValue(POSTER_SEED);
      await posterSeed(page, 'kept-poster'); await wait(page, 1500);
      const seeded = await frame(page);
      assert.notEqual(seeded, first);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1500);
      assert.equal(await page.inputValue(POSTER_SEED), firstSeed, `${tag} Undo returns the first seed`);
      assert.equal(await frame(page), first, `${tag} and the first poster exactly`);
      await clickIn(page, '[data-action="redo"]'); await wait(page, 1500);
      assert.equal(await frame(page), seeded, `${tag} Redo brings the seeded poster back`);
      await page.reload(); await wait(page, 4500);
      assert.equal(await page.inputValue(POSTER_SEED), 'kept-poster', `${tag} a reload keeps the poster`);
      assert.equal(await frame(page), seeded, `${tag} and draws it the same`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio spatial and poster: pass`);
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
