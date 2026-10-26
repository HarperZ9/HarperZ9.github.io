// A static server for the demo, standard library only: node demo/serve.mjs [port]
// Serves the lib/ folder on 127.0.0.1 so the page can import ../*.mjs as modules.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const port = Number(process.argv[2] || 8794);
const TYPES = {
  ".html": "text/html; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".json": "application/json",
};

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path === "/" || path === "/demo") { res.writeHead(302, { location: "/demo/" }).end(); return; }
  const file = normalize(join(root, path.endsWith("/") ? path + "index.html" : path));
  if (!file.startsWith(root) && file + sep !== root) { res.writeHead(403).end(); return; }
  try {
    const body = await readFile(file);
    res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch (err) {
    console.error(`serve: ${path}: ${err.code || err.message}`);
    res.writeHead(404).end("not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`substrate demo on http://127.0.0.1:${port}/`));
