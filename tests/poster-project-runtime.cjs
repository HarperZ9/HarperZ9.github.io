const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    await page.goto(`${base}/studio.html?source=poster`);
    await page.waitForFunction(() => window.__studioPoster);
    assert.equal(await page.getByRole('button', { name: 'Save project', exact: true }).count(), 1, 'Poster needs a reopenable project, not only flattened exports');
    assert.equal(await page.getByLabel('Poster format', { exact: true }).count(), 1, 'Format selection should have one compact accessible control');
    await page.getByLabel('Poster format', { exact: true }).selectOption('social');
    const heading = page.locator('[data-poster-block-index="0"] textarea');
    await heading.fill('An editable composition');
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 4; c.height = 4;
      c.getContext('2d').fillStyle = '#c9653b'; c.getContext('2d').fillRect(0, 0, 4, 4);
      return c.toDataURL();
    });
    await page.locator('input.poster-imgfile').setInputFiles({ name: 'art.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
    await page.getByRole('button', { name: 'Remove image', exact: true }).waitFor();
    const block = page.locator('[data-poster-block-index="0"]');
    await block.getByRole('button', { name: 'Conso', exact: true }).click();
    for (const [label, value] of [['Heading 1 letter spacing', '-0.03'], ['Heading 1 line spacing', '1.45']]) {
      await block.getByLabel(label, { exact: true }).evaluate((e, v) => { e.value = v; e.dispatchEvent(new Event('input')); }, value);
    }
    await page.waitForTimeout(250);
    const before = await page.locator('#studio-canvas').evaluate(c => c.toDataURL());
    const downloadWait = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Save project', exact: true }).click();
    const download = await downloadWait;
    const bytes = await readFile(await download.path());
    const record = JSON.parse(bytes.toString());
    assert.equal(record.state.blocks[0].face, 'mono');
    assert.equal(record.state.blocks[0].tracking, -0.03);
    assert.equal(record.state.blocks[0].leading, 1.45);
    assert.equal(record.image, png, 'Uploaded artwork is embedded separately from the composition');
    await page.reload();
    await page.waitForFunction(() => window.__studioPoster);
    await page.locator('[data-poster-project-file]').setInputFiles({ name: 'composition.json', mimeType: 'application/json', buffer: bytes });
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'ready');
    assert.equal(await heading.inputValue(), 'An editable composition');
    assert.equal(await page.getByLabel('Poster format', { exact: true }).inputValue(), 'social');
    const after = await page.locator('#studio-canvas').evaluate(c => c.toDataURL());
    const hash = value => createHash('sha256').update(value).digest('hex');
    assert.equal(hash(after), hash(before), 'Save/reopen preserves rendered pixels and editable state');
    await page.locator('[data-poster-project-file]').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{"schema":"wrong"}') });
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'error');
    assert.equal(await heading.inputValue(), 'An editable composition', 'Invalid files leave current work intact');
    const incoming = { ...record, state: { ...record.state, blocks: record.state.blocks.map((b, i) => i === 0 ? { ...b, text: 'Incoming replacement' } : b) } };
    const incomingBytes = Buffer.from(JSON.stringify(incoming));
    async function delayOpen() {
      await page.evaluate(() => {
        delete window.__resumeProjectDecode;
        const original = Image.prototype.decode;
        Image.prototype.decode = function () {
          Image.prototype.decode = original;
          return new Promise((resolve, reject) => {
            window.__resumeProjectDecode = () => original.call(this).then(resolve, reject);
          });
        };
      });
      await page.locator('[data-poster-project-file]').setInputFiles({ name: 'incoming.json', mimeType: 'application/json', buffer: incomingBytes });
      await page.waitForFunction(() => typeof window.__resumeProjectDecode === 'function');
    }
    await delayOpen();
    await page.locator('#studio-source [data-source="fractal"]').click();
    await page.evaluate(() => window.__resumeProjectDecode());
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'cancelled');
    assert.equal(await page.evaluate(() => window.__studioActiveSource), 'fractal');
    await page.locator('#studio-source [data-source="poster"]').click();
    assert.equal(await heading.inputValue(), 'An editable composition', 'A stale decode cannot apply after switching tools');
    await delayOpen();
    await heading.fill('Keep my newer edits');
    await page.evaluate(() => window.__resumeProjectDecode());
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'cancelled');
    assert.equal(await heading.inputValue(), 'Keep my newer edits', 'Opening cannot overwrite edits made during decode');
    await delayOpen();
    await page.locator('[data-poster-project-file]').setInputFiles({ name: 'newer.json', mimeType: 'application/json', buffer: incomingBytes });
    await page.waitForFunction(() => document.querySelector('[data-poster-project-status]')?.dataset.state === 'ready');
    await page.evaluate(() => window.__resumeProjectDecode());
    await page.waitForTimeout(80);
    assert.equal(await page.locator('[data-poster-project-status]').getAttribute('data-state'), 'ready', 'A superseded open cannot replace the latest result status');
    console.log('Poster native project: download, reload, reopen and invalid-file preservation passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
