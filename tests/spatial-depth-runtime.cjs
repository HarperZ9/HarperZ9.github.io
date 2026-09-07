const assert = require("node:assert/strict");
const { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");
const { spawn } = require("node:child_process");
const net = require("node:net");

const base = process.env.SITE_BASE_URL || "http://127.0.0.1:8802";
const out = ".superpowers/spatial-depth";

function chromePath() {
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const programFiles = process.env.ProgramFiles || "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
  const candidates = [
    join(programFiles, "Google", "Chrome", "Application", "chrome.exe"),
    join(programFilesX86, "Google", "Chrome", "Application", "chrome.exe"),
    join(programFiles, "Microsoft", "Edge", "Application", "msedge.exe"),
    join(programFilesX86, "Microsoft", "Edge", "Application", "msedge.exe"),
  ];
  if (process.env.LOCALAPPDATA) {
    candidates.push(join(process.env.LOCALAPPDATA, "Google", "Chrome", "Application", "chrome.exe"));
    candidates.push(join(process.env.LOCALAPPDATA, "Microsoft", "Edge", "Application", "msedge.exe"));
  }
  for (const p of candidates) if (existsSync(p)) return p;
  throw new Error("Chrome or Edge is required for the spatial depth runtime probe");
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(fn, timeout = 60000, label = "condition") {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      last = error;
    }
    await new Promise((r) => setTimeout(r, 120));
  }
  throw new Error(`Timed out waiting for ${label}${last ? `: ${last.message}` : ""}`);
}

async function fetchJson(url, opts) {
  const response = await fetch(url, opts);
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const pending = new Map();
    const listeners = new Map();
    let nextId = 1;
    const api = {
      errors: [],
      on(method, fn) {
        const list = listeners.get(method) || [];
        list.push(fn);
        listeners.set(method, list);
        return () => {
          const current = listeners.get(method) || [];
          listeners.set(method, current.filter((f) => f !== fn));
        };
      },
      once(method) {
        return new Promise((res) => {
          const off = api.on(method, (params) => { off(); res(params); });
        });
      },
      send(method, params = {}) {
        const id = nextId++;
        ws.send(JSON.stringify({ id, method, params }));
        return new Promise((res, rej) => {
          pending.set(id, { res, rej, method });
          setTimeout(() => {
            if (!pending.has(id)) return;
            pending.delete(id);
            rej(new Error(`${method} timed out`));
          }, 30000).unref();
        });
      },
      close() { try { ws.close(); } catch (_) {} },
    };
    ws.onopen = () => resolve(api);
    ws.onerror = () => reject(new Error("DevTools WebSocket failed"));
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id) {
        const item = pending.get(msg.id);
        if (!item) return;
        pending.delete(msg.id);
        if (msg.error) item.rej(new Error(`${item.method}: ${msg.error.message}`));
        else item.res(msg.result || {});
        return;
      }
      if (msg.method === "Runtime.exceptionThrown") {
        const details = msg.params?.exceptionDetails;
        api.errors.push(details?.exception?.description || details?.text || "runtime exception");
      }
      for (const fn of listeners.get(msg.method) || []) fn(msg.params || {});
    };
  });
}

async function startBrowser() {
  const port = await freePort();
  const profile = mkdtempSync(join(tmpdir(), "spatial-depth-cdp-"));
  const chrome = spawn(chromePath(), [
    "--headless=new",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-networking",
    "--use-angle=swiftshader",
    "about:blank",
  ], { stdio: "ignore" });
  await waitFor(() => fetch(`http://127.0.0.1:${port}/json/version`).then(r => r.ok).catch(() => false), 10000, "Chrome DevTools");
  const target = await fetchJson(`http://127.0.0.1:${port}/json/new?about:blank`, { method: "PUT" });
  const page = await connect(target.webSocketDebuggerUrl);
  await page.send("Page.enable");
  await page.send("Runtime.enable");
  return { page, chrome, profile };
}

async function setViewport(page, width, height, theme = "dark", motion = "reduce") {
  await page.send("Emulation.setDeviceMetricsOverride", {
    width, height, deviceScaleFactor: 1, mobile: width < 700,
  });
  await page.send("Emulation.setEmulatedMedia", {
    features: [
      { name: "prefers-color-scheme", value: theme },
      { name: "prefers-reduced-motion", value: motion },
    ],
  });
}

async function evaluate(page, expression) {
  const result = await page.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (result.exceptionDetails) {
    const d = result.exceptionDetails;
    throw new Error(d.exception?.description || d.text || "evaluation failed");
  }
  return result.result?.value;
}

async function navigate(page, url) {
  const loaded = page.once("Page.loadEventFired");
  await page.send("Page.navigate", { url });
  await loaded;
}

async function waitForCrystal(page) {
  await waitFor(() => evaluate(page, `
    window.__spatialScene?.manifest?.title === "Crystal City of Light and Wonder" &&
    document.querySelector("#sp-verdict")?.textContent === "MATCH"
  `), 60000, "Crystal City render");
  await evaluate(page, `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
}

async function saveCanvas(page, path) {
  const dataUrl = await evaluate(page, `document.querySelector("#studio-canvas").toDataURL("image/png")`);
  writeFileSync(path, Buffer.from(dataUrl.split(",")[1], "base64"));
}

async function saveViewport(page, path) {
  const shot = await page.send("Page.captureScreenshot", { format: "png", fromSurface: true });
  writeFileSync(path, Buffer.from(shot.data, "base64"));
}

async function sample(page, key) {
  return evaluate(page, `
    (() => {
      const c = document.querySelector("#studio-canvas");
      const w = 160, h = 200;
      const t = document.createElement("canvas");
      t.width = w; t.height = h;
      const x = t.getContext("2d", { willReadFrequently: true });
      x.drawImage(c, 0, 0, w, h);
      const data = x.getImageData(0, 0, w, h).data;
      window.__spatialDepthProbe = window.__spatialDepthProbe || {};
      window.__spatialDepthProbe[key] = Array.from(data);
      let lit = 0, sum = 0, hash = 2166136261;
      for (let i = 0; i < data.length; i += 4) {
        const l = (data[i] + data[i + 1] + data[i + 2]) / 3;
        if (l > 8) lit += 1;
        sum += l;
        hash ^= data[i]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= data[i + 1]; hash = Math.imul(hash, 16777619) >>> 0;
        hash ^= data[i + 2]; hash = Math.imul(hash, 16777619) >>> 0;
      }
      return { litRatio: lit / (w * h), mean: sum / (w * h), hash };
    })()
  `.replaceAll("key", JSON.stringify(key)));
}

async function diff(page, a, b) {
  return evaluate(page, `
    (() => {
      const a = window.__spatialDepthProbe[${JSON.stringify(a)}];
      const b = window.__spatialDepthProbe[${JSON.stringify(b)}];
      let sum = 0, max = 0, changed = 0, n = 0;
      for (let i = 0; i < a.length; i += 4) {
        const d = Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
        sum += d / 3; max = Math.max(max, d / 3); n += 1;
        if (d / 3 > 1.5) changed += 1;
      }
      return { meanAbs: sum / n, maxAbs: max, changedRatio: changed / n };
    })()
  `);
}

async function setSlider(page, selector, value) {
  await evaluate(page, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      el.value = ${JSON.stringify(String(value))};
      el.dispatchEvent(new Event("input", { bubbles: true }));
    })()
  `);
  await evaluate(page, `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
}

async function click(page, selector) {
  await evaluate(page, `document.querySelector(${JSON.stringify(selector)}).click()`);
  await evaluate(page, `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
}

async function hittable(page, selector) {
  await evaluate(page, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" });
    })()
  `);
  await evaluate(page, `new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))`);
  return evaluate(page, `
    (() => {
      const el = document.querySelector(${JSON.stringify(selector)});
      const r = el.getBoundingClientRect();
      const x = Math.min(innerWidth - 1, Math.max(1, r.left + r.width / 2));
      const y = Math.min(innerHeight - 1, Math.max(1, r.top + r.height / 2));
      const hit = document.elementFromPoint(x, y);
      return { ok: !!hit && el.contains(hit), selector: ${JSON.stringify(selector)}, rect: { left: r.left, top: r.top, width: r.width, height: r.height }, hit: hit ? (hit.id || hit.className || hit.tagName) : null };
    })()
  `);
}

(async () => {
  mkdirSync(out, { recursive: true });
  const run = await startBrowser();
  const { page, chrome, profile } = run;
  try {
    for (const theme of ["dark", "light"]) {
      await setViewport(page, 1280, 900, theme, "reduce");
      await navigate(page, `${base}/studio.html?source=spatial&world=crystal-city`);
      await waitForCrystal(page);
      const layout = await evaluate(page, `
        ({
          overflow: document.documentElement.scrollWidth > innerWidth + 1,
          crystalVisible: !document.querySelector("#sp-crystal-block").hidden,
          reduced: window.__spatialScene.animating === false
        })
      `);
      assert.deepEqual(layout, { overflow: false, crystalVisible: true, reduced: true }, `${theme} Crystal City layout`);
      await saveCanvas(page, `${out}/crystal-${theme}-default.png`);
      await saveViewport(page, `${out}/crystal-${theme}-studio.png`);
    }

    await setViewport(page, 1280, 900, "dark", "reduce");
    await navigate(page, `${base}/studio.html?source=spatial&world=crystal-city`);
    await waitForCrystal(page);
    await setSlider(page, "#sp-depth-detail", 0);
    const zero = await sample(page, "zero");
    await saveCanvas(page, `${out}/crystal-depth-0.png`);
    await setSlider(page, "#sp-depth-detail", .45);
    const medium = await sample(page, "medium");
    await saveCanvas(page, `${out}/crystal-depth-default.png`);
    await setSlider(page, "#sp-depth-detail", .92);
    const high = await sample(page, "high");
    await saveCanvas(page, `${out}/crystal-depth-high.png`);
    const mediumDiff = await diff(page, "zero", "medium");
    const highDiff = await diff(page, "zero", "high");
    const depthMetrics = { zero, medium, high, mediumDiff, highDiff };
    console.log(JSON.stringify(depthMetrics, null, 2));
    assert(zero.litRatio > .05 && medium.litRatio > .05 && high.litRatio > .05, "depth frames must be nonblank");
    // Tolerant floors below the visually reviewed 4.05/61.7% and 7.98/73.8%
    // envelopes. A merely different PNG or near-invisible cue must not pass.
    assert(mediumDiff.meanAbs > 3.0 && mediumDiff.changedRatio > .45, "default depth detail must retain the reviewed perceptible cue");
    assert(highDiff.meanAbs > 6.0 && highDiff.changedRatio > .60 && highDiff.changedRatio > mediumDiff.changedRatio, "high depth detail must retain a materially stronger cue than the default");

    await setSlider(page, "#sp-depth-detail", .82);
    await setSlider(page, "#sp-atmo-density", 1.35);
    await setSlider(page, "#sp-haze-opacity", .55);
    await setSlider(page, "#sp-sky-curve", .7);
    await setSlider(page, "#sp-beam-flow", 1.2);
    await setSlider(page, "#sp-bokeh-scale", 2.2);
    await click(page, '[data-crystal-material-focus="0"]');
    await sample(page, "all-particles");
    await click(page, '[data-crystal-material-focus="2"]');
    await sample(page, "beam-water");
    const focusDiff = await diff(page, "all-particles", "beam-water");
    assert(focusDiff.meanAbs > 3.0 && focusDiff.changedRatio > .10, "particle focus must retain a meaningful visible change in point material");
    await saveCanvas(page, `${out}/crystal-particles-beam-water.png`);

    await click(page, "#sp-copy-view");
    const shared = await evaluate(page, `document.querySelector("#sp-view-url").value`);
    await navigate(page, shared);
    await waitForCrystal(page);
    const restored = await evaluate(page, `
      ({
        controls: window.__spatialScene.receipt().controls,
        depthValue: document.querySelector("#sp-depth-detail").value,
        focusActive: document.querySelector('[data-crystal-material-focus="2"]').classList.contains("active")
      })
    `);
    assert.equal(restored.controls.depthDetail, .82);
    assert.equal(restored.controls.materialFocus, 2);
    assert.equal(restored.controls.atmosphereDensity, 1.35);
    assert.equal(restored.controls.hazeOpacity, .55);
    assert.equal(restored.controls.skyCurve, .7);
    assert.equal(restored.controls.beamFlow, 1.2);
    assert.equal(restored.controls.bokehScale, 2.2);
    assert.equal(restored.depthValue, "0.82");
    assert.equal(restored.focusActive, true);

    const oldView = {
      version: 1,
      world: "crystal-city",
      scene: null,
      paused: false,
      mode: 0,
      camera: { x: 0, y: 0, z: 0 },
      controls: { parallax: .7, atmosphereFlow: .28, glow: .52, waterFlow: .2, skyCurve: .24, atmosphereDensity: .88, hazeOpacity: .34, bokehScale: 1.05, beamFlow: .36 },
      compare: { mode: "off", mix: .5 },
    };
    await navigate(page, `${base}/studio.html?source=spatial&world=crystal-city&view=${encodeURIComponent(JSON.stringify(oldView))}`);
    await waitForCrystal(page);
    const oldRestored = await evaluate(page, `window.__spatialScene.receipt().controls`);
    assert.equal(oldRestored.depthDetail, .45);
    assert.equal(oldRestored.materialFocus, 0);

    oldView.controls.depthDetail = 2;
    await navigate(page, `${base}/studio.html?source=spatial&world=crystal-city&view=${encodeURIComponent(JSON.stringify(oldView))}`);
    await waitForCrystal(page);
    assert(await evaluate(page, `/unsupported/i.test(document.querySelector("#sp-view-status").textContent)`));

    await setViewport(page, 375, 900, "dark", "reduce");
    await navigate(page, `${base}/studio.html?source=spatial&world=crystal-city`);
    await waitForCrystal(page);
    const hits = [];
    for (const selector of ["#sp-depth-detail", "#sp-bokeh-scale", '[data-crystal-material-focus="3"]', "#sp-copy-view"]) {
      hits.push(await hittable(page, selector));
    }
    const mobile = await evaluate(page, `({ overflow: document.documentElement.scrollWidth > innerWidth + 1 })`);
    assert.equal(mobile.overflow, false, "mobile spatial controls must not overflow horizontally");
    assert.deepEqual(hits.map((h) => h.ok), [true, true, true, true], `mobile controls must be hittable: ${JSON.stringify(hits)}`);
    await saveCanvas(page, `${out}/crystal-mobile-dark.png`);
    await saveViewport(page, `${out}/crystal-mobile-controls.png`);

    assert.deepEqual(page.errors, []);
    console.log(JSON.stringify({ ...depthMetrics, focusDiff }, null, 2));
    console.log(`PASS: Crystal City depth detail, particle focus, share-link restore, themes, reduced motion, and mobile controls verified. Screenshots in ${out}`);
  } finally {
    page.close();
    chrome.kill();
    try { rmSync(profile, { recursive: true, force: true }); } catch (_) {}
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
