// Advisory IDs and package names stay whole on narrow screens without pushing the page sideways.
//
// Pages wrap each token in .ident (scripts/ident-tokens.mjs). At 320, 375 and 390 px, with
// every <details> open, each token that fits its container must sit on one line, and no
// token may reach past the viewport. A token in a box that scrolls sideways (a wide figure
// table) must always sit on one line, since the box scrolls instead. Anywhere else a token
// wider than its container may wrap inside itself; that is the rule's fallback, and it is
// counted but not failed.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const WIDTHS = [320, 375, 390];
const PAGES = [
  'security.html', 'gather.html', 'forum.html', 'crucible.html', 'canon.html',
  'systems/relay.html', 'systems/mneme.html', 'systems/plexus.html', 'accountable-surface.html',
  'catalog.html', 'overview.html', 'site-index.html', 'toolkit.html', 'index-graph.html',
  'chorus.html', 'proof-surface.html', 'security-toolkit.html', 'flywheel.html',
  'articulate.html', 'figures/system-capability-map.html', 'figures/verification-capability-map.html', 'index.html',
];

function probe() {
  const blockAncestor = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const display = getComputedStyle(node).display;
      if (!display.startsWith('inline') && display !== 'contents') return node;
    }
    return document.body;
  };
  const results = [];
  for (const el of document.querySelectorAll('.ident')) {
    const box = el.getBoundingClientRect();
    if (box.width === 0 || box.height === 0) continue;
    const range = document.createRange();
    range.selectNodeContents(el);
    const tops = [];
    for (const rect of range.getClientRects()) {
      if (rect.width > 0.5 && !tops.some((top) => Math.abs(top - rect.top) < 3)) tops.push(rect.top);
    }
    const probeSpan = document.createElement('span');
    probeSpan.textContent = el.textContent;
    probeSpan.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;display:inline-block';
    el.parentElement.appendChild(probeSpan);
    const natural = probeSpan.getBoundingClientRect().width;
    probeSpan.remove();
    const container = blockAncestor(el);
    const style = getComputedStyle(container);
    const room = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // A token inside a sideways-scrolling box (a wide figure table) moves with that box
    // and cannot widen the page, so only the others are held to the viewport.
    let scrolled = false;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      if (getComputedStyle(node).overflowX !== 'visible') { scrolled = true; break; }
    }
    results.push({
      token: el.textContent,
      lines: tops.length,
      fits: natural <= room + 0.5,
      right: box.right,
      scrolled,
    });
  }
  return { results, viewport: window.innerWidth, display: getComputedStyle(document.querySelector('.ident') || document.body).display };
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  let checked = 0;
  let fallbacks = 0;
  try {
    for (const width of WIDTHS) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      for (const path of PAGES) {
        const response = await page.goto(`${base}/${path}`, { waitUntil: 'load' });
        assert.equal(response.status(), 200, `${path} must resolve`);
        await page.evaluate(() => document.fonts.ready);
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        const { results, viewport, display } = await page.evaluate(probe);
        assert.ok(results.length > 0, `${path}@${width}: no marked advisory ID or package name is visible`);
        assert.equal(display, 'inline-block', `${path}@${width}: the .ident rule is not applied`);
        for (const item of results) {
          checked += 1;
          // In a box that scrolls sideways the token never needs to wrap: the box scrolls.
          if (item.scrolled) {
            assert.equal(item.lines, 1, `${path}@${width}: "${item.token}" wraps inside a box that scrolls sideways`);
          } else if (item.fits) {
            assert.equal(item.lines, 1, `${path}@${width}: "${item.token}" fits its container but breaks across ${item.lines} lines`);
          } else if (item.lines > 1) {
            fallbacks += 1;
          }
          if (!item.scrolled) {
            assert.ok(item.right <= viewport + 1, `${path}@${width}: "${item.token}" reaches past the viewport (${Math.round(item.right)} > ${viewport})`);
          }
        }
      }
      await context.close();
    }
  } finally {
    await browser.close();
  }
  console.log(`ident narrow reading: ${checked} tokens checked across ${PAGES.length} pages at ${WIDTHS.join(', ')} px; ${fallbacks} wider than their container wrapped inside`);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
