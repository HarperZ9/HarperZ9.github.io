// findings-render.mjs: a finding record's prose as HTML. Claim marks become a mark that opens the claim's trace in
// place; a term's first use carries its scoped definition inline beside it (what we mean, the field, what it
// excludes) and links to its glossary entry; citations link to the reference list, which links back; {ref:..} links
// to the figure, table, equation or section; maths is MathML. Figures and tables are collected for Evidence.
import { esc } from "./studies-markdown.mjs";
import { blocks, inline } from "./findings-paper.mjs";
import { mathml } from "./findings-math.mjs";
import { mark } from "./findings-marks.mjs";

// ctx: one per page. rec, the published pages ({id: href}), the glossary ({key: entry}) for this finding
export function context(rec, pages, glossary, plate) {
  const refs = Object.fromEntries(rec.references.map((r, i) => [r.id, { ...r, n: i + 1 }]));
  return { rec, id: rec.document.id, pages, glossary, plate, refs, claims: Object.fromEntries(rec.claims.map((c) => [c.id, c])),
    seenClaims: new Set(), traces: [], termUses: [], citeUses: {}, numbers: {}, sectionTitles: {}, figures: [], tables: [],
    linkedF: new Set(), section: null, ids: new Set() };
}

const uid = (ctx, base) => { let id = base, k = 2; while (ctx.ids.has(id)) id = `${base}-${k++}`; ctx.ids.add(id); return id; };
const anchorOf = (label) => label.replace(":", "-");

// number every figure, table, equation and section in reading order, before any prose is written
export function numberLabels(ctx) {
  const count = { fig: 0, tab: 0, eq: 0 };
  for (const s of ctx.rec.document.sections) {
    ctx.sectionTitles[`sec:${s.id}`] = s.title;
    for (const p of s.paragraphs) for (const b of blocks(p)) {
      const kind = (b.label || "").split(":")[0];
      if (count[kind] !== undefined) ctx.numbers[b.label] = ++count[kind];
    }
  }
}

// numbers in running prose take their own colour (class n); the colour is decoration, the digits stay text
const NUM = /(?<![\w.#&;-])([-+\u2212]?\d[\d,]*(?:\.\d+)?%?)(?![\w])/g;
function text(v, ctx) {
  // the first mention of another published finding in a paragraph links to it; the flag step marks its standing
  const t = esc(v), withNums = ctx.body ? t.replace(NUM, '<span class="n d-fine" data-hue="brass">$1</span>') : t;
  return withNums.replace(/\bF\d+\b/g, (f) => {
    if (f === ctx.id || !ctx.pages[f] || ctx.linkedF.has(f)) return f;
    ctx.linkedF.add(f);
    return `<a href="${ctx.pages[f]}">${f}</a>`;
  });
}

function claim(n, ctx) {
  const c = ctx.claims[n.id], first = !ctx.seenClaims.has(n.id);
  const name = `Claim ${n.id.slice(1)}, ${c.basis}${first ? "" : ", stated again"}. Show its evidence.`;
  const kids = nodes(n.kids, ctx);
  ctx.seenClaims.add(n.id);
  if (first) ctx.traces.push(c);
  return `<span class="rp-claim"${first ? ` id="${n.id}"` : ""}>${kids}</span><a class="cm b-${c.basis}" href="#t-${n.id}" data-claim="${n.id}"${first ? "" : " data-again"} aria-label="${esc(name)}">${mark("basis", c.basis)}<span aria-hidden="true">${n.id}</span></a>`;
}

function term(n, ctx) {
  const g = ctx.glossary[n.key];
  if (!g) throw new Error(`${ctx.id}: no glossary entry for ${n.key}`);
  const id = uid(ctx, `use-${n.key}`);
  ctx.termUses.push({ key: n.key, scope: g.scope, anchor: id, section: ctx.section });
  const [first, rest] = shortDefinition(g.definition);
  return `<a class="gt d-fine" data-hue="rsrch" id="${id}" href="/findings/glossary.html#${g.anchor}">${nodes(n.kids, ctx)}</a><span class="gd" role="note"><span class="sr-only">Definition: </span><b class="gd-t d-fine" data-hue="rsrch">${esc(g.term)}</b> <span class="gd-f">${esc(g.field)}</span> <span class="gd-1">${esc(first)}.</span><span class="gd-more">${rest ? ` ${esc(rest.slice(0, 1).toUpperCase() + rest.slice(1))}.` : ""} <span class="gd-x">Excludes</span> ${esc(g.excludes)}.</span> <a class="gd-full" href="/findings/glossary.html#${g.anchor}" aria-label="Full definition of ${esc(g.term)}">full definition</a></span>`;
}

// Where a definition's short form ends: at its first full stop or semicolon, where a sentence or a whole clause
// closes. A definition with neither is shown whole. A cut at a comma left fragments such as "A rule written in the
// preregistration that."; shortDefinition is exported so a test can hold every short form to a whole sentence.
export function clauseEnd(d) {
  const ends = [d.indexOf("; "), d.indexOf(". ")].filter((i) => i > 0);
  return ends.length ? Math.min(...ends) : d.length;
}

// shortDefinition(definition) -> [the short form without its closing stop, the rest]
export function shortDefinition(definition) {
  const d = definition.slice(0, 1).toUpperCase() + definition.slice(1), cut = clauseEnd(d);
  return [d.slice(0, cut).replace(/[.,;:]$/, ""), d.slice(cut).replace(/^[.,;:]?\s*/, "")];
}

function cite(n, ctx) {
  const parts = n.keys.map((rid) => {
    const r = ctx.refs[rid];
    if (!r) throw new Error(`${ctx.id}: cite ${rid} has no reference`);
    const id = uid(ctx, `cite-${rid}`);
    (ctx.citeUses[rid] ||= []).push({ anchor: id, section: ctx.section });
    return `<a class="cite" id="${id}" href="#ref-${rid}" aria-label="Reference ${r.n}, ${esc(r.key)}">${r.n}</a>`;
  });
  return `<span class="cites">[${parts.join(", ")}]</span>`;
}

function ref(n, ctx) {
  const kind = n.label.split(":")[0];
  if (kind === "sec") {
    const t = ctx.sectionTitles[n.label];
    return t ? `<a href="#${n.label.slice(4)}">${esc(t)}</a>` : esc(n.label.slice(4));
  }
  if (!ctx.numbers[n.label]) throw new Error(`${ctx.id}: {ref:${n.label}} has no target`);
  return `<a class="xref" href="#${anchorOf(n.label)}">${ctx.numbers[n.label]}</a>`;
}

export function nodes(list, ctx) {
  return list.map((n) => {
    if (n.t === "text") return text(n.v, ctx);
    if (n.t === "claim") return claim(n, ctx);
    if (n.t === "term") return term(n, ctx);
    if (n.t === "math") return mathml(n.v);
    if (n.t === "cite") return cite(n, ctx);
    if (n.t === "ref") return ref(n, ctx);
    if (n.t === "i") return `<em>${nodes(n.kids, ctx)}</em>`;
    if (n.t === "b") return `<strong>${nodes(n.kids, ctx)}</strong>`;
    throw new Error(`render: node ${n.t}`);
  }).join("");
}

export const prose = (s, ctx) => { ctx.linkedF = new Set(); return nodes(inline(s), ctx); };

function table(b, ctx) {
  const [head, ...rows] = b.rows;
  const cell = (c, tag, i) => `<${tag}${tag === "th" && i === 0 ? "" : ""} class="${/^[-+]?[\d.,]+%?$|^[-+]?\d/.test(c) ? "num" : ""}">${prose(c, ctx)}</${tag}>`;
  return `<figure class="fd-tab" id="${anchorOf(b.label)}"><figcaption><b>Table ${ctx.numbers[b.label]}.</b> ${prose(b.caption, ctx)}</figcaption>
<div class="st-table" tabindex="0" role="region" aria-label="Table ${ctx.numbers[b.label]}"><table><thead><tr>${head.map((c) => `<th scope="col">${prose(c, ctx)}</th>`).join("")}</tr></thead>
<tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${prose(c, ctx)}</th>` : cell(c, "td", i))).join("")}</tr>`).join("\n")}</tbody></table></div></figure>`;
}

function figure(b, ctx) {
  if (b.src.startsWith("plate-")) return ctx.plate ? ctx.plate(b, ctx, `<b>Figure ${ctx.numbers[b.label]}.</b> ${prose(b.caption, ctx)}`) : "";
  const src = `/findings/src/${ctx.id}/${b.src}`;
  return `<figure class="fd-fig" id="${anchorOf(b.label)}"><img src="${src}" alt="${esc(b.alt)}" loading="lazy" decoding="async">
<figcaption><b>Figure ${ctx.numbers[b.label]}.</b> ${prose(b.caption, ctx)}</figcaption></figure>`;
}

// one section's paragraphs as HTML; figures and tables go to Evidence unless keep is set (the appendix keeps its own)
export function sectionBody(sec, ctx, { keep = false } = {}) {
  ctx.section = sec.id;
  const out = [];
  let list = [];
  const flush = () => { if (list.length) { out.push(`<ul>${list.join("")}</ul>`); list = []; } };
  sec.paragraphs.forEach((p, pi) => { for (const b of blocks(p)) {
    if (b.kind !== "li") flush();
    if (b.kind === "p") { const before = ctx.traces.length; ctx.body = true; const html = prose(b.text, ctx); ctx.body = false; out.push(`<div class="para"><p>${html}</p></div>${traces(ctx, before)}`); }
    else if (b.kind === "li") { const before = ctx.traces.length; ctx.body = true; const li = prose(b.text, ctx); ctx.body = false; list.push(`<li>${li}${traces(ctx, before)}</li>`); }
    else if (b.kind === "subsection") out.push(`<h3${b.label ? ` id="${anchorOf(b.label)}"` : ""}>${esc(b.text)}</h3>`);
    else if (b.kind === "eq") out.push(`<div class="eq" id="${anchorOf(b.label)}">${mathml(b.text, true)}<span class="eqn" aria-label="equation ${ctx.numbers[b.label]}">(${ctx.numbers[b.label]})</span></div>`);
    else if (b.kind === "figure") { if (b.src.startsWith("plate-") || keep) out.push(figure(b, ctx)); else ctx.figures.push(figure(b, ctx)); }
    else if (b.kind === "table") { if (keep) out.push(table(b, ctx)); else ctx.tables.push(table(b, ctx)); }
    else throw new Error(`render: block ${b.kind}`);
  }
  // charts that support a claim stated in this paragraph sit straight after it (scripts/findings-charts.mjs)
  const charts = ctx.charts ? ctx.charts.after(sec.id, pi) : ""; if (charts) { flush(); out.push(charts); } });
  flush();
  return out.join("\n");
}

// the trace of every claim first stated since `from`: its numbers with their check, what it rests on, its basis
function traces(ctx, from) {
  return ctx.traces.slice(from).map((c) => {
    const ev = (c.evidence || []).map((eid) => ctx.rec.evidence.find((e) => e.id === eid));
    const rows = ev.map((e) => `<dt>${esc(e.label)}</dt><dd><span class="num">${esc(e.value)}</span> <span class="chk r-${e.check.result}">${e.check.result === "match" ? "matches the result file" : esc(e.check.result.replace("_", " "))}, ${esc(e.check.date || "")}</span></dd>`);
    for (const rid of c.refs || []) rows.push(`<dt>Rests on</dt><dd><a href="#ref-${rid}">${esc(ctx.refs[rid].key)}</a></dd>`);
    for (const f of ctx.charts ? ctx.charts.forClaim(c.id) : []) rows.push(`<dt>Chart ${f.n}</dt><dd><a href="#ch-${f.key}">${esc(f.title)}</a></dd>`);
    rows.push(`<dt>Basis</dt><dd>${c.basis === "observed" ? "observed: measured in this study, with a result file" : "inferred: argued on this page from the observed results"}</dd>`);
    if (!ev.length) rows.push(`<dt>Numbers</dt><dd>None in the sentence; it reads the numbers stated beside it.</dd>`);
    return `<details class="trace b-${c.basis}" id="t-${c.id}"><summary><span class="tid">${c.id}</span> ${mark("basis", c.basis)} ${c.basis}<span class="sr-only">, evidence for claim ${c.id.slice(1)}</span></summary><dl>${rows.join("")}</dl></details>`;
  }).join("");
}
