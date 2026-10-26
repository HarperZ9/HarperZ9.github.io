#!/usr/bin/env node
// Import the creative and tool work from the mission-control workspace into world/.
//
//   node scripts/import-mission-control.mjs [--src WORKSHOP]   (or MISSION_CONTROL=WORKSHOP) [--dry]
//
// What it does, in order:
//   1. Starts from the entry files and folders in import-mission-control.config.json.
//   2. Follows every reference it can read (HTML src/href, CSS url() and @import, ES imports, new URL(),
//      fetch() and quoted file paths in JS and JSON) and copies each file it reaches. Nothing else is copied.
//   3. Renames each dated source folder to its short name, in the path and inside every copied text file,
//      so the relative links between folders keep working.
//   4. Applies the site switches: the type rule, retired faces dropped, root-relative site links.
//   5. Refuses to finish if a copied text file still carries a local drive path, and writes world/IMPORT.json:
//      for each file its source folder, source path, bytes and SHA-256, so every byte has its origin.
// The Accession release and the element table's reference thumbnails are handled in import-extras.mjs.
// The source folders are never written. Run it again after the source agents improve their pieces.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rewriteText, findLocalPaths, discoverySet } from "./import-rewrite.mjs";
import { referencesOf } from "./import-refs.mjs";
import { syncAccession, elementThumbs, pruneLands } from "./import-extras.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.dirname(here);
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SRC = path.resolve(arg("--src", null) ?? process.env.MISSION_CONTROL ?? (console.error("set MISSION_CONTROL to the workshop folder, or pass --src"), process.exit(2)));
const OUT = path.join(site, "world");
const DRY = process.argv.includes("--dry");
const cfg = JSON.parse(readFileSync(path.join(here, "import-mission-control.config.json"), "utf8"));
const TEXT = new Set([".html", ".js", ".mjs", ".css", ".json", ".svg", ".txt", ".glsl", ".wgsl", ".frag", ".vert"]);

const posix = (p) => p.split(path.sep).join("/");
const rel = (abs) => posix(path.relative(SRC, abs));
const topOf = (r) => r.split("/")[0];

function denied(r) {
  if (cfg.allowOut?.some((a) => r.startsWith(a)) && r.includes("/out/")) return cfg.deny.filter((d) => d !== "/out/").some((d) => hit(r, d));
  return cfg.deny.some((d) => hit(r, d));
}
function hit(r, d) { return d.startsWith("/") ? ("/" + r).includes(d) : d.startsWith(".") && !d.includes("/") ? r.endsWith(d) : r.endsWith(d) || r === d; }

// Expand "folder/*.html" and plain entries into files that exist.
function expand(entry) {
  if (!entry.includes("*")) return existsSync(path.join(SRC, entry)) ? [entry] : [];
  const dir = path.posix.dirname(entry), ext = entry.slice(entry.lastIndexOf("*") + 1);
  const abs = path.join(SRC, dir);
  return existsSync(abs) ? readdirSync(abs).filter((f) => f.endsWith(ext)).map((f) => `${dir}/${f}`) : [];
}
function walkDir(r, out = []) {
  const abs = path.join(SRC, r);
  if (!existsSync(abs)) return out;
  for (const f of readdirSync(abs, { withFileTypes: true })) {
    const child = `${r}/${f.name}`;
    if (denied(child + (f.isDirectory() ? "/" : ""))) continue;
    f.isDirectory() ? walkDir(child, out) : out.push(child);
  }
  return out;
}

// Breadth-first crawl from the seeds. Returns the set of reached files and the references that did not resolve.
function crawl(seeds) {
  const seen = new Set(), queue = [...seeds], missing = new Map(), held = new Map();
  while (queue.length) {
    const r = queue.shift();
    if (seen.has(r)) continue;
    const top = topOf(r);
    if (!cfg.folders[top]) { missing.set(r, "outside the published folders"); continue; }
    if (cfg.hold?.[r]) { held.set(r, cfg.hold[r]); continue; }
    if (denied(r)) continue;
    const abs = path.join(SRC, r);
    if (existsSync(abs) && statSync(abs).isDirectory()) { queue.push(...walkDir(r)); seen.add(r); continue; }   // a folder named in code: its modules load by name
    if (!existsSync(abs)) { missing.set(r, "not found"); continue; }
    if (statSync(abs).size > cfg.maxBytes) { missing.set(r, `over ${cfg.maxBytes} bytes`); continue; }
    seen.add(r);
    if (!TEXT.has(path.extname(r))) continue;
    for (const ref of referencesOf(r, readFileSync(abs, "utf8"), SRC)) if (!seen.has(ref)) queue.push(ref);
  }
  const files = [...seen].filter((r) => statSync(path.join(SRC, r)).isFile()).sort();
  return { files, missing, held };
}

// Assets a page names by stem in code ('cajal-purkinje' + size + extension): every file in a stem folder whose
// stem, without a trailing -s and the extension, is quoted in a copied file comes along.
function stemAssets(files) {
  const quoted = new Set();
  for (const r of files) if (TEXT.has(path.extname(r))) for (const m of readFileSync(path.join(SRC, r), "utf8").matchAll(/['"`/]([a-z0-9][a-z0-9_-]{2,60})(?:['"`.$-])/gi)) quoted.add(m[1]);
  const out = [];
  for (const d of cfg.stemDirs || []) {
    const abs = path.join(SRC, d); if (!existsSync(abs)) continue;
    for (const f of readdirSync(abs)) {
      const stem = f.replace(/\.[a-z0-9]+$/i, "").replace(/-s$/, ""), r = `${d}/${f}`;
      if (quoted.has(stem) && statSync(path.join(abs, f)).isFile() && statSync(path.join(abs, f)).size <= cfg.maxBytes && !denied(r)) out.push(r);
    }
  }
  return out;
}

function copyAll(files) {
  const manifest = [], leaks = [];
  for (const r of files) {
    const top = topOf(r), short = cfg.folders[top], dest = path.join(OUT, short, r.slice(top.length + 1));
    let buf = readFileSync(path.join(SRC, r));
    const sha = createHash("sha256").update(buf).digest("hex");
    if (TEXT.has(path.extname(r))) {
      // links to held pieces inside the same folder (scripts resolve hrefs against the page, so match by name)
      const held = Object.keys(cfg.hold || {}).filter((h) => topOf(h) === top).map((h) => path.posix.basename(h));
      let text = rewriteText(buf.toString("utf8"), { folders: cfg.folders, houseType: cfg.houseType, file: r, retiredFaces: cfg.retiredFaces || [], held });
      const sub = `${short}/${r.slice(top.length + 1)}`;
      if (r.endsWith(".html") && /<title>/.test(text)) text = discoverySet(text, `world/${sub}`, cfg.descriptions?.[sub]);
      for (const l of findLocalPaths(text)) leaks.push(`${short}/${r.slice(top.length + 1)}: ${l}`);
      buf = Buffer.from(text, "utf8");
    }
    if (!DRY) { mkdirSync(path.dirname(dest), { recursive: true }); writeFileSync(dest, buf); }
    manifest.push({ path: posix(path.relative(site, dest)), source: r, folder: top, bytes: buf.length, sourceSha256: sha });
  }
  return { manifest, leaks };
}

function main() {
  if (!existsSync(SRC)) { console.error(`import: source ${SRC} not found`); process.exit(2); }
  const seeds = [...cfg.entries.flatMap(expand), ...cfg.dirs.flatMap((d) => walkDir(d)), ...(cfg.optional || []).flatMap((d) => walkDir(d))];
  const first = crawl(seeds), extra = stemAssets(first.files).filter((r) => !first.files.includes(r));
  const { files, missing, held } = extra.length ? crawl([...first.files, ...extra]) : first;
  if (!DRY) for (const short of Object.values(cfg.folders)) rmSync(path.join(OUT, short), { recursive: true, force: true });
  const { manifest, leaks } = copyAll(files);
  if (leaks.length) { console.error(`import: ${leaks.length} local paths would ship:\n  ` + leaks.slice(0, 40).join("\n  ")); process.exit(3); }
  const fonts = syncAccession({ cfg, SRC, site, manifest, dry: DRY });
  console.log(`import: Accession release copied to ${fonts.targets} places; licence text ${fonts.licence ? "present" : "MISSING"}`);
  const thumbs = elementThumbs({ cfg, SRC, OUT, folders: cfg.folders, dry: DRY });
  console.log(`import: ${thumbs.kept} reference thumbnails with credit and link; ${thumbs.withheld.length} withheld`);
  const cleared = pruneLands({ OUT, dry: DRY });
  if (cleared.length) console.log(`import: ${cleared.length} map places lost a held landing page: ${cleared.join(", ")}`);
  const bytes = manifest.reduce((a, m) => a + m.bytes, 0);
  const record = { importedAt: new Date().toISOString(), source: "mission-control workspace (local, not under version control)", folders: cfg.folders,
    held: Object.fromEntries(held), accessionLicence: fonts.licence, thumbnailsWithheld: thumbs.withheld, unresolved: Object.fromEntries([...missing].sort()), files: manifest };
  if (!DRY) writeFileSync(path.join(OUT, "IMPORT.json"), JSON.stringify(record, null, 1) + "\n");
  console.log(`import: ${manifest.length} files, ${(bytes / 1e6).toFixed(1)} MB; ${missing.size} unresolved, ${held.size} held${DRY ? " (dry run)" : ""}`);
  for (const [r, why] of [...missing].slice(0, 60)) console.log(`  unresolved ${r}: ${why}`);
}
main();
