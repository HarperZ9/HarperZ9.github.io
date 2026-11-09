// findings-chart-forms.mjs: the drawn part of a findings chart. Each form is built from positioned HTML and a little
// SVG, so text keeps its size at any width and the plot reflows on a phone. Row forms (band, interval, bars,
// dumbbell) share one track layout; xy forms (line, scatter) share one plot; matrix and rules are real tables.
// Series are told apart by marker shape and by colour, and every value drawn is also printed beside its row or in
// the chart's data table.
import { esc } from "./studies-markdown.mjs";

const SHAPE = ['<path d="M7 .8 13.2 7 7 13.2 .8 7Z"/>', '<rect x="1.8" y="1.8" width="10.4" height="10.4"/>', '<path d="M7 1.2 13.2 12.6H.8Z"/>',
  '<circle cx="7" cy="7" r="5.6"/>', '<path d="M7 12.8 13.2 1.4H.8Z"/>', '<path d="M5 1H9V5H13V9H9V13H5V9H1V5H5Z"/>'];
export const SHAPE_WORD = ["diamond", "square", "triangle", "circle", "down-pointing triangle", "cross"];
export const marker = (s = 0) => `<svg class="fc-m s${s}" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">${SHAPE[s]}</svg>`;
const pct = (v) => `${Math.round(v * 1000) / 1000}%`;
const num = (v) => String(Number(Number(v).toPrecision(10)));
const fmt = (v) => num(v).replace("-", "\u2212");
// a tick label at either end of the axis is set inside the plot, so it is never cut by the page edge
const edge = (p) => (p < 4 ? "e0" : p > 96 ? "e1" : "");
export const logWord = (axis, label) => (axis && axis.log && !/log/i.test(label || "") ? ", log scale" : "");

// a linear or log scale over the values, with ticks on round numbers
export function scale(axis = {}, values) {
  const v = values.filter((x) => Number.isFinite(x) && (!axis.log || x > 0));
  let lo = axis.min ?? Math.min(...v), hi = axis.max ?? Math.max(...v);
  if (axis.zero && !axis.log) { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
  if (axis.log) {
    const la = axis.min > 0 ? Math.log10(axis.min) : Math.floor(Math.log10(lo) + 1e-9), lb0 = axis.max > 0 ? Math.log10(axis.max) : Math.ceil(Math.log10(hi) - 1e-9), lb = lb0 > la ? lb0 : la + 1;
    const every = Math.ceil(Math.max(1, Math.floor(lb + 1e-9) - Math.ceil(la - 1e-9)) / 6);
    const ticks = []; for (let k = Math.ceil(la - 1e-9); k <= lb + 1e-9; k += every) ticks.push(10 ** k);
    const f = (x) => (Math.log10(x) - la) / (lb - la) * 100;
    return { lo: 10 ** la, hi: 10 ** lb, ticks, pos: f, label: (t) => (t >= 1e5 || t < 1e-4 ? `1e${fmt(Math.round(Math.log10(t)))}` : fmt(t)) };
  }
  if (hi === lo) { hi += 1; lo -= 1; }
  const raw = (hi - lo) / 5, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) * mag;
  if (axis.min === undefined) lo = Math.floor(lo / step + 1e-9) * step; if (axis.max === undefined) hi = Math.ceil(hi / step - 1e-9) * step;
  const ticks = []; for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + step * 1e-6; t += step) ticks.push(Math.abs(t) < step * 1e-9 ? 0 : t);
  return { lo, hi, ticks, pos: (x) => (x - lo) / (hi - lo) * 100, label: (t) => fmt(t) + (axis.percent ? "%" : "") };
}

const refsOf = (ch) => (ch.axis && ch.axis.refs) || [];

// band, interval, bars, dumbbell: one row per item on a shared horizontal scale
export function rowsForm(ch) {
  const vals = [];
  for (const r of ch.rows) for (const k of ["value", "lo", "hi", "mean", "a", "b", "lo2", "hi2"]) if (Number.isFinite(r[k])) vals.push(r[k]);
  for (const f of refsOf(ch)) vals.push(f.value);
  for (const g of (ch.axis && ch.axis.regions) || []) vals.push(g.from, g.to);
  const sc = scale({ ...ch.axis, zero: ch.form === "bars" ? !(ch.axis && ch.axis.log) : ch.axis && ch.axis.zero }, vals);
  const cl = (p) => Math.max(0, Math.min(100, p));
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
      // two values closer than a marker's width are set one above the other, so neither hides the other
      const near = Number.isFinite(r.a) && Number.isFinite(r.b) && Math.abs(cl(sc.pos(r.a)) - cl(sc.pos(r.b))) < 4;
      if (Number.isFinite(r.a)) marks += `<span class="fc-pt${near ? " up" : ""}" style="left:${at(r.a)}">${marker(ch.a_series ?? 0)}</span>`;
      if (Number.isFinite(r.b)) marks += `<span class="fc-pt${near ? " dn" : ""}" style="left:${at(r.b)}">${marker(ch.b_series ?? 1)}</span>`;
    }
    out.push(`<div class="fc-row${ch.form === "dumbbell" ? " tall" : ""}"><div class="fc-lab">${esc(r.label)}</div><div class="fc-track">${under}${marks}</div><div class="fc-note">${esc(r.note || "")}</div></div>`);
  }
  const ticks = sc.ticks.map((t) => `<span class="${edge(sc.pos(t))}" style="left:${at(t)}">${esc(sc.label(t))}</span>`).join("");
  out.push(`<div class="fc-row fc-axis" aria-hidden="true"><div class="fc-lab"></div><div class="fc-track fc-ticks">${ticks}</div><div class="fc-note"></div></div>`);
  return `<div class="fc-rows">${out.join("\n")}</div>\n<p class="fc-axl">${esc(ch.axis && ch.axis.label ? ch.axis.label : ch.units)}${logWord(ch.axis, ch.axis && ch.axis.label ? ch.axis.label : ch.units)}</p>`;
}

// the slot of each named series in a line or scatter chart: its own `series` number, else its order of first use
export function xySlots(ch) {
  const m = new Map();
  for (const p of ch.panels || [{ series: ch.series }]) for (const s of p.series) if (!m.has(s.name)) m.set(s.name, { k: (s.series ?? m.size) % 6, dashed: !!s.dashed, markers: s.markers !== false, line: ch.form === "line" && s.line !== false });
  return m;
}

const inside = (placed, x, y, k) => {
  const n = placed.filter((q) => q.k !== k && Math.abs(q.x - x) < 2.6 && Math.abs(q.y - y) < 4.2).length;
  placed.push({ x, y, k });
  return n ? ` in${Math.min(n, 2)}` : "";
};

// line and scatter: one or more panels on shared scales; each panel holds up to three series
export function xyForm(ch) {
  const panels = ch.panels || [{ title: "", series: ch.series }];
  const xs = [], ys = [];
  for (const p of panels) for (const s of p.series) for (const [x, y] of s.points) { xs.push(x); ys.push(y); }
  for (const f of (ch.y && ch.y.refs) || []) ys.push(f.value);
  if (ch.diagonal) { xs.push(...ys); ys.push(...xs); }
  const sx = scale(ch.x, xs), sy = scale(ch.y, ys);
  const X = (v) => Math.max(0, Math.min(100, sx.pos(v))), Y = (v) => 100 - Math.max(0, Math.min(100, sy.pos(v)));
  const slots = xySlots(ch);
  const draw = (p) => {
    let svg = sy.ticks.map((t) => `<path class="g" d="M0 ${Y(t)}H100"/>`).join("");
    for (const f of (ch.y && ch.y.refs) || []) svg += `<path class="ref" d="M0 ${Y(f.value)}H100"/>`;
    if (ch.diagonal) svg += `<path class="ref" d="M${X(Math.max(sx.lo, sy.lo))} ${Y(Math.max(sx.lo, sy.lo))}L${X(Math.min(sx.hi, sy.hi))} ${Y(Math.min(sx.hi, sy.hi))}"/>`;
    let pts = "";
    const placed = []; // a marker that lands on another series' marker is drawn smaller, inside it, at the same point
    for (const s of p.series) {
      const k = slots.get(s.name).k, list = s.points.filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y) && (!ch.y || !ch.y.log || y > 0) && (!ch.x || !ch.x.log || x > 0));
      if (s.line !== false && ch.form === "line") svg += `<polyline class="l s${k}${s.dashed ? " d" : ""}" points="${list.map(([x, y]) => `${num(X(x))},${num(Y(y))}`).join(" ")}"/>`;
      if (s.markers === false) continue;
      for (const [x, y, tip] of list) pts += `<span class="fc-pt${inside(placed, X(x), Y(y), k)}" style="left:${pct(X(x))};top:${pct(Y(y))}" tabindex="0">${marker(k)}<span class="fc-tip">${esc(tip || `${s.name}: ${fmt(x)}, ${fmt(y)}`)}</span></span>`;
    }
    const yt = sy.ticks.map((t) => `<span style="top:${pct(Y(t))}">${esc(sy.label(t))}</span>`).join("");
    const xt = sx.ticks.map((t) => `<span class="${edge(X(t))}" style="left:${pct(X(t))}">${esc(sx.label(t))}</span>`).join("");
    return `<div class="fc-panel">${p.title ? `<p class="fc-ptitle">${esc(p.title)}</p>` : ""}<div class="fc-xy"><div class="fc-yt" aria-hidden="true">${yt}</div><div class="fc-plot"><svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" focusable="false">${svg}</svg>${pts}</div><div class="fc-xt" aria-hidden="true">${xt}</div></div></div>`;
  };
  return `<p class="fc-axl y">${esc(ch.y.label)}${logWord(ch.y, ch.y.label)}</p>\n<div class="fc-panels n${Math.min(panels.length, 4)}">${panels.map(draw).join("\n")}</div>\n<p class="fc-axl">${esc(ch.x.label)}${logWord(ch.x, ch.x.label)}</p>`;
}

// matrix: a real table whose cells are shaded by value in one hue with the number printed. The shade stops at 58
// percent of the ink, where the page's text colour still reads at 4.5 to 1 or better on the cell.
export function matrixForm(ch) {
  const flat = ch.values.flat().filter(Number.isFinite), lo = Math.min(...flat), hi = Math.max(...flat);
  const cell = (v, text) => { const k = hi > lo ? (v - lo) / (hi - lo) : 0; return `<td class="num" style="--k:${Math.round(k * 58)}%">${esc(text)}</td>`; };
  return `<div class="st-table fc-matrix" tabindex="0" role="region" aria-label="${esc(ch.title)}"><table><thead><tr><th scope="col">${esc(ch.corner || "")}</th>${ch.cols.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${ch.rowLabels.map((r, i) => `<tr><th scope="row">${esc(r)}</th>${ch.values[i].map((v, j) => (Number.isFinite(v) ? cell(v, ch.text ? ch.text[i][j] : num(v)) : "<td></td>")).join("")}</tr>`).join("\n")}</tbody></table></div>`;
}

const HELD = '<svg class="fc-v" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><path d="M2 7.5 5.6 11 12 3.5" fill="none" stroke-width="2"/></svg>';
const FAILED = '<svg class="fc-v" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 3 11 11M11 3 3 11" fill="none" stroke-width="2"/></svg>';
const NONE = '<svg class="fc-v" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false"><path d="M3 7H11" fill="none" stroke-width="2"/></svg>';
// the glyph carries the verdict colour; the word is set in the text colour so it reads on any ground
export const verdict = (holds, yes = "held", no = "failed", na = "not testable") => (holds == null
  ? `<span class="fc-verdict na">${NONE}<b>${esc(na || "not testable")}</b></span>`
  : `<span class="fc-verdict ${holds ? "ok" : "no"}">${holds ? HELD : FAILED}<b>${esc(holds ? yes : no)}</b></span>`);

// rules: each rule set in advance, the value it tested, the bar it had to clear and whether it held
export function rulesForm(ch) {
  const h = ch.columns && ch.columns.length === 4 ? ch.columns : ["Rule set in advance", "Value", "Bar", "Result"];
  const row = (r) => `<tr><th scope="row">${esc(r.label)}</th><td class="num" data-h="${esc(h[1])}">${esc(r.left)}</td><td class="num" data-h="${esc(h[2])}">${esc(r.right)}</td><td class="fc-res">${verdict(r.holds, r.yes, r.no, r.na)}</td></tr>`;
  return `<div class="st-table fc-rules" tabindex="0" role="region" aria-label="${esc(ch.title)}"><table><thead><tr>${h.map((c) => `<th scope="col">${esc(c)}</th>`).join("")}</tr></thead>
<tbody>${ch.rows.map(row).join("")}</tbody></table></div>`;
}

// flow: a study's design or a mechanism drawn as numbered steps on one line, read left to right (top to bottom on a
// phone). It is an ordered list, so the drawing is its own text. Each step sits on one strong rule under a numbered
// disc, with a glyph for its part in the design; the verdict's disc is the one coloured disc on the line.
const GLYPH = {
  data: '<circle cx="7" cy="7" r="5.2"/>', measure: SHAPE[0], control: '<rect x="1" y="4" width="12" height="6" rx="1"/>',
  planted: SHAPE[2], rule: '<path d="M7 .5V13.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-dasharray="3 2.4"/>',
};
export const FLOW_WORD = { data: "data", measure: "measurement", control: "control", planted: "planted check", rule: "rule set in advance", verdict: "verdict" };
export function flowForm(ch) {
  const step = (s, i) => {
    const g = s.kind === "verdict" ? verdict(s.holds, s.yes || "held", s.no || "failed", s.na) : `<svg class="fc-g2 k-${s.kind}" viewBox="0 0 14 14" width="14" height="14" aria-hidden="true" focusable="false">${GLYPH[s.kind] || GLYPH.data}</svg><span class="fc-kind">${esc(FLOW_WORD[s.kind] || s.kind)}</span>`;
    return `<li class="fc-step k-${esc(s.kind)}${s.kind === "verdict" ? (s.holds == null ? " v-na" : s.holds ? " v-ok" : " v-no") : ""}${s.branch ? " branch" : ""}"><span class="fc-stepn" aria-hidden="true">${i + 1}</span><span class="fc-stepk">${g}</span><b>${esc(s.label)}</b>${s.detail ? `<span class="fc-stepd">${esc(s.detail)}</span>` : ""}</li>`;
  };
  return `<ol class="fc-flow">${ch.steps.map(step).join("")}</ol>`;
}

export const FORMS = { flow: flowForm,  band: rowsForm, interval: rowsForm, bars: rowsForm, dumbbell: rowsForm, line: xyForm, scatter: xyForm, matrix: matrixForm, rules: rulesForm };
