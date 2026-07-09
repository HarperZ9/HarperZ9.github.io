// Deploy the built home into the site root: dist/index.html becomes
// /index.html and dist/assets/* replaces /assets/*. Run `npm run build`
// first (or `npm run deploy`, which chains both).
import { cpSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(here, "dist");
const root = path.dirname(here);

if (!existsSync(path.join(dist, "index.html"))) {
  console.error("home/dist/index.html missing - run `npm run build` first.");
  process.exit(1);
}

const assetsDir = path.join(root, "assets");
if (existsSync(assetsDir)) {
  for (const f of readdirSync(assetsDir)) rmSync(path.join(assetsDir, f), { recursive: true, force: true });
} else {
  mkdirSync(assetsDir);
}
cpSync(path.join(dist, "assets"), assetsDir, { recursive: true });
cpSync(path.join(dist, "index.html"), path.join(root, "index.html"));
console.log("deployed: index.html +", readdirSync(assetsDir).join(", "));
