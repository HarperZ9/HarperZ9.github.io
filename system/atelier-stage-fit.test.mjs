// The Atelier plate has to fill the stage it is given.
//
// It did not, and the reason was a fixed point rather than a wrong number. `.viewport-stage canvas`
// carries width:auto/height:auto, so a canvas's LAYOUT box follows its own width/height attributes.
// atelier.js sized its backing store from the canvas's own bounding rect, which measured whatever it
// had last been set to: the 360 written in studio.html, forever. max-width/max-height:100% let that
// square SHRINK on a narrow screen, so the defect was invisible below 360 and permanent above it. On
// a 1440-wide desktop the plate sat as a 360 square adrift in a 749x448 stage.
//
// A unit test cannot reach this. atelier.js is a classic IIFE with no exports, and the bug lives in
// the loop between CSS and the DOM rather than in any function's arithmetic: every pure part of the
// Atelier (the stroke geometry, the witness hash, the SVG export) works in a normalised unit square
// and is indifferent to canvas size. So this drives a real browser at a real viewport, the same way
// retro-studio.test.mjs does, and asserts the four facts a re-broken sizeCanvas would violate.
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_ROOT = existsSync(resolve(ROOT, "studio.html")) ? ROOT : resolve(ROOT, "public");
const DEFAULT_CHROME_PARTS = ["C:", "Program Files", "Google", "Chrome", "Application", "chrome.exe"];
const CHROME = process.env.CHROME_PATH || DEFAULT_CHROME_PARTS.join("\\");

// Wide enough that the stage's short axis clears the 360 in the markup. Below that the old code and
// the new code agree, because max-height:100% was already shrinking the square, so a smaller window
// would pass against the bug.
const WINDOW = "1440,1000";

function contentType(filePath) {
  switch (extname(filePath).toLowerCase()) {
    case ".html": return "text/html; charset=utf-8";
    case ".css": return "text/css; charset=utf-8";
    case ".js":
    case ".mjs": return "text/javascript; charset=utf-8";
    case ".png": return "image/png";
    case ".svg": return "image/svg+xml";
    case ".ttf": return "font/ttf";
    case ".woff": return "font/woff";
    case ".woff2": return "font/woff2";
    default: return "application/octet-stream";
  }
}

function harnessHtml(source) {
  const harness = `
<script>
window.__atelierFit = { errors: [] };
window.addEventListener("error", (event) => {
  window.__atelierFit.errors.push(String(event.error && event.error.message || event.message || event.type));
});
</script>
<script>
window.addEventListener("load", () => {
  setTimeout(() => {
    const canvas = document.getElementById("studio-canvas");
    const stage = canvas && canvas.parentElement;
    const box = canvas && canvas.getBoundingClientRect();
    Object.assign(window.__atelierFit, {
      dpr: Math.min(2, window.devicePixelRatio || 1),
      backing: canvas ? [canvas.width, canvas.height] : null,
      css: box ? [Math.round(box.width), Math.round(box.height)] : null,
      stage: stage ? [stage.clientWidth, stage.clientHeight] : null,
      stageClass: stage ? stage.className : null,
    });
    const result = document.createElement("pre");
    result.id = "fit-result";
    result.textContent = JSON.stringify(window.__atelierFit);
    document.body.appendChild(result);
  }, 1200);
});
</script>`;
  return source.replace("</body>", `${harness}</body>`);
}

async function startServer() {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    try {
      if (pathname === "/atelier-fit-test.html") {
        const html = await readFile(resolve(PUBLIC_ROOT, "studio.html"), "utf8");
        response.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
        response.end(harnessHtml(html));
        return;
      }
      const relative = pathname.replace(/^\/+/, "") || "index.html";
      const filePath = resolve(PUBLIC_ROOT, relative);
      if (filePath !== PUBLIC_ROOT && !filePath.startsWith(`${PUBLIC_ROOT}${sep}`)) {
        response.writeHead(403).end("Forbidden");
        return;
      }
      const payload = await readFile(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(payload);
    } catch {
      response.writeHead(404).end("Not found");
    }
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  return { server, origin: `http://127.0.0.1:${address.port}` };
}

function dumpPage(url) {
  return new Promise((resolveDump, reject) => {
    const child = spawn(CHROME, [
      "--headless=new",
      "--disable-background-networking",
      "--disable-default-apps",
      "--disable-extensions",
      "--disable-gpu",
      "--no-first-run",
      `--window-size=${WINDOW}`,
      "--virtual-time-budget=9000",
      "--dump-dom",
      url,
    ], { stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("error", reject);
    child.once("exit", (code) => {
      if (code !== 0) reject(new Error(`Chrome exited ${code}: ${stderr.trim()}`));
      else resolveDump(stdout);
    });
  });
}

test("the Atelier plate fills the short axis of its stage", async (t) => {
  if (!existsSync(CHROME)) t.skip(`Chrome executable not found: ${CHROME}`);

  // From the FILE, not from the DOM: canvas.width reflects into the attribute, so by the time the
  // harness runs, getAttribute("width") reads back whatever sizeCanvas last wrote.
  const markup = Number((await readFile(resolve(PUBLIC_ROOT, "studio.html"), "utf8"))
    .match(/<canvas[^>]*id="studio-canvas"[^>]*\swidth="(\d+)"/)?.[1] || 0);
  assert.ok(markup > 0, "could not read the studio-canvas width attribute from studio.html");

  const { server, origin } = await startServer();
  let fit;
  try {
    const dom = await dumpPage(`${origin}/atelier-fit-test.html`);
    const match = dom.match(/<pre id="fit-result">([^<]+)<\/pre>/);
    assert.ok(match, dom.slice(-2000));
    fit = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }

  const where = JSON.stringify(fit);
  assert.ok(fit.stage && fit.backing && fit.css, where);
  assert.match(fit.stageClass || "", /viewport-stage/, where);

  const side = Math.min(fit.stage[0], fit.stage[1]);

  // 1. Square. The drawing is square (drawStrokes fits every study into min(W,H)), so a canvas wider
  //    than it is tall would only add black margin the stage already paints, and pointer-play would
  //    spawn particles across a band with no art under it.
  assert.equal(fit.backing[0], fit.backing[1], `backing is not square: ${where}`);

  // 2. Sized to the STAGE, not to itself. This is the assertion the old code failed.
  assert.equal(fit.backing[0], Math.round(side) * fit.dpr, `backing does not match the stage: ${where}`);

  // 3. One backing pixel per display pixel. clientWidth rather than the bounding rect, because the
  //    stage carries a 1px border and a backing sized to the border box is resampled on the way to
  //    screen.
  assert.equal(fit.css[0], Math.round(side), `css box does not match the stage: ${where}`);

  // 4. It actually grew past the attribute in the markup. Without this the first three assertions
  //    still pass on a viewport where the stage happens to be 360, which is how the bug hid.
  assert.ok(side > markup, `stage short axis ${side} did not exceed the ${markup} in studio.html: ${where}`);
});
