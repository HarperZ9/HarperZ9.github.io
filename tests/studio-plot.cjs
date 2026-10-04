// Plot maps and Voxels on the shell (4 October 2026), in Chrome at desktop and phone widths: the
// bar in its order, Undo and Redo back to the exact earlier pixels, and the work kept across a
// reload.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
async function clickIn(page, sel) { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); }
const order = (page) => page.evaluate(() => [...document.querySelectorAll('#inspector-actions > [data-action]')].map((b) => b.dataset.action));

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

      // Plot maps.
      await page.goto(`${base}/studio.html?source=plotmaps`); await wait(page, 4000);
      assert.deepEqual(await order(page), ['primary', 'undo', 'redo', 'export', 'pin'], `${tag} Plot maps bar order`);
      // Opened by link, the sheet is on the canvas (a boot resize used to clear it) and is the
      // same sheet a redraw of these settings gives.
      const sheet = await frame(page);
      await clickIn(page, '[data-action="primary"]'); await wait(page, 2500);
      assert.equal(await frame(page), sheet, `${tag} ?source=plotmaps shows its sheet, the same as a redraw`);
      await clickIn(page, '[data-plot-study="moire"]'); await wait(page, 2000);
      const moire = await frame(page);
      assert.notEqual(moire, sheet);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 2500);
      assert.equal(await frame(page), sheet, `${tag} Undo puts the earlier sheet back exactly`);
      assert.equal(await page.getAttribute('[data-plot-study].active', 'data-plot-study'), 'auto');
      await clickIn(page, '[data-action="redo"]'); await wait(page, 2500);
      assert.equal(await frame(page), moire, `${tag} Redo brings the moire sheet back exactly`);
      await page.reload(); await wait(page, 4500);
      assert.equal(await page.getAttribute('[data-plot-study].active', 'data-plot-study'), 'moire', `${tag} a reload keeps the study`);
      assert.equal(await frame(page), moire, `${tag} and the same sheet`);

      // Voxels: an edit, a turn, Undo and Redo, then a reload.
      await page.goto(`${base}/studio.html?source=voxels`); await wait(page, 4000);
      assert.deepEqual(await order(page), ['primary', 'undo', 'redo', 'export', 'pin'], `${tag} Voxels bar order`);
      const build = await frame(page);
      await clickIn(page, '[data-action="primary"]'); await wait(page, 1500);
      assert.equal(await frame(page), build, `${tag} ?source=voxels shows its build, the same as a rebuild`);
      await clickIn(page, '#voxel-turn-l'); await wait(page, 1200);
      const turned = await frame(page);
      assert.notEqual(turned, build);
      await clickIn(page, '[data-voxel-mode="chisel"]');
      await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
      const b = await page.locator('#studio-canvas').boundingBox();
      await page.mouse.click(b.x + b.width * 0.5, b.y + b.height * 0.45); await wait(page, 1200);
      const chiselled = await frame(page);
      assert.notEqual(chiselled, turned, `${tag} the chisel cut a voxel`);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1200);
      assert.equal(await frame(page), turned, `${tag} Undo takes the cut back exactly`);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1200);
      assert.equal(await frame(page), build, `${tag} and then the turn`);
      await clickIn(page, '[data-action="redo"]'); await clickIn(page, '[data-action="redo"]'); await wait(page, 1500);
      assert.equal(await frame(page), chiselled, `${tag} Redo twice brings both back`);
      await page.reload(); await wait(page, 4500);
      assert.equal(await frame(page), chiselled, `${tag} a reload keeps the build, its turn and its cut`);
      const fresh = page.locator('[data-action="fresh"]'); await fresh.scrollIntoViewIfNeeded(); await fresh.click(); await wait(page, 1500);
      assert.equal(await frame(page), build, `${tag} Start fresh returns to the seed's own build`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio plot maps and voxels: pass`);
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
