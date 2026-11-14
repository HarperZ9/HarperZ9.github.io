// findings-record-parts.mjs: the pieces of a finding's research record (research-record/1) that come from the
// paper's apparatus sections and the register row: references, corrections, versions, the evidence grade, the
// reproduce steps and the Verified line. scripts/record-findings.mjs assembles them. Every derived reason names the
// field it came from, so a reader or a test can trace it.
import { plain } from "./findings-paper.mjs";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// "31 October 2026" anywhere in a string -> "2026-10-31"
export function isoDate(s) {
  const m = s.match(/(\d{1,2}) (January|February|March|April|May|June|July|August|September|October|November|December) (\d{4})/);
  return m ? `${m[3]}-${String(MONTHS.indexOf(m[2]) + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
}

// sentences of plain prose; a full stop after an initial, "eq", "et al", "Fig" or "no" does not end one
const ABBR = /(?:\b[A-Z]|\bet al|\beqs?|\bFig|\bno|\bvs|\be\.g|\bi\.e)\.$/;
export function sentences(s) {
  const out = [];
  for (const part of s.split(/(?<=[.!?])\s+(?=[A-Z"(])/)) {
    const x = part.trim(); if (!x) continue;
    if (out.length && ABBR.test(out[out.length - 1])) out[out.length - 1] += ` ${x}`; else out.push(x);
  }
  return out;
}

// the key a reader sees: "Weiss 2018", or an institution's name
export function displayKey(text, key) {
  const m = text.match(/^([^,.(]+?),[^()]*?\((\d{4}[a-z]?)\)/);
  if (m) return `${m[1].trim()} ${m[2]}`;
  const first = text.split(/\.\s/)[0];
  return first.length <= 48 ? first : key;
}

export function targetOf(text) {
  const doi = text.match(/\bdoi:\s*(10\.\S+?)[.,;]?(?:\s|$)/i);
  if (doi) return `https://doi.org/${doi[1]}`;
  const ax = text.match(/\barXiv:\s*(\d+(?:\.\d+)*(?:v\d+)?)/);
  if (ax) return `https://arxiv.org/abs/${ax[1]}`;
  const url = text.match(/https?:\/\/[^\s)]+[^\s).,;]/);
  return url ? url[0] : "";
}

// references: each bib entry, kind dataset when the Data section cites it (we ran on it), else a paper we read at
// the level the Verified section states; plus every published finding the paper's text names
export function references({ bib, dataKeys, litNote, licence, findings, verifiedDate }) {
  const refs = bib.map((b, i) => {
    const r = { id: `r${i + 1}`, key: displayKey(b.text, b.key), kind: "paper", title: plain(b.text), access: "snippet" };
    const target = targetOf(b.text);
    if (target) r.target = target;
    if (dataKeys.has(b.key)) { r.kind = "dataset"; r.access = "run"; if (licence) r.licence = licence; }
    else if (/^traxler/.test(b.key)) { r.kind = "record"; r.access = "read"; r.access_note = "the scan, read in full on the Internet Archive"; }
    else { r.access_note = litNote ? `${litNote}; full text not read` : "access not stated in the paper"; r.accessed = verifiedDate; }
    return r;
  });
  for (const f of findings) refs.push({ id: `r${refs.length + 1}`, key: f.id, kind: "finding", title: f.title, target: f.id, access: "run" });
  return refs;
}

const corrType = (s) => (/retract|withdr/i.test(s) ? "retraction" : /narrow|scope|only|left out/i.test(s) ? "scope"
  : /tier/i.test(s) ? "tier" : /\d/.test(s) && /in place of|gives?|gave|reads|not \d|rounded|should read|from the result file/i.test(s) ? "number" : "wording");
const foundBy = (s, date, published) => (/review of our ledger|our ledger noted|ledger recorded/i.test(s) ? "a review of our findings ledger"
  : /later study of ours|later review|follow-up round|replication run/i.test(s) ? "a later study of ours"
  : /review of the published page/i.test(s) ? "a review of the published pages"
  : date === published ? "the publication pass" : date > published ? "a check after publication" : "the study itself, before publication");

// the paper's Corrections section: one bullet per dated change; "first published version" is a version, not a change
export function corrections(items, published) {
  const out = [];
  for (const it of items) {
    const date = isoDate(it);
    if (!date) throw new Error(`corrections: no date in "${it.slice(0, 60)}"`);
    let text = it.replace(/^[^:]*?\d{4}[^:]*?:\s*/, "").replace(/\{\/?c\d+\}/g, "");
    text = text.replace(/^first published version\.\s*/i, "");
    if (!text || /^No correction to this finding/i.test(text)) continue;
    const ss = sentences(cap(text)), by = foundBy(text, date, published);
    out.push({ id: `x${out.length + 1}`, date, target: "document", type: corrType(text),
      after: ss.length > 1 ? ss.slice(1).join(" ") : ss[0], reason: ss.length > 1 ? ss[0] : `Dated in the paper's Corrections section; found by ${by}.`, found_by: by });
  }
  return out;
}

export function versions(dateFound, corr, published, version, pdfHash) {
  const vs = [{ n: 1, date: dateFound, what: "entered in the findings ledger" }];
  const dates = [...new Set(corr.map((x) => x.date))].filter((d) => d > dateFound && d < published).sort();
  for (const d of dates) vs.push({ n: vs.length + 1, date: d, what: `dated correction, ${corr.filter((x) => x.date === d).length} item${corr.filter((x) => x.date === d).length > 1 ? "s" : ""}` });
  vs.push({ n: vs.length + 1, date: published, what: `paper version ${version}, first published`, hash: pdfHash });
  // A correction dated after publication changes this page only: the PDF and its BuildTeX source stay at the
  // published paper version until the paper is typeset again, and the version line says so.
  const later = [...new Set(corr.map((x) => x.date))].filter((d) => d > published).sort();
  for (const d of later) vs.push({ n: vs.length + 1, date: d, what: `this page corrected, ${corr.filter((x) => x.date === d).length} item${corr.filter((x) => x.date === d).length > 1 ? "s" : ""}; the PDF and its BuildTeX source are still paper version ${version}` });
  return vs;
}

const cap = (s) => s.slice(0, 1).toUpperCase() + s.slice(1);
const reason = (domain, text, from) => ({ domain, text, from });

// the evidence grade (DATA.md, "Evidence grade derivation"), one reason per register field, plus the paper's own
// statements where the register is silent
export function grade({ row, paper, relationsIn, bound, outcome }) {
  const lowers = [], holds = [];
  const sc = row.scorer;
  const limits = paper.limitations.join(" ");
  if (sc && typeof sc === "object") {
    if (sc.blind === false) lowers.push(reason("blinding", sc.note ? `Not blind. ${sc.note}` : "Not blind: the analyst saw the data's shape before the lock.", "our publication register, on blinding"));
    if (sc.self_graded) lowers.push(reason("scoring", "Graded by the same agent that ran it.", "our publication register, on who scored it"));
    else if (/^code/.test(sc.who || "")) holds.push(reason("scoring", "Scored by code against rules fixed in advance.", "our publication register, on who scored it"));
  } else if (typeof (sc || row.scored_by) === "string") {
    if (/self-graded/.test(sc || row.scored_by)) lowers.push(reason("scoring", "Scored by code and by the agent that ran it; self-graded.", "our publication register, on who scored it"));
  }
  if (!lowers.some((r) => r.domain === "blinding") && /not blind/i.test(limits)) lowers.push(reason("blinding", "Not blind, as the paper's limitations state.", "the paper's Limitations"));
  if (paper.prereg) holds.push(reason("preregistration", `Preregistered and hash-locked before the run (sha256 ${paper.prereg.slice(0, 8)}).`, "the Reproduce section"));
  const ev = row.evidence || {};
  if (ev.controls) (/fail/i.test(ev.controls) ? lowers : holds).push(reason(/fail/i.test(ev.controls) ? "failed check" : "control", `Controls: ${ev.controls}.`, "our publication register, on controls"));
  if (/^none/i.test(ev.known_answer || "")) lowers.push(reason("missing control", "No positive control.", "our publication register, on the known-answer check"));
  if (outcome === "null" && bound && row.tier === "D") lowers.push(reason("imprecision", bound, "the bound stated under Evidence"));
  const lit = typeof row.literature === "object" ? row.literature?.verdict : row.literature;
  if (/prior work exists/i.test(lit || "")) lowers.push(reason("novelty", "Nearby work exists; novelty is not shown.", "our publication register, on the literature"));
  if (paper.litNote) lowers.push(reason("depth of reading", `The cited literature was read at the level of ${paper.litNote}; full texts were not read.`, "the Verified section"));
  for (const r of relationsIn.filter((x) => x.type === "held")) holds.push(reason("replication", `Rechecked by ${r.from} (${r.scope}): ${r.note}`, "a later finding"));
  const lic = row.data_licence || "";
  if (/no stated licence/i.test(lic)) lowers.push(reason("open data", "The data carry no stated licence; the page reports statistics only.", "our publication register, on the data licence"));
  else if (/non-commercial/i.test(lic + limits)) holds.push(reason("open data", "Public data under non-commercial terms.", "our publication register, on the data licence"));
  else if (/not public|is private|not published/i.test(lic)) holds.push(reason("open data", "Part of the data is public and part is not; the data licence line under Reproduce says which.", "our publication register, on the data licence"));
  else if (/public|CC0|CC BY|ODbL|open/i.test(lic)) holds.push(reason("open data", "Public data.", "our publication register, on the data licence"));
  return { lowers, holds };
}

// Reproduction bullets: data lines, hash lines and the cost line are told apart; the rest are steps
export function reproduce(items, dataRefs) {
  const steps = [], out = { data: dataRefs.map((r) => ({ name: r.key, licence: r.licence || "as stated in the paper's data section", url: r.target || "" })) };
  for (const raw of items) {
    const it = plain(raw);
    if (/^Cost:/i.test(it)) out.cost = it.replace(/^Cost:\s*/i, "");
    else if (/SHA-256/.test(it)) {
      // the words between the label and the hash may hold hex letters ("of the main run"), so skip to the first 64-digit run
      const pre = it.match(/[Pp]reregistration SHA-256.*?([0-9a-f]{64})/), plan = it.match(/[Pp]lan SHA-256.*?([0-9a-f]{64})/);
      if (pre && !out.prereg) out.prereg = { hash: pre[1], plan: plan ? plan[1] : "not recorded" };
      steps.push(raw);
    } else steps.push(raw);
  }
  out.steps = steps;
  if (!out.cost) out.cost = "not recorded";
  return out;
}

// the Verified section, sentence by sentence: what was checked, and what was not
export function verified(text) {
  const date = isoDate(text);
  if (!date) throw new Error("verified: no date");
  const ss = sentences(text.replace(/^Verified:\s*/, "").replace(/\{\/?c\d+\}/g, "")).map(cap);
  const no = (s) => /\bnot (re-run|rerun|read|re-read|rechecked|checked|reopened)\b|were not|was not/i.test(s);
  return { date, checks: ss.filter((s) => !no(s)).map((s) => ({ what: s, by: "the paper's Verified pass", result: /\bmatch/i.test(s) ? "match" : "as stated" })),
    not_checked: ss.filter(no) };
}
