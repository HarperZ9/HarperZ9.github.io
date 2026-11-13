// findings-charts.mjs: the charts of one finding, placed beside the claims they support.
//
// findings/charts/<id>.json holds, per chart: the question it answers, a one-line takeaway, the claims it supports,
// its form and data, n, units, what the interval is, the threshold set in advance, the planted-check result, a data
// table, and the result file it was read from with two hashes (the run's own file and the published copy, which
// has file paths cut to the file name and may differ in layout, never in a value). Nothing here computes a result: every number comes from the
// chart file, which an extractor wrote from the study's result file.
import { esc } from "./studies-markdown.mjs";
import { FORMS, marker, xySlots } from "./findings-chart-forms.mjs";

export const FORM_NAMES = Object.keys(FORMS);
const FLOW_NEED = ["key", "form", "title", "takeaway", "claims", "source", "steps"];
const NEED = ["key", "form", "title", "takeaway", "claims", "units", "n", "source", "columns", "table"];

export function checkSpec(spec, rec) {
  const errs = [], id = spec.finding, claimIds = new Set(rec.claims.map((c) => c.id)), keys = new Set();
  const src = Object.fromEntries((spec.sources || []).map((s) => [s.id, s]));
  for (const s of spec.sources || []) for (const k of ["id", "name", "sha256_original", "sha256_copy", "href"]) if (!s[k]) errs.push(`${id}: source ${s.id || "?"} lacks ${k}`);
  for (const ch of spec.charts || []) {
    const flow = ch.form === "flow";
    for (const k of flow ? FLOW_NEED : NEED) if (ch[k] === undefined || ch[k] === "" || (Array.isArray(ch[k]) && !ch[k].length)) errs.push(`${id} ${ch.key}: lacks ${k}`);
    if (!FORMS[ch.form]) errs.push(`${id} ${ch.key}: no form ${ch.form}`);
    if (keys.has(ch.key)) errs.push(`${id}: chart key ${ch.key} used twice`); keys.add(ch.key);
    for (const c of ch.claims || []) if (!claimIds.has(c)) errs.push(`${id} ${ch.key}: claim ${c} is not in the record`);
    for (const s of [].concat(ch.source || [])) if (!src[s]) errs.push(`${id} ${ch.key}: source ${s} is not listed`);
    for (const r of ch.table || []) if (r.length !== ch.columns.length) errs.push(`${id} ${ch.key}: a table row has ${r.length} cells for ${ch.columns.length} columns`);
    if (!flow && ch.interval === undefined) errs.push(`${id} ${ch.key}: interval must be stated, or null with no_interval saying why`);
    if (ch.interval === null && !ch.no_interval) errs.push(`${id} ${ch.key}: no interval and no reason`);
  }
  return errs;
}

// where each chart goes: after the first paragraph of an argument section that states one of its claims, else after
// the first paragraph anywhere that does, else the Evidence landmark
export function chartsFor(rec, spec) {
  if (!spec) return null;
  const errs = checkSpec(spec, rec);
  if (errs.length) throw new Error(errs.join("\n"));
  const slots = [];
  rec.document.sections.forEach((s, si) => s.paragraphs.forEach((p, pi) => {
    const ids = [...p.matchAll(/\{(c\d+)\}/g)].map((m) => m[1]);
    if (ids.length) slots.push({ sec: s.id, role: s.role, si, pi, ids });
  }));
  const placed = spec.charts.map((ch, order) => {
    const hit = (f) => slots.find((sl) => f(sl) && sl.ids.some((c) => ch.claims.includes(c)));
    const at = ch.at ? slots.find((sl) => sl.sec === ch.at && sl.ids.some((c) => ch.claims.includes(c))) || { sec: ch.at, si: rec.document.sections.findIndex((s) => s.id === ch.at), pi: 0 } : hit((sl) => sl.role === "argument") || hit(() => true);
    return { ch, order, at: at && at.si >= 0 ? at : null };
  }).sort((a, b) => (a.at ? a.at.si : 1e6) - (b.at ? b.at.si : 1e6) || (a.at ? a.at.pi : 0) - (b.at ? b.at.pi : 0) || a.order - b.order);
  placed.forEach((p, i) => { p.n = i + 1; });
  const src = Object.fromEntries(spec.sources.map((s) => [s.id, s]));
  const html = (p) => chartHtml(p.ch, p.n, src, rec.document.id);
  return {
    after: (secId, pi) => placed.filter((p) => p.at && p.at.sec === secId && p.at.pi === pi).map(html).join("\n"),
    rest: () => placed.filter((p) => !p.at).map(html).join("\n"),
    forClaim: (cid) => placed.filter((p) => p.ch.claims.includes(cid)).map((p) => ({ n: p.n, key: p.ch.key, title: p.ch.title })),
    count: placed.length,
  };
}

// the legend lists only the marks a chart draws: each used series slot with its shape, then ranges, rules and regions
function legend(ch) {
  const it = [], rows = ch.rows || [], sn = ch.series_names || [];
  const used = [...new Set(rows.map((r) => r.series || 0))].sort((a, b) => a - b);
  if (ch.form === "band") {
    if (used.length > 1 && used.every((s) => sn[s])) used.forEach((s) => it.push([marker(s), sn[s]]));
    else it.push([used.map((s) => marker(s)).join(""), ch.value_name || "measured value"]);
    if (rows.some((r) => Number.isFinite(r.lo))) it.push(['<i class="fc-k band"></i>', ch.band_name || "control range, 5th to 95th percentile"]);
    if (rows.some((r) => Number.isFinite(r.mean))) it.push(['<i class="fc-k tick"></i>', ch.tick_name || "control mean"]);
  } else if (ch.form === "dumbbell") it.push([marker(ch.a_series ?? 0), ch.a_name], [marker(ch.b_series ?? 1), ch.b_name]);
  else if (ch.form === "line" || ch.form === "scatter") {
    const sl = xySlots(ch);
    if (sl.size > 1) for (const [name, s] of sl) it.push([s.markers ? marker(s.k) : `<i class="fc-k ln s${s.k}${s.dashed ? " d" : ""}"></i>`, name]);
  } else if (sn.length && (sn.length > 1 || ch.form === "interval") && !sn.every((n) => rows.some((r) => r.label === n))) used.filter((s) => sn[s]).forEach((s) => it.push([ch.form === "bars" ? `<i class="fc-k bar s${s}"></i>` : marker(s), sn[s]]));
  if (ch.form === "interval" && ch.interval) it.push(['<i class="fc-k wh"></i>', ch.interval]);
  ((ch.axis && ch.axis.refs) || (ch.y && ch.y.refs) || []).forEach((f, i) => it.push([`<i class="fc-k ref r${i % 2}"></i>`, f.label]));
  for (const g of (ch.axis && ch.axis.regions) || []) it.push(['<i class="fc-k region"></i>', g.label]);
  if (ch.diagonal) it.push(['<i class="fc-k ref r0"></i>', ch.diagonal]);
  return it.length ? `<ul class="fc-legend">${it.map(([m, t]) => `<li><span class="fc-lk">${m}</span><span>${esc(t)}</span></li>`).join("")}</ul>` : "";
}

const isNum = (c) => /^[-+−]?[\d.,]+(?:e[-+]?\d+)?%?$/i.test(String(c));
function dataTable(ch, n) {
  return `<details class="fc-data"><summary>Data behind chart ${n} <span class="fc-rowsn">${ch.table.length} row${ch.table.length === 1 ? "" : "s"}</span></summary>
<div class="st-table" tabindex="0" role="region" aria-label="Data behind chart ${n}"><table><thead><tr>${ch.columns.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${ch.table.map((r) => `<tr>${r.map((c, i) => (i === 0 ? `<th scope="row">${esc(c)}</th>` : `<td${isNum(c) ? ' class="num"' : ""}>${esc(c)}</td>`)).join("")}</tr>`).join("\n")}</tbody></table></div></details>`;
}

function sourceLine(ch, src) {
  return [].concat(ch.source).map((sid) => {
    const s = src[sid];
    return `<p class="fc-src">Read from <a href="${esc(s.href)}">${esc(s.name)}</a>${s.run ? `, run ${esc(s.run)}` : ""}. <span class="fc-hash">SHA-256 of the run's file <code>${esc(s.sha256_original)}</code></span>${s.sha256_copy === s.sha256_original ? ", published unchanged." : ` <span class="fc-hash">and of the published copy <code>${esc(s.sha256_copy)}</code></span>. In the copy, file paths are cut to the file name and the layout (indentation, line endings) may differ; every value is the same.`}</p>`;
  }).join("");
}

export function chartHtml(ch, n, src, id) {
  const meta = ch.form === "flow" ? (ch.n ? [["n", ch.n]] : []) : [["n", ch.n], ["Units", ch.units], ["Interval", ch.interval || ch.no_interval]];
  if (ch.baseline) meta.push(["Baseline or control", ch.baseline]);
  if (ch.threshold) meta.push(["Set in advance", ch.threshold]);
  if (ch.planted) meta.push(["Planted check", ch.planted]);
  if (ch.ruled_out) meta.push(["Ruled out", ch.ruled_out]);
  meta.push(["Supports", ch.claims.map((c) => `<a href="#${c}">claim ${c.slice(1)}</a>`).join(", ")]);
  const flow = ch.form === "flow", word = flow ? "Diagram" : "Chart";
  const shapes = ch.form === "matrix" || ch.form === "rules" || flow ? "" : " Marks differ by shape and by colour.";
  const live = ch.live ? `<div class="fc-live" data-live="${esc(ch.live.kind)}" data-src="${esc(ch.live.data)}"><noscript><p>The live re-run needs JavaScript. The chart and table above hold the study's own numbers.</p></noscript></div>` : "";
  return `<figure class="fc fk-${ch.form}" id="ch-${esc(ch.key)}" data-finding="${esc(id)}">
<figcaption><b>${word} ${n}.</b> ${esc(ch.title)} <span class="fc-take">${esc(ch.takeaway)}</span></figcaption>
<div class="fc-draw" role="group" aria-label="${word} ${n}: ${esc(ch.takeaway)}${shapes}${flow ? "" : " The same numbers are in the table below."}">
${FORMS[ch.form](ch)}
</div>
${legend(ch)}
<dl class="fc-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${k === "Supports" ? v : esc(v)}</dd></div>`).join("")}</dl>
${live}
${flow ? "" : dataTable(ch, n)}
${sourceLine(ch, src)}
</figure>`;
}
