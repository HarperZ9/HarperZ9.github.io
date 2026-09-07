const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const tinyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
  'base64'
);

function installPosterLifecycleProbe() {
  const inactivePosterDraws = [];

  function selectedSource() {
    const tab = document.querySelector('#studio-source button[aria-selected="true"]');
    return tab?.dataset.source || window.__studioActiveSource || '';
  }

  const nativeFillText = CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText = function fillTextProbe(text, ...rest) {
    const source = selectedSource();
    const posterSized = this.canvas?.width === 1191 && this.canvas?.height === 1684;
    if (this.canvas?.id === 'studio-canvas' && posterSized && source && source !== 'poster') {
      inactivePosterDraws.push({
        op: 'fillText',
        source,
        text: String(text).slice(0, 40),
        width: this.canvas.width,
        height: this.canvas.height,
      });
    }
    return nativeFillText.call(this, text, ...rest);
  };

  const nativeCreateImageBitmap = typeof window.createImageBitmap === 'function'
    ? window.createImageBitmap.bind(window)
    : null;
  let delayNextBitmap = false;
  let releaseBitmap = null;
  let bitmapCalls = 0;

  async function testBitmap() {
    const canvas = document.createElement('canvas');
    canvas.width = 16;
    canvas.height = 16;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff35aa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return nativeCreateImageBitmap ? nativeCreateImageBitmap(canvas) : canvas;
  }

  window.createImageBitmap = async function createImageBitmapProbe() {
    bitmapCalls += 1;
    if (delayNextBitmap) {
      delayNextBitmap = false;
      await new Promise((resolve) => {
        releaseBitmap = resolve;
      });
    }
    return testBitmap();
  };

  window.__posterLifecycleProbe = Object.freeze({
    reset() { inactivePosterDraws.length = 0; },
    inactivePosterDraws() { return inactivePosterDraws.slice(); },
    delayNextBitmap() { delayNextBitmap = true; },
    bitmapPending() { return typeof releaseBitmap === 'function'; },
    bitmapCalls() { return bitmapCalls; },
    releaseBitmap() {
      const release = releaseBitmap;
      releaseBitmap = null;
      if (release) release();
    },
  });
}

async function openPosterPage(browser) {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await page.addInitScript(installPosterLifecycleProbe);
  await page.goto(`${base}/studio.html?source=poster`);
  await page.waitForSelector('#src-poster:not([hidden]) textarea.poster-text', { timeout: 30000 });
  await page.evaluate(() => document.fonts?.ready);
  await page.evaluate(() => window.__posterLifecycleProbe.reset());
  return { context, page };
}

async function assertNoInactivePosterDraw(page, label) {
  const result = await page.evaluate(() => ({
    source: document.querySelector('#studio-source button[aria-selected="true"]')?.dataset.source || null,
    draws: window.__posterLifecycleProbe.inactivePosterDraws(),
  }));
  assert.equal(result.source, 'fractal', `${label}: expected to be off Poster`);
  assert.deepEqual(result.draws, [], `${label}: Poster rendered while inactive: ${JSON.stringify(result.draws)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    {
      const { context, page } = await openPosterPage(browser);
      try {
        await page.evaluate(() => {
          const text = document.querySelector('#src-poster textarea.poster-text');
          text.value = 'RACE QUEUED TEXT SHOULD NOT DRAW AFTER SOURCE SWITCH';
          text.dispatchEvent(new Event('input', { bubbles: true }));
          document.querySelector('#studio-source button[data-source="fractal"]').click();
        });
        await page.waitForFunction(() => (
          document.querySelector('#studio-source button[aria-selected="true"]')?.dataset.source === 'fractal'
        ));
        await page.waitForTimeout(260);
        await assertNoInactivePosterDraw(page, 'queued text edit');
      } finally {
        await context.close();
      }
    }

    {
      const { context, page } = await openPosterPage(browser);
      try {
        await page.evaluate(() => {
          window.__posterLifecycleProbe.reset();
          window.__posterLifecycleProbe.delayNextBitmap();
        });
        await page.locator('input.poster-imgfile').setInputFiles({
          name: 'tiny.png',
          mimeType: 'image/png',
          buffer: tinyPng,
        });
        await page.waitForFunction(() => window.__posterLifecycleProbe.bitmapPending(), null, { timeout: 5000 });
        assert.equal(await page.evaluate(() => window.__posterLifecycleProbe.bitmapCalls()), 1);
        await page.locator('#studio-source button[data-source="fractal"]').click();
        await page.waitForFunction(() => (
          document.querySelector('#studio-source button[aria-selected="true"]')?.dataset.source === 'fractal'
        ));
        await page.evaluate(() => window.__posterLifecycleProbe.releaseBitmap());
        await page.waitForTimeout(160);
        await assertNoInactivePosterDraw(page, 'delayed image import');
      } finally {
        await context.close();
      }
    }

    console.log('Poster lifecycle source-switch races passed');
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
