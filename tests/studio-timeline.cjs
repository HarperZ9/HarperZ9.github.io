// One timeline for every source (9 October 2026). Keyframes on any slider of the source on stage,
// played through the source's own controls, and a WebM render. This checks, on the Loom at
// desktop and phone widths: two keys on "Tone drive" (0 at 0 s, 100 at 2 s); scrubbing to 0 gives
// the cloth woven at tone 0 pixel for pixel, scrubbing past the last key gives the cloth at tone
// 100; playing to the end lands on the last key's cloth; the keys survive a reload; Render WebM
// downloads a video; T opens and closes the strip.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
const setTone = (page, v) => page.evaluate((v) => { const r = document.getElementById('wv-tone'); r.value = String(v); r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const scrubTo = (page, t) => page.evaluate((t) => { const s = document.getElementById('tl-scrub'); s.value = String(t); s.dispatchEvent(new Event('input', { bubbles: true })); }, t);
async function settle(page, want) { for (let i = 0; i < 20 && (await frame(page)) !== want; i++) await wait(page, 150); return frame(page); }

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1, acceptDownloads: true });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      try {
        await page.goto(`${base}/studio.html?source=loom`);
        await page.waitForSelector('#src-loom #wv-panel', { state: 'attached', timeout: 30000 }); await wait(page, 2500);
        await page.evaluate(() => { const w = document.getElementById('wv-weaveit'); if (w.checked) w.click(); }); await wait(page, 500);
        await setTone(page, 0); await wait(page, 800); const low = await frame(page);
        await setTone(page, 100); await wait(page, 800); const high = await frame(page);
        assert.notEqual(low, high, `${tag} tone changes the cloth`);
        await page.keyboard.press('t'); await wait(page, 200);
        assert.equal(await page.isVisible('#studio-timeline'), true, `${tag} T opens the timeline`);
        if (view.mobile) {
          const below = await page.evaluate(() => document.getElementById('studio-timeline').getBoundingClientRect().top >= document.getElementById('viewport-stage').getBoundingClientRect().bottom - 1);
          assert.ok(below, `${tag} on a phone the strip sits under the stage, not over it`);
        }
        await setTone(page, 0); await wait(page, 600);
        await scrubTo(page, 0); await page.click('#tl-key');
        // As in any keyframe editor: move the playhead first, then set the value, then key it.
        await scrubTo(page, 2); await setTone(page, 100); await wait(page, 600); await page.click('#tl-key');
        await scrubTo(page, 0);
        assert.equal(await settle(page, low), low, `${tag} at 0 s the cloth is the tone 0 cloth exactly`);
        await scrubTo(page, 6);
        assert.equal(await settle(page, high), high, `${tag} past the last key it is the tone 100 cloth exactly`);
        await scrubTo(page, 0); await settle(page, low);
        await page.selectOption('#tl-length', '4');
        await page.click('#tl-play'); await wait(page, 5000);
        assert.equal(await settle(page, high), high, `${tag} playing to the end lands on the last key`);
        await page.reload();
        await page.waitForSelector('#src-loom #wv-panel', { state: 'attached', timeout: 30000 }); await wait(page, 2000);
        await page.keyboard.press('t'); await wait(page, 200);
        assert.match(await page.textContent('#tl-key'), /\(2\)/, `${tag} the two keys survive a reload`);
        const dl = page.waitForEvent('download', { timeout: 20000 });
        await page.click('#tl-render');
        const file = await dl;
        assert.match(file.suggestedFilename(), /\.webm$/, `${tag} Render WebM downloads a video`);
        const path = await file.path(); const size = require('fs').statSync(path).size;
        assert.ok(size > 5000, `${tag} with frames in it (${size} bytes)`);
        await page.keyboard.press('t'); await wait(page, 200);
        assert.equal(await page.isVisible('#studio-timeline'), false, `${tag} T closes it`);
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio timeline: pass`);
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
