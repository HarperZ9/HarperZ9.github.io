// The Verified viewer source (12 October 2026), at desktop and phone widths. The stage holds
// raw-native's own viewer page from the pinned release. With WebGPU, the rail's raw-hero button
// renders raw-hero through the page and the certificate reads verified; without it, the page says
// WebGPU is not available. Leaving the source hides the page. No console errors either way.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8807';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function pick(page, source) {
  const sw = page.locator('#source-switch'); await sw.scrollIntoViewIfNeeded(); await sw.click();
  await page.locator(`#studio-source button[data-source="${source}"]`).click();
}
const pageStatus = (page) => page.evaluate(() => {
  const f = document.getElementById('viewer-frame');
  const d = f && f.contentDocument;
  return d && d.getElementById('status') ? d.getElementById('status').textContent : null;
});

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
      await page.goto(`${base}/studio.html`); await wait(page, 4000);
      await pick(page, 'viewer');
      assert.equal(await page.evaluate(() => window.__studioActiveSource), 'viewer', `${tag} the viewer is the source`);
      const src = await page.getAttribute('#viewer-frame', 'src');
      assert.match(src, /^media\/raw-native\/viewer-\d+\.\d+\.\d+\/web\/viewer\/index\.html$/, `${tag} the stage loads the pinned release's page: ${src}`);
      // The page loads the engine and says ready, or says why it cannot render.
      await page.waitForFunction(() => {
        const d = document.getElementById('viewer-frame').contentDocument;
        const s = d && d.getElementById('status');
        return s && !/starting|loading the engine/.test(s.textContent);
      }, null, { timeout: 120000 });
      const box = await page.locator('#viewer-frame').boundingBox();
      assert.ok(box && box.width > 300 && box.height > 300, `${tag} the page fills the stage (${box && box.width} x ${box && box.height})`);
      const status = await pageStatus(page);
      const gpu = await page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
      if (gpu && status === 'ready') {
        await page.locator('#viewer-hero').click();
        await page.waitForFunction(() => {
          const s = document.getElementById('viewer-frame').contentWindow.__viewer;
          return s && s.runs && s.runs.length > 0;
        }, null, { timeout: 300000 });
        const run = await page.evaluate(() => document.getElementById('viewer-frame').contentWindow.__viewer.runs[0]);
        assert.equal(run.model, 'raw-hero.gltf', `${tag} the rail rendered raw-hero`);
        assert.equal(run.verdict, 'verified', `${tag} raw-hero is verified: ${JSON.stringify(run)}`);
        assert.ok(run.frames && run.frames.width > 0, `${tag} both frames drew`);
        await wait(page, 800);
        assert.match(await page.textContent('#viewer-status'), /raw-hero\.gltf: verified/, `${tag} the rail reads the verdict`);
      } else {
        // No adapter: the page either says WebGPU is missing, or reports ready (navigator.gpu exists
        // but gives no adapter, as on a headless runner); nothing is rendered either way.
        assert.match(status, /ready|WebGPU|error/i, `${tag} without an adapter the page reports its state: ${status}`);
      }
      await pick(page, 'atelier'); await wait(page, 1500);
      assert.equal(await page.evaluate(() => window.__studioActiveSource), 'atelier', `${tag} leaving works`);
      assert.equal(await page.locator('#viewer-stage').isHidden(), true, `${tag} leaving hides the page`);
      assert.deepEqual(errors, [], `${tag} no console errors`);
      console.log(`${tag} ok (${gpu ? 'WebGPU' : 'no WebGPU'})`);
      await ctx.close();
    }
  } catch (e) {
    failures++;
    console.error(e);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})();
