// elements.js: the element table. mountElements(host, data, { medium }) lays the concepts out as blocks, one per
// sheet, in sheet order, like the blocks of a periodic table. Each element is a real button. Hover, focus or a
// tap runs that element in the well, a FLOW medium of its own; the well's panel names it, gives its measured
// colour (copyable), its bridges to other elements (buttons that move there) and its references (links).
// Keys: arrows move through the table; Enter or Space pins an element; Home and End jump to the ends.
import { createMedium } from "../../directions/common/flow/engine.js";
import { demoFor } from "./demo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// ground as vellum: a cell lies under a sheet as opaque as its distance from ground (its own evidence: a measured law
// weight is grounded, measured properties alone are partial, neither is a thought); the sheet lifts on hover and focus
const VEIL = { grounded: 0, partial: 0.5, thought: 0.85 };
const VIEWS = ["laws", "properties", "text", "references"];
const fmt = (v) => (v == null ? "" : Math.abs(v) >= 100 ? v.toFixed(0) : Math.abs(v) >= 1 ? v.toFixed(2) : v.toPrecision(2));

export function mountElements(host, data, { assets = "" } = {}) {
  // numbers come from the data: contiguous, in path order (PATH-ORDER.md). assets: the base for thumbnail paths.
  const byId = new Map(data.elements.map((e, i) => [e.id, { ...e, n: e.n ?? i + 1 }]));
  const sheets = [...data.sheets].sort((a, b) => a.order - b.order);
  host.classList.add("elements");
  host.innerHTML = `<div class="el-well"><canvas class="el-canvas" aria-hidden="true"></canvas><div class="el-card" aria-live="polite"></div></div>
    <div class="el-blocks">${sheets.map((s) => `<section class="el-block" style="--sheet:${esc(s.colour)}" aria-labelledby="el-${esc(s.id)}">
      <h2 id="el-${esc(s.id)}">${esc(s.id)}</h2><div class="el-cells">${[...byId.values()].filter((e) => e.sheet === s.id).map((e) =>
        `<button type="button" class="el g-${e.ground ?? "thought"}" data-id="${esc(e.id)}" tabindex="-1" style="--veil:${VEIL[e.ground] ?? 0.85}" aria-label="${esc(e.name)}, ${esc(s.id)}, ${e.ground ?? "thought"}"><span class="el-n">${e.n}</span>` +
        `<span class="el-sym">${esc(e.symbol)}</span><span class="el-name">${esc(e.name)}</span>` +
        (e.colour.hex ? `<span class="el-chip" style="--c:${esc(e.colour.hex)}"></span>` : "") + `</button>`).join("")}</div></section>`).join("")}</div>`;

  const cells = [...host.querySelectorAll(".el")], card = host.querySelector(".el-card"), canvas = host.querySelector(".el-canvas");
  cells[0].tabIndex = 0;
  let medium = null;
  try { medium = createMedium(canvas, { element: true, cap: 0.55 }); } catch (e) { console.info("element well without medium:", e.message); }
  if (!medium) canvas.remove(); else host.medium = medium; // reachable for checks (weights, stats)

  let shown = null, pinned = null, pourT = 0, view = "laws";
  function show(id) {
    const e = byId.get(id); if (!e || shown === id) return; shown = id;
    const rec = demoFor(e);
    if (medium) {
      const pour = () => {
        medium.viscosity(rec.viscosity ?? 0.9);
        medium.view(rec.view === "mosaic" ? { mosaic: 6 } : rec.view === "layers" ? { layers: { solo: "ink" } } : {});
        medium.seed(rec.drops);
      };
      clearTimeout(pourT);
      if (medium.still) { medium.reset(); pour(); } // a settled medium shows each element as its own still
      else {
        // the shared space has no walls: the last element is carried off on a current and lifts out of the water,
        // and the next pours into what is left of it
        medium.rinse(2.2, 520).add("current", { x: 0.5, y: 0.5, r: 0.7, vx: 9, vy: -3 });
        pourT = setTimeout(pour, 380);
      }
    }
    const col = e.colour.hex ? `<button type="button" class="sw el-col" data-hex="${esc(e.colour.hex)}" aria-label="colour ${esc(e.colour.hex)}, copy"><span class="sw-ink" style="--sw:${esc(e.colour.hex)}"></span><span class="sw-hex">${esc(e.colour.hex)}</span><span class="sw-name">${esc(e.colour.label)}</span></button>` : "";
    const lawsHTML = e.laws?.length ? `<ol class="el-laws">${e.laws.map((l) => `<li><b>${esc(l.shape.replace(/_/g, " "))}</b>
        <span class="el-w ${l.label === "measured" ? "m" : "u"}">${l.label === "measured" ? `weight ${fmt(l.weight)} (n ${l.n})` : "weight unmeasured"}</span>
        ${l.rule ? `<span class="el-rule">${esc(l.rule)}</span>` : ""}</li>`).join("")}</ol>${e.lawCount > e.laws.length ? `<p class="el-more">${e.lawCount - e.laws.length} more laws</p>` : ""}` : "<p>No law recorded.</p>";
    const propsHTML = e.properties?.length ? `<table class="el-props"><thead><tr><th scope="col">Property</th><th scope="col">Median</th><th scope="col">IQR</th><th scope="col">n</th></tr></thead><tbody>${e.properties.map((p) =>
        `<tr><th scope="row">${esc(p.name)}</th><td>${fmt(p.value)}</td><td>${p.iqr ? fmt(p.iqr[0]) + " to " + fmt(p.iqr[1]) : ""}</td><td>${p.n ?? ""}</td></tr>`).join("")}</tbody></table>` : "<p>No property measured on this element yet.</p>";
    const measuredLaws = (e.laws || []).filter((l) => l.label === "measured").length;
    const textHTML = `<p>${esc(e.statement || `${e.name[0].toUpperCase() + e.name.slice(1)} is a ${e.kind} on the ${e.sheet} sheet, seen in ${e.mediums} media across ${e.evidence} pieces of evidence.`)}</p>
      <p>Ground: ${esc(e.ground)}. ${measuredLaws ? `${measuredLaws} of its laws has a measured weight.` : "None of its laws has a measured weight yet."} ${e.propertyCount ? `${e.propertyCount} properties are measured.` : ""}</p>`;
    const refsHTML = `<ul class="el-refs">${e.refs.map((r) => `<li>${r.thumb ? `<img src="${esc(assets + r.thumb)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : `<span class="el-nothumb" aria-hidden="true"></span>`}` +
        `<span><a href="${esc(r.source)}" rel="noopener external">${esc(r.title)}</a>${r.creator || r.year ? `<span class="el-by">${esc([r.creator, r.year].filter(Boolean).join(", "))}</span>` : ""}</span></li>`).join("")}</ul>`;
    const panes = { laws: lawsHTML, properties: propsHTML, text: textHTML, references: refsHTML };
    card.innerHTML = `<p class="el-big"><span class="el-sym">${esc(e.symbol)}</span> <span>${esc(e.name)}</span></p>
      <p class="el-ground"><span class="g-dot g-${e.ground}" aria-hidden="true"></span>${esc(e.ground)} <span class="el-kind">${esc(e.kind)}, ${esc(e.sheet)}</span></p>${col}
      <div class="el-tabs" role="tablist" aria-label="Views of ${esc(e.name)}">${VIEWS.map((v) => `<button type="button" role="tab" class="el-tab" data-v="${v}" aria-selected="${v === view}" id="tab-${v}" aria-controls="pane-${v}" tabindex="${v === view ? 0 : -1}">${v}</button>`).join("")}</div>
      ${VIEWS.map((v) => `<div class="el-pane" role="tabpanel" id="pane-${v}" aria-labelledby="tab-${v}" ${v === view ? "" : "hidden"}>${panes[v]}</div>`).join("")}
      <ul class="el-links">${e.links.filter((l) => byId.has(l.to)).map((l) => `<li><button type="button" class="el-to" data-to="${esc(l.to)}">${esc(byId.get(l.to).symbol)} ${esc(byId.get(l.to).name)}</button></li>`).join("")}</ul>`;
    for (const c of cells) c.classList.toggle("on", c.dataset.id === id);
  }
  const go = (c) => { if (!c) return; for (const x of cells) x.tabIndex = -1; c.tabIndex = 0; c.focus(); };
  host.addEventListener("pointerover", (ev) => { const c = ev.target.closest(".el"); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty("--x", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%"); c.style.setProperty("--y", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    if (!pinned) show(c.dataset.id); });
  host.addEventListener("focusin", (ev) => { const c = ev.target.closest(".el"); if (c) { pinned = null; show(c.dataset.id); } });
  host.addEventListener("click", async (ev) => {
    const tab = ev.target.closest(".el-tab");
    if (tab) { view = tab.dataset.v; for (const t of card.querySelectorAll(".el-tab")) { const on = t === tab; t.setAttribute("aria-selected", on); t.tabIndex = on ? 0 : -1; }
      for (const pn of card.querySelectorAll(".el-pane")) pn.hidden = pn.id !== "pane-" + view; return; }
    const c = ev.target.closest(".el"); if (c) { pinned = c.dataset.id; shown = null; show(c.dataset.id); return; }
    const to = ev.target.closest(".el-to"); if (to) { go(cells.find((x) => x.dataset.id === to.dataset.to)); return; }
    const sw = ev.target.closest(".el-col");
    if (sw) { try { await navigator.clipboard.writeText(sw.dataset.hex); sw.querySelector(".sw-name").textContent = "copied"; } catch (err) { console.info("clipboard unavailable:", err.message); } }
  });
  host.addEventListener("keydown", (ev) => {
    const c = ev.target.closest(".el"); if (!c) return;
    const i = cells.indexOf(c), r = c.getBoundingClientRect(), cx = r.left + r.width / 2;
    const nearest = (dir) => { let best = null, bd = 1e9;
      for (const x of cells) { const q = x.getBoundingClientRect(); const dy = (q.top - r.top) * dir; if (dy <= 4) continue;
        const d = dy * 4 + Math.abs(q.left + q.width / 2 - cx); if (d < bd) { bd = d; best = x; } } return best; };
    const k = { ArrowRight: cells[i + 1], ArrowLeft: cells[i - 1], ArrowDown: nearest(1), ArrowUp: nearest(-1), Home: cells[0], End: cells[cells.length - 1] }[ev.key];
    if (k !== undefined) { ev.preventDefault(); go(k); }
  });
  show(cells[0].dataset.id);
  return { show, medium };
}
