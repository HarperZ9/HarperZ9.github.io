// The Studio's sound through raw-native's sound engine (10 October 2026). This checks, at desktop
// width: Seed sound plays; the timeline's Render WebM records a video with an audio track; the
// note reports its loudness and true peak measured by raw-native's BS.1770 meter, with the true
// peak under the mastering ceiling (-1 dBTP, a little measuring margin allowed); the Music source
// shows its live loudness once it plays; no page errors. What the visitor hears is unchanged:
// the mastering branch only feeds recordings and the meter.
const assert = require('node:assert/strict');
const fs = require('fs');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox
const W = require('./lib/studio-wait.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';

(async () => {
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL, args: ['--autoplay-policy=no-user-gesture-required'] } : {});
  let failures = 0;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e.message)));
  try {
    await page.goto(`${base}/studio.html?source=sound`); await W.ready(page, 'sound');
    await page.click('#sound-play');
    await page.waitForTimeout(1500);
    await page.click('#rt-timeline');
    await page.selectOption('#tl-length', '4');
    const dl = page.waitForEvent('download', { timeout: 60000 });
    await page.click('#tl-render');
    const file = await dl;
    await W.until(page, () => /Rendered/.test(document.getElementById('tl-note').textContent));
    const note = await page.textContent('#tl-note');
    const bytes = fs.readFileSync(await file.path());
    assert.ok(bytes.includes(Buffer.from('A_OPUS')) || bytes.includes(Buffer.from('A_VORBIS')), 'the WebM carries an audio track');
    const m = note.match(/sound (-?[\d.]+) LUFS, true peak (-?[\d.]+) dBTP/);
    assert.ok(m, `the note reports loudness and true peak: "${note}"`);
    assert.ok(+m[2] <= -0.8, `the true peak stays under the -1 dBTP ceiling (${m[2]} dBTP)`);
    console.log(`studio sound engine: render ${note}`);

    await page.goto(`${base}/studio.html?source=music`); await page.waitForTimeout(2500);
    await page.click('#music-play');
    await W.until(page, () => /LUFS|below the gate/.test((document.getElementById('music-loudness') || {}).textContent || ''), undefined, 30000);
    console.log('studio sound engine: music', await page.textContent('#music-loudness'));
    assert.deepEqual(errors, [], 'no page errors');
    console.log('studio sound engine: pass');
  } catch (e) {
    failures++;
    console.error('FAIL', e.message);
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
