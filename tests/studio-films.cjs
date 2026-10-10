// The Films panel and the Worlds film fallback (4 October 2026), in Chrome at desktop and phone
// widths. The panel builds seven players on first open, each with a poster, preload "none" and no
// autoplay; one plays when asked. With WebGPU hidden from the page, Worlds shows the film that
// holds the chosen world instead of a blank stage, and changing the world changes the film.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8809';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
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
      // Hide WebGPU so the fallback runs on every machine, with or without a GPU.
      await ctx.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined, configurable: true }); });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`${base}/studio.html`); await wait(page, 5000);

      // The Films panel: closed until asked, then seven quiet players.
      assert.equal(await page.locator('#studio-films video').count(), 0, `${tag} no players before the panel opens`);
      const sum = page.locator('#studio-films > summary'); await sum.scrollIntoViewIfNeeded(); await sum.click();
      await page.waitForFunction(() => document.querySelectorAll('#studio-films video').length === 7, null, { timeout: 10000 });
      const vids = await page.evaluate(() => [...document.querySelectorAll('#studio-films video')].map((v) => ({ preload: v.preload, autoplay: v.autoplay, poster: v.poster, paused: v.paused })));
      for (const v of vids) {
        assert.equal(v.preload, 'none', `${tag} preload none`);
        assert.equal(v.autoplay, false, `${tag} no autoplay`);
        assert.ok(v.paused, `${tag} nothing plays on its own`);
        const r = await page.request.get(v.poster); assert.equal(r.status(), 200, `${tag} poster ${v.poster}`);
      }
      if (!view.mobile) {
        const played = await page.evaluate(async () => {
          const v = document.querySelector('#studio-films video'); v.muted = true;
          try { await v.play(); } catch (e) { return String(e); }
          await new Promise((r) => setTimeout(r, 2500));
          const t = v.currentTime; v.pause(); return t;
        });
        assert.ok(typeof played === 'number' && played > 0.3, `${tag} a film plays when asked (${played})`);
      }

      // Worlds without WebGPU: the film for the chosen world, not a blank stage.
      await pick(page, 'worlds');
      await page.waitForSelector('#viewport-stage .sf-fallback video', { timeout: 20000 });
      assert.match(await page.textContent('#worlds-readout'), /no WebGPU/, `${tag} the readout says why`);
      const film = () => page.getAttribute('#viewport-stage .sf-fallback', 'data-film');
      await page.selectOption('#worlds-world', 'morphogen'); await wait(page, 500);
      assert.equal(await film(), 'study-morphogen', `${tag} Morphogen shows its study`);
      await page.selectOption('#worlds-world', 'swing'); await wait(page, 500);
      assert.equal(await film(), 'one-step-threads', `${tag} The swing shows the threads film`);
      await pick(page, 'atelier'); await wait(page, 1500);
      assert.equal(await page.locator('#viewport-stage .sf-fallback').count(), 0, `${tag} leaving removes the film`);
      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} ok`);
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
