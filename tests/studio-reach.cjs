// Every entry of the Studio's menus can be reached and pressed (16 November 2026). The author: "The
// studio's where the drop-down menus are not working". A check at 583 px found 5 of the source
// picker's 28 entries under the action bar pinned to the bottom of a narrow screen (a press hit the
// bar), and the last entry of the site menu under the same bar. This opens the source picker, the
// site menu and the Export menu at 375, 583, 1280 and 2560 px wide and, for every entry, scrolls it
// to the top and to the bottom of what its scroller shows, reads which element a press at its centre
// lands on, and fails when that is not the entry. Then it presses every source entry with the mouse
// at that centre and checks the source and its panel come on stage. Every scroll is instant: the
// page scrolls smoothly, and a read taken while a smooth scroll runs sees the old place. A planted bar over the bottom of
// the window must make the same probe fail, so a probe that cannot see a cover cannot pass.
const assert = require('node:assert/strict');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox
const { ready, until } = require('./lib/studio-wait.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: '375', viewport: { width: 375, height: 812 }, mobile: true },
  { name: '583', viewport: { width: 583, height: 900 }, mobile: false },
  { name: '1280', viewport: { width: 1280, height: 800 }, mobile: false },
  { name: '2560', viewport: { width: 2560, height: 1440 }, mobile: false },
];
// Every source is pressed at every width it is cheap to: all of them at the two narrow widths,
// where the bar is pinned to the bottom, and at 1280; at 2560 the hit probe covers every entry.
const PRESS_ALL = new Set(['375', '583', '1280']);

// In the page: for each element, scroll it to the start and to the end of its scroller and report
// any alignment where it is off screen or a press at its centre lands on something else.
function probe(selector) {
  const describe = (n) => {
    if (!n) return 'nothing';
    const id = n.id ? '#' + n.id : '';
    const cls = typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/).join('.') : '';
    const txt = (n.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 24);
    return `${n.tagName.toLowerCase()}${id}${cls}${txt ? ' "' + txt + '"' : ''}`;
  };
  const out = [];
  // Only what is rendered: the site menu leaves its primary group to the bar on a wide screen.
  const els = [...document.querySelectorAll(selector)].filter((e) => e.getClientRects().length > 0);
  for (const el of els) {
    const name = (el.dataset && el.dataset.source) || (el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    for (const block of ['start', 'end']) {
      el.scrollIntoView({ block, inline: 'nearest', behavior: 'instant' });
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) { out.push({ name, block, why: 'not shown' }); continue; }
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) { out.push({ name, block, why: `off screen at ${Math.round(x)},${Math.round(y)}` }); continue; }
      const hit = document.elementFromPoint(x, y);
      if (!(hit && (hit === el || el.contains(hit)))) out.push({ name, block, why: 'under ' + describe(hit) });
    }
  }
  return { count: els.length, bad: out };
}

async function openPicker(page) {
  const open = await page.evaluate(() => document.getElementById('studio-rail').dataset.sources === 'open');
  if (open) return;
  const sw = page.locator('#source-switch'); await sw.scrollIntoViewIfNeeded(); await sw.click();
  await until(page, () => document.getElementById('studio-rail').dataset.sources === 'open', null, 10000);
}
async function openNavMenu(page) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const s = page.locator('#site-nav .sn-more > summary'); await s.click();
  await until(page, () => !!document.querySelector('#site-nav .sn-more[open]'), null, 10000);
}
// A strip fixed over the window across the place a middle picker entry takes when scrolled to the
// top of its scroller, the way the pinned bar sat over the entries at the bottom.
const plant = (page) => page.evaluate(() => {
  const el = document.querySelectorAll('#studio-source button[data-source]')[13];
  el.scrollIntoView({ block: 'start', inline: 'nearest', behavior: 'instant' });
  const r = el.getBoundingClientRect();
  const d = document.createElement('div'); d.id = 'planted-cover';
  d.style.cssText = `position:fixed;left:0;right:0;top:${Math.max(0, r.top - 4)}px;height:${r.height + 8}px;z-index:2147483647;background:rgba(255,0,0,.2)`;
  document.body.appendChild(d);
});
const unplant = (page) => page.evaluate(() => { const d = document.getElementById('planted-cover'); if (d) d.remove(); });

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  const fail = (msg) => { failures++; console.error('FAIL ' + msg); };
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message || e)));
      await page.goto(`${base}/studio.html`);
      await ready(page, 'atelier');
      const barShown = await page.evaluate(() => { const b = document.getElementById('inspector-actions'); return !!b && !b.hidden && getComputedStyle(b).display !== 'none'; });
      console.log(`${tag} action bar shown: ${barShown}`);

      // 1. The source picker. The entry on stage is in view as soon as the picker opens.
      await openPicker(page);
      const first = await page.evaluate(() => {
        const el = document.querySelector('#studio-source [aria-selected="true"]'); const r = el.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { inView: r.top >= 0 && r.bottom <= innerHeight, pressable: !!hit && (hit === el || el.contains(hit)) };
      });
      if (!first.inView || !first.pressable) fail(`${tag} the source on stage is ${first.inView ? 'covered' : 'out of view'} when the picker opens`);
      const picker = await page.evaluate(probe, '#studio-source button[data-source]');
      assert.equal(picker.count, 34, `${tag} the picker lists 34 sources`);
      for (const b of picker.bad) fail(`${tag} picker entry ${b.name} (${b.block}): ${b.why}`);
      console.log(`${tag} picker: ${picker.count - new Set(picker.bad.map((b) => b.name)).size} of ${picker.count} entries reachable at both ends of the scroll`);

      // The probe sees a cover: a bar planted over the bottom of the window must fail it.
      await plant(page);
      const planted = await page.evaluate(probe, '#studio-source button[data-source]');
      await unplant(page);
      assert.ok(planted.bad.length > 0, `${tag} the planted cover is caught by the picker probe`);

      // Every block a picker entry names is a panel on the page, so no panel is out of reach.
      const panels = await page.evaluate(() => {
        const named = new Set([...document.querySelectorAll('#studio-source button[data-source]')].map((b) => b.getAttribute('aria-controls')));
        return [...document.querySelectorAll('.src-block')].map((s) => s.id).filter((id) => !named.has(id));
      });
      assert.deepEqual(panels, [], `${tag} every source panel has a picker entry`);

      // 2. Press every entry with the mouse at its centre, scrolled to the worst place (the bottom).
      if (PRESS_ALL.has(view.name)) {
        const entries = await page.$$eval('#studio-source button[data-source]', (bs) => bs.map((b) => ({ source: b.dataset.source, block: b.getAttribute('aria-controls') })));
        let pressed = 0;
        for (const { source, block } of entries) {
          await openPicker(page);
          const at = await page.evaluate((s) => {
            const el = document.querySelector(`#studio-source button[data-source="${s}"]`);
            el.scrollIntoView({ block: 'end', inline: 'nearest', behavior: 'instant' });
            const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
          }, source);
          await page.mouse.click(at.x, at.y);
          try {
            await until(page, ([s, b]) => window.__studioActiveSource === s && !document.getElementById(b).hidden, [source, block], 20000);
            pressed++;
          } catch (e) { fail(`${tag} pressing ${source} did not bring it on stage: ${e.message.slice(0, 160)}`); }
        }
        console.log(`${tag} pressed ${pressed} of ${entries.length} sources onto the stage`);
        await page.goto(`${base}/studio.html`); await ready(page, 'atelier');
      }

      // 3. The site menu.
      await openNavMenu(page);
      const menu = await page.evaluate(probe, '#site-nav .sn-more-list a');
      for (const b of menu.bad) fail(`${tag} menu entry ${b.name} (${b.block}): ${b.why}`);
      console.log(`${tag} menu: ${menu.count - new Set(menu.bad.map((b) => b.name)).size} of ${menu.count} entries reachable`);
      await page.keyboard.press('Escape');
      await page.evaluate(() => { const d = document.querySelector('#site-nav .sn-more'); if (d) d.open = false; });

      // 4. The Export menu in the action bar.
      if (barShown) {
        const sum = page.locator('#inspector-actions .ia-export > summary'); await sum.scrollIntoViewIfNeeded(); await sum.click();
        const ex = await page.evaluate(probe, '#inspector-actions .ia-export[open] .ia-export-list .btn');
        if (!ex.count) fail(`${tag} the Export menu opened with no entries`);
        for (const b of ex.bad) fail(`${tag} export entry ${b.name} (${b.block}): ${b.why}`);
        console.log(`${tag} export: ${ex.count - new Set(ex.bad.map((b) => b.name)).size} of ${ex.count} entries reachable`);
      }
      if (errors.length) fail(`${tag} page errors: ${errors.slice(0, 3).join(' | ')}`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  if (failures) { console.error(`studio-reach: ${failures} failure(s)`); process.exit(1); }
  console.log('studio-reach: every entry of the source picker, the site menu and the Export menu is reachable and pressable');
})().catch((e) => { console.error(e); process.exit(1); });
