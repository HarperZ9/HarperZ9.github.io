// The Music source's flow field on raw-native (14 October 2026). The same curl-noise field moves
// up to 1,024 particles a frame in a WGSL compute pass; the Canvas2D mode stays as the fallback.
// This checks, at desktop and phone widths, with the built-in synth playing: ?music=cpu draws the
// Canvas2D mode; with WebGPU hidden the Canvas2D mode draws; where WebGPU answers, the field is
// drawn by "raw-native webgpu", its streaks cover the same cells of the stage as the Canvas2D
// streaks (intersection over union of a 32 x 20 occupancy grid at least MIN_IOU), and its mean
// brightness stays within a factor of MAX_RATIO of the Canvas2D frame's; every Music control is
// still there; no console errors.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox
const W = require('./lib/studio-wait.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
// Canvas2D against itself scores about 0.55 IoU (the particles respawn at random), so 0.4.
const MIN_IOU = 0.4, MAX_RATIO = 4;
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
const meanY = (page) => page.evaluate(() => {
  const c = document.getElementById('studio-canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  let s = 0, n = 0; for (let i = 0; i < d.length; i += 16) { s += 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); n++; }
  return s / n;
});
// The field needs a few seconds to build up, longer on a slow runner; wait for it.
async function grown(page, min = 20, timeout = 60000) {
  const end = Date.now() + timeout; let c = await cells(page);
  while (c.length <= min && Date.now() < end) { await W.sleep(500); c = await cells(page); }
  return c;
}
const iou = (a, b) => { const A = new Set(a), B = new Set(b); let n = 0; for (const k of A) if (B.has(k)) n++; return n / Math.max(1, new Set([...a, ...b]).size); };
async function open(ctx, q, hideGpu = false) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  if (hideGpu) await page.addInitScript(() => { try { Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true }); } catch (_) {} });
  await page.goto(`${base}/studio.html?source=music${q}`);
  await W.until(page, () => !!(window.ReactiveVisuals && window.ReactiveVisuals.flowBackend));
  await page.evaluate(() => {
    document.querySelector('#music-modes [data-music-mode="flowfield"]').click();
    document.getElementById('music-play').click();
  });
  return { page, errors };
}
const backend = (p) => p.page.evaluate(() => window.ReactiveVisuals.flowBackend());

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
        const cpu = await open(ctx, '&music=cpu');
        await W.sleep(5000);
        assert.equal(await backend(cpu), 'canvas2d', `${tag} ?music=cpu draws the Canvas2D mode`);
        const cpuCells = await grown(cpu.page);
        if (cpuCells.length <= 20) {
          // Say what the stage is doing, for the open Linux-Firefox finding (see ci.yml).
          const f1 = await W.frame(cpu.page); await W.sleep(1000); const f2 = await W.frame(cpu.page);
          const playing = await cpu.page.evaluate(() => (document.getElementById('music-play') || {}).textContent);
          console.log(`${tag} stage ${f1 === f2 ? 'still' : 'changing'}, play button "${(playing || '').trim()}", errors ${JSON.stringify(cpu.errors)}`);
        }
        assert.ok(cpuCells.length > 20, `${tag} the Canvas2D field is drawn (${cpuCells.length} cells)`);
        const cpuY = await meanY(cpu.page);
        const cpuControls = await controls(cpu.page);
        const hidden = await open(ctx, '', true);
        await W.sleep(2000);
        assert.equal(await backend(hidden), 'canvas2d', `${tag} without WebGPU the Canvas2D mode draws`);
        const gpuOk = await cpu.page.evaluate(async () => !!(navigator.gpu && await navigator.gpu.requestAdapter()));
        if (gpuOk) {
          const gp = await open(ctx, '');
          await W.until(gp.page, () => window.ReactiveVisuals.flowBackend() === 'raw-native webgpu');
          await W.sleep(5000);
          const gpuCells = await grown(gp.page);
          const j = iou(cpuCells, gpuCells);
          assert.ok(j >= MIN_IOU, `${tag} the GPU field covers the Canvas2D field's cells (IoU ${j.toFixed(3)})`);
          const ratio = (await meanY(gp.page)) / cpuY;
          assert.ok(ratio <= MAX_RATIO && ratio >= 1 / MAX_RATIO, `${tag} the GPU field's mean brightness is within ${MAX_RATIO}x of Canvas2D's (${ratio.toFixed(2)}x)`);
          assert.deepEqual(await controls(gp.page), cpuControls, `${tag} every Music control is still there`);
          assert.deepEqual(gp.errors, [], `${tag} no console errors on raw-native`);
          console.log(`${tag} raw-native webgpu, occupancy IoU with Canvas2D ${j.toFixed(3)} (${cpuCells.length} and ${gpuCells.length} cells), mean brightness ${ratio.toFixed(2)}x`);
        } else console.log(`${tag} no WebGPU adapter here: the raw-native path is skipped, the fallbacks are checked`);
        for (const r of [cpu, hidden]) assert.deepEqual(r.errors, [], `${tag} no console errors on the fallbacks`);
        console.log(`${tag} studio music flow field on raw-native: pass`);
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
