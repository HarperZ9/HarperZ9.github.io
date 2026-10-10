// One Export menu and project files (9 October 2026). The audit found export in three places under
// nine names, and no way to keep the whole Studio. This checks, at desktop and phone widths: every
// source's Export menu holds its own formats, the stage's formats from the deck that apply, and the
// project file; saving a project after work in two sources and opening it in a fresh browser puts
// both back (the fractal to the same pixels, the Gallery to the same seed); a file that is not a
// project is refused with a reason; Search and Keys sit under the source switch on a phone.
const assert = require('node:assert/strict');
const fs = require('fs'); const os = require('os'); const path = require('path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const wait = (page, ms) => page.waitForTimeout(ms);
const W = require('./lib/studio-wait.cjs');
async function frame(page) {
  return page.evaluate(async () => {
    const c = document.getElementById('studio-canvas');
    const t = document.createElement('canvas'); t.width = c.width; t.height = c.height; t.getContext('2d').drawImage(c, 0, 0);
    const d = t.getContext('2d').getImageData(0, 0, t.width, t.height).data;
    const h = await crypto.subtle.digest('SHA-256', d);
    return [...new Uint8Array(h)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
  });
}
const pick = (page, s) => page.evaluate((s) => document.querySelector(`#studio-source button[data-source="${s}"]`).click(), s);
const openExport = (page) => page.evaluate(() => { document.querySelector('#inspector-actions .ia-export').open = true; });

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-project-'));
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const tag = `[${view.name}]`;
      const opts = { viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1, acceptDownloads: true };
      const ctx = await browser.newContext(opts);
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e.message)));
      try {
        await page.goto(`${base}/studio.html?source=fractal`); const mandel = await W.ready(page, 'fractal');
        if (view.mobile) {
          const order = await page.evaluate(() => { const f = document.querySelector('.studio-find').getBoundingClientRect(), s = document.getElementById('source-switch').getBoundingClientRect(); return f.top >= s.bottom - 1; });
          assert.ok(order, `${tag} Search and Keys sit under the source switch`);
        }
        await page.evaluate(() => document.querySelector('[data-ftype="julia"]').click());
        const julia = await W.changed(page, mandel);
        await openExport(page);
        const items = await page.evaluate(() => [...document.querySelectorAll('#inspector-actions .ia-export-list button')].map((b) => b.dataset.export));
        for (const want of ['rt-export-png', 'project-save', 'project-open', 'rt-export-more']) assert.ok(items.includes(want), `${tag} the Export menu holds ${want} (${items.join(', ')})`);
        await page.evaluate(() => { document.querySelector('#inspector-actions .ia-export').open = false; });
        await pick(page, 'gallery');
        const plate = await W.ready(page, 'gallery');
        await page.evaluate(() => document.getElementById('desk-reroll').click());
        await W.changed(page, plate);
        const seed = await page.inputValue('#desk-seed');
        await openExport(page);
        const dl = page.waitForEvent('download');
        await page.evaluate(() => document.querySelector('[data-export="project-save"]').click());
        const file = path.join(tmp, `${view.name}.studio.json`);
        await (await dl).saveAs(file);
        const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
        assert.equal(doc.schema, 'studio.project/1', `${tag} the file names its schema`);
        assert.ok(doc.sessions.fractal && doc.sessions.gallery, `${tag} both sources are in the file`);

        const ctx2 = await browser.newContext(opts);
        const p2 = await ctx2.newPage();
        p2.on('pageerror', (e) => errors.push(String(e.message)));
        await p2.goto(`${base}/studio.html?source=sketch`); await W.ready(p2, 'sketch');
        await openExport(p2);
        const fc = p2.waitForEvent('filechooser');
        await p2.evaluate(() => document.querySelector('[data-export="project-open"]').click());
        await (await fc).setFiles(file);
        await p2.waitForURL(/source=gallery/, { timeout: 15000 });
        await W.ready(p2, 'gallery');
        await W.until(p2, (s) => document.getElementById('desk-seed').value === s, seed);
        assert.equal(await p2.inputValue('#desk-seed'), seed, `${tag} the Gallery opens on the saved seed`);
        await pick(p2, 'fractal'); await W.ready(p2, 'fractal');
        assert.equal(await W.becomes(p2, julia), julia, `${tag} the fractal comes back to the same pixels`);

        const bad = path.join(tmp, 'not-a-project.json');
        fs.writeFileSync(bad, JSON.stringify({ hello: 1 }));
        await openExport(p2);
        const fc2 = p2.waitForEvent('filechooser');
        await p2.evaluate(() => document.querySelector('[data-export="project-open"]').click());
        await (await fc2).setFiles(bad);
        await W.until(p2, () => /Not opened/.test(document.getElementById('inspector-keep-said').textContent));
        assert.match(await p2.textContent('#inspector-keep-said'), /Not opened: not a Studio project file/, `${tag} a file that is not a project is refused with its reason`);
        await ctx2.close();
        assert.deepEqual(errors, [], `${tag} no page errors`);
        console.log(`${tag} studio export and project files: pass`);
      } catch (e) {
        failures++;
        console.error(`FAIL ${tag}`, e.message);
      } finally {
        await ctx.close();
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
