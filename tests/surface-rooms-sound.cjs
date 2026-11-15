// The sound room of The Playground in a browser (#sound): the site music, folded in from /system/site-music/.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms-sound.cjs
//
// What it holds:
//   1. Before a press the page fetches nothing of the room. Keyboard alone opens it, and that press fetches no more
//      than the page states beside the button, with none of the instruments.
//   2. Nothing plays on open. Play, from the keyboard, starts the piece: bars and chords are read out, and what that
//      press fetched (the instruments) is no more than the second figure the page states. Stop turns it off.
//   3. It makes a file: a 16-bit stereo WAV at 48 kHz whose size is the size the room stated before rendering, that
//      is not silent, and that a click saves. The room states the loudness it measured on the render.
//   4. Hand-overs: the blend chooses the piece (ink has none, glass has Glass Hour), the forge's line sets the seed,
//      a new line sets a new one, each said in words, and the room gives its score.
//   5. A deep link opens the same piece, band, seed and length, and plays nothing.
//   6. Nothing made in the room is sent anywhere: every request after the press is a GET for a site file.
//   7. Scripts off: the five pieces, the label and the words are there and no dead button shows.
//   8. A 390 px screen has no sideways scroll with the room open, nothing animates, and every press target is 44 px.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const ROOM = /rooms\.mjs|room-sound|site-music\/|world\/sound\//, INSTRUMENTS = /site-music\/(worker|piece\.worker|render|score|measured-data|voices)\.js/;
const OWN = /^\/(world\/site\/surfaces|world\/sound|world\/studio|system)\//, LIVE = '#sound[data-room-live]';
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [], asked = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => asked.push({ path: new URL(r.url()).pathname, method: r.method(), origin: new URL(r.url()).origin, body: r.postData(), blob: r.url().startsWith('blob:') }));
  page.on('response', async (r) => { try { got.push({ path: new URL(r.url()).pathname, bytes: (await r.body()).length }); } catch { /* a blob or an aborted fetch has no body to read */ } });
  await page.goto(base + path, { waitUntil: 'load' });
  return { ctx, page, errors, asked, got };
}
const value = (page) => page.evaluate(() => window.__rooms.handles.sound.value());
const host = (page, key) => page.evaluate((k) => document.querySelector('#sound .rm-host').dataset[k], key);
// The room's own files in a list of responses, each counted once. Every worker reads its modules again; the test server
// sends them again each time, where the published site answers from the browser's cache, so a file counts once here.
const own = (list) => [...new Map(list.filter((r) => OWN.test(r.path)).map((r) => [r.path, r.bytes])).values()].reduce((n, b) => n + b, 0);
// leave with the music off and the shell's first-focus parts arrived; closing Chrome mid-sound or mid-fetch stalls its shutdown
const leave = async (ctx, page) => { await page.evaluate(() => window.__rooms?.handles.sound?.destroy()).catch(() => {}); await page.waitForTimeout(1300); await ctx.close(); };

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    { // 1, 2, 3 and 6: from the keyboard
      const { ctx, page, errors, asked, got } = await open(browser, '/playground/?seed=7');
      await page.waitForSelector('#sound [data-room-open]:not([hidden])');
      assert.deepEqual(asked.filter((r) => ROOM.test(r.path)).map((r) => r.path), [], 'nothing of the room is fetched before a press');
      const stated = await page.evaluate(() => { const s = document.querySelector('#sound .sx-go span'); return { open: +/Loads (\d+) KB/.exec(s.textContent)[1] * 1024, later: +s.querySelector('[data-later]').dataset.later, words: s.querySelector('[data-later]').textContent }; });
      assert.ok(stated.open > 0 && stated.later > 0 && stated.words.includes(`${Math.round(stated.later / 1024)} KB`), 'both presses state their size');
      let mark = got.length; const askedBefore = asked.length;
      await page.focus('#sound [data-room-open]'); await page.keyboard.press('Enter');
      await page.waitForSelector(LIVE); await page.waitForTimeout(700);
      const opened = own(got.slice(mark));
      assert.ok(opened > 20 * 1024 && opened <= stated.open + 2048, `the press fetched ${opened} bytes; the page says at most ${stated.open}`);
      assert.ok(!got.slice(mark).some((r) => INSTRUMENTS.test(r.path) || /elements\.json|elements-data/.test(r.path)), 'opening loads no instrument and no element table');
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#sound .rm-host')), true, 'focus lands in the room');
      assert.equal(await host(page, 'playing'), '', 'nothing plays on open'); assert.equal(await page.textContent('#sound .snd-now'), 'Music is off.');
      // 2: Play from the keyboard
      mark = got.length; const playMark = mark;
      await page.focus('#sound [data-play="glass-hour"]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => +document.querySelector('#sound .rm-host').dataset.bar >= 2, null, { timeout: 60000 });
      assert.match(await page.textContent('#sound .snd-now'), /^Glass Hour, bar \d+: \S+/);
      assert.equal(await page.getAttribute('#sound [data-play="glass-hour"]', 'aria-pressed'), 'true'); assert.equal(await page.textContent('#sound [data-play="glass-hour"]'), 'Stop Glass Hour');
      const played = own(got.slice(mark));
      assert.ok(played > 200 * 1024 && played <= stated.later + 2048, `the first Play fetched ${played} bytes; the page says at most ${stated.later}`);
      assert.match(page.url(), /room=sound/); assert.match(page.url(), /piece=glass-hour/);
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#sound .rm-host').dataset.playing === '');
      assert.equal(await page.textContent('#sound .snd-now'), 'Music is off.');
      out.openBytes = opened; out.statedOpen = stated.open; out.playBytes = played; out.statedLater = stated.later;
      // 3: the file
      const promised = await page.evaluate(() => +/a file of ([\d,]+) bytes/.exec(document.querySelector('#sound .snd-cost').textContent)[1].replace(/,/g, ''));
      mark = got.length;
      await page.focus('#sound [data-render]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#sound .rm-host').dataset.file, null, { timeout: 180000 });
      const both = own(got.slice(playMark));
      assert.ok(both > played && both <= stated.later + 2048, `Play and the file together fetched ${both} bytes; the page says at most ${stated.later}`);
      const file = await page.evaluate(async () => {
        const a = document.querySelector('#sound .snd-wav'), buf = await (await fetch(a.href)).arrayBuffer(), v = new DataView(buf), s = new Int16Array(buf, 44);
        let peak = 0, sum = 0; for (let i = 0; i < s.length; i++) { const x = Math.abs(s[i]) / 32768; if (x > peak) peak = x; sum += x * x; }
        return { tag: String.fromCharCode(...new Uint8Array(buf, 0, 4)) + String.fromCharCode(...new Uint8Array(buf, 8, 4)), bytes: buf.byteLength, channels: v.getUint16(22, true), rate: v.getUint32(24, true), bits: v.getUint16(34, true),
          peak, rms: Math.sqrt(sum / s.length), name: a.download, said: document.querySelector('#sound .snd-file').textContent };
      });
      assert.equal(file.tag, 'RIFFWAVE'); assert.deepEqual([file.channels, file.rate, file.bits], [2, 48000, 16]);
      assert.equal(file.bytes, promised, 'the file is the size the room stated before rendering');
      assert.ok(file.said.includes(file.bytes.toLocaleString('en')) && /loudness -1[34]\.\d LUFS, true peak -\d\.\d dBTP/.test(file.said), `the room states the file's size and measured loudness: ${file.said}`);
      assert.ok(file.peak > 0.3 && file.peak < 1 && file.rms > 0.02, `the file holds sound that does not clip (peak ${file.peak.toFixed(3)}, rms ${file.rms.toFixed(3)})`);
      assert.equal(file.name, 'glass-hour-seed-7-16-bars.wav');
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#sound .snd-wav')]);
      assert.match(download.suggestedFilename(), /\.wav$/, 'a click saves the piece'); await download.path(); await download.delete();
      out.bothBytes = both; out.wavBytes = file.bytes; out.peak = +file.peak.toFixed(3); out.said = file.said;
      assert.match(await page.textContent('#sound .rm-say'), /Sound made a score\./);
      // 6: nothing is sent
      const after = asked.slice(askedBefore).filter((r) => !r.blob);
      assert.ok(after.every((r) => r.method === 'GET' && r.origin === base && !r.body), 'every request after the press is a GET for a site file');
      assert.deepEqual(errors, [], 'no page errors');
      await leave(ctx, page);
    }
    { // 4: hand-overs. The blend first, then the room, then the forge.
      const { ctx, page, errors } = await open(browser, '/playground/');
      await page.click('#sx-start'); await page.waitForSelector('html[data-surface-page-ready]');
      await page.click('#sound [data-room-open]'); await page.waitForSelector(LIVE);
      await page.waitForFunction(() => document.querySelector('#sound').dataset.heard === 'blend');
      assert.match(await page.textContent('#sound .snd-mood'), /ink has no piece of its own; glass, next by share, has Glass Hour/);
      assert.equal((await value(page)).piece, 'glass-hour'); assert.match(page.url(), /piece=glass-hour/);
      assert.match(await page.textContent('#sound .rm-say'), /Sound took the blend from the blend table\./);
      assert.equal(await host(page, 'playing'), '', 'a hand-over starts no sound');
      await page.click('#type [data-room-open]'); await page.waitForSelector('#type[data-room-live]');
      await page.waitForFunction(() => document.querySelector('#sound').dataset.heard === 'text');
      const seedOf = (text) => page.evaluate((t) => import('/world/site/surfaces/room-sound.mjs').then((m) => m.seedOf(t)), text);
      const first = await seedOf('Adhesion, rhythm and 2026 figures.');
      assert.equal((await value(page)).seed, first); assert.ok((await page.textContent('#sound .snd-seed-say')).includes(`sets seed ${first}`));
      assert.match(await page.textContent('#sound .rm-say'), /Sound took the text from the type forge\./);
      await page.fill('#fg-text', 'High water');
      const second = await seedOf('High water');
      await page.waitForFunction((n) => window.__rooms.handles.sound.value().seed === n, second);
      assert.notEqual(first, second); assert.match(page.url(), new RegExp(`seed=${second}`)); assert.equal(await page.inputValue('#snd-seed'), String(second));
      assert.ok(await page.evaluate(() => window.__rooms.bus.log().some((l) => l.ok && l.from === 'sound' && l.medium === 'score')), 'the room gives its score');
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 5: a deep link opens the same piece and plays nothing
      const { ctx, page, errors, got } = await open(browser, '/playground/?room=sound&piece=clear-line&arr=alt&seed=4821&bars=32#sound');
      await page.waitForSelector(LIVE); await page.waitForTimeout(900);
      const v = await value(page);
      assert.deepEqual([v.piece, v.arr, v.seed, v.bars, v.playing], ['clear-line', 'alt', 4821, 32, false]);
      assert.equal(await page.inputValue('#snd-piece'), 'clear-line'); assert.equal(await page.inputValue('#snd-bars'), '32'); assert.equal(await page.inputValue('#snd-seed'), '4821');
      assert.match(await page.textContent('#sound .snd-band'), /fretless, FM piano, synth lead and brass/);
      assert.ok(!got.some((r) => INSTRUMENTS.test(r.path)), 'a link loads no instrument and starts no sound');
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 7: scripts off
      const { ctx, page } = await open(browser, '/playground/', { javaScriptEnabled: false });
      const plain = await page.evaluate(() => { const s = document.querySelector('#sound'); return { pieces: s.querySelectorAll('.rm-still .snd-book li').length, label: !!s.querySelector('.demo-form[data-form="live"]'),
        button: getComputedStyle(s.querySelector('[data-room-open]')).display, host: getComputedStyle(s.querySelector('.rm-host')).display, words: s.querySelector('p').textContent.length }; });
      assert.ok(plain.pieces === 5 && plain.label && plain.words > 100, 'the five pieces, the label and the words are there with scripts off');
      assert.equal(plain.button, 'none'); assert.equal(plain.host, 'none');
      await ctx.close();
    }
    { // 8: a phone, reduced motion
      const { ctx, page, errors } = await open(browser, '/playground/?room=sound#sound', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await page.waitForSelector(LIVE); await page.waitForTimeout(500);
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        moving: document.getAnimations().filter((a) => document.querySelector('#sound').contains(a.effect?.target)).length,
        small: [...document.querySelectorAll('#sound .rm-host button, #sound .rm-host select, #sound .rm-host input[type="number"]')].filter((e) => e.getBoundingClientRect().height < 44).length }));
      assert.equal(m.over, 0, 'no sideways scroll at 390 px'); assert.equal(m.moving, 0, 'nothing in the room animates'); assert.equal(m.small, 0, 'every press target is at least 44 px tall');
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    console.log('surface-rooms-sound: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
