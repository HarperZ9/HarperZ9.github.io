// Every control a Studio source had before the shell is still where it was (4 October 2026). The
// author: "The studio modules have lost user granularity and functionality." #342 hid the rail
// copies of the controls its action bar repeats and removed Sketch's stroke Undo; this checks they
// are back, in place, at desktop and phone widths, and that the stroke Undo removes a stroke.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
// The controls #342 and #353 took out of the rail, by source, with their labels before #342.
const RAIL = {
  sketch: { 'sketch-undo': 'Undo', 'sketch-clear': 'Clear', 'sketch-plot': 'To pen surface', 'sketch-svg': 'SVG sheet', 'sketch-pin': 'Pin' },
  atelier: { 'at-draw': 'Draw', 'at-export': 'Export SVG', 'at-share': 'Copy link' },
  fractal: { 'fractal-render': 'Render' },
  fractal3d: { 'f3-render': 'Render' },
  ndim: { 'ndim-render': 'Render' },
  showcase: { 'show-verify': 'Re-check', 'show-export': 'Export' },
};
const wait = (page, ms) => page.waitForTimeout(ms);
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}

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
      for (const [source, controls] of Object.entries(RAIL)) {
        await page.goto(`${base}/studio.html?source=${source}`); await wait(page, source === 'showcase' ? 5000 : 3500);
        // Open every folded section of the source, as a visitor can.
        await page.evaluate(() => document.querySelectorAll('.src-block:not([hidden]) details').forEach((d) => { d.open = true; }));
        for (const [id, label] of Object.entries(controls)) {
          const el = page.locator(`#${id}`);
          assert.equal(await el.isVisible(), true, `${tag} ${source}: #${id} is shown in the rail`);
          assert.equal((await el.textContent()).trim(), label, `${tag} ${source}: #${id} keeps its label`);
        }
      }
      // The Atelier's main action keeps its name in the bar too.
      await page.goto(`${base}/studio.html`); await wait(page, 3500);
      assert.equal((await page.textContent('#inspector-actions [data-action="primary"]')).trim(), 'Draw', `${tag} the bar says Draw`);

      // Sketch's stroke Undo removes the last stroke, and the shared Undo can take that back.
      await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
      const blank = await frame(page);
      await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
      const b = await page.locator('#studio-canvas').boundingBox();
      for (const [y0, y1] of [[0.3, 0.5], [0.6, 0.4]]) {
        await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * y0); await page.mouse.down();
        for (let i = 1; i <= 12; i++) await page.mouse.move(b.x + b.width * (0.3 + i * 0.03), b.y + b.height * (y0 + (y1 - y0) * i / 12));
        await page.mouse.up(); await wait(page, 600);
      }
      const two = await frame(page);
      await page.evaluate(() => { scrollTo(0, 0); });
      await page.locator('#sketch-undo').scrollIntoViewIfNeeded(); await page.locator('#sketch-undo').click(); await wait(page, 600);
      const one = await frame(page);
      assert.notEqual(one, two, `${tag} the stroke Undo removed a stroke`);
      assert.notEqual(one, blank, `${tag} and only one`);
      assert.match(await page.textContent('#sketch-readout'), /^1 strokes/, `${tag} the readout counts one stroke`);
      await page.locator('[data-action="undo"]').scrollIntoViewIfNeeded(); await page.locator('[data-action="undo"]').click(); await wait(page, 600);
      assert.equal(await frame(page), two, `${tag} the shared Undo brings the stroke back`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio controls in place: pass`);
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
