// Site context as evidence items: who owns a site, any state link a cited source makes, whether
// its address imitates a listed outlet, and its fact-check record. Every item names its source.
// CMMNS adds no score or rating of its own. Reads only the tables handed to useData().

import { siteFacts, siteRecord, recordSummary, recordLine, ownerHeading, ownerType, SITE_SOURCES, SITE_RECORD_DOES_NOT_PROVE } from "./sites.js";
import { ownerOfDomain, ownerSource } from "./owners.js";
import { stateLinksOfDomain, stateLabel, STATE_DOES_NOT_PROVE } from "./state.js";
import { lookalikeOf, LOOKALIKE_DOES_NOT_PROVE } from "./lookalike.js";
import { hostOf } from "./hosts.js";
import { SITE_OWNER_DOES_NOT_PROVE } from "./api-words.js";

// "https://www.Example.com/a" or "example.com" -> "example.com", or null.
export function cleanDomain(d) {
  const s = String(d || "").trim();
  if (!s) return null;
  const h = hostOf(/^https?:\/\//i.test(s) ? s : "https://" + s);
  return h ? h.replace(/^www\./, "").replace(/\.$/, "") : null;
}

const stateLevel = (h) => (h.basis === "named-in-report" ? "warn" : h.basis === "state-owned" || h.basis === "designated" ? "flag" : "info");
const sourceLine = (s) => (s ? `${s.title}${s.date ? ` (${s.date})` : ""}${s.url ? `: ${s.url}` : ""}` : "the cited report");

// What CMMNS' tables hold for one domain: { domain, facts, owner, state, record, lookalike }.
export function siteSummary(domain) {
  const d = cleanDomain(domain);
  if (!d) return null;
  const owner = ownerOfDomain(d);
  return {
    domain: d,
    facts: siteFacts(d),
    owner: owner ? { name: owner.name, owner: owner.owner, via: owner.via || "owner", source: owner.source || null, ...(owner.correction ? { correction: owner.correction } : {}) } : null,
    state: stateLinksOfDomain(d).map((h) => ({ ...h })),
    record: recordSummary(siteRecord(d)),
    lookalike: lookalikeOf(d),
  };
}

// Evidence items for one domain linked by the given posts. Items with nothing to say are left out.
export function siteEvidence(domain, posts = [], { quiet = false } = {}) {
  const S = siteSummary(domain);
  if (!S) return [];
  const out = [], base = { scope: posts.length ? "post" : "site", posts, spans: [] };
  if (S.lookalike) {
    const L = S.lookalike;
    out.push({ ...base, kind: "lookalike-domain", level: "flag", label: `look-alike of ${L.official}`,
      shows: `${S.domain} looks like ${L.official}, the address of ${L.outlet} (${L.how}).`, source: "CMMNS' list of outlet addresses, matched on this device.",
      context: LOOKALIKE_DOES_NOT_PROVE, data: { domain: S.domain, outlet: L.outlet, official: L.official, how: L.how } });
  }
  for (const h of S.state) {
    const L = stateLabel(h);
    out.push({ ...base, kind: "state-link", level: stateLevel(h), label: L.chip, shows: L.says, source: sourceLine(h.source),
      context: STATE_DOES_NOT_PROVE[h.basis] || STATE_DOES_NOT_PROVE["named-in-report"], data: { domain: S.domain, state: h.state, basis: h.basis, actor: h.actor } });
  }
  if (S.owner && S.owner.owner) {
    out.push({ ...base, kind: "site-owner", level: "info", label: `link: ${S.owner.name || S.domain}`,
      shows: `${S.owner.name || S.domain} (${S.domain}). ${ownerHeading(S.owner)} ${S.owner.owner}.`, source: ownerSource(S.owner),
      context: SITE_OWNER_DOES_NOT_PROVE, data: { domain: S.domain, owner: S.owner.owner, ownerType: ownerType({ facts: S.facts, state: S.state }) } });
  }
  const line = recordLine(S.record);
  if (line || (!quiet && S.facts)) {
    out.push({ ...base, kind: "site-record", level: "info", label: `site record: ${S.domain}`,
      shows: [S.facts && S.facts.name ? `${S.facts.name} (${S.domain})` : S.domain, line || "Zero reviews in CMMNS' table list this site as where a claim appeared."].join(": ") + ".",
      source: SITE_SOURCES, context: SITE_RECORD_DOES_NOT_PROVE,
      data: { domain: S.domain, reviews: S.record ? S.record.n : 0, checkers: S.record ? S.record.m : 0, since: S.record ? S.record.since : null, founded: S.facts ? S.facts.founded : null, country: S.facts ? S.facts.country : null } });
  }
  return out;
}
