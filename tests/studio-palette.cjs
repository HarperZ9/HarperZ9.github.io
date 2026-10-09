// Search and keys (9 October 2026). The audit counted about a thousand controls over 27 sources with
// no way to find one, and keys spread across the tools with no list. This checks, at desktop and
// phone widths: Ctrl+K opens the search; a control's name finds it in another source and Enter
// switches there and runs it; a source's name opens that source; "/" opens the search; "?" lists
// the keys of the whole Studio and of the source on stage; Escape closes; no page errors.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);

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
      page.on('pageerror', (e) => errors.push(String(e.message)));
      try {
        await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3000);
        await page.keyboard.press('Control+k'); await wait(page, 200);
        assert.ok(await page.evaluate(() => document.querySelector('dialog.studio-palette').open), `${tag} Ctrl+K opens the search`);
        await page.keyboard.type('julia'); await wait(page, 200);
        assert.match(await page.textContent('#studio-palette-list li'), /Julia/, `${tag} "julia" finds the Julia control`);
        await page.keyboard.press('Enter'); await wait(page, 1500);
        const after = await page.evaluate(() => ({ src: window.__studioActiveSource, chip: document.querySelector('[data-ftype].active').dataset.ftype }));
        assert.deepEqual(after, { src: 'fractal', chip: 'julia' }, `${tag} Enter switches to 2D Fractal and picks Julia`);
        await page.keyboard.press('/'); await wait(page, 200);
        await page.keyboard.type('voxels'); await page.keyboard.press('Enter'); await wait(page, 2000);
        assert.equal(await page.evaluate(() => window.__studioActiveSource), 'voxels', `${tag} "/" then a source's name opens it`);
        await page.keyboard.press('?'); await wait(page, 200);
        const keys = await page.evaluate(() => ({ open: !!document.querySelector('dialog.studio-keys[open]'), rows: document.querySelectorAll('dialog.studio-keys dt').length, text: document.querySelector('dialog.studio-keys').textContent }));
        assert.ok(keys.open && keys.rows >= 20, `${tag} "?" lists the keys (${keys.rows})`);
        assert.match(keys.text, /Undo/, `${tag} the list holds the Studio's own keys`);
        await page.keyboard.press('Escape'); await wait(page, 200);
        assert.equal(await page.evaluate(() => !!document.querySelector('dialog[open]')), false, `${tag} Escape closes`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio search and keys: pass`);
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
