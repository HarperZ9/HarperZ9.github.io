// Night School in a real browser, at desktop and phone widths: nothing loads before a press; the
// film mounts, plays forward and shows captions from its timing; the lab mounts, trains, and its
// status reports a step count and a held-out loss computed by the run; the page throws no errors
// and never scrolls sideways. SHOTS=dir saves screenshots (canvas readbacks) for a person to look at.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8810';
const shots = process.env.SHOTS || '';
// WebGPU on SwiftShader; compositing and 2D canvas on the CPU, so no GPU is touched.
const ARGS = ['--enable-unsafe-webgpu', '--use-webgpu-adapter=swiftshader', '--disable-gpu-compositing', '--disable-accelerated-2d-canvas', '--disable-gpu-rasterization'];

async function save(page, sel, name) {
  if (!shots) return;
  const url = await page.$eval(sel, (c) => c.toDataURL('image/png'));
  fs.writeFileSync(path.join(shots, name), Buffer.from(url.split(',')[1], 'base64'));
}

async function check(browser, width, force2d) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } });
  ctx.setDefaultTimeout(120000);
  if (force2d) await ctx.addInitScript(() => { Object.defineProperty(navigator, 'gpu', { get: () => undefined }); });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${base}/night-school-attention.html`, { waitUntil: 'networkidle' });
  assert.equal(await page.locator('[data-school] canvas').count(), 0, 'no lesson canvas before a press');
  const tag = `${width}-${force2d ? '2d' : 'gpu'}`;

  await page.click('[data-school="film"] [data-school-open]');
  await page.waitForSelector('[data-school="film"] canvas', { timeout: 60000 });
  await page.waitForFunction(() => /^0:0[3-9]|^0:[1-5]/.test(document.querySelector('.sf-time')?.textContent || ''), null, { timeout: 90000 });
  // Jump to the inside of the lamp and check a caption is shown.
  await page.$eval('.sf-scrub', (s) => { s.value = '187'; s.dispatchEvent(new Event('input')); });
  await page.waitForTimeout(2500);
  const cap = await page.textContent('.sf-cap');
  assert.ok(cap && cap.length > 10, `${tag}: a caption shows at 3:07 (got "${cap}")`);
  await save(page, '[data-school="film"] canvas', `film-${tag}.png`);
  await page.$eval('.sf-bar button', (b) => b.click());

  await page.click('[data-school="lab"] [data-school-open]');
  await page.waitForSelector('[data-school="lab"] canvas', { timeout: 60000 });
  await page.click('[data-school="lab"] .ns-go');
  await page.waitForFunction(() => /Step ([1-9]\d{2,})/.test(document.querySelector('.lab .ns-status')?.textContent || ''), null, { timeout: 180000 });
  const status = await page.textContent('.lab .ns-status');
  assert.match(status, /Held-out loss \d+\.\d\d/, `${tag}: the lab reports a held-out loss`);
  await save(page, '[data-school="lab"] canvas', `lab-${tag}.png`);
  if (shots) await page.screenshot({ path: path.join(shots, `page-${tag}.png`), fullPage: false });
  const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(wide <= 1, `${tag}: the page scrolls sideways by ${wide}px`);
  assert.deepEqual(errors, [], `${tag}: page errors`);
  console.log(`${tag}: ok. ${status.slice(0, 120)}`);
  await ctx.close();
}

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', args: ARGS });
  try {
    // NS_MODES=2d runs only the Canvas 2D paths (CI runners cannot present a SwiftShader WebGPU canvas).
    const all = [[1280, false], [375, false], [1280, true], [375, true]];
    for (const [w, f] of process.env.NS_MODES === '2d' ? all.filter((x) => x[1]) : all) await check(browser, w, f);
    const idx = await browser.newPage();
    await idx.goto(`${base}/night-school.html`, { waitUntil: 'networkidle' });
    assert.ok(await idx.locator('a[href="night-school-attention.html"]').count() >= 1, 'the school links its lesson');
    console.log('night-school.html: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
