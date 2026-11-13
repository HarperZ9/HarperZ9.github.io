// Shared parts of the surfaces browser tests (surfaces-bench.cjs, surfaces-bench-paint.cjs, surfaces-place.cjs).
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8811';
const launch = () => chromium.launch({ ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {}), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const PAINT_FLOOR = 0.4;   // for the fine paper effects (tooth, granulation, rim): mean absolute difference per channel on a 192 by 144 read
const FLOOR = +(process.env.BENCH_DIFF_FLOOR || 1.5);   // mean absolute difference per channel, 0 to 255, on a 48 by 36 read of the well
// mean absolute difference per channel, 0 to 255, between two RGBA reads
const diff = (a, b) => { let s = 0; for (let i = 0; i < a.length; i += 4) s += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]); return s / (a.length / 4 * 3); };
const noAudio = () => { window.__audio = 0; for (const k of ['AudioContext', 'webkitAudioContext']) { const C = window[k]; if (C) window[k] = function (...a) { window.__audio++; return new C(...a); }; } };
async function open(browser, path, view, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: view.w, height: view.h }, colorScheme: view.scheme || 'light', reducedMotion: view.reduced ? 'reduce' : 'no-preference', acceptDownloads: true, ...extra });
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(noAudio);
  await page.goto(base + path, { waitUntil: 'load' });
  // the pages' own ready signals: the bench host is marked live when its mount has finished; a page of embedded
  // surfaces marks <html> when every host has
  await page.waitForSelector('#parts[data-surface-live="bench"], html[data-surfaces-ready]', { state: 'attached', timeout: 45000 });
  return { ctx, page, errors };
}

function layoutProbe() {
  const names = [...document.querySelectorAll('.bn-name')];
  const cut = names.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1 || getComputedStyle(e).textOverflow === 'ellipsis' || /…$/.test(e.textContent)).map((e) => e.textContent);
  const out = (e) => { const r = e.getBoundingClientRect(), c = e.closest('.bn-cell').getBoundingClientRect(); return r.right > c.right + 1 || r.bottom > c.bottom + 1; };
  const slots = [...document.querySelectorAll('.bn-detail, .bn-detail > section, .bn-detail > section > div')].filter((e) => { const s = getComputedStyle(e); return s.maxHeight !== 'none' || /auto|scroll|hidden/.test(s.overflowY) || e.scrollHeight > e.clientHeight + 1; }).length;
  return { names: names.length, cut, spill: names.filter(out).length, slots, sideways: document.documentElement.scrollWidth - document.documentElement.clientWidth };
}
// Text contrast against the brightest ground the page can show. The field is held under a ceiling colour by a darken
// layer, so no pixel of it is lighter than the ceiling in any channel. `brightest` is the measured brightest pixel of
// the field (a screenshot with the page's words hidden); each text colour is checked against the lighter of the two.
function contrastProbe(brightest) {
  const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  const rgba = (s) => { const m = s.match(/[\d.]+/g).map(Number); return [m[0], m[1], m[2], m[3] ?? 1]; };
  const lid = getComputedStyle(document.querySelector('.gw-backdrop'), '::before'), ceiling = rgba(lid.backgroundColor);
  const ground = Math.max(L(ceiling), brightest ?? 0);
  let worst = { ratio: 99 };
  for (const el of document.querySelectorAll('.parts-lead, .bn *, .parts-surface *')) {
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || el.closest('[hidden], .sr-only, canvas, svg, .bl-dot, .bl-n, .lt-word, .tm-tip')) continue;
    const fg = rgba(cs.color); if (fg[3] < 1) continue;
    const ratio = (L(fg) + 0.05) / (ground + 0.05); if (ratio < worst.ratio) worst = { ratio: +ratio.toFixed(2), text: el.textContent.trim().slice(0, 40), colour: cs.color };
  }
  return { blend: lid.mixBlendMode, ceiling: +L(ceiling).toFixed(4), brightest: brightest == null ? null : +brightest.toFixed(4), worst };
}
// The brightest pixel of the field as the browser paints it, with the page's own words and pictures hidden.
async function brightestGround(page) {
  await page.evaluate(() => { for (const e of document.querySelectorAll('main, header, dialog')) e.style.visibility = 'hidden'; });
  const shot = (await page.screenshot({ type: 'png' })).toString('base64');
  await page.evaluate(() => { for (const e of document.querySelectorAll('main, header, dialog')) e.style.visibility = ''; });
  return page.evaluate(async (b64) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height).data;
    const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; let max = 0;
    for (let i = 0; i < d.length; i += 4) { const l = 0.2126 * lin(d[i]) + 0.7152 * lin(d[i + 1]) + 0.0722 * lin(d[i + 2]); if (l > max) max = l; } return max; }, shot);
}
module.exports = { base, launch, open, layoutProbe, contrastProbe, brightestGround, diff, FLOOR, PAINT_FLOOR };
