// measure.cjs: one page on one profile, measured the way PERFORMANCE-BUDGET.md defines it. The CPU runs at the
// budget's slowdown through the DevTools protocol, the network at the budget's link, and the page is walked through
// five phases: load, idle, scroll, parked mid page (offscreen work), and a hidden tab. A Chrome trace of the scroll
// phase is written beside the report.
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PROBE = fs.readFileSync(path.join(__dirname, 'probe.js'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const p95 = (xs) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(s.length * 0.95))]; };

async function openPage(browser, prof, budget) {
  const ctx = await browser.newContext({ viewport: { width: prof.width, height: prof.height }, deviceScaleFactor: prof.dpr,
    isMobile: !!prof.mobile, hasTouch: !!prof.mobile, colorScheme: prof.scheme || 'light', reducedMotion: 'no-preference' });
  const scripts = new Map();
  ctx.on('response', async (res) => {
    const t = res.request().resourceType();
    if (t !== 'script' && !/\.(m?js)(\?|$)/.test(res.url())) return;
    try { const b = await res.body(); scripts.set(res.url(), { raw: b.length, gz: zlib.gzipSync(b, { level: 9 }).length, at: Date.now() }); }
    catch (e) { scripts.set(res.url(), { raw: 0, gz: 0, at: Date.now(), err: e.message }); }
  });
  await ctx.addInitScript(PROBE);
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: budget.profile.cpuSlowdown });
  const n = budget.profile.network;
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: n.rttMs, downloadThroughput: n.downKbps * 128, uploadThroughput: n.upKbps * 128 });
  return { ctx, page, cdp, scripts };
}

async function scrollThrough(page, ms) {
  const end = Date.now() + ms;
  const height = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const step = Math.max(40, Math.round(height / (ms / 50)));
  while (Date.now() < end) {
    await page.mouse.wheel(0, step);
    await wait(50);
    const atEnd = await page.evaluate(() => scrollY + innerHeight >= document.documentElement.scrollHeight - 2);
    if (atEnd) break;
  }
}

function traceStats(file) {
  try {
    const t = JSON.parse(fs.readFileSync(file, 'utf8')); const ev = t.traceEvents || t;
    const main = ev.filter((e) => e.name === 'RunTask' && e.dur);
    const long = main.filter((e) => e.dur > 50000);
    return { tasks: main.length, longTasks: long.length, blockingMs: Math.round(long.reduce((a, e) => a + (e.dur / 1000 - 50), 0)) };
  } catch (e) { console.warn('trace: unreadable', file, e.message); return null; }
}

function mediaFindings(s, prof, budget) {
  const out = [], cap = Math.min(s.dpr, budget.media.dprCap);
  for (const v of s.videos.filter((x) => x.on && x.cw > 1)) {
    const need = Math.round(v.cw * cap);
    if (v.w && v.w < need * budget.media.tolerance) out.push(`video ${v.cls} drawn at ${need} px from a ${v.w} px source`);
    if (!prof.mobile && v.cw >= s.vw * 0.9 && v.w && v.w < budget.media.fullBleedMin) out.push(`full-bleed video ${v.cls} has a ${v.w} px source, under ${budget.media.fullBleedMin}`);
    if (!v.poster) out.push(`video ${v.cls} has no poster`);
    if (!v.types.some((t) => /av01|vp9|vp09/.test(t)) || !v.types.some((t) => /mp4/.test(t))) out.push(`video ${v.cls} lacks an AV1/VP9 source with an MP4 fallback`);
  }
  for (const i of s.imgs.filter((x) => x.cw >= budget.media.minCheckedWidth)) {
    const need = Math.round(i.cw * cap);
    if (i.w < need * budget.media.tolerance) out.push(`image ${i.src.split('/').pop()} drawn at ${need} px from ${i.w} px`);
  }
  return out;
}

const summary = (page) => page.evaluate(() => window.__perfSummary());
const kb = (scripts) => +([...scripts.values()].reduce((a, x) => a + x.gz, 0) / 1024).toFixed(1);

// load, then the page settles and idles with no input. First-view JS is what arrived before the load event: the
// scripts the first screen waits on. Anything a page loads later (in idle time) is not first view, but its cost is
// not free: the idle frames are counted from the load event on, so a heavy boot after load shows as idle frames.
async function loadPhase(page, url, scripts, prof, budget) {
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  const loadedAt = Date.now();
  await page.evaluate(() => window.__perf.resetFrames());
  await wait(budget.phases.settleMs);
  const firstViewJsKB = +([...scripts.values()].filter((x) => x.at <= loadedAt).reduce((a, x) => a + x.gz, 0) / 1024).toFixed(1);
  const first = await summary(page);
  await wait(budget.phases.idleMs);
  return { firstViewJsKB, first, media: mediaFindings(first, prof, budget), idle: await page.evaluate(() => window.__perf.frames.slice()) };
}

// the whole page scrolled under a Chrome trace
async function scrollPhase(browser, page, budget, traceFile) {
  await page.evaluate(() => window.__perf.resetFrames());
  if (traceFile) await browser.startTracing(page, { path: traceFile, categories: ['toplevel', 'devtools.timeline', 'disabled-by-default-devtools.timeline.frame'] });
  await scrollThrough(page, budget.phases.scrollMs);
  if (traceFile) await browser.stopTracing();
  return { scroll: await page.evaluate(() => window.__perf.frames.slice()), peak: await summary(page) };
}

// parked mid page, nothing offscreen may draw or play; then a hidden tab, where nothing may draw or play at all
async function restPhases(page, prof, budget) {
  await page.evaluate(() => window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.5));
  await wait(800);
  const midMedia = mediaFindings(await summary(page), prof, budget);
  await page.evaluate(() => window.__perf.resetDraws());
  await wait(budget.phases.watchMs);
  const parked = await summary(page);
  await page.evaluate(() => window.__perfHide(true));
  // a frame already in flight when the tab hid may finish (a real hidden tab never starts another); wait it out
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await wait(400);
  await page.evaluate(() => window.__perf.resetDraws());
  await wait(budget.phases.watchMs);
  const hidden = await summary(page);
  return {
    midMedia,
    offscreenDraws: parked.draws.filter((d) => d.dom && d.on === false && d.n > 0).map((d) => `${d.cls} x${d.n}`),
    offscreenVideos: parked.videos.filter((v) => !v.on && v.playing).map((v) => v.cls),
    hiddenDraws: hidden.draws.filter((d) => d.n > 0).map((d) => `${d.cls} x${d.n}`),
    hiddenVideos: hidden.videos.filter((v) => v.playing).map((v) => v.cls),
  };
}

async function measure(browser, url, prof, budget, traceFile) {
  const { ctx, page, scripts } = await openPage(browser, prof, budget);
  const t0 = Date.now();
  const L = await loadPhase(page, url, scripts, prof, budget);
  const S = await scrollPhase(browser, page, budget, traceFile);
  const allJsKB = kb(scripts);
  const R = await restPhases(page, prof, budget);
  await ctx.close();
  return {
    url, profile: prof.name, wallMs: Date.now() - t0,
    lcpMs: Math.round(L.first.lcp), lcpEl: L.first.lcpEl, cls: +S.peak.cls.toFixed(4),
    idleP95: +p95(L.idle).toFixed(1), scrollP95: +p95(S.scroll).toFixed(1), idleFrames: L.idle.length, scrollFrames: S.scroll.length,
    domCanvases: S.peak.domCanvases, liveCanvases: Math.max(L.first.live, S.peak.live), gpuContexts: S.peak.gpu,
    firstViewJsKB: L.firstViewJsKB, allJsKB, scripts: scripts.size,
    offscreenDraws: R.offscreenDraws, offscreenVideos: R.offscreenVideos, hiddenDraws: R.hiddenDraws, hiddenVideos: R.hiddenVideos,
    media: [...new Set([...L.media, ...R.midMedia])], trace: traceFile ? traceStats(traceFile) : null,
  };
}

module.exports = { measure, p95 };
