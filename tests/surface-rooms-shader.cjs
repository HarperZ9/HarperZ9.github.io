// The shader room of The Playground in a browser (#shader): a fragment shader written, run and handed on.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms-shader.cjs
//
// What it holds:
//   1. Before a press the page fetches nothing of the room. Keyboard alone opens it, and that press fetches no more
//      than the page states, without the preset library.
//   2. The shader runs: frames are drawn, the frame is not empty, Pause holds it and Run starts it again.
//   3. A mistake is marked at the line it was typed on, in the list and in the line numbers; the last working frame
//      stays; the line's button puts the cursor on that line; fixing it compiles again.
//   4. It makes files: the source as typed, the frame as a PNG, and the frame as pen lines, plotter moves and a relief,
//      each naming the shader room as its maker where the format has a header.
//   5. The address carries the shader: a link opens the same source and sliders in a new tab.
//   6. The preset library loads on its own press, no larger than stated, and every one of its shaders compiles with
//      the inputs the room adds.
//   7. Hand-overs: the blend's colours reach the shader, the pen study's picture reaches it, and the loom draws the
//      shader's frame, each said in words.
//   8. Nothing typed in the room is sent anywhere: every request after the press is a GET for a site file.
//   9. Scripts off: the first shader is there as text, with the label and the words, and no dead button shows.
//  10. A 390 px screen has no sideways scroll; under reduced motion the shader starts paused and Run starts it.
//  11. With no room open, the picture last handed on (the pen study's) leaves as a PNG, plotter moves and a relief; the
//      file writers load on the first file that needs them, no larger than stated.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const ROOM = /rooms\.mjs|room-shader|shader-starts|shader-runner|shader-presets|take-files/, OWN = /^\/(world\/site\/surfaces|system)\//, LIVE = '#shader[data-room-live]';
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
const value = (page) => page.evaluate(() => window.__rooms.handles.shader.value());
const frames = (page) => page.evaluate(() => +document.querySelector('#shader .rm-host').dataset.frames);
const own = (list) => list.filter((r) => OWN.test(r.path)).reduce((n, r) => n + r.bytes, 0);
// the frame as the page shows it: mean and spread of its pixels, and the colour at its middle
const look = (page) => page.evaluate(() => { const c = document.querySelector('#shader .shd-frame'), k = document.createElement('canvas'); k.width = 64; k.height = 40; const x = k.getContext('2d'); x.drawImage(c, 0, 0, 64, 40);
  const d = x.getImageData(0, 0, 64, 40).data; let sum = 0, lo = 255, hi = 0; for (let i = 0; i < d.length; i += 4) { const v = (d[i] + d[i + 1] + d[i + 2]) / 3; sum += v; lo = Math.min(lo, v); hi = Math.max(hi, v); }
  return { mean: sum / (d.length / 4), spread: hi - lo }; });
const saved = async (page, click) => { const [d] = await Promise.all([page.waitForEvent('download'), click()]); const fs = require('node:fs'), body = fs.readFileSync(await d.path()); await d.delete(); return { name: d.suggestedFilename(), body }; };
const leave = async (ctx, page) => { await page.evaluate(() => window.__rooms?.handles.shader?.destroy()).catch(() => {}); await page.waitForTimeout(1300); await ctx.close(); };

const step = (words) => { if (process.env.STEPS) console.log(words); };
(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    let shared = '';
    { // 1 to 6 and 8: from the keyboard
      const { ctx, page, errors, asked, got } = await open(browser, '/playground/');
      await page.waitForSelector('#shader [data-room-open]:not([hidden])');
      assert.deepEqual(asked.filter((r) => ROOM.test(r.path)).map((r) => r.path), [], 'nothing of the room is fetched before a press');
      const stated = await page.evaluate(() => +/Loads (\d+) KB/.exec(document.querySelector('#shader .sx-go span').textContent)[1] * 1024);
      let mark = got.length; const askedBefore = asked.length;
      await page.focus('#shader [data-room-open]'); await page.keyboard.press('Enter');
      await page.waitForSelector(LIVE); await page.waitForFunction(() => +document.querySelector('#shader .rm-host').dataset.frames > 5);
      await page.waitForTimeout(500);
      const opened = own(got.slice(mark));
      assert.ok(opened > 20 * 1024 && opened <= stated + 2048, `the press fetched ${opened} bytes; the page says at most ${stated}`);
      assert.ok(!got.slice(mark).some((r) => /shader-presets|elements\.json/.test(r.path)), 'opening loads no preset library and no element table');
      out.openBytes = opened; out.stated = stated;
      step('2: it runs');
      // 2: it runs
      const first = await value(page); assert.equal(first.ok, true); assert.equal(first.running, true); assert.match(first.hash, /^[0-9a-f]{16}$/);
      const seen = await look(page); assert.ok(seen.spread > 40 && seen.mean > 8, `the frame holds a picture (mean ${seen.mean.toFixed(1)}, spread ${seen.spread.toFixed(1)})`);
      await page.focus('#shader [data-run]'); await page.keyboard.press('Enter');
      const held = await frames(page); await page.waitForTimeout(400);
      assert.ok(await frames(page) <= held + 1, 'Pause holds the frame'); assert.equal(await page.textContent('#shader [data-run]'), 'Run');
      await page.keyboard.press('Enter'); await page.waitForFunction((n) => +document.querySelector('#shader .rm-host').dataset.frames > n + 5, held);
      step('3: a mistake on line 10');
      // 3: a mistake on line 10
      const good = await page.inputValue('#shd-src'), lines = good.split('\n');
      assert.ok(lines.length >= 12, 'the first shader has a tenth line to break');
      const broken = [...lines]; broken[9] = lines[9] + ' zzz = 1.0;';
      await page.fill('#shd-src', broken.join('\n'));
      await page.waitForFunction(() => document.querySelector('#shader .rm-host').dataset.ok === 'false');
      const bad = await page.evaluate(() => ({ list: document.querySelector('#shader .shd-err').textContent, marks: [...document.querySelectorAll('#shader .shd-gutter .bad')].map((s) => s.textContent), numbers: document.querySelectorAll('#shader .shd-gutter span').length }));
      assert.match(bad.list, /did not compile/); assert.match(bad.list, /Line 10/); assert.match(bad.list, /zzz/);
      assert.deepEqual(bad.marks, ['10'], 'the mistake is marked on its line'); assert.equal(bad.numbers, lines.length);
      const before = await frames(page); await page.waitForTimeout(300); assert.ok(await frames(page) > before, 'the last working frame keeps running');
      await page.click('#shader .shd-err [data-line="10"]');
      const sel = await page.evaluate(() => { const t = document.querySelector('#shd-src'); return { focused: document.activeElement === t, text: t.value.slice(t.selectionStart, t.selectionEnd) }; });
      assert.deepEqual(sel, { focused: true, text: broken[9] }, 'the line button puts the cursor on the line');
      const edited = good.replace('9.0', '11.0');
      await page.fill('#shd-src', edited); await page.waitForFunction(() => document.querySelector('#shader .rm-host').dataset.ok === 'true');
      assert.equal(await page.textContent('#shader .shd-err'), ''); assert.equal(await page.locator('#shader .shd-gutter .bad').count(), 0);
      step('4: files');
      // 4: files
      const source = await page.evaluate(async () => { const a = document.querySelector('#shader .shd-glsl'); return { text: await (await fetch(a.href)).text(), name: a.download }; });
      assert.equal(source.text, edited); assert.match(source.name, /^shader-[0-9a-f]{8}\.glsl$/);
      const png = await saved(page, () => page.click('#shader [data-png]'));
      assert.match(png.name, /\.png$/); assert.deepEqual([...png.body.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]); assert.equal(png.body.readUInt32BE(16), 640); assert.equal(png.body.readUInt32BE(20), 400);
      const svg = await saved(page, () => page.click('#shader [data-file="plot-svg"]')), svgText = svg.body.toString('utf8');
      assert.match(svg.name, /\.plot\.svg$/); assert.ok(svgText.includes('<svg') && (svgText.match(/<(path|polyline|line) /g) || []).length > 20, 'the plot is an SVG of pen lines');
      assert.match(svgText, /made by the shader room/); assert.ok(!/element bench/.test(svgText), 'the plot names the shader room as its maker');
      const gcode = await saved(page, () => page.click('#shader [data-file="plot-gcode"]')), g = gcode.body.toString('utf8');
      assert.match(g, /^; made by the shader room/); assert.match(g, /G21/); assert.ok((g.match(/^G[01] /gm) || []).length > 50, 'the plotter moves are G-code');
      const stl = await saved(page, () => page.click('#shader [data-file="relief-stl"]'));
      assert.match(stl.name, /\.stl$/); assert.ok(stl.body.length > 10000, 'the relief is a solid');
      assert.match(await page.textContent('#shader .shd-made'), /Saved relief to print of the frame: [\d,]+ bytes/);
      step('5: the address');
      // 5: the address
      await page.focus('#shd-k0'); for (let i = 0; i < 10; i++) await page.keyboard.press('ArrowRight');
      await page.waitForFunction(() => /[?&]sh=z\./.test(location.search) && /[?&]k=0\.6,0\.5,0\.5/.test(location.search));
      shared = await page.evaluate(() => location.pathname + location.search + location.hash); out.link = shared.length;
      step('6: the library, and every preset through the rooms runner');
      // 6: the library, and every preset through the room's runner
      mark = got.length;
      await page.focus('#shader [data-library]'); await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.querySelector('#shader .rm-host').dataset.library);
      for (let i = 0; i < 40 && !got.slice(mark).some((r) => /shader-presets/.test(r.path)); i++) await page.waitForTimeout(100);   // the response's bytes are read a moment after it lands
      const lib = own(got.slice(mark)), said = await page.evaluate(() => document.querySelector('#shd-preset').closest('p').textContent);
      assert.ok(lib > 500 * 1024 && lib <= 918 * 1024 + 1024, `the library press fetched ${lib} bytes; the page said 918 KB`);
      assert.equal(await page.locator('#shd-preset option').count(), 255); assert.match(said, /254 shaders/);
      await page.selectOption('#shd-preset', { index: 1 }); await page.waitForFunction(() => window.__rooms.handles.shader.value().preset);
      assert.equal((await value(page)).ok, true);
      // compiled, not linked: the compile step is where a name in a preset would clash with an input the room adds, and
      // linking 254 programs takes minutes on some drivers
      const failed = await page.evaluate(async () => { const { wrap } = await import('/system/shader-runner.js'), { SHADER_PRESETS } = await import('/system/shader-presets.js');
        const gl = document.createElement('canvas').getContext('webgl'), bad = [];
        for (const p of SHADER_PRESETS) { const sh = gl.createShader(gl.FRAGMENT_SHADER); gl.shaderSource(sh, wrap(p.glsl)); gl.compileShader(sh);
          if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) bad.push(`${p.name}: ${(gl.getShaderInfoLog(sh) || '').split('\n')[0]}`); gl.deleteShader(sh); }
        return bad; });
      assert.deepEqual(failed, [], 'every preset compiles with the inputs the room adds');
      out.libraryBytes = lib;
      step('8: nothing is sent');
      // 8: nothing is sent
      const after = asked.slice(askedBefore).filter((r) => !r.blob);
      assert.ok(after.every((r) => r.method === 'GET' && r.origin === base && !r.body), 'every request after the press is a GET for a site file');
      assert.deepEqual(errors, [], 'no page errors');
      await leave(ctx, page);
    }
    { // 5: the link opens the same shader in a new tab
      const { ctx, page, errors } = await open(browser, shared);
      await page.waitForSelector(LIVE); await page.waitForFunction(() => window.__rooms.handles.shader.value().ok);
      const v = await value(page);
      assert.ok(v.source.includes('11.0') && !v.source.includes('zzz'), 'the link carries the edited source'); assert.deepEqual(v.knobs, [0.6, 0.5, 0.5]);
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 7: hand-overs, with no well: the blend's colours, the pen study's picture, and the loom
      const { ctx, page, errors } = await open(browser, '/playground/?room=shader&shp=bands#shader');
      await page.waitForSelector(LIVE);
      assert.equal((await value(page)).palette, 0); assert.match(await page.textContent('#shader .shd-in'), /No colours have been handed in/);
      // the room hands its own frame on first, as it does on a slow connection; the pen study's picture must still reach it
      await page.waitForFunction(() => window.__rooms.bus.log().some((l) => l.ok && l.medium === 'image' && l.from === 'shader'));
      await page.click('#sx-start'); await page.waitForSelector('html[data-surface-page-ready]');
      await page.waitForFunction(() => +document.querySelector('#shader .rm-host').dataset.palette >= 2);
      assert.match(await page.textContent('#shader .shd-in'), /Its colours come from the blend/);
      // the bands are drawn in the handed colours: the frame's middle is one of them
      const inks = await page.evaluate(() => window.__rooms.last.palette.value.inks);
      const mid = await page.evaluate(() => { const c = document.querySelector('#shader .shd-frame'), k = document.createElement('canvas'); k.width = c.width; k.height = c.height; const x = k.getContext('2d'); x.drawImage(c, 0, 0); const cols = new Set();
        for (let px = 8; px < c.width; px += 16) { const d = x.getImageData(px, 200, 1, 1).data; cols.add('#' + [d[0], d[1], d[2]].map((v) => v.toString(16).padStart(2, '0')).join('')); } return [...cols]; });
      const near = (a, b) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 3);
      assert.ok(inks.slice(0, 5).some((ink) => mid.some((m) => near(m, ink))), `a band is drawn in a handed colour (${inks.join(' ')} against ${mid.slice(0, 8).join(' ')})`);
      await page.waitForFunction(() => document.querySelector('#shader .rm-host').dataset.picture === 'plot');
      assert.match(await page.textContent('#shader .shd-in'), /Its picture comes from the pen study/);
      await page.click('[data-sx-press="loom"]'); await page.waitForSelector('#sx-hosts [data-part="loom"] canvas[data-drawn]');
      await page.waitForFunction(() => document.querySelector('#sx-hosts [data-part="loom"]').dataset.pictureOf === 'shader');
      // the loom draws a moment after a picture arrives; its own line names whose picture it wove
      await page.waitForFunction(() => /^The shader woven on the Loom/.test(document.querySelector('#sx-hosts [data-part="loom"] .ln-note').textContent));
      await page.waitForFunction(() => /handed its picture to .*loom/.test(document.querySelector('#shader .rm-say').textContent));
      assert.match(await page.textContent('#shader .rm-say'), /The shader took the (palette|picture) from/);
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    { // 11: the picture last handed on leaves as files, with no room open and no well: the pen study's picture
      const { ctx, page, errors, got } = await open(browser, '/playground/');
      await page.click('#sx-start'); await page.waitForSelector('html[data-surface-page-ready]');
      await page.waitForSelector('#sx-take:not([hidden])');
      assert.equal(await page.textContent('#sx-take-of'), 'Take the picture from the pen study with you:');
      const stated = await page.evaluate(() => +document.querySelector('#sx-take [data-take-bytes]').dataset.takeBytes);
      assert.ok(!got.some((r) => /take-files|plotter\.js|relief-stl/.test(r.path)), 'the file writers are not loaded before a file is asked for');
      const png = await saved(page, () => page.click('#sx-take [data-sx-file="png"]'));
      assert.equal(png.name, 'plot-picture.png'); assert.deepEqual([...png.body.subarray(0, 4)], [137, 80, 78, 71]);
      const mark = got.length;
      const g = await saved(page, () => page.click('#sx-take [data-sx-file="plot-gcode"]')), text = g.body.toString('utf8');
      assert.equal(g.name, 'plot-picture.plot.gcode'); assert.match(text, /^; made on The Playground \(harperz9\.github\.io\/playground\/\) from the picture of the pen study/); assert.ok((text.match(/^G[01] /gm) || []).length > 50);
      await page.waitForTimeout(400);
      const fetched = own(got.slice(mark));
      assert.ok(fetched > 20 * 1024 && fetched <= stated + 1024, `the first file fetched ${fetched} bytes; the page says ${stated}`);
      assert.match(await page.textContent('#sx-say'), /Saved plotter moves of the picture from the pen study: [\d,]+ bytes\./);
      const stl = await saved(page, () => page.click('#sx-take [data-sx-file="relief-stl"]')); assert.match(stl.name, /\.stl$/);
      out.takeBytes = fetched; out.takeStated = stated;
      assert.deepEqual(errors, []);
      await page.waitForTimeout(1300); await ctx.close();
    }
    { // 9: scripts off
      const { ctx, page } = await open(browser, '/playground/', { javaScriptEnabled: false });
      const plain = await page.evaluate(() => { const s = document.querySelector('#shader'); return { code: s.querySelector('.rm-still .shd-still').textContent, label: !!s.querySelector('.demo-form[data-form="live"]'),
        button: getComputedStyle(s.querySelector('[data-room-open]')).display, host: getComputedStyle(s.querySelector('.rm-host')).display, words: s.querySelector('p').textContent.length }; });
      assert.ok(/void mainImage/.test(plain.code) && plain.label && plain.words > 100, 'the first shader, the label and the words are there with scripts off');
      assert.equal(plain.button, 'none'); assert.equal(plain.host, 'none');
      await ctx.close();
    }
    { // 10: a phone, reduced motion
      const { ctx, page, errors } = await open(browser, '/playground/?room=shader#shader', { viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
      await page.waitForSelector(LIVE); await page.waitForTimeout(900);
      const still = await frames(page); await page.waitForTimeout(500);
      const m = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - document.documentElement.clientWidth, running: window.__rooms.handles.shader.value().running, said: document.querySelector('#shader .shd-made').textContent,
        small: [...document.querySelectorAll('#shader .rm-host button, #shader .rm-host select, #shader .shd-take a')].filter((e) => e.checkVisibility() && e.getBoundingClientRect().height < 44).length }));
      assert.equal(m.over, 0, 'no sideways scroll at 390 px'); assert.equal(m.running, false); assert.ok(await frames(page) === still && still >= 1 && still <= 4, `under reduced motion the frame is drawn and held (${still} frames)`);
      assert.match(m.said, /Reduced motion is on/); assert.equal(m.small, 0, 'every press target is at least 44 px tall');
      assert.ok((await look(page)).spread > 40, 'the held frame holds a picture');
      await page.click('#shader [data-run]'); await page.waitForFunction((n) => +document.querySelector('#shader .rm-host').dataset.frames > n + 5, still);
      assert.deepEqual(errors, []);
      await leave(ctx, page);
    }
    console.log('surface-rooms-shader: ok', JSON.stringify(out));
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
