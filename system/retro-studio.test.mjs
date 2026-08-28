import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const PUBLIC_ROOT = resolve(ROOT, "public");
const DEFAULT_CHROME_PARTS = ["C:", "Program Files", "Google", "Chrome", "Application", "chrome.exe"];
const CHROME = process.env.CHROME_PATH || DEFAULT_CHROME_PARTS.join("\\");

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
window.__retroShareHarness = { calls: [], errors: [] };
const originalReplaceState = window.history.replaceState.bind(window.history);
window.history.replaceState = function(state, title, url) {
  window.__retroShareHarness.calls.push(String(url));
  return originalReplaceState(state, title, url);
};
window.addEventListener("error", (event) => {
  window.__retroShareHarness.errors.push(String(event.error && event.error.message || event.message || event.type));
});
window.addEventListener("unhandledrejection", (event) => {
  window.__retroShareHarness.errors.push(String(event.reason && event.reason.message || event.reason || event.type));
  event.preventDefault();
});
</script>
<script type="module">
const settle = () => new Promise((resolve) => setTimeout(resolve, 900));
window.addEventListener("load", async () => {
  await settle();
  const code = document.getElementById("re-code");
  if (code) code.value = "void mainImage(out vec4 fragColor, in vec2 fragCoord){ fragColor=vec4(1.0); }";
  for (const id of ["re-share", "re-share-patch"]) {
    const button = document.getElementById(id);
    if (!button) {
      window.__retroShareHarness.errors.push("missing " + id);
      continue;
    }
    button.click();
    await settle();
  }
  const result = document.createElement("pre");
  result.id = "share-result";
  result.textContent = JSON.stringify(window.__retroShareHarness);
  document.body.appendChild(result);
});
</script>`;
  return source.replace("</body>", `${harness}</body>`);
}

async function startServer() {
  const server = createServer(async (request, response) => {
    const requestUrl = new URL(request.url || "/", "http://127.0.0.1");
    const pathname = decodeURIComponent(requestUrl.pathname);
    try {
      if (pathname === "/retro-share-test.html") {
        const html = await readFile(resolve(PUBLIC_ROOT, "retro.html"), "utf8");
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
      "--virtual-time-budget=7000",
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

test("retro share buttons use browser history without undo-state shadowing", async (t) => {
  if (!existsSync(CHROME)) t.skip(`Chrome executable not found: ${CHROME}`);

  const { server, origin } = await startServer();
  try {
    const dom = await dumpPage(`${origin}/retro-share-test.html`);
    const match = dom.match(/<pre id="share-result">([^<]+)<\/pre>/);
    assert.ok(match, dom.slice(-2000));
    const result = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&"));

    assert.deepEqual(result.errors, []);
    assert.equal(result.calls.length, 2);
    assert.match(result.calls[0], /\/retro-share-test\.html#s=/);
    assert.match(result.calls[1], /\/retro-share-test\.html#p=/);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
  }
});
