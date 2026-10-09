// Every Studio source has the shell's action bar (9 October 2026). The audit found it on 9 of 26
// sources; the rest had no Undo, no Ctrl+Z and no single Export menu. This opens all 27 by link at
// desktop and phone widths and checks: the bar is there with its main action on screen; every
// control the bar runs exists; and the rail still shows its own copy of each one (the author's
// rule: never remove a control, so the bar repeats controls and hides none).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8815';
const VIEWS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 }, mobile: false },
  { name: 'phone', viewport: { width: 390, height: 844 }, mobile: true },
];
const SOURCES = ['atelier', 'fractal', 'fractal3d', 'ndim', 'spatial', 'poster', 'neural', 'sound', 'plotmaps', 'voxels', 'sketch',
  'threads', 'worlds', 'films', 'byo', 'watch', 'music', 'discovery', 'showcase', 'retro', 'gallery', 'loom', 'type', 'splats', 'brender', 'revival', 'raw'];
const SLOW = new Set(['spatial', 'raw', 'worlds', 'threads', 'retro', 'poster']);

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  let failures = 0;
  try {
    for (const view of VIEWS) {
      const ctx = await browser.newContext({ viewport: view.viewport, isMobile: view.mobile, hasTouch: view.mobile, deviceScaleFactor: 1 });
      for (const src of SOURCES) {
        const page = await ctx.newPage();
        const errors = [];
        page.on('pageerror', (e) => errors.push(String(e.message)));
        try {
          await page.goto(`${base}/studio.html?source=${src}`, { waitUntil: 'load' });
          await page.waitForTimeout(SLOW.has(src) ? 5000 : 2500);
          const r = await page.evaluate(() => {
            const bar = document.getElementById('inspector-actions');
            if (!bar || bar.hidden) return { bar: false };
            const prim = bar.querySelector('[data-action="primary"]');
            const rect = prim && prim.getBoundingClientRect();
            const targets = [prim && prim.dataset.target, ...[...bar.querySelectorAll('[data-export]')].map((b) => b.dataset.export)].filter(Boolean);
            const shown = (el) => { const s = getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden'; };
            const chain = (el) => { for (let n = el; n && n !== document.body; n = n.parentElement) { if (n.tagName !== 'DETAILS' && (n.hidden || getComputedStyle(n).display === 'none')) return false; } return true; };
            const missing = targets.filter((t) => !document.getElementById(t));
            const rail = document.getElementById('studio-rail');
            const hiddenInRail = targets.filter((t) => { const n = document.getElementById(t); return n && n.type !== 'file' && rail.contains(n) && !(shown(n) && chain(n)); });
            return { bar: true, primary: prim ? prim.textContent.trim() : null, onScreen: !!rect && rect.top >= 0 && rect.bottom <= innerHeight && rect.width > 0,
              exports: bar.querySelectorAll('[data-export]').length, missing, hiddenInRail };
          });
          assert.ok(r.bar, `${src}: no action bar`);
          assert.ok(r.primary, `${src}: no main action in the bar`);
          assert.ok(r.onScreen, `${src}: main action "${r.primary}" is not on screen`);
          assert.ok(r.exports > 0, `${src}: the Export menu is empty`);
          assert.deepEqual(r.missing, [], `${src}: the bar runs controls that do not exist`);
          assert.deepEqual(r.hiddenInRail, [], `${src}: the bar hides the rail's own copy`);
          assert.deepEqual(errors, [], `${src}: page errors`);
          console.log(`ok [${view.name}] ${src}: ${r.primary}, ${r.exports} exports`);
        } catch (e) {
          failures++;
          console.error(`FAIL [${view.name}] ${src}: ${e.message}`);
        } finally {
          await page.close();
        }
      }
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
  if (failures) { console.error(`${failures} failure(s)`); process.exit(1); }
  console.log('studio-bar: the action bar on every source');
})().catch((e) => { console.error(e); process.exit(1); });
