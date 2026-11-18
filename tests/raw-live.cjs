// The native renderer on /raw.html, in a browser.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/raw-live.cjs
//   RAW_LIVE=1 also opens the renderer. It needs a WebGPU adapter: installed Chrome (BROWSER_CHANNEL=chrome) with
//   RAW_GPU_FLAGS=1 on a machine with a GPU. The CI runner has none, so there that part is skipped by name.
//   SHOTS=dir saves the page at 375, 1280 and 2560 wide.
//
// What it holds:
//   1. Before a press the page fetches nothing of the renderer: no frame page, no engine code, no scene.
//   2. Without WebGPU every renderer button is off and the line under the pictures says it needs WebGPU; the
//      pictures stay, each with a text alternative, and the certificate check still draws on the CPU.
//   3. With WebGPU and RAW_LIVE=1: the keyboard opens the renderer full-window on the test scene; it says it started;
//      once still, the panel reports the frame against the path-traced reference and GTAO against ray-traced AO; a
//      pass turned off changes the frame's measure; Back to the page closes the frame and returns focus.
//   4. 375 px: no sideways scroll, every renderer button at least 44 px tall.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const HEAVY = /\/media\/raw-native\/(live\/|assets\/|web-sf-cac3416\/)/;
const GPU_FLAGS = ['--enable-unsafe-webgpu', '--enable-gpu', '--ignore-gpu-blocklist'];

async function open(browser, opts = {}, init) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage(), errors = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => got.push(new URL(r.url()).pathname));
  await page.goto(base + '/raw.html', { waitUntil: 'load' });
  await page.waitForFunction(() => document.querySelector('[data-toy="engine"]')?.dataset.gpu);
  return { ctx, page, errors, got };
}
const shoot = async (page, name) => { if (process.env.SHOTS) { fs.mkdirSync(process.env.SHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.SHOTS, name) }); } };

(async () => {
  const live = process.env.RAW_LIVE === '1';
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}),
    ...(process.env.RAW_GPU_FLAGS === '1' ? { headless: true, args: ['--headless=new', ...GPU_FLAGS] } : {}) });
  try {
    { // 1 and 2
      const { ctx, page, errors, got } = await open(browser, {}, () => { try { Object.defineProperty(Navigator.prototype, 'gpu', { get: () => undefined }); } catch { /* no gpu to take */ } });
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight / 2) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 50)); } });
      await page.waitForLoadState('networkidle');
      const heavy = got.filter((p) => HEAVY.test(p));
      assert.deepEqual(heavy, [], `nothing of the renderer before a press: ${heavy.join(', ')}`);
      const s = await page.evaluate(() => { const b = document.querySelector('[data-toy="engine"]');
        return { gpu: b.dataset.gpu, shown: [...b.querySelectorAll('.lw-go')].filter((p) => !p.hidden).length, off: [...b.querySelectorAll('button[data-start]')].every((x) => x.disabled),
          said: b.querySelector('.lw-walk-state').textContent, alts: [...document.querySelectorAll('main img')].filter((i) => !i.getAttribute('alt')).map((i) => i.src) }; });
      assert.equal(s.gpu, 'none'); assert.equal(s.shown, 0); assert.ok(s.off, 'every renderer button is off');
      assert.match(s.said, /needs WebGPU/);
      assert.deepEqual(s.alts, [], 'every picture has a text alternative');
      // the certificate check runs on the CPU
      await page.waitForFunction(() => /Render: ok/.test(document.getElementById('rn-status')?.textContent || ''), null, { timeout: 90000 });
      assert.deepEqual(errors, []);
      console.log('raw-live: before a press, no renderer bytes; without WebGPU the buttons are off and the certificate drew on the CPU');
      await ctx.close();
    }
    { // 4, and the pictures for review
      for (const w of [375, 1280, 2560]) {
        const { ctx, page } = await open(browser, { viewport: { width: w, height: 900 } });
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(sideways <= 0, `${w} px: no sideways scroll (${sideways} px)`);
        if (w === 375) {
          const small = await page.evaluate(() => [...document.querySelectorAll('[data-toy="engine"] button')].filter((b) => !b.closest('[hidden]') && b.getBoundingClientRect().height < 44).length);
          assert.equal(small, 0, '375 px: every renderer button at least 44 px tall');
        }
        await shoot(page, `raw-${w}.png`);
        await ctx.close();
      }
      console.log('raw-live: 375, 1280 and 2560 wide without sideways scroll');
    }
    if (!live) { console.log('raw-live: the live renderer part is skipped (RAW_LIVE is not 1; it needs a WebGPU adapter)'); return; }
    { // 3
      const { ctx, page, errors } = await open(browser);
      assert.equal(await page.evaluate(() => document.querySelector('[data-toy="engine"]').dataset.gpu), 'yes', 'this browser offers WebGPU');
      const btn = page.locator('button[data-start="scene=test"]');
      await btn.focus(); await page.keyboard.press('Enter');
      await page.waitForFunction(() => /renderer is open/.test(document.querySelector('.lw-walk-state').textContent), null, { timeout: 60000 });
      const f = page.frameLocator('.lw-walk-frame iframe');
      const report = () => f.locator('#rl-frame-err').textContent();
      await f.locator('#rl-frame-err').filter({ hasText: /path-traced reference, \d+ samples/ }).waitFor({ timeout: 60000 });
      await f.locator('.rl-m[data-m="ao"]').filter({ hasText: /GTAO against ray-traced AO/ }).waitFor({ timeout: 60000 });
      const before = await report();
      await f.locator('#rl-passes li[data-bit="1"] input').click();   // GTAO off
      await f.locator('#rl-frame-err').filter({ hasText: /path-traced reference, \d+ samples/ }).waitFor({ timeout: 60000 });
      await page.waitForTimeout(2000);
      const after = await report();
      const num = (t) => +/RMSE ([0-9.]+)/.exec(t)[1];
      assert.notEqual(num(after), num(before), `GTAO off changes the frame's measure (${num(before)} -> ${num(after)})`);
      await f.locator('#leave').click();
      await page.waitForFunction(() => !document.querySelector('.lw-walk-frame iframe') && document.activeElement?.dataset?.start === 'scene=test');
      assert.deepEqual(errors, []);
      console.log(`raw-live: the renderer opened, measured (${num(before)} with GTAO, ${num(after)} without) and closed`);
      await ctx.close();
    }
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
