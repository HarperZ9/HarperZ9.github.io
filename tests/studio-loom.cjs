// The whole Loom in the Studio (9 October 2026). Before, the Studio's Loom had a seed, an
// instrument and a structure against loom.html's 43 controls. This checks, at desktop and phone
// widths: every control of loom.html's panel is in the Studio's Loom source (by id, else label);
// a structure change rebuilds the cloth and Undo brings the first cloth back pixel for pixel; the
// WIF export downloads from the bar; a switch away and back keeps the cloth; the Loom's Space key
// does nothing while another source is on stage; Send to Retro stays in the page; no errors.
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
    const ref = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ref.goto(`${base}/loom.html`); await wait(ref, 3000);
    const page0 = await ref.evaluate(controls, '#wv-panel');
    await ref.close();
    assert.ok(page0.length > 30, `loom.html's panel has its controls (${page0.length})`);

    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1, acceptDownloads: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await page.goto(`${base}/studio.html?source=loom`);
        await page.waitForSelector('#src-loom #wv-panel', { timeout: 20000 }); await wait(page, 2500);
        const got = await page.evaluate(controls, '#src-loom');
        const ids = new Set(got.map((c) => c.id).filter(Boolean)), labels = new Set(got.map((c) => c.label));
        const missing = page0.filter((c) => !(c.id && ids.has(c.id)) && !labels.has(c.label));
        assert.deepEqual(missing, [], `${tag} every control from loom.html is in the Studio`);

        // A still cloth: weaving off, so each rebuild draws the finished cloth at once.
        await page.evaluate(() => { const w = document.getElementById('wv-weaveit'); if (w.checked) w.click(); }); await wait(page, 800);
        const first = await frame(page);
        await page.evaluate(() => [...document.querySelectorAll('#wv-structures .re-chip')].find((c) => c.getAttribute('aria-checked') !== 'true').click()); await wait(page, 1200);
        const changed = await frame(page);
        assert.notEqual(changed, first, `${tag} a structure change rebuilds the cloth`);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click());
        // The rebuild lands within a frame or two; allow up to 3 s on a slow machine.
        for (let i = 0; i < 15 && (await frame(page)) !== first; i++) await wait(page, 200);
        assert.equal(await frame(page), first, `${tag} Undo brings the first cloth back exactly`);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="redo"]').click()); await wait(page, 1200);
        assert.equal(await frame(page), changed, `${tag} Redo brings the changed cloth back exactly`);

        const dl = page.waitForEvent('download', { timeout: 10000 });
        await page.evaluate(() => document.querySelector('#inspector-actions [data-export="wv-wif"]').click());
        assert.match((await dl).suggestedFilename(), /\.wif$/i, `${tag} the bar's WIF export downloads a .wif`);

        await pick(page, 'sketch'); await wait(page, 1500);
        assert.equal(await page.evaluate(() => !!document.getElementById('studio-canvas').closest('[data-hub]')), false, `${tag} another source gets the Studio's own canvas back`);
        const weave = await page.evaluate(() => document.getElementById('wv-weaveit').checked);
        await page.keyboard.press('Space'); await wait(page, 300);
        assert.equal(await page.evaluate(() => document.getElementById('wv-weaveit').checked), weave, `${tag} Space on another source leaves the Loom alone`);
        await pick(page, 'loom'); await wait(page, 2000);
        assert.equal(await frame(page), changed, `${tag} a switch away and back keeps the cloth`);

        await page.evaluate(() => document.getElementById('wv-send-retro').click()); await wait(page, 5000);
        assert.equal(await page.evaluate(() => window.__studioActiveSource), 'retro', `${tag} Send to Retro moves to the Retro source in the page`);
        assert.ok(new URL(page.url()).pathname.endsWith('/studio.html'), `${tag} and stays on studio.html`);
        assert.deepEqual(errors, [], `${tag} no console errors`);
        console.log(`${tag} studio loom: pass (${got.length} controls, ${page0.length} on loom.html's panel)`);
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
