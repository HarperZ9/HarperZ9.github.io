// The rooms of The Playground in a browser. A room is a folded page: a section of /playground/ that opens on a press.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms.cjs
//
// What it holds, for the type forge (#type):
//   1. Before a press the page fetches nothing of the room: not rooms.mjs, the room module or the forge.
//   2. Keyboard alone opens it, and the press fetches no more than the page states beside the button.
//   3. It makes a font: the saved file is a TrueType file of the size the room states, and the line is an SVG.
//   4. An arrow key on a slider mints a different face, and the address follows; a weight too heavy is refused,
//      with words, and no file is offered.
//   5. Hand-overs: the lettering letters the forge's line, the forge takes the blend's palette, each said in words.
//      A room opened before the blend starts still hands its line on when the blend starts.
//   6. A deep link opens the same face and line.
//   7. Nothing made in the room is sent anywhere: every request after the press is a GET for a site file.
//   8. Scripts off: the still, the label and the words are there and no dead button shows.
//   9. A 390 px screen has no sideways scroll with the room open, and nothing in the room animates.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const ROOM = /rooms\.mjs|room-forge|type-forge\//;
const LIVE = '#type[data-room-live]';
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [], asked = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => asked.push({ path: new URL(r.url()).pathname, method: r.method(), origin: new URL(r.url()).origin, body: r.postData() }));
  page.on('response', async (r) => { try { got.push({ path: new URL(r.url()).pathname, bytes: (await r.body()).length }); } catch { /* a blob or an aborted fetch has no body to read */ } });
  await page.goto(base + path, { waitUntil: 'load' });
  return { ctx, page, errors, asked, got };
}
const settled = (page) => page.waitForFunction(() => document.querySelector('#type .rm-host')?.dataset.sha && !document.querySelector('#type .fg-ttf')?.hidden);
const sha = (page) => page.evaluate(() => document.querySelector('#type .rm-host').dataset.sha);
const forge = (page) => page.evaluate(() => window.__rooms.handles.forge.value());

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    { // 1 to 4 and 7: from the keyboard
      const { ctx, page, errors, asked, got } = await open(browser, '/playground/');
      await page.waitForSelector('#type [data-room-open]:not([hidden])');
      assert.deepEqual(asked.filter((r) => ROOM.test(r.path)).map((r) => r.path), [], 'nothing of the room is fetched before a press');
      const stated = await page.evaluate(() => { const m = /Loads (\d+) KB/.exec(document.querySelector('#type .sx-go span').textContent); return m ? +m[1] * 1024 : null; });
      assert.ok(stated > 0, 'the press states its size');
      const before = got.length, askedBefore = asked.length;
      await page.focus('#type [data-room-open]'); await page.keyboard.press('Enter');
      await page.waitForSelector(LIVE); await settled(page);
      await page.waitForTimeout(700);
      // the room's own files; the shell's parts that arrive on a first focus are held by tests/shell-parts.cjs
      const fetched = got.slice(before).filter((r) => /^\/(world\/site\/surfaces|system)\//.test(r.path)).reduce((n, r) => n + r.bytes, 0);
      assert.ok(fetched > 20 * 1024 && fetched <= stated + 2048, `the press fetched ${fetched} bytes; the page says at most ${stated}`);
      assert.ok(!got.slice(before).some((r) => /elements\.json|elements-data/.test(r.path)), 'the room does not load the element table');
      out.pressBytes = fetched; out.stated = stated;
      // 7: nothing is sent
      const after = asked.slice(askedBefore);
      assert.ok(after.every((r) => r.method === 'GET' && r.origin === base && !r.body), 'every request after the press is a GET for a site file');
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#type .rm-host')), true, 'focus lands in the room');
      // 3: the files
      const files = await page.evaluate(async () => {
        const a = document.querySelector('#type .fg-ttf'), s = document.querySelector('#type .fg-svg');
        const ttf = new Uint8Array(await (await fetch(a.href)).arrayBuffer()), svg = await (await fetch(s.href)).text();
        return { head: [...ttf.slice(0, 4)], bytes: ttf.length, name: a.download, svgName: s.download, svg: svg.slice(0, 60), paths: (svg.match(/<path /g) || []).length,
          said: document.querySelector('#type .fg-file').textContent, family: getComputedStyle(document.querySelector('#type .fg-sample')).fontFamily };
      });
      assert.deepEqual(files.head, [0, 1, 0, 0], 'the saved font starts as a TrueType file');
      assert.ok(files.said.includes(files.bytes.toLocaleString('en')), `the room states the file's size (${files.bytes}): ${files.said}`);
      assert.match(files.name, /^zain-mint-[0-9a-f]{8}\.ttf$/); assert.match(files.svgName, /\.svg$/);
      assert.ok(files.svg.startsWith('<svg') && files.paths >= 20, 'the line is an SVG of outlines');
      assert.match(files.family, /ZainMint-[0-9a-f]{12}/, 'the proof is set in the minted face');
      const [download] = await Promise.all([page.waitForEvent('download'), page.click('#type .fg-ttf')]);
      assert.match(download.suggestedFilename(), /\.ttf$/, 'a click saves the font');
      await download.path(); await download.delete();
      // 4: a slider from the keyboard, then a refusal
      const first = await sha(page);
      await page.focus('#fg-weight'); for (let i = 0; i < 12; i++) await page.keyboard.press('ArrowRight');
      await page.waitForFunction((was) => document.querySelector('#type .rm-host').dataset.sha !== was, first);
      assert.match(page.url(), /room=type/); assert.match(page.url(), /tf=0\.097,/, 'the address follows the face');
      await page.focus('#fg-weight'); await page.keyboard.press('End');
      await page.waitForSelector('#type .rm-host.fg-refused');
      const refused = await page.evaluate(() => ({ said: document.querySelector('#type .fg-file').textContent, ttf: document.querySelector('#type .fg-ttf').hidden }));
      assert.ok(/Refused/.test(refused.said) && /counter-minimum/.test(refused.said) && refused.ttf, 'a weight too heavy is refused by name and no file is offered');
      // 5a: the room was opened first; the blend starts after and the lettering still letters the line
      await page.fill('#fg-text', 'Low tide'); await page.keyboard.press('Home');
      await page.waitForFunction(() => +document.querySelector('#type').dataset.sent >= 1);
      assert.match(await page.textContent('#type .rm-say'), /made a text\. Nothing open on the page takes it yet\./);
      await page.click('#sx-start'); await page.waitForSelector('html[data-surface-page-ready]');
      await page.waitForFunction(() => document.querySelector('#sx-hosts .lt-word')?.textContent.includes('Low tide'));
      assert.match(await page.textContent('#sx-hosts [data-part="lettering"] .ln-note'), /handed on by the type forge/);
      // 5b: the forge takes the palette, and a new line reaches the lettering
      await page.waitForFunction(() => document.querySelector('#type').dataset.heard === 'palette');
      assert.ok(['text', 'rule'].includes((await forge(page)).ink), 'the blend’s colour inks or rules the proof');
      assert.match(await page.textContent('#type .rm-say'), /took the palette from the blend table/);
      await page.fill('#fg-text', 'High water');
      await page.waitForFunction(() => document.querySelector('#sx-hosts .lt-word')?.textContent.includes('High water'));
      assert.match(await page.textContent('#type .rm-say'), /handed its text to lettering/);
      assert.deepEqual(errors, [], 'no page errors');
      await ctx.close();
    }
    { // 6: a deep link
      const { ctx, page, errors } = await open(browser, '/playground/?room=type&tf=0.145,0.82,1.2,0.5,2.4,0.6&caps=runic&line=Hello%20there#type');
      await page.waitForSelector(LIVE); await settled(page);
      const v = await forge(page);
      assert.equal(v.params.weight, 0.145); assert.equal(v.params.width, 1.2); assert.equal(v.params.style, 'runic'); assert.equal(v.text, 'Hello there');
      assert.equal(await page.inputValue('#fg-text'), 'Hello there');
      assert.deepEqual(errors, []);
      await page.waitForTimeout(1200);   // let the shell's first-focus parts finish arriving; closing Chrome mid-fetch stalls its shutdown
      await ctx.close();
    }
    { // 8: scripts off
      const { ctx, page } = await open(browser, '/playground/', { javaScriptEnabled: false });
      const plain = await page.evaluate(() => { const s = document.querySelector('#type'); return { paths: s.querySelectorAll('.rm-still svg path').length, label: !!s.querySelector('.demo-form[data-form="live"]'),
        button: getComputedStyle(s.querySelector('[data-room-open]')).display, host: getComputedStyle(s.querySelector('.rm-host')).display, words: s.querySelector('p').textContent.length }; });
      assert.ok(plain.paths >= 8 && plain.label && plain.words > 100, 'the still, the label and the words are there with scripts off');
      assert.equal(plain.button, 'none'); assert.equal(plain.host, 'none');
      await ctx.close();
    }
    { // 9: a phone, reduced motion
      const { ctx, page, errors } = await open(browser, '/playground/?room=type#type', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await page.waitForSelector(LIVE); await settled(page);
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        moving: document.getAnimations().filter((a) => document.querySelector('#type').contains(a.effect?.target)).length,
        small: [...document.querySelectorAll('#type .rm-host button, #type .rm-host select, #type .fg-take a')].filter((e) => e.getBoundingClientRect().height < 44).length }));
      assert.equal(m.over, 0, 'no sideways scroll at 390 px'); assert.equal(m.moving, 0, 'nothing in the room animates'); assert.equal(m.small, 0, 'every press target is at least 44 px tall');
      assert.deepEqual(errors, []);
      await page.waitForTimeout(1200);   // let the shell's first-focus parts finish arriving; closing Chrome mid-fetch stalls its shutdown
      await ctx.close();
    }
    console.log('surface-rooms: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
