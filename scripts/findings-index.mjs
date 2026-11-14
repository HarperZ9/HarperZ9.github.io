// findings-index.mjs: the findings index (the field of marks, filters by tier and by field, the list with each
// finding's outcome and standing, honest nulls counted and drawn as results) and the shared glossary page, where each
// term's entry links to every use on every findings page.
import { esc } from "./studies-markdown.mjs";
import { TIERS, DOMAINS, domainLabel, domainsOf, glyph, laneMark } from "./findings-parts.mjs";
import { mark, OUTCOME_WORD } from "./findings-marks.mjs";
import { STANDING_WORD, standingMark } from "./finding-flags.mjs";

export function items(records, pages) {
  return records.map((r) => { const d = r.document, t = d.tier;
    return { id: d.id, n: Number(d.id.slice(1)), title: d.title, standfirst: d.standfirst, tier: t, tierInfo: TIERS[t], outcome: d.outcome, bound: d.bound,
      domains: domainsOf(d.fields), href: pages[d.id] }; }).sort((a, b) => b.n - a.n);
}

function field(list, domains) {
  const W = 960, rowH = 30, top = 8, H = top * 2 + domains.length * rowH;
  const min = Math.min(...list.map((c) => c.n)), max = Math.max(...list.map((c) => c.n));
  const x = (n) => 255 + ((n - min) / Math.max(1, max - min)) * (W - 275);
  const rows = domains.map((d, i) => `<text x="238" y="${top + i * rowH + 21}" text-anchor="end" class="xf-lab">${esc(domainLabel(d))}</text><line x1="255" x2="${W - 20}" y1="${top + i * rowH + 15}" y2="${top + i * rowH + 15}" class="xf-rule"/>`).join("");
  const marks = list.map((c) => c.domains.map((d, k) => {
    const y = top + domains.indexOf(d) * rowH + 15, cx = x(c.n);
    return `<a href="${c.href}" class="fd-mark" data-tier="${c.tierInfo.key}" data-domains="${d}"${k ? ' tabindex="-1" aria-hidden="true"' : ""}><g transform="translate(${(cx - 7).toFixed(1)} ${y - 7})">${glyph(c.tier, 14, "fd-mglyph").replace(/<svg[^>]*>|<\/svg>/g, "")}<rect width="14" height="14" fill="transparent"/></g><title>${esc(c.id)}, ${esc(c.tierInfo.label)}, ${c.standing.type === "none" ? "" : `standing ${esc(c.standing.word)}: `}${esc(c.title)}</title></a>`;
  }).join("")).join("");
  return `<figure class="xf"><div class="xf-scroll" tabindex="0" role="region" aria-label="The field of findings"><svg viewBox="0 0 ${W} ${H}" role="group" aria-label="Every finding on this page, placed by its number in the ledger (left to right) and by its field; a filled disc is a strong signal, a ring a signal, a struck ring an honest null; each mark links to its page">${rows}${marks}</svg></div>
<figcaption>Each mark is one finding, earliest on the left: ${glyph("B*", 12)} strong signal, ${glyph("B", 12)} signal, ${glyph("D", 12)} honest null. Choose a mark to read it.</figcaption></figure>`;
}

function filters(list, tiers, domains) {
  const count = (p) => list.filter(p).length;
  const tb = tiers.map((t) => `<button type="button" data-tier="${TIERS[t].key}" aria-pressed="false">${glyph(t, 14, "fd-glyph")}${esc(TIERS[t].label)} <span>${count((it) => it.tier === t)}</span></button>`).join("");
  const db = domains.map((d) => `<button type="button" data-domain="${d}" aria-pressed="false">${laneMark(d, "xp-lane", 20)}${esc(domainLabel(d))} <span>${count((it) => it.domains.includes(d))}</span></button>`).join("");
  return `<div class="xp-filter fd-filter" role="group" aria-label="Show one kind of result"><button type="button" data-tier="" aria-pressed="true">Every result <span>${list.length}</span></button>${tb}</div>
<div class="xp-filter fd-filter" role="group" aria-label="Show one field"><button type="button" data-domain="" aria-pressed="true">Every field <span>${list.length}</span></button>${db}</div>`;
}

// every entry sits in the research hue (hue names the platform); tier is told by the glyph and the word.

function entry(it) {
  const st = it.standing;
  return `<li class="xc fd-item" id="${it.id.toLowerCase()}" data-tier="${it.tierInfo.key}" data-domains="${it.domains.join(" ")}" data-standing="${st.type}" data-hue="rsrch">
  <p class="xc-meta"><span class="xc-n">${esc(it.id)}</span> <span class="fd-tier d-fine" data-tier="${it.tierInfo.key}">${glyph(it.tier)}${esc(it.tierInfo.label)}</span> <span class="fd-out">${mark("outcome", it.outcome)}${esc(OUTCOME_WORD[it.outcome])}</span> <span class="xc-lanes">${it.domains.map((d) => laneMark(d)).join("")}${esc(it.domains.map(domainLabel).join(", "))}</span></p>
  <h2 class="xc-title">${it.redirect ? `<span>${esc(it.title)}</span>` : `<a class="d-fine" href="${it.href}">${esc(it.title)}</a>`}</h2>
  <p class="xc-finding">${esc(it.standfirst)}</p>
  ${it.outcome !== "held" && it.bound ? `<p class="fd-bound"><b>${{ null: "What it rules out", failed: "What fell", mixed: "What did not hold" }[it.outcome] || "Bound"}.</b> ${esc(it.bound)}</p>` : ""}
  ${it.redirect ? `<p class="fd-moved">${standingMark(st.type)} ${esc(STANDING_WORD[st.type])} by ${esc(st.from)}: ${esc(st.scope)}. ${it.redirect.to ? `Its page now opens <a href="${it.redirect.href}">${esc(it.redirect.to)}</a>, which keeps this record in its Trail.` : "Its page now opens this entry."} <a href="/findings/papers/${it.id}.pdf">The old paper</a> stays downloadable.</p>` : ""}
</li>`;
}

// The index's own Verified line: what was checked on the section as a whole, by what, with what result, on one date.
// A dated statement: change it only when the checks are run again.
const VERIFIED = [
  ["Verified on 2026-11-13.", "The index and all 30 finding pages were read in full by AI model readers working for the author, looking for a stated result with its numbers and limits, nulls kept as nulls, local file paths, stale claims and broken text. A script followed all 7,245 internal links and anchors on the 32 pages of this section and found none broken. It sent one request to each of the 164 outside addresses the pages cite: 158 answered (124 of them are DOI redirects, which shows the DOI is registered and says nothing about the publisher's page), five arXiv links carried a stray full stop and failed, and one, the Atomic Mass Data Center, refused the script. The five links were repaired that day and answer now. The same pass repaired one table reference that had printed as raw markup on F329 and one chart label on F310 that had rounded p 0.995 to 1.00."],
  ["Not checked.", "No study was re-run and no number was recomputed from its result file in this pass; each finding's own Verified section says what was checked for it. The glossary was scanned by script and not read in full. The read also raised points about wording and scope on single pages that this pass did not settle; a correction joins a finding's Trail when it is accepted."],
];

export function indexBody(list) {
  const domains = DOMAINS.map(([id]) => id).filter((id) => list.some((it) => it.domains.includes(id)));
  const tiers = Object.keys(TIERS).filter((t) => list.some((it) => it.tier === t));
  const nulls = list.filter((it) => it.tier === "D").length, outNull = list.filter((it) => it.outcome === "null").length;
  const tierKey = tiers.map((t) => `<dt>${glyph(t)}${esc(TIERS[t].label)}</dt><dd>${esc(TIERS[t].blurb)}.</dd>`).join("");
  const standKey = ["held", "extended", "narrowed", "questioned", "refuted", "retracted"].map((s) => `<span class="lbl">${standingMark(s)}${STANDING_WORD[s]}</span>`).join(" ");
  return `<article class="tool xp fd">
<h1 class="d-3d" data-hue="rsrch">Findings</h1>
<p>What our experiments found, one finding at a time. Each page leads with where the result stands, puts the strongest objection before the argument, marks every checkable claim with its evidence, defines each technical term where it is first used, and ends with the dated trail of corrections, the references both ways, the steps to repeat it and a Verified line. Each offers its whitepaper as a PDF and its BuildTeX source.</p>
<p class="fd-count">${list.length} findings so far. <b>${nulls} of them are honest nulls</b>: tests that failed, claims that did not hold, and errors of our own that we found and fixed. ${outNull} findings in all report a null result with its bound. They carry the same weight as the results that held, because knowing what does not work saves the next person the trip.</p>
<dl class="fd-key">${tierKey}</dl>
<p class="fd-standkey">After every link to a finding, here and anywhere on the site, its standing: what later records in our findings ledger did to it. ${standKey} A link with no mark is to a finding no later record has treated.</p>
<p class="fd-standkey">Every technical term is defined where a page first uses it, and again in the <a href="/findings/glossary.html">findings glossary</a>.</p>
${field(list, domains)}
${filters(list, tiers, domains)}
<p class="xp-count" aria-live="polite">${list.length} findings shown.</p>
<ol class="xp-stream">${list.map(entry).join("\n")}</ol>
${VERIFIED.map((v) => `<p class="fd-standkey fd-verified"><b>${esc(v[0])}</b> ${esc(v[1])}</p>`).join("")}
<p class="fd-also">Looking for the shorter cards? <a href="/experiments/">Experiments</a> lists the preregistered studies that came back null, one card each. Findings are listed with the other writing under <a href="/publications.html#research">Research notes and papers</a>.</p>
</article>
<script type="module" src="/world/site/findings.js"></script>`;
}

// the glossary: one entry per term, each scoped definition with every use, alphabetical
export function glossaryBody(glossary, uses, pages, titles) {
  const groups = new Map();
  for (const t of glossary.terms) { const k = t.key; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(t); }
  const anchor = (t) => (t.scope === "shared" ? `g-${t.key}` : `g-${t.key}-${t.scope.toLowerCase()}`);
  const entries = [...groups.entries()].sort((a, b) => a[1][0].term.localeCompare(b[1][0].term, "en", { sensitivity: "base" })).map(([key, ts]) => {
    const defs = ts.map((t) => {
      const us = uses.filter((u) => u.key === key && (t.scope === "shared" ? u.scope === "shared" : u.scope === t.scope));
      const links = us.map((u) => `<a href="${pages[u.page]}#${u.anchor}">${esc(u.page)}<span class="sr-only">, ${esc(titles[u.page])}</span></a>`).join(", ");
      return `<div class="gl-def" id="${anchor(t)}"><p><span class="gl-scope">${t.scope === "shared" ? "Across the findings" : `In ${esc(t.scope)}`}</span> <span class="gd-f">${esc(t.field)}</span></p>
<p>${esc(t.definition.slice(0, 1).toUpperCase() + t.definition.slice(1))}. <span class="gd-x">Excludes</span> ${esc(t.excludes)}.</p>
<p class="gl-uses">${us.length ? `Used in ${links}` : "Not yet used on a findings page."}</p></div>`;
    }).join("");
    return `<li class="gl-term" id="term-${key}"><h2 class="d-fine" data-hue="rsrch">${esc(ts[0].term)}</h2>${defs}</li>`;
  }).join("\n");
  return `<article class="tool st fd gl">
<p class="kicker"><a class="fd-up" href="/findings/">Findings</a></p>
<h1 class="d-3d" data-hue="rsrch">Glossary</h1>
<p>Each technical term on the findings pages, defined the way we use it: what we mean, the field the term comes from and what it excludes. A term shared across the findings has one definition; a term one study fixed for itself is defined in that study's scope. Each definition lists every page that uses it, and each use links back here.</p>
<p class="fd-count">${groups.size} terms, ${glossary.terms.length} scoped definitions, ${uses.length} first uses across ${new Set(uses.map((u) => u.page)).size} findings.</p>
<ol class="gl-list">${entries}</ol>
</article>`;
}
