const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const out = '.superpowers/spatial-entry';
  mkdirSync(out, { recursive: true });
  try {
    for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      await page.goto(`${base}/gaussian-splats.html`);
      await page.evaluate(() => document.fonts.ready);
      const layout = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth + 1,
        image: document.querySelector('main img').naturalWidth,
        worlds: [...document.querySelectorAll('#worlds a')].map(a => a.href),
        pilotHidden: !document.querySelector('main details').open,
      }));
      assert.equal(layout.overflow, false, `${theme}/${width} overflow`);
      assert(layout.image > 0, 'Source artwork must load');
      assert.equal(layout.worlds.length, 3);
      assert(layout.pilotHidden);
      await page.screenshot({ path: `${out}/${theme}-${width}.png`, fullPage: true });
      await context.close();
    }
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const world of ['atlas', 'crystal-city', 'folded-light']) {
      await page.goto(`${base}/gaussian-splats.html`);
      await page.locator(`#worlds a[href$="world=${world}"]`).click();
      await page.waitForFunction(() => window.__spatialScene && document.querySelector('#sp-verdict').textContent === 'MATCH', null, { timeout: 45000 });
      assert.equal(new URL(page.url()).searchParams.get('world'), world);
      const scene = await page.evaluate(() => ({ count: window.__spatialScene.splatCount, title: window.__spatialScene.manifest?.title }));
      assert(scene.count > 0, `${world} must have drawable splats`);
      if (world === 'atlas') {
        assert.equal(await page.locator('#sp-scene option').count(), 27);
        await page.locator('#sp-scene').selectOption('scene-18');
        await page.waitForFunction(() => window.__spatialScene.currentMeta?.id === 'scene-18');
        await page.locator('#sp-depth').evaluate(el => { el.value = '0.65'; el.dispatchEvent(new Event('input', { bubbles: true })); });
        assert.equal(await page.evaluate(() => window.__spatialScene.controls.depthScale), .65);
      }
      await page.locator('#studio-canvas').screenshot({ path: `${out}/${world}-canvas.png` });
      console.log(world, scene);
    }
    assert.deepEqual(errors, []);
    await context.close();
    console.log('Spatial entry: themes, mobile, all three worlds and live Atlas controls passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
