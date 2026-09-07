const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 375, height: 812 } });
    await page.goto(`${process.env.SITE_BASE_URL || 'http://127.0.0.1:8766'}/system/discovery/lab.html`);
    assert.equal(await page.getByRole('main').getByRole('heading', { level: 1 }).count(), 1, 'The lab needs a main landmark containing its title and controls');
    await page.getByRole('main').getByLabel('candidate terms').fill('x^2, v^2');
    await page.getByRole('main').getByRole('button', { name: 'fit + verify', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('#result').textContent.trim().length > 0);
    assert.equal(await page.locator('#result').evaluate(n => n.closest('main') !== null), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log('Discovery landmark, controls, result and small-screen layout passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
