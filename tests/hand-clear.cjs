// The hand (Places, Day, Sky, Motion, Plain, the site's corner controls) never covers the page's words or controls.
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/hand-clear.cjs
//
// Four pages (the front page, The Playground, BuildLang, CMMNS) at 390, 580, 768 and 1440 pixels wide are walked from
// top to bottom in steps of half a screen. At each stop the page is scrolled down past the stop and back up to it, the
// move that calls the hand back (world/site/hand-scroll.js), and every visible box the hand draws is compared with
// every line of text and every link, button and field on the page. The test fails on any overlap, and names it.
// It also fails if the hand stays away where it should be found: at the top of every page, and when focus enters it.
// Reduced motion is set so that the hand arrives at once; the rule it follows is the same with motion on.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const PAGES = ['/', '/playground/', '/buildlang.html', '/cmmns.html'];
const WIDTHS = [390, 580, 768, 1440];

function overlaps() {
  const hand = document.querySelector('header.o-hand');
  const shown = hand.getBoundingClientRect().bottom > 0 && !hand.hasAttribute('data-away');
  if (!shown) return { shown, hits: [] };
  // drawn on the screen: not hidden, not transparent, and not inside content the browser skips (a closed details)
  const vis = (el) => el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  const controls = [];
  for (const c of hand.querySelectorAll('*')) if (vis(c)) for (const r of c.getClientRects()) if (r.width > 1 && r.height > 1) controls.push(r);
  const hits = [];
  const hit = (r, what) => { for (const c of controls) if (r.left < c.right && r.right > c.left && r.top < c.bottom && r.bottom > c.top) { hits.push(`${what.slice(0, 50)} at [${[r.left, r.top, r.width, r.height].map(Math.round)}] under a control at [${[c.left, c.top, c.width, c.height].map(Math.round)}]`); return; } };
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT), range = document.createRange();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement;
    if (!n.nodeValue.trim() || !el || hand.contains(el) || el.closest('script,style,noscript,template,.skip,[hidden]')) continue;
    range.selectNodeContents(n);
    const rs = [...range.getClientRects()].filter((r) => r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight);
    if (rs.length && vis(el)) for (const r of rs) hit(r, JSON.stringify(n.nodeValue.trim()));
  }
  for (const el of document.querySelectorAll('a[href], button, input, select, textarea, summary, [role="button"], [tabindex]:not([tabindex="-1"])')) {
    if (hand.contains(el) || el.closest('.skip')) continue;
    const r = el.getBoundingClientRect();
    if (r.width >= 1 && r.height >= 1 && r.bottom > 0 && r.top < innerHeight && vis(el)) hit(r, `<${el.tagName.toLowerCase()}>`);
  }
  return { shown, hits };
}

(async () => {
  const browser = await chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}) });
  const failures = [];
  try {
    for (const w of WIDTHS) for (const path of PAGES) {
      const phone = w < 600;
      const ctx = await browser.newContext({ viewport: { width: w, height: phone ? 844 : w < 1000 ? 1024 : 900 }, reducedMotion: 'reduce', ...(phone ? { hasTouch: true, isMobile: true } : {}) });
      const page = await ctx.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route(/\.(mp4|webm|m4a|mp3)(\?|$)/, (r) => r.abort());
      await page.goto(base + path, { waitUntil: 'load' });
      await page.waitForTimeout(400);
      const H = await page.evaluate(() => document.documentElement.scrollHeight), vh = await page.evaluate(() => innerHeight);
      let stops = 0, shown = 0, hits = 0;
      for (let y = 0; y <= H - vh + 1; y += Math.round(vh / 2)) {
        await page.evaluate((yy) => scrollTo(0, yy + 160), y); await page.waitForTimeout(40);
        await page.evaluate((yy) => scrollTo(0, yy), y); await page.waitForTimeout(120);
        const r = await page.evaluate(overlaps); stops++;
        if (r.shown) shown++;
        if (y === 0 && !r.shown) failures.push(`${w} ${path}: the hand is away at the top of the page`);
        for (const h of r.hits) { hits++; if (hits <= 3) failures.push(`${w} ${path} at y ${y}: ${h}`); }
      }
      if (hits > 3) failures.push(`${w} ${path}: ${hits - 3} more overlaps`);
      // focus brings it back wherever the visitor is
      await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight / 2)); await page.waitForTimeout(120);
      await page.evaluate(() => document.querySelector('header.o-hand a, header.o-hand button').focus()); await page.waitForTimeout(120);
      if (!(await page.evaluate(() => !document.querySelector('header.o-hand').hasAttribute('data-away')))) failures.push(`${w} ${path}: focus in the hand did not bring it back`);
      if (errors.length) failures.push(`${w} ${path}: page errors ${errors.join('; ')}`);
      console.log(`${w} ${path}: ${stops} stops, the hand shown at ${shown}, ${hits} overlaps`);
      await ctx.close();
    }
  } finally { await browser.close(); }
  assert.deepEqual(failures, [], failures.join('\n'));
  console.log('hand-clear: ok');
})().catch((e) => { console.error(e.message || e); process.exit(1); });
