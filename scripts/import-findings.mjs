#!/usr/bin/env node
// Bring the findings write-ups from the workshop into findings/src/, ready for scripts/build-findings.mjs.
//
//   node scripts/import-findings.mjs --src <folder of write-ups>   (or FINDINGS_SRC=<folder>)
//
// Each write-up is one Markdown file with a front block (id, slug, title, tier, fields, date_found, standfirst,
// status, figure, data, internal_evidence) and nine sections. The import drops internal_evidence (the workshop's
// own file list), skips any piece marked status: drop, and refuses a piece whose public text names a local path,
// carries an em or en dash, or lacks a section. A refused piece stops the import, so nothing half-checked lands.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SRC = arg("--src") ?? process.env.FINDINGS_SRC;
if (!SRC || !existsSync(SRC)) { console.error("pass --src <folder of write-ups> (or set FINDINGS_SRC)"); process.exit(2); }
const OUT = path.join(site, "findings/src");

export const SECTIONS = ["What it means", "The question", "How we tested it", "Controls and planted checks", "Result", "Limits", "Verified", "Reproduce", "Sources"];
// a drive path (C:\ or C:/, never the "s:/" inside https://), a home folder, a UNC path or a workshop folder name
const LOCAL = /(?<![A-Za-z])[A-Za-z]:[\\/](?![\\/])|\/Users\/|\\\\|mission-control|\.scratch/;
const DASH = /[–—]/;

const problems = [];
const kept = [];
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (f.endsWith(".md")) rmSync(path.join(OUT, f));
for (const name of readdirSync(SRC).filter((f) => /^F\d+-.+\.md$/.test(f)).sort()) {
  const text = readFileSync(path.join(SRC, name), "utf8").replace(/\r/g, "");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) { problems.push(`${name}: no front block`); continue; }
  const front = m[1].split("\n").filter((l) => !l.startsWith("internal_evidence:")).join("\n");
  const status = (front.match(/^status:\s*(\S+)/m) || [])[1];
  if (status === "drop") continue;
  const out = `---\n${front}\n---\n${m[2].trim()}\n`;
  if (LOCAL.test(out)) problems.push(`${name}: names a local path`);
  if (DASH.test(out)) problems.push(`${name}: em or en dash`);
  for (const s of SECTIONS) if (!new RegExp(`^## ${s}$`, "m").test(m[2])) problems.push(`${name}: no "## ${s}" section`);
  kept.push([name, out]);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
for (const [name, out] of kept) writeFileSync(path.join(OUT, name), out);
console.log(`findings: ${kept.length} write-ups imported into findings/src`);
