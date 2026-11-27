// Every select and every menu on the site does something (item 4 of the 2026-11-16 quality pass; the author: "some
// of the drop-down menus don't work"). The Studio has its own, deeper check (tests/studio-selects.cjs); this one
// covers every other page that has a select, the Playground's rooms opened on their press, and the menu buttons
// (aria-expanded) and the shell's Places menu on each of those pages.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/every-select.cjs
//
// A select acts when, after another option is chosen (up to three are tried), the page shows it: the picture, with
// the select itself masked, changes (when it held still before), or the words the page says about itself change
// (live regions, status lines, outputs, the address, the title, when they held still), or a sound starts. DOM writes
// are not counted: the planted select drew them on every page. A planted select with no handler goes into each page
// beside the first real one, and must be reported as doing nothing, so the check can fail; a page where even the
// planted select looks alive is reported as one this test cannot judge, by name, and does not pass silently.
// A menu acts when its press opens something: aria-expanded turns true, or a dialog opens.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';

// Every page with a select in its HTML (the list is checked against the files below, so a new one is not missed),
// and the pages that build their selects in script, with the press that shows them.
const PAGES = [
  { path: '/bulletin.html' }, { path: '/fonts.html' }, { path: '/loom.html' }, { path: '/tools.html' },
  { path: '/repo-explainers/raw-native.html', pre: ['#live-go'] }, { path: '/type-forge.html' }, { path: '/who-knew-first.html' },
  { path: '/world/sound/sound.html' }, { path: '/world/visualizer/web/grid.html' }, { path: '/world/visualizer/web/index.html' },
  { path: '/system/discovery/lab.html' }, { path: '/system/kit/specimen.html' },
  { path: '/playground/', rooms: ['estuary', 'forge', 'shader', 'sound', 'field'], then: { 'shd-mod-tgt': '#shd-mod-add' } },
  { path: '/playground/benchmarks/' }, { path: '/playground/benchmarks-v4/' }, { path: '/playground/buildos-pq/' }, { path: '/playground/buildos-v2/' }, { path: '/playground/buildos-cluster/' }, { path: '/playground/competitive-surpass/' }, { path: '/playground/datasets/' }, { path: '/playground/gpu-560-fma/' }, { path: '/playground/gpu-compute/' }, { path: '/playground/gpu-shaders/' }, { path: '/playground/mir-assurance/' }, { path: '/playground/native-auditors/' }, { path: '/playground/renderer-35/' }, { path: '/playground/sbom/' }, { path: '/playground/threshold-storage/' },
];
// Not driven here, with the reason: the Studio has tests/studio-selects.cjs; the live renderer and the packaged
// viewer need WebGPU (tests/raw-live.cjs drives the renderer where a GPU answers); a source template is not a page.
const ELSEWHERE = ['/studio.html', '/media/raw-native/live/index.html', '/media/raw-native/viewer-0.8.0/web/viewer/index.html', '/tools/repo_explainers/pages/raw-native.src.html'];
const SETTLE = 4000, REST = 900;

const words = (page) => page.evaluate(() => {
  const parts = [location.href, document.title];
  document.querySelectorAll('[aria-live],[role="status"],output,.status,[id$="-status"],[id$="-readout"],[id$="-label"],[data-readout]').forEach((n) => parts.push((n.textContent || n.value || '').trim()));
  return parts.join('␞');
});
// the picture with the select itself masked out: its own shown value changing is not the page acting
const picture = async (page, id) => crypto.createHash('sha256').update(await page.screenshot({ animations: 'disabled', mask: id ? [page.locator('#' + id)] : [] })).digest('hex');
// then: a button the select names the next press of (the shader room's Moves names what Route it routes)
async function acts(page, id, then) {
  await page.focus('#' + id); await page.waitForTimeout(300);   // focus first: its ring is not the select acting
  // let the last change finish (a render still writing its status) before the page's words are read at rest
  for (let last = await words(page), calm = 0, end = Date.now() + 12000; calm < 1500 && Date.now() < end; ) {
    await page.waitForTimeout(300); const now = await words(page); calm = now === last ? calm + 300 : 0; last = now;
  }
  page.__esChooser = false;
  // wait (up to 10 s) for two equal pictures REST apart before judging: on a slow CI runner the first draw is often
  // still landing at this point, and one gap would mark the page as moving and drop its picture check
  const said0 = await words(page);
  let a = await picture(page, id), b = a;
  for (const end = Date.now() + 10000; ; a = b) {
    await page.waitForTimeout(REST); b = await picture(page, id);
    if (a === b || Date.now() > end) break;
  }
  const still = a === b, said = await words(page), quiet = said === said0;
  // one option can show the same as the last (a colour theme from "system" to "light" in a light browser), so up to
  // three other options are tried before the select is called dead
  const others = await page.evaluate((id) => { const s = document.getElementById(id); return [...s.options].map((o) => o.value).filter((v, k) => k !== s.selectedIndex && !s.options[k].disabled).slice(0, 3); }, id);
  for (const next of others) {
    await page.selectOption('#' + id, next);
    if (then) await page.click(then);
    const end = Date.now() + SETTLE;
    while (Date.now() < end) {
      if (still && (await picture(page, id)) !== b) return { how: 'picture', still };
      if (quiet && (await words(page)) !== said) return { how: 'words', still };
      if (await page.evaluate(() => (window.__esSound || 0) > 0)) return { how: 'sound', still };
      if (page.__esChooser) return { how: 'file chooser', still };
      await page.waitForTimeout(200);
    }
  }
  return { how: null, still };
}

// a select that only changes what is heard: every sound the page starts is counted (an AudioNode connected to the
// destination, or an <audio> or <video> that plays), from page load
const EAR = () => {
  window.__esSound = 0;
  const C = window.AudioNode && AudioNode.prototype.connect;
  if (C) AudioNode.prototype.connect = function (d, ...r) { if (d instanceof AudioDestinationNode) window.__esSound++; return C.call(this, d, ...r); };
  const P = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (...r) { window.__esSound++; return P.apply(this, r); };
};

const reachable = (page, scope) => page.evaluate((scope) => {
  const root = scope ? document.querySelector(scope) : document;
  root.querySelectorAll('details').forEach((d) => { if (!d.closest('dialog')) d.open = true; });
  return [...root.querySelectorAll('select')].filter((s) => { const r = s.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !s.disabled && s.options.length > 1 && !s.closest('dialog'); })
    .map((s, i) => { if (!s.id) s.id = `es-select-${Date.now().toString(36)}-${i}`; return { id: s.id, label: s.getAttribute('aria-label') || (s.labels && s.labels[0] ? s.labels[0].textContent.trim().slice(0, 50) : s.name || '') }; });
}, scope);

// a select with nothing listening, beside a real one
const plant = (page, nextTo) => page.evaluate((id) => {
  const s = document.createElement('select'); s.id = 'es-planted';
  s.innerHTML = '<option value="a">a</option><option value="b">b</option>';
  document.getElementById(id).insertAdjacentElement('afterend', s);
  return s.id;
}, nextTo);

const menus = (page) => page.evaluate(() => [...document.querySelectorAll('button[aria-expanded]')].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !b.disabled && !b.closest('dialog[open]'); })
  .map((b, i) => { if (!b.id) b.id = `es-menu-${i}`; return { id: b.id, label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40) }; }));
async function menuActs(page, id) {
  const before = await page.evaluate((id) => document.getElementById(id).getAttribute('aria-expanded'), id);
  // a press as a person makes it: the button's own click (the shell's hand sits in a transformed header)
  await page.evaluate((id) => document.getElementById(id).click(), id);
  await page.waitForTimeout(600);
  const after = await page.evaluate((id) => ({ ex: document.getElementById(id).getAttribute('aria-expanded'), dialog: !!document.querySelector('dialog[open]') }), id);
  // put it back: Escape closes a dialog, a second press closes a disclosure
  if (after.dialog) await page.keyboard.press('Escape'); else if (after.ex !== before) await page.evaluate((id) => document.getElementById(id).click(), id);
  await page.waitForTimeout(200);
  return after.ex !== before || after.dialog;
}

(async () => {
  // the list above holds every page whose HTML has a select
  const fs = require('node:fs'), path = require('node:path'), root = path.join(__dirname, '..');
  const listed = new Set([...PAGES.map((p) => p.path), ...ELSEWHERE]);
  // the tracked pages (git ls-files), so build output and drafts outside the repository are not counted
  const found = require('node:child_process').execFileSync('git', ['ls-files', '*.html'], { cwd: root, encoding: 'utf8' }).split(/\r?\n/)
    .filter((f) => f && !f.startsWith('tests/') && /<select\b/.test(fs.readFileSync(path.join(root, f), 'utf8'))).map((f) => '/' + f);
  const unlisted = found.filter((p) => !listed.has(p) && !listed.has(p.replace(/index\.html$/, '')));
  assert.deepEqual(unlisted, [], 'every page with a select is driven here or named as driven elsewhere');

  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  const dead = [], unjudged = [], rows = [];
  let menusDone = 0;
  const show = (r) => console.log(`${r.how ? 'acts ' : 'DEAD '} ${r.page}  ${r.select}${r.how ? '  (' + r.how + ')' : ''}${r.still === false ? '  [moves at rest]' : ''}`);
  try {
    for (const p of PAGES) {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
      await ctx.addInitScript(EAR);
      const page = await ctx.newPage();
      // an option that asks for a file (a MIDI file of yours) acts by opening the chooser
      page.on('filechooser', () => { page.__esChooser = true; });
      await page.goto(base + p.path, { waitUntil: 'load' });
      await page.waitForTimeout(1500);
      for (const b of p.pre || []) { await page.click(b); await page.waitForTimeout(6000); }   // a first press the selects then follow
      const scopes = [null];
      for (const room of p.rooms || []) {
        const btn = `[data-room="${room}"] [data-room-open]`;
        await page.waitForSelector(btn + ':not([hidden])', { timeout: 20000 });
        await page.click(btn);
        await page.waitForSelector(`[data-room="${room}"][data-room-live]`, { timeout: 30000 }).catch(() => {});
        await page.waitForTimeout(1500);
      }
      const list = await reachable(page, null);
      for (const s of list) {
        await page.locator('#' + s.id).scrollIntoViewIfNeeded().catch(() => {});
        await page.evaluate(() => { window.__esSound = 0; });
        const r = await acts(page, s.id, (p.then || {})[s.id]);
        rows.push({ page: p.path, select: s.label || s.id, ...r }); show(rows[rows.length - 1]);
        if (!r.how) dead.push(`${p.path}: ${s.label || s.id}`);
      }
      if (list.length) {   // the planted control, beside the first select
        const id = await plant(page, list[0].id);
        await page.locator('#' + id).scrollIntoViewIfNeeded().catch(() => {});
        await page.evaluate(() => { window.__esSound = 0; });
        const r = await acts(page, id);
        rows.push({ page: p.path, select: 'planted, no handler', ...r }); show(rows[rows.length - 1]);
        if (r.how) unjudged.push(`${p.path} (the planted select looked alive by ${r.how})`);
      }
      for (const m of await menus(page)) {
        const ok = await menuActs(page, m.id);
        menusDone++;
        rows.push({ page: p.path, select: `menu: ${m.label}`, how: ok ? 'opens' : null }); show(rows[rows.length - 1]);
        if (!ok) dead.push(`${p.path}: menu ${m.label}`);
      }
      await ctx.close();
    }
  } finally { await browser.close(); }
  const real = rows.filter((r) => !r.select.startsWith('planted') && !r.select.startsWith('menu')).length;
  console.log(`every-select: ${real} selects and ${menusDone} menus on ${PAGES.length} pages; ${dead.length} do nothing; planted controls judged dead on ${PAGES.length - unjudged.length} of the pages with selects`);
  if (unjudged.length) console.log(`every-select: cannot judge (the page moves and writes at rest): ${unjudged.join('; ')}`);
  assert.deepEqual(dead, [], 'every select and menu does something');
  assert.ok(rows.some((r) => r.select.startsWith('planted') && !r.how), 'at least one planted select is caught');
})().catch((e) => { console.error(e); process.exit(1); });
