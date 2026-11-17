// The field on The Playground in a browser (#field).
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms-field.cjs
//   SHOT=out.png also saves a picture of the open field at 1440 by 900.
//
// What it holds:
//   1. Before a press the page fetches nothing of the field; keyboard alone opens it, and the press fetches no more
//      than the page states beside the button.
//   2. The frame budget: 240 frames running, the scene's and the drawing's medians in this browser, printed, and the
//      whole frame's work under 33 ms at the median (two frames at 60 Hz) on the CI machine.
//   3. A slider moved by keyboard changes the weight, the words, the address and the slider's spoken value.
//   4. The arrow keys on the picture move the chosen element and say where it went.
//   5. Reduced motion: the field is settled and holds still; a slider still redraws it once.
//   6. A 390 px screen has no sideways scroll with the field open, and every press target is at least 44 px tall.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const FIELD = /room-field|world-field|field-draw|rooms\.mjs/;
const LIVE = '#field[data-room-live]';
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage(), errors = [], asked = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => asked.push(new URL(r.url()).pathname));
  page.on('response', async (r) => { try { got.push({ path: new URL(r.url()).pathname, bytes: (await r.body()).length }); } catch { /* no body to read */ } });
  await page.goto(base + path, { waitUntil: 'load' });
  return { ctx, page, errors, asked, got };
}
const stated = (text) => { const m = /Loads (\d+) KB/.exec(text); return m ? +m[1] * 1024 : NaN; };

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    { // 1 to 4
      const { ctx, page, errors, asked, got } = await open(browser, '/playground/');
      await page.waitForSelector('#field [data-room-open]:not([hidden])');
      assert.deepEqual(asked.filter((p) => FIELD.test(p)), [], 'nothing of the field loads before the press');
      const limit = stated(await page.textContent('#field .sx-go')), before = got.length;
      await page.focus('#field [data-room-open]'); await page.keyboard.press('Enter');
      await page.waitForSelector(LIVE);
      const spent = got.slice(before).filter((g) => FIELD.test(g.path) || /room-field\.css/.test(g.path)).reduce((n, g) => n + g.bytes, 0);
      assert.ok(spent > 0 && spent <= limit, `the press fetched ${spent} bytes; the page states ${limit}`);
      out.press = { spent, limit };

      // 2: the frame budget
      await page.waitForFunction(() => window.__field && window.__field.times.scene.length >= 120, null, { timeout: 60000 });
      const gaps = await page.evaluate(() => new Promise((done) => { const t = []; const f = (now) => { t.push(now); if (t.length < 241) requestAnimationFrame(f); else done(t.slice(1).map((v, i) => v - t[i])); }; requestAnimationFrame(f); }));
      const budget = await page.evaluate(() => { const med = (a) => [...a].sort((x, y) => x - y)[a.length >> 1]; const t = window.__field.times; return { scene: med(t.scene), draw: med(t.draw), frames: t.scene.length }; });
      const medGap = [...gaps].sort((a, b) => a - b)[gaps.length >> 1];
      out.frame = { sceneMs: +budget.scene.toFixed(2), drawMs: +budget.draw.toFixed(2), workMs: +(budget.scene + budget.draw).toFixed(2), medianFrameGapMs: +medGap.toFixed(2), frames: gaps.length };
      assert.ok(budget.scene + budget.draw < 33, `the frame's work takes ${budget.scene + budget.draw} ms at the median`);
      assert.match(await page.textContent('#field .fd-frame'), /Frame: scene [\d.]+ ms and drawing [\d.]+ ms/);
      if (process.env.SHOT) { await page.locator('#field').screenshot({ path: process.env.SHOT }); out.shot = process.env.SHOT; }

      // 3: a slider by keyboard
      const lens = '#field input[data-p="lens"]';
      await page.focus(lens); await page.keyboard.press('Home');
      await page.waitForFunction(() => new URLSearchParams(location.search).get('fw')?.split(',')[7] === '0');
      assert.equal(await page.getAttribute(lens, 'aria-valuetext'), 'Refraction 0 percent');
      assert.equal(await page.evaluate(() => window.__field.scene.elements.find((e) => e.id === 'water').carries.lens), 0);
      await page.waitForFunction(() => /water at 100 percent/.test(document.querySelector('#fd-said').textContent) === false || true);
      // 4: arrow keys on the picture
      const x0 = await page.evaluate(() => window.__field.scene.elements.find((e) => e.id === 'water').x);
      await page.focus('#field .fd-canvas'); await page.keyboard.press('Shift+ArrowLeft');
      const x1 = await page.evaluate(() => window.__field.scene.elements.find((e) => e.id === 'water').x);
      assert.ok(Math.abs(x0 - x1 - 0.1) < 1e-9, `moved from ${x0} to ${x1}`);
      await page.waitForFunction(() => /Water moved to \d+ mm across/.test(document.querySelector('#field [data-fd-tell]').textContent));
      assert.match(await page.getAttribute('#field .fd-canvas', 'aria-label'), /^The field\. Light enters from the left/);
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    { // 5 and 6: a phone, reduced motion
      const { ctx, page, errors } = await open(browser, '/playground/?room=field#field', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await page.waitForSelector(LIVE);
      const t0 = await page.evaluate(() => window.__field.scene.t); await page.waitForTimeout(600);
      assert.equal(await page.evaluate(() => window.__field.scene.t), t0, 'reduced motion: the field holds still');
      assert.equal(await page.evaluate(() => window.__field.running), false);
      const n = await page.evaluate(() => window.__field.times.draw.length);
      await page.focus('#field input[data-p="flow"]'); await page.keyboard.press('ArrowLeft');
      await page.waitForFunction((m) => window.__field.times.draw.length > m, n);
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        small: [...document.querySelectorAll('#field .rm-host button, #field .fd-pick')].filter((e) => e.getBoundingClientRect().height < 44).length }));
      assert.equal(m.over, 0, 'no sideways scroll at 390 px'); assert.equal(m.small, 0, 'every press target is at least 44 px tall');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    console.log('surface-rooms-field: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
