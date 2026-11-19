const { chromium } = require('playwright');
const base = process.env.SITE_BASE_URL;
(async () => { const browser = await chromium.launch({ channel: 'chrome' }); try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage(); page.on('console', (m) => { if (!/GPU stall/.test(m.text())) console.log('console:', m.type(), m.text().slice(0, 200)); }); page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base + '/playground/', { waitUntil: 'load' }); await page.waitForSelector('#sx-start:not([hidden])'); await page.click('#sx-start'); await page.waitForSelector('#sx-more:not([hidden])', { timeout: 60000 });
  await page.click('[data-sx-press="well"]'); await page.waitForFunction(() => window.__surface?.handles?.well, null, { timeout: 60000 });
  const snap = () => page.evaluate(() => { const v = window.__surface.handles.well.value(), w = v.well; if (!w) return { well: null };
    return { t: Math.round(performance.now()), timing: w.timing(), energy: +w.energy().toExponential(2), reduced: w.reduced, hidden: document.hidden, vis: document.visibilityState, canvas: [v.canvas.width, v.canvas.height], ground: v.ground }; });
  for (let i = 0; i < 6; i++) { console.log(JSON.stringify(await snap())); await page.waitForTimeout(1000); }
  await page.locator('#sx-hosts canvas').last().scrollIntoViewIfNeeded();
  for (let i = 0; i < 4; i++) { await page.waitForTimeout(1000); console.log('scrolled', JSON.stringify(await snap())); }
  await ctx.close(); } finally { await browser.close(); } })();
