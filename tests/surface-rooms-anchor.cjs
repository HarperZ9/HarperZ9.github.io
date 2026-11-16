// A room's heading stays clear of the page's top navigation after a jump to the room (The Playground: #type,
// #shader, #sound).
//
//   python tests/lib/serve.py 8811 . &   SITE_BASE_URL=http://127.0.0.1:8811 node tests/surface-rooms-anchor.cjs
//
// On 15 November 2026, at about 580 px wide, /playground/?room=shader#shader put "Shaders: write one, watch it run"
// partly under the navigation that stays at the top of the screen. The room opens after the browser has already
// jumped to the fragment, and the page above the room grows as the shell's parts arrive, so two things must hold:
//   1. a room section keeps a scroll margin at least as tall as the navigation, so a jump lands the heading below it;
//   2. after the jump, with the navigation in place, the heading's top is below the navigation's bottom, at 390,
//      580 and 1440 px.
// Both ways in are tried for each room and width: the address that opens the room (?room=x#x), and a jump to the
// fragment on a page that is already loaded (a link pressed on the page).
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const ROOMS = ['type', 'shader', 'sound'], WIDTHS = [390, 580, 1440];

// The navigation is the hand (header.o-hand): fixed at the top, it steps away while a reader scrolls down and comes
// back on a move up or when focus enters it (world/site/hand-scroll.js). An address that opens at a room can leave it
// in place. The test brings it back the way a keyboard does, so the heading is measured against the hand at rest.
const showHand = () => { const h = document.querySelector('header.o-hand'); (h.querySelector('a[href], button') || h).focus({ preventScroll: true }); };
const measure = (id) => {
  const sec = document.getElementById(id), h = sec.querySelector('h2'), hand = document.querySelector('header.o-hand');
  let bar = hand.getBoundingClientRect().bottom;
  for (const el of hand.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== 'hidden') bar = Math.max(bar, r.bottom); }
  return { away: hand.hasAttribute('data-away'), bar: Math.round(bar), top: Math.round(h.getBoundingClientRect().top), margin: parseFloat(getComputedStyle(sec).scrollMarginTop) || 0, heading: h.textContent.trim(), y: Math.round(scrollY) };
};
// the page has settled when the heading has not moved for half a second
async function settled(page, id) {
  let last = null, still = 0;
  for (let i = 0; i < 60 && still < 5; i++) {
    const top = await page.evaluate((x) => Math.round(document.getElementById(x).querySelector('h2').getBoundingClientRect().top), id);
    still = top === last ? still + 1 : 0; last = top;
    await page.waitForTimeout(100);
  }
  assert.ok(still >= 5, `#${id}: the heading was still moving after 6 s`);
}

(async () => {
  const browser = await chromium.launch(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {});
  const seen = [];
  try {
    for (const width of WIDTHS) {
      for (const id of ROOMS) {
        // 1. the address that opens the room
        const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
        const page = await ctx.newPage();
        await page.goto(`${base}/playground/?room=${id}#${id}`, { waitUntil: 'load' });
        await page.waitForSelector(`#${id}[data-room-live]`, { timeout: 30000 });
        await settled(page, id);
        await page.evaluate(showHand); await page.waitForTimeout(500);
        const a = await page.evaluate(measure, id);
        assert.ok(!a.away && a.bar > 40, `${width}px #${id}: the navigation was not at the top of the screen (bottom ${a.bar}px), so the test measured nothing`);
        assert.ok(a.margin >= a.bar, `${width}px #${id}: the room's scroll margin (${a.margin}px) is shorter than the navigation (${a.bar}px)`);
        assert.ok(a.top >= a.bar, `${width}px #${id} by address: "${a.heading}" starts at ${a.top}px, under the navigation that ends at ${a.bar}px`);
        assert.ok(a.top < 800 * 0.6, `${width}px #${id} by address: the heading is at ${a.top}px, too far down to count as arriving at the room`);
        // leave the room before closing: a playing piece or a running shader stalls the browser's shutdown
        await page.evaluate((x) => window.__rooms?.handles?.[x]?.destroy?.(), id === 'type' ? 'forge' : id).catch(() => {});
        await ctx.close();

        // 2. a jump on a loaded page, the room not opened
        const ctx2 = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
        const page2 = await ctx2.newPage();
        await page2.goto(`${base}/playground/`, { waitUntil: 'load' });
        await page2.waitForTimeout(1500);
        await page2.evaluate((x) => { location.hash = x; }, id);
        await settled(page2, id);
        await page2.evaluate(showHand); await page2.waitForTimeout(500);
        const b = await page2.evaluate(measure, id);
        assert.ok(!b.away && b.bar > 40, `${width}px #${id}: the navigation was not at the top of the screen (bottom ${b.bar}px), so the test measured nothing`);
        assert.ok(b.top >= b.bar, `${width}px #${id} by jump: "${b.heading}" starts at ${b.top}px, under the navigation that ends at ${b.bar}px`);
        assert.ok(b.top < 800 * 0.6, `${width}px #${id} by jump: the heading is at ${b.top}px, too far down to count as arriving at the room`);
        await ctx2.close();
        seen.push(`${width}:${id} bar ${a.bar} address ${a.top} jump ${b.top}`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`surface-rooms-anchor: ${seen.length} room and width pairs, each heading below the navigation by address and by jump\n  ${seen.join('\n  ')}`);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
