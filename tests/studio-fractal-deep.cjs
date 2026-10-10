// The 2D Fractal source's deep zoom, in the Studio (9 October 2026). At desktop and phone widths:
//   - every control the source had before keeps its place (type chips, preset, palettes, detail,
//     Render), and the Deep zoom group is there (iterations, BLA, glitch view, location);
//   - a deep preset draws by perturbation and the readout says so, with the depth;
//   - eight wheel steps toward a point at 2e-38 keep zooming: the frame changes, the centre's
//     decimal string grows past what a double holds, and the frame keeps its structure;
//   - a pasted location at 3e-279 flies there and draws;
//   - Undo returns the earlier view.
// Where the browser has no WebGL2, the CPU draws the same views by perturbation in doubles, and the
// path checks accept "CPU" in the readout.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function stage(page) {
  const png = await page.locator('#viewport-stage').screenshot();
  return require('crypto').createHash('sha256').update(png).digest('hex').slice(0, 16);
}
async function choosePreset(page, name) {
  const idx = await page.evaluate((n) => [...document.querySelectorAll('#fractal-preset option')].findIndex((o) => o.textContent === n), name);
  assert.ok(idx >= 0, `preset "${name}" is in the menu`);
  await page.evaluate((i) => { document.getElementById('fractal-preset').value = String(i); document.getElementById('fractal-render').click(); }, idx);
}
// Pixel spread of the stage canvas: a flat or blocky frame has few distinct colours.
async function structure(page) {
  return page.evaluate(() => {
    const c = document.getElementById('studio-canvas');
    const s = document.createElement('canvas'); s.width = 200; s.height = 120;
    s.getContext('2d').drawImage(c, 0, 0, 200, 120);
    const d = s.getContext('2d').getImageData(0, 0, 200, 120).data;
    const bins = new Set();
    for (let i = 0; i < d.length; i += 4) bins.add((d[i] >> 3) << 10 | (d[i + 1] >> 3) << 5 | (d[i + 2] >> 3));
    return bins.size;
  });
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  // BROWSER_ARGS="--use-angle=swiftshader --enable-unsafe-swiftshader" runs the CI renderer locally.
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
        // Every control the source had, plus the new group.
        for (const sel of ['[data-ftype="mandelbrot"]', '[data-ftype="julia"]', '[data-ftype="burningship"]', '#fractal-preset',
          '#fractal-palettes [data-fractal-palette]', '#fractal-detail', '#fractal-render',
          '#fractal-auto-iter', '#fractal-bla', '#fractal-glitch', '#fractal-location', '#fractal-location-go', '#fractal-location-copy']) {
          assert.ok(await page.locator(sel).count() > 0, `${tag} ${sel} is present`);
        }
        // SwiftShader (the CI renderer) draws a 2e-38 frame at desktop backing size in about 35 s,
        // past any sensible wait, so there the desktop pass checks a lighter deep view by location
        // and leaves the presets and the wheel to the phone pass, whose canvas is a seventh the size.
        const software = await page.evaluate(() => {
          const g = document.createElement('canvas').getContext('webgl2');
          const e = g && g.getExtension('WEBGL_debug_renderer_info');
          return !!(e && /SwiftShader/i.test(g.getParameter(e.UNMASKED_RENDERER_WEBGL)));
        });
        if (software && !view.mobile) {
          await page.evaluate(() => { const a = document.getElementById('fractal-auto-iter'); a.checked = false; a.dispatchEvent(new Event('change', { bubbles: true })); });
          await page.fill('#fractal-location', 're -0.7436227627792091903930625607721105561797006142687856921130208924\nim 0.1318305311337870112915195543947448074486402760798047827036608098\nwidth 1e-20\niterations 2500');
          await page.evaluate(() => document.getElementById('fractal-location-go').click());
          await wait(page, 3000);
          assert.match(await page.textContent('#fractal-deep-readout', { timeout: 120000 }), /Perturbation/, `${tag} 1e-20 draws by perturbation`);
          const s = await structure(page);
          assert.ok(s > 60, `${tag} the 1e-20 frame has structure (${s} colour bins)`);
          assert.deepEqual(errors, [], `${tag} no page errors`);
          console.log(`${tag} studio fractal deep zoom (software renderer, light pass): pass (structure ${s})`);
          continue;
        }
        await choosePreset(page, 'Deep: Spiral Field (2e-38)'); await wait(page, 2500);
        const readout = await page.textContent('#fractal-deep-readout');
        assert.match(readout, /Perturbation|CPU/, `${tag} the readout names the path: ${readout}`);
        assert.match(await page.textContent('#fractal-depth'), /e3[78]x/, `${tag} the depth reads about 1e38x`);
        const before = await stage(page);
        const s0 = await structure(page);
        assert.ok(s0 > 60, `${tag} the deep frame has structure (${s0} colour bins)`);
        const loc0 = await page.inputValue('#fractal-location');

        const box = await page.locator('#studio-canvas').boundingBox();
        await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.4);
        for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, -100); await wait(page, 150); }
        await wait(page, 1500);
        const after = await stage(page);
        assert.notEqual(after, before, `${tag} wheel zoom at 2e-38 changes the frame`);
        const loc1 = await page.inputValue('#fractal-location');
        const re1 = /re (\S+)/.exec(loc1)[1];
        assert.notEqual(re1, /re (\S+)/.exec(loc0)[1], `${tag} the centre moved toward the cursor`);
        assert.ok(re1.replace(/[-.]/g, '').length > 40, `${tag} the centre carries more digits than a double (${re1.length})`);
        const w1 = parseFloat(/width (\S+)/.exec(loc1)[1]);
        assert.ok(w1 < 2e-38 * 0.3, `${tag} the width shrank (${w1})`);
        const s1 = await structure(page);
        assert.ok(s1 > 60, `${tag} the zoomed frame keeps its structure (${s1} colour bins)`);

        // Fly to a pasted location near the floor of the double.
        await page.fill('#fractal-location', `re -0.7436297108068149238641325645257763748151975409563090363549016381635416548956679926139737642246077493440431294103029241581097769872221393760302035629656002720600904888665708397502623345426216845718575255878890109145340921980042513045915678208132096765732941297235405155513117648582567969581550859934997583
im 0.13179037348492778857499863122829328753718721359953548960719304643371887523795737082411405884833132274071063210366741652146215110766349394536962035781770676794890237986971127860569783512781903532462248451189646528671485547191899510555794486220620700127547613240584893758833459112932403289697064048771100777
width 3e-279
iterations 40000`);
        await page.evaluate(() => document.getElementById('fractal-location-go').click());
        await wait(page, 3000);
        assert.match(await page.textContent('#fractal-depth'), /e279x/, `${tag} the depth reads 1e279x`);
        const s2 = await structure(page);
        assert.ok(s2 > 60, `${tag} the 3e-279 frame has structure (${s2} colour bins)`);

        await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await wait(page, 1500);
        assert.match(await page.textContent('#fractal-depth'), /e3[789]x/, `${tag} Undo returns the earlier view`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio fractal deep zoom: pass (structure ${s0}, ${s1}, ${s2})`);
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
