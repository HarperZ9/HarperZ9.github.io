// Render the crossover stills and the six marks in a real GPU Chrome, and encode the site's copies.
// node tools/crossover/render.mjs [--marks] [--stills] [--out DIR]
// Needs Playwright (with Chrome) on the machine, or PLAYWRIGHT_DIR pointing at one; serves this repository on a local port while it runs.
// Stills: 3840 x 2160 PNG masters into DIR (default: the system temp folder), and the two plates for
// glass-water.html into media/world/crossover/. Marks: 720 x 720 masters of the glass lit
// from behind, then AVIF and WebP at 256 px with the light carried as alpha, into media/world/marks/.
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";
// Playwright from this repository's modules, or from the folder named in PLAYWRIGHT_DIR
const { chromium } = await import("playwright").catch(() => {
  if (!process.env.PLAYWRIGHT_DIR) throw new Error("crossover render: install playwright or set PLAYWRIGHT_DIR to a node_modules/playwright folder");
  return import(pathToFileURL(path.join(process.env.PLAYWRIGHT_DIR, "index.mjs")).href);
});

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const args = process.argv.slice(2), has = (f) => args.includes(f);
const OUT = args.includes("--out") ? path.resolve(args[args.indexOf("--out") + 1]) : path.join(os.tmpdir(), "crossover-stills");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".mjs": "text/javascript", ".png": "image/png", ".json": "application/json" };
const server = createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(new URL(req.url, "http://x").pathname));
  if (!f.startsWith(ROOT) || !existsSync(f) || statSync(f).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "Content-Type": TYPES[path.extname(f)] || "application/octet-stream" }); res.end(readFileSync(f));
}).listen(0, "127.0.0.1");
const port = await new Promise((ok) => server.on("listening", () => ok(server.address().port)));
const browser = await chromium.launch({ channel: "chrome", args: ["--ignore-gpu-blocklist", "--enable-gpu"] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
page.on("console", (m) => { if (m.type() === "error") console.error("page:", m.text()); });

async function still(query, file) {
  await page.goto(`http://127.0.0.1:${port}/tools/crossover/still.html?${query}`);
  await page.waitForFunction(() => window.__done === true, null, { timeout: 1800000, polling: 1000 });
  const err = await page.evaluate(() => window.__err);
  if (err) throw new Error(`crossover still ${query}: ${err}`);
  const data = await page.evaluate(() => document.getElementById("c").toDataURL("image/png"));
  writeFileSync(file, Buffer.from(data.split(",")[1], "base64"));
  console.log("wrote", file);
}

try {
  mkdirSync(OUT, { recursive: true });
  if (has("--stills") || !has("--marks")) {
    for (const [q, n] of [["scene=overprint&lighting=reflect&n=16", "overprint-day"], ["scene=mie&lighting=backlit&n=8", "mie-night"],
      ["scene=mie&lighting=reflect&n=8", "mie-day"], ["scene=marks&lighting=reflect&n=16", "marks-day"], ["scene=marks&lighting=backlit&n=16", "marks-night"],
      ["scene=michel&lighting=backlit&n=8", "michel-levy"], ["scene=cleavage&lighting=reflect&n=16", "cleavage"]])
      await still(`${q}&w=3840&h=2160`, path.join(OUT, `${n}.png`));
    const plates = path.join(ROOT, "media/world/crossover"); mkdirSync(plates, { recursive: true });
    for (const n of ["overprint-day", "mie-night"]) // the two shown on glass-water.html
      execFileSync("python", ["-I", path.join(ROOT, "tools/crossover/encode_plate.py"), path.join(OUT, `${n}.png`), path.join(plates, n)], { stdio: "inherit" });
  }
  if (has("--marks")) {
    const dest = path.join(ROOT, "media/world/marks"); mkdirSync(dest, { recursive: true });
    for (const m of ["THEFLYWHEEL", "THECMMNS", "THEPLYGRND", "ARTIQL8", "BLDLNG", "RSRCH"]) {
      const master = path.join(OUT, `${m}-night.png`);
      await still(`scene=mark:${m}&lighting=backlit&ground=black&n=16&w=720&h=720`, master);
      execFileSync("python", ["-I", path.join(ROOT, "tools/crossover/encode_mark.py"), master, path.join(dest, m.toLowerCase())], { stdio: "inherit" });
    }
  }
} finally { await browser.close(); server.close(); }
