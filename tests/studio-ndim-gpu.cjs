// Dimensions on raw-native (10 October 2026), the first Studio tool moved onto raw-native's web GPU
// host, with the WebGL and 2D-canvas renderers kept as fallbacks so no browser loses the tool.
// This checks, at desktop and phone widths, with motion reduced so the pose holds still: where
// WebGPU answers, the stage is drawn by "raw-native webgpu"; its frame matches the WebGL backend's
// frame at the same pose within a small mean difference (the look is kept); ?ndim=webgl and
// ?ndim=2d pin the fallbacks; a page with WebGPU hidden draws with WebGL; every Dimensions control
// is still there; no console errors.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox
const W = require('./lib/studio-wait.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
async function pixels(page) {
  return page.evaluate(() => { const c = document.getElementById('studio-canvas'); return { w: c.width, h: c.height, d: Array.from(c.getContext('2d').getImageData(0, 0, c.width, c.height).data) }; });
}
const meanDiff = (a, b) => { let s = 0; for (let i = 0; i < a.d.length; i++) s += Math.abs(a.d[i] - b.d[i]); return s / a.d.length; };
const controls = (page) => page.evaluate(() => [...document.querySelectorAll('#src-ndim button, #src-ndim input, #src-ndim select')].map((e) => e.id || e.textContent.trim()).sort());
async function open(ctx, q, hideGpu = false) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (hideGpu) await page.addInitScript(() => { try { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); } catch (_) {} });
  await page.goto(`${base}/studio.html?source=ndim${q}`);
  await W.ready(page, 'ndim');
  return { page, errors };
}

(async () => {
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
      try {
        const gl = await open(ctx, '&ndim=webgl');
        assert.equal(await gl.page.evaluate(() => window.__studioNdimBackend), 'webgl', `${tag} ?ndim=webgl draws with WebGL`);
        const glPx = await pixels(gl.page);
        const glControls = await controls(gl.page);
        const d2 = await open(ctx, '&ndim=2d');
        assert.equal(await d2.page.evaluate(() => window.__studioNdimBackend), '2d canvas', `${tag} ?ndim=2d draws with the 2D canvas`);
        const hidden = await open(ctx, '', true);
        assert.equal(await hidden.page.evaluate(() => window.__studioNdimBackend), 'webgl', `${tag} without WebGPU the WebGL fallback draws`);
        const gpuOk = await gl.page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
        if (gpuOk) {
          const gp = await open(ctx, '');
          await W.until(gp.page, () => window.__studioNdimBackend === 'raw-native webgpu');
          const px = await pixels(await gp.page);
          assert.equal(px.w, glPx.w, `${tag} same stage size`);
          const diff = meanDiff(px, glPx);
          assert.ok(diff < 2, `${tag} the raw-native frame keeps the WebGL look (mean difference ${diff.toFixed(3)} of 255)`);
          assert.deepEqual(await controls(gp.page), glControls, `${tag} every Dimensions control is still there`);
          assert.deepEqual(gp.errors, [], `${tag} no console errors on raw-native`);
          console.log(`${tag} raw-native webgpu, mean difference from WebGL ${diff.toFixed(3)} of 255`);
        } else console.log(`${tag} no WebGPU adapter here: the raw-native path is skipped, the fallbacks are checked`);
        for (const r of [gl, d2, hidden]) assert.deepEqual(r.errors, [], `${tag} no console errors on the fallbacks`);
        console.log(`${tag} studio dimensions on raw-native: pass`);
      } catch (e) {
        failures++;
        console.error(`FAIL ${tag}`, e.message);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
