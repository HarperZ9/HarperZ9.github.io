// Choosing shows (9 October 2026). The audit found two choices that showed nothing: 2D Fractal's
// set chips (Julia, Burning Ship) lit up but the stage kept the Mandelbrot until Render; and a
// Threads world pick took over 4 s to appear with no word in between. This checks, at desktop and
// phone widths, that a set chip draws that set within a second and Undo returns the Mandelbrot,
// and, where WebGPU answers, that the Threads readout says a world is on its way at once.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function stage(page) {
  const png = await page.locator('#viewport-stage').screenshot();
  return require('crypto').createHash('sha256').update(png).digest('hex').slice(0, 16);
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
      page.on('pageerror', (e) => errors.push(String(e.message)));
      try {
        await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3500);
        const mandel = await stage(page);
        await page.evaluate(() => document.querySelector('[data-ftype="julia"]').click()); await wait(page, 1000);
        const julia = await stage(page);
        assert.notEqual(julia, mandel, `${tag} the Julia chip draws a Julia set within a second`);
        assert.equal(await page.evaluate(() => document.querySelector('[data-ftype].active').dataset.ftype), 'julia', `${tag} with its chip lit`);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1200);
        assert.equal(await page.evaluate(() => document.querySelector('[data-ftype].active').dataset.ftype), 'mandelbrot', `${tag} Undo returns the Mandelbrot`);

        const gpu = await page.evaluate(() => !!navigator.gpu && navigator.gpu.requestAdapter().then((a) => !!a));
        if (gpu) {
          await page.goto(`${base}/studio.html?source=threads`); await wait(page, 5000);
          await page.evaluate(() => { const s = document.getElementById('threads-world'); s.value = '6'; s.dispatchEvent(new Event('change', { bubbles: true })); });
          await wait(page, 300);
          assert.match(await page.textContent('#threads-readout'), /Loading|Crossfading/, `${tag} the Threads readout says the world is on its way`);
        } else console.log(`${tag} no WebGPU adapter here: the Threads check is skipped`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio choosing shows: pass`);
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
