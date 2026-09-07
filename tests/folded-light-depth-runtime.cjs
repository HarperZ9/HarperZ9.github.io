const assert = require("node:assert/strict");
const { existsSync, mkdirSync, readFileSync, writeFileSync } = require("node:fs");
const { gunzipSync } = require("node:zlib");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const base = process.env.SITE_BASE_URL || "http://127.0.0.1:8802";
const out = ".superpowers/folded-light-depth";
const beforePng = `${out}/folded-before.png`;
const beforeSamplePath = `${out}/folded-before.sample.json`;
const canonicalBeforePath = "tests/fixtures/folded-light-before.sample.json.gz";
const captureBaseline = process.env.FOLDED_CAPTURE_BASELINE === "1";
const overwriteBaseline = process.env.FOLDED_OVERWRITE_BASELINE === "1";

async function settle(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function waitForFolded(page) {
  await page.waitForFunction(
    () => window.__spatialScene?.manifest?.mode === "procedural-veils" &&
      document.querySelector("#sp-verdict")?.textContent === "MATCH",
    null,
    { timeout: 60000 },
  );
  await settle(page);
}

async function saveCanvas(page, path) {
  const dataUrl = await page.locator("#studio-canvas").evaluate((canvas) => canvas.toDataURL("image/png"));
  writeFileSync(path, Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function sample(page) {
  return page.locator("#studio-canvas").evaluate((canvas) => {
    const w = 160;
    const h = 200;
    const t = document.createElement("canvas");
    t.width = w;
    t.height = h;
    const ctx = t.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(canvas, 0, 0, w, h);
    const raw = Array.from(ctx.getImageData(0, 0, w, h).data);
    let lit = 0;
    let saturated = 0;
    let sum = 0;
    let hash = 2166136261;
    let minX = w;
    let minY = h;
    let maxX = -1;
    let maxY = -1;
    for (let i = 0; i < raw.length; i += 4) {
      const px = i / 4;
      const x = px % w;
      const y = Math.floor(px / w);
      const l = (raw[i] + raw[i + 1] + raw[i + 2]) / 3;
      if (l > 8) {
        lit += 1;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      if (raw[i] > 248 || raw[i + 1] > 248 || raw[i + 2] > 248) saturated += 1;
      sum += l;
      hash ^= raw[i]; hash = Math.imul(hash, 16777619) >>> 0;
      hash ^= raw[i + 1]; hash = Math.imul(hash, 16777619) >>> 0;
      hash ^= raw[i + 2]; hash = Math.imul(hash, 16777619) >>> 0;
    }
    return {
      raw,
      metrics: {
        litRatio: lit / (w * h),
        saturatedRatio: saturated / (w * h),
        mean: sum / (w * h),
        hash,
        bbox: maxX < 0 ? null : { minX, minY, maxX, maxY },
      },
    };
  });
}

function diff(a, b) {
  let sum = 0;
  let max = 0;
  let changed = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    const d = (Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2])) / 3;
    sum += d;
    max = Math.max(max, d);
    if (d > 1.5) changed += 1;
    n += 1;
  }
  return { meanAbs: sum / n, maxAbs: max, changedRatio: changed / n };
}

function readCanonicalBefore() {
  if (!existsSync(canonicalBeforePath)) {
    throw new Error(`Missing canonical Folded Light baseline fixture: ${canonicalBeforePath}`);
  }
  const fixture = JSON.parse(gunzipSync(readFileSync(canonicalBeforePath)).toString("utf8"));
  assert.equal(fixture.fixture, "folded-light-before-sample/v1", "unexpected Folded Light baseline fixture kind");
  assert.equal(fixture.sourceCapture?.sourcePath, beforeSamplePath, "baseline fixture must identify the original pre-edit capture");
  assert.equal(fixture.sourceCapture?.width, 160, "baseline fixture sample width changed");
  assert.equal(fixture.sourceCapture?.height, 200, "baseline fixture sample height changed");
  assert.equal(fixture.sourceCapture?.rgbaValues, 160 * 200 * 4, "baseline fixture rgba layout changed");
  assert.equal(fixture.metrics?.hash, 4075143942, "baseline fixture must stay pinned to the original pre-edit capture");
  assert.ok(Array.isArray(fixture.raw), "baseline fixture must contain raw RGBA samples");
  assert.equal(fixture.raw.length, 160 * 200 * 4, "baseline fixture raw RGBA sample length changed");
  return fixture;
}

(async () => {
  mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, colorScheme: "dark", reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  try {
    await page.goto(`${base}/studio.html?source=spatial&world=folded-light`);
    await waitForFolded(page);
    const current = await sample(page);
    if (captureBaseline) {
      if (existsSync(beforeSamplePath) && !overwriteBaseline) {
        console.log(`BASELINE_EXISTS: ${beforePng} was preserved. Set FOLDED_OVERWRITE_BASELINE=1 to replace it intentionally.`);
        return;
      }
      writeFileSync(beforeSamplePath, JSON.stringify(current, null, 2));
      await saveCanvas(page, beforePng);
      console.log(`BASELINE_CAPTURED: ${beforePng}`);
      return;
    }
    await saveCanvas(page, `${out}/folded-after.png`);

    const state = await page.evaluate(() => ({
      reduced: window.__spatialScene.animating === false,
      count: window.__spatialScene.splatCount,
      dropped: window.__spatialScene.splatsDropped,
      grid: window.__spatialScene.veilGrid || null,
      surfaceStats: window.__spatialScene.surfaceStats || null,
      manifestMode: window.__spatialScene.manifest?.mode,
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
    }));
    assert.equal(state.reduced, true, "reduced motion must freeze Folded Light time");
    assert.equal(state.manifestMode, "procedural-veils");
    assert.equal(state.overflow, false, "desktop Folded Light controls must not overflow");
    assert.ok(current.metrics.litRatio > 0.04, "Folded Light frame must be nonblank");
    assert.ok(current.metrics.saturatedRatio < 0.08, "Folded Light sculpture should stay luminous without clipping large areas");
    assert.ok(state.surfaceStats, "renderer must expose Folded Light surface stats for authored geometry");
    assert.ok(state.surfaceStats.combinedVisibleRatio > 0.16 && state.surfaceStats.combinedVisibleRatio < 0.72, "surface stats must show visible ribbons and open gaps");
    assert.ok(state.surfaceStats.minZ < -4.9 && state.surfaceStats.maxZ > -2.0, "surface stats must preserve near/mid/far depth separation");
    assert.ok(state.surfaceStats.layers.every((layer) => layer.zRange > 0.08), "each veil layer must be nonplanar");

    const modUrl = await page.evaluate(() => performance.getEntriesByType("resource").find((entry) => /\/studio-spatial\.js\?/.test(entry.name))?.name);
    await page.evaluate(async (url) => {
      const mod = await import(url);
      await mod.startSpatial(document.getElementById("studio-canvas"), {
        reducedMotion: true,
        plan: { splatBudget: 10500, tier: "standard", shaderQuality: "standard" },
      });
    }, modUrl);
    await waitForFolded(page);
    const mid = await sample(page);
    const midState = await page.evaluate(() => ({
      reduced: window.__spatialScene.animating === false,
      count: window.__spatialScene.splatCount,
      grid: window.__spatialScene.veilGrid,
      surfaceStats: window.__spatialScene.surfaceStats,
    }));
    assert.equal(midState.reduced, true, "explicit standard plan keeps reduced motion stable");
    assert.equal(midState.count, 10500, "explicit standard plan keeps the full Folded Light splat set");
    assert.deepEqual(midState.grid, { cols: 96, rows: 96 }, "standard plan keeps the default 96 x 96 sculptural grid");
    assert.ok(mid.metrics.litRatio > 0.04 && mid.metrics.saturatedRatio < 0.08, "standard-plan Folded Light frame must be nonblank and bounded");
    await saveCanvas(page, `${out}/folded-after-mid.png`);

    await page.evaluate(() => window.__spatialScene.setCameraView({ x: 0, y: 0, z: 0 }));
    await settle(page);
    const center = await sample(page);
    await page.evaluate(() => window.__spatialScene.setCameraView({ x: 0.045, y: -0.025, z: 0.10 }));
    await settle(page);
    const orbit = await sample(page);
    await saveCanvas(page, `${out}/folded-parallax.png`);
    const parallax = diff(center.raw, orbit.raw);
    assert.ok(parallax.meanAbs > 3 && parallax.changedRatio > 0.20, "Folded Light must show meaningful parallax inside the proof camera boundary");

    await page.evaluate(() => window.__spatialScene.setCameraView({ x: 0, y: 0, z: 0 }));
    await settle(page);
    const pausedA = await sample(page);
    await page.waitForTimeout(250);
    await settle(page);
    const pausedB = await sample(page);
    const pausedDiff = diff(pausedA.raw, pausedB.raw);
    assert.ok(
      pausedDiff.meanAbs < 0.35 && pausedDiff.changedRatio < 0.018,
      `reduced-motion Folded Light must be visually stable while paused: ${JSON.stringify(pausedDiff)}`,
    );

    await page.evaluate(async (url) => {
      const mod = await import(url);
      await mod.startSpatial(document.getElementById("studio-canvas"), {
        reducedMotion: true,
        plan: { splatBudget: 1800, tier: "low", shaderQuality: "basic" },
      });
    }, modUrl);
    await waitForFolded(page);
    const low = await page.evaluate(() => ({
      count: window.__spatialScene.splatCount,
      grid: window.__spatialScene.veilGrid,
      stats: window.__spatialScene.surfaceStats,
    }));
    assert.equal(low.count, 1800, "explicit low-tier splat budget must remain authoritative");
    assert.deepEqual(low.grid, { cols: 64, rows: 64 }, "low tier uses bounded grid cost");
    assert.ok(low.stats.layers.every((layer) => layer.zRange > 0.08), "low-tier grid still carries nonplanar folded surfaces");
    await saveCanvas(page, `${out}/folded-low-tier.png`);

    await page.setViewportSize({ width: 375, height: 900 });
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto(`${base}/studio.html?source=spatial&world=folded-light`);
    await waitForFolded(page);
    const mobile = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > innerWidth + 1,
      reduced: window.__spatialScene.animating === false,
    }));
    assert.deepEqual(mobile, { overflow: false, reduced: true }, "mobile Folded Light remains stable and unclipped");
    await page.screenshot({ path: `${out}/folded-mobile.png`, fullPage: false });

    const before = readCanonicalBefore();
    const beforeDiff = diff(before.raw, current.raw);
    const midBeforeDiff = diff(before.raw, mid.raw);
    assert.ok(beforeDiff.meanAbs > 30 && beforeDiff.changedRatio > 0.55, "after frame must strongly differ from the canonical pre-edit baseline");
    assert.ok(midBeforeDiff.meanAbs > 30 && midBeforeDiff.changedRatio > 0.55, "standard-plan after frame must strongly differ from the canonical pre-edit baseline");
    assert.deepEqual(errors, []);

    const report = {
      baselineFixture: canonicalBeforePath,
      current: current.metrics,
      before: before.metrics,
      beforeDiff,
      mid: mid.metrics,
      midBeforeDiff,
      parallax,
      pausedDiff,
      state,
      midState,
      low,
    };
    writeFileSync(`${out}/folded-runtime-metrics.json`, JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    console.log(`PASS: Folded Light sculptural geometry, baseline delta, parallax, reduced motion, low tier, and mobile verified. Screenshots in ${out}`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
