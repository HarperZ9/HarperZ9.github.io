const assert = require('node:assert/strict');
const { mkdirSync } = require('node:fs');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    for (const dpr of [1, 2]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: 'light', deviceScaleFactor: dpr });
    await page.goto(`${base}/studio.html?source=poster`);
    await page.waitForFunction(() => window.__studioPoster);
    await page.evaluate(() => document.fonts.ready);
    const state = () => page.evaluate(() => {
      const c = document.querySelector('#studio-canvas');
      const t = c.getContext('2d').getTransform();
      return { width: c.width, height: c.height, transform: [t.a, t.b, t.c, t.d, t.e, t.f] };
    });
    assert.deepEqual(await state(), { width: 1191, height: 1684, transform: [1, 0, 0, 1, 0, 0] }, 'Artwork must preserve poster dimensions and reset its drawing transform');
    await page.setViewportSize({ width: 1100, height: 800 });
    await page.waitForTimeout(500);
    assert.deepEqual(await state(), { width: 1191, height: 1684, transform: [1, 0, 0, 1, 0, 0] }, 'Stage resize must not replace the poster backing');
    const box = page.locator('[data-poster-box="0"]');
    await box.focus();
    const beforeMove = await (await page.waitForFunction(() => {
      const rect = document.querySelector('[data-poster-box="0"]')?.getBoundingClientRect();
      return rect?.width > 0 ? { x: rect.x } : false;
    })).jsonValue();
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(x => document.querySelector('[data-poster-box="0"]')?.getBoundingClientRect().x > x, beforeMove.x);
    const beforeSelection = await page.locator('#studio-canvas').evaluate(c => c.toDataURL());
    await page.locator('[data-poster-box="1"]').focus();
    assert.equal(await page.locator('#studio-canvas').evaluate(c => c.toDataURL()), beforeSelection, 'Selection outlines do not alter export pixels');
    mkdirSync('.superpowers/poster-canvas', { recursive: true });
    await page.screenshot({ path: `.superpowers/poster-canvas/light-${dpr}.png` });
    const renders = await page.evaluate(async () => {
      const poster = await import('/system/poster.js?v=20260907-direct-editor');
      const field = await import('/system/generative-field.js');
      const canvas = document.createElement('canvas');
      const state = poster.defaultPosterState('cache-check');
      let calls = 0;
      const deps = { renderSpecimen(...args) { calls++; return field.renderSpecimen(...args); } };
      poster.renderPoster(canvas, state, deps);
      state.blocks[0].text = 'Changed type';
      poster.renderPoster(canvas, state, deps);
      const afterType = calls;
      state.art.seed = 'different-artwork';
      poster.renderPoster(canvas, state, deps);
      return { afterType, afterSeed: calls, width: canvas.width, height: canvas.height };
    });
    assert.deepEqual(renders, { afterType: 1, afterSeed: 2, width: 1191, height: 1684 });
    console.log(`Poster DPR${dpr}: native size, transform, resize, keyboard, clean export and art cache passed`);
    await page.close();
    }
    for (const scheme of ['light', 'dark']) {
      const page = await browser.newPage({ viewport: { width: 320, height: 780 }, colorScheme: scheme });
      await page.goto(`${base}/studio.html?source=poster`);
      await page.waitForFunction(() => window.__studioPoster);
      assert(await page.locator('#src-poster').isVisible());
      assert.equal(await page.locator('#studio-analysis').evaluate(e => e.open), false);
      assert.equal(await page.locator('#rt-playframe').isVisible(), false);
      await page.locator('#poster-more-tools').click();
      assert(await page.locator('#rt-playframe').isVisible(), 'Secondary actions must remain accessible');
      await page.locator('#poster-more-tools').click();
      await page.locator('#studio-analysis > summary').click();
      assert(await page.locator('#sc-meters').isVisible(), 'Inspection remains available');
      const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth }));
      assert(widths.document <= widths.viewport + 1, `Poster ${scheme} must reflow at 320px`);
      await page.locator('#src-poster').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `.superpowers/poster-canvas/mobile-${scheme}.png` });
      await page.close();
    }
    console.log('Poster light/dark mobile reflow and secondary controls passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
