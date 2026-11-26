// The shell's parts load when they are used, and each still works from the keyboard once its code arrives.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/shell-parts.cjs
//
// The shell (world/ui/shell, imported) runs a small core on every page. Everything else is a part in its own
// file. This test holds, in a real browser:
//   1. Before anyone touches the Playground, the browser has fetched only the core: no part, no generator, no
//      universe table. The bytes fetched are inside the surface budget, measured here from the network and not
//      from the source, so a script started by a timer or by a load-time import counts.
//   2. The menu: opening it from the keyboard works at once, before its dressing has arrived (the dressing is
//      held back by the test); when the dressing arrives no link in the menu moves; focus is kept; Escape closes
//      it and gives focus back to the button. Under reduced motion the sand ground settles to a still.
//   3. Focus rings: a pointer press fetches nothing; the first focus ring the keyboard draws fetches the film;
//      the ring's colour and the focused control's place are the same before and after the film arrives.
//   4. Sound and copy (on the shell's own component page): neither file is fetched before a press; the press that
//      fetches the code is the press that takes effect; a second press undoes it; the button does not move.
//   5. Parts a page holds are fetched there and work: receipts answer keyboard focus, the halftone and the
//      lettering draw, a switch flips from the keyboard. A page that holds none fetches none.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const KB = 1024, BUDGET_JS = 60 * KB, BUDGET_DATA = 50 * KB;
const PARTS = /\/ui\/shell\/(?:organic\/(?:menu|made|band|palettes|focus-film|gen-util|organic-gen|root)|plates|sound|copy|slots|lettering|negative|media)\.js$/;
const GENERATORS = /chladni\.js|superstack\.mjs|thinfilm\.mjs|materials\.mjs|schema\.mjs|universe\/(?:lib|proto)\/here\.js|universe\.json/;
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [], got = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('response', async (r) => {
    const type = r.request().resourceType(), file = new URL(r.url()).pathname;
    if (type !== 'script' && type !== 'fetch' && type !== 'xhr') return;
    let bytes = 0; try { bytes = (await r.body()).length; } catch { /* a cancelled request has no body */ }
    got.push({ file, type, bytes });
  });
  await page.addInitScript(() => {
    window.__shift = 0;
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__shift += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(base + path, { waitUntil: 'load' });
  return { ctx, page, errors, got, files: () => got.map((g) => g.file) };
}
const rects = (sel) => [...document.querySelectorAll(sel)].map((e) => { const r = e.getBoundingClientRect(); return [Math.round(r.left * 10) / 10, Math.round(r.top * 10) / 10, Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; });
const tabTo = async (page, test, max = 60) => { let n = 0; while (n < max && !(await page.evaluate(test))) { await page.keyboard.press('Tab'); n++; } return n < max; };

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    // 1: what loads before anyone touches the page, counted from the network
    {
      const { ctx, page, errors, got, files } = await open(browser, '/playground/');
      await page.waitForSelector('[data-o="fold"]:not([hidden])');
      await page.waitForTimeout(3500);   // past the 2 s idle timeout of the magnet loader in hand-scroll.js: a timer is not a press
      assert.deepEqual(files().filter((f) => PARTS.test(f) || GENERATORS.test(f)), [], 'a part, a generator or the universe table loaded before any press');
      const inline = await page.evaluate(() => [...document.scripts].filter((s) => !s.src && !/json/.test(s.type)).reduce((a, s) => a + new TextEncoder().encode(s.textContent).length, 0));
      const js = got.filter((g) => g.type === 'script').reduce((a, g) => a + g.bytes, 0) + inline;
      const data = got.filter((g) => g.type !== 'script').reduce((a, g) => a + g.bytes, 0);
      assert.ok(js <= BUDGET_JS, `the browser fetched ${js} bytes of script before any press; the budget is ${BUDGET_JS}`);
      assert.ok(data <= BUDGET_DATA, `the browser fetched ${data} bytes of data before any press; the budget is ${BUDGET_DATA}`);
      assert.ok(js > 8 * KB, `the count reads real responses (${js} bytes)`);
      assert.ok(files().some((f) => f.endsWith('/ui/shell/shell.js')) && files().some((f) => f.endsWith('/ui/shell/organic/organic.js')), 'the core itself was counted');
      assert.deepEqual(errors, []);
      out.eager = { scriptBytes: js, dataBytes: data, files: got.filter((g) => g.type === 'script').map((g) => g.file) };
      await ctx.close();
    }
    // 2: the menu, from the keyboard, with its dressing held back and then let through
    {
      const { ctx, page, errors, files } = await open(browser, '/playground/');
      let release; const held = new Promise((r) => { release = r; });
      await page.route('**/ui/shell/organic/menu.js*', async (route) => { await held; await route.continue(); });
      await page.waitForSelector('[data-o="fold"]:not([hidden])');
      assert.ok(await tabTo(page, () => document.activeElement?.dataset?.o === 'fold'), 'Tab reaches the Places button');
      await page.keyboard.press('Enter');
      await page.waitForFunction(() => document.getElementById('o-menu').open);
      // the menu works as plain words while its dressing is still on the way
      assert.equal(await page.evaluate(() => !!document.querySelector('#o-menu canvas.o-sand')), false, 'the dressing was held back by the test');
      assert.equal(await page.evaluate(() => document.querySelector('[data-o="fold"]').getAttribute('aria-expanded')), 'true');
      assert.ok(await page.evaluate(() => document.getElementById('o-menu').contains(document.activeElement)), 'focus is inside the open menu');
      const ground = await page.evaluate(() => getComputedStyle(document.getElementById('o-menu')).backgroundColor);
      assert.equal(ground, 'rgb(20, 26, 46)', 'the menu has its material ground before the dressing arrives');
      const before = await page.evaluate(rects, '#o-menu a'), focusBefore = await page.evaluate(() => document.activeElement.getAttribute('href'));
      assert.ok(before.length >= 10 && before.every((r) => r[2] > 0 && r[3] > 0), 'the menu shows its places');
      await page.waitForTimeout(400);   // the opening animation ends before places are compared
      const settled = await page.evaluate(rects, '#o-menu a'), shiftBefore = await page.evaluate(() => window.__shift);
      release();
      await page.waitForSelector('#o-menu canvas.o-sand', { state: 'attached' });
      await page.waitForFunction(() => document.querySelectorAll('#o-menu [data-display]').length >= 10);
      await page.waitForTimeout(300);
      assert.deepEqual(await page.evaluate(rects, '#o-menu a'), settled, 'a place in the menu moved when the dressing arrived');
      assert.equal(await page.evaluate(() => window.__shift), shiftBefore, 'the page shifted when the dressing arrived');
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute('href')), focusBefore, 'focus moved when the dressing arrived');
      assert.ok(files().some((f) => f.endsWith('/organic/menu.js')) && files().some((f) => /chladni\.js$/.test(f)), 'the dressing and its generator came with the opening');
      // every place can be reached with Tab, in the order it is written
      const name = () => { const e = document.activeElement; return e.getAttribute('href') || e.textContent.trim(); };
      const order = await page.evaluate(() => [...document.querySelectorAll('#o-menu :is(a[href], button)')].filter((e) => e.offsetParent).map((e) => e.getAttribute('href') || e.textContent.trim()));
      const walked = [await page.evaluate(name)], from = order.indexOf(walked[0]);
      assert.ok(from >= 0 && order.length >= 10, 'focus starts on a control of the menu');
      for (let i = from + 1; i < order.length; i++) { await page.keyboard.press('Tab'); walked.push(await page.evaluate(name)); }
      assert.deepEqual(walked, order.slice(from), 'Tab walks the menu in the order it is written');
      await page.keyboard.press('Escape');
      // a dialog's close event is a task queued after `open` turns false, so the button's state is waited for by name
      await page.waitForFunction(() => !document.getElementById('o-menu').open && document.querySelector('[data-o="fold"]').getAttribute('aria-expanded') === 'false');
      assert.equal(await page.evaluate(() => document.activeElement?.dataset?.o), 'fold', 'Escape gives focus back to the Places button');
      // the "m" key opens it again, with nothing more to fetch
      const count = files().length;
      await page.keyboard.press('m');
      await page.waitForFunction(() => document.getElementById('o-menu').open);
      await page.waitForTimeout(300);
      assert.equal(files().length, count, 'a second opening fetched the dressing again');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 2b: reduced motion: the sand settles to a still
    {
      const { ctx, page, errors } = await open(browser, '/playground/', { reducedMotion: 'reduce' });
      await page.waitForSelector('[data-o="fold"]:not([hidden])');
      await page.keyboard.press('m');
      await page.waitForSelector('#o-menu canvas.o-sand', { state: 'attached' });
      await page.waitForTimeout(800);
      const read = () => { const c = document.querySelector('#o-menu canvas.o-sand'); return c.width + 'x' + c.height + ':' + c.toDataURL().length + ':' + c.toDataURL().slice(-80); };
      const a = await page.evaluate(read); await page.waitForTimeout(500); const b = await page.evaluate(read);
      assert.equal(a, b, 'the sand kept moving under reduced motion');
      assert.ok(await page.evaluate(() => { const c = document.querySelector('#o-menu canvas.o-sand'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; }), 'the still ground has sand on it');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 3: focus rings (reduced motion, so the film rests and its colour can be compared)
    {
      const { ctx, page, errors, files } = await open(browser, '/playground/', { reducedMotion: 'reduce' });
      let release; const held = new Promise((r) => { release = r; });
      await page.route('**/ui/shell/organic/focus-film.js*', async (route) => { await held; await route.continue(); });
      await page.waitForSelector('[data-o="fold"]:not([hidden])');
      await page.mouse.click(640, 400);                       // a pointer press on the page
      await page.locator('[data-o="lamp"]').click();          // and on a control: no focus ring is drawn for a pointer
      await page.locator('[data-o="lamp"]').click();
      await page.waitForTimeout(300);
      assert.deepEqual(files().filter((f) => /focus-film|thinfilm/.test(f)), [], 'a pointer press fetched the focus film');
      await page.keyboard.press('Tab');
      const ring = () => { const e = document.activeElement, r = e.getBoundingClientRect(), cs = getComputedStyle(e); return { tag: e.tagName, ring: cs.outlineColor, width: cs.outlineWidth, glow: cs.boxShadow, visible: e.matches(':focus-visible'), at: [r.left, r.top, r.width, r.height],
        film: ['--o-film-a', '--o-film-b'].map((k) => getComputedStyle(document.documentElement).getPropertyValue(k).trim().toLowerCase()) }; };
      const before = await page.evaluate(ring);
      assert.ok(before.visible && parseFloat(before.width) >= 2, 'the keyboard draws a focus ring before the film arrives');
      assert.deepEqual(before.film, ['#cb57ff', '#d09fd8'], 'the ring colours start as the film at rest');
      const shiftBefore = await page.evaluate(() => window.__shift);
      release();
      await page.waitForFunction(() => document.documentElement.style.getPropertyValue('--o-film-a') !== '');
      assert.ok(files().some((f) => /focus-film\.js$/.test(f)) && files().some((f) => /thinfilm\.mjs$/.test(f)), 'the first focus ring fetched the film');
      assert.deepEqual(await page.evaluate(ring), before, 'the ring or the focused control changed when the film arrived');
      assert.equal(await page.evaluate(() => window.__shift), shiftBefore, 'the page shifted when the film arrived');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 4: sound and copy on the shell's component page
    {
      const { ctx, page, errors, files } = await open(browser, '/world/ui/shell/template.html', { permissions: ['clipboard-read', 'clipboard-write'] });
      await page.waitForSelector('[data-sound]:not([hidden])'); await page.waitForSelector('[data-copy]:not([hidden])');
      await page.waitForTimeout(1500);
      assert.deepEqual(files().filter((f) => /\/ui\/shell\/(sound|copy)\.js$/.test(f)), [], 'sound or copy loaded before a press');
      for (const [sel, check, undo, rest] of [
        ['[data-sound]', () => document.querySelector('[data-sound]').getAttribute('aria-pressed') === 'true' && document.documentElement.classList.contains('sound-on'),
          () => document.querySelector('[data-sound]').getAttribute('aria-pressed') === 'false' && !document.documentElement.classList.contains('sound-on')],
        // the copy button's own word changes for 1.6 s ("Copied"), which changes its width by design; its place is
        // compared once the word is "Copy" again
        ['[data-copy]', () => /^(Copied|Select and copy)$/.test(document.querySelector('[data-copy]').textContent), null, () => document.querySelector('[data-copy]').textContent === 'Copy'],
      ]) {
        await page.locator(sel).first().focus();
        const at = await page.evaluate(rects, sel), shift = await page.evaluate(() => window.__shift);
        await page.keyboard.press('Enter');
        await page.waitForFunction(check, null, { timeout: 10000 });
        if (sel === '[data-copy]') out.copied = await page.evaluate(() => document.querySelector('[data-copy]').textContent);
        assert.equal(await page.evaluate(() => window.__shift), shift, `the page shifted when the code for ${sel} arrived`);
        if (rest) await page.waitForFunction(rest, null, { timeout: 10000 });
        assert.deepEqual((await page.evaluate(rects, sel)).map((r) => r.slice(0, 2)), at.map((r) => r.slice(0, 2)), `${sel} moved when its code arrived`);
        assert.ok(await page.evaluate((s) => document.activeElement === document.querySelector(s), sel), `${sel} lost focus when its code arrived`);
        if (undo) { await page.keyboard.press('Enter'); await page.waitForFunction(undo, null, { timeout: 10000 }); }
      }
      assert.equal(files().filter((f) => /\/ui\/shell\/sound\.js$/.test(f)).length, 1); assert.equal(files().filter((f) => /\/ui\/shell\/copy\.js$/.test(f)).length, 1);
      if (out.copied === 'Copied') assert.equal(await page.evaluate(() => navigator.clipboard.readText()), 'python -m http.server');
      // 5: parts this page holds were fetched for it and work
      for (const part of ['plates.js', 'media.js', 'slots.js', 'lettering.js']) assert.ok(files().some((f) => f.endsWith('/ui/shell/' + part)), `${part} was not fetched on a page that holds its markup`);
      await page.waitForFunction(() => document.querySelector('canvas.ht') && document.querySelector('.ht-on'), null, { timeout: 15000 });
      await page.waitForFunction(() => document.querySelector('#t.slot-on, #t.lettered-on, #t.lt-on, #t[data-letter]'), null, { timeout: 15000 });
      await page.locator('[data-receipt]').first().focus();
      const tip = await page.evaluate(() => { const a = document.querySelector('[data-receipt]'), t = document.getElementById(a.getAttribute('aria-describedby').split(' ').pop()); return { role: t.getAttribute('role'), shown: !t.hidden && t.getBoundingClientRect().width > 0, text: t.textContent }; });
      assert.ok(tip.role === 'tooltip' && tip.shown && /receipt/.test(tip.text), 'a receipt does not answer keyboard focus');
      await page.keyboard.press('Escape');
      assert.ok(await page.evaluate(() => document.querySelector('.receipt-tip').hidden), 'Escape does not put the receipt away');
      assert.deepEqual(errors, []);
      out.template = { parts: files().filter((f) => PARTS.test(f)).map((f) => f.split('/ui/shell/')[1]) };
      await ctx.close();
    }
    // 5b: the made components, on their own page: a switch flips from the keyboard
    {
      const { ctx, page, errors, files } = await open(browser, '/world/ui/shell/organic/specimen.html');
      await page.waitForFunction(() => document.querySelector('[data-o="panel"][data-edge-kind]'), null, { timeout: 15000 });
      assert.ok(files().some((f) => f.endsWith('/organic/made.js')), 'made.js was not fetched on a page that holds its components');
      await page.locator('[data-o="switch"]').first().focus();
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => document.querySelector('[data-o="switch"]').getAttribute('aria-checked')), 'true', 'the switch does not flip from the keyboard');
      await page.keyboard.press('Space');
      assert.equal(await page.evaluate(() => document.querySelector('[data-o="switch"]').getAttribute('aria-checked')), 'false');
      assert.ok(await page.evaluate(() => !!document.querySelector('[data-o="rule"] svg')), 'the rule is not drawn');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    console.log(JSON.stringify(out, null, 1));
    console.log('shell-parts: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
