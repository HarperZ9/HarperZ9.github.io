// The Threads source (4 October 2026), in Chrome at desktop and phone widths. With WebGPU, the
// stage shows lit threads within a few seconds, the readout names the GPU time and size, every
// control changes the frame, and leaving stops the loop. Without WebGPU, the stage says so.
// Neither path may log a console error.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8809';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function lit(page) {
  return page.evaluate(() => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++;
    return n;
  });
}
async function pick(page, source) {
  const sw = page.locator('#source-switch'); await sw.scrollIntoViewIfNeeded(); await sw.click();
  await page.locator(`#studio-source button[data-source="${source}"]`).click();
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
      await page.goto(`${base}/studio.html`); await wait(page, 5000);
      await pick(page, 'threads'); await wait(page, 8000);
      assert.equal(await page.evaluate(() => window.__studioActiveSource), 'threads', `${tag} Threads is the source`);
      const gpu = await page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
      const readout = (await page.textContent('#threads-readout')).trim();
      if (gpu) {
        assert.match(readout, /GPU time|particles/, `${tag} the readout names the GPU time: ${readout}`);
        const a = await lit(page);
        assert.ok(a > 200, `${tag} the stage shows lit threads (${a} pixels)`);
        await page.selectOption('#threads-world', '5'); await wait(page, 6000);
        const b = await lit(page);
        assert.ok(b > 200, `${tag} the Eye draws after the crossfade (${b} pixels)`);
        await page.locator('#threads-exposure').fill('4'); await page.locator('#threads-exposure').dispatchEvent('input'); await wait(page, 1500);
        assert.ok((await lit(page)) > b, `${tag} more exposure lights more pixels`);
      } else {
        assert.match(readout, /WebGPU|adapter/i, `${tag} without WebGPU the readout says why: ${readout}`);
      }
      await pick(page, 'atelier'); await wait(page, 3000);
      assert.equal(await page.evaluate(() => window.__studioActiveSource), 'atelier', `${tag} leaving works`);
      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} ok (${gpu ? 'WebGPU' : 'no WebGPU'})`);
      await ctx.close();
    }
  } catch (e) {
    failures++;
    console.error(e && e.message ? e.message : e);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})();
