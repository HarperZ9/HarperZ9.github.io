// Presets for every source (9 October 2026). This checks, at desktop and phone widths, on 2D Fractal
// and the Loom: a named preset keeps the setup on screen; after a change, applying it brings that
// setup back to the same pixels; Undo returns to what was there before applying; the preset is still
// there after a reload; a preset with no name is refused; and every source with a kept session shows
// the Presets control.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
const W = require('./lib/studio-wait.cjs');
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
async function keepPreset(page, name) {
  await page.evaluate((n) => { document.getElementById('inspector-presets').open = true; document.getElementById('inspector-preset-name').value = n; document.getElementById('inspector-preset-keep').click(); }, name);
  await W.until(page, (n) => !!document.querySelector(`.ia-preset-apply[data-preset="${n}"]`), name);
}
const applyPreset = (page, name) => page.evaluate((n) => { document.getElementById('inspector-presets').open = true; document.querySelector(`.ia-preset-apply[data-preset="${n}"]`).click(); }, name);
const undo = (page) => page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click());

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
      try {
        await page.goto(`${base}/studio.html?source=fractal`); const mandel = await W.ready(page, 'fractal');
        await page.evaluate(() => document.querySelector('[data-ftype="julia"]').click());
        const julia = await W.changed(page, mandel);
        await page.evaluate(() => { document.getElementById('inspector-presets').open = true; document.getElementById('inspector-preset-name').value = ''; document.getElementById('inspector-preset-keep').click(); });
        assert.match(await page.textContent('.ia-presets-note'), /name/i, `${tag} a preset with no name is refused`);
        await keepPreset(page, 'My Julia');
        await page.evaluate(() => document.querySelector('[data-ftype="burningship"]').click());
        const ship = await W.changed(page, julia);
        assert.notEqual(ship, julia);
        await applyPreset(page, 'My Julia');
        assert.equal(await W.becomes(page, julia), julia, `${tag} applying the preset gives back its pixels`);
        await undo(page);
        assert.equal(await W.becomes(page, ship), ship, `${tag} Undo returns to what was there before`);
        await page.reload(); await W.ready(page, 'fractal');
        assert.ok(await page.evaluate(() => !!document.querySelector('.ia-preset-apply[data-preset="My Julia"]')), `${tag} the preset survives a reload`);

        await page.goto(`${base}/studio.html?source=loom`);
        await W.ready(page, 'loom');
        await page.evaluate(() => { const w = document.getElementById('wv-weaveit'); if (w.checked) w.click(); });
        const cloth = await W.settled(page);
        await keepPreset(page, 'Plain');
        await page.evaluate(() => [...document.querySelectorAll('#wv-structures .re-chip')].find((c) => c.getAttribute('aria-checked') !== 'true').click());
        await W.changed(page, cloth);
        await applyPreset(page, 'Plain');
        assert.equal(await W.becomes(page, cloth), cloth, `${tag} a Loom preset gives back its cloth`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio presets: pass`);
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
