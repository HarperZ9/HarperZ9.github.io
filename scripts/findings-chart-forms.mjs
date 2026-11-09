// findings-chart-forms.mjs: the drawn part of a findings chart. Each form is built from positioned HTML and a little
// SVG, so text keeps its size at any width and the plot reflows on a phone. Row forms (band, interval, bars,
// dumbbell) share one track layout; xy forms (line, scatter) share one plot; matrix and rules are real tables.
// Series are told apart by marker shape and by colour, and every value drawn is also printed beside its row or in
// the chart's data table.
import { esc } from "./studies-markdown.mjs";

const SHAPE = ['<path d="M7 .8 13.2 7 7 13.2 .8 7Z"/>', '<rect x="1.8" y="1.8" width="10.4" height="10.4"/>', '<path d="M7 1.2 13.2 12.6H.8Z"/>'];
export const SHAPE_WORD = ["diamond", "square", "triangle"];
export const marker = (s = 0) => `<svg class="fc-m s${s}" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">${SHAPE[s]}</svg>`;
const pct = (v) => `${Math.round(v * 1000) / 1000}%`;
const num = (v) => String(Number(Number(v).toPrecision(10)));

// a linear or log scale over the values, with ticks on round numbers
export function scale(axis = {}, values) {
  const v = values.filter((x) => Number.isFinite(x) && (!axis.log || x > 0));
  let lo = axis.min ?? Math.min(...v), hi = axis.max ?? Math.max(...v);
  if (axis.zero && !axis.log) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (axis.log) {
    const a = Math.floor(Math.log10(lo) + 1e-9), b = Math.ceil(Math.log10(hi) - 1e-9), n = Math.max(1, b - a), every = Math.ceil(n / 6);
    const ticks = []; for (let k = a; k <= a + n; k += every) ticks.push(10 ** k);
    const f = (x) => (Math.log10(x) - a) / n * 100;
    return { lo: 10 ** a, hi: 10 ** (a + n), ticks, pos: f, label: (t) => (t >= 1e5 || t < 1e-4 ? `1e${Math.round(Math.log10(t))}` : num(t)) };
  }
  if (hi === lo) { hi += 1; lo -= 1; }
  const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) * mag;
  if (axis.min === undefined) lo = Math.floor(lo / step + 1e-9) * step; if (axis.max === undefined) hi = Math.ceil(hi / step - 1e-9) * step;
  const ticks = []; for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + step * 1e-6; t += step) ticks.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return { lo, hi, ticks, pos: (x) => (x - lo) / (hi - lo) * 100, label: (t) => num(t) + (axis.percent ? "%" : "") };
}

const refsOf = (ch) => (ch.axis && ch.axis.refs) || [];

// band, interval, bars, dumbbell: one row per item on a shared horizontal scale
export function rowsForm(ch) {
  const vals = [];
  for (const r of ch.rows) for (const k of ["value", "lo", "hi", "mean", "a", "b", "lo2", "hi2"]) if (Number.isFinite(r[k])) vals.push(r[k]);
  for (const f of refsOf(ch)) vals.push(f.value);
  for (const g of (ch.axis && ch.axis.regions) || []) vals.push(g.from, g.to);
  const sc = scale({ ...ch.axis, zero: ch.form === "bars" ? !(ch.axis && ch.axis.log) : ch.axis && ch.axis.zero }, vals);
  const at = (x) => pct(Math.max(0, Math.min(100, sc.pos(x)))), span = (a, b) => { const p = Math.max(0, Math.min(100, sc.pos(Math.min(a, b)))), q = Math.max(0, Math.min(100, sc.pos(Math.max(a, b)))); return `left:${pct(p)};width:${pct(q - p)}`; };
  const base = ch.axis && ch.axis.log ? sc.lo : Math.max(sc.lo, Math.min(sc.hi, 0));
  const under = sc.ticks.map((t) => `<i class="fc-g" style="left:${at(t)}"></i>`).join("")
    + ((ch.axis && ch.axis.regions) || []).map((g) => `<i class="fc-region" style="${span(g.from, g.to)}"></i>`).join("")
    + refsOf(ch).map((f, i) => `<i class="fc-ref r${i % 2}" style="left:${at(f.value)}"></i>`).join("");
  const out = [];
  let group = null;
  for (const r of ch.rows) {
    if (r.group && r.group !== group) { group = r.group; out.push(`<div class="fc-group">${esc(group)}</div>`); }
    const s = r.series || 0;
    let marks = "";
    if (ch.form === "band") {
      if (Number.isFinite(r.lo)) marks += `<i class="fc-band" style="${span(r.lo, r.hi)}"></i>`;
      if (Number.isFinite(r.mean)) marks += `<i class="fc-tick" style="left:${at(r.mean)}"></i>`;
      if (Number.isFinite(r.value)) marks += `<span class="fc-pt" style="left:${at(r.value)}">${marker(s)}</span>`;
    } else if (ch.form === "interval") {
      if (Number.isFinite(r.lo2)) marks += `<i class="fc-wh thin s${s}" style="${span(r.lo2, r.hi2)}"></i>`;
      if (Number.isFinite(r.lo)) marks += `<i class="fc-wh s${s}" style="${span(r.lo, r.hi)}"></i>`;
      if (Number.isFinite(r.value)) marks += `<span class="fc-pt" style="left:${at(r.value)}">${marker(s)}</span>`;
    } else if (ch.form === "bars") {
      if (Number.isFinite(r.value)) marks += `<i class="fc-bar s${s}${r.value < base ? " neg" : ""}" style="${span(base, r.value)}"></i>`;
      if (Number.isFinite(r.lo)) marks += `<i class="fc-wh ink" style="${span(r.lo, r.hi)}"></i>`;
    } else if (ch.form === "dumbbell") {
      if (Number.isFinite(r.a) && Number.isFinite(r.b)) marks += `<i class="fc-join" style="${span(r.a, r.b)}"></i>`;
      if (Number.isFinite(r.a)) marks += `<span class="fc-pt" style="left:${at(r.a)}">${marker(0)}</span>`;
      if (Number.isFinite(r.b)) marks += `<span class="fc-pt" style="left:${at(r.b)}">${marker(1)}</span>`;
    }
    out.push(`<div class="fc-row"><div class="fc-lab">${esc(r.label)}</div><div class="fc-track">${under}${marks}</div><div class="fc-note">${esc(r.note || "")}</div></div>`);
  }
  const ticks = sc.ticks.map((t) => `<span style="left:${at(t)}">${esc(sc.label(t))}</span>`).join("");
  out.push(`<div class="fc-row fc-axis" aria-hidden="true"><div class="fc-lab"></div><div class="fc-track fc-ticks">${ticks}</div><div class="fc-note"></div></div>`);
  return `<div class="fc-rows">${out.join("\n")}</div>\n<p class="fc-axl">${esc(ch.axis && ch.axis.label ? ch.axis.label : ch.units)}${ch.axis && ch.axis.log ? ", log scale" : ""}</p>`;
}

// line and scatter: one or more panels on shared scales; each panel holds up to three series
export function xyForm(ch) {
  const panels = ch.panels || [{ title: "", series: ch.series }];
  const xs = [], ys = [];
  for (const p of panels) for (const s of p.series) for (const [x, y] of s.points) { xs.push(x); ys.push(y); }
  for (const f of (ch.y && ch.y.refs) || []) ys.push(f.value);
  if (ch.diagonal) { xs.push(...ys); ys.push(...xs); }
  const sx = scale(ch.x, xs), sy = scale(ch.y, ys);
  const X = (v) => Math.max(0, Math.min(100, sx.pos(v))), Y = (v) => 100 - Math.max(0, Math.min(100, sy.pos(v)));
  const names = [...new Set(panels.flatMap((p) => p.series.map((s) => s.name)))];
  const draw = (p) => {
    let svg = sy.ticks.map((t) => `<path class="g" d="M0 ${Y(t)}H100"/>`).join("");
    for (const f of (ch.y && ch.y.refs) || []) svg += `<path class="ref" d="M0 ${Y(f.value)}H100"/>`;
    if (ch.diagonal) svg += `<path class="ref" d="M${X(Math.max(sx.lo, sy.lo))} ${Y(Math.max(sx.lo, sy.lo))}L${X(Math.min(sx.hi, sy.hi))} ${Y(Math.min(sx.hi, sy.hi))}"/>`;
    let pts = "";
    for (const s of p.series) {
      const k = names.indexOf(s.name) % 3, list = s.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!ch.y || !ch.y.log || y > 0) && (!ch.x || !ch.x.log || x > 0));
      if (s.line !== false && ch.form === "line") svg += `<polyline class="l s${k}${s.dashed ? " d" : ""}" points="${list.map(([x, y]) => `${num(X(x))},${num(Y(y))}`).join(" ")}"/>`;
      if (s.markers === false) continue;
      for (const [x, y, tip] of list) pts += `<span class="fc-pt" style="left:${pct(X(x))};top:${pct(Y(y))}" tabindex="0">${marker(k)}<span class="fc-tip">${esc(tip || `${s.name}: ${num(x)}, ${num(y)}`)}</span></span>`;
    }
    const yt = sy.ticks.map((t) => `<span style="top:${pct(Y(t))}">${esc(sy.label(t))}</span>`).join("");
    const xt = sx.ticks.map((t) => `<span style="left:${pct(X(t))}">${esc(sx.label(t))}</span>`).join("");
    return `<div class="fc-panel">${p.title ? `<p class="fc-ptitle">${esc(p.title)}</p>` : ""}<div class="fc-xy"><div class="fc-yt" aria-hidden="true">${yt}</div><div class="fc-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${svg}</svg>${pts}</div><div class="fc-xt" aria-hidden="true">${xt}</div></div></div>`;
  };
  return `<p class="fc-axl y">${esc(ch.y.label)}${ch.y.log ? ", log scale" : ""}</p>\n<div class="fc-panels n${Math.min(panels.length, 4)}">${panels.map(draw).join("\n")}</div>\n<p class="fc-axl">${esc(ch.x.label)}${ch.x.log ? ", log scale" : ""}</p>`;
}

// matrix: a real table whose cells are shaded by value in one hue, light to dark, with the number printed
export function matrixForm(ch) {
  const flat = ch.values.flat().filter(Number.isFinite), lo = Math.min(...flat), hi = Math.max(...flat);
  const cell = (v, text) => { const k = hi > lo ? (v - lo) / (hi - lo) : 0; return `<td class="num${k > 0.55 ? " hi" : ""}" style="--k:${Math.round(k * 100)}%">${esc(text)}</td>`; };
  return `<div class="st-table fc-matrix" tabindex="0" role="region" aria-label="${esc(ch.title)}"><table><thead><tr><th scope="col">${esc(ch.corner || "")}</th>${ch.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${ch.rowLabels.map((r, i) => `<tr><th scope="row">${esc(r)}</th>${ch.values[i].map((v, j) => (Number.isFinite(v) ? cell(v, ch.text ? ch.text[i][j] : num(v)) : "<td></td>")).join("")}</tr>`).join("\n")}</tbody></table></div>`;
}

const HELD = '<svg class="fc-v" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2 7.5 5.6 11 12 3.5" fill="none" stroke-width="2"/></svg>';
const FAILED = '<svg class="fc-v" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 3 11 11M11 3 3 11" fill="none" stroke-width="2"/></svg>';
export const verdict = (holds, yes = "held", no = "failed") => `<span class="fc-verdict ${holds ? "ok" : "no"}">${holds ? HELD : FAILED}${holds ? yes : no}</span>`;

// rules: each rule set in advance, the value it tested, the bar it had to clear and whether it held
export function rulesForm(ch) {
  return `<div class="st-table fc-rules" tabindex="0" role="region" aria-label="${esc(ch.title)}"><table><thead><tr><th scope="col">Rule set in advance</th><th scope="col">Value</th><th scope="col">Bar</th><th scope="col">Result</th></tr></thead>
<tbody>${ch.rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th><td class="num">${esc(r.left)}</td><td class="num">${esc(r.right)}</td><td>${verdict(r.holds, r.yes, r.no)}</td></tr>`).join("\n")}</tbody></table></div>`;
}

// flow: a study's design or a mechanism drawn as numbered steps on one line, read left to right (top to bottom on a
// phone). It is an ordered list, so the drawing is its own text. Each step carries a glyph for its part in the
// design; the one coloured mark is the verdict, as in our earlier diagrams (one hot mark per view).
const GLYPH = {
  data: '<circle cx="7" cy="7" r="5.2"/>', measure: SHAPE[0], control: '<rect x="1" y="4" width="12" height="6" rx="1"/>',
  planted: SHAPE[2], rule: '<path d="M7 .5V13.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.4"/>',
};
export const FLOW_WORD = { data: "data", measure: "measurement", control: "control", planted: "planted check", rule: "rule set in advance", verdict: "verdict" };
export function flowForm(ch) {
  const step = (s, i) => {
    const g = s.kind === "verdict" ? verdict(s.holds, s.yes || "held", s.no || "failed") : `<svg class="fc-g2 k-${s.kind}" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">${GLYPH[s.kind] || GLYPH.data}</svg><span class="fc-kind">${esc(FLOW_WORD[s.kind] || s.kind)}</span>`;
    return `<li class="fc-step k-${esc(s.kind)}${s.branch ? " branch" : ""}"><span class="fc-stepn" aria-hidden="true">( ${i + 1} )</span><span class="fc-stepk">${g}</span><b>${esc(s.label)}</b>${s.detail ? `<span class="fc-stepd">${esc(s.detail)}</span>` : ""}</li>`;
  };
  return `<ol class="fc-flow">${ch.steps.map(step).join("")}</ol>`;
}

export const FORMS = { flow: flowForm,  band: rowsForm, interval: rowsForm, bars: rowsForm, dumbbell: rowsForm, line: xyForm, scatter: xyForm, matrix: matrixForm, rules: rulesForm };
