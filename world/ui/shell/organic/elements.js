// elements.js: the element table. mountElements(host, data, { medium }) lays the concepts out as blocks, one per
// sheet, in sheet order, like the blocks of a periodic table. Each element is a real button. Hover, focus or a
// tap runs that element in the well, a FLOW medium of its own; the well's panel names it, gives its measured
// colour (copyable), its bridges to other elements (buttons that move there) and its references (links).
// Keys: arrows move through the table; Enter or Space pins an element; Home and End jump to the ends.
import { createMedium } from "../../directions/common/flow/medium.js";
import { demoFor } from "./demo.js";

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function mountElements(host, data, { assets = "" } = {}) {
  // numbers come from the data: contiguous, in path order (PATH-ORDER.md). assets: the base for thumbnail paths.
  const byId = new Map(data.elements.map((e, i) => [e.id, { ...e, n: e.n ?? i + 1 }]));
  const sheets = [...data.sheets].sort((a, b) => a.order - b.order);
  host.classList.add("elements");
  host.innerHTML = `<div class="el-well"><canvas class="el-canvas" aria-hidden="true"></canvas><div class="el-card" aria-live="polite"></div></div>
    <div class="el-blocks">${sheets.map((s) => `<section class="el-block" style="--sheet:${esc(s.colour)}" aria-labelledby="el-${esc(s.id)}">
      <h2 id="el-${esc(s.id)}">${esc(s.id)}</h2><div class="el-cells">${[...byId.values()].filter((e) => e.sheet === s.id).map((e) =>
        `<button type="button" class="el" data-id="${esc(e.id)}" tabindex="-1" aria-label="${esc(e.name)}, ${esc(s.id)}"><span class="el-n">${e.n}</span>` +
        `<span class="el-sym">${esc(e.symbol)}</span><span class="el-name">${esc(e.name)}</span>` +
        (e.colour.hex ? `<span class="el-chip" style="--c:${esc(e.colour.hex)}"></span>` : "") + `</button>`).join("")}</div></section>`).join("")}</div>`;

  const cells = [...host.querySelectorAll(".el")], card = host.querySelector(".el-card"), canvas = host.querySelector(".el-canvas");
  cells[0].tabIndex = 0;
  let medium = null;
  try { medium = createMedium(canvas, { element: true, cap: 0.55 }); } catch (e) { console.info("element well without medium:", e.message); }
  if (!medium) canvas.remove(); else host.medium = medium; // reachable for checks (weights, stats)

  let shown = null, pinned = null, pourT = 0;
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
    card.innerHTML = `<p class="el-big"><span class="el-sym">${esc(e.symbol)}</span> <span>${esc(e.name)}</span></p>${col}
      <ul class="el-links">${e.links.filter((l) => byId.has(l.to)).map((l) => `<li><button type="button" class="el-to" data-to="${esc(l.to)}">${esc(byId.get(l.to).symbol)} ${esc(byId.get(l.to).name)}</button></li>`).join("")}</ul>
      <ul class="el-refs">${e.refs.map((r) => `<li>${r.thumb ? `<img src="${esc(assets + r.thumb)}" alt="" width="56" height="56" loading="lazy" decoding="async">` : `<span class="el-nothumb" aria-hidden="true"></span>`}` +
        `<span><a href="${esc(r.source)}" rel="noopener external">${esc(r.title)}</a>${r.creator || r.year ? `<span class="el-by">${esc([r.creator, r.year].filter(Boolean).join(", "))}</span>` : ""}</span></li>`).join("")}</ul>`;
    for (const c of cells) c.classList.toggle("on", c.dataset.id === id);
  }
  const go = (c) => { if (!c) return; for (const x of cells) x.tabIndex = -1; c.tabIndex = 0; c.focus(); };
  host.addEventListener("pointerover", (ev) => { const c = ev.target.closest(".el"); if (!c) return;
    const r = c.getBoundingClientRect(); c.style.setProperty("--x", ((ev.clientX - r.left) / r.width * 100).toFixed(1) + "%"); c.style.setProperty("--y", ((ev.clientY - r.top) / r.height * 100).toFixed(1) + "%");
    if (!pinned) show(c.dataset.id); });
  host.addEventListener("focusin", (ev) => { const c = ev.target.closest(".el"); if (c) { pinned = null; show(c.dataset.id); } });
  host.addEventListener("click", async (ev) => {
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
