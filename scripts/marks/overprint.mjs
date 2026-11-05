// overprint.mjs: flat inks laid down as a printer lays them, for the drawn marks and colour studies.
// Every colour comes from world/site/crossover/icon-palette.json (tools/crossover/icon_palette.py): each ink and
// key, and every place where two or three of them cross, is computed from the five measured Olivetti inks by the
// overprint model that won the race there (Clapper-Yule against per-channel multiply and Beer-Lambert). Nothing is
// picked by eye. The key ink "k" is a line that never overprints; it takes var(--xo-k), so a mark keeps its key on
// a dark field and on paper.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
export const PAL = JSON.parse(readFileSync(path.join(site, "world/site/crossover/icon-palette.json"), "utf8"));
const ORDER = Object.keys(PAL.ink);
// platform inks (p-<platform> on paper, pd-<platform> on the dark field) come from the shared hierarchy colour tokens
// through the same overprint model; a platform ink never crosses another platform ink
const isPlat = (k) => /^pd?-/.test(k);
export const platInk = (platform, dark) => `${dark ? "pd" : "p"}-${platform}`;
const f = (n) => +n.toFixed(2);

export function ink(k) {
  if (k === "k") return "var(--xo-k,#1a1b22)";
  if (k.startsWith("#") || k.startsWith("url(")) return k;
  const c = PAL.ink[k]; if (!c) throw new Error(`overprint: no ink "${k}"`); return c;
}
// the colour where the given inks cross, from the palette's computed overlaps
export function over(...keys) {
  const name = [...keys].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join("+");
  const c = PAL.over[name]; if (!c) throw new Error(`overprint: no overlap "${name}"`); return c;
}
// a ramp sampled at a value: the thin-film ramp by thickness in nm, or the Michel-Levy ramp by retardance in nm
export function film(nm, angle = "head_on") { const r = PAL.film[angle]; return r[Math.max(0, Math.min(r.length - 1, Math.round(nm / PAL.film.step_nm)))]; }
export function ml(nm) { const r = PAL.michel_levy.ramp; return r[Math.max(0, Math.min(r.length - 1, Math.round(nm / PAL.michel_levy.step_nm)))]; }

// shapes: plain SVG geometry, no fill. Each carries its bounding box (bb), so lay() draws a crossing only where two
// shapes can meet; a raw string without one is assumed to meet everything.
const shape = (str, bb) => Object.assign(new String(str), { bb });
export const circle = (x, y, r) => shape(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`, [x - r, y - r, x + r, y + r]);
export const rect = (x, y, w, h, r = 0) => shape(`<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}"${r ? ` rx="${f(r)}"` : ""}/>`, [x, y, x + w, y + h]);
export const poly = (pts) => shape(`<polygon points="${pts.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}"/>`, [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))]);
const meets = (a, b) => !a.bb || !b.bb || (a.bb[0] < b.bb[2] && b.bb[0] < a.bb[2] && a.bb[1] < b.bb[3] && b.bb[1] < a.bb[3]);
// a sector of a disc from angle a0 to a1 (radians, 0 = east, clockwise on screen)
export function sector(cx, cy, r, a0, a1) {
  const p = (a) => `${f(cx + r * Math.cos(a))} ${f(cy + r * Math.sin(a))}`;
  return shape(`<path d="M${f(cx)} ${f(cy)}L${p(a0)}A${f(r)} ${f(r)} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${p(a1)}Z"/>`, [cx - r, cy - r, cx + r, cy + r]);
}
// a rounded bar from a to b, w wide (the typebar, the link, the branch)
export function bar([x1, y1], [x2, y2], w) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, nx = (-dy / L) * w / 2, ny = (dx / L) * w / 2, r = w / 2;
  return shape(`<path d="M${f(x1 + nx)} ${f(y1 + ny)}L${f(x2 + nx)} ${f(y2 + ny)}A${f(r)} ${f(r)} 0 0 0 ${f(x2 - nx)} ${f(y2 - ny)}L${f(x1 - nx)} ${f(y1 - ny)}A${f(r)} ${f(r)} 0 0 0 ${f(x1 + nx)} ${f(y1 + ny)}Z"/>`, [Math.min(x1, x2) - r, Math.min(y1, y2) - r, Math.max(x1, x2) + r, Math.max(y1, y2) + r]);
}
const withFill = (el, fill, extra = "") => String(el).replace(/\/>$/, ` fill="${fill}"${extra}/>`);

// lay the shapes down in order. Each shape is { el, ink } and overprints the inked shapes under it: where two or
// three cross, the crossing is drawn again in the computed overlap colour, clipped to the shapes beneath. A shape
// with ink "k", a raw colour or { solo: true } sits on top and does not mix.
export function lay(id, shapes) {
  const mixes = (s) => !s.solo && s.ink !== "k" && PAL.ink[s.ink];
  const clips = new Map(), out = [];
  const clip = (i) => { if (!clips.has(i)) clips.set(i, `<clipPath id="${id}-c${i}">${shapes[i].el}</clipPath>`); return `url(#${id}-c${i})`; };
  shapes.forEach((s, j) => {
    out.push(withFill(s.el, ink(s.ink), s.attr || ""));
    if (!mixes(s)) return;
    const under = shapes.slice(0, j).map((t, i) => [t, i]).filter(([t]) => mixes(t) && meets(t.el, s.el) && !(isPlat(t.ink) && isPlat(s.ink)));
    for (const [a, i] of under) out.push(`<g clip-path="${clip(i)}">${withFill(s.el, over(a.ink, s.ink))}</g>`);
    for (let p = 0; p < under.length; p++) for (let q = p + 1; q < under.length; q++) {
      const [a, i] = under[p], [b, k] = under[q];
      if (!meets(a.el, b.el) || isPlat(a.ink) && isPlat(b.ink)) continue;
      out.push(`<g clip-path="${clip(i)}"><g clip-path="${clip(k)}">${withFill(s.el, over(a.ink, b.ink, s.ink))}</g></g>`);
    }
  });
  return { defs: [...clips.values()].join(""), body: out.join("") };
}

// a whole inline SVG: role img with its own title, or aria-hidden when the words beside it already say it
export function svg(id, view, { defs = "", body = "" }, { title = "", cls = "xo-svg", size = null } = {}) {
  const a11y = title ? `role="img" aria-labelledby="${id}-t"` : `aria-hidden="true" focusable="false"`;
  const wh = size ? ` width="${size}" height="${size}"` : "";
  return `<svg class="${cls}" viewBox="${view}"${wh} ${a11y} xmlns="http://www.w3.org/2000/svg">${title ? `<title id="${id}-t">${title}</title>` : ""}${defs ? `<defs>${defs}</defs>` : ""}${body}</svg>`;
}
