// The Gallery's whole print desk in the Studio (9 October 2026). Before, the Studio's Gallery had
// 6 controls against the page's desk and a button that left for gallery.html. This checks, at
// desktop and phone widths: every control of gallery.html's print desk is in the Studio's Gallery
// source (by id, else by label); the 95 instruments, the recipes and the effects are all there; a
// reroll draws a new plate and Undo brings the first one back pixel for pixel; a switch away and
// back keeps the plate; Send to Retro hands the plate over inside the Studio; no console errors.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
function controls(rootSel) {
  const root = document.querySelector(rootSel);
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return [...root.querySelectorAll('button, input, select, textarea, summary')].filter((el) => el.type !== 'hidden').map((el) => ({ id: el.id, label: label(el) }));
}
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return c.width + 'x' + c.height + ':' + [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
const pick = (page, s) => page.evaluate((s) => document.querySelector(`#studio-source button[data-source="${s}"]`).click(), s);

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    // The page's desk, as the reference.
    const ref = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ref.goto(`${base}/gallery.html`); await wait(ref, 3000);
    const page0 = await ref.evaluate(controls, '#printdesk');
    await ref.close();
    assert.ok(page0.length > 150, `gallery.html's desk has its controls (${page0.length})`);

    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await page.goto(`${base}/studio.html?source=gallery`); await wait(page, 4000);
        const got = await page.evaluate(controls, '#src-gallery');
        const ids = new Set(got.map((c) => c.id).filter(Boolean)), labels = new Set(got.map((c) => c.label));
        const missing = page0.filter((c) => !(c.id && ids.has(c.id)) && !labels.has(c.label));
        assert.deepEqual(missing, [], `${tag} every desk control from gallery.html is in the Studio`);
        const counts = await page.evaluate(() => ({ chips: document.querySelectorAll('#src-gallery #desk-chips .chip').length,
          recipes: document.querySelectorAll('#src-gallery #desk-recipes .chip').length, fx: document.querySelectorAll('#src-gallery #desk-fx button').length,
          leaves: [...document.querySelectorAll('#src-gallery button')].filter((b) => /gallery page/i.test(b.textContent)).length }));
        assert.equal(counts.chips, 95, `${tag} 95 instruments`);
        assert.ok(counts.recipes >= 10, `${tag} the recipes (${counts.recipes})`);
        assert.ok(counts.fx >= 20, `${tag} the effects rack (${counts.fx})`);
        assert.equal(counts.leaves, 0, `${tag} no button that leaves for the Gallery page`);

        const first = await frame(page);
        await page.evaluate(() => document.getElementById('desk-reroll').click()); await wait(page, 1200);
        const rolled = await frame(page);
        assert.notEqual(rolled, first, `${tag} a reroll draws a new plate`);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1200);
        assert.equal(await frame(page), first, `${tag} Undo brings the first plate back exactly`);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="redo"]').click()); await wait(page, 1200);
        assert.equal(await frame(page), rolled, `${tag} Redo brings the rerolled plate back exactly`);

        await pick(page, 'sketch'); await wait(page, 1500);
        assert.equal(await page.evaluate(() => !!document.getElementById('studio-canvas').closest('[data-hub]')), false, `${tag} another source gets the Studio's own canvas back`);
        await pick(page, 'gallery'); await wait(page, 2000);
        assert.equal(await frame(page), rolled, `${tag} a switch away and back keeps the plate`);

        await page.evaluate(() => document.getElementById('desk-retro').click()); await wait(page, 5000);
        assert.equal(await page.evaluate(() => window.__studioActiveSource), 'retro', `${tag} Send to Retro moves to the Retro source in the page`);
        assert.ok(new URL(page.url()).pathname.endsWith('/studio.html'), `${tag} and stays on studio.html`);
        assert.deepEqual(errors, [], `${tag} no console errors`);
        console.log(`${tag} studio gallery: pass (${got.length} controls, ${page0.length} on the page's desk)`);
      } catch (e) {
        failures++;
        console.error(`FAIL ${tag}`, e.message);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
