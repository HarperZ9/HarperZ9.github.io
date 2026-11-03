// Site context for a link or the page being read: who owns the site, what kind of owner, when and
// where it was founded, any state link, and the site's fact-check record. Every row names its
// source. CMMNS adds no score or rating of its own.
//
// The table (src/ext/sites.json, built by scripts/sites-build.mjs) has two parts:
//   facts    from Wikidata (CC0): name, founding date, country, and the owner type Wikidata states
//   records  from the Data Commons ClaimReview feed (CC BY 4.0): each review a fact-checker
//            published, filed under the site where the fact-checker said the claim appeared
// A site's record counts reviews whose claim appeared on that site. Posts on platforms, archives
// without the original address, shortened links and fact-checkers' own pages are never filed under
// a site (src/core/hosts.js). Political side is never an input: nothing here reads or names one.

import { siteKey, hostOf } from "./hosts.js";
import { stateLabel } from "./state.js";
import { ownerOfDomain, ownerSourceShort } from "./owners.js";

let FACTS = {}, RECORDS = {}, CHECKERS = [];

// table: { facts: { host: [name, founded, country, ownerType, qid] }, records: { siteKey: { n, m, since, until, reviews: [[claim, rating, ci, url, date]] } }, checkers }
export function setSiteTable(table) {
  FACTS = (table && table.facts) || {};
  RECORDS = (table && table.records) || {};
  CHECKERS = (table && table.checkers) || [];
  return Object.keys(FACTS).length;
}

const norm = (h) => hostOf(/^https?:\/\//i.test(String(h || "")) ? h : "https://" + String(h || "")) || "";

// The most specific listed host, walking up no further than the site itself.
export function siteFacts(host) {
  let h = norm(host);
  const top = siteKey(h);
  while (h) {
    const f = FACTS[h];
    // An owner correction can mark the Wikidata facts for this host as another item's.
    const o = f && ownerOfDomain(h);
    if (o && o.domain === h && o.correction && o.correction.factsWrong) return null;
    if (f) return { name: f[0], founded: f[1] || null, country: f[2] || null, ownerType: f[3] || null, source: f[4] ? `https://www.wikidata.org/wiki/${f[4]}` : null };
    if (h === top || !h.includes(".")) break;
    h = h.slice(h.indexOf(".") + 1);
  }
  return null;
}

export function siteRecord(host) {
  const key = siteKey(norm(host));
  const r = key && RECORDS[key];
  if (!r) return null;
  return { key, n: r.n, m: r.m, since: r.since, until: r.until, reviews: (r.reviews || []).map(([claim, rating, ci, url, date]) => ({ claim, rating, checker: CHECKERS[ci] || "unknown", url, date })) };
}

// A record without its review list, for pages that only show the line.
export const recordSummary = (rec) => (rec ? { key: rec.key, n: rec.n, m: rec.m, since: rec.since, until: rec.until, latest: rec.reviews.slice(0, 3) } : null);

const plural = (n, word) => `${n.toLocaleString("en")} ${word}${n === 1 ? "" : "s"}`;
export function recordLine(rec) {
  if (!rec || !rec.n) return null;
  return `${plural(rec.n, "review")} by ${plural(rec.m, "fact-checker")} since ${rec.since}, ratings as the checkers wrote them`;
}

export const SITE_RECORD_DOES_NOT_PROVE = "A review lists this site as a place where a claim appeared, perhaps reporting someone else's words. Each rating is about that claim. Fact-checkers choose what to check, so a count says little about how often a site is right.";
export const SITE_SOURCES = "Owner, owner type, founding date and country: Wikidata (CC0). Reviews: ClaimReview markup published by each fact-checker, from the Data Commons fact-check feed (CC BY 4.0).";

// Owner types, in a fixed order. State links come first because they cite a source; then what
// Wikidata states. A report naming a site in an operation is a state link, not an owner type.
export const OWNER_TYPES = ["state media", "public broadcaster", "regional govt", "nonprofit", "commercial", "nonprofit and commercial", "not stated"];
export function ownerType({ facts, state } = {}) {
  const rows = state || [];
  if (rows.some((h) => h.basis === "state-owned" && h.level !== "regional") || rows.some((h) => h.basis === "designated")) return "state media";
  if (rows.some((h) => h.basis === "public-broadcaster")) return "public broadcaster";
  if (rows.some((h) => h.basis === "state-owned" && h.level === "regional")) return "regional govt";
  const t = facts && facts.ownerType;
  return OWNER_TYPES.includes(t) ? t : "not stated";
}
const typeSource = (info) => ((info.state || []).some((h) => h.basis !== "named-in-report") ? "from the state links below" : "as Wikidata states it");

// One line per state link, in the source's own terms.
const stateRows = (rows) => (rows || []).map((h) => ["State link", `${stateLabel(h).says} Source: ${h.source && h.source.title}${h.source && h.source.date ? ` (${h.source.date})` : ""}.`]);

// The rows for one site, for CMMNS' window. info: { domain, owner, state, facts, record }.
// opts.onList opens the full list of reviews.
export function siteInfoRows(info, opts = {}) {
  const { domain, owner, facts, record } = info;
  const name = (facts && facts.name) || (owner && owner.name) || null;
  const type = ownerType(info);
  const rows = [
    ["Site", name ? `${name} (${domain})` : domain],
    [ownerHeading(owner), owner && owner.owner ? `${owner.owner} (${ownerSourceShort(owner)})` : null],
    ["Owner type", type !== "not stated" ? `${type}, ${typeSource(info)}` : null],
    ["Founded", facts && facts.founded ? `${facts.founded} (Wikidata)` : null],
    ["Country", facts && facts.country ? `${facts.country} (Wikidata)` : null],
    ...stateRows(info.state),
    ...packNoteRows(info.notes),
  ];
  if (!owner && !facts && !(info.state || []).length) rows.push([null, { note: "CMMNS lacks a Wikidata entry for this site, so its owner, founding date and country stay blank." }]);
  rows.push(["Fact-check record", recordLine(record) || "Zero reviews in CMMNS' table list this site as where a claim appeared."]);
  for (const r of (record && (record.latest || record.reviews.slice(0, 3))) || []) rows.push(["Review", `"${r.rating}": ${r.checker}, ${r.date || "date not given"}`]);
  if (record && record.n && opts.onList) rows.push(["Reviews", { action: [`Show all ${record.n.toLocaleString("en")}`, opts.onList, "Opened in a new tab"] }]);
  rows.push(["Source", SITE_SOURCES], ["What it shows", SITE_RECORD_DOES_NOT_PROVE]);
  return rows.filter(([, v]) => v != null);
}

// Notes from data packs the user imported and trusts (src/core/packs-content.js), each with its
// pack's name and source, kept apart from CMMNS' own rows.
export const PACK_NOTE_CAVEAT = "From a data pack you imported and trust, written and checked by its publisher.";
function packNoteRows(notes) {
  if (!notes || !notes.length) return [];
  const rows = notes.slice(0, 5).flatMap((n) => [["Pack note", `${n.note} (pack: ${n.pack})`], ["Read it", { links: [[String(n.url).replace(/^https?:\/\//, "").slice(0, 48), n.url]] }]]);
  return [...rows, [null, { note: PACK_NOTE_CAVEAT }]];
}

// Wikidata's owner (P127) where it states one, else the parent organisation (P749) or publisher
// (P123), each named as what it is (scripts/owners-build.mjs).
export const ownerHeading = (o) => (o && o.via === "parent" ? "Parent organisation" : o && o.via === "publisher" ? "Published by" : "Owned by");

// Short labels for a result link on a search page: state links first, then the owner or owner type.
// The review count stays in the hover card, beside the line that says what a count does not prove:
// on its own under a result it would read as a score.
export function siteChips(info) {
  if (!info) return [];
  const out = [...new Set((info.state || []).map((h) => stateLabel(h).chip))];
  const cut = (t) => (t.length > 42 ? t.slice(0, 41) + "…" : t);
  if (info.owner && info.owner.owner) out.push(cut(`${ownerHeading(info.owner).toLowerCase()} ${info.owner.owner}`));
  else { const t = ownerType(info); if (t !== "not stated") out.push(t); }
  return out;
}

// The head line of a site card: the name, then owner type, country, founding year and the review
// count. Nothing here is a warning: a count of reviews is context, not a verdict.
export function siteGlance(info) {
  const f = info.facts || {}, type = ownerType(info);
  return {
    who: f.name || (info.owner && info.owner.name) || info.domain,
    fact: [info.domain, type !== "not stated" ? type : null, f.country, f.founded ? `since ${String(f.founded).slice(0, 4)}` : null, info.record && info.record.n ? plural(info.record.n, "fact-check review") : null].filter(Boolean).join(" · "),
  };
}
