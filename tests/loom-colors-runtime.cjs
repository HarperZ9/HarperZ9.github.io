const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await page.goto(`${base}/loom.html`);
    await page.waitForFunction(() => document.querySelector('#wv-readout').textContent.includes('ends x'));
    await page.getByRole('button', { name: /^Start from Dish towel/ }).click();
    await page.locator('[data-view="draft"]').click();
    await page.locator('#wv-chart').focus(); await page.keyboard.press('Enter');
    const exportWif = async () => {
      const pending = page.waitForEvent('download'); await page.locator('#wv-wif').click();
      return (await readFile(await (await pending).path())).toString();
    };
    const before = await exportWif();
    const sections = text => Object.fromEntries(['THREADING', 'TIEUP', 'TREADLING', 'LIFTPLAN'].map(name => [name, text.split(`[${name}]`)[1]?.split('[')[0].trim()]));
    await page.locator('#wv-warp').selectOption('rust');
    const afterWarp = await exportWif();
    assert.notEqual(afterWarp, before, 'Color selection changes the exported palette');
    assert.deepEqual(sections(afterWarp), sections(before), 'Changing warp color must not regenerate away a hand-edited draft');
    await page.locator('#wv-weft').selectOption('ember');
    const afterWeft = await exportWif();
    assert.notEqual(afterWeft, afterWarp, 'Weft selection changes the palette');
    assert.deepEqual(sections(afterWeft), sections(before), 'Changing weft color must preserve every edited crossing');
    console.log('Loom color changes preserve the edited draft in WIF output');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
