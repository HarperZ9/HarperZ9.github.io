// findings-apparatus.mjs: the parts of a finding's page below the argument. The downloads, the record's numbers, the
// evidence grade and the ladder sit in Evidence; Trail, References (both ways), Reproduce, Verified and the page's
// glossary share one ground, set off by a hairline and a tone step, never a box.
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { esc } from "./studies-markdown.mjs";
import { ACCESS_WORD, accessMark, mark } from "./findings-marks.mjs";
import { STANDING_WORD, standingMark } from "./finding-flags.mjs";
import { prose } from "./findings-render.mjs";

const site = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const RUNGS = ["lead", "hypothesis", "thesis", "conjecture", "theorem", "law candidate"];
const size = (rel) => { const b = statSync(path.join(site, rel)).size; return b > 1e6 ? `${(b / 1e6).toFixed(1)} MB` : `${Math.round(b / 1e3)} KB`; };

// the PDF and its BuildTeX source, the way the site's other papers offer theirs (a PDF link, the source, the receipt)
export function downloads(rec, where) {
  const id = rec.document.id, p = `findings/papers/${id}`;
  const files = [[`${p}.pdf`, "Whitepaper, PDF"], [`${p}.bld`, "BuildTeX source"], [`${p}.buildtex.json`, "Build receipt"]];
  if (where === "lead") {
    return `<p class="fd-downloads"><a href="/${p}.pdf">Download PDF</a> <span class="soft">${size(`${p}.pdf`)}</span> <span aria-hidden="true">/</span> <a href="/${p}.bld">BuildTeX source</a> <span class="soft">${id}.bld</span></p>`;
  }
  return `<h3 id="downloads">Downloads</h3><ul class="fd-files">${files.map(([f, w]) => `<li><a href="/${f}">${w}</a> <span class="soft">${path.basename(f)}, ${size(f)}</span></li>`).join("")}
<li><a href="/findings/papers/doc.bld">BuildLang doc module</a> <span class="soft">doc.bld, ${size("findings/papers/doc.bld")}, imported by the source</span></li></ul>
<p class="soft">The PDF is typeset by BuildTeX from ${id}.bld, which is written from the same source as this page. The receipt records the source's SHA-256 and the PDF's (${esc(rec.versions[rec.versions.length - 1].hash.slice(0, 12))}), so anyone can rebuild it and compare. The copy here has its hidden author field blanked, as the site does for every file it publishes; blank the same field in a rebuild before comparing. The name stays on the first page.</p>`;
}

export function recordNumbers(rec) {
  const rows = rec.evidence.filter((e) => !/^The numbers in claim/.test(e.label));
  if (!rows.length) return "";
  return `<h3>The register's numbers</h3><div class="st-table" tabindex="0" role="region" aria-label="The register's numbers"><table class="ev"><thead><tr><th scope="col">What</th><th scope="col">Value</th></tr></thead>
<tbody>${rows.map((e) => `<tr><th scope="row">${esc(e.label)}</th><td>${esc(e.value)}</td></tr>`).join("")}</tbody></table></div>
<p class="soft">As recorded in the publication register, the summary row each finding gets; the paper's own numbers above were re-read from the result files.</p>`;
}

export function grade(rec) {
  const li = (r, k) => `<li>${mark("grade", k)}<span class="dom">${esc(r.domain)}</span> ${esc(r.text)} <span class="from">from ${esc(r.from)}</span></li>`;
  return `<div class="grade"><div><h3>What lowers it</h3><ul class="lowers">${rec.grade.lowers.map((r) => li(r, "lowers")).join("") || "<li>Nothing recorded.</li>"}</ul></div>
<div><h3>What holds it up</h3><ul class="holds">${rec.grade.holds.map((r) => li(r, "holds")).join("") || "<li>Nothing recorded.</li>"}</ul></div></div>`;
}

export function ladder(rec) {
  const d = rec.document;
  if (!d.rung) return `<div id="ladder" class="ladder"><h3>Where the claim stands</h3><p class="soft">This finding has not been placed on the ladder of rungs yet.</p></div>`;
  const killed = d.rung === "killed", x0 = 44, step = 120;
  const nodes = RUNGS.map((r, i) => `<circle cx="${x0 + i * step}" cy="38" r="${r === d.rung ? 6 : 4.5}" class="node${r === d.rung ? " cur" : ""}"/><text x="${x0 + i * step}" y="18" class="${r === d.rung ? "cur" : ""}">${r}</text>`).join("");
  const branch = killed ? `<path d="M${x0 + step} 43 L${x0 + step + 30} 76" class="branch"/><path d="M${x0 + step + 23} 72h14l-7 12z" class="kill"/><text x="${x0 + step + 44}" y="84" class="cur kill-t">killed</text>` : "";
  const items = [...RUNGS, "killed"].map((r) => `<li${r === d.rung ? ' aria-current="step"' : ""}>${r}</li>`).join("");
  return `<div id="ladder" class="ladder"><h3>Where the claim stands</h3>
<div class="k-scroll"><svg class="ladder-svg" viewBox="0 0 700 96" aria-hidden="true" focusable="false"><path d="M${x0} 38H${x0 + step * 5}" class="rail"/>${nodes}${branch}</svg></div>
<ol class="sr-only" aria-label="Rungs, the current one marked">${items}</ol>
<p class="soft">${esc(d.rung_reason)} Tier ${esc(d.tier)}: ${esc(d.tier_reason)}</p></div>`;
}

// each standing was read by hand from a later ledger entry; the trail names the entry and its date
function standingTrail(rec) {
  const into = rec.relations.filter((r) => r.to === rec.document.id).sort((a, b) => b.date.localeCompare(a.date));
  if (!into.length) return "";
  return `<h3>Standing, and the ledger entries it rests on</h3><ol class="corrections">${into.map((r) => `<li id="st-${esc(r.from)}-${r.type}"><p class="xhead"><b>${esc(r.date)}</b> <span class="xtype">${esc(STANDING_WORD[r.type])}</span> ${standingMark(r.type)} ${esc(r.from)}</p>
<p>Set by hand from findings ledger entry ${esc(r.from)}, dated ${esc(r.date)}: ${esc(r.scope)}. Rests on ${esc(r.record || "that entry")}.</p></li>`).join("")}</ol>`;
}

function trail(rec, env, ctx) {
  const vs = [...rec.versions].sort((a, b) => b.n - a.n);
  const xs = [...rec.corrections].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const corr = xs.map((x) => `<li id="${x.id}"><p class="xhead"><b>${esc(x.date)}</b> <span class="xtype">${esc(x.type)}</span> <span class="soft">found by ${esc(x.found_by)}</span></p>
<p>${/^Dated in the paper/.test(x.reason) ? prose(x.after, ctx) : `${prose(x.reason, ctx)} <ins><span class="sr-only">now </span>${prose(x.after, ctx)}</ins>`}</p></li>`).join("");
  const replaced = (env.replaced || []).map((o) => `<li id="replaced-${o.id}"><p class="xhead"><b>${esc(o.date)}</b> <span class="xtype">${esc(o.type)}</span> ${standingMark(o.type)} ${esc(o.id)}</p>
<p><del><span class="sr-only">was </span>${esc(o.title)}. ${esc(o.claim)}</del></p><p>Why it fell: ${esc(o.why)}</p>
<p><a href="/findings/papers/${o.id}.pdf">The old paper, ${o.id}.pdf</a>, stays downloadable.</p></li>`).join("");
  return `<section id="trail" class="landmark" aria-labelledby="trail-h"><h2 id="trail-h" class="d-3d" data-hue="brass">Trail</h2>
<h3>Versions</h3><ol class="versions" reversed>${vs.map((v) => `<li><b>v${v.n}</b> ${esc(v.date)}, ${esc(v.what)}${v.hash ? ` <span class="hash">PDF sha256 ${esc(v.hash.slice(0, 16))}</span>` : ""}</li>`).join("")}</ol>
<h3>Corrections</h3>${corr ? `<ol class="corrections">${corr}</ol>` : "<p>None recorded.</p>"}
${standingTrail(rec)}
${replaced ? `<h3>Findings this one replaced</h3><ol class="corrections">${replaced}</ol>` : ""}
<p class="soft">Each correction is a dated note; the findings ledger is never rewritten, and a note governs where it differs.</p></section>`;
}

// a reference's own text, with its DOI, arXiv id and web address made into links where they stand
const linkify = (t) => esc(t).replace(/\bdoi:\s*(10\.\S+?)(?=[.,;]?(?:\s|$))/gi, (m, d) => `<a class="out" href="https://doi.org/${d}">doi:${d}</a>`)
  .replace(/\barXiv:\s*([0-9.]+(?:v\d+)?)/g, (m, a) => `<a class="out" href="https://arxiv.org/abs/${a}">arXiv:${a}</a>`)
  .replace(/(?<!href=")(https?:\/\/[^\s<"]+[^\s<".,;)])/g, '<a class="out" href="$1">$1</a>');

function references(rec, ctx, env) {
  const uses = {};
  for (const c of rec.claims) for (const rid of c.refs || []) (uses[rid] ||= []).push(`<a href="#${c.id}" aria-label="Back to claim ${c.id.slice(1)}">${c.id}</a>`);
  const items = rec.references.map((r, i) => {
    const back = [...(uses[r.id] || []), ...(ctx.citeUses[r.id] || []).map((u, k) => `<a href="#${u.anchor}" aria-label="Back to citation ${k + 1} of reference ${i + 1}">${esc(ctx.sectionTitles[`sec:${u.section}`] || u.section)}</a>`)];
    const title = r.kind === "finding" ? `${env.pages[r.target] ? `<a href="${env.pages[r.target]}">${esc(r.key)}</a>` : `<span class="key">${esc(r.key)}</span>`} ${esc(r.title)}` : linkify(r.title);
    const out = r.target && /^https?:/.test(r.target) && !/doi\.org|arxiv\.org/.test(r.target) && !r.title.includes(r.target) ? ` <a class="out" href="${esc(r.target)}">${esc(r.target)}</a>` : "";
    return `<li id="ref-${r.id}">${title}${out}
<span class="acc-line">${accessMark(r.access)}<span>${esc(ACCESS_WORD[r.access])}${r.accessed ? `, ${esc(r.accessed)}` : ""}${r.access_note ? `: ${esc(r.access_note)}` : ""}</span>${r.licence ? ` <span class="soft">Licence: ${esc(r.licence)}</span>` : ""}</span>
<span class="uses">${back.length ? `used in ${back.join(", ")}` : "listed, not cited in the text"}</span></li>`;
  }).join("\n");
  const rel = (r, dir) => { const who = dir === "in" ? r.from : r.to, link = env.pages[who] ? `<a href="${env.pages[who]}">${who}</a>` : esc(who);
    return `<li id="rel-${esc(r.from)}-${esc(r.to)}-${r.type}">${standingMark(r.type)}<b>${link}</b> ${esc(STANDING_WORD[r.type])}${dir === "in" ? "" : ` by ${esc(r.from)}`}, ${esc(r.scope)}, ${esc(r.date)}${r.record ? ` (record ${esc(r.record)})` : ""}. ${esc(r.note)}</li>`; };
  const into = rec.relations.filter((r) => r.to === rec.document.id).sort((a, b) => b.date.localeCompare(a.date));
  const other = rec.relations.filter((r) => r.to !== rec.document.id);
  return `<section id="references" class="landmark" aria-labelledby="refs-h"><h2 id="refs-h" class="d-3d" data-hue="brass">References</h2>
<ol class="refs">${items}</ol>
<h3 id="cited-by">Cited by later findings</h3><ul class="cited">${into.map((r) => rel(r, "in")).join("") || "<li>No later record in the findings ledger treats this finding.</li>"}</ul>
${other.length ? `<h3>Standing of findings cited here</h3><ul class="cited">${other.map((r) => rel(r, "out")).join("")}</ul>` : ""}</section>`;
}

function reproduce(rec, ctx) {
  const r = rec.reproduce;
  const data = (r.data || []).map((x) => `<li>${esc(x.name)}. <span class="soft">Licence: ${esc(x.licence)}.</span>${x.url ? ` <a class="out" href="${esc(x.url)}">${esc(x.url)}</a>` : ""}</li>`).join("");
  const pre = r.prereg ? `<h3>Preregistration</h3><p class="hash">sha256 ${esc(r.prereg.hash)}<br>plan ${esc(r.prereg.plan)}</p>` : "";
  return `<section id="reproduce" class="landmark" aria-labelledby="repro-h"><h2 id="repro-h" class="d-3d" data-hue="brass">Reproduce</h2>
${data ? `<h3>Data</h3><ul>${data}</ul>` : ""}${pre}
<h3>Steps</h3><ol class="steps">${r.steps.map((s) => `<li>${prose(s, ctx)}</li>`).join("")}</ol>
<p><b>Cost.</b> ${esc(r.cost.replace(/^./, (c) => c.toUpperCase()))}${r.not_rerun ? ` ${esc(r.not_rerun)}` : ""}</p>
${downloads(rec, "full")}</section>`;
}

function verified(rec, ctx) {
  const v = rec.verified;
  return `<section id="verified" class="landmark" aria-labelledby="ver-h"><h2 id="ver-h" class="d-3d" data-hue="brass">Verified</h2>
<p class="verified"><b>Verified on ${esc(v.date)}.</b> ${v.checks.map((c) => prose(c.what, ctx)).join(" ")}</p>
${v.not_checked.length ? `<p><b>Not checked.</b> ${v.not_checked.map((s) => prose(s, ctx)).join(" ")}</p>` : ""}</section>`;
}

function pageGlossary(ctx) {
  if (!ctx.termUses.length) return "";
  const items = ctx.termUses.map((u) => { const g = ctx.glossary[u.key];
    return `<li><a href="/findings/glossary.html#${g.anchor}">${esc(g.term)}</a> <span class="soft">${esc(g.field)}</span> <a class="gl-entry" href="#${u.anchor}" aria-label="First use of ${esc(g.term)} on this page">first use</a></li>`; }).join("");
  return `<section id="terms" class="landmark" aria-labelledby="terms-h"><h2 id="terms-h" class="d-3d" data-hue="brass">Terms on this page</h2>
<p class="soft">Each term is defined where it is first used on this page. Each name below opens its entry in the <a href="/findings/glossary.html">findings glossary</a>, which lists every page that uses it.</p>
<ul class="fd-terms">${items}</ul></section>`;
}

export function apparatus(rec, ctx, env) {
  return `<div class="apparatus">${trail(rec, env, ctx)}${references(rec, ctx, env)}${reproduce(rec, ctx)}${verified(rec, ctx)}${pageGlossary(ctx)}
<p class="fd-report soft">To report an error, name the finding, the claim number and the source on the <a href="/hire.html">Work page</a>, which gives the address. Accepted corrections join the Trail with their date.</p></div>`;
}
