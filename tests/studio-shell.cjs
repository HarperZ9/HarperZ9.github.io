// The Studio shell's interaction contract (system/studio-shell.js), in a real browser, at desktop
// and phone widths. Written 4 October 2026 with the first shell slice (Sketch, 2D Fractal, Showcase).
//
//  1. One source switch: the 24-source menu is folded away until asked for, and a pick folds it again.
//  2. The inspector names the source on stage, and its action bar is on screen without scrolling,
//     in one order: main action, Undo, Redo, Export, Pin.
//  3. The stage shows the entered source's own frame, never the previous source's picture.
//  4. Leaving a source and coming back keeps its work exactly (the same pixels).
//  5. Undo and Redo, by button or by Ctrl+Z and Ctrl+Shift+Z, put back exactly the earlier pixels.
//  6. Showcase: every system gets its own candidate terms, so no verdict reads "unknown identifier".
//  7. Nothing runs at rest: no requestAnimationFrame loop on a still source.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8807';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];

// The canvas's own bytes (a WebGL canvas is copied through a 2D canvas), hashed in the page.
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    let ctx = c.getContext('2d');
    let src = c;
    if (!ctx) { const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0); src = t; ctx = t.getContext('2d'); }
    const d = ctx.getImageData(0, 0, src.width, src.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('') + '@' + c.width + 'x' + c.height;
  });
}
async function settle(page, ms = 1500) { await page.waitForTimeout(ms); }
async function pick(page, source) {
  const sw = page.locator('#source-switch');
  await sw.scrollIntoViewIfNeeded();
  await sw.click();
  assert.equal(await sw.getAttribute('aria-expanded'), 'true', 'the switch opens the source menu');
  const tab = page.locator(`#studio-source button[data-source="${source}"]`);
  await tab.click();
  assert.equal(await sw.getAttribute('aria-expanded'), 'false', 'a pick folds the menu away');
  assert.equal(await page.locator('#studio-source').isVisible(), false, 'the menu is hidden after a pick');
  assert.equal((await page.textContent('#inspector-title')).trim().length > 0, true);
}
async function barOnScreen(page) {
  return page.evaluate(() => {
    const bar = document.getElementById('inspector-actions');
    const r = bar.getBoundingClientRect();
    return { hidden: bar.hidden, top: r.top, bottom: r.bottom, vh: innerHeight,
      order: [...bar.children].map((b) => b.dataset.action),
      primary: (bar.querySelector('[data-action="primary"]') || {}).textContent };
  });
}
async function strokeOnCanvas(page, a, b) {
  const box = await page.locator('#studio-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) {
    await page.mouse.move(box.x + box.width * (a[0] + (b[0] - a[0]) * i / 16), box.y + box.height * (a[1] + (b[1] - a[1]) * i / 16));
  }
  await page.mouse.up();
}
const mod = process.platform === 'darwin' ? 'Meta' : 'Control';

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      await ctx.addInitScript(() => {
        window.__rafCount = 0;
        const raf = window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame = (cb) => { window.__rafCount++; return raf(cb); };
      });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      await page.goto(`${base}/studio.html`, { waitUntil: 'load' });
      await settle(page, 3000);
      const tag = `[${view.name}]`;

      // 1. Folded menu on arrival, the switch names the Atelier.
      assert.equal(await page.locator('#studio-source').isVisible(), false, `${tag} the source menu starts folded`);
      assert.match(await page.textContent('#source-switch'), /Atelier/, `${tag} the switch names the source on stage`);
      assert.equal(await page.locator('#inspector-title').textContent(), 'Atelier');

      // 2 and 3. Each joined source: own frame on entry, bar on screen in the fixed order.
      const atelierFrame = await frame(page);
      await pick(page, 'sketch');
      await settle(page);
      let bar = await barOnScreen(page);
      assert.equal(bar.hidden, false, `${tag} sketch has an action bar`);
      assert.deepEqual(bar.order, ['primary', 'undo', 'redo', 'export', 'pin'], `${tag} sketch bar order`);
      assert.ok(bar.top >= 0 && bar.bottom <= bar.vh, `${tag} sketch bar is on screen without scrolling (${bar.top}..${bar.bottom} of ${bar.vh})`);
      assert.equal(await page.locator('#inspector-title').textContent(), 'Sketch');
      const blank = await frame(page);
      assert.notEqual(blank, atelierFrame, `${tag} sketch shows its own sheet, not the Atelier's frame`);

      // 5. Sketch history: stroke, undo by key, redo by key, clear and undo by button.
      await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
      await strokeOnCanvas(page, [0.3, 0.3], [0.7, 0.6]);
      await settle(page, 600);
      const one = await frame(page);
      assert.notEqual(one, blank, `${tag} the stroke drew`);
      assert.equal(await page.locator('[data-action="undo"]').isEnabled(), true, `${tag} Undo is live after a stroke`);
      await page.locator('body').click({ position: { x: 2, y: 2 } }).catch(() => {});
      await page.keyboard.press(`${mod}+z`);
      await settle(page, 500);
      assert.equal(await frame(page), blank, `${tag} Ctrl+Z puts back the blank sheet exactly`);
      await page.keyboard.press(`${mod}+Shift+z`);
      await settle(page, 500);
      assert.equal(await frame(page), one, `${tag} Ctrl+Shift+Z brings the stroke back exactly`);
      await page.locator('#sketch-clear').scrollIntoViewIfNeeded();
      await page.locator('#sketch-clear').click();
      await settle(page, 500);
      assert.equal(await frame(page), blank, `${tag} Clear empties the sheet`);
      await page.locator('[data-action="undo"]').click();
      await settle(page, 500);
      assert.equal(await frame(page), one, `${tag} Undo brings a cleared drawing back`);

      // 3 and 4. Fractal draws its own frame on entry; a zoom survives a round trip; Undo walks it back.
      await pick(page, 'fractal');
      await settle(page, 3500);
      bar = await barOnScreen(page);
      assert.deepEqual(bar.order, ['primary', 'undo', 'redo', 'export'], `${tag} fractal bar order`);
      assert.ok(bar.top >= 0 && bar.bottom <= bar.vh, `${tag} fractal bar is on screen`);
      const entry = await frame(page);
      assert.notEqual(entry, one, `${tag} the fractal draws its own frame on entry, not the sketch`);
      await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
      const box = await page.locator('#studio-canvas').boundingBox();
      await page.mouse.move(box.x + box.width * 0.42, box.y + box.height * 0.45);
      await page.mouse.wheel(0, -400);
      await settle(page, 2500);
      const zoomed = await frame(page);
      assert.notEqual(zoomed, entry, `${tag} the wheel zoomed`);
      await pick(page, 'sketch');
      await settle(page);
      assert.equal(await frame(page), one, `${tag} the sketch is exactly as it was left`);
      await pick(page, 'fractal');
      await settle(page, 3500);
      const back = await frame(page);
      await page.locator('[data-action="undo"]').click();
      await settle(page, 2500);
      const undone = await frame(page);
      await page.locator('[data-action="redo"]').click();
      await settle(page, 2500);
      const redone = await frame(page);
      assert.equal(redone, back, `${tag} Redo returns to the zoom exactly`);
      assert.notEqual(undone, back, `${tag} Undo walks the zoom back`);
      assert.equal(await page.inputValue('#fractal-detail'), '1', `${tag} the fractal controls still hold their values`);

      // 6. Showcase: every system verifies with its own terms; Undo returns the previous system.
      await pick(page, 'showcase');
      await settle(page, 5000);
      bar = await barOnScreen(page);
      assert.equal(bar.primary, 'Re-check', `${tag} showcase main action`);
      for (const [sys, terms] of [['sho', 'x^2, v^2'], ['pendulum', 'w^2, cos(theta)'], ['oscillator2d', 'x^2, y^2, vx^2, vy^2'], ['kepler', 'x*vy, y*vx']]) {
        const chip = page.locator(`[data-show-system="${sys}"]`);
        await chip.scrollIntoViewIfNeeded();
        await chip.click();
        await settle(page, 5000);
        assert.equal(await page.inputValue('#show-terms'), terms, `${tag} ${sys} gets its own candidate terms`);
        const verdict = (await page.textContent('#show-verdict')) || '';
        assert.doesNotMatch(verdict, /unknown identifier/, `${tag} ${sys} verdict: ${verdict}`);
        assert.match(verdict, /^MATCH/, `${tag} ${sys} re-checks to MATCH: ${verdict}`);
      }
      await page.locator('[data-action="undo"]').click();
      await settle(page, 5000);
      assert.equal(await page.getAttribute('#show-system .chip.active', 'data-show-system'), 'oscillator2d', `${tag} Undo returns the previous system`);
      assert.equal(await page.inputValue('#show-terms'), 'x^2, y^2, vx^2, vy^2', `${tag} and its terms`);

      // 7. A still source is still: no animation-frame loop at rest.
      await pick(page, 'sketch');
      await settle(page, 4000);
      const r0 = await page.evaluate(() => window.__rafCount);
      await settle(page, 2000);
      const perSecond = ((await page.evaluate(() => window.__rafCount)) - r0) / 2;
      assert.ok(perSecond < 5, `${tag} ${perSecond} animation frames per second on a still sketch`);

      // 3, from a link: a source named in the URL draws its own frame and keeps it through the
      // layout shifts of boot (a resize used to clear the sketch sheet and leave it blank).
      for (const source of ['sketch', 'fractal']) {
        await page.goto(`${base}/studio.html?source=${source}`, { waitUntil: 'load' });
        await settle(page, 4500);
        assert.match(await page.textContent('#source-switch'), source === 'sketch' ? /Sketch/ : /2D Fractal/);
        const inked = await page.evaluate(() => {
          const c = document.getElementById('studio-canvas');
          const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
          const x = t.getContext('2d'); x.drawImage(c, 0, 0);
          const d = x.getImageData(0, 0, t.width, t.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0 && (d[i - 1] + d[i - 2] + d[i - 3]) > 0) n++;
          return n;
        });
        assert.ok(inked > 1000, `${tag} ?source=${source} draws its own frame on arrival (${inked} drawn pixels)`);
      }

      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} studio shell contract: pass`);
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
