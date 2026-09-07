const assert = require('node:assert/strict');
const { test, before, after } = require('node:test');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
let browser;
before(async () => { browser = await chromium.launch({ channel: 'chrome', headless: true }); });
after(async () => { await browser?.close(); });

test('Gallery copies its effect stack and strength into a reopenable recipe', async () => {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/gallery.html?seed=continuity&layers=flow`);
    await page.waitForFunction(() => document.querySelector('#desk-canvas')?.dataset.specimenRendered === 'true');
    await page.locator('#desk-rack-fx summary').click();
    await page.locator('#desk-fx').getByRole('button', { name: /^Invert:/ }).click();
    await page.locator('#desk-fx-amount').evaluate(e => { e.value = '.35'; e.dispatchEvent(new Event('input')); });
    await page.locator('#desk-share').click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    assert.equal(new URL(link).searchParams.get('fx'), 'invert', 'Copy link cannot discard the visible effect');
    assert.equal(new URL(link).searchParams.get('fxa'), '0.35');
    await page.goto(link);
    await page.waitForFunction(() => document.querySelector('#desk-canvas')?.dataset.specimenRendered === 'true');
    await page.locator('#desk-rack-fx summary').click();
    assert.equal(await page.locator('#desk-fx').getByRole('button', { name: /^Invert:/ }).getAttribute('aria-pressed'), 'true');
    assert.equal(await page.locator('#desk-fx-amount').inputValue(), '0.35');
  } finally { await context.close(); }
});

test('Gallery mobile preview does not cover the work controls', async () => {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.goto(`${base}/gallery.html?seed=mobile&layers=flow`);
    await page.waitForFunction(() => document.querySelector('#desk-canvas')?.dataset.specimenRendered === 'true');
    const control = page.locator('#desk-share');
    assert.ok(await page.locator('#desk-canvas').evaluate(e => e.getBoundingClientRect().width > 200), 'The working artwork must stay visible after rendering adds its specimen marker');
    await control.scrollIntoViewIfNeeded();
    assert.ok(await control.evaluate(e => { const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); }), 'The sticky artwork must not cover Copy link');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
  } finally { await context.close(); }
});

test('Gallery does not silently truncate a valid effect stack on reopening', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(`${base}/gallery.html?seed=stack&layers=flow&fx=invert,mosaic,posterize,dither,soften,sharpen,halftone,rgbShift,wave&fxa=.35`);
    await page.waitForFunction(() => document.querySelector('#desk-canvas')?.dataset.specimenRendered === 'true');
    assert.equal(await page.locator('#desk-fx [aria-pressed="true"]').count(), 9, 'Every chosen supported effect must reopen');
  } finally { await page.close(); }
});

test('Gallery actions remain readable in an explicit dark theme on a light OS', async () => {
  const context = await browser.newContext({ colorScheme: 'light', reducedMotion: 'reduce' });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem('site-theme', 'dark'));
    await page.goto(`${base}/gallery.html`);
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark');
    await page.locator('#desk-share').scrollIntoViewIfNeeded();
    const colors = await page.locator('#desk-share').evaluate(e => {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const c=canvas.getContext('2d');
      const chain=[];for(let n=e;n;n=n.parentElement)chain.unshift(n);
      for(const n of chain){c.fillStyle=getComputedStyle(n).backgroundColor;c.fillRect(0,0,1,1);}
      const bg=[...c.getImageData(0,0,1,1).data].slice(0,3);
      c.fillStyle=getComputedStyle(e).color;c.fillRect(0,0,1,1);
      return [[...c.getImageData(0,0,1,1).data].slice(0,3),bg];
    });
    const luminance = values => {
      const rgb = values.map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});
      return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
    };
    const [ink,background] = colors.map(luminance);
    assert.ok((Math.max(ink,background)+.05)/(Math.min(ink,background)+.05) >= 4.5, `Action contrast is insufficient: ${colors}`);
  } finally { await context.close(); }
});

test('An image-based recipe explains the missing local image on arrival', async () => {
  const page = await browser.newPage({ reducedMotion: 'reduce' });
  try {
    await page.goto(`${base}/gallery.html?seed=material&layers=flow&material=own`);
    await page.waitForFunction(() => document.querySelector('#desk-canvas')?.dataset.specimenRendered === 'true');
    assert.match(await page.locator('#desk-status').textContent(), /image.*not included/i);
  } finally { await page.close(); }
});
