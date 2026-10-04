// Bring your own and Watch with me on the shell (4 October 2026), in Chrome at desktop and phone
// widths. On entry each shows its own frame or an empty sheet that says what to do, never the
// previous source's picture; a file brought in comes back after a round trip, pixel for pixel; and
// what this browser keeps is the file's name, never the file.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8810';
const IMAGE = path.join(__dirname, '..', 'brand', 'aperture-mark.png');
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    const x = t.getContext('2d'); x.drawImage(c, 0, 0);
    const d = x.getImageData(0, 0, t.width, t.height).data;
    let inked = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) inked++;
    const h = await crypto.subtle.digest('SHA-256', d);
    return { hash: [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join(''), inked };
  });
}
async function pick(page, source) {
  const sw = page.locator('#source-switch'); await sw.scrollIntoViewIfNeeded(); await sw.click();
  await page.locator(`#studio-source button[data-source="${source}"]`).click();
}
async function stroke(page) {
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
  const b = await page.locator('#studio-canvas').boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (0.3 + i * 0.03), b.y + b.height * (0.3 + i * 0.02));
  await page.mouse.up();
}
const note = (page) => page.evaluate(() => { const n = document.getElementById('stage-empty'); return n && !n.hidden ? n.textContent : null; });

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
      await stroke(page); await wait(page, 800);
      const sketch = await frame(page);

      await pick(page, 'byo'); await wait(page, 1500);
      const empty = await frame(page);
      assert.notEqual(empty.hash, sketch.hash, `${tag} Bring your own does not show the sketch`);
      assert.equal(empty.inked, 0, `${tag} Bring your own starts on an empty sheet`);
      assert.match(await note(page) || '', /^Nothing here yet\. Drop an image/, `${tag} the empty sheet says what to do`);
      assert.match((await page.textContent('#studio-frame')).replace(/\s+/g, ' '), /contrast 0 ?structure 0/, `${tag} the readings describe the empty sheet, not the sketch`);
      const order = await page.evaluate(() => [...document.querySelectorAll('#inspector-actions > [data-action]')].map((b) => b.dataset.action));
      assert.deepEqual(order, ['primary', 'export'], `${tag} Bring your own bar: main action and Export, no Undo it cannot honour`);

      await page.setInputFiles('#studio-file', IMAGE); await wait(page, 2500);
      const brought = await frame(page);
      assert.ok(brought.inked > 1000, `${tag} the file drew`);
      assert.equal(await note(page), null, `${tag} the empty note steps aside`);
      await pick(page, 'sketch'); await wait(page, 1500);
      assert.equal((await frame(page)).hash, sketch.hash, `${tag} the sketch is as it was`);
      await pick(page, 'byo'); await wait(page, 1500);
      assert.equal((await frame(page)).hash, brought.hash, `${tag} the file comes back pixel for pixel`);

      // What is kept: the name, never the file.
      const kept = await page.evaluate(() => localStorage.getItem('studio.v1.byo'));
      assert.match(kept, /"lastFile":"aperture-mark\.png"/, `${tag} the file's name is kept`);
      assert.ok(kept.length < 400, `${tag} and nothing like file data (${kept.length} chars)`);
      await page.goto(`${base}/studio.html?source=byo`); await wait(page, 2500);
      assert.match(await note(page) || '', /Last time you brought aperture-mark\.png; drop it again to carry on\. The file itself is never kept\./, `${tag} a reload names the last file`);
      const fresh = page.locator('[data-action="fresh"]'); await fresh.scrollIntoViewIfNeeded(); await fresh.click(); await wait(page, 500);
      assert.doesNotMatch(await note(page) || '', /Last time/, `${tag} Start fresh forgets the name`);

      // Watch with me: an empty sheet until something is shared; nothing is asked for on entry.
      await pick(page, 'sketch'); await wait(page, 1500);
      await pick(page, 'watch'); await wait(page, 1500);
      assert.equal((await frame(page)).inked, 0, `${tag} Watch with me starts on an empty sheet`);
      assert.match(await note(page) || '', /^Nothing shared yet\./, `${tag} and says how to start`);
      const worder = await page.evaluate(() => [...document.querySelectorAll('#inspector-actions > [data-action]')].map((b) => b.dataset.action));
      assert.deepEqual(worder, ['primary', 'export'], `${tag} Watch bar`);
      assert.equal(await page.textContent('#inspector-actions [data-action="primary"]'), 'Share screen');
      assert.equal(await page.locator('#inspector-keep').count(), 0, `${tag} Watch keeps nothing, and has no keep line`);
      await pick(page, 'sketch'); await wait(page, 1000);
      assert.equal(await note(page), null, `${tag} the note leaves with the source`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio bring and watch: pass`);
      await ctx.close();
    }
  } catch (err) {
    failures++;
    console.error(err);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})();
