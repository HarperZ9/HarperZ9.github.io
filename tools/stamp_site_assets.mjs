import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SITE_ASSET_REVISION = "20260828-site-design";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(toolsDir);
const excludedDirectories = new Set([".git", "node_modules", "dist"]);
const assetAttribute = /((?:href|src)=["'])([^"'#]+?\.(?:css|js))(?:\?[^"']*)?(["'])/g;
const immutableBundle = /(?:^|\/)assets\/[^/?]+-[A-Za-z0-9_-]{8,}\.(?:css|js)$/;

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".html")) files.push(absolute);
  }
  return files;
}

function stamp(source) {
  return source.replace(assetAttribute, (match, prefix, target, suffix) => {
    if (/^(?:https?:)?\/\//.test(target) || immutableBundle.test(target)) return match;
    return `${prefix}${target}?v=${SITE_ASSET_REVISION}${suffix}`;
  });
}

let changed = 0;
for (const file of await htmlFiles(root)) {
  const before = await readFile(file, "utf8");
  const after = stamp(before);
  if (after === before) continue;
  await writeFile(file, after, "utf8");
  changed += 1;
}

console.log(`stamped ${changed} HTML files with ${SITE_ASSET_REVISION}`);
