// Flights in the 2D Fractal source (9 October 2026): two keyframes, from the whole Mandelbrot set
// to Spiral Field at 2e-38, saved as 720p video. Checks that the keyframes survive the change of
// preset between them, that the file is a WebM (EBML header, DocType "webm", a VP9 or VP8 track),
// that it holds one block per frame (two seconds at 30 fps: 61), and that Undo keeps working.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';

// Walk the EBML tree far enough to count SimpleBlocks (ID 0xA3) inside Clusters.
function readVint(buf, o, keepMarker) {
  const first = buf[o];
  let len = 1;
  while (len <= 8 && !(first & (0x80 >> (len - 1)))) len++;
  let v = keepMarker ? first : first & (0xff >> len);
  for (let i = 1; i < len; i++) v = v * 256 + buf[o + i];
  return { v, len };
}
function walk(buf, start, end, visit) {
  let o = start;
  while (o < end) {
    const id = readVint(buf, o, true), size = readVint(buf, o + id.len, false);
    const body = o + id.len + size.len;
    visit(id.v, buf.subarray(body, body + size.v));
    if (id.v === 0x1a45dfa3 || id.v === 0x18538067 || id.v === 0x1f43b675 || id.v === 0x1654ae6b || id.v === 0xae) walk(buf, body, body + size.v, visit);
    o = body + size.v;
  }
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  if (process.env.BROWSER_ARGS) launch.args = process.env.BROWSER_ARGS.split(' ');
  const browser = await chromium.launch(launch);
  let failed = false;
  try {
    const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e.message)));
    const consoleErrors = [];
    page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
    await page.goto(`${base}/studio.html?source=fractal`); await page.waitForTimeout(3500);
    const pick = async (n) => {
      await page.waitForFunction((n) => [...document.querySelectorAll('#fractal-preset option')].some((o) => o.textContent === n), n, { timeout: 60000 }).catch(() => {});
      const i = await page.evaluate((n) => [...document.querySelectorAll('#fractal-preset option')].findIndex((o) => o.textContent === n), n);
      assert.ok(i >= 0, `preset ${n}; console errors: ${consoleErrors.slice(0, 3).join(' / ')}; the menu holds: ${await page.evaluate(() => [...document.querySelectorAll('#fractal-preset option')].map((o) => o.textContent).slice(0, 4).join(' | '))}`);
      await page.evaluate((k) => { document.getElementById('fractal-preset').value = String(k); document.getElementById('fractal-render').click(); }, i);
      await page.waitForTimeout(1500);
    };
    // A software renderer (CI) flies to a shallow view; deep frames there take minutes each.
    const software = await page.evaluate(() => {
      const g = document.createElement('canvas').getContext('webgl2');
      const e = g && g.getExtension('WEBGL_debug_renderer_info');
      return !!(e && /SwiftShader|llvmpipe/i.test(g.getParameter(e.UNMASKED_RENDERER_WEBGL)));
    });
    await pick('Full Overview');
    await page.evaluate(() => document.getElementById('fractal-flight-add').click());
    await pick(software ? 'Seahorse Valley' : 'Deep: Spiral Field (2e-38)');
    await page.evaluate(() => document.getElementById('fractal-flight-add').click());
    assert.equal(await page.locator('#fractal-flight-keys .chip').count(), 2, 'two keyframes, kept across the preset change');
    // The shared timeline keys the position slider like any control: 0 at 0 s and 1 at 8 s. Scrubbing
    // to 4 s puts the view halfway along the flight, deep in the zoom.
    const setPos = (v) => page.evaluate((v) => { const s = document.getElementById('fractal-flight-pos'); s.value = String(v); s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
    const scrubTo = (t) => page.evaluate((t) => { const s = document.getElementById('tl-scrub'); s.value = String(t); s.dispatchEvent(new Event('input', { bubbles: true })); }, t);
    if (await page.locator('#tl-key').count()) {
      await scrubTo(0); await setPos(0); await page.evaluate(() => document.getElementById('tl-key').click());
      await scrubTo(8); await setPos(1); await page.evaluate(() => document.getElementById('tl-key').click());
      await scrubTo(4); await page.waitForTimeout(1200);
      const mid = await page.evaluate(() => +document.getElementById('fractal-flight-pos').value);
      assert.ok(Math.abs(mid - 0.5) < 0.02, `the timeline drives the flight position (${mid} at 4 s)`);
      // The readout follows the frame, which a software renderer takes a while to draw.
      await page.waitForFunction(() => document.getElementById('fractal-depth').textContent.trim() !== '1.0x', null, { timeout: 120000 }).catch(() => {});
      const depth = await page.textContent('#fractal-depth');
      assert.notEqual(depth.trim(), '1.0x', `halfway along, the view has zoomed in (${depth})`);
      await page.evaluate(() => document.getElementById('tl-clear').click());
    } else console.log('no shared timeline on this build: the timeline check is skipped');
    const hasEncoder = await page.evaluate(() => typeof VideoEncoder !== 'undefined');
    if (!hasEncoder) { console.log('no WebCodecs here: the export check is skipped'); }
    else {
      await page.evaluate(() => {
        const s = document.getElementById('fractal-flight-seconds'); s.value = '2'; s.dispatchEvent(new Event('input'));
        document.querySelector('[data-flight-size="720p"]').click();
      });
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 600000 }), page.evaluate(() => document.getElementById('fractal-flight-export').click())]);
      const file = path.join(os.tmpdir(), `flight-${Date.now()}.webm`);
      await dl.saveAs(file);
      const buf = fs.readFileSync(file);
      fs.unlinkSync(file);
      assert.deepEqual([...buf.subarray(0, 4)], [0x1a, 0x45, 0xdf, 0xa3], 'EBML header');
      let docType = '', codec = '', blocks = 0, width = 0;
      walk(buf, 0, buf.length, (id, body) => {
        if (id === 0x4282) docType = body.toString('latin1');
        if (id === 0x86) codec = body.toString('latin1');
        if (id === 0xa3) blocks++;
        if (id === 0xe0) walk(buf, body.byteOffset - buf.byteOffset, body.byteOffset - buf.byteOffset + body.length, (i2, b2) => { if (i2 === 0xb0) width = b2.readUIntBE(0, b2.length); });
      });
      assert.equal(docType, 'webm');
      assert.match(codec, /^V_VP[89]$/);
      assert.equal(blocks, 61, 'one block per frame');
      assert.equal(width, 1280);
      assert.match(await page.textContent('#fractal-flight-status'), /Saved fractal-flight-1280x720-30fps\.webm/);
      console.log(`flight: ${codec}, ${blocks} frames, ${(buf.length / 1e6).toFixed(1)} MB`);
    }
    await page.evaluate(() => document.querySelector('#inspector-actions [data-action="undo"]').click()); await page.waitForTimeout(1200);
    assert.deepEqual(errors, [], 'no page errors');
    console.log('studio fractal flight: pass');
  } catch (e) {
    failed = true;
    console.error('FAIL', e.message);
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
