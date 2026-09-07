const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
const shader = value => `void mainImage(out vec4 O, in vec2 U){ O=vec4(${value},1.0); }`;
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/retro.html`);
    await page.waitForFunction(() => document.querySelector('#re-code').value.length > 0);
    assert.equal(await page.locator('#re-live-edit').count(), 1, 'Live preview control must exist');
    await page.locator('#re-animate').uncheck();
    await page.locator('#re-code').fill(shader('1.0,0.0,0.0'));
    await page.waitForFunction(() => document.querySelector('#re-status').textContent === 'shader compiled');
    const pixels = () => page.locator('#re-out').evaluate(c => c.toDataURL());
    const red = await pixels();
    await page.locator('#re-code').fill('this is deliberately invalid GLSL');
    await page.waitForFunction(() => document.querySelector('#re-status').classList.contains('err'));
    assert.match(await page.locator('#re-status').textContent(), /line|error/i);
    assert.equal(await pixels(), red, 'Invalid edit keeps last valid frame');
    await page.locator('#re-code').fill(shader('0.0,1.0,0.0'));
    await page.waitForFunction(() => document.querySelector('#re-status').textContent === 'shader compiled');
    assert.notEqual(await pixels(), red, 'Editing changes actual output without clicking Run');
    await page.locator('#re-live-edit').uncheck();
    const green = await pixels();
    await page.locator('#re-code').fill(shader('0.0,0.0,1.0'));
    await page.waitForTimeout(600);
    assert.equal(await pixels(), green, 'Live preview can be disabled');
    await page.locator('#re-code').press('Control+Enter');
    await page.waitForFunction(() => document.querySelector('#re-status').textContent === 'shader compiled');
    assert.notEqual(await pixels(), green, 'Keyboard shortcut explicitly compiles');
    for (const colorScheme of ['light', 'dark']) for (const width of [320, 1280]) {
      await page.emulateMedia({ colorScheme });
      await page.setViewportSize({ width, height: 900 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, `${colorScheme}/${width} overflow`);
      const live = await page.locator('#re-live-edit').boundingBox();
      assert(live && live.x >= 0 && live.x + live.width <= width, 'Live control stays reachable');
    }
    console.log('Shader live preview, invalid-edit recovery, manual mode and keyboard shortcut passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
