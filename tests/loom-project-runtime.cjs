const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/loom.html`);
    await page.waitForFunction(() => document.querySelector('#wv-readout').textContent.includes('ends x'));
    assert.equal(await page.getByRole('button', { name: 'Save project', exact: true }).count(), 1, 'The actual draft needs a portable save, not a controls-only setup');
    await page.locator('#wv-rack-weave').evaluate(e => e.open = true);
    await page.locator('#wv-weaveit').uncheck();
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 640; c.height = 400;
      const x = c.getContext('2d'); x.fillStyle = '#bc304a'; x.fillRect(0, 0, 640, 400);
      x.fillStyle = '#19a5bd'; x.fillRect(80, 110, 310, 260); return c.toDataURL();
    });
    await page.locator('#wv-file').setInputFiles({ name: 'weave.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
    await page.waitForFunction(() => document.querySelector('#wv-status').textContent.includes('your image'));
    await page.getByRole('button', { name: /^Start from Dish towel/ }).click();
    await page.locator('[data-view="draft"]').click();
    await page.locator('#wv-chart').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#wv-status').textContent.startsWith('edited:'));
    const pixels = () => page.locator('#wv-out').evaluate(c => c.toDataURL());
    const before = await pixels();
    const download = async selector => {
      const waiting = page.waitForEvent('download'); await page.locator(selector).click();
      return readFile(await (await waiting).path());
    };
    const wifBefore = await download('#wv-wif');
    const bytes = await download('#wv-project-save');
    await page.locator('#wv-structures [data-id="jacquard"]').click();
    const originalSourceJacquard = await pixels();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#wv-readout').textContent.includes('ends x'));
    const open = async buffer => {
      await page.locator('#wv-project-file').setInputFiles({ name: 'loom.json', mimeType: 'application/json', buffer });
    };
    await open(bytes);
    await page.waitForFunction(() => document.querySelector('#wv-project-status')?.dataset.state === 'ready');
    assert.equal(await pixels(), before, 'Edited draft and original colors render identically after reload');
    assert.equal((await download('#wv-wif')).toString(), wifBefore.toString(), 'Hand edits survive in the interoperable WIF export');
    assert.equal(await page.locator('[data-view="draft"]').getAttribute('aria-checked'), 'true');
    await page.locator('#wv-chart').focus(); await page.keyboard.press('Enter');
    assert.notEqual(await pixels(), before, 'Reopened draft is still editable');
    const edited = await pixels();
    await open(Buffer.from('{"schema":"zentropy.loom","version":99}'));
    await page.waitForFunction(() => document.querySelector('#wv-project-status')?.dataset.state === 'error');
    assert.equal(await pixels(), edited, 'Malformed files do not replace the active draft');
    await page.locator('#wv-rack-weave').evaluate(e => e.open = true);
    await page.locator('#wv-weaveit').uncheck();
    await page.locator('#wv-structures [data-id="jacquard"]').click();
    const jacquard = await pixels(), jacquardFile = await download('#wv-project-save');
    assert.equal(jacquard, originalSourceJacquard, 'Changing structure after reopen uses the original source image, not the default plate');
    await page.reload(); await page.waitForFunction(() => document.querySelector('#wv-readout').textContent.includes('ends x'));
    await open(jacquardFile);
    await page.waitForFunction(() => document.querySelector('#wv-project-status')?.dataset.state === 'ready');
    assert.equal(await pixels(), jacquard, 'Per-thread Jacquard survives even though WIF cannot represent it');
    await page.evaluate(() => {
      const decode = Image.prototype.decode;
      Image.prototype.decode = function () {
        Image.prototype.decode = decode;
        return new Promise((resolve, reject) => { window.resumeLoomImage = () => decode.call(this).then(resolve, reject); });
      };
    });
    await open(bytes);
    await page.waitForFunction(() => typeof window.resumeLoomImage === 'function');
    await page.locator('#wv-structures [data-id="plain"]').click();
    const newerPixels = await pixels();
    await page.evaluate(() => window.resumeLoomImage());
    await page.waitForFunction(() => document.querySelector('#wv-project-status')?.dataset.state === 'cancelled');
    assert.equal(await pixels(), newerPixels, 'A slow image decode cannot replace newer edits');
    await page.locator('#wv-wif-in').setInputFiles({ name: 'edited.wif', mimeType: 'text/plain', buffer: wifBefore });
    await page.waitForFunction(() => document.querySelector('#wv-status').textContent.includes('shafts'));
    await page.locator('#wv-rack-weave').evaluate(e => e.open = true);
    await page.locator('#wv-weaveit').uncheck();
    const wifPixels = await pixels(), wifProject = await download('#wv-project-save');
    await page.reload(); await page.waitForFunction(() => document.querySelector('#wv-readout').textContent.includes('ends x'));
    await open(wifProject);
    await page.waitForFunction(() => document.querySelector('#wv-project-status')?.dataset.state === 'ready');
    assert.equal(await pixels(), wifPixels, 'Imported WIF drafts remain actual drafts without a made-up source image');
    assert.deepEqual(errors, []);
    console.log('Loom projects: edited draft, source, colors, WIF continuity, Jacquard and invalid-file preservation passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
