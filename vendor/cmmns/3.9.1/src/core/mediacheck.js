// Words for a media check: the rows the window shows for one file, and the signals it raises.
// The wording calls a file neither authentic nor fake. Credentials record what the signing tool
// declared; a valid signature shows who signed and that the file is unchanged since.

import { credentialState } from "./c2pa.js";

export const CREDENTIALS_DO_NOT_PROVE = "Credentials record what the signing tool declared, and a valid signature shows who signed and that the file is unchanged since.";
export const NO_CREDENTIALS = "Absent, the usual case: platforms often strip them on upload.";
const TRUST = "The name is the certificate's own claim: anyone can make a certificate with any name on it.";

const host = (u) => { try { return new URL(u).hostname; } catch { return "an address it names"; } };
const who = (c) => (c ? [c.CN, c.O].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ") || "an unnamed signer" : "unknown");
const failed = (r) => Object.values(r.checks || {}).filter((c) => c.ok === false).map((c) => c.text);
const open = (r) => Object.values(r.checks || {}).filter((c) => c.ok === null).map((c) => c.text);

function made(r) {
  const a = (r.active.actions || []).find((x) => x.source) || (r.active.actions || [])[0];
  if (!a) return null;
  const how = a.source ? `${a.source.says} (${a.source.code})` : a.action;
  return a.agent ? `${how}, by ${a.agent}` : how;
}

// Rows for the card: [label, text] pairs. r is readCredentials() output, or an error state.
export function credentialRows(r) {
  if (!r) return [];
  if (r.error) return [["Content Credentials", r.error]];
  const rows = [], state = credentialState(r);
  if (state === "none") rows.push(["Content Credentials", NO_CREDENTIALS]);
  else if (state === "remote") rows.push(["Content Credentials", `the file points to credentials stored online at ${host(r.remote)}, which CMMNS leaves unfetched.`]);
  else if (r.broken) rows.push(["Content Credentials", `found, but ${r.broken}`]);
  else {
    rows.push(["Content Credentials", state === "unchanged" ? "found and checked: the file is unchanged since it was signed"
      : state === "changed" ? `found, but they no longer match: ${failed(r).join("; ")}` : `found; open checks: ${open(r).join("; ")}`]);
    rows.push(["Signed by", `${who(r.active.cert && r.active.cert.subject)} (${r.active.alg || "unknown algorithm"}). ${TRUST}`]);
    if (r.active.cert && r.active.cert.issuer && !r.active.cert.selfIssued) rows.push(["Certificate from", who(r.active.cert.issuer)]);
    if (r.active.cert && r.active.cert.notAfter) rows.push(["Certificate dates", `${r.active.cert.notBefore.slice(0, 10)} to ${r.active.cert.notAfter.slice(0, 10)}`]);
    const m = made(r);
    if (m) rows.push(["Says it was", m]);
    if (r.active.generator) rows.push(["Signing tool", r.active.generator]);
    for (const e of r.earlier || []) if (e.ai) rows.push(["Earlier version", `the credentials say an earlier version${e.title ? ` (${e.title})` : ""} was made with generative AI`]);
    if (r.active.timestamp) rows.push(["Time-stamp", "attached; the time-stamp authority's signature is left unchecked"]);
  }
  for (const t of (r.meta && r.meta.sourceTypes) || []) rows.push(["Metadata says", `${t.says} (IPTC ${t.code})`]);
  for (const g of (r.meta && r.meta.generators) || []) rows.push(["Generator metadata", g]);
  for (const f of (r.meta && r.meta.fields) || []) rows.push([f.key, f.text]);
  if (state === "none" && r.meta && !r.meta.any) rows.push(["Other metadata", "absent; the platform probably removed it"]);
  return rows;
}

const dnp = (t) => ["What it shows", t];

// Signals for the window: [{ label, fam, level, cat, rows }].
export function credentialSignals(r) {
  if (!r || r.error) return [];
  const out = [], state = credentialState(r);
  if (r.found && r.aiAnywhere) {
    out.push({ label: "credentials: made with AI", fam: "c2pa", level: "warn", cat: "media", rows: [["What CMMNS read", r.active.ai ? `The file's Content Credentials say it was ${made(r)}.` : "The credentials say an earlier version of this file was made with generative AI."], ["Signed by", who(r.active.cert && r.active.cert.subject)], ["Checks", state === "unchanged" ? "signature, assertions and file bytes all match" : state], dnp(CREDENTIALS_DO_NOT_PROVE)] });
  } else if (r.found && state === "unchanged") {
    const m = made(r);
    out.push({ label: "content credentials", fam: "c2pa", level: "info", cat: "media", rows: [["What CMMNS read", m ? `The credentials say it was ${m}.` : "The file carries signed credentials."], ["Signed by", who(r.active.cert && r.active.cert.subject)], dnp(CREDENTIALS_DO_NOT_PROVE)] });
  }
  if (r.found && state === "changed") out.push({ label: "credentials do not match", fam: "c2pa-changed", level: "flag", cat: "media", rows: [["What CMMNS found", failed(r).join("; ") || r.broken], dnp("Editing tools and platforms also break credentials in ordinary use.")] });
  const ai = ((r.meta && r.meta.sourceTypes) || []).find((t) => t.kind === "ai");
  if (ai || ((r.meta && r.meta.generators) || []).length) {
    out.push({ label: "metadata: made with AI", fam: "ai-metadata", level: "flag", cat: "media", rows: [["What CMMNS read", ai ? `The file's metadata says it was ${ai.says} (IPTC ${ai.code}).` : r.meta.generators.join("; ")], dnp("Metadata is unsigned: anyone can add, copy or remove it.")] });
  }
  return out;
}
