#!/usr/bin/env node
// Build one research record (research-record/1) per published finding, from data the site carries:
// findings/src/<id>/paper.txt (claims, sections, glossary uses, references, corrections, reproduce, verified),
// findings/data/register.json (tier, rung, objection, grade fields), findings/data/ledger.json (relations) and
// findings/data/meta.json (the reader's title and standfirst; outcome and bound, chosen by hand). Facts are stored;
// standing, back-links and counts are derived when the pages are built. Also writes the one shared glossary record.
//
//   node scripts/record-findings.mjs           write findings/records/<id>.json and findings/records/glossary.json
//   node scripts/record-findings.mjs --check   write nothing; exit 1 when a record on disk differs or fails its schema
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { inline, plain, read } from "./findings-paper.mjs";
import { corrections, grade, references, reproduce, sentences, verified, versions } from "./findings-record-parts.mjs";
import { validate } from "./findings-schema.mjs";
import { verdictsFor } from "./findings-outcome.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const F = path.join(site, "findings");
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const ROLE = { "sec:reader": "lead" };
const APPARATUS = new Set(["sec:verified", "sec:corrections", "sec:repro"]);

// a block back to its source line, so a section's paragraphs carry figures, tables and equations as the paper wrote them
function blockSource(b) {
  if (b.kind === "p") return b.text;
  if (b.kind === "li") return `- ${b.text}`;
  if (b.kind === "subsection") return `## ${b.text}${b.label ? ` {${b.label}}` : ""}`;
  if (b.kind === "eq") return `$$ ${b.text} {${b.label}}`;
  if (b.kind === "figure") return `![${b.label} width=${b.width}${b.alt ? ` alt=${b.alt}` : ""}](${b.src}) ${b.caption}`;
  if (b.kind === "table") return [`::table ${b.label} cols=${b.cols.join(",")} ${b.caption}`, ...b.rows.map((r) => r.join(" ¦ ")), "::end"].join("\n");
  throw new Error(`record: no source form for ${b.kind}`);
}

const textOf = (sec) => sec.blocks.filter((b) => b.kind === "p" || b.kind === "li").map((b) => b.text).join(" ");
const litNote = (vtext) => { const m = plain(vtext).match(/read at the level of ([^;.]+)/); return m ? m[1].trim() : ""; };
const cap = (s) => s.slice(0, 1).toUpperCase() + s.slice(1);
const OBSERVED = new Set(["abstract", "results", "controls", "data", "appendix"]);

// every claim, first occurrence wins; a later occurrence must carry the same words
function collectClaims(sections, refIds) {
  const claims = new Map();
  const walk = (nodes, sec) => { for (const n of nodes) {
    if (n.t === "claim") {
      const text = plain(n.src), prev = claims.get(n.id);
      const same = (a, b) => a.slice(0, 1).toLowerCase() + a.slice(1) === b.slice(0, 1).toLowerCase() + b.slice(1);
      if (prev && !same(prev.text, text)) throw new Error(`claim ${n.id} has two wordings`);
      if (!prev) {
        const refs = [...n.src.matchAll(/\{cite:([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((k) => refIds[k.trim()]));
        claims.set(n.id, { id: n.id, text, section: sec, basis: OBSERVED.has(sec) ? "observed" : "inferred", refs });
      }
    }
    if (n.kids) walk(n.kids, sec);
  } };
  for (const s of sections) for (const p of s.paragraphs) walk(inline(p), s.id);
  return [...claims.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}

function numbersOf(text) { return [...new Set(plain(text).replace(/\{m:[^}]*\}/g, "").match(/[-+]?\d+(?:,\d{3})*(?:\.\d+)?(?:e-?\d+)?/g) || [])]; }

// evidence: the numbers each claim states, checked in the paper's Verified pass, then the register's own numbers
function evidenceFor(claims, row, date) {
  const evidence = [];
  for (const c of claims) {
    const nums = numbersOf(c.text);
    if (!nums.length) continue;
    const e = { id: `e${evidence.length + 1}`, kind: "number", label: `The numbers in claim ${c.id.slice(1)}`, value: nums.join("; "),
      check: { by: "re-read from the run's result file in the paper's Verified pass", date, result: "match", note: "per the Verified section, which lists the values re-read" } };
    evidence.push(e); c.evidence = [e.id];
  }
  const ev = row.evidence || {};
  for (const [k, label] of [["denominator", "Sample"], ["interval", "Main estimate and interval"], ["forecast_vs_outcome", "Forecast against outcome"], ["known_answer", "Known-answer check"]])
    if (ev[k]) evidence.push({ id: `e${evidence.length + 1}`, kind: k === "known_answer" ? "control" : "number", label, value: ev[k],
      check: { by: "the register's evidence fields", result: "not_checked", note: "as recorded in the publication register" } });
  return evidence;
}

// the paper's dated corrections, then the ledger's dated corrections the paper does not carry
function correctionsFor(id, items, ledger, published) {
  const corr = corrections(items, published);
  for (const x of (ledger.corrections || []).filter((c) => c.finding === id)) {
    const { finding, source, ...rest } = x;
    corr.push({ id: `x${corr.length + 1}`, target: "document", ...rest, record: "findings ledger, publication pass" });
  }
  return corr;
}

// the PDF the site offers must be the one its build receipt names, with only its hidden author fields blanked
// (findings/data/copies.json, written by the import, which checked the built hash before blanking)
function checkedPdfHash(id) {
  const pdfHash = json(path.join(F, "papers", `${id}.buildtex.json`)).outputs[`${id}.pdf`];
  const copy = json(path.join(F, "data", "copies.json")).pdfs[id];
  if (!copy || copy.built_sha256 !== pdfHash) throw new Error(`${id}: the PDF copy record does not match its build receipt`);
  if (createHash("sha256").update(readFileSync(path.join(F, "papers", `${id}.pdf`))).digest("hex") !== copy.site_sha256) throw new Error(`${id}: the PDF differs from its recorded site copy`);
  return pdfHash;
}

// A thesis needs a named rival and a decisive observation; say which reading lost, in a sentence a reader can parse.
const stop = (s) => (/[.!?]$/.test(s) ? s : `${s}.`);
function rungReason(ladder) {
  if (ladder.rung === "thesis" && ladder.opposition && ladder.decisive_observation)
    return `Named rival, which the finding stood against: ${stop(ladder.opposition)} Decisive observation against the rival: ${stop(ladder.decisive_observation)}`;
  return ladder.reason;
}

function documentFor(id, meta, row, limitations, sections) {
  const ladder = row.ladder && ["lead", "hypothesis", "thesis", "conjecture", "theorem", "law candidate", "killed"].includes(row.ladder.rung) ? row.ladder : null;
  return { id, kind: "finding", title: meta.title, standfirst: meta.standfirst, date_found: meta.date_found, fields: meta.fields,
    tier: row.strong_b ? "B*" : row.tier, tier_reason: row.tier_reason, ...(ladder ? { rung: ladder.rung, rung_reason: rungReason(ladder) } : {}),
    outcome: meta.outcome, ...(meta.bound ? { bound: meta.bound } : {}), ...verdictsFor(id, meta), objection: row.reviewer_attack || limitations[0],
    objection_source: row.reviewer_attack ? "the register's reviewer attack" : "the paper's first stated limitation; no reviewer attack is on file",
    would_change: row.raise_tier || "No condition for raising or overturning the call is on file in the register.", sections };
}

export function buildRecord(id, data) {
  const { meta, row, ledger, published, allMeta } = data;
  const paper = read(readFileSync(path.join(F, "src", id, "paper.txt"), "utf8"));
  const sec = (label) => paper.sections.find((s) => s.label === label);
  const vSec = sec("sec:verified"), vText = textOf(vSec);
  const dataKeys = new Set([...textOf(sec("sec:data")).matchAll(/\{cite:([^}]+)\}/g)].flatMap((m) => m[1].split(",").map((k) => k.trim())));
  const allText = [paper.abstract.join(" "), ...paper.sections.map(textOf)].join(" ");
  const named = [...new Set(allText.match(/\bF\d+\b/g) || [])].filter((f) => f !== id && allMeta[f]).map((f) => ({ id: f, title: allMeta[f].title }));
  const refs = references({ bib: paper.bib, dataKeys, litNote: litNote(vText), licence: [row.data_licence || "as stated in the paper's data section", row.licence_terms].filter(Boolean).join("; "), findings: named, verifiedDate: verified(vText).date });
  const refIds = Object.fromEntries(refs.map((r, i) => [paper.bib[i]?.key ?? r.key, r.id]));
  const toIds = (s) => s.replace(/\{cite:([^}]+)\}/g, (m, keys) => `{cite:${keys.split(",").map((k) => { const r = refIds[k.trim()]; if (!r) throw new Error(`${id}: cite ${k} has no reference`); return r; }).join(",")}}`);
  const sections = [{ id: "abstract", title: "Abstract", role: "argument", paragraphs: paper.abstract.map(toIds) },
    ...paper.sections.filter((s) => !APPARATUS.has(s.label)).map((s) => ({ id: s.label.replace(/^sec:/, ""), title: s.title,
      role: ROLE[s.label] || (/^Appendix/.test(s.title) ? "evidence" : "argument"), paragraphs: s.blocks.map((b) => toIds(blockSource(b))) }))];
  sections.sort((a, b) => (a.role === "lead" ? -1 : 0) - (b.role === "lead" ? -1 : 0));
  const claims = collectClaims(sections, refIds);
  const vf = verified(toIds(vText));
  const evidence = evidenceFor(claims, row, vf.date);
  const limitations = sec("sec:limits").blocks.filter((b) => b.kind === "li").map((b) => plain(b.text));
  const relationsIn = ledger.relations.filter((r) => r.to === id);
  const reproItems = sec("sec:repro").blocks.filter((b) => b.kind === "li").map((b) => toIds(b.text));
  const repro = reproduce(reproItems, refs.filter((r) => r.kind === "dataset"));
  const notRerun = vf.not_checked.find((s) => /re-?run/i.test(s));
  if (notRerun) repro.not_rerun = notRerun;
  const corr = correctionsFor(id, sec("sec:corrections").blocks.filter((b) => b.kind === "li").map((b) => toIds(b.text)), ledger, published);
  const pdfHash = checkedPdfHash(id);
  const doc = documentFor(id, meta, row, limitations, sections);
  const cited = new Set(named.map((f) => f.id));
  const record = { schema: "research-record/1", built: `${published} by scripts/record-findings.mjs from paper.txt, the register row and the findings ledger`,
    document: doc, claims, evidence, references: refs, relations: ledger.relations.filter((r) => r.to === id || cited.has(r.to)).map(({ source, ...r }) => ({ ...r, record: r.record ? `${r.record}; ${source}` : source })),
    corrections: corr, versions: versions(meta.date_found, corr, published, paper.meta.version, pdfHash),
    grade: grade({ row, paper: { limitations, prereg: repro.prereg?.hash, litNote: litNote(vText) }, relationsIn, bound: meta.bound, outcome: meta.outcome }),
    reproduce: repro, verified: vf };
  return { record, terms: paper };
}

// strip anything internal before a record leaves the build: inputs, *_internal fields, and any drive path in text
export function publicOnly(rec) {
  return JSON.parse(JSON.stringify(rec, (k, v) => (k === "inputs" || k.endsWith("_internal") ? undefined
    : typeof v === "string" ? v.replace(/(?<![A-Za-z{])[A-Za-z]:[\\/][^\s,;)]*/g, "internal file") : v)));
}

// the shared glossary: every shared term, and every paper's own terms scoped to that paper
export function glossaryRecord(ids) {
  const shared = json(path.join(F, "data", "glossary.json")).terms;
  const terms = Object.entries(shared).map(([key, t]) => ({ key, scope: "shared", ...pick(t) }));
  for (const id of ids) {
    const p = path.join(F, "src", id, "terms.json");
    if (existsSync(p)) for (const [key, t] of Object.entries(json(p).terms)) terms.push({ key, scope: id, ...pick(t) });
  }
  return { schema: "glossary/1", about: "One entry per term and scope. A finding's first use of a term marks it; the page links each use to its entry, and the glossary page links each entry to every use.", terms };
}
const pick = (t) => ({ term: t.term, field: t.field, definition: t.definition, excludes: t.excludes });

export function loadData() {
  const reg = json(path.join(F, "data", "register.json")), metaAll = json(path.join(F, "data", "meta.json")).findings;
  return { rows: Object.fromEntries(reg.rows.map((r) => [r.f, r])), metaAll, ledger: json(path.join(F, "data", "ledger.json")), ladderRules: reg.ladder_rules };
}

function main() {
  const CHECK = process.argv.includes("--check");
  const { rows, metaAll, ledger } = loadData();
  const schema = json(path.join(F, "data", "research-record.schema.json")), gschema = json(path.join(F, "data", "glossary.schema.json"));
  const ids = readdirSync(path.join(F, "src")).filter((d) => /^F\d+$/.test(d)).sort((a, b) => a.slice(1) - b.slice(1));
  const outputs = [], problems = [];
  for (const id of ids) {
    if (!rows[id] || !metaAll[id]) { problems.push(`${id}: no register row or meta entry`); continue; }
    const { record } = buildRecord(id, { meta: metaAll[id], row: rows[id], ledger, published: rows[id].publication?.date || "2026-11-09", allMeta: metaAll });
    const rec = publicOnly(record);
    for (const e of validate(schema, rec)) problems.push(`${id}: ${e}`);
    outputs.push([`${id}.json`, JSON.stringify(rec, null, 1) + "\n"]);
  }
  const g = glossaryRecord(ids);
  for (const e of validate(gschema, g)) problems.push(`glossary: ${e}`);
  outputs.push(["glossary.json", JSON.stringify(g, null, 1) + "\n"]);
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  const dir = path.join(F, "records");
  if (CHECK) {
    const differ = outputs.filter(([f, s]) => !existsSync(path.join(dir, f)) || readFileSync(path.join(dir, f), "utf8") !== s).map(([f]) => f);
    if (differ.length) { console.error(`records: out of date: ${differ.join(", ")}`); process.exit(1); }
    console.log(`records: ${outputs.length} match a fresh build and their schemas`);
  } else {
    mkdirSync(dir, { recursive: true });
    for (const [f, s] of outputs) writeFileSync(path.join(dir, f), s);
    console.log(`records: ${ids.length} findings and the glossary, valid against research-record/1 and glossary/1`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
export { sentences };
