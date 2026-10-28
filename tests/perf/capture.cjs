// capture.cjs: full-size evidence for a page, for the author to see before anything merges. Viewport screenshots at
// 1440x900 and 390x844, light and dark, at the top and at three depths, and a scroll capture of the whole page at
// each width (Playwright's screencast, VP8 WebM at the viewport's own size).
//
//   SITE_BASE_URL=http://127.0.0.1:8820 node tests/perf/capture.cjs OUTDIR [/index.html]
const fs = require('fs');
const path = require('path');
const { launch } = require('../lib/browser.cjs');

const base = (process.env.SITE_BASE_URL || 'http://127.0.0.1:8820').replace(/\/$/, '');
const out = process.argv[2] || 'perf-capture';
const page0 = process.argv[3] || '/index.html';
const VIEWS = [
  { name: '1440', width: 1440, height: 900, dpr: 1 },
  { name: '390', width: 390, height: 844, dpr: 3, mobile: true },
];
const DEPTHS = [0, 0.25, 0.5, 0.8];
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function shots(browser, v, scheme) {
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: v.dpr, isMobile: !!v.mobile, hasTouch: !!v.mobile, colorScheme: scheme });
  const page = await ctx.newPage();
  await page.goto(base + page0, { waitUntil: 'load' });
  await page.mouse.wheel(0, 1); await wait(2500);
  for (const d of DEPTHS) {
    await page.evaluate((f) => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * f), d);
    await wait(1800);
    const file = path.join(out, `${v.name}-${scheme}-${String(Math.round(d * 100)).padStart(2, '0')}.png`);
    await page.screenshot({ path: file });
    console.log('shot', file);
  }
  await ctx.close();
}

async function scrollVideo(browser, v) {
  const dir = path.join(out, `video-${v.name}`);
  const ctx = await browser.newContext({ viewport: { width: v.width, height: v.height }, deviceScaleFactor: 1, isMobile: !!v.mobile, hasTouch: !!v.mobile,
    recordVideo: { dir, size: { width: v.width, height: v.height } } });
  const page = await ctx.newPage();
  await page.goto(base + page0, { waitUntil: 'load' });
  await page.mouse.wheel(0, 1); await wait(2500);
  const H = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = Math.min(900, Math.ceil(H / 60));
  for (let i = 0; i < steps; i++) { await page.mouse.wheel(0, 60); await wait(33); }
  await wait(1500);
  const vid = page.video();
  await ctx.close();
  const file = path.join(out, `scroll-${v.name}.webm`);
  fs.renameSync(await vid.path(), file);
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('video', file);
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await launch({ channel: process.env.BROWSER_CHANNEL || 'chrome', headless: true, args: ['--autoplay-policy=no-user-gesture-required', '--enable-unsafe-webgpu'] });
  for (const v of VIEWS) for (const s of ['light', 'dark']) await shots(browser, v, s);
  for (const v of VIEWS) await scrollVideo(browser, v);
  await browser.close();
})().catch((e) => { console.error('capture failed', e); process.exit(1); });
