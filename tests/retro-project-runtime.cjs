const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/retro.html`);
    await page.waitForFunction(() => document.querySelector('#re-measure').textContent.includes('cells'));
    await page.locator('#re-animate').uncheck();
    const pixels = () => page.locator('#re-out').evaluate(c => c.toDataURL());
    const paused = await pixels();
    await page.waitForTimeout(200);
    assert.ok(await pixels() === paused, 'Animate off must stop the shader, not just change its checkbox');
    assert.equal(await page.getByRole('button', { name: 'Save project', exact: true }).count(), 1, 'Settings alone cannot preserve uploaded artwork');
    await page.locator('.re-tab[data-src="upload"]').click();
    const png = await page.evaluate(() => {
      const c = document.createElement('canvas'); c.width = 1280; c.height = 800;
      const g = c.getContext('2d'); g.fillStyle = '#cf4d68'; g.fillRect(0, 0, 1280, 800);
      g.fillStyle = '#2454c5'; g.fillRect(180, 220, 820, 230); return c.toDataURL();
    });
    await page.locator('#re-file').setInputFiles({ name: 'source.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') });
    await page.waitForTimeout(150);
    const before = await pixels();
    const download = async () => {
      const waiting = page.waitForEvent('download'); await page.locator('#re-project-save').click();
      return readFile(await (await waiting).path());
    };
    const bytes = await download();
    const open = buffer => page.locator('#re-project-file').setInputFiles({ name: 'shader.json', mimeType: 'application/json', buffer });
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#re-code').value.length > 0);
    await open(bytes);
    await page.waitForFunction(() => document.querySelector('#re-project-status')?.dataset.state === 'ready');
    assert.ok(await pixels() === before, 'Working upload and pixel treatment survive a reload');
    const invalid = JSON.parse(bytes); invalid.patch.src = 'unrecognized';
    await open(Buffer.from(JSON.stringify(invalid)));
    await page.waitForFunction(() => document.querySelector('#re-project-status').dataset.state === 'error');
    assert.ok(await pixels() === before, 'Rejected project leaves the current composition intact');
    const code = await page.locator('#re-code').inputValue();
    for (const mutation of [
      p => { p.patch.glsl = 'This is not GLSL'; },
      p => { p.patch.layers = Array(5).fill({ name: 'layer', glsl: code, opacity: 1, blend: 'screen' }); },
      p => { p.patch.tw = 99999999; },
      p => { p.assets.upload = 'https://example.com/private-image.png'; },
      p => { p.assets.drawing = p.assets.upload; },
      p => { p.patch.mod = [{ src: 'unknown', tgt: 'tw', depth: 1 }]; },
    ]) {
      const record = JSON.parse(bytes); mutation(record); await open(Buffer.from(JSON.stringify(record)));
      await page.waitForFunction(() => document.querySelector('#re-project-status').dataset.state === 'error');
      assert.ok(await pixels() === before, 'Invalid shaders, ranges, image dimensions and routes must preserve current work');
      assert.equal(await page.locator('#re-code').inputValue(), code);
    }
    await page.locator('.re-tab[data-src="draw"]').click();
    const box = await page.locator('#re-out').boundingBox();
    await page.mouse.move(box.x + box.width * .2, box.y + box.height * .35);
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .7, box.y + box.height * .65, { steps: 10 }); await page.mouse.up();
    const drawing = await pixels(), drawFile = await download();
    await page.reload(); await page.waitForFunction(() => document.querySelector('#re-code').value.length > 0); await open(drawFile);
    await page.waitForFunction(() => document.querySelector('#re-project-status')?.dataset.state === 'ready');
    assert.ok(await pixels() === drawing, 'Drawing pixels survive a project reopen');
    await page.evaluate(() => {
      const decode = Image.prototype.decode;
      Image.prototype.decode = async function () { Image.prototype.decode = decode; await new Promise(r => setTimeout(r, 450)); return decode.call(this); };
    });
    await open(bytes);
    await page.locator('#re-clear-draw').evaluate(button => button.click());
    const cleared = await pixels();
    await page.waitForFunction(() => document.querySelector('#re-project-status').dataset.state === 'cancelled');
    assert.ok(await pixels() === cleared, 'An older asynchronous open cannot overwrite newer edits');
    await page.locator('#re-code').evaluate(e => { e.value = 'unfinished shader('; e.dispatchEvent(new Event('input', { bubbles: true })); });
    await page.locator('#re-project-save').click();
    await page.waitForTimeout(100);
    assert.equal(await page.locator('#re-project-status').getAttribute('data-state'), 'error', 'Do not claim an unopenable shader draft was saved as a usable project');
    await page.setViewportSize({ width: 320, height: 900 });
    await page.locator('#re-rack-output').evaluate(e => e.scrollIntoView({ block: 'start', behavior: 'instant' }));
    assert.ok(await page.locator('#re-project-save').evaluate(e => {
      const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'The mobile preview must not cover the project controls when navigating to Save');
    assert.deepEqual(errors, []);
    console.log('PASS: pause, upload/drawing project continuity, invalid file and stale import protection');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
