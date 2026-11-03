// State links: link domains and accounts tied to a government, from two sourced lists.
//   state-owned       the outlet's ownership chain on Wikidata ends at a government or state body
//   named-in-report   a platform or government report named the domain or account in an influence
//                     operation it took down or attributed (each row cites the report)
// The same rule applies to every country. CMMNS does not attribute a reply, an account or a
// narrative to a state from what it says or how it behaves: that would be a guess presented as a
// finding. It shows a link or an account that a cited source ties to a state, and nothing more.

let ROWS = [];
const byDomain = new Map(), byHandle = new Map();

// rows: [{ domain?, x?, state, basis: "state-owned" | "public-broadcaster" | "designated" | "named-in-report", actor?, name, operation?, source: { title, url, date } }]
// actor (report rows): who the report says ran it: "government", "commercial firm" or
// "individuals or group". `state` is where the report says the operation came from, which is not
// the same as a government running it.
export function setStateRows(rows) {
  ROWS = Array.isArray(rows) ? rows : [];
  byDomain.clear(); byHandle.clear();
  for (const r of ROWS) {
    if (r.domain) (byDomain.get(r.domain.toLowerCase()) || byDomain.set(r.domain.toLowerCase(), []).get(r.domain.toLowerCase())).push(r);
    if (r.x) (byHandle.get(r.x.toLowerCase()) || byHandle.set(r.x.toLowerCase(), []).get(r.x.toLowerCase())).push(r);
  }
}

// Subdomains match their parent: "de.rt.com" finds "rt.com".
export function stateLinksOfDomain(domain) {
  const parts = String(domain || "").toLowerCase().replace(/^www\./, "").split(".");
  for (let i = 0; i < parts.length - 1; i++) {
    const hit = byDomain.get(parts.slice(i).join("."));
    if (hit) return hit;
  }
  return [];
}

export function stateLinksOfHandle(handle) { return byHandle.get(String(handle || "").toLowerCase()) || []; }

// Thread summary: links and accounts per state and basis, so the panel can say "3 replies link to
// outlets owned by the government of X" without ranking states.
export function stateSummary(items) {
  const out = new Map();
  for (const it of items) {
    const hits = [...(it.domains || []).flatMap(stateLinksOfDomain), ...stateLinksOfHandle(it.author)];
    for (const h of new Set(hits)) {
      const k = h.state + "|" + h.basis + "|" + (h.actor || "") + "|" + (h.level || "");
      const e = out.get(k) || { state: h.state, basis: h.basis, actor: h.actor || null, level: h.level || null, replies: new Set(), names: new Set() };
      e.replies.add(it.id); e.names.add(h.name);
      out.set(k, e);
    }
  }
  return [...out.values()].map((e) => ({ state: e.state, basis: e.basis, actor: e.actor, level: e.level, replies: e.replies.size, names: [...e.names] })).sort((a, b) => b.replies - a.replies || a.state.localeCompare(b.state));
}

export const STATE_DOES_NOT_PROVE = {
  "state-owned": "State ownership ties the outlet to a government. Public broadcasters with editorial independence are state-owned too, and Wikidata can lag a sale.",
  "designated": "A designation records one government's assessment and policy. Wikidata matches the domain to the named outlet when the document leaves it out.",
  "public-broadcaster": "Public broadcasters range from editorially independent to government-directed. The outlet's charter and record show which.",
  "named-in-report": "The report named this domain or account in an operation at the time it was published. Domains change hands, and accounts can be reused or impersonated.",
};

// Short chip text and a sentence for one row, in the report's own terms.
export function stateLabel(h) {
  if (h.basis === "designated") return { chip: `govt-designated: ${h.state}`, says: `${h.name}: ${h.designation}.` };
  if (h.basis === "public-broadcaster") return { chip: `public broadcaster: ${h.state}`, says: `A public broadcaster of ${h.state}, according to Wikidata: publicly owned or funded, with an editorial charter that varies by country.` };
  if (h.basis === "state-owned" && h.level === "regional") return { chip: `regional govt: ${h.state}`, says: `Owned or controlled by a regional or local government body in ${h.state}, according to Wikidata.` };
  if (h.basis === "state-owned") return { chip: `state-owned: ${h.state}`, says: `Owned or controlled by the state of ${h.state}, according to Wikidata.` };
  const who = h.actor === "government" ? `the government of ${h.state}` : h.actor === "commercial firm" ? `a firm in ${h.state}${h.operation ? ` (${h.operation})` : ""}` : `people or a group in ${h.state}${h.operation ? ` (${h.operation})` : ""}`;
  return { chip: h.actor === "government" ? `op report: ${h.state} govt` : h.actor === "commercial firm" ? `op report: firm in ${h.state}` : `op report: ${h.state}`, says: `Named in a published influence-operation report that attributes the operation to ${who}.` };
}
