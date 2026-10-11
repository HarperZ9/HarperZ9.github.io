// The stage gets the room (9 October 2026). The audit measured the stage at 29% of a 1440 x 900
// window. This checks: on a desktop the stage is at least half the window on making sources (1440 x
// 900 and 1920 x 1080); Showcase keeps its readings open; the Readings button opens and folds the
// column and the choice survives a reload; on a phone the readings sit below as before.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const { until } = require('./lib/studio-wait.cjs');
// The stage has reached its layout: painted, and the readings column in its state for this source.
const laidOut = (page, src) => until(page, (s) => window.__studioActiveSource === s && document.getElementById('viewport-stage').classList.contains('is-painted') && document.getElementById('readings-toggle') !== null, src);
const toggled = (page, collapsed) => until(page, (c) => document.querySelector('.studio-app').classList.contains('readings-collapsed') === c, collapsed);
const share = (page) => page.evaluate(() => { const s = document.getElementById('viewport-stage').getBoundingClientRect(); return s.width * s.height / (innerWidth * innerHeight); });
const collapsed = (page) => page.evaluate(() => document.querySelector('.studio-app').classList.contains('readings-collapsed'));

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  const errors = [];
  try {
    for (const [w, h] of [[1440, 900], [1920, 1080]]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(String(e.message)));
      for (const src of ['atelier', 'sketch', 'retro']) {
        await page.goto(`${base}/studio.html?source=${src}`); await laidOut(page, src);
        const s = await share(page);
        assert.ok(s >= 0.5, `[${w}] ${src}: the stage is ${(s * 100).toFixed(1)}% of the window, under half`);
      }
      await page.goto(`${base}/studio.html?source=showcase`); await laidOut(page, 'showcase');
      assert.equal(await collapsed(page), false, `[${w}] Showcase keeps its readings open`);
      await page.goto(`${base}/studio.html?source=sketch`); await laidOut(page, 'sketch');
      assert.equal(await collapsed(page), true);
      await page.click('#readings-toggle'); await toggled(page, false);
      assert.equal(await collapsed(page), false, `[${w}] the Readings button opens the column`);
      await page.reload(); await laidOut(page, 'sketch');
      assert.equal(await collapsed(page), false, `[${w}] and the choice survives a reload`);
      await page.click('#readings-toggle'); await toggled(page, true);
      assert.equal(await collapsed(page), true, `[${w}] and folds it again`);
      console.log(`[${w}x${h}] studio layout: pass`);
      await ctx.close();
    }
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    await page.goto(`${base}/studio.html?source=sketch`); await laidOut(page, 'sketch');
    assert.equal(await page.isVisible('#readings-toggle'), false, '[phone] no Readings strip on a phone');
    assert.ok(await page.isVisible('#studio-frame'), '[phone] the readings sit below as before');
    await ctx.close();
    assert.deepEqual(errors, [], 'no page errors');
    console.log('[phone] studio layout: pass');
  } catch (e) {
    failures++;
    console.error('FAIL', e.message);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
