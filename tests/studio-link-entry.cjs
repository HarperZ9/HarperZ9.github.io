// A still source opened by link draws its own frame at every width (9 October 2026). The hands-on
// audit found Poster, Plot maps and Voxels on a black stage at 1280, 1440 and 1920 px when reached
// by ?source=: a boot-time stage resize cleared the backing and nothing repainted a still sheet.
// Phones were unaffected. This opens each by link at four sizes and counts lit pixels on the stage.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop-1280', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: 'desktop-1440', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'desktop-1920', viewport: { width: 1920, height: 1080 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const SOURCES = ['poster', 'plotmaps', 'voxels', 'sketch'];

async function lit(page) {
  return page.evaluate(() => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) n++;
    return n / (d.length / 4);
  });
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      for (const src of SOURCES) {
        const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
        try {
          await page.goto(`${base}/studio.html?source=${src}`, { waitUntil: 'load' });
          // Wait past the boot resize (debounced 200 ms) and any late font.
          await page.waitForFunction(() => document.getElementById('viewport-stage').classList.contains('is-painted'), null, { timeout: 15000 });
          await page.waitForTimeout(2500);
          const share = await lit(page);
          assert.ok(share > 0.05, `${src} opened by link shows a black stage (lit ${share.toFixed(3)})`);
          assert.deepEqual(errors, [], `${src}: console errors`);
          console.log(`ok [${view.name}] ${src} lit ${share.toFixed(3)}`);
        } catch (e) {
          failures++;
          console.error(`FAIL [${view.name}] ${src}: ${e.message}`);
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
  console.log('studio-link-entry: all sources draw by link');
})().catch((e) => { console.error(e); process.exit(1); });
