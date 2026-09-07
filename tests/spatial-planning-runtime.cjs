const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const base = process.env.SITE_BASE_URL || 'http://127.0.0.1:8802';

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const world of ['folded-light', 'crystal-city', 'atlas']) {
    await page.goto(`${base}/studio.html?source=spatial&world=${world}`);
    await page.waitForFunction(() => window.__spatialScene?.splatCount > 0);
    const result = await page.evaluate(async world => {
      const entry = performance.getEntriesByType('resource').find(item => /\/studio-spatial\.js\?/.test(item.name));
      const mod = await import(entry.name);
      const manifestPath = world === 'atlas' ? '/art/spatial/atlas/atlas.world.json' : world === 'crystal-city'
        ? '/art/spatial/crystal-city/crystal-city.world.json' : '/art/spatial/folded-light.world.json';
      const manifest = await (await fetch(manifestPath)).json();
      const loads = [];
      const canvas = document.getElementById('studio-canvas');
      const dimensions = { width: canvas.width, height: canvas.height };
      await mod.startSpatial(canvas, { reducedMotion: true, makePlan(load) {
        loads.push(load); return { splatBudget: 1800, tier: 'low' };
      } });
      const drawn = window.__spatialScene.splatCount;
      await mod.startSpatial(document.getElementById('studio-canvas'), { reducedMotion: true,
        plan: { splatBudget: 900, tier: 'low' }, makePlan() { throw new Error('Explicit plan must take precedence'); } });
      const explicitDrawn = window.__spatialScene.splatCount;
      mod.stopSpatial();
      const originalFetch = window.fetch;
      let release, cancelledPlanCalls = 0;
      window.fetch = (...args) => {
        window.fetch = originalFetch;
        return new Promise(resolve => { release = () => resolve(originalFetch(...args)); });
      };
      const pending = mod.startSpatial(document.getElementById('studio-canvas'), {
        makePlan() { cancelledPlanCalls += 1; return { splatBudget: 500 }; },
      });
      mod.stopSpatial();
      release();
      const cancelled = await pending;
      const count = world === 'atlas' ? Math.max(...manifest.scenes.map(scene => scene.gaussian_count)) : manifest.splats.count;
      const meshPasses = world === 'atlas' ? 0 : world === 'crystal-city'
        ? manifest.textured.color_order.length + manifest.textured.structural.length + 1 : manifest.layers.length + 1;
      return { loads, drawn, explicitDrawn, dimensions, count, meshPasses, cancelledPlanCalls, superseded: cancelled.superseded };
    }, world);
    assert.equal(result.loads.length, 1, 'Manifest-derived planning runs after loading the selected world');
    assert.equal(result.loads[0].splats, result.count, 'Planner receives actual package count');
    assert.equal(result.loads[0].meshes, result.meshPasses, 'Planner includes color layers and depth prepass');
    assert.equal(result.loads[0].width, result.dimensions.width);
    assert.equal(result.loads[0].height, result.dimensions.height);
    assert.equal(result.drawn, 1800, 'Resolved plan actually caps rendered splats');
    assert.equal(result.explicitDrawn, 900, 'Explicit caller budget remains authoritative');
    assert.equal(result.cancelledPlanCalls, 0, 'A cancelled package load never invokes its planner');
    assert.equal(result.superseded, true, 'Exiting Spatial cancels the delayed package start');
    }
    assert.deepEqual(errors, []);
    console.log('Spatial manifest planning: actual scene load, rendered budget enforcement and explicit-plan precedence passed.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
