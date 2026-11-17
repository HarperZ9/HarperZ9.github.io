// Every select in every Studio source does something (16 November 2026). The author: "The studio's
// where the drop-down menus are not working, and some of the functionality was lost as well." The
// page changes its DOM about a hundred times a second at rest, so a mutation count cannot tell a
// working select from a dead one. This opens each source that has selects, opens its folded
// sections, and for each select (and each of the Studio's own drawn dropdowns) picks another option
// and reads the stage: a still stage must change, or the source's own readout must say something
// new. A source whose stage moves at rest is judged by its readout alone. A planted select with no
// handler, put in the same place, must be reported as doing nothing, so the check can fail.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const chromium = require('./lib/browser.cjs');   // BROWSER=firefox runs this file in Firefox
const { ready, sleep } = require('./lib/studio-wait.cjs');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
// Each visit: the source, what a visitor presses first to show its selects, and whether the rail's
// shared controls (the Finish layer, outside any source) are driven there. A select that only names
// what the next button does lists that button in then. Bring your own's terrain mode needs a
// dropped file and is not driven here.
const VISITS = [
  { source: 'atelier', shared: true },
  { source: 'worlds' },
  { source: 'threads' },
  { source: 'fractal3d', pre: ['[data-f3type="hybrid"]'] },
  { source: 'spatial' },
  { source: 'retro', then: { 're-mod-src': '#re-mod-add', 're-mod-tgt': '#re-mod-add' } },
  { source: 'loom' },
  { source: 'type' },
  { source: 'raw' },
  { source: 'fractal' },
  { source: 'plotmaps', pre: ['[data-plot-material="plate"]'] },
  { source: 'plotmaps', pre: ['[data-plot-material="archive"]'] },
];
const SETTLE_MS = 8000;
const NO_GPU = /no WebGPU|needs WebGPU|does not offer/i;

// The stage as pixels: a clip of the window at the stage box, so a stage that moves (an orbiting
// 3D fractal) is read as it is instead of waited on until it holds still.
async function stage(page) {
  const box = await page.evaluate(() => { const r = document.getElementById('viewport-stage').getBoundingClientRect(); return { x: Math.max(0, r.left), y: Math.max(0, r.top), width: Math.max(1, Math.min(r.width, innerWidth - Math.max(0, r.left))), height: Math.max(1, Math.min(r.height, innerHeight - Math.max(0, r.top))) }; });
  const png = await page.screenshot({ clip: box, animations: 'disabled' });
  return crypto.createHash('sha256').update(png).digest('hex').slice(0, 16);
}
// What the source says about itself: its live regions, status lines, outputs, route rows, the film
// on stage, the Finish layer's status and the stage label.
const readout = (page) => page.evaluate(() => {
  const block = [...document.querySelectorAll('.src-block')].find((b) => !b.hidden);
  const parts = [];
  const pick = (root) => root && root.querySelectorAll('[aria-live],[role="status"],output,.status,.engine-status,[id$="-status"],[id$="-readout"],[id$="-rows"]').forEach((n) => parts.push(n.textContent.trim()));
  pick(block); pick(document.getElementById('studio-viewport')); pick(document.getElementById('finish-group'));
  document.querySelectorAll('#viewport-stage [data-film]').forEach((n) => parts.push('film:' + n.dataset.film));
  const st = document.getElementById('viewport-stage'); parts.push(st ? st.getAttribute('aria-label') || '' : '');
  return parts.join('␞');
});
async function atRest(page) {
  const a = await stage(page); await sleep(600); const b = await stage(page);
  return { still: a === b, frame: b };
}
// After a change: poll until the stage (when it was still) or the readout differs.
async function effect(page, before, still) {
  const end = Date.now() + SETTLE_MS;
  while (Date.now() < end) {
    if (still && (await stage(page)) !== before.frame) return 'frame';
    if ((await readout(page)) !== before.text) return 'readout';
    await sleep(250);
  }
  return null;
}
// The selects a visitor can reach: shown, enabled, with a second option. In the source on stage,
// or (shared) in the rail outside every source.
const selectsOf = (page, shared) => page.evaluate((shared) => {
  const rail = document.getElementById('studio-rail');
  const block = [...document.querySelectorAll('.src-block')].find((b) => !b.hidden);
  const root = shared ? rail : block;
  if (!root) return [];
  root.querySelectorAll('details').forEach((d) => { if (!shared || !d.closest('.src-block')) d.open = true; });
  return [...root.querySelectorAll('select')].filter((s) => {
    if (shared && s.closest('.src-block')) return false;
    const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !s.disabled && s.options.length > 1;
  }).map((s, i) => { if (!s.id) s.id = 'studio-select-' + i; return { id: s.id, label: s.getAttribute('aria-label') || (s.labels && s.labels[0] ? s.labels[0].textContent.trim() : ''), n: s.options.length }; });
}, shared);
const ddsOf = (page) => page.evaluate(() => {
  const block = [...document.querySelectorAll('.src-block')].find((b) => !b.hidden);
  return block ? [...block.querySelectorAll('[data-dropdown]')].filter((h) => h.querySelector('.dd-btn') && h.getBoundingClientRect().width > 0).map((h) => h.dataset.dropdown) : [];
});

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  const rows = []; let failures = 0;
  const fail = (msg) => { failures++; console.error('FAIL ' + msg); };
  // A change that showed nothing: a failure, unless the source says this browser has no WebGPU, in
  // which case the row says so and is counted apart (the Worlds and Threads tests drive those where
  // WebGPU answers).
  const judge = async (page, source, control, label, n, still, how) => {
    let effect = how;
    if (!how) effect = NO_GPU.test(await readout(page)) ? 'not driven: no WebGPU here' : 'none';
    rows.push({ source, control, label, options: n, still, effect });
    if (effect === 'none') fail(`${source}: ${control} (${label}) changed and nothing on the stage or in the readout changed`);
  };
  try {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    let planted = false;
    for (const visit of VISITS) {
      const { source } = visit;
      await page.goto(`${base}/studio.html?source=${source}`);
      try { await ready(page, source, 45000); } catch (e) { fail(`${source}: did not come on stage: ${e.message.slice(0, 160)}`); continue; }
      for (const sel of visit.pre || []) { const b = page.locator(`.src-block:not([hidden]) ${sel}`).first(); await b.scrollIntoViewIfNeeded(); await b.click(); await sleep(1500); }
      await sleep(800);
      console.log(`${source}${visit.pre ? ' after ' + visit.pre.join(', ') : ''}: on stage`);
      const selects = await selectsOf(page, !!visit.shared);
      for (const s of selects) {
        await page.locator('#' + s.id).scrollIntoViewIfNeeded();
        const rest = await atRest(page); const text = await readout(page);
        const values = await page.$eval('#' + s.id, (el) => ({ cur: el.value, all: [...el.options].filter((o) => !o.disabled).map((o) => o.value) }));
        const next = values.all.find((v) => v !== values.cur);
        if (next === undefined) continue;
        await page.selectOption('#' + s.id, next);
        const then = visit.then && visit.then[s.id];
        if (then) await page.locator(then).click();
        const how = await effect(page, { frame: rest.frame, text }, rest.still);
        await judge(page, source, '#' + s.id + (then ? ` then ${then}` : ''), s.label, s.n, rest.still, how);
      }
      if (visit.shared) continue;
      for (const id of await ddsOf(page)) {
        const btn = page.locator(`[data-dropdown="${id}"] .dd-btn`);
        await btn.scrollIntoViewIfNeeded();
        const rest = await atRest(page); const text = await readout(page);
        await btn.click();
        const opts = page.locator(`[data-dropdown="${id}"] .dd-list .dd-opt`);
        const n = await opts.count();
        let target = -1;
        for (let i = 0; i < n; i++) { if ((await opts.nth(i).getAttribute('aria-selected')) !== 'true') { target = i; break; } }
        if (target < 0) { fail(`${source}: dropdown ${id} opened with no other option`); continue; }
        // A press at the option's centre must land on the option, not on something drawn over it.
        const hit = await opts.nth(target).evaluate((el) => { el.scrollIntoView({ block: 'nearest', behavior: 'instant' }); const r = el.getBoundingClientRect(); const h = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!h && (h === el || el.contains(h)); });
        if (!hit) fail(`${source}: dropdown ${id} option ${target} is covered`);
        await opts.nth(target).click();
        const how = await effect(page, { frame: rest.frame, text }, rest.still);
        await judge(page, source, `dropdown ${id}`, id, n, rest.still, how);
      }
      // The planted control: a select with no handler in the first still source with selects.
      if (!planted && selects.length) {
        const rest = await atRest(page);
        if (rest.still) {
          await page.evaluate(() => {
            const block = [...document.querySelectorAll('.src-block')].find((b) => !b.hidden);
            const s = document.createElement('select'); s.id = 'planted-dead'; s.innerHTML = '<option>a</option><option>b</option>';
            block.prepend(s);
          });
          const text = await readout(page);
          await page.selectOption('#planted-dead', 'b');
          const how = await effect(page, { frame: rest.frame, text }, true);
          assert.equal(how, null, `the planted dead select in ${source} is reported as doing nothing`);
          console.log(`planted dead select in ${source}: reported as doing nothing`);
          planted = true;
        }
      }
    }
    assert.ok(planted, 'the planted dead select was run in one still source');
    await ctx.close();
  } finally { await browser.close(); }
  console.log('| source | control | label | options | stage still at rest | effect |');
  console.log('|---|---|---|---:|---|---|');
  for (const r of rows) console.log(`| ${r.source} | ${r.control} | ${r.label} | ${r.options} | ${r.still} | ${r.effect} |`);
  const live = rows.filter((r) => r.effect === 'frame' || r.effect === 'readout').length;
  const noGpu = rows.filter((r) => r.effect.startsWith('not driven')).length;
  console.log(`studio-selects: ${live} of ${rows.length} controls changed the stage or the readout; ${noGpu} not driven for want of WebGPU`);
  if (failures) { console.error(`studio-selects: ${failures} failure(s)`); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
