// The drawn pointer in the browser: the cursor each kind of element gets in each setting, the system pointer where it
// must stay (Plain view, forced colours, touch), the off switch that persists, and keyboard focus left as it was.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/pointer.cjs
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';

// a fixture of every kind of element the pointer distinguishes, added to the real page
const FIXTURE = `<div id="ptr-fx" style="position:fixed;left:0;bottom:0;z-index:9">
  <a id="fx-a" href="#x">a link</a><button id="fx-b" type="button">a button</button><button id="fx-d" type="button" disabled>off</button>
  <input id="fx-t" type="text"><textarea id="fx-ta"></textarea><input id="fx-r" type="range"><div id="fx-busy" aria-busy="true">busy</div>
  <p id="fx-p">plain words</p><div data-hue="thecmmns"><a id="fx-h" href="#y">a CMMNS link</a></div></div>`;

const cursorOf = (page, id) => page.evaluate((i) => getComputedStyle(document.getElementById(i)).cursor, id);
const img = (c) => (c.match(/pointer\/([a-z0-9]+-[a-z]+(?:-\d)?)\.png/) || [])[1] || null;

async function open(browser, opts = {}, path = '/') {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => got.push(new URL(r.url()).pathname));
  await page.goto(base + path, { waitUntil: 'load' });
  await page.evaluate((html) => document.body.insertAdjacentHTML('beforeend', html), FIXTURE);
  return { ctx, page, errors, got };
}
const ready = (page) => page.waitForFunction(() => document.documentElement.classList.contains('ptr') && [...document.styleSheets].some((s) => s.href && s.href.includes('/pointer/pointer.css') && s.cssRules.length));

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    // 1: each element type, in each setting
    {
      const { ctx, page, errors } = await open(browser, { colorScheme: 'light' });
      await ready(page);
      const want = { 'fx-p': ['day-rest', 'auto'], 'fx-a': ['day-give', 'pointer'], 'fx-b': ['day-give', 'pointer'], 'fx-d': ['day-rest', 'not-allowed'], 'fx-t': ['day-text', 'text'], 'fx-ta': ['day-text', 'text'], 'fx-r': ['day-reach', 'grab'], 'fx-busy': ['day-busy-0', 'progress'], 'fx-h': ['thecmmns-give', 'pointer'] };
      for (const [id, [name, kw]] of Object.entries(want)) {
        const c = await cursorOf(page, id);
        assert.equal(img(c), name, `${id}: ${c}`);
        assert.ok(c.trim().endsWith(kw), `${id} keeps the system keyword ${kw} after its image: ${c}`);
        assert.match(c, /@2x\.png/, `${id} offers the 2x image`);
      }
      const hot = await cursorOf(page, 'fx-a');
      assert.match(hot, /\) 6 6, pointer$/, `the stylus's hot spot is its tip, 6 6: ${hot}`);
      assert.match(await cursorOf(page, 'fx-t'), /\) 16 16, text$/);
      // night by the lamp, then by the system; sky while Sky is on
      await page.evaluate(() => { document.documentElement.dataset.theme = 'dark'; });
      assert.equal(img(await cursorOf(page, 'fx-a')), 'night-give');
      assert.equal(img(await cursorOf(page, 'fx-h')), 'thecmmns-give', 'a platform keeps its lacquer at night');
      await page.evaluate(() => { delete document.documentElement.dataset.theme; });
      await page.emulateMedia({ colorScheme: 'dark' });
      assert.equal(img(await cursorOf(page, 'fx-p')), 'night-rest');
      await page.evaluate(() => document.documentElement.toggleAttribute('data-ptr-sky', true));
      assert.equal(img(await cursorOf(page, 'fx-t')), 'sky-text');
      // every image the stylesheet names is served
      const urls = await page.evaluate(() => [...new Set([...document.styleSheets].filter((s) => s.href?.includes('pointer.css')).flatMap((s) => [...s.cssRules].map((r) => r.cssText)).join(' ').match(/\/world\/ui\/shell\/pointer\/[^)"]+\.png/g))]);
      assert.ok(urls.length >= 96, `the stylesheet names ${urls.length} images`);
      for (const u of urls) assert.equal((await page.request.get(base + u)).status(), 200, u);
      // Plain view: the system pointer
      await page.evaluate(() => document.documentElement.classList.add('plain'));
      for (const id of ['fx-p', 'fx-a', 'fx-t']) assert.doesNotMatch(await cursorOf(page, id), /url\(/, `${id} in Plain view`);
      assert.equal(await page.locator('.ptr-glow').count(), 0, 'no glow in Plain view');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 2: forced colours and touch keep the system pointer and never fetch the pointer's code
    for (const [what, opts] of [['forced colours', { forcedColors: 'active' }], ['touch', { hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } }]]) {
      const { ctx, page, errors, got } = await open(browser, opts);
      await page.waitForTimeout(800);
      assert.ok(!got.some((p) => p.endsWith('/ui/shell/pointer.js')), `${what}: pointer.js was fetched`);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ptr')), false, what);
      assert.doesNotMatch(await cursorOf(page, 'fx-a'), /url\(/, what);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 3: the off switch in the Places menu, kept across a reload; keyboard focus is the same with the pointer on and off
    {
      const { ctx, page, errors } = await open(browser, { colorScheme: 'light' });
      await ready(page);
      const ring = () => page.evaluate(() => { const a = document.getElementById('fx-a'); a.focus({ focusVisible: true }); const s = getComputedStyle(a); return [s.outlineStyle, s.outlineWidth, s.outlineColor, document.activeElement === a]; });
      const before = await ring();
      await page.keyboard.press('Escape');
      await page.evaluate(() => document.activeElement.blur());
      await page.keyboard.press('m');
      const sw = page.locator('dialog[open] .o-menu-foot .o-ptr');
      await sw.waitFor();
      assert.equal(await sw.textContent(), 'Drawn pointer');
      assert.equal(await sw.getAttribute('aria-pressed'), 'true');
      await sw.click();
      assert.equal(await sw.getAttribute('aria-pressed'), 'false');
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ptr')), false);
      assert.equal(await page.evaluate(() => localStorage.getItem('ui-pointer')), 'off');
      await page.keyboard.press('Escape');
      assert.doesNotMatch(await cursorOf(page, 'fx-a'), /url\(/, 'off: the system pointer');
      const after = await ring();
      assert.deepEqual(after, before, 'keyboard focus looks the same with the drawn pointer off');
      await page.reload({ waitUntil: 'load' });
      await page.waitForTimeout(500);
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ptr')), false, 'the off switch persists');
      await page.keyboard.press('m');
      await sw.waitFor();
      assert.equal(await sw.getAttribute('aria-pressed'), 'false');
      await sw.click();
      assert.equal(await page.evaluate(() => document.documentElement.classList.contains('ptr')), true, 'and turns back on');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 4: the glow follows a mouse with motion on, and is absent under reduced motion
    {
      const { ctx, page } = await open(browser, { colorScheme: 'light', reducedMotion: 'no-preference' });
      await ready(page);
      await page.mouse.move(400, 300);
      await page.waitForFunction(() => /translate3d\(400px, 300px/.test(document.querySelector('.ptr-glow')?.style.transform || ''));
      await ctx.close();
      const r = await open(browser, { colorScheme: 'light', reducedMotion: 'reduce' });
      await ready(r.page);
      await r.page.mouse.move(400, 300);
      await r.page.waitForTimeout(200);
      assert.equal(await r.page.locator('.ptr-glow').count(), 0, 'no glow under reduced motion');
      await r.ctx.close();
    }
    console.log('pointer: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
