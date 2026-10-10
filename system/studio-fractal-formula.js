// studio-fractal-formula.js: the 2D Fractal source's Formula group.
//
// Shows the parameters each formula type reads (the Multibrot's power, Newton's f(z), the Phoenix's
// p, Julia mode and its constant, the Lyapunov sequence) and the formula editor. Every change is
// checked by compiling it first (fractal-formulas.js parses the text into a tree; nothing is
// evaluated as code), so a typo shows its reason and position here and the frame keeps the last
// formula that worked.

import { formulaSpec, FORMULA_TYPES, CATALOG, FormulaError } from "./fractal-formulas.js";
import { lyapunovSequence } from "./fractal-glsl-lyapunov.js";

const $ = (id) => document.getElementById(id);

// Which rows each type shows.
const ROWS = {
  multibrot: ["power", "julia"],
  tricorn: ["julia"], celtic: ["julia"], magnet: ["julia"],
  phoenix: ["julia", "p"],
  newton: ["newton", "p"],
  nova: ["newton", "p"],
  lyapunov: ["lyap"],
  formula: ["editor", "julia", "p", "actions"],
  buddhabrot: ["buddha"],
  nebulabrot: ["buddha", "limits"],
};
const ROW_IDS = { power: "fractal-power-row", newton: "fractal-newton-row", editor: "fractal-editor-row", lyap: "fractal-lyap-row",
  julia: "fractal-julia-row", p: "fractal-p-row", actions: "fractal-formula-actions", buddha: "fractal-buddha-row", limits: "fractal-limits-row" };

export function mountFractalFormula({ getView, setView, repaint, say }) {
  const group = $("fractal-formula-group");
  const err = $("fractal-formula-error");
  let mode = "escape", z0 = "zero";

  const num = (id, d) => { const v = parseFloat(($(id) || {}).value); return Number.isFinite(v) ? v : d; };
  const showError = (e) => {
    if (!err) return;
    if (!e) { err.textContent = ""; return; }
    err.textContent = e instanceof FormulaError ? `Not drawn: ${e.message}${e.pos != null ? ` (at character ${e.pos + 1})` : ""}.` : `Not drawn: ${e.message}.`;
  };

  // Read the group into a copy of the view, check it compiles, and draw it.
  function apply(extra = {}) {
    const v = getView();
    if (!v) return;
    const next = { ...v, ...extra };
    const rows = ROWS[v.type] || [];
    if (rows.includes("power")) next.power = num("fractal-power", 3);
    if (rows.includes("julia")) {
      next.julia = !!($("fractal-julia-mode") || {}).checked;
      next.jx = num("fractal-jx", -0.8); next.jy = num("fractal-jy", 0.156);
    }
    if (rows.includes("p")) next.p = [num("fractal-pre", 0), num("fractal-pim", 0)];
    if (rows.includes("newton")) next.f = ($("fractal-newton-f") || {}).value || "z^3 - 1";
    if (rows.includes("editor")) {
      next.formula = ($("fractal-formula") || {}).value || "z^2 + c";
      next.formulaMode = mode;
      next.z0 = z0 === "c" ? "c" : undefined;
    }
    if (rows.includes("lyap")) next.sequence = lyapunovSequence(($("fractal-lyap-seq") || {}).value).text;
    if (rows.includes("buddha")) {
      next.orbits = num("fractal-orbits", 20); next.minIter = Math.round(num("fractal-miniter", 20)); next.gamma = num("fractal-gamma", 2);
    }
    if (rows.includes("limits")) {
      const r = Math.max(20, Math.round(num("fractal-lim-r", 5000))), g = Math.max(10, Math.round(num("fractal-lim-g", 500))), b = Math.max(4, Math.round(num("fractal-lim-b", 50)));
      next.limits = [r, Math.min(g, r - 1), Math.min(b, g - 1)];
      next.maxIter = r;
    }
    try {
      if (FORMULA_TYPES.includes(next.type)) formulaSpec(next);
    } catch (e) { showError(e); return; }
    showError(null);
    setView(next);
    repaint();
  }

  const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  on("fractal-power", "input", () => { const o = $("fractal-power-val"); if (o) o.textContent = $("fractal-power").value; apply(); });
  for (const id of ["fractal-julia-mode", "fractal-jx", "fractal-jy", "fractal-pre", "fractal-pim", "fractal-newton-f", "fractal-lyap-seq",
    "fractal-orbits", "fractal-miniter", "fractal-gamma", "fractal-lim-r", "fractal-lim-g", "fractal-lim-b"]) on(id, "change", () => apply());
  for (const [id, out, fmt] of [["fractal-orbits", "fractal-orbits-val", (v) => v], ["fractal-miniter", "fractal-miniter-val", (v) => v], ["fractal-gamma", "fractal-gamma-val", (v) => (+v).toFixed(1)]]) {
    on(id, "input", () => { const o = $(out); if (o) o.textContent = fmt($(id).value); });
  }
  on("fractal-formula-apply", "click", () => apply());
  on("fractal-formula", "keydown", (e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); apply(); } });
  document.querySelectorAll("[data-fmode]").forEach((b) => b.addEventListener("click", () => {
    mode = b.dataset.fmode;
    document.querySelectorAll("[data-fmode]").forEach((x) => x.classList.toggle("active", x === b));
    apply();
  }));
  document.querySelectorAll("[data-fz0]").forEach((b) => b.addEventListener("click", () => {
    z0 = b.dataset.fz0;
    document.querySelectorAll("[data-fz0]").forEach((x) => x.classList.toggle("active", x === b));
    apply();
  }));
  // Ultra Fractal's switch: the centre of the current view becomes the Julia constant.
  on("fractal-julia-pick", "click", () => {
    const v = getView();
    if (!v) return;
    if ($("fractal-jx")) $("fractal-jx").value = String(+v.cx.toFixed(10));
    if ($("fractal-jy")) $("fractal-jy").value = String(+v.cy.toFixed(10));
    if ($("fractal-julia-mode")) $("fractal-julia-mode").checked = true;
    apply({ cx: 0, cy: 0, re: undefined, im: undefined, scale: 3.5 });
    say(`The Julia set of c = ${v.cx.toFixed(6)} ${v.cy < 0 ? "-" : "+"} ${Math.abs(v.cy).toFixed(6)}i, the point the view was centred on.`);
  });

  // Put a view's values into the group, and show the rows its type reads.
  function sync(view) {
    if (!group || !view) return;
    const rows = ROWS[view.type];
    group.hidden = !rows;
    for (const [k, id] of Object.entries(ROW_IDS)) { const el = $(id); if (el) el.hidden = !(rows || []).includes(k); }
    if (!rows) return;
    const cat = CATALOG[view.type] || {};
    const set = (id, v) => { const el = $(id); if (el && document.activeElement !== el && v != null) el.value = String(v); };
    set("fractal-power", view.power ?? 3);
    const pv = $("fractal-power-val"); if (pv) pv.textContent = String(view.power ?? 3);
    const jm = $("fractal-julia-mode"); if (jm) jm.checked = view.julia != null ? !!view.julia : !!cat.julia;
    set("fractal-jx", view.jx ?? cat.jx ?? -0.8);
    set("fractal-jy", view.jy ?? cat.jy ?? 0.156);
    const p = view.p || cat.p || [0, 0];
    set("fractal-pre", p[0]); set("fractal-pim", p[1]);
    const ph = $("fractal-p-hint");
    if (ph) ph.textContent = view.type === "phoenix" ? "the weight of the previous z" : (view.type === "newton" || view.type === "nova") ? "the relaxation (1 is plain Newton)" : "real, imaginary";
    set("fractal-newton-f", view.f || "z^3 - 1");
    set("fractal-formula", view.formula || "z^2 + c");
    set("fractal-lyap-seq", view.sequence || "AABAB");
    set("fractal-orbits", view.orbits ?? 20); set("fractal-miniter", view.minIter ?? 20); set("fractal-gamma", view.gamma ?? 2);
    for (const [id, v] of [["fractal-orbits-val", view.orbits ?? 20], ["fractal-miniter-val", view.minIter ?? 20], ["fractal-gamma-val", (+(view.gamma ?? 2)).toFixed(1)]]) { const o = $(id); if (o) o.textContent = String(v); }
    const lim = view.limits || [5000, 500, 50];
    set("fractal-lim-r", lim[0]); set("fractal-lim-g", lim[1]); set("fractal-lim-b", lim[2]);
    mode = view.formulaMode || "escape";
    z0 = view.z0 === "c" ? "c" : "zero";
    document.querySelectorAll("[data-fmode]").forEach((x) => x.classList.toggle("active", x.dataset.fmode === mode));
    document.querySelectorAll("[data-fz0]").forEach((x) => x.classList.toggle("active", x.dataset.fz0 === z0));
    showError(null);
  }

  return { sync, apply };
}
