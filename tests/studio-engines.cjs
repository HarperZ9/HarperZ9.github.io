// The eight media engine surfaces on the shell (4 October 2026), in Chrome at desktop and phone
// widths: one bar each, settings kept through a switch, Undo and a reload, and the export with a
// receipt from the bar.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8812';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const SURFACES = {
  retro: { order: ['primary', 'undo', 'redo', 'export'], primary: 'Export frame and receipt' },
  gallery: { order: ['primary', 'undo', 'redo', 'export'], primary: 'Export frame and receipt' },
  loom: { order: ['primary', 'undo', 'redo', 'export'], primary: 'Export frame and receipt' },
  type: { order: ['primary', 'undo', 'redo', 'export'], primary: 'Export frame and receipt' },
  raw: { order: ['primary', 'undo', 'redo', 'export'], primary: 'Export frame and receipt' },
  brender: { order: ['primary', 'export'], primary: 'Export frame and receipt' },
  revival: { order: ['primary', 'export'], primary: 'Export frame and receipt' },
  splats: { order: ['primary', 'export'], primary: 'Open in Spatial' },
};
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
async function pick(page, source) {
  const sw = page.locator('#source-switch'); await sw.scrollIntoViewIfNeeded(); await sw.click();
  await page.locator(`#studio-source button[data-source="${source}"]`).click();
}
async function setValue(page, id, value, event) {
  await page.evaluate(([i, v, ev]) => { const e = document.getElementById(i); e.value = v; e.dispatchEvent(new Event(ev, { bubbles: true })); }, [id, value, event]);
}
async function clickIn(page, sel) { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); }

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1, acceptDownloads: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3000);

      // Every surface: one bar, in one order, and the original export not shown twice.
      for (const [id, want] of Object.entries(SURFACES)) {
        await pick(page, id); await wait(page, id === 'raw' ? 6000 : 3000);
        const got = await page.evaluate(() => ({
          order: [...document.querySelectorAll('#inspector-actions > [data-action]')].map((b) => b.dataset.action),
          primary: (document.querySelector('#inspector-actions [data-action="primary"]') || {}).textContent,
          shown: [...document.querySelectorAll('#engine-mount button')].filter((b) => b.offsetParent).map((b) => b.textContent),
        }));
        assert.deepEqual(got.order, want.order, `${tag} ${id} bar order`);
        assert.equal(got.primary, want.primary, `${tag} ${id} main action`);
        assert.ok(!got.shown.includes(want.primary === 'Open in Spatial' ? 'Open the receipted scenes in Spatial' : 'Export frame and receipt'), `${tag} ${id}: the bar's action is not shown twice`);
      }

      // Gallery: a seed survives a switch, Undo returns the first plate exactly, a reload keeps it.
      // A fresh page, so the stage is sized by the Gallery alone (a surface visited before, such as
      // RAW, can leave the backing at another size until the next redraw).
      await page.goto(`${base}/studio.html?source=gallery`); await wait(page, 3500);
      const plate = await frame(page);
      await setValue(page, 'me-gallery-seed', 'kept-seed', 'change'); await wait(page, 2500);
      const seeded = await frame(page);
      assert.notEqual(seeded, plate);
      await pick(page, 'sketch'); await wait(page, 1500);
      await pick(page, 'gallery'); await wait(page, 3000);
      assert.equal(await page.inputValue('#me-gallery-seed'), 'kept-seed', `${tag} the Gallery seed survives a switch`);
      assert.equal(await frame(page), seeded, `${tag} with the same plate`);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 3000);
      assert.equal(await page.inputValue('#me-gallery-seed'), 'folded-light', `${tag} Undo returns the Gallery's first seed`);
      assert.equal(await frame(page), plate, `${tag} and its plate exactly`);
      await clickIn(page, '[data-action="redo"]'); await wait(page, 3000);
      assert.equal(await frame(page), seeded, `${tag} Redo brings the seeded plate back`);

      // Retro and Type forge keep their settings across a reload.
      await pick(page, 'retro'); await wait(page, 3000);
      await setValue(page, 'me-retro-palette', 'gameboy', 'input'); await wait(page, 800);
      await pick(page, 'type'); await wait(page, 3000);
      await setValue(page, 'me-type-text', 'Kept', 'input'); await wait(page, 1500);
      await page.goto(`${base}/studio.html?source=retro`); await wait(page, 4000);
      assert.equal(await page.inputValue('#me-retro-palette'), 'gameboy', `${tag} a reload keeps the Retro palette`);
      await page.goto(`${base}/studio.html?source=type`); await wait(page, 4000);
      assert.equal(await page.inputValue('#me-type-text'), 'Kept', `${tag} a reload keeps the Type forge text`);
      await page.goto(`${base}/studio.html?source=gallery`); await wait(page, 4000);
      assert.equal(await page.inputValue('#me-gallery-seed'), 'kept-seed', `${tag} a reload keeps the Gallery seed`);

      // The bar's main action is the export with a receipt.
      const download = page.waitForEvent('download', { timeout: 15000 });
      await clickIn(page, '[data-action="primary"]');
      const file = await download;
      assert.match(file.suggestedFilename(), /\.(png|json|zip)$/, `${tag} the export downloads (${file.suggestedFilename()})`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio engine surfaces: pass`);
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
