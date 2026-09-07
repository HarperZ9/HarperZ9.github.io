// No-JS rendering, theme contrast, and commerce boundary for fonts.html.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8766';

function rgbParts(value) {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  assert(match, `Expected an rgb color, got ${value}`);
  return match.slice(1, 4).map(Number).map(v => {
    const channel = v / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
}

function luminance(value) {
  const [r, g, b] = rgbParts(value);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground, background) {
  const a = luminance(foreground);
  const b = luminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  try {
    for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
      const context = await browser.newContext({
        viewport: { width, height: 900 },
        colorScheme: theme,
        javaScriptEnabled: false,
      });
      const page = await context.newPage();
      const response = await page.goto(`${base}/fonts.html`);
      assert.equal(response.status(), 200, 'fonts.html must resolve');
      await page.evaluate(() => document.fonts.ready);

      const proof = await page.evaluate(() => {
        const nodes = [...document.querySelectorAll('main p, main h1, main h2, main h3, main a, main li, main dt, main dd')];
        const forbidden = document.body.textContent.match(/\b(buy now|checkout|add to cart|stripe|notify me|download font)\b/i);
        const catalog = document.querySelector('#font-catalog');
        const h1 = document.querySelector('h1');
        return {
          heading: h1 ? h1.textContent.trim() : '',
          catalogState: document.body.getAttribute('data-font-catalog-state'),
          commerce: document.body.getAttribute('data-commerce-enabled'),
          catalogText: catalog ? catalog.textContent.trim() : '',
          background: getComputedStyle(document.body).backgroundColor,
          textColor: getComputedStyle(h1).color,
          clipped: nodes.filter(n => {
            const r = n.getBoundingClientRect();
            return r.left < -1 || r.right > innerWidth + 1;
          }).map(n => n.textContent.trim().slice(0, 40)),
          forbidden: forbidden && forbidden[0],
        };
      });

      assert.equal(proof.heading, 'Type with a point of view.');
      assert.equal(proof.catalogState, 'empty');
      assert.equal(proof.commerce, 'false');
      assert.equal(proof.catalogText, 'No fonts are available to purchase yet.');
      assert.equal(proof.forbidden, null);
      assert.deepEqual(proof.clipped, [], `${theme}/${width}: content cannot be clipped offscreen`);
      assert.equal(proof.background, theme === 'light' ? 'rgb(250, 250, 248)' : 'rgb(16, 20, 22)');
      assert.notEqual(proof.textColor, proof.background, `${theme}/${width}: heading must separate from the background`);
      await context.close();
    }

    for (const theme of ['light', 'dark']) for (const width of [320, 1280]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: theme });
      const page = await context.newPage();
      await page.goto(`${base}/fonts.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);

      const baseProof = await page.evaluate(() => {
        const primary = document.querySelector('.font-action-primary');
        const mark = document.querySelector('.current-face-mark');
        const styles = getComputedStyle(primary);
        return {
          color: styles.color,
          background: styles.backgroundColor,
          markSize: parseFloat(getComputedStyle(mark).fontSize),
        };
      });
      await page.hover('.font-action-primary');
      const hoverProof = await page.evaluate(() => {
        const styles = getComputedStyle(document.querySelector('.font-action-primary'));
        return { color: styles.color, background: styles.backgroundColor };
      });
      await page.focus('.font-action-primary');
      const focusProof = await page.evaluate(() => {
        const styles = getComputedStyle(document.querySelector('.font-action-primary'));
        return { color: styles.color, background: styles.backgroundColor };
      });

      assert(contrast(baseProof.color, baseProof.background) >= 4.5, `${theme}/${width}: primary action base contrast`);
      assert(contrast(hoverProof.color, hoverProof.background) >= 4.5, `${theme}/${width}: primary action hover contrast`);
      assert(contrast(focusProof.color, focusProof.background) >= 4.5, `${theme}/${width}: primary action focus contrast`);
      assert(baseProof.markSize >= 48, `${theme}/${width}: current face marks must remain specimen-sized`);
      await context.close();
    }
    console.log('Fonts marketplace: no-JS, empty catalog, no checkout, 320/1280 reflow and both themes passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
