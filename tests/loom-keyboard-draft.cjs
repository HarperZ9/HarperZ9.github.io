const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");

const ROOT = path.resolve(__dirname, "..");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".woff2": "font/woff2",
};

function routePath(url) {
  const pathname = decodeURIComponent(new URL(url, "http://127.0.0.1").pathname);
  const rel = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const resolved = path.resolve(ROOT, rel);
  if (!resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

async function startServer() {
  const server = http.createServer(async (request, response) => {
    const resolved = routePath(request.url || "/");
    if (!resolved) {
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    try {
      const body = await fs.readFile(resolved);
      response.writeHead(200, {
        "content-type": MIME[path.extname(resolved).toLowerCase()] || "application/octet-stream",
        "cache-control": "no-store",
      });
      response.end(body);
    } catch (_) {
      response.writeHead(404);
      response.end("not found");
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

function twillChartCell(info, zone, col, row) {
  const ends = 120;
  const shafts = 4;
  const treadles = 4;
  const cell = Math.max(3, Math.floor(1200 / (ends + treadles + 3)));
  const threading = { x: cell, y: cell, w: ends * cell, h: shafts * cell };
  const tieup = {
    x: threading.x + threading.w + cell,
    y: cell,
    w: treadles * cell,
    h: shafts * cell,
  };
  const treadling = {
    x: tieup.x,
    y: threading.y + threading.h + cell,
    w: treadles * cell,
  };
  const box = zone === "tieup" ? tieup : treadling;
  const canvasX = box.x + col * cell + cell / 2;
  const canvasY = box.y + row * cell + cell / 2;
  return {
    canvasX,
    canvasY,
    screenX: info.left + canvasX * (info.width / info.canvasWidth),
    screenY: info.top + canvasY * (info.height / info.canvasHeight),
  };
}

async function chartInfo(page) {
  return page.locator("#wv-chart").evaluate((canvas) => {
    const r = canvas.getBoundingClientRect();
    return {
      canvasWidth: canvas.width,
      canvasHeight: canvas.height,
      left: r.left,
      top: r.top,
      width: r.width,
      height: r.height,
    };
  });
}

async function pixelSum(page, point) {
  return page.locator("#wv-chart").evaluate((canvas, { canvasX, canvasY }) => {
    const data = canvas.getContext("2d").getImageData(Math.floor(canvasX), Math.floor(canvasY), 1, 1).data;
    return data[0] + data[1] + data[2];
  }, point);
}

async function expectStatus(page, text) {
  try {
    await page.waitForFunction((needle) => {
      return document.querySelector("#wv-status")?.textContent.includes(needle);
    }, text, { timeout: 2000 });
  } catch (_) {}
  const actual = await page.locator("#wv-status").textContent();
  assert.ok(actual.includes(text), `expected Loom status to include "${text}", got "${actual}"`);
}

(async () => {
  const { server, base } = await startServer();
  const launch = { headless: true };
  if (process.env.BROWSER_CHANNEL) launch.channel = process.env.BROWSER_CHANNEL;
  else launch.channel = "chrome";
  const browser = await chromium.launch(launch);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/loom.html`, { waitUntil: "domcontentloaded" });
    await page.locator("#wv-recipes .re-chip", { hasText: "Dish towel" }).click();
    await page.waitForFunction(() => document.querySelector("#wv-readout")?.textContent.includes("120 ends"));
    await page.locator('#wv-views [data-view="draft"]').click();
    await page.waitForFunction(() => {
      const chart = document.querySelector("#wv-chart");
      return chart && !chart.hidden && chart.width > 0 && chart.height > 0;
    });

    const infoBefore = await chartInfo(page);
    const topTieup = twillChartCell(infoBefore, "tieup", 0, 0);
    const beforeClick = await pixelSum(page, topTieup);
    await page.mouse.click(topTieup.screenX, topTieup.screenY);
    await expectStatus(page, "tie-up treadle 1, shaft 4");

    const afterClick = await pixelSum(page, topTieup);
    assert.ok(afterClick < beforeClick - 80, "clicking the visual top tie-up cell should lift shaft 4");
    assert.equal(await page.locator("#wv-draft-cursor").getAttribute("data-zone"), "tieup");
    assert.equal(await page.locator("#wv-draft-cursor").getAttribute("data-col"), "0");
    assert.equal(await page.locator("#wv-draft-cursor").getAttribute("data-row"), "0");
    assert.equal(await page.locator("#wv-chart").evaluate((el) => el === document.activeElement), true);

    await page.evaluate(() => window.scrollTo(0, 280));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.keyboard.press("ArrowDown");
    assert.equal(await page.locator("#wv-draft-cursor").getAttribute("data-row"), "1");
    assert.equal(await page.evaluate(() => window.scrollY), scrollBefore, "draft arrow keys should not scroll while the chart owns focus");
    await expectStatus(page, "tie-up treadle 1, shaft 3");

    const movedInfo = await chartInfo(page);
    const nextTieup = twillChartCell(movedInfo, "tieup", 0, 1);
    const beforeSpace = await pixelSum(page, nextTieup);
    const weaveBefore = await page.locator("#wv-weaveit").isChecked();
    await page.keyboard.press("Space");
    await expectStatus(page, "the cloth follows the draft");
    assert.equal(await page.locator("#wv-weaveit").isChecked(), weaveBefore, "chart Space should not bubble into the page-level weave shortcut");
    const afterSpace = await pixelSum(page, nextTieup);
    assert.ok(afterSpace < beforeSpace - 80, "Space should edit the selected visual tie-up cell");

    await page.locator("#wv-wif-check").click();
    await expectStatus(page, "export verified:");
    assert.ok(await page.locator("#wv-draft-cursor").isVisible(), "the visible cursor should be an overlay element");
    console.log("Loom keyboard draft browser check passed.");
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
