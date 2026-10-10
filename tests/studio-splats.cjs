// The Splat Lab draws its worlds in place (9 October 2026). Before, the source showed a card saying
// its scenes "draw in the Spatial source" and two buttons that left it. This checks, at desktop and
// phone widths: the Splat Lab source draws a receipt-checked world on its own stage; no card and no
// button sends the visitor elsewhere; its record (the boundary, the criteria, the pilots and the 27
// held scenes) is in the inspector; the bar is there; Spatial and the Splat Lab switch cleanly.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function stageLit(page) {
  const png = await page.locator('#viewport-stage').screenshot();
  return png.length;   // a black stage compresses to a few kilobytes; a drawn world does not
}
const pick = (page, s) => page.evaluate((s) => document.querySelector(`#studio-source button[data-source="${s}"]`).click(), s);

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
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await page.goto(`${base}/studio.html?source=splats`); await wait(page, 7000);
        const info = await page.evaluate(() => ({
          text: document.body.innerText,
          leave: [...document.querySelectorAll('#studio-rail .src-block:not([hidden]) button')].filter((b) => /in spatial|splat lab page/i.test(b.textContent)).map((b) => b.textContent.trim()),
          held: document.querySelectorAll('#splats-record:not([hidden]) .held-list li').length,
          criteria: document.querySelectorAll('#splats-record:not([hidden]) .criterion').length,
          bar: !!document.querySelector('#inspector-actions:not([hidden]) [data-action="primary"]'),
          title: document.getElementById('inspector-title').textContent,
        }));
        assert.equal(info.title, 'Splat Lab', `${tag} the header names the Splat Lab`);
        assert.ok(!/draw in the Spatial source/i.test(info.text), `${tag} no card that sends scenes elsewhere`);
        assert.deepEqual(info.leave, [], `${tag} no button that leaves the source`);
        assert.equal(info.held, 27, `${tag} the 27 held scenes are listed`);
        assert.ok(info.criteria >= 4, `${tag} the acceptance criteria are there (${info.criteria})`);
        assert.ok(info.bar, `${tag} the action bar`);
        const lit = await stageLit(page);
        assert.ok(lit > 20000, `${tag} a world is drawn on the stage (${lit} bytes)`);
        await pick(page, 'spatial'); await wait(page, 4000);
        assert.equal(await page.evaluate(() => document.getElementById('splats-record').hidden), true, `${tag} Spatial does not show the Splat Lab record`);
        await pick(page, 'splats'); await wait(page, 4000);
        assert.equal(await page.evaluate(() => document.getElementById('splats-record').hidden), false, `${tag} the record comes back with the Splat Lab`);
        assert.ok(await stageLit(page) > 20000, `${tag} and its world draws again`);
        assert.deepEqual(errors, [], `${tag} no console errors`);
        console.log(`${tag} studio splat lab: pass`);
      } catch (e) {
        failures++;
        console.error(`FAIL ${tag}`, e.message);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
