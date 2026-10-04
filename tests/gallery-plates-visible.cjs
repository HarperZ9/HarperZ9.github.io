// Every plate on an instrument surface is on screen, and Plate 14 (the seeded typeface) draws.
//
// Until 3 October 2026 a reading-page rule in system/system.css hid every
// `.plate:has(canvas[data-specimen])` on pages with body.inner-clean, and reading.css brought
// plates back only on pages without .instrument-surface. The Gallery is an instrument surface,
// so all 43 of its plates, Plate 14 included, loaded with display:none. This test loads the
// Gallery at desktop and phone widths, in both themes, and fails when any plate is not
// displayed, has no height, or when Plate 14's canvas holds no drawn pixels.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8805';
const VIEWS = [
  { width: 1440, height: 900, colorScheme: 'dark' },
  { width: 375, height: 812, colorScheme: 'light' },
];

function probe() {
  const plates = [...document.querySelectorAll('figure.plate')].map((f) => ({
    plate: f.dataset.plate || '?',
    display: getComputedStyle(f).display,
    height: Math.round(f.getBoundingClientRect().height),
  }));
  const canvas = document.querySelector('[data-plate="typeface"] canvas[data-specimen]');
  let inked = 0;
  if (canvas && canvas.width && canvas.height) {
    const data = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
    const r0 = data[0], g0 = data[1], b0 = data[2];
    for (let i = 0; i < data.length; i += 4) if (data[i] !== r0 || data[i + 1] !== g0 || data[i + 2] !== b0) inked++;
  }
  return { plates, typeface: canvas ? { width: canvas.width, height: canvas.height, inked } : null,
    scrollWidth: document.documentElement.scrollWidth };
}

(async () => {
  const launch = process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {};
  const browser = await chromium.launch(launch);
  try {
    for (const view of VIEWS) {
      const page = await browser.newPage({ viewport: { width: view.width, height: view.height }, colorScheme: view.colorScheme });
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${base}/gallery.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.querySelector('[data-plate="typeface"]').scrollIntoView());
      // A hidden plate never gets a height, so this wait ends on its timeout and the asserts below report why.
      await page.waitForFunction(() => {
        const c = document.querySelector('[data-plate="typeface"] canvas[data-specimen]');
        return c && c.getBoundingClientRect().height > 0;
      }, null, { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(500);
      const got = await page.evaluate(probe);
      const label = `${view.width}px ${view.colorScheme}`;
      assert.ok(got.plates.length >= 43, `${label}: expected the Gallery's 43 plates, found ${got.plates.length}`);
      const hidden = got.plates.filter((p) => p.display === 'none' || p.height === 0);
      assert.deepEqual(hidden, [], `${label}: plates not on screen`);
      assert.ok(got.typeface, `${label}: Plate 14 has no specimen canvas`);
      assert.ok(got.typeface.inked > 1000, `${label}: Plate 14 drew ${got.typeface.inked} non-ground pixels`);
      assert.ok(got.scrollWidth <= view.width, `${label}: page scrolls sideways (${got.scrollWidth}px)`);
      assert.deepEqual(errors, [], `${label}: page errors`);
      console.log(`ok ${label}: ${got.plates.length} plates displayed; Plate 14 ${got.typeface.width}x${got.typeface.height}, ${got.typeface.inked} inked pixels`);
      await page.close();
    }
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error(e); process.exit(1); });
