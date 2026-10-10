// The Music source's attractor on raw-native (10 October 2026). The same audio-driven maps run as
// about a million points a frame in a WGSL compute pass; the Canvas2D mode stays as the fallback.
// This checks, at desktop and phone widths, with the built-in synth playing: ?music=cpu draws the
// Canvas2D mode; with WebGPU hidden the Canvas2D mode draws; where WebGPU answers, the attractor is
// drawn by "raw-native webgpu", the Lorenz figure covers the same cells of the stage as the
// Canvas2D figure (intersection over union of a 32 x 20 occupancy grid at least 0.6), and each of
// the three attractor types draws a figure; every Music control is still there; no console errors.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox
const W = require('./lib/studio-wait.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const controls = (page) => page.evaluate(() => [...document.querySelectorAll('#src-music button, #src-music input, #src-music select')].map((e) => e.id || e.dataset.musicMode || e.dataset.attrType || e.textContent.trim()).sort());
// Cells of a 32 x 20 grid with more than a few lit pixels (away from the void, either the --void the
// GPU path draws or the (0, 27, 28) the Canvas2D fade settles on after 8-bit rounding).
const cells = (page) => page.evaluate(() => {
  const c = document.getElementById('studio-canvas'); const W = c.width, H = c.height;
  const d = c.getContext('2d').getImageData(0, 0, W, H).data; const g = new Array(640).fill(0);
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
    const i = (y * W + x) * 4, r = d[i], gg = d[i + 1], b = d[i + 2];
    if (Math.abs(r - 13) + Math.abs(gg - 27) + Math.abs(b - 28) > 30 && !(r < 3 && Math.abs(gg - 27) < 3)) g[Math.floor(y * 20 / H) * 32 + Math.floor(x * 32 / W)]++;
  }
  return g.map((n, k) => (n > 3 ? k : -1)).filter((k) => k >= 0);
});
const iou = (a, b) => { const A = new Set(a), B = new Set(b); let n = 0; for (const k of A) if (B.has(k)) n++; return n / Math.max(1, new Set([...a, ...b]).size); };
async function open(ctx, q, type, hideGpu = false) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (hideGpu) await page.addInitScript(() => { try { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); } catch (_) {} });
  await page.goto(`${base}/studio.html?source=music${q}`);
  await W.until(page, () => !!(window.ReactiveVisuals && window.ReactiveVisuals.attractorBackend));
  await page.evaluate((t) => {
    document.querySelector('#music-modes [data-music-mode="attractor"]').click();
    document.querySelector(`#music-attractor-types [data-attr-type="${t}"]`).click();
    document.getElementById('music-play').click();
  }, type);
  return { page, errors };
}
const backend = (p) => p.page.evaluate(() => window.ReactiveVisuals.attractorBackend());

(async () => {
  const launch = { args: ['--autoplay-policy=no-user-gesture-required'] };
  if (process.env.BROWSER_CHANNEL) launch.channel = process.env.BROWSER_CHANNEL;
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      try {
        const cpu = await open(ctx, '&music=cpu', 'lorenz2d');
        await W.sleep(5000);
        assert.equal(await backend(cpu), 'canvas2d', `${tag} ?music=cpu draws the Canvas2D mode`);
        const cpuCells = await cells(cpu.page);
        assert.ok(cpuCells.length > 20, `${tag} the Canvas2D Lorenz figure is drawn (${cpuCells.length} cells)`);
        const cpuControls = await controls(cpu.page);
        const hidden = await open(ctx, '', 'lorenz2d', true);
        await W.sleep(2000);
        assert.equal(await backend(hidden), 'canvas2d', `${tag} without WebGPU the Canvas2D mode draws`);
        const gpuOk = await cpu.page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
        if (gpuOk) {
          const gp = await open(ctx, '', 'lorenz2d');
          await W.until(gp.page, () => window.ReactiveVisuals.attractorBackend() === 'raw-native webgpu');
          await W.sleep(5000);
          const gpuCells = await cells(gp.page);
          const j = iou(cpuCells, gpuCells);
          assert.ok(j >= 0.6, `${tag} the GPU Lorenz figure covers the Canvas2D figure's cells (IoU ${j.toFixed(3)})`);
          for (const t of ['clifford', 'dejong']) {
            await gp.page.evaluate((t) => document.querySelector(`#music-attractor-types [data-attr-type="${t}"]`).click(), t);
            await W.sleep(2500);
            const n = (await cells(gp.page)).length;
            assert.ok(n >= 1, `${tag} ${t} draws a figure on the GPU (${n} cells)`);
          }
          assert.deepEqual(await controls(gp.page), cpuControls, `${tag} every Music control is still there`);
          assert.deepEqual(gp.errors, [], `${tag} no console errors on raw-native`);
          console.log(`${tag} raw-native webgpu, Lorenz occupancy IoU with Canvas2D ${j.toFixed(3)} (${cpuCells.length} and ${gpuCells.length} cells)`);
        } else console.log(`${tag} no WebGPU adapter here: the raw-native path is skipped, the fallbacks are checked`);
        for (const r of [cpu, hidden]) assert.deepEqual(r.errors, [], `${tag} no console errors on the fallbacks`);
        console.log(`${tag} studio music attractor on raw-native: pass`);
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
