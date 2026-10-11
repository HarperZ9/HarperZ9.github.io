// The 2D Fractal source's Colouring group (9 October 2026). At desktop and phone widths:
//   - every colouring algorithm draws a frame of its own, and the trap controls show for traps;
//   - the density slider redraws;
//   - an imported gradient of three colours becomes three stops and redraws, and picking a named
//     palette brings back its six;
//   - colour cycling moves the frame on its own and stops when unticked;
//   - Undo returns the previous colouring.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const MODES = ['smooth', 'distance', 'trap-point', 'trap-line', 'trap-cross', 'trap-image', 'tia', 'histogram'];
const wait = (page, ms) => page.waitForTimeout(ms);
async function stage(page) {
  const png = await page.locator('#viewport-stage').screenshot();
  return require('crypto').createHash('sha256').update(png).digest('hex').slice(0, 16);
}
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  if (process.env.BROWSER_ARGS) launch.args = process.env.BROWSER_ARGS.split(' ');
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
        await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3500);
        const seen = new Set();
        for (const m of MODES) {
          await click(page, `[data-fcolour="${m}"]`); await wait(page, 900);
          const h = await stage(page);
          assert.ok(!seen.has(h), `${tag} ${m} draws a frame of its own`);
          seen.add(h);
          const trapShown = await page.evaluate(() => !document.getElementById('fractal-trap-row').hidden);
          assert.equal(trapShown, m.startsWith('trap-'), `${tag} trap controls ${m.startsWith('trap-') ? 'show' : 'hide'} for ${m}`);
        }
        await click(page, '[data-fcolour="smooth"]'); await wait(page, 800);
        const smooth = await stage(page);
        await page.evaluate(() => { const s = document.getElementById('fractal-density'); s.value = '2.5'; s.dispatchEvent(new Event('input', { bubbles: true })); });
        await wait(page, 800);
        assert.notEqual(await stage(page), smooth, `${tag} density redraws`);

        await page.fill('#fractal-gradient-text', '#0b1021 #f2b33d #c2185b');
        await click(page, '#fractal-gradient-import'); await wait(page, 900);
        assert.equal(await page.locator('#fractal-stops input[type=color]').count(), 3, `${tag} three stops after the import`);
        assert.match(await page.textContent('#fractal-gradient-status'), /Imported 3 stops/);
        const custom = await stage(page);
        await click(page, '[data-fractal-palette="ember"]'); await wait(page, 900);
        assert.equal(await page.locator('#fractal-stops input[type=color]').count(), 6, `${tag} a named palette brings back six stops`);
        assert.notEqual(await stage(page), custom, `${tag} and redraws`);

        await page.evaluate(() => { const b = document.getElementById('fractal-cycle'); b.checked = true; b.dispatchEvent(new Event('change', { bubbles: true })); });
        await wait(page, 300);
        const c1 = await stage(page); await wait(page, 700);
        const c2 = await stage(page);
        assert.notEqual(c1, c2, `${tag} cycling moves the colours`);
        await page.evaluate(() => { const b = document.getElementById('fractal-cycle'); b.checked = false; b.dispatchEvent(new Event('change', { bubbles: true })); });
        await wait(page, 600);
        const s1 = await stage(page); await wait(page, 600);
        assert.equal(await stage(page), s1, `${tag} unticking stops it`);

        await click(page, '[data-fcolour="distance"]'); await wait(page, 1200);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1200);
        assert.equal(await page.evaluate(() => document.querySelector('[data-fcolour].active').dataset.fcolour), 'smooth', `${tag} Undo returns the previous colouring`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio fractal colouring: pass`);
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
