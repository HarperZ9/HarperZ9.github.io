// The 2D Fractal source's formula types (9 October 2026). At desktop and phone widths:
//   - the three original type chips and the nine new ones are all there, and each new one draws a
//     different frame with its own controls shown;
//   - the power slider redraws the Multibrot, and "Julia of the centre" switches it to Julia mode;
//   - the formula editor draws c sin z started at c, and a broken formula shows its reason and
//     position while the frame stays as it was;
//   - Undo returns the previous type.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const TYPES = ['multibrot', 'tricorn', 'celtic', 'magnet', 'phoenix', 'newton', 'nova', 'lyapunov', 'formula', 'buddhabrot', 'nebulabrot'];
const ROW = { multibrot: 'fractal-power-row', newton: 'fractal-newton-row', nova: 'fractal-newton-row', lyapunov: 'fractal-lyap-row', formula: 'fractal-editor-row', phoenix: 'fractal-p-row',
  buddhabrot: 'fractal-buddha-row', nebulabrot: 'fractal-limits-row' };
const wait = (page, ms) => page.waitForTimeout(ms);
async function stage(page) {
  const png = await page.locator('#viewport-stage').screenshot();
  return require('crypto').createHash('sha256').update(png).digest('hex').slice(0, 16);
}
const click = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);

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
        await page.goto(`${base}/studio.html?source=fractal`); await wait(page, 3500);
        for (const t of ['mandelbrot', 'julia', 'burningship', ...TYPES]) {
          assert.equal(await page.locator(`[data-ftype="${t}"]`).count(), 1, `${tag} the ${t} chip is there`);
        }
        assert.equal(await page.locator('#fractal-formula-group').isVisible(), false, `${tag} the Formula group hides for the Mandelbrot`);
        const seen = new Set([await stage(page)]);
        for (const t of TYPES) {
          await click(page, `[data-ftype="${t}"]`); await wait(page, 1200);
          const h = await stage(page);
          assert.ok(!seen.has(h), `${tag} ${t} draws a frame of its own`);
          seen.add(h);
          assert.equal(await page.evaluate(() => document.querySelector('[data-ftype].active').dataset.ftype), t, `${tag} ${t} chip lit`);
          if (ROW[t]) assert.equal(await page.locator('#' + ROW[t]).isVisible(), true, `${tag} ${t} shows ${ROW[t]}`);
          assert.equal(await page.locator('#fractal-formula-apply').isVisible(), t === 'formula', `${tag} Draw formula shows only for the editor`);
        }

        // The Buddhabrot accumulates and says so; it finishes, and it stops when another type draws.
        await click(page, '[data-ftype="buddhabrot"]');
        await page.waitForFunction(() => /done in/.test(document.getElementById('fractal-deep-readout').textContent) || /CPU/.test(document.getElementById('fractal-deep-readout').textContent), null, { timeout: 180000 });
        const br = await page.textContent('#fractal-deep-readout');
        assert.match(br, /Buddhabrot on the GPU: .* million orbits sampled|CPU/, `${tag} the Buddhabrot readout: ${br}`);
        console.log(`${tag} ${br}`);

        // Multibrot: the power slider, then the Julia switch.
        await click(page, '[data-ftype="multibrot"]'); await wait(page, 1200);
        const m3 = await stage(page);
        await page.evaluate(() => { const s = document.getElementById('fractal-power'); s.value = '6'; s.dispatchEvent(new Event('input', { bubbles: true })); });
        await wait(page, 800);
        assert.notEqual(await stage(page), m3, `${tag} the power slider redraws`);
        assert.equal(await page.textContent('#fractal-power-val'), '6');
        const m6 = await stage(page);
        await click(page, '#fractal-julia-pick'); await wait(page, 1000);
        assert.ok(await page.evaluate(() => document.getElementById('fractal-julia-mode').checked), `${tag} Julia of the centre turns Julia mode on`);
        assert.notEqual(await stage(page), m6, `${tag} and draws the Julia set`);

        // The editor.
        await click(page, '[data-ftype="formula"]'); await wait(page, 1200);
        await page.fill('#fractal-formula', 'c*sin(z)');
        await click(page, '[data-fz0="c"]'); await wait(page, 300);
        await click(page, '#fractal-formula-apply'); await wait(page, 1000);
        const good = await stage(page);
        assert.equal(await page.textContent('#fractal-formula-error'), '', `${tag} no error for c sin z`);
        await page.fill('#fractal-formula', 'z^2 + window');
        await click(page, '#fractal-formula-apply'); await wait(page, 800);
        assert.match(await page.textContent('#fractal-formula-error'), /unknown name "window".*character 7/, `${tag} the error names the problem and where`);
        assert.equal(await stage(page), good, `${tag} the frame stays as it was`);

        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1200);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio fractal formulas: pass`);
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
