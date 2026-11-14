// findings-page.mjs: one finding's page on the research presentation system's landmarks, in their fixed order:
// Lead (title, standfirst, the standing line, downloads), Objection, Argument (claim marks, traces, inline term
// definitions), Evidence (figures and tables from the paper, the grade, the ladder), then the apparatus: Trail,
// References both ways, Reproduce, Verified, and the page's glossary.
import { esc } from "./studies-markdown.mjs";
import { mark, OUTCOME_WORD } from "./findings-marks.mjs";
import { STANDING_WORD, standingMark, standingOf } from "./finding-flags.mjs";
import { context, numberLabels, prose, sectionBody } from "./findings-render.mjs";
import { domainLabel, domainsOf } from "./findings-parts.mjs";
import { apparatus, downloads, grade, ladder, recordNumbers } from "./findings-apparatus.mjs";

const TIER_WORD = { "B*": "strong signal", B: "signal", D: "honest null", A: "publication candidate" };

function standingLine(rec, rels) {
  const d = rec.document, w = standingOf(d.id, rels), xs = [...rec.corrections].sort((a, b) => a.date.localeCompare(b.date));
  const stand = w ? `<a href="#cited-by">${standingMark(w.type)}${esc(STANDING_WORD[w.type])}: ${esc(w.scope)}, ${esc(w.from)}</a>` : "no later treatment recorded";
  const items = [
    ["Tier", `${esc(d.tier)}, ${TIER_WORD[d.tier]}`],
    ["Outcome", `<a href="#evidence">${mark("outcome", d.outcome)}${esc(OUTCOME_WORD[d.outcome])}</a>`],
    ["Rung", d.rung ? `<a href="#ladder">${esc(d.rung)}</a>` : "not yet placed"],
    ...(w ? [["Standing", stand]] : []),
    ["Corrections", xs.length ? `<a href="#trail">${xs.length}, latest ${esc(xs[xs.length - 1].date)}</a>` : "none"],
    ["Version", `<a href="#trail">v${Math.max(...rec.versions.map((v) => v.n))}, ${esc(rec.versions[rec.versions.length - 1].date)}</a>`],
    ["Redo it", '<a href="#reproduce">Reproduce</a>'],
  ];
  return `<dl class="standing">${items.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join("")}</dl>`;
}

function objection(d, ctx) {
  const text = /[.!?]$/.test(d.objection) ? d.objection : d.objection + ".";
  return `<section id="objection" class="objection" aria-labelledby="objection-h"><h2 id="objection-h" class="d-3d" data-hue="brass">Objection</h2>
<p>${/\{[a-z]+:/.test(text) ? prose(text, ctx) : esc(text)}</p>
<p><b>What would change the call.</b> ${esc(/[.!?]$/.test(d.would_change) ? d.would_change : d.would_change + ".")}</p>
<p class="src">From ${esc(d.objection_source)}.</p></section>`;
}

function evidence(rec, ctx, appendix) {
  const d = rec.document;
  const bound = d.bound ? `<p class="bound">${mark("outcome", d.outcome)}<span><b>${esc(OUTCOME_WORD[d.outcome].replace(/^./, (c) => c.toUpperCase()))}.</b> ${esc(d.bound)}</span></p>`
    : `<p class="bound">${mark("outcome", d.outcome)}<span><b>${esc(OUTCOME_WORD[d.outcome].replace(/^./, (c) => c.toUpperCase()))}.</b> ${esc(d.tier_reason)}</span></p>`;
  return `<section id="evidence" class="landmark" aria-labelledby="evidence-h"><h2 id="evidence-h" class="d-3d" data-hue="brass">Evidence</h2>
${bound}
${ctx.charts && ctx.charts.rest() ? `<h3>Charts</h3>${ctx.charts.rest()}
` : ""}${ctx.figures.length ? `<h3>Figures</h3>${ctx.figures.join("\n")}` : ""}
${ctx.tables.length ? `<h3>Tables</h3>${ctx.tables.join("\n")}` : ""}
${appendix}
${recordNumbers(rec)}
${grade(rec)}
${ladder(rec)}
</section>`;
}

// findingBody(rec, env) -> { body, termUses, citeUses }; env: pages {id: href}, glossary for this finding, plate,
// relations (the whole ledger's), replaced (records of findings this one replaced)
export function findingBody(rec, env) {
  const d = rec.document, ctx = context(rec, env.pages, env.glossary, env.plate);
  numberLabels(ctx);
  ctx.charts = env.charts || null;
  const lead = d.sections.filter((s) => s.role === "lead"), arg = d.sections.filter((s) => s.role === "argument"), ev = d.sections.filter((s) => s.role === "evidence");
  const sec = (s, keep) => `<section id="${s.id}" class="${s.role === "lead" ? "lead-sec" : "arg-sec"}" aria-labelledby="${s.id}-h"><h2 id="${s.id}-h" class="d-3d" data-hue="brass">${esc(s.title)}</h2>\n${sectionBody(s, ctx, { keep })}</section>`;
  const leadHtml = lead.map((s) => sec(s)).join("\n"), argHtml = arg.map((s) => sec(s)).join("\n");
  const appendix = ev.map((s) => `<div id="${s.id}" class="fd-appendix"><h3>${esc(s.title)}</h3>${sectionBody(s, ctx, { keep: true })}</div>`).join("\n");
  const fields = domainsOf(d.fields).map(domainLabel).join(", ");
  const body = `<article class="tool st fd fd-page rp" data-tier="${esc(d.tier)}">
<header class="rp-lead">
<p class="kicker"><a class="fd-up" href="/findings/">Findings</a> <span aria-hidden="true">/</span> ${esc(d.id)} <span aria-hidden="true">/</span> ${esc(fields)} <span aria-hidden="true">/</span> found ${esc(d.date_found)}</p>
<h1 class="d-3d" data-hue="rsrch">${esc(d.title)}</h1>
<p class="fd-standfirst">${esc(d.standfirst)}</p>
${standingLine(rec, env.relations)}
${downloads(rec, "lead")}
</header>
${leadHtml}
${objection(d, ctx)}
<div class="argument" id="argument">
${argHtml}
</div>
${evidence(rec, ctx, appendix)}
${apparatus(rec, ctx, env)}
</article>`;
  return { body, termUses: ctx.termUses, citeUses: ctx.citeUses };
}

export { prose, context };
