// The Playground surface in a browser: keyboard use, a deep link, reduced motion and the no-script reading.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-playground.cjs
//
// What it holds:
//   1. Before a press the page fetches no module: not the registry, the bus, the element table or the bench styles.
//   2. Keyboard alone: Tab reaches Start, Enter starts the modules, focus lands in the group, Tab reaches a share,
//      and an arrow key changes it. The blend table then hands its blend and its palette on through the bus: the
//      lettering, the motion curve and the pen study each change, and the line under the label says who heard what.
//   3. A refused envelope reaches nobody on the live page.
//   4. A deep link opens the same blend, shares and pen study, and the address follows the state.
//   5. Reduced motion: the modules settle to a still; two reads of every canvas half a second apart are the same.
//   6. Scripts off: the still, the label and the places are there, and no empty control is shown.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const READY = 'html[data-surface-page-ready]';
const LAZY = /registry\.mjs|bus\.mjs|surface-page\.mjs|elements\.json|bench\.css|surface-blend|surface-lanes/;
const out = {};

async function open(browser, path, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage(), errors = [], asked = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => asked.push(new URL(r.url()).pathname));
  await page.goto(base + path, { waitUntil: 'load' });
  return { ctx, page, errors, asked };
}
// what the three listening modules show, read from the page
const reading = () => ({
  word: document.querySelector('#sx-hosts .lt-word')?.textContent ?? null,
  curve: document.querySelector('#sx-hosts .mo polyline')?.getAttribute('points') ?? null,
  inks: document.querySelector('#sx-hosts canvas.pl')?.dataset.inks ?? null,
  study: document.querySelector('#sx-hosts .pl-pick select')?.value ?? null,
  shares: [...document.querySelectorAll('#sx-hosts input[data-w]')].map((i) => +i.value),
  parts: [...document.querySelectorAll('#sx-hosts .bl-part')].map((e) => e.textContent.replace(/^\d+/, '').trim()),
  say: document.getElementById('sx-say').textContent,
  id: document.getElementById('sx-rec').dataset.id ?? null,
  sent: +document.getElementById('sx-hosts').dataset.sent,
});

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  try {
    // 1 and 2: nothing loads before the press; then the keyboard alone
    {
      const { ctx, page, errors, asked } = await open(browser, '/playground/');
      await page.waitForSelector('#sx-start:not([hidden])');
      await page.waitForTimeout(2500);   // past the idle load of the hand's scroll script
      assert.deepEqual(asked.filter((p) => LAZY.test(p)), [], 'a module, the table or the bench styles loaded before any press');
      assert.equal(await page.locator('#sx-hosts').isVisible(), false);
      let tabs = 0;
      while (tabs < 40 && !(await page.evaluate(() => document.activeElement?.id === 'sx-start'))) { await page.keyboard.press('Tab'); tabs++; }
      assert.ok(tabs < 40, 'Tab reaches Start');
      await page.keyboard.press('Enter');
      await page.waitForSelector(READY, { state: 'attached', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#sx-hosts canvas.pl')?.dataset.inks);
      assert.equal(await page.evaluate(() => document.activeElement?.id), 'sx-hosts', 'focus lands in the group that just appeared');
      assert.equal(await page.locator('#sx-before').isVisible(), false, 'the still steps aside for the live modules');
      const first = await page.evaluate(reading);
      assert.deepEqual(first.parts, ['ink', 'glass', 'type']); assert.equal(first.word, 'ink + glass + type');
      assert.match(first.say, /The blend table handed its blend to Lettering and Motion curve and a palette to Pen study\./);
      // the id is internal detail: the line says who heard what, and the id waits behind its own control
      assert.doesNotMatch(first.say, /session\./, 'the hand-over line shows a raw id');
      assert.match(first.id, /^session\.[0-9a-f]{16}$/);
      assert.equal(await page.evaluate(() => document.getElementById('sx-rec').open), false, 'the record is closed until asked for');
      assert.equal(await page.evaluate(() => document.querySelector('#sx-rec dl').checkVisibility()), false, 'the id shows before the record is opened');
      // the listeners got their first reading from the bus alone: each was mounted with no elements
      const log = await page.evaluate(() => window.__surface.bus.log());
      assert.deepEqual(log.filter((l) => l.ok).map((l) => [l.medium, l.from, l.heard.sort()]), [['blend', 'blend', ['lettering', 'motion']], ['palette', 'blend', ['plot']]]);
      // Tab to the first share and move it with the arrow keys
      tabs = 0;
      while (tabs < 20 && !(await page.evaluate(() => document.activeElement?.matches?.('#sx-hosts input[data-w]')))) { await page.keyboard.press('Tab'); tabs++; }
      assert.ok(tabs < 20, 'Tab reaches a share');
      for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowRight');
      await page.keyboard.press('Tab');   // leaving the control commits the change
      await page.waitForFunction((n) => +document.getElementById('sx-hosts').dataset.sent > n, first.sent);
      await page.waitForFunction((inks) => document.querySelector('#sx-hosts canvas.pl')?.dataset.inks !== inks, first.inks);
      const second = await page.evaluate(reading);
      assert.notEqual(second.curve, first.curve, 'the motion curve followed the new shares');
      assert.notEqual(second.inks, first.inks, 'the pen study took the new palette');
      assert.match(second.id, /^session\.[0-9a-f]{16}$/); assert.notEqual(second.id, first.id, 'a new value has a new id');
      // the record opens from the keyboard and shows the id and the shares
      await page.locator('#sx-rec summary').focus(); await page.keyboard.press('Enter');
      const rec = await page.evaluate(() => ({ open: document.getElementById('sx-rec').open, text: document.querySelector('#sx-rec dl').innerText }));
      assert.ok(rec.open && rec.text.includes(second.id) && /ink \d+%, glass \d+%, type \d+%/.test(rec.text), 'the record does not show the id and the shares');
      // every numbered mark reads at AA: the digit against the mark's own colour, measured from the page
      const marks = await page.evaluate(() => { const lum = (c) => { const [r, g, b] = c.match(/[\d.]+/g).slice(0, 3).map((v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
        return [...document.querySelectorAll('#sx-hosts :is(.bl-n, .bl-dot)')].map((e) => { const cs = getComputedStyle(e), a = lum(cs.color), b = lum(cs.backgroundColor), r = e.getBoundingClientRect(); return { ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05), px: parseFloat(cs.fontSize), w: r.width, track: e.classList.contains('bl-dot') }; }); });
      assert.ok(marks.length >= 20, 'the numbered marks were found');
      assert.deepEqual(marks.filter((m) => m.ratio < 4.5).map((m) => +m.ratio.toFixed(2)), [], 'a numbered mark is under 4.5 to 1');
      assert.ok(marks.filter((m) => m.track).every((m) => m.w >= 24 && m.px >= 14), 'a mark on a mix line is smaller than 24 px or its digit than 14 px');
      out.marks = { n: marks.length, lowest: +Math.min(...marks.map((m) => m.ratio)).toFixed(2) };
      // the Mix column's explanation sits above the table, not inside its header cell
      const head = await page.evaluate(() => ({ th: document.querySelector('#sx-hosts .bl-mixh').textContent.trim(), note: document.querySelector('#sx-hosts .bl-how').getBoundingClientRect().width }));
      assert.ok(head.th.length < 20 && head.note > 400, 'the Mix explanation is cramped into the header cell again');
      assert.match(page.url(), /[?&]e=ink,glass,type/); assert.match(page.url(), /[?&]w=\d+,\d+,\d+/); assert.match(page.url(), /[?&]start(&|$|#)/);
      // the pen study's first pen is the mix the blend table shows
      const mix = await page.evaluate(() => document.querySelector('#sx-hosts .bl-mixc').dataset.hex);
      const rgb = [1, 3, 5].map((i) => parseInt(mix.slice(i, i + 2), 16)).join(',');
      assert.equal(second.inks.split('|')[0], rgb, 'the first pen is the blended colour that was handed over');
      // 3: a refused envelope reaches nobody
      const refused = await page.evaluate(() => { const before = document.querySelector('#sx-hosts canvas.pl').dataset.inks;
        const r = window.__surface.bus.deliver({ medium: 'palette', refs: ['ink'], value: { inks: ['#ff0000'] }, from: { module: 'chart', surface: 'playground', form: 'live', at: new Date().toISOString(), recipe: null } });
        return { r, same: document.querySelector('#sx-hosts canvas.pl').dataset.inks === before }; });
      assert.equal(refused.r.ok, false); assert.match(refused.r.why, /does not give palette/); assert.ok(refused.same);
      // every control in the group has a name and can take focus
      const bare = await page.evaluate(() => [...document.querySelectorAll('#sx-hosts :is(button, select, input, a[href]), .sx button')].filter((e) => e.offsetParent && !(e.getAttribute('aria-label') || e.labels?.length || e.textContent.trim())).length);
      assert.equal(bare, 0, 'a control has no name');
      assert.deepEqual(errors, []);
      out.keyboard = { url: page.url(), say: second.say };
      await ctx.close();
    }
    // 4: a deep link opens the same state
    {
      const { ctx, page, errors } = await open(browser, '/playground/?e=paper,ink&w=70,30&study=ridge-scan&start#m-exchange');
      await page.waitForSelector(READY, { state: 'attached', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#sx-hosts canvas.pl')?.dataset.inks);
      const got = await page.evaluate(reading), studies = await page.evaluate(() => [...document.querySelectorAll('#sx-hosts .pl-pick option')].map((o) => o.value));
      assert.deepEqual(got.parts, ['paper', 'ink']); assert.deepEqual(got.shares, [70, 30]); assert.equal(got.word, 'paper + ink');
      assert.ok(studies.includes('ridge-scan')); assert.equal(got.study, 'ridge-scan');
      assert.match(page.url(), /#m-exchange$/, 'the place in the page is kept');
      // an address with ids the table does not have falls back to the page's own blend
      await page.goto(base + '/playground/?e=nothing,nobody&study=no-such-study&start', { waitUntil: 'load' });
      await page.waitForSelector(READY, { state: 'attached', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#sx-hosts canvas.pl')?.dataset.inks);
      const back = await page.evaluate(reading);
      assert.deepEqual(back.parts, ['ink', 'glass', 'type']); assert.equal(back.study, 'flow-comb', 'an unknown study falls back to the first');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 5: reduced motion settles to a still
    {
      const { ctx, page, errors } = await open(browser, '/playground/?start', { reducedMotion: 'reduce' });
      await page.waitForSelector(READY, { state: 'attached', timeout: 60000 });
      await page.waitForFunction(() => document.querySelector('#sx-hosts canvas.pl')?.dataset.inks);
      await page.waitForTimeout(1500);
      const read = () => [...document.querySelectorAll('#sx-hosts canvas')].map((c) => { try { return c.toDataURL().length + ':' + c.toDataURL().slice(-64); } catch { return 'unreadable'; } });
      const a = await page.evaluate(read); await page.waitForTimeout(600); const b = await page.evaluate(read);
      assert.ok(a.length >= 1, 'there is at least one canvas to hold still'); assert.deepEqual(a, b, 'a canvas kept moving under reduced motion');
      const running = await page.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running' && document.getElementById('main').contains(x.effect?.target)).length);
      assert.equal(running, 0, 'an animation is running inside the page under reduced motion');
      assert.deepEqual(errors, []);
      await ctx.close();
    }
    // 6: scripts off
    {
      const { ctx, page } = await open(browser, '/playground/', { javaScriptEnabled: false });
      const seen = await page.evaluate(() => ({ start: !!document.getElementById('sx-start').offsetParent, hosts: !!document.getElementById('sx-hosts').offsetParent, more: !!document.getElementById('sx-more').offsetParent,
        still: !!document.getElementById('sx-before').offsetParent, label: document.querySelector('.sx .demo-form')?.textContent, text: document.getElementById('main').innerText, links: document.querySelectorAll('#main a[href]').length }));
      assert.deepEqual([seen.start, seen.hosts, seen.more], [false, false, false], 'a control that needs scripts shows with scripts off');
      assert.ok(seen.still && /^Live\./.test(seen.label) && seen.links >= 12);
      for (const words of ['ink + glass + type', 'The mix', 'Motion curve', 'Shown as built', 'Distill']) assert.ok(seen.text.includes(words), `scripts off: the page does not say ${words}`);
      await ctx.close();
    }
    console.log(JSON.stringify(out, null, 1));
    console.log('surface-playground: ok');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });
