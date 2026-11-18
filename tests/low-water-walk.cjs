// The island of Low Water on /low-water.html, in a browser (#island).
//
//   python tests/lib/serve.py 8813 . &   SITE_BASE_URL=http://127.0.0.1:8813 node tests/low-water-walk.cjs
//   LW_WALK=1 also opens the walk itself. It needs a browser with a WebGPU adapter: installed Chrome
//   (BROWSER_CHANNEL=chrome) with LW_GPU_FLAGS=1 on a machine with a GPU. The CI runner has none, so there the walk
//   part is skipped by name and the rest runs.
//   SHOTS=dir saves the page at 375, 1280 and 2560 wide, and with LW_WALK=1 the open walk.
//
// What it holds:
//   1. Before a press the page fetches nothing of the walk: no frame page, no walk code, no GPU host, no tiles.
//      The three pictures and the plate are WebP, and every still is lazy.
//   2. Without WebGPU (navigator.gpu taken away) every walk button is off and the line under the pictures says the
//      walk needs WebGPU; the pictures, the plate and the fifteen stills stay, each with a text alternative.
//   3. With WebGPU and LW_WALK=1: the keyboard alone opens the walk in a full-window frame; the press fetches no more
//      than the bytes the page states; the walk says where you stand in words; Back to the page closes the frame,
//      removes it and returns focus to the button that opened it. With reduced motion the walk opens with its clock held.
//   4. 375 px: no sideways scroll, every walk button at least 44 px tall.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8813';
const WALK = /\/media\/low-water\/(walk\.html|walk-frame\.mjs|world-cac3416\/)|\/media\/raw-native\/web-sf-cac3416\//;
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-features=Vulkan'];
const out = {};

async function open(browser, opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errors = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // every response the page and its frames receive, with the bytes of its body
  // walk: the request came from the walk's frame (or is the frame page itself), so it is part of what a press costs
  page.on('requestfinished', async (r) => { try { const p = new URL(r.url()).pathname, s = await r.sizes(), fr = r.frame();
    got.push({ path: p, bytes: s.responseBodySize, walk: WALK.test(p) || fr !== page.mainFrame() }); } catch { /* gone with its frame */ } });
  await page.goto(base + '/low-water.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-toy="walk"]')?.dataset.gpu);
  return { ctx, page, errors, got };
}
const stated = (text) => { const m = /downloads ([\d.]+) MB/.exec(text); return m ? Math.round(+m[1] * 1e6) : NaN; };
// down the page a screen at a time, so every lazy picture is asked for, then back to the top
const scrollAll = async (page) => { await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 60)); } }); await page.waitForLoadState('networkidle'); await page.evaluate(() => scrollTo(0, 0)); };
const shoot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.SHOTS, name), fullPage: !/walk/.test(name) }); } };

(async () => {
  const live = process.env.LW_WALK === '1';
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
    ...(process.env.LW_GPU_FLAGS === '1' ? { headless: true, args: ['--headless=new', ...GPU_FLAGS] } : {}) });
  try {
    { // 1 and 2: before a press, and a browser without WebGPU
      const { ctx, page, errors, got } = await open(browser, {}, () => { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }); });
      await scrollAll(page);
      assert.deepEqual(got.filter((g) => WALK.test(g.path)).map((g) => g.path), [], 'nothing of the walk loads before a press');
      assert.equal(await page.getAttribute('[data-toy="walk"]', 'data-gpu'), 'none');
      assert.equal(await page.locator('#island button[data-start]:not([disabled])').count(), 0, 'without WebGPU every walk button is off');
      assert.equal(await page.locator('#island .lw-go:not([hidden])').count(), 0, 'and hidden');
      assert.equal(await page.locator('#island button[data-start]').count(), 3);
      assert.match(await page.textContent('#island .lw-walk-state'), /needs WebGPU/);
      const imgs = await page.evaluate(() => [...document.querySelectorAll('#island img')].map((i) => ({ src: i.currentSrc || i.src, alt: i.alt, lazy: i.loading })));
      assert.equal(imgs.length, 3 + 1 + 15, 'three pictures, the plate and fifteen stills');
      assert.ok(imgs.every((i) => /\.webp$/.test(i.src) && i.alt.length > 20), 'every picture is WebP with words');
      assert.ok(imgs.slice(3).every((i) => i.lazy === 'lazy'), 'the plate and the stills wait until they are near');
      assert.ok(await page.evaluate(() => [...document.querySelectorAll('#island img')].every((i) => i.complete && i.naturalWidth > 0)), 'every picture loads');
      out.beforePress = got.reduce((n, g) => n + g.bytes, 0);
      await shoot(page, 'low-water-1280.png');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    for (const w of [2560]) { // the wide screen, as a picture only
      if (!process.env.SHOTS) break;
      const { ctx, page } = await open(browser, { viewport: { width: w, height: 1440 } });
      await scrollAll(page);
      await shoot(page, `low-water-${w}.png`); await ctx.close();
    }
    if (live) { // 3: the walk
      const { ctx, page, errors, got } = await open(browser, { viewport: { width: 1280, height: 720 } });
      assert.equal(await page.getAttribute('[data-toy="walk"]', 'data-gpu'), 'yes', 'LW_WALK=1 needs a WebGPU adapter');
      const limit = stated(await page.textContent('#island .lw-walk-state')), before = got.length;
      await page.focus('#island button[data-start]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => /walk is open/.test(document.querySelector('#island .lw-walk-state').textContent), null, { timeout: 90000 });
      assert.equal(await page.evaluate(() => document.querySelector('.lw-walk-frame').open), true);
      const frame = page.frameLocator('.lw-walk-frame iframe'), f = page.frames().find((x) => /walk\.html/.test(x.url()));
      const box = await page.locator('.lw-walk-frame iframe').boundingBox();
      assert.ok(box.width === 1280 && box.height === 720, `the walk fills the window: ${box.width} x ${box.height}`);
      await f.evaluate(() => globalThis.__lwWorld.settle(30));
      await page.waitForTimeout(500);
      const spent = got.slice(before).filter((g) => g.walk).reduce((n, g) => n + g.bytes, 0);
      out.press = { spent, limit, requests: got.slice(before).filter((g) => g.walk).length };
      assert.ok(spent > 0 && spent <= limit, `the press fetched ${spent} bytes; the page states ${limit}`);
      await f.waitForFunction(() => /^You are in the Fog Forest/.test(document.getElementById('said').textContent), null, { timeout: 10000 });
      out.said = await frame.locator('#said').textContent();
      await shoot(page, 'low-water-walk-1280.png');
      await frame.locator('#leave').click();
      await page.waitForFunction(() => !document.querySelector('.lw-walk-frame').open && !document.querySelector('.lw-walk-frame iframe'));
      assert.equal(await page.evaluate(() => document.activeElement.dataset.start !== undefined), true, 'focus returns to the button');
      assert.deepEqual(errors, []);
      await ctx.close();
      // reduced motion: the walk opens with its clock held
      const r = await open(browser, { viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
      await r.page.click('#island button[data-start]');
      await r.page.waitForFunction(() => /walk is open/.test(document.querySelector('#island .lw-walk-state').textContent), null, { timeout: 90000 });
      const rf = r.page.frames().find((x) => /walk\.html/.test(x.url()));
      assert.match(rf.url(), /still=1/);
      const c0 = await rf.evaluate(() => globalThis.__lwWorld.time.clock); await r.page.waitForTimeout(800);
      assert.equal(await rf.evaluate(() => globalThis.__lwWorld.time.clock), c0, 'reduced motion: the clock holds');
      await r.ctx.close();
    } else console.log('low-water-walk: the walk itself is skipped (set LW_WALK=1 on a machine with a WebGPU adapter)');
    { // 4: a phone
      const { ctx, page, errors } = await open(browser, { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });
      await scrollAll(page);
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: [...document.querySelectorAll('#island button[data-start]')].filter((e) => e.offsetParent && e.getBoundingClientRect().height < 44).length }));
      assert.equal(m.over, 0, 'no sideways scroll at 375 px'); assert.equal(m.small, 0, 'every walk button is at least 44 px tall');
      await shoot(page, 'low-water-375.png');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    console.log('low-water-walk: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
