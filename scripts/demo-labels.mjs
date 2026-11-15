#!/usr/bin/env node
// The form label every demonstration carries: live, replay or captured.
//
//   node scripts/demo-labels.mjs            rewrite each label on its page from site-src/world/demos.json
//   node scripts/demo-labels.mjs --check    fail if a label is missing or differs from the ledger
//
// The ledger is site-src/world/demos.json. A row names a page, a form and, for a replay or a captured
// demonstration, the evidence record: date, command, file and sha256. This script owns the words of the label and
// nothing else: a label is placed on a page once, by hand or by the page's generator (which imports labelFor), and
// from then on the text between its tags is rewritten here. tests/test_demo_labels.py reads the pages and the
// ledger on its own, so a fault here cannot hide a missing label.
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const LEDGER = JSON.parse(readFileSync(path.join(site, "site-src/world/demos.json"), "utf8"));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const longDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${d} ${MONTHS[m - 1]} ${y}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const WORD = { live: "Live", replay: "Replay", captured: "Captured" };

// The words inside the label. One sentence says what the form means here; a recorded form then names its record.
export function labelText(row) {
  const e = row.evidence;
  const record = e ? ` The record is <a href="/${esc(e.file)}">${esc(e.file.split("/").pop())}</a>, SHA-256 <code>${e.sha256.slice(0, 16)}</code>.` : "";
  if (row.form === "live") return `<b>Live.</b> This runs in your browser now, on what you give it.`;
  if (row.form === "replay") return `<b>Replay.</b> A run recorded on ${longDate(e.date)}, checked again in your browser.${record}`;
  if (e) return `<b>Captured.</b> Recorded on ${longDate(e.date)} and shown as recorded. Nothing on this page runs the tool.${record}`;
  return `<b>Captured.</b> Shown as recorded. Nothing on this page runs the tool. The full record of the run (date, command, file and hash) is not published with it yet.`;
}
export const labelHtml = (row) => `<p class="demo-form" data-demo="${esc(row.id)}" data-form="${row.form}">${labelText(row)}</p>`;
export function labelFor(id) {
  const row = LEDGER.rows.find((r) => r.id === id);
  if (!row) throw new Error(`demo-labels: no demonstration named "${id}" in site-src/world/demos.json`);
  if (!WORD[row.form]) throw new Error(`demo-labels: "${id}" has the form "${row.form}"; the forms are live, replay and captured`);
  return labelHtml(row);
}
export const fileOf = (page) => { const p = page.split("#")[0].replace(/^\//, ""); return p === "" || p.endsWith("/") ? p + "index.html" : p; };

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const check = process.argv.includes("--check"), problems = [];
  let changed = 0;
  for (const row of LEDGER.rows) {
    const file = path.join(site, fileOf(row.page)), src = readFileSync(file, "utf8");
    const at = new RegExp(`<p class="demo-form" data-demo="${row.id}" data-form="[a-z]*">[\\s\\S]*?</p>`), want = labelFor(row.id);
    const found = src.match(at);
    if (!found) { problems.push(`${fileOf(row.page)}: no label for "${row.id}"; place ${want} beside the demonstration`); continue; }
    if (found[0] === want) continue;
    if (check) problems.push(`${fileOf(row.page)}: the label for "${row.id}" differs from the ledger`);
    else { writeFileSync(file, src.replace(at, () => want)); changed++; }
  }
  if (problems.length) { console.error(problems.join("\n")); process.exit(1); }
  console.log(check ? `demo labels: ${LEDGER.rows.length} labels match the ledger` : `demo labels: ${changed} of ${LEDGER.rows.length} rewritten`);
}
