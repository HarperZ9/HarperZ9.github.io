// Drag and drop (9 October 2026). The audit found the deck's To Retro and To Loom buttons were the
// only way to move a picture between tools, and To Loom left the Studio for loom.html. This checks,
// at desktop width (the handle is hidden on touch screens, where the buttons remain): dragging the
// stage's handle onto Loom in the source menu weaves the frame in this page; onto Bring your own
// loads it as a picture; a picture file dropped on the page opens in Bring your own; the deck's To
// Loom button stays on studio.html; no page errors.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const wait = (page, ms) => page.waitForTimeout(ms);
async function dragFrameTo(page, target) {
  const dt = await page.evaluateHandle(() => new DataTransfer());
  await page.dispatchEvent('.stage-drag', 'dragstart', { dataTransfer: dt });
  await wait(page, 200);
  const sel = `#studio-source button[data-source="${target}"]`;
  await page.dispatchEvent(sel, 'dragover', { dataTransfer: dt });
  await page.dispatchEvent(sel, 'drop', { dataTransfer: dt });
  await page.dispatchEvent('.stage-drag', 'dragend', { dataTransfer: dt });
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  try {
    await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3000);
    assert.ok(await page.isVisible('.stage-drag'), 'the stage has a Drag frame handle');
    await dragFrameTo(page, 'loom');
    await page.waitForSelector('#src-loom #wv-panel', { timeout: 20000 }); await wait(page, 2500);
    assert.equal(await page.evaluate(() => window.__studioActiveSource), 'loom', 'dropping on Loom opens the Loom');
    assert.match(await page.textContent('#wv-status'), /warping up|arrived/i, 'and the Loom weaves the frame it was handed');

    await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3000);
    await dragFrameTo(page, 'byo'); await wait(page, 3000);
    assert.equal(await page.evaluate(() => window.__studioActiveSource), 'byo', 'dropping on Bring your own opens it');
    assert.equal(await page.evaluate(() => document.getElementById('viewport-stage').querySelector('.stage-empty:not([hidden])')), null, 'with the frame on its stage, not the empty sheet');

    await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 2500);
    const png = await page.evaluate(async () => { const c = document.createElement('canvas'); c.width = 64; c.height = 64; const x = c.getContext('2d'); x.fillStyle = '#c33'; x.fillRect(8, 8, 48, 48); return c.toDataURL('image/png').split(',')[1]; });
    const fileDt = await page.evaluateHandle((b64) => { const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0)); const dt = new DataTransfer(); dt.items.add(new File([bytes], 'square.png', { type: 'image/png' })); return dt; }, png);
    await page.dispatchEvent('#viewport-stage', 'dragover', { dataTransfer: fileDt });
    await page.dispatchEvent('#viewport-stage', 'drop', { dataTransfer: fileDt }); await wait(page, 3000);
    assert.equal(await page.evaluate(() => window.__studioActiveSource), 'byo', 'a picture dropped on the page opens in Bring your own');

    await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3000);
    await page.evaluate(() => document.getElementById('rt-loom').click());
    await page.waitForSelector('#src-loom #wv-panel', { timeout: 20000 }); await wait(page, 1500);
    assert.ok(new URL(page.url()).pathname.endsWith('/studio.html'), 'the deck\'s To Loom stays on studio.html');
    assert.deepEqual(errors, [], 'no page errors');
    console.log('studio drag and drop: pass');
  } catch (e) {
    failures++;
    console.error('FAIL', e.message);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
