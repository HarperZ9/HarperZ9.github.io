// The Atelier, 3D Fractal and Dimensions on the shell (4 October 2026), in Chrome at desktop and
// phone widths. Each draws its own frame on entry, never the previous source's; the Atelier comes
// back to the same drawing; Undo walks each one's settings; a zoom keeps the Atelier's seed; and
// the work is kept in this browser.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8809';
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
    let inked = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && (d[i - 1] + d[i - 2] + d[i - 3]) > 0) inked++;
    const h = await crypto.subtle.digest('SHA-256', d);
    return { hash: [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join(''), inked };
  });
}
// Wait until the canvas stops changing (three equal reads 500 ms apart, at most 20 s), so a slow
// machine is not mistaken for a wrong drawing.
async function settled(page, min = 1500) {
  await wait(page, min);
  let last = null, same = 0;
  for (let i = 0; i < 40 && same < 2; i++) {
    const f = await frame(page);
    same = last && f.hash === last.hash ? same + 1 : 0;
    last = f;
    if (same < 2) await wait(page, 500);
  }
  return last;
}
// Open the source menu (only if it is folded), wait for the source to show, pick it. One more try
// if the first click on the switch did not open the menu (seen once on a phone under load).
async function pick(page, source) {
  const sw = page.locator('#source-switch');
  const tab = page.locator(`#studio-source button[data-source="${source}"]`);
  for (let attempt = 0; attempt < 2; attempt++) {
    if ((await sw.getAttribute('aria-expanded')) !== 'true') { await sw.scrollIntoViewIfNeeded(); await sw.click(); }
    try { await tab.waitFor({ state: 'visible', timeout: 4000 }); break; } catch (e) {
      if (attempt) throw e;
      console.log(`note: the source switch did not open the menu for ${source}; trying once more`);
    }
  }
  await tab.click();
}
async function clickIn(page, sel) { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); }
const active = (page, attr) => page.getAttribute(`[${attr}].active`, attr);

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
      await page.goto(`${base}/studio.html`); await settled(page, 3000);
      const seed = await page.inputValue('#at-seed');
      // The boot drawing can be framed by a stage that is still settling (noted in PROPOSAL.md), so
      // the reference is the Atelier's own drawing after one return; the second return must match it.
      await pick(page, 'sketch'); await wait(page, 1500);
      await pick(page, 'atelier'); await settled(page);
      const atelier = await frame(page);
      assert.ok(atelier.inked > 1000, `${tag} the Atelier drew`);

      // The Atelier comes back to its own drawing after another source drew over the stage.
      await pick(page, 'sketch'); await wait(page, 1500);
      const sketch = await frame(page);
      assert.notEqual(sketch.hash, atelier.hash);
      await pick(page, 'atelier'); await settled(page);
      assert.equal((await frame(page)).hash, atelier.hash, `${tag} the Atelier redraws the same drawing on return`);
      assert.equal(await page.inputValue('#at-seed'), seed, `${tag} with the same seed`);

      // A zoom redraws the same recipe; it used to press Draw and replace the seed.
      await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
      const box = await page.locator('#studio-canvas').boundingBox();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, -300); await wait(page, 3000);
      assert.equal(await page.inputValue('#at-seed'), seed, `${tag} a zoom keeps the Atelier's seed`);
      await clickIn(page, '#rt-reset'); await wait(page, 5000);

      // Undo walks the Atelier's recipe.
      await clickIn(page, '#at-gallery button'); await settled(page);
      const preset = await page.inputValue('#at-seed');
      assert.notEqual(preset, seed);
      await clickIn(page, '[data-action="undo"]'); await settled(page);
      assert.equal(await page.inputValue('#at-seed'), seed, `${tag} Undo returns the Atelier's previous recipe`);
      await clickIn(page, '[data-action="redo"]'); await settled(page);
      assert.equal(await page.inputValue('#at-seed'), preset, `${tag} Redo brings the preset back`);

      // 3D Fractal and Dimensions draw on entry, not the previous source's picture.
      await pick(page, 'sketch'); await wait(page, 1500);
      const before3d = await frame(page);
      await pick(page, 'fractal3d'); await wait(page, 3500);
      const f3 = await frame(page);
      assert.notEqual(f3.hash, before3d.hash, `${tag} 3D Fractal draws its own frame on entry`);
      assert.ok(f3.inked > 1000, `${tag} 3D Fractal frame is drawn (${f3.inked})`);
      await clickIn(page, '[data-f3type="mandelbulb"]');
      await clickIn(page, '[data-action="primary"]'); await wait(page, 2500);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 2500);
      assert.equal(await active(page, 'data-f3type'), 'mandelbox', `${tag} Undo returns the Mandelbox`);

      await pick(page, 'sketch'); await wait(page, 1500);
      const beforeNd = await frame(page);
      await pick(page, 'ndim'); await wait(page, 3500);
      const nd = await frame(page);
      assert.notEqual(nd.hash, beforeNd.hash, `${tag} Dimensions draws its own frame on entry`);
      assert.ok(nd.inked > 500, `${tag} Dimensions frame is drawn (${nd.inked})`);
      await clickIn(page, '[data-ndim-kind="simplex"]'); await wait(page, 1500);
      await clickIn(page, '[data-action="undo"]'); await wait(page, 1500);
      assert.equal(await active(page, 'data-ndim-kind'), 'cube', `${tag} Undo returns the hypercube`);
      await clickIn(page, '[data-action="redo"]'); await wait(page, 1500);
      assert.equal(await active(page, 'data-ndim-kind'), 'simplex', `${tag} Redo brings the simplex back`);

      // Kept in this browser: a plain visit brings back the Atelier's recipe; Dimensions its kind.
      await page.goto(`${base}/studio.html?source=ndim`); await wait(page, 3500);
      assert.equal(await active(page, 'data-ndim-kind'), 'simplex', `${tag} Dimensions kept its polytope across a reload`);
      const fresh = await ctx.newPage();
      fresh.on('pageerror', (e) => errors.push(String(e.message || e)));
      await fresh.goto(`${base}/studio.html`); await wait(fresh, 6000);
      assert.equal(await fresh.inputValue('#at-seed'), preset, `${tag} a plain visit resumes the Atelier's kept recipe`);
      await fresh.goto(`${base}/studio.html?study=flow&specimen=none&seed=fromlink&cx=58&palette=spectrum`); await wait(fresh, 6000);
      assert.equal(await fresh.inputValue('#at-seed'), 'fromlink', `${tag} a shared link wins over the kept recipe`);

      assert.deepEqual(errors, [], `${tag} no console errors`);
      await ctx.close();

      // Less motion: Dimensions holds its first pose (it used to keep turning).
      const rctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, reducedMotion: 'reduce' });
      const rp = await rctx.newPage();
      await rp.goto(`${base}/studio.html?source=ndim`); await wait(rp, 3000);
      const still = await frame(rp); await wait(rp, 1500);
      assert.equal((await frame(rp)).hash, still.hash, `${tag} Dimensions holds still with reduced motion`);
      assert.ok(still.inked > 500, `${tag} and the held pose is drawn`);
      await rctx.close();
      console.log(`${tag} studio entry frames: pass`);
    }
  } catch (err) {
    failures++;
    console.error(err);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})();
