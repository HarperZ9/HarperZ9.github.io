// Who owns the outlet behind a link or an account. The table (src/ext/owners.json) is built from
// Wikidata by scripts/owners-build.mjs: current owners only, each row linking to its Wikidata
// item as the source. The background worker holds it and answers for the domains a page shows,
// so nothing about what the user reads leaves the browser.
//
// What this does not show: who funds an individual creator. Sponsors, investors and donors are
// mostly undisclosed; CMMNS shows them only where a platform labels it on the page (ad, paid
// partnership) or a public record is in the table.

let BY_DOMAIN = new Map(), BY_HANDLE = new Map();

// A row corrected by data/owner-corrections.json (scripts/owner-corrections.mjs) carries
// `correction`: { source, checked, reason, upstream, factsWrong? }. The window says so, with the
// correction's own source, instead of crediting Wikidata.
export const ownerSourceShort = (o) => (o && o.correction ? `CMMNS correction, checked ${o.correction.checked}` : "Wikidata");
export const ownerSource = (o) => (o && o.correction ? `CMMNS correction, checked ${o.correction.checked}: ${o.correction.source}. Wikidata said "${o.correction.upstream.owner}". ${o.correction.reason}`
  : `Wikidata${o && o.source ? `: ${o.source}` : ""}`);

// rows: [{ name, domain, owner, source, x? }]
export function setOwnerRows(rows) {
  BY_DOMAIN = new Map(); BY_HANDLE = new Map();
  for (const r of rows || []) {
    if (!BY_DOMAIN.has(r.domain)) BY_DOMAIN.set(r.domain, r);
    if (r.x && !BY_HANDLE.has(r.x)) BY_HANDLE.set(r.x, r);
  }
  return BY_DOMAIN.size;
}

// "https://www.news.sky.com/story" -> the most specific listed domain, or null.
export function ownerOfDomain(host) {
  let h = String(host || "").toLowerCase().replace(/^https?:\/\//, "").split("/")[0].replace(/^www\./, "");
  while (h.includes(".")) { if (BY_DOMAIN.has(h)) return BY_DOMAIN.get(h); h = h.slice(h.indexOf(".") + 1); }
  return null;
}
export function ownerOfHandle(handle) { return BY_HANDLE.get(String(handle || "").toLowerCase()) || null; }

// Domains mentioned in text ("From washingtonpost.com", "bbc.co.uk/news/..."), lower-case, unique.
export function domainsIn(text) {
  const out = new Set();
  for (const m of String(text || "").matchAll(/\b((?:[a-z0-9-]+\.)+(?:com|co\.uk|fr|de|org|net|news|tv|io|uk|eu|ca|au))\b/gi)) out.add(m[1].toLowerCase());
  return [...out];
}
