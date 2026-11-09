#!/usr/bin/env node
// finding-flags.mjs: a finding's standing, and the standing flag on every link to a finding anywhere on the site.
// Standing is the most severe later treatment in findings/data/ledger.json (retracted, refuted, questioned,
// narrowed, superseded, extended, held); with none it reads "no later treatment". The flag is plain text after the
// link, the word with its drawn mark, written at build time: no script and no hover card. A link inside an inline
// SVG (the index's field of marks) carries the standing in its title instead, since text cannot sit beside it.
//
//   node scripts/finding-flags.mjs            flag every F-number link in the site's pages outside findings/
//   node scripts/finding-flags.mjs --check    write nothing; exit 1 when a page's flags are missing or stale
// The findings pages themselves are flagged by scripts/build-findings.mjs as it writes them.
import { readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const SEVERITY = ["retracted", "refuted", "questioned", "narrowed", "superseded", "extended", "held"];
export const STANDING_WORD = { held: "held", extended: "extended", narrowed: "narrowed in part", questioned: "questioned",
  refuted: "refuted", retracted: "retracted", superseded: "superseded", none: "no later treatment" };
const SHAPE = {
  held: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z"/>',
  extended: '<path d="M8 1.5 14.5 8 8 14.5 1.5 8z" class="o"/><path d="M8 5v6M5 8h6" class="o"/>',
  narrowed: '<path d="M8 2l6.5 11h-13z" class="o"/><path d="M8 2v11H1.5z"/>',
  questioned: '<path d="M8 2l6.5 11h-13z" class="o"/><circle cx="8" cy="10" r="1.4"/>',
  refuted: '<path d="M1.5 3h13L8 14z"/>',
  retracted: '<rect x="2.5" y="2.5" width="11" height="11" class="o"/><path d="M2.5 13.5l11-11" class="o"/>',
  superseded: '<rect x="2.5" y="2.5" width="11" height="11" class="o"/><path d="M5 8h6M8.5 5.5 11 8l-2.5 2.5" class="o"/>',
};

// the most severe relation into a finding, or null
export function standingOf(id, relations) {
  const rel = relations.filter((r) => r.to === id);
  return rel.length ? rel.reduce((w, r) => (SEVERITY.indexOf(r.type) < SEVERITY.indexOf(w.type) ? r : w)) : null;
}

export const standingMark = (type, cls = "mk") => (SHAPE[type]
  ? `<svg class="${cls} s-${type}" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">${SHAPE[type]}</svg>` : "");

// standings: { F63: { type, word, href } } for every published finding, href the finding's own page
export function standings(pages, relations) {
  const out = {};
  for (const p of pages) {
    const w = standingOf(p.id, relations);
    out[p.id] = { type: w ? w.type : "none", word: STANDING_WORD[w ? w.type : "none"], href: p.href, scope: w?.scope || "", from: w?.from || "" };
  }
  return out;
}

export function flag(id, s) {
  const st = s[id];
  const title = st.type === "none" ? `${id}: no later record treats it` : `${id}: ${st.word} by ${st.from}, ${st.scope}`;
  return `<a class="sflag s-${st.type}" data-flag="${id}" href="${st.href}#cited-by" title="${title.replace(/"/g, "&quot;")}">${standingMark(st.type)}<span>${st.word}</span></a>`;
}

const LINK = /<a\b([^>]*)>([\s\S]*?)<\/a>/g;
const HREF = /^(?:(?:https:\/\/harperz9\.github\.io)?\/findings\/|(?:\.\.\/)*findings\/)?(F\d+)-[a-z0-9-]+\.html(?:#[^"]*)?$/;
const OLD = /<a class="sflag[^"]*" data-flag="F\d+"[^>]*>[\s\S]*?<\/span><\/a>/g;

// flagLinks(html, standings) -> html with a flag after every link to a published finding; idempotent
export function flagLinks(html, s) {
  const clean = html.replace(OLD, "");
  const svgs = [...clean.matchAll(/<svg\b[\s\S]*?<\/svg>/g)].map((m) => [m.index, m.index + m[0].length]);
  const inSvg = (i) => svgs.some(([a, b]) => i > a && i < b);
  return clean.replace(LINK, (m, attrs, inner, offset) => {
    const href = (attrs.match(/\bhref="([^"]*)"/) || [])[1] || "";
    const id = (href.match(HREF) || [])[1];
    if (!id || !s[id] || /\bclass="sflag/.test(attrs) || inSvg(offset)) return m;
    return m + flag(id, s);
  });
}

// every HTML page of the site outside findings/, vendor copies and test fixtures
function sitePages(root) {
  const out = [], skip = new Set([".git", "node_modules", "vendor", "findings", "fixtures", "ext"]);
  const walk = (d) => { for (const f of readdirSync(d)) {
    const p = path.join(d, f);
    if (statSync(p).isDirectory()) { if (!skip.has(f)) walk(p); } else if (f.endsWith(".html")) out.push(p);
  } };
  walk(root);
  return out;
}

export function sweep(root, s, check) {
  const stale = [];
  for (const p of sitePages(root)) {
    const src = readFileSync(p, "utf8");
    if (!/F\d+-[a-z0-9-]+\.html/.test(src)) continue;
    const out = flagLinks(src, s);
    if (out !== src) { stale.push(path.relative(root, p)); if (!check) writeFileSync(p, out); }
  }
  return stale;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
  const pages = JSON.parse(readFileSync(path.join(site, "findings/pages.json"), "utf8")).pages.filter((p) => p.id && !p.redirect);
  const ledger = JSON.parse(readFileSync(path.join(site, "findings/data/ledger.json"), "utf8"));
  const s = standings(pages.map((p) => ({ id: p.id, href: `/${p.path}` })), ledger.relations);
  const check = process.argv.includes("--check"), stale = sweep(site, s, check);
  if (check && stale.length) { console.error(`finding flags: missing or stale on ${stale.join(", ")}`); process.exit(1); }
  console.log(`finding flags: ${stale.length} page${stale.length === 1 ? "" : "s"} ${check ? "to update" : "updated"} outside findings/`);
}
