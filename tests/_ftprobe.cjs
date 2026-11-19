const { chromium } = require('playwright');
const base = process.env.SITE_BASE_URL;
const INIT = () => { window.__draws = 0; window.__logs = []; const P = WebGLRenderingContext.prototype, d = P.drawArrays; P.drawArrays = function (...a) { window.__draws++; return d.apply(this, a); };
  const raf = window.requestAnimationFrame.bind(window); window.__rafs = 0; window.requestAnimationFrame = (cb) => raf((t) => { window.__rafs++; cb(t); }); };
(async () => { const browser = await chromium.launch({ channel: 'chrome' }); try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); await ctx.addInitScript(INIT);
  const page = await ctx.newPage(); page.on('console', (m) => console.log('console:', m.type(), m.text().slice(0, 200))); page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(base + '/playground/', { waitUntil: 'load' }); await page.waitForSelector('#sx-start:not([hidden])'); await page.click('#sx-start'); await page.waitForSelector('#sx-more:not([hidden])', { timeout: 60000 });
  const t0 = Date.now(); await page.click('[data-sx-press="well"]');
  const snap = (l) => page.evaluate((l) => ({ l, draws: window.__draws, rafs: window.__rafs, reduced: matchMedia('(prefers-reduced-motion: reduce)').matches, hidden: document.hidden, canv: [...document.querySelectorAll('#sx-hosts canvas')].map((c) => `${c.className}:${c.width}x${c.height}`).join(' ') }), l);
  for (const s of [0, 1, 2, 3, 5, 8]) { await page.waitForTimeout(s ? 1000 * (s - (s > 3 ? (s === 5 ? 3 : 5) : s - 1)) : 10); console.log(JSON.stringify(await snap(`${((Date.now() - t0) / 1000).toFixed(1)}s`))); }
  await ctx.close(); } finally { await browser.close(); } })();
