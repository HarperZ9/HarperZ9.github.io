// The front page's dial, Distill's stages and the walk through the places, in a real browser.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/distill-front.cjs
//
// Holds:
//   1. The dial lists The Playground first, then the seven other pillars, numbered 00 to 07, and the list, the
//      panels and the keyboard order agree. No entry is named Distill or The engine.
//   2. /#w-distill and /#w-engine both open The Playground; the first opens it on Distill.
//   3. The page's fixed Distill example is what the code gives: pressing Run on the example leaves the swatches,
//      their shares and the difference sentence exactly as the page shipped them, and draws all four stages.
//   4. A visitor's own picture runs the same stages in the tab, and no request leaves for it.
//   5. Distill's code and Motion are not fetched before they are used.
//   6. The walk: a place's piece is clipped while it arrives, whole when settled, and the same going back up.
//      Under reduced motion nothing is bound and every piece shows whole.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const NAMES = ['The Playground', 'BuildLang', 'Flywheel', 'CMMNS', 'Articulate', 'Low Water', 'Essays and films', 'Work and CV'];
const IDS = ['engine', 'buildlang', 'flywheel', 'commons', 'articulate', 'low-water', 'writing', 'work'];

// a 64 by 64 picture in two flat colours, as PNG bytes, made in the page
const twoColours = (page) => page.evaluate(async () => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  x.fillStyle = '#2040c0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#e0a020'; x.fillRect(0, 0, 32, 64);
  const b = await new Promise((r) => c.toBlob(r, 'image/png')); return [...new Uint8Array(await b.arrayBuffer())];
});
const place = (page, id, prog) => page.evaluate(([id, prog]) => {
  const f = document.querySelector(`#p-${id} .lead-box`), r = f.getBoundingClientRect();
  scrollTo(0, r.top + scrollY - innerHeight + prog * (innerHeight + r.height));
}, [id, prog]);
const clipOf = (page, id) => page.evaluate((id) => getComputedStyle(document.querySelector(`#p-${id} .lead-piece`)).clipPath, id);

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined, headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage(), errors = [], asked = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('request', (r) => asked.push({ url: new URL(r.url()).pathname, method: r.method() }));
    // films are not part of this test, and a local server with six connections would queue scripts behind them
    await page.route(/\.(mp4|webm|m4a|mp3)(\?|$)/, (r) => r.abort());
    await page.goto(`${base}/`, { waitUntil: 'load' });
    await page.waitForSelector('#dial.w-live');

    // 1. names, numbers, order
    const list = await page.$$eval('#dial .w-list a[data-pillar]', (as) => as.map((a) => ({ id: a.dataset.pillar, num: a.querySelector('.w-num').textContent, name: a.textContent.replace(/^\s*\d+\s*/, '').trim(), sel: a.getAttribute('aria-selected') })));
    assert.deepEqual(list.map((l) => l.name), NAMES);
    assert.deepEqual(list.map((l) => l.id), IDS);
    assert.deepEqual(list.map((l) => l.num), IDS.map((_, i) => String(i).padStart(2, '0')));
    assert.equal(list[0].sel, 'true', 'The Playground is open first');
    assert.deepEqual(await page.$$eval('#dial .w-panel', (ps) => ps.map((p) => p.id)), IDS.map((id) => `w-${id}`));
    assert.equal(await page.$$eval('#dial .w-svg .moon', (m) => m.length), IDS.length - 1, 'one moon for each pillar after the hub');
    // the keyboard walks the same order and comes back
    await page.focus('#dial .w-list a[aria-selected="true"]');
    for (let i = 1; i < IDS.length; i++) {
      await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.pillar), IDS[i]);
      assert.ok(await page.$eval(`#w-${IDS[i]}`, (p) => p.classList.contains('open')), `${IDS[i]} opens from the keyboard`);
    }
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.pillar), 'engine');
    assert.equal(await page.$eval('#w-engine .w-choices button[aria-pressed="true"]', (b) => b.textContent), 'Distill');

    // 2. addresses
    await page.evaluate(() => { document.querySelector('#w-engine .w-choices button[data-show="2"]').click(); location.hash = '#w-flywheel'; });
    await page.waitForFunction(() => document.querySelector('#w-flywheel').classList.contains('open'));
    await page.evaluate(() => { location.hash = '#w-distill'; });
    await page.waitForFunction(() => document.querySelector('#w-engine').classList.contains('open'));
    assert.equal(await page.$eval('#w-engine .w-choices button[aria-pressed="true"]', (b) => b.textContent), 'Distill');
    assert.ok(await page.$eval('#w-distill', (e) => e.offsetParent !== null), 'the Distill stages are shown');

    // 5a. nothing of Distill's code or of Motion has been fetched yet
    assert.ok(!asked.some((r) => /picture-panel\.js|study\/palette\.mjs|weave-engine/.test(r.url)), 'Distill code was fetched before a press');
    assert.ok(!asked.some((r) => /web\/motion\//.test(r.url)), 'Motion was fetched before the places came near');

    // 3. the fixed example is the code's own answer
    const read = () => page.evaluate(() => ({
      swatches: [...document.querySelectorAll('#w-distill .w-strip li')].map((li) => li.textContent.replace(/\s+/g, ' ').trim()),
      parts: document.querySelector('#w-distill [data-words="parts"]').textContent, difference: document.querySelector('#w-distill [data-words="difference"]').textContent,
    }));
    const shipped = await read(), overlayShipped = await page.$eval('#w-distill [data-overlay]', (e) => e.innerHTML);
    assert.ok(shipped.swatches.length >= 2 && /^#[0-9a-f]{6} \d+\.\d%$/.test(shipped.swatches[0]), `swatch rows read as hex and share: ${shipped.swatches[0]}`);
    await page.click('#w-distill [data-run]');
    await page.waitForFunction(() => document.querySelector('#w-distill').dataset.ran === 'example', null, { timeout: 30000 });
    assert.deepEqual(await read(), shipped, 'a live run on the example changed the words the page shipped');
    const drawn = await page.evaluate(() => Object.fromEntries(['source', 'onpicture', 'original', 'rebuilt', 'cloth'].map((n) => {
      const c = document.querySelector(`#w-distill [data-slot="${n}"] canvas`); if (!c) return [n, null];
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; const seen = new Set(); for (let i = 0; i < d.length; i += 4 * 97) seen.add((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
      return [n, { w: c.width, h: c.height, colours: seen.size, label: c.getAttribute('aria-label') }];
    })));
    for (const [n, c] of Object.entries(drawn)) { assert.ok(c && c.w > 0 && c.h > 0, `${n} was not drawn`); assert.ok(c.colours > 1, `${n} is one flat colour`); assert.ok(c.label, `${n} has no text alternative`); }
    assert.ok(drawn.rebuilt.colours <= shipped.swatches.length, 'the rebuild holds a colour that is not a swatch');
    assert.equal(await page.$$eval('#w-distill [data-overlay] .ds4-shares i', (e) => e.length), shipped.swatches.length, 'one share on the picture for each swatch');
    assert.equal(await page.$eval('#w-distill [data-overlay]', (e) => e.innerHTML), overlayShipped, 'a live run changed what is laid on the picture');
    assert.match(await page.$eval('#w-distill [data-status]', (e) => e.textContent), /ran in this tab in \d+ milliseconds on the example\. Nothing was uploaded\./);

    // 4. a visitor's own picture: two flat colours give two swatches of half each and a rebuild with no difference
    const before = asked.length;
    await page.setInputFiles('#w-distill [data-file]', { name: 'two.png', mimeType: 'image/png', buffer: Buffer.from(await twoColours(page)) });
    await page.waitForFunction(() => document.querySelector('#w-distill').dataset.ran === 'own', null, { timeout: 30000 });
    const own = await read();
    assert.deepEqual(own.swatches.map((s) => s.split(' ')[1]), ['50.0%', '50.0%']);
    assert.match(own.difference, /bring back 100 percent/); assert.match(own.difference, /No part of the picture is off by more than 10/);
    assert.ok(!asked.slice(before).some((r) => r.method !== 'GET'), 'a request left the tab with the picture');
    assert.match(await page.$eval('#w-distill [data-words="source"]', (e) => e.textContent), /^two\.png, read at 64 by 64 pixels\.$/);

    // 6. the walk
    await place(page, 'mosaic', 0.2);
    await page.waitForFunction(() => document.querySelector('#p-mosaic .lead-piece').getAnimations().length === 1 || document.querySelector('#p-mosaic .lead-piece').style.clipPath, null, { timeout: 15000 });
    assert.ok(asked.some((r) => /web\/motion\/transitions\.mjs/.test(r.url)), 'Motion arrives as the places come near');
    await page.waitForTimeout(200);
    const arriving = await clipOf(page, 'mosaic');
    assert.match(arriving, /^polygon\(/, 'the arriving piece is clipped by its transition');
    await place(page, 'mosaic', 0.5); await page.waitForTimeout(200);
    const settled = await clipOf(page, 'mosaic');
    assert.notEqual(settled, arriving);
    const whole = await page.evaluate(() => { const e = document.querySelector('#p-mosaic .lead-piece'), r = e.getBoundingClientRect(); return [[2, 2], [r.width - 2, 2], [2, r.height - 2], [r.width - 2, r.height - 2], [r.width / 2, r.height / 2]].every(([x, y]) => e.contains(document.elementFromPoint(r.left + x, r.top + y)) || document.elementFromPoint(r.left + x, r.top + y)?.closest('.o-hand')); });
    assert.ok(whole, 'the settled piece shows whole, corner to corner');
    await place(page, 'mosaic', 0.2); await page.waitForTimeout(200);
    assert.equal(await clipOf(page, 'mosaic'), arriving, 'going back up gives the same frame');
    assert.equal(await page.$$eval('.place .lead-piece[data-walk]', (e) => e.length), 10);
    assert.equal(await page.$$eval('.place .lead-cap', (e) => e.filter((c) => c.textContent.trim().length > 20).length), 10, 'every place says what its piece is');
    assert.deepEqual(errors, []);
    await ctx.close();

    // reduced motion: nothing bound, every piece whole
    const calm = await browser.newContext({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
    const p2 = await calm.newPage(); await p2.route(/\.(mp4|webm|m4a|mp3)(\?|$)/, (r) => r.abort()); await p2.goto(`${base}/`, { waitUntil: 'load' });
    await place(p2, 'mosaic', 0.2); await p2.waitForTimeout(1200);
    assert.deepEqual(await p2.$$eval('.place .lead-piece', (es) => es.map((e) => e.getAnimations().length + (getComputedStyle(e).clipPath === 'none' ? 0 : 1))), Array(10).fill(0));
    await calm.close();
    console.log('distill-front: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
