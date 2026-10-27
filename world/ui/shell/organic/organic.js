// shell/organic: standard UI patterns made of the site's materials. Every component is a native,
// accessible element underneath (button, a, dialog, input, hr); this file only grows its shape and
// keeps it alive on the shared clock. Reduced motion and plain view show still material states.
//
// Material: data-material="<studio id>" on any ancestor (torn-paper, ink-brush, raked-concrete,
// light, chladni, rope, ...). Palettes come from the studio model (studio/lib/materials.mjs)
// when it loads, with a built-in copy as the fallback, so a region changes material by one attribute.
//
// Components (attribute on a native element):
//   data-o="panel"     container cut from the material: torn edge, blotted ink, or settled sand
//   data-o="rule"      divider drawn as a rope or ink line, never a 1 px hairline
//   data-o="mark"      a living kicker mark grown from the material (only where one is needed)
//   data-o="switch"    <button role="switch"> drawn as an ink drop that rolls between two states
//   data-o="range"     <input type="range"> whose track is a torn strip and thumb an ink drop (CSS)
//   data-o="fold"      the menu toggle: a folded sheet that opens into the navigation dialog
//   data-o="lamp"      the theme control: a real light source that relights the scene
//   data-o="record"    the sound control: the live waveform of what plays, flat when silent
//   data-o="peel"      the plain-view control: the material corner peels back to plain paper
import { workspaceRoot } from "./root.js";
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
const still = () => reduced.matches || root.classList.contains("plain");

const FALLBACK = {
  "torn-paper": { ground: "#d8cfba", ink: "#2a2620", accent: "#efe8d8" },
  "ink-brush": { ground: "#ede6d6", ink: "#14110d", accent: "#3f5f8a" },
  "raked-concrete": { ground: "#8d877c", ink: "#1d1b18", accent: "#d9cdb4" },
  light: { ground: "#07070b", ink: "#f3eee2", accent: "#7fd6e8" },
  chladni: { ground: "#141a2e", ink: "#e4dcc4", accent: "#a9b7d6" },
  rope: { ground: "#e4dccb", ink: "#3b2a1a", accent: "#b58a52" },
  engraving: { ground: "#efe8d8", ink: "#15130f", accent: "#8f3a19" },
};
let PALETTES = FALLBACK;
async function loadPalettes() {
  try {
    const m = await import(workspaceRoot() + "studio/lib/materials.mjs");
    PALETTES = Object.fromEntries(m.MATERIALS.map((x) => [x.id, x.palette]));
  } catch (e) { console.info("organic: studio materials not reachable, using built-in palettes", e.message); }
}
const materialOf = (el) => el.closest("[data-material]")?.dataset.material || "torn-paper";

// Seeded noise, so the same element tears the same way on every load (S3 determinism).
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const seedOf = (el) => [...(el.id || el.textContent || "o")].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

// A closed outline around a w x h box, edge displaced by the material's character.
function outline(w, h, kind, R) {
  const pts = [], step = kind === "torn" ? 9 : 22, amp = kind === "torn" ? 5 : kind === "blot" ? 9 : 3;
  const edge = (x0, y0, x1, y1, nx, ny) => {
    const n = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let i = 0; i < n; i++) {
      const t = i / n, j = kind === "blot" ? Math.sin(t * Math.PI) * amp * (0.6 + R() * 0.8) : (R() - 0.3) * amp;
      pts.push([x0 + (x1 - x0) * t + nx * j, y0 + (y1 - y0) * t + ny * j]);
    }
  };
  edge(0, 0, w, 0, 0, -1); edge(w, 0, w, h, 1, 0); edge(w, h, 0, h, 0, 1); edge(0, h, 0, 0, -1, 0);
  return pts;
}
const polyCss = (pts, pad) => `polygon(${pts.map(([x, y]) => `${(x + pad).toFixed(1)}px ${(y + pad).toFixed(1)}px`).join(",")})`;

function panel(el) {
  const kind = el.dataset.edge || ({ "torn-paper": "torn", "ink-brush": "blot", chladni: "sand" }[materialOf(el)] || "torn");
  const draw = () => {
    const r = el.getBoundingClientRect(), pad = 12;
    el.style.setProperty("--o-pad", pad + "px");
    if (kind === "sand") { el.dataset.edgeKind = "sand"; return; }
    const pts = outline(r.width - pad * 2, r.height - pad * 2, kind, rng(seedOf(el)));
    el.style.clipPath = polyCss(pts, pad);
    el.dataset.edgeKind = kind;
  };
  draw();
  new ResizeObserver(draw).observe(el);
}

function rule(el) {
  const svgNS = "http://www.w3.org/2000/svg";
  const draw = () => {
    const w = Math.max(40, el.getBoundingClientRect().width), R = rng(seedOf(el)), kind = materialOf(el) === "rope" ? "rope" : "ink";
    const svg = document.createElementNS(svgNS, "svg");
    svg.setAttribute("viewBox", `0 0 ${w} 14`); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("focusable", "false");
    let d = "M0 7";
    for (let x = 12; x <= w; x += 12) d += ` Q${x - 6} ${7 + (R() - 0.5) * (kind === "rope" ? 2 : 4)} ${x} ${7 + (R() - 0.5) * 1.5}`;
    const path = document.createElementNS(svgNS, "path");
    path.setAttribute("d", d); path.setAttribute("fill", "none"); path.setAttribute("stroke", "currentColor");
    path.setAttribute("stroke-width", kind === "rope" ? "4" : "2.2"); path.setAttribute("stroke-linecap", "round");
    if (kind === "rope") path.setAttribute("stroke-dasharray", "5 2.5");
    svg.append(path);
    el.replaceChildren(svg);
  };
  draw();
  new ResizeObserver(draw).observe(el);
}

// The menu toggle: a sheet folded in thirds. Pressing unfolds it into the navigation dialog.
function fold(btn) {
  const dlg = document.getElementById(btn.getAttribute("aria-controls"));
  if (!dlg || typeof dlg.showModal !== "function") return;
  btn.hidden = false;
  let lettered = false;
  const open = () => {
    dlg.showModal(); btn.setAttribute("aria-expanded", "true"); root.classList.add("o-menu-open");
    if (!lettered) {   // menu words are lettered once they have a size; the lettering library draws them
      lettered = true;
      dlg.querySelectorAll("[data-display-on-open]").forEach((el) => { el.dataset.display = el.dataset.displayOnOpen; window.UIShell?.drawSlot?.(el); });
      setTimeout(() => dispatchEvent(new Event("o-lettered")), 0);
    }
  };
  const close = () => { dlg.close(); };
  dlg.addEventListener("close", () => { btn.setAttribute("aria-expanded", "false"); root.classList.remove("o-menu-open"); btn.focus(); });
  dlg.addEventListener("click", (e) => { if (e.target === dlg) close(); });
  btn.addEventListener("click", open);
  addEventListener("keydown", (e) => {
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
    if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === "m" && !dlg.open) { e.preventDefault(); open(); }
  });
}

// The lamp: the theme is the scene's light. The control is a small lit filament; toggling moves the
// lamp across the page (a light gradient on every room) and swaps ground and ink.
function lamp(btn) {
  const set = () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    btn.setAttribute("aria-pressed", String(!dark));
    btn.querySelector(".o-name").textContent = dark ? "Lamp on" : "Lamp off";
    root.style.setProperty("--o-lamp-x", dark ? "18%" : "78%");
  };
  set();
  new MutationObserver(set).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
}

// The record: a waveform of what plays. Flat and still when silent; live from an AnalyserNode when
// the shell's sound is on (base.js exposes the context through UIShell.audio).
function record(btn) {
  const cv = btn.querySelector("canvas");
  if (!cv) return;
  const g = cv.getContext("2d", { colorSpace: "display-p3" }) || cv.getContext("2d");
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const buf = new Uint8Array(256);
  const paint = () => {
    const W = Math.round(cv.clientWidth * dpr), H = Math.round(cv.clientHeight * dpr);
    if (W && (cv.width !== W || cv.height !== H)) { cv.width = W; cv.height = H; }
    const w = cv.width, h = cv.height, an = window.UIShell?.audio?.analyser;
    g.clearRect(0, 0, w, h); g.strokeStyle = getComputedStyle(btn).color; g.lineWidth = 1.5 * dpr; g.beginPath();
    if (an && !still()) an.getByteTimeDomainData(buf); else buf.fill(128);
    for (let i = 0; i < buf.length; i++) { const x = (i / (buf.length - 1)) * w, y = h / 2 + ((buf[i] - 128) / 128) * h * 1.6; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
  };
  paint();
  window.UIShell?.clock?.subscribe?.(() => { if (root.classList.contains("sound-on")) paint(); });
  btn.addEventListener("click", () => setTimeout(paint, 50));
}

// Living kicker marks: a few grains of the room's material that settle once into a short stroke.
function mark(el) {
  el.setAttribute("aria-hidden", el.hasAttribute("aria-label") ? "false" : "true");
  el.style.setProperty("--o-seed", String(seedOf(el) % 360));
}

// Palette into custom properties on each material region.
function paint(region) {
  const p = PALETTES[region.dataset.material];
  if (!p) return;
  region.style.setProperty("--m-ground", p.ground);
  region.style.setProperty("--m-ink", p.ink);
  region.style.setProperty("--m-accent", p.accent);
}

import { initGenerators } from "./organic-gen.js";

// The survey band (the universe agent's "we are here", proto/here.js, reading universe.json): one system with
// the map. The host is a real link to the map; a tile travels into the map at that place. Pages outside the
// universe show no white tile.
async function band(host) {
  const base = workspaceRoot() + "universe/";
  const [{ here }, u] = await Promise.all([import(base + "proto/here.js"), fetch(base + "universe.json").then((r) => { if (!r.ok) throw new Error("universe.json " + r.status); return r.json(); })]);
  const map = host.getAttribute("href");
  const b = here(host, u, { onPick: (id) => { location.href = map + "?n=" + encodeURIComponent(id); }, onWhole: () => { location.href = map; } });
  host.addEventListener("click", (e) => e.preventDefault());
  const at = host.dataset.place; if (at) b.focus(at); else b.at({});
}

export async function initOrganic() {
  await loadPalettes();
  document.querySelectorAll("[data-material]").forEach(paint);
  const each = (sel, f) => document.querySelectorAll(sel).forEach((el) => { try { f(el); } catch (e) { console.warn("organic:", sel, e); } });
  each('[data-o="panel"]', panel);
  each('[data-o="rule"]', rule);
  each('[data-o="mark"]', mark);
  each('[data-o="fold"]', fold);
  each('[data-o="lamp"]', lamp);
  document.querySelectorAll('[data-o="band"]').forEach((h) => band(h).catch((e) => console.warn("organic: survey band not loaded; the map link stays", e)));
  each('[data-o="record"]', record);
  each('[data-o="switch"]', (b) => b.addEventListener("click", () => b.setAttribute("aria-checked", String(b.getAttribute("aria-checked") !== "true"))));
  await initGenerators();
}
