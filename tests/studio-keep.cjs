// Work kept in this browser and the readings fold, in a real browser at desktop and phone widths.
// The author's decisions of 4 October 2026: "fold yes, this browser". Written with that slice.
//
//  1. The readings fold while the visitor makes (pointer down on the stage, or a making action in
//     the last 4 s), the stage keeps its size, the change is announced, and "Show readings" opens
//     them at once. Showcase, which checks a claim, never folds.
//  2. A reload puts back each joined source's work exactly (the same pixels, the same settings).
//  3. "Start fresh" clears it, and Undo brings it back.
//  4. With storage blocked, too small a cap, or an unreadable entry, the page still works and the
//     inspector says in words what was not kept.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8808';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height;
    t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 12).map((b) => b.toString(16).padStart(2, '0')).join('') + '@' + c.width + 'x' + c.height;
  });
}
async function stroke(page, a, b) {
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#studio-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * a[0], box.y + box.height * a[1]);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) await page.mouse.move(box.x + box.width * (a[0] + (b[0] - a[0]) * i / 14), box.y + box.height * (a[1] + (b[1] - a[1]) * i / 14));
  await page.mouse.up();
}
const readings = (page) => page.getAttribute('#studio-panel', 'data-readings');
const said = (page) => page.textContent('#inspector-keep-said');
const watchErrors = (page, errors) => {
  page.on('pageerror', (e) => errors.push(String(e.message || e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
};

async function foldChecks(ctx, tag) {
  const page = await ctx.newPage(); const errors = []; watchErrors(page, errors);
  await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
  // 9 October 2026: on a desktop the readings column starts as a strip on a making source (the
  // layout pass); the fold while making applies once the visitor opens it, so open it first.
  const collapsed = await page.evaluate(() => document.querySelector('.studio-app').classList.contains('readings-collapsed'));
  if (collapsed) { await page.click('#readings-toggle'); await wait(page, 600); }
  assert.equal(await page.evaluate(() => document.querySelector('.studio-app').classList.contains('readings-collapsed')), false, `${tag} the Readings button opens the column`);
  assert.equal(await readings(page), 'open', `${tag} readings open before any making`);
  const size = await page.evaluate(() => { const c = document.getElementById('studio-canvas'); return [c.width, c.height, Math.round(c.getBoundingClientRect().width)]; });
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
  const box = await page.locator('#studio-canvas').boundingBox();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.4);
  await page.mouse.down();
  await wait(page, 300);
  assert.equal(await readings(page), 'folded', `${tag} pointer down on the stage folds the readings`);
  assert.match(await page.textContent('#readings-status'), /Readings folded while you make/, `${tag} the fold is announced`);
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.5);
  await wait(page, 4600);
  assert.equal(await readings(page), 'folded', `${tag} still folded while the pointer is held, past the quiet time`);
  await page.mouse.up();
  await wait(page, 2000);
  assert.equal(await readings(page), 'folded', `${tag} still folded inside the quiet time`);
  const after = await page.evaluate(() => { const c = document.getElementById('studio-canvas'); return [c.width, c.height, Math.round(c.getBoundingClientRect().width)]; });
  assert.deepEqual(after, size, `${tag} the stage keeps its size while the readings fold`);
  await wait(page, 2600);
  assert.equal(await readings(page), 'open', `${tag} the readings open again once the making stops`);
  assert.match(await page.textContent('#readings-status'), /Readings open/, `${tag} the reopening is announced`);
  // On demand: Show readings opens them at once, and they stay open while the making goes on.
  await stroke(page, [0.2, 0.7], [0.5, 0.6]);
  await wait(page, 200);
  assert.equal(await readings(page), 'folded');
  const show = page.locator('#readings-show'); await show.scrollIntoViewIfNeeded(); await show.click();
  assert.equal(await readings(page), 'open', `${tag} Show readings opens them on demand`);
  await page.locator('[data-sketch-guide="grid"]').scrollIntoViewIfNeeded();
  await page.locator('[data-sketch-guide="grid"]').click();
  await wait(page, 300);
  assert.equal(await readings(page), 'open', `${tag} held open through the rest of that making`);
  // Checking a claim is not making: Showcase never folds.
  await page.goto(`${base}/studio.html?source=showcase`); await wait(page, 4500);
  const chip = page.locator('[data-show-system="sho"]'); await chip.scrollIntoViewIfNeeded(); await chip.click();
  await wait(page, 300);
  assert.equal(await readings(page), 'open', `${tag} Showcase keeps its readings open`);
  assert.deepEqual(errors, [], `${tag} no console errors (fold)`);
  await page.close();
}

async function keepChecks(ctx, tag) {
  const page = await ctx.newPage(); const errors = []; watchErrors(page, errors);
  await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
  const blank = await frame(page);
  await stroke(page, [0.25, 0.3], [0.7, 0.65]); await wait(page, 800);
  await page.locator('[data-sketch-sym="mirror"]').scrollIntoViewIfNeeded();
  await page.locator('[data-sketch-sym="mirror"]').click(); await wait(page, 800);
  const drawn = await frame(page);
  assert.notEqual(drawn, blank);
  assert.equal(await said(page), 'Kept in this browser.');
  await page.reload(); await wait(page, 4000);
  assert.equal(await frame(page), drawn, `${tag} a reload puts the sketch back exactly`);
  assert.equal(await page.getAttribute('[data-sketch-sym="mirror"]', 'class'), 'chip active', `${tag} and its symmetry`);
  const fresh = page.locator('[data-action="fresh"]'); await fresh.scrollIntoViewIfNeeded(); await fresh.click(); await wait(page, 800);
  assert.equal(await frame(page), blank, `${tag} Start fresh empties the sheet`);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('studio.v1.sketch')));
  assert.equal(stored.state.sketch.strokes.length, 0, `${tag} and what is kept is the fresh sheet`);
  await page.locator('[data-action="undo"]').click(); await wait(page, 800);
  assert.equal(await frame(page), drawn, `${tag} Undo brings the drawing back after Start fresh`);

  await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3500);
  await page.locator('#studio-canvas').scrollIntoViewIfNeeded();
  const fb = await page.locator('#studio-canvas').boundingBox();
  await page.mouse.move(fb.x + fb.width * 0.42, fb.y + fb.height * 0.45);
  await page.mouse.wheel(0, -400); await wait(page, 2500);
  const zoomed = await frame(page);
  await page.reload(); await wait(page, 4500);
  assert.equal(await frame(page), zoomed, `${tag} a reload puts the fractal view back exactly`);

  await page.goto(`${base}/studio.html?source=showcase`); await wait(page, 4500);
  const chip = page.locator('[data-show-system="pendulum"]'); await chip.scrollIntoViewIfNeeded(); await chip.click(); await wait(page, 4500);
  await page.reload(); await wait(page, 6000);
  assert.equal(await page.getAttribute('#show-system .chip.active', 'data-show-system'), 'pendulum', `${tag} a reload keeps the Showcase system`);
  assert.equal(await page.inputValue('#show-terms'), 'w^2, cos(theta)');
  assert.match((await page.textContent('#show-verdict')) || '', /^MATCH/);

  // Only the three joined sources are kept, and nothing that looks like file data.
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('studio.v1.')).sort());
  assert.deepEqual(keys, ['studio.v1.fractal', 'studio.v1.showcase', 'studio.v1.sketch'], `${tag} kept keys`);
  const blob = await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('studio.v1.')).map((k) => localStorage.getItem(k)).join(''));
  assert.doesNotMatch(blob, /data:|base64|blob:/, `${tag} no file data is kept`);
  assert.deepEqual(errors, [], `${tag} no console errors (keep)`);
  await page.close();
}

async function refusalChecks(browser, view, tag) {
  const make = async (init) => {
    const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage(); const errors = []; watchErrors(page, errors);
    return { ctx, page, errors };
  };
  // Storage blocked: the Studio still draws, undoes, and says the work is not kept.
  let { ctx, page, errors } = await make(() => {
    Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
  });
  await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
  const blank = await frame(page);
  await stroke(page, [0.3, 0.3], [0.6, 0.6]); await wait(page, 800);
  assert.notEqual(await frame(page), blank, `${tag} blocked storage: drawing still works`);
  assert.match(await said(page), /^Not kept: this browser blocks site storage/, `${tag} blocked storage is said in words`);
  await page.locator('[data-action="undo"]').click(); await wait(page, 600);
  assert.equal(await frame(page), blank, `${tag} blocked storage: Undo still works`);
  assert.deepEqual(errors, [], `${tag} blocked storage: no console errors`);
  await ctx.close();
  // A cap smaller than the sketch: refused visibly, with the size.
  ({ ctx, page, errors } = await make(() => { window.__studioKeepMaxBytes = 300; }));
  await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
  await stroke(page, [0.3, 0.3], [0.6, 0.6]); await wait(page, 800);
  assert.match(await said(page), /^Not kept: Sketch is \d+ KB, over the 1 KB kept per source/, `${tag} over the cap is said with the size`);
  await ctx.close();
  // An entry this version cannot read: set aside, and said.
  ({ ctx, page, errors } = await make(() => { try { localStorage.setItem('studio.v1.sketch', '{not json'); } catch (_) {} }));
  await page.goto(`${base}/studio.html?source=sketch`); await wait(page, 3500);
  assert.match(await said(page), /could not be read, so this source started fresh/, `${tag} an unreadable entry is said`);
  assert.deepEqual(errors, [], `${tag} unreadable entry: no console errors`);
  await ctx.close();
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      await foldChecks(ctx, tag);
      await ctx.close();
      const kctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      await keepChecks(kctx, tag);
      await kctx.close();
      await refusalChecks(browser, view, tag);
      console.log(`${tag} studio keep and readings fold: pass`);
    }
  } catch (err) {
    failures++;
    console.error(err);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})();
