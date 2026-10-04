// The Worlds source (4 October 2026), in Chrome at desktop and phone widths. With WebGPU, the
// stage shows a rendered world, a wheel-click drag turns it, the wheel zooms, W flies, and the
// world picker changes the scene. Without WebGPU, the stage says so. No console errors either way.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8809';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
const hash = (page) => page.evaluate(() => {
  const c = document.getElementById('studio-canvas');
  const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  let s = 0, lit = 0;
  for (let i = 0; i < d.length; i += 4) { s = (s * 31 + d[i] + d[i + 2]) >>> 0; if (d[i] + d[i + 1] + d[i + 2] > 60) lit++; }
  return { s, lit };
});
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
      await pick(page, 'worlds');
      await page.waitForFunction(() => !/starting/.test(document.getElementById('worlds-readout').textContent), null, { timeout: 120000 });
      await wait(page, 1000);
      assert.equal(await page.evaluate(() => window.__studioActiveSource), 'worlds', `${tag} Worlds is the source`);
      const gpu = await page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
      const readout = (await page.textContent('#worlds-readout')).trim();
      if (gpu) {
        assert.match(readout, /rendered at/, `${tag} the readout names the render size: ${readout}`);
        await page.locator('#worlds-motion').fill('0'); await page.locator('#worlds-motion').dispatchEvent('input');
        await wait(page, 300);
        const a = await hash(page);
        assert.ok(a.lit > 500, `${tag} the stage shows a lit world (${a.lit})`);
        if (!view.mobile) {
          const box = await page.locator('#viewport-stage').boundingBox();
          const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
          await page.mouse.move(cx, cy); await page.mouse.down({ button: 'middle' });
          await page.mouse.move(cx + 150, cy + 20, { steps: 6 }); await page.mouse.up({ button: 'middle' });
          await wait(page, 300);
          const b = await hash(page);
          assert.notEqual(b.s, a.s, `${tag} a wheel-click drag turns the world`);
          await page.mouse.wheel(0, -300); await wait(page, 300);
          assert.notEqual((await hash(page)).s, b.s, `${tag} the wheel zooms`);
        }
        const before = await hash(page);
        await page.selectOption('#worlds-world', 'swing'); await wait(page, 2500);
        assert.notEqual((await hash(page)).s, before.s, `${tag} the picker changes the world`);
      } else {
        assert.match(readout, /WebGPU|adapter/i, `${tag} without WebGPU the readout says why: ${readout}`);
      }
      await pick(page, 'atelier'); await wait(page, 2000);
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
