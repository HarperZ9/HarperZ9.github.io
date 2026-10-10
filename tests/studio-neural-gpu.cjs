// Living neural on raw-native (10 October 2026). The seed-built networks run per pixel on raw-native's
// web GPU host; the worker and main-thread paths stay as the fallback. This checks, at desktop and
// phone widths, with motion reduced so the frame holds at time 0, for both instruments (field and
// solid): ?neural=cpu draws on the CPU paths; ?neural=grid samples on the GPU exactly where the CPU
// samples and matches the CPU frame within a small mean difference (the same networks, the same
// look); the default draws every pixel on the GPU and stays close to the CPU frame while carrying
// more detail; a page with WebGPU hidden draws on the CPU; every Living neural control is still
// there; no console errors.
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
// Detail: mean absolute difference between horizontal neighbours (flat cells and stretched texels score low).
const detail = (a) => { let s = 0, n = 0; for (let y = 0; y < a.h; y += 2) for (let x = 1; x < a.w; x++) { const i = (y * a.w + x) * 4; s += Math.abs(a.d[i] - a.d[i - 4]) + Math.abs(a.d[i + 1] - a.d[i - 3]) + Math.abs(a.d[i + 2] - a.d[i - 2]); n++; } return s / n; };
const controls = (page) => page.evaluate(() => [...document.querySelectorAll('#src-neural button, #src-neural input, #src-neural select')].map((e) => e.id || e.textContent.trim()).sort());
async function open(ctx, q, instrument, hideGpu = false) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (hideGpu) await page.addInitScript(() => { try { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); } catch (_) {} });
  await page.goto(`${base}/studio.html?source=neural${q}`);
  await W.ready(page, 'neural');
  await W.until(page, () => typeof window.__studioNeuralBackend === 'function');
  if (instrument === 'solid') {
    await page.evaluate(() => document.querySelector('#neural-instruments [data-neural-instrument="solid"]').click());
  }
  return { page, errors };
}
const backend = (p) => p.page.evaluate(() => window.__studioNeuralBackend());

(async () => {
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  let failures = 0;
  try {
    for (const view of VIEWS) {
      for (const instrument of ['field', 'solid']) {
        const tag = `[${view.name} ${instrument}]`;
        const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1, reducedMotion: 'reduce' });
        try {
          const cpu = await open(ctx, '&neural=cpu', instrument);
          await W.settled(cpu.page);
          assert.notEqual(await backend(cpu), 'raw-native webgpu', `${tag} ?neural=cpu draws on the CPU paths`);
          const cpuPx = await pixels(cpu.page);
          const cpuControls = await controls(cpu.page);
          const hidden = await open(ctx, '', instrument, true);
          await W.settled(hidden.page);
          assert.ok(!/webgpu/.test(await backend(hidden)), `${tag} without WebGPU the CPU paths draw`);
          const hidPx = await pixels(hidden.page);
          assert.ok(meanDiff(hidPx, cpuPx) < 0.5, `${tag} the fallback frame is the CPU frame`);
          const gpuOk = await cpu.page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
          if (gpuOk) {
            const grid = await open(ctx, '&neural=grid', instrument);
            await W.until(grid.page, () => window.__studioNeuralBackend() === 'raw-native webgpu (grid)');
            await W.settled(grid.page);
            const gridPx = await pixels(grid.page);
            assert.equal(gridPx.w, cpuPx.w, `${tag} same stage size`);
            const dGrid = meanDiff(gridPx, cpuPx);
            assert.ok(dGrid < 1.5, `${tag} sampled where the CPU samples, the GPU frame is the CPU frame (mean difference ${dGrid.toFixed(3)} of 255)`);
            const full = await open(ctx, '', instrument);
            await W.until(full.page, () => window.__studioNeuralBackend() === 'raw-native webgpu');
            await W.settled(full.page);
            const fullPx = await pixels(full.page);
            const dFull = meanDiff(fullPx, cpuPx);
            const dc = detail(cpuPx), df = detail(fullPx);
            assert.ok(dFull < 12, `${tag} every pixel on the GPU stays the same picture (mean difference ${dFull.toFixed(3)} of 255)`);
            assert.ok(df > dc * 1.1, `${tag} the GPU frame carries more detail than the CPU frame (neighbour difference ${df.toFixed(2)} against ${dc.toFixed(2)})`);
            assert.deepEqual(await controls(full.page), cpuControls, `${tag} every Living neural control is still there`);
            for (const r of [grid, full]) assert.deepEqual(r.errors, [], `${tag} no console errors on raw-native`);
            console.log(`${tag} grid vs CPU ${dGrid.toFixed(3)}, full vs CPU ${dFull.toFixed(3)} of 255; neighbour detail CPU ${dc.toFixed(2)}, GPU ${df.toFixed(2)}`);
          } else console.log(`${tag} no WebGPU adapter here: the raw-native path is skipped, the fallbacks are checked`);
          for (const r of [cpu, hidden]) assert.deepEqual(r.errors, [], `${tag} no console errors on the fallbacks`);
          console.log(`${tag} studio living neural on raw-native: pass`);
        } catch (e) {
          failures++;
          console.error(`FAIL ${tag}`, e.message);
        } finally {
          await ctx.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
