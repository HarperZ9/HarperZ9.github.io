// Source-switch lifecycle smoke check, not a claim that every engine feature is tested.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/studio.html`);
    await page.waitForFunction(() => window.__studioActiveSource);
    const sources = await page.locator('#studio-source button[data-source]').evaluateAll(nodes => nodes.map(n => ({ id: n.dataset.source, panel: n.getAttribute('aria-controls') })));
    assert(sources.length >= 16, 'Must enumerate the entire current source menu');
    for (const source of sources) {
      const tab = page.locator(`#studio-source button[data-source="${source.id}"]`);
      await tab.click();
      await page.waitForFunction(id => window.__studioActiveSource === id, source.id);
      assert.equal(await tab.getAttribute('aria-selected'), 'true');
      assert(await page.locator(`#${source.panel}`).isVisible(), `${source.id} panel visible`);
      if (source.id === 'showcase') {
        await page.waitForFunction(() => !document.querySelector('#show-seed').disabled);
        const seed = page.locator('#show-seed');
        await seed.fill('runtime-check');
        await seed.dispatchEvent('change');
        await page.waitForFunction(async () => (await window.__studioShowcase.report())?.seed === 'runtime-check', null, { timeout: 30000 });
      }
      // Let source-local asynchronous startup surface uncaught errors before leaving.
      await page.waitForTimeout(500);
      console.log(`source ${source.id}: selected and mounted`);
    }
    await page.locator('#studio-source button[data-source="atelier"]').click();
    assert.deepEqual(errors, []);
    console.log(`${sources.length} source switches passed; no capture permissions or playback requested`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
