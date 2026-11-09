#!/usr/bin/env node
// Bring each finding's public inputs from the workshop into the site, ready for scripts/record-findings.mjs.
//
//   node scripts/import-findings.mjs --papers <papers folder> --register <PUBLICATION-REGISTER.json>
//
// Per finding (a folder <id>/ with paper.txt): paper.txt, terms.json and the chart figures the paper names go to
// findings/src/<id>/; the typeset PDF, its BuildTeX source <id>.bld and its build receipt go to findings/papers/,
// beside one copy of the shared doc.bld module the source imports. The shared glossary goes to
// findings/data/glossary.json. The register rows for these findings go to findings/data/register.json with the
// workshop's file names taken out. Result files are never copied: the papers carry their numbers, and each paper's
// Verified section says they were re-read from the result files. Period plates are not copied either; the site
// already carries them as media/findings/traxler/*.webp (findings/figures.json maps a finding to its leaf).
// Figures lose their PNG text chunks and PDFs their hidden author fields (scripts/findings-metadata.mjs), as the
// site's publish metadata gate requires. A file whose public text names a local path stops the import.
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { blankPdf, stripPng } from "./findings-metadata.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const PAPERS = arg("--papers") ?? process.env.FINDINGS_PAPERS;
const REGISTER = arg("--register") ?? process.env.FINDINGS_REGISTER;
if (!PAPERS || !existsSync(PAPERS) || !REGISTER || !existsSync(REGISTER)) {
  console.error("pass --papers <papers folder> and --register <PUBLICATION-REGISTER.json>");
  process.exit(2);
}
// a drive path (C:\ or C:/, not the "m:\" of inline maths), a home folder, a UNC path or a workshop folder name
const LOCAL = /(?<![A-Za-z{])[A-Za-z]:[\\/](?![\\/])|\/Users\/|\\\\[A-Za-z]|mission-control|\.scratch/;
const WORKSHOP = /\b\d{4}-\d{2}-\d{2}-[a-z0-9][a-z0-9-]*(?:\/[^\s,;)]*)?/g;
const DASH = /[\u2013\u2014]/;
const SRC = path.join(site, "findings/src"), OUT = path.join(site, "findings/papers"), DATA = path.join(site, "findings/data");

function figuresOf(paper) {
  return [...paper.matchAll(/^!\[fig:\S+[^\]]*\]\(([^)]+)\)/gm)].map((m) => m[1]).filter((f) => !f.startsWith("plate-"));
}

function checkText(name, text, problems) {
  if (LOCAL.test(text)) problems.push(`${name}: names a local path`);
  if (DASH.test(text)) problems.push(`${name}: em or en dash`);
}

// the register row as the site may carry it: no workshop file names, no internal paths
function publicRow(row) {
  const keep = ["f", "tier", "strong_b", "tier_reason", "fields", "reviewer_attack", "raise_tier", "does_not_prove",
    "scorer", "scored_by", "evidence", "literature", "data_licence", "verified_numbers", "corrections", "correction_pass",
    "rung", "ladder", "venue_type"];
  const out = {};
  for (const k of keep) if (row[k] !== undefined && row[k] !== null) out[k] = row[k];
  if (out.evidence && typeof out.evidence === "object") { const { source, ...rest } = out.evidence; out.evidence = rest; }
  else delete out.evidence;
  if (row.publication) out.publication = { date: row.publication.date, wave: row.publication.wave, status: row.publication.status };
  // the author's licence decision travels as its public terms only (the words after the dated quote)
  const ld = row.publication?.licence_decision?.match(/\)\.\s*(.+)$/);
  if (ld) out.licence_terms = ld[1];
  return JSON.parse(JSON.stringify(out), (k, v) => (typeof v === "string" ? v.replace(WORKSHOP, "internal file").replace(/(?:\.\.\/)+internal file/g, "internal file") : v));
}

const problems = [];
const ids = readdirSync(PAPERS).filter((d) => /^F\d+$/.test(d) && existsSync(path.join(PAPERS, d, "paper.txt"))).sort();
const register = JSON.parse(readFileSync(REGISTER, "utf8"));
const rows = Object.fromEntries(register.rows.filter((r) => ids.includes(r.f)).map((r) => [r.f, r]));
const plan = [];
for (const id of ids) {
  const dir = path.join(PAPERS, id), paper = readFileSync(path.join(dir, "paper.txt"), "utf8").replace(/\r/g, "");
  if (!rows[id]) { problems.push(`${id}: no register row`); continue; }
  if (rows[id].publication?.status === "drop") continue;
  checkText(`${id}/paper.txt`, paper, problems);
  const terms = path.join(dir, "terms.json");
  if (existsSync(terms)) checkText(`${id}/terms.json`, readFileSync(terms, "utf8"), problems);
  const files = [["paper.txt", SRC], ...(existsSync(terms) ? [["terms.json", SRC]] : []), ...figuresOf(paper).map((f) => [f, SRC]),
    [`${id}.pdf`, OUT], [`${id}.bld`, OUT], [`${id}.buildtex.json`, OUT]];
  for (const [f] of files) if (!existsSync(path.join(dir, f))) problems.push(`${id}: missing ${f}`);
  checkText(`${id}/${id}.buildtex.json`, readFileSync(path.join(dir, `${id}.buildtex.json`), "utf8"), problems);
  plan.push([id, dir, files]);
}
if (problems.length) { console.error(problems.join("\n")); process.exit(1); }

rmSync(SRC, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true }); mkdirSync(DATA, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(path.join(OUT, f));
const copies = {};
const sha = (b) => createHash("sha256").update(b).digest("hex");
for (const [id, dir, files] of plan) {
  mkdirSync(path.join(SRC, id), { recursive: true });
  for (const [f, to] of files) {
    const dest = path.join(to === SRC ? path.join(SRC, id) : OUT, f), raw = readFileSync(path.join(dir, f));
    if (f.endsWith(".png")) writeFileSync(dest, stripPng(raw));
    else if (f.endsWith(".pdf")) {
      const built = JSON.parse(readFileSync(path.join(dir, `${id}.buildtex.json`), "utf8")).outputs[f];
      if (sha(raw) !== built) { console.error(`${id}: ${f} does not match its build receipt`); process.exit(1); }
      const site = blankPdf(raw);
      writeFileSync(dest, site);
      copies[id] = { built_sha256: built, site_sha256: sha(site), blanked: ["/Author", "/Creator"] };
    } else copyFileSync(path.join(dir, f), dest);
  }
}
writeFileSync(path.join(DATA, "copies.json"), JSON.stringify({ about: "Each PDF as built (its build receipt's hash) and as the site carries it, with author metadata fields blanked to the same length (scripts/findings-metadata.mjs). Blank the same fields in a rebuild to compare.", pdfs: copies }, null, 1) + "\n");
copyFileSync(path.join(PAPERS, plan[0][0], "doc.bld"), path.join(OUT, "doc.bld"));
copyFileSync(path.join(PAPERS, "glossary.json"), path.join(DATA, "glossary.json"));
const reg = { about: "Publication register rows for the published findings, public fields only.", built: register.built,
  ladder_rules: register.ladder_rules, rows: plan.map(([id]) => publicRow(rows[id])) };
writeFileSync(path.join(DATA, "register.json"), JSON.stringify(reg, null, 1) + "\n");
console.log(`findings: ${plan.length} papers imported into findings/src and findings/papers`);
