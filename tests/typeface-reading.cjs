// Real font loading, readable no-JS specimens and unclipped character coverage.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8766';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme, javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`${base}/typeface.html`);
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.locator('#reading-sample').count(), 1, 'A real paragraph specimen must be readable without scripts');
      const proof = await page.evaluate(() => {
        const text = document.querySelector('#reading-sample');
        const display = document.querySelector('#display-sample');
        const nodes = [...document.querySelectorAll('main p, main h1, main h2, main a, main li')];
        return {
          textFont: getComputedStyle(text).fontFamily,
          displayFont: getComputedStyle(display).fontFamily,
          textSize: parseFloat(getComputedStyle(text).fontSize),
          loaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => f.family.replaceAll('"', '')),
          clipped: nodes.filter(n => { const r = n.getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; }).map(n => n.textContent.slice(0, 30)),
          background: getComputedStyle(document.body).backgroundColor,
        };
      });
      assert.match(proof.textFont, /Hanken Grotesk/);
      assert.match(proof.displayFont, /Conso/);
      assert(proof.loaded.includes('Hanken Grotesk') && proof.loaded.includes('Conso'), 'Both actual local fonts must load');
      assert(proof.textSize >= 18);
      assert.deepEqual(proof.clipped, [], `${theme}/${width}: content cannot be masked offscreen`);
      assert.equal(proof.background, theme === 'light' ? 'rgb(250, 250, 248)' : 'rgb(16, 20, 22)');
      await context.close();
    }
    console.log('Typeface: loaded fonts, no-JS reading, 320/1280 reflow and both themes passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
