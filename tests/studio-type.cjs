// The Type forge's whole desk in the Studio (9 October 2026). Before, the Studio's Type forge had
// three controls (text, weight, capitals) against type-forge.html's thirteen. This checks, at
// desktop and phone widths: every control of the page's forge is in the Studio's source (by id,
// else label); a contrast change redraws the stage and Undo brings the first frame back pixel for
// pixel; a named weight sets the weight; the proof and the mint's status list are there; no errors.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
function controls(rootSel) {
  const root = document.querySelector(rootSel);
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').toLowerCase();
  return [...root.querySelectorAll('button, input, select, textarea, summary')].filter((el) => el.type !== 'hidden').map((el) => ({ id: el.id, label: label(el) }));
}
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return c.width + 'x' + c.height + ':' + [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
const pick = (page, s) => page.evaluate((s) => document.querySelector(`#studio-source button[data-source="${s}"]`).click(), s);

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    const ref = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await ref.goto(`${base}/type-forge.html`); await wait(ref, 2500);
    const page0 = await ref.evaluate(controls, '.tf-desk');
    await ref.close();
    assert.ok(page0.length >= 12, `type-forge.html's desk has its controls (${page0.length})`);

    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      try {
        await page.goto(`${base}/studio.html?source=type`);
        // The desk is read from type-forge.html on first entry; on a slow network that takes a while.
        await page.waitForSelector('#src-engine #tf-text', { timeout: 20000 }); await wait(page, 1500);
        const got = await page.evaluate(controls, '#src-engine');
        const ids = new Set(got.map((c) => c.id).filter(Boolean)), labels = new Set(got.map((c) => c.label));
        const missing = page0.filter((c) => !(c.id && ids.has(c.id)) && !labels.has(c.label));
        assert.deepEqual(missing, [], `${tag} every forge control from type-forge.html is in the Studio`);
        const extras = await page.evaluate(() => ({ proof: !!document.querySelector('#src-engine #tf-sample'), status: document.querySelectorAll('#src-engine #tf-status li').length }));
        assert.ok(extras.proof, `${tag} the proof set in the minted face`);
        assert.ok(extras.status >= 2, `${tag} the mint's status list (${extras.status})`);

        const first = await frame(page);
        await page.evaluate(() => { const r = document.getElementById('tf-contrast'); r.value = '0.4'; r.dispatchEvent(new Event('input', { bubbles: true })); }); await wait(page, 1000);
        const changed = await frame(page);
        assert.notEqual(changed, first, `${tag} a contrast change redraws the stage`);
        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1000);
        assert.equal(await frame(page), first, `${tag} Undo brings the first frame back exactly`);
        assert.equal(await page.inputValue('#tf-contrast'), '0.82', `${tag} and the contrast slider with it`);
        await page.evaluate(() => document.querySelector('#src-engine [data-weight="0.145"]').click()); await wait(page, 1000);
        assert.equal(await page.inputValue('#tf-weight'), '0.145', `${tag} Bold sets the weight`);
        assert.notEqual(await frame(page), first, `${tag} and redraws`);
        assert.deepEqual(errors, [], `${tag} no console errors`);
        console.log(`${tag} studio type forge: pass (${got.length} controls, ${page0.length} on the page's desk)`);
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
