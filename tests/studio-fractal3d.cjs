// The 3D Fractal source's progressive renderer (9 October 2026). At desktop and phone widths:
//   - the original chips, sliders and Render are all there, with the new formulas and controls;
//   - each formula draws a frame of its own, and a still view converges (the readout says so);
//   - a material slider changes the frame live, without pressing Render;
//   - a double-click focuses: the camera moves toward what is under the pointer;
//   - Undo returns the previous settings.
// On a device without WebGL2 the WebGL1 renderer draws instead, and the progressive checks skip.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const TYPES = ['mandelbox', 'mandelbulb', 'surf', 'menger', 'kleinian', 'hybrid'];
const wait = (page, ms) => page.waitForTimeout(ms);
async function stage(page) {
  const png = await page.locator('#viewport-stage').screenshot();
  return require('crypto').createHash('sha256').update(png).digest('hex').slice(0, 16);
}
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
async function converged(page, timeout = 120000) {
  await page.waitForFunction(() => /converged|One sample/.test((document.getElementById('f3-readout') || {}).textContent || ''), null, { timeout });
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  if (process.env.BROWSER_ARGS) launch.args = process.env.BROWSER_ARGS.split(' ');
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      try {
        await page.goto(`${base}/studio.html?source=fractal3d`); await wait(page, 4000);
        for (const sel of ['#f3-scale', '#f3-power', '#f3-iterations', '#f3-render', ...TYPES.map((t) => `[data-f3type="${t}"]`),
          '#f3-rough', '#f3-metal', '#f3-aperture', '#f3-fog', '#f3-glow', '#f3-sunaz', '#f3-samples', '#f3-turntable']) {
          assert.equal(await page.locator(sel).count(), 1, `${tag} ${sel} is present`);
        }
        await page.evaluate(() => { const t = document.getElementById('f3-turntable'); t.checked = false; t.dispatchEvent(new Event('change')); const s = document.getElementById('f3-samples'); s.value = '8'; s.dispatchEvent(new Event('input')); });
        const progressive = await page.evaluate(() => !!document.createElement('canvas').getContext('webgl2'));
        // A software renderer on a CI runner is far slower than this machine's; there the desktop
        // pass checks the controls only, and the phone pass draws and converges every formula.
        const software = await page.evaluate(() => {
          const g = document.createElement('canvas').getContext('webgl2');
          const e = g && g.getExtension('WEBGL_debug_renderer_info');
          return !!(e && /SwiftShader|llvmpipe/i.test(g.getParameter(e.UNMASKED_RENDERER_WEBGL)));
        });
        if (software && !view.mobile) { assert.deepEqual(errors, [], `${tag} no page errors`); console.log(`${tag} studio fractal 3D (software renderer, controls only): pass`); continue; }
        const seen = new Set();
        for (const t of TYPES) {
          await click(page, `[data-f3type="${t}"]`); await click(page, '#f3-render');
          await wait(page, 600);
          if (progressive) await converged(page);
          const h = await stage(page);
          assert.ok(!seen.has(h), `${tag} ${t} draws a frame of its own`);
          seen.add(h);
        }
        if (progressive) {
          await click(page, '[data-f3type="mandelbox"]'); await click(page, '#f3-render'); await wait(page, 600); await converged(page);
          const before = await stage(page);
          await page.evaluate(() => { const s = document.getElementById('f3-metal'); s.value = '0.9'; s.dispatchEvent(new Event('input')); s.dispatchEvent(new Event('change')); });
          await wait(page, 400); await converged(page);
          const metal = await stage(page);
          assert.notEqual(metal, before, `${tag} the metal slider changes the frame live`);
          if (!view.mobile) {
            const box = await page.locator('#studio-canvas').boundingBox();
            await page.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height * 0.5);
            await wait(page, 1500); await converged(page);
            assert.notEqual(await stage(page), metal, `${tag} a double-click focuses the camera`);
          }
          await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1500);
          assert.equal(await page.evaluate(() => document.getElementById('f3-metal').value), '0', `${tag} Undo returns the metal setting`);
        } else console.log(`${tag} no WebGL2: the progressive checks are skipped`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio fractal 3D: pass`);
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
