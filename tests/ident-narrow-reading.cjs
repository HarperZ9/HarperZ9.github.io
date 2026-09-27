// Advisory IDs and package names stay whole on narrow screens without pushing the page sideways.
//
// Pages wrap each token in .ident (scripts/ident-tokens.mjs). At 320, 375 and 390 px, with
// every <details> open, each token that fits its container must sit on one line, and no
// token may reach past the viewport or past the edge of an ancestor that hides overflow.
// A token in a box that scrolls sideways (overflow-x auto or scroll, as on a wide figure
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
  'provenance-sensorium.html',
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
    // Lines are counted from the text itself, and two text boxes share a line when
    // they overlap vertically by half the shorter one: a code box with padding and
    // the comma after it sit on one line even though their tops differ.
    const overlaps = (a, b) => Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5 * Math.min(a.bottom - a.top, b.bottom - b.top);
    const lines = [];
    // The token's ink is where its text is drawn. Text held on one line can run past the
    // token's own box, so the edges below come from the text and the box together.
    let inkLeft = box.left;
    let inkRight = box.right;
    const texts = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    for (let node = texts.nextNode(); node; node = texts.nextNode()) {
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width <= 0.5) continue;
        inkLeft = Math.min(inkLeft, rect.left);
        inkRight = Math.max(inkRight, rect.right);
        if (!lines.some((line) => overlaps(line, rect))) lines.push(rect);
      }
    }
    // The natural width is measured on a copy of the token, so inner code keeps its face.
    const copy = el.cloneNode(true);
    copy.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;display:inline-block;max-width:none';
    el.parentElement.appendChild(copy);
    const natural = copy.getBoundingClientRect().width;
    copy.remove();
    const container = blockAncestor(el);
    const style = getComputedStyle(container);
    const room = container.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    // A token inside a sideways-scrolling box (a wide figure table) moves with that box
    // and cannot widen the page, so only the others are held to the viewport. Only auto
    // and scroll make such a box. A hidden or clip ancestor cuts off whatever passes its
    // edge, so a token there must sit inside that ancestor's padding box. The walk stops
    // at the first scrolling box, which owns everything inside it.
    let scrolled = false;
    let clippedBy = null;
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const overflowX = getComputedStyle(node).overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') { scrolled = true; break; }
      if ((overflowX === 'hidden' || overflowX === 'clip') && node.clientWidth > 1 && !clippedBy) {
        const outer = node.getBoundingClientRect();
        const left = outer.left + node.clientLeft;
        const right = left + node.clientWidth;
        if (inkLeft < left - 1 || inkRight > right + 1) {
          clippedBy = `${node.tagName.toLowerCase()}${node.className ? `.${String(node.className).trim().split(/\s+/).join('.')}` : ''}`;
        }
      }
    }
    // Punctuation touching the token from outside must share a line with it.
    const boxes = [...el.getClientRects()];
    const neighbour = (forward) => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      walker.currentNode = el;
      let node = forward ? walker.nextNode() : walker.previousNode();
      while (node && el.contains(node)) node = forward ? walker.nextNode() : walker.previousNode();
      if (!node || !node.nodeValue.length) return null;
      const index = forward ? 0 : node.nodeValue.length - 1;
      const char = node.nodeValue[index];
      if (!(forward ? /[)\]}”’.,;:!?]/ : /[(\[{“‘]/).test(char)) return null;
      const r = document.createRange();
      r.setStart(node, index);
      r.setEnd(node, index + 1);
      const rect = r.getClientRects()[0];
      if (!rect) return null;
      // On the token's line, the character sits inside the token box's vertical span.
      return boxes.some((b) => overlaps(b, rect)) ? null : char;
    };
    results.push({
      token: el.textContent,
      lines: lines.length,
      fits: natural <= room + 0.5,
      right: inkRight,
      scrolled,
      clippedBy,
      strandedAfter: neighbour(true),
      strandedBefore: neighbour(false),
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
          assert.equal(item.clippedBy, null, `${path}@${width}: "${item.token}" is cut off by ${item.clippedBy}, which hides what passes its edge`);
          assert.equal(item.strandedAfter, null, `${path}@${width}: "${item.strandedAfter}" after "${item.token}" starts a line alone`);
          assert.equal(item.strandedBefore, null, `${path}@${width}: "${item.strandedBefore}" before "${item.token}" ends a line alone`);
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
