// Large stills from the 2D Fractal source (9 October 2026). The 4K entry draws the stage's view in
// strips and saves one PNG. This checks that the file is a valid PNG of 3840 pixels across with the
// stage's aspect: every chunk's CRC holds, the image data inflates to exactly one filtered row per
// scanline, and the picture has structure (it is not one flat colour or a blank).
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8851';

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
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
    await page.goto(`${base}/studio.html?source=fractal`); await page.waitForTimeout(3500);
    const aspect = await page.evaluate(() => { const c = document.getElementById('studio-canvas'); return c.height / c.width; });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 300000 }), page.evaluate(() => document.getElementById('fractal-still-4k').click())]);
    const file = path.join(os.tmpdir(), `fractal-still-${Date.now()}.png`);
    await dl.saveAs(file);
    const png = fs.readFileSync(file);
    fs.unlinkSync(file);
    assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10], 'PNG signature');
    let o = 8, W = 0, H = 0;
    const idat = [];
    while (o < png.length) {
      const len = png.readUInt32BE(o), type = png.toString('latin1', o + 4, o + 8);
      const data = png.subarray(o + 8, o + 8 + len);
      assert.equal(png.readUInt32BE(o + 8 + len), crc32(png.subarray(o + 4, o + 8 + len)), `${type} CRC`);
      if (type === 'IHDR') { W = data.readUInt32BE(0); H = data.readUInt32BE(4); assert.equal(data[8], 8); assert.equal(data[9], 2); }
      if (type === 'IDAT') idat.push(data);
      o += 12 + len;
      if (type === 'IEND') break;
    }
    assert.equal(W, 3840, 'width');
    assert.equal(H, Math.round(3840 * aspect), 'height follows the stage');
    const raw = zlib.inflateSync(Buffer.concat(idat));
    assert.equal(raw.length, H * (W * 3 + 1), 'one filtered row per scanline');
    const colours = new Set();
    for (let y = 0; y < H; y += 97) for (let x = 0; x < W; x += 61) { const i = y * (W * 3 + 1) + 1 + x * 3; colours.add(raw[i] << 16 | raw[i + 1] << 8 | raw[i + 2]); }
    assert.ok(colours.size > 100, `the still has structure (${colours.size} colours sampled)`);
    assert.match(await page.textContent('#fractal-still-status'), /Saved fractal-mandelbrot-3840x/);
    assert.deepEqual(errors, [], 'no page errors');
    console.log(`studio fractal still: pass (${W} x ${H}, ${(png.length / 1e6).toFixed(1)} MB, ${colours.size} colours sampled)`);
  } catch (e) {
    failed = true;
    console.error('FAIL', e.message);
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
