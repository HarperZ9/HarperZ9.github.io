#!/usr/bin/env node
// Count which pages load which tools, and write the census the bench reads.
//
//   node scripts/surface-census.mjs [--root DIR] [--write] [--table]
//
// A tool folder is a second-level folder under world/ or system/. Two counts per folder:
//   direct  pages outside the folder whose own markup names a script or module in it
//   reach   pages outside the folder that load it at all: through their scripts' imports, followed to the end,
//           and through surfaces mounted from world/site/surfaces/registry.mjs (by markup or by a mount call)
// --write saves world/site/surfaces/uses.json: every page that mounts a registry surface, with its surfaces and
// element ids, and both counts per tool folder. The file carries no date, so the same tree gives the same bytes.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const args = process.argv.slice(2), opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const site = path.resolve(opt("--root") || path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: site, maxBuffer: 1 << 28 }).toString().split("\0").filter(Boolean);
const files = new Set(tracked), read = (p) => readFileSync(path.join(site, p), "utf8");
const toolOf = (p) => { const m = p.match(/^(world|system)\/([^/]+)\//); return m ? `${m[1]}/${m[2]}` : null; };
const clean = (u) => u.split(/[?#]/)[0];
const resolve = (from, spec) => {
  const s = clean(spec); if (/^[a-z]+:/i.test(s) || s.startsWith("//")) return null;
  const p = s.startsWith("/") ? s.slice(1) : path.posix.normalize(path.posix.join(path.posix.dirname(from), s));
  return files.has(p) ? p : null;
};

// the registry, if this tree has one: surface id -> the module file behind it and the tools it declares
let surfaces = {};
const regFile = path.join(site, "world/site/surfaces/registry.mjs");
if (existsSync(regFile)) {
  const reg = (await import(pathToFileURL(regFile).href)).default, src = readFileSync(regFile, "utf8");
  for (const s of Object.values(reg.SURFACES)) {
    const m = src.match(new RegExp(`S\\('${s.id}'[^\\n]*'(\\./[\\w.-]+)'\\)`));
    surfaces[s.id] = { tools: s.tools, file: m ? path.posix.normalize(path.posix.join("world/site/surfaces", m[1])) : null };
  }
}
const MOUNT = /\bmount\(\s*[^,()]*(?:\([^()]*\))?[^,()]*,\s*["'](\w+)["']/g;
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["']([^"']+\.m?js(?:\?[^"']*)?)["']/g;
const seen = new Map();
// every file a module reaches: its imports, and the surfaces it mounts by name
function reach(file) {
  if (seen.has(file)) return seen.get(file);
  const out = new Set([file]); seen.set(file, out);
  let src = ""; try { src = read(file); } catch { return out; }
  for (const m of src.matchAll(IMPORT)) { const t = resolve(file, m[1]); if (t) for (const x of reach(t)) out.add(x); }
  if (file.startsWith("world/site/surfaces/")) for (const m of src.matchAll(MOUNT)) { const f = surfaces[m[1]]?.file; if (f && files.has(f)) for (const x of reach(f)) out.add(x); }
  return out;
}

const direct = {}, reached = {}, pages = [];
const bump = (o, k, p) => { (o[k] ??= new Set()).add(p); };
for (const page of tracked.filter((f) => f.endsWith(".html"))) {
  const html = read(page), own = toolOf(page), roots = new Set(), named = new Set();
  for (const m of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+\.m?js(?:\?[^"']*)?)["']/g)) { const t = resolve(page, m[1]); if (t) roots.add(t); }
  for (const m of html.matchAll(IMPORT)) { const t = resolve(page, m[1]); if (t) roots.add(t); }
  for (const t of roots) { const k = toolOf(t); if (k && k !== own) bump(direct, k, page); }
  const all = new Set();
  for (const t of roots) for (const x of reach(t)) all.add(x);
  for (const m of html.matchAll(/data-surface="([^"]+)"/g)) for (const n of m[1].split(/\s+/)) if (surfaces[n]) named.add(n);
  for (const m of html.matchAll(MOUNT)) if (surfaces[m[1]]) named.add(m[1]);
  for (const n of named) { const f = surfaces[n].file; if (f && files.has(f)) for (const x of reach(f)) all.add(x); }
  for (const x of all) { const k = toolOf(x); if (k && k !== own) bump(reached, k, page); }
  if (named.size) {
    const ids = [...html.matchAll(/data-elements="([^"]+)"/g)].flatMap((m) => m[1].split(/[\s,]+/)).filter(Boolean);
    // the bench shows every element; a page that only embeds surfaces uses the ones it names
    pages.push({ path: page, title: (html.match(/<title>([^<|]*)/)?.[1] || page).trim(), surfaces: [...named].sort(), elements: [...new Set(ids)], all: named.has("bench") });
  }
}
const folders = [...new Set(tracked.map(toolOf).filter(Boolean))].sort();
const tools = Object.fromEntries(folders.map((f) => [f, { direct: direct[f]?.size ?? 0, reach: reached[f]?.size ?? 0 }]));
if (args.includes("--table")) {
  console.log("| Tool folder | Pages naming it directly | Pages reaching it |\n|---|---|---|");
  for (const f of folders) console.log(`| ${f} | ${tools[f].direct} | ${tools[f].reach} |`);
} else console.log(JSON.stringify({ pages: pages.length, unreached: folders.filter((f) => !tools[f].reach).length, folders: folders.length }));
if (args.includes("--write")) {
  const doc = { format: "surfaces.uses/1", from: "scripts/surface-census.mjs", pages: pages.filter((p) => !p.all).map(({ all, ...p }) => p), benches: pages.filter((p) => p.all).map((p) => p.path), tools };
  writeFileSync(path.join(site, "world/site/surfaces/uses.json"), JSON.stringify(doc, null, 1) + "\n");
}
