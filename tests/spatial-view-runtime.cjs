const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';
(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, reducedMotion: 'reduce' });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(`${base}/studio.html?source=spatial&world=atlas&scene=scene-02`);
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-02', null, { timeout: 60000 });
    assert.equal(await page.getByRole('button', { name: 'Copy view link', exact: true }).count(), 1, 'A shared spatial study must retain the edited view, not only its scene ID');
    await page.locator('#sp-depth').evaluate(e => { e.value = '1.65'; e.dispatchEvent(new Event('input')); });
    await page.locator('#sp-exposure').evaluate(e => { e.value = '1.25'; e.dispatchEvent(new Event('input')); });
    await page.locator('[data-atlas-mode="1"]').click();
    await page.locator('[data-compare="overlay"]').click();
    await page.locator('#sp-compare-mix').evaluate(e => { e.value = '.3'; e.dispatchEvent(new Event('input')); });
    await page.evaluate(() => { const s = window.__spatialScene; s.targetYaw = .2; s.targetPitch = -.1; s.distance = 2.8; });
    await page.waitForFunction(() => window.__spatialScene.yaw === .2);
    const copy = async () => { await page.locator('#sp-copy-view').click(); return page.locator('#sp-view-url').inputValue(); };
    const url = await copy();
    await page.goto(url);
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-02', null, { timeout: 60000 });
    const actual = await page.evaluate(() => ({ ...window.__spatialScene.controls, mode: window.__spatialScene.mode, yaw: window.__spatialScene.yaw, pitch: window.__spatialScene.pitch, distance: window.__spatialScene.distance }));
    assert.equal(actual.depthScale, 1.65); assert.equal(actual.exposure, 1.25); assert.equal(actual.mode, 1);
    assert.equal(actual.yaw, .2); assert.equal(actual.pitch, -.1); assert.equal(actual.distance, 2.8);
    assert.equal(await page.locator('#sp-depth').inputValue(), '1.65');
    assert.equal(await page.locator('#sp-compare-mix').inputValue(), '0.3');
    assert.equal(await page.locator('[data-compare="overlay"]').getAttribute('class').then(c => c.includes('active')), true);
    await page.locator('[data-compare="side"]').click();
    await page.goto(await copy());
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-02', null, { timeout: 60000 });
    assert.ok((await page.locator('[data-compare="side"]').getAttribute('class')).includes('active'), 'Curtain comparison survives a view link');
    await page.route('**/art/spatial/atlas/scene-18.*', async route => { await new Promise(r => setTimeout(r, 650)); await route.continue(); });
    await page.locator('#sp-scene').selectOption('scene-18');
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-18');
    await page.waitForFunction(() => new URL(location.href).searchParams.get('scene') === 'scene-18');
    await page.reload();
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-18', null, { timeout: 60000 });
    for (const world of ['crystal-city', 'folded-light']) {
      await page.locator(`[data-world="${world}"]`).click();
      await page.waitForFunction(world => window.__spatialScene?.manifest?.mode === (world === 'crystal-city' ? 'textured-hybrid' : 'procedural-veils'), world, { timeout: 60000 });
      await page.locator('#sp-glow').evaluate(e => { e.value = '1.2'; e.dispatchEvent(new Event('input')); });
      await page.evaluate(() => window.__spatialScene.setCameraTarget(.02, -.01, .05));
      await page.waitForFunction(() => Math.abs(window.__spatialScene.cam.x - .02) < .00001);
      const shared = await copy(); await page.goto(shared);
      await page.waitForFunction(() => window.__spatialScene?.controls?.glow === 1.2, null, { timeout: 60000 });
      assert.equal(await page.locator('#sp-glow').inputValue(), '1.2');
      assert.ok(Math.abs(await page.evaluate(() => window.__spatialScene.cam.x) - .02) < .00002);
    }
    const malformed = new URL(url); malformed.searchParams.set('view', '{"world":"https://example.com/private"}');
    await page.goto(malformed.href);
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-02', null, { timeout: 60000 });
    assert.ok(await page.locator('#sp-view-status').textContent().then(t => /invalid|unsupported/i.test(t)));
    await page.goto(url);
    await page.waitForFunction(() => window.__spatialScene?.currentMeta?.id === 'scene-02', null, { timeout: 60000 });
    await page.setViewportSize({ width: 375, height: 900 });
    await page.locator('#sp-copy-view').scrollIntoViewIfNeeded();
    assert.ok(await page.locator('#sp-copy-view').evaluate(e => {
      const r = e.getBoundingClientRect(); return e.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    }), 'The mobile canvas cannot cover the spatial sharing controls');
    await page.setViewportSize({ width: 1440, height: 1100 });
    await page.route('**/folded-light.world.json', async route => { await new Promise(r => setTimeout(r, 650)); await route.continue(); });
    await page.locator('[data-world="folded-light"]').click();
    await page.locator('#studio-source [data-source="poster"]').click();
    assert.equal(new URL(page.url()).searchParams.get('source'), 'poster', 'Leaving Spatial must not leave a link that reopens the wrong source');
    assert.equal(new URL(page.url()).searchParams.has('view'), false);
    await page.waitForTimeout(1500);
    assert.ok(await page.evaluate(() => window.__studioActiveSource === 'poster' && !window.__spatialScene), 'A pending world load cannot revive Spatial after leaving it');
    await page.unroute('**/folded-light.world.json');
    let starts = 0;
    await page.route('**/folded-light.world.json', async route => {
      const attempt = ++starts;
      await new Promise(r => setTimeout(r, attempt === 1 ? 700 : 1400));
      await route.continue();
    });
    await Promise.all([
      page.waitForRequest('**/folded-light.world.json'),
      page.locator('#studio-source [data-source="spatial"]').click(),
    ]);
    await page.locator('#studio-source [data-source="poster"]').click();
    await page.locator('#studio-source [data-source="spatial"]').click();
    await page.waitForFunction(() => window.__studioActiveSource === 'spatial' && window.__spatialScene?.manifest?.mode === 'procedural-veils', null, { timeout: 10000 });
    assert.deepEqual(errors, []);
    console.log('PASS: Atlas and both hybrid worlds retain controls/camera through share links; malformed views rejected');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
