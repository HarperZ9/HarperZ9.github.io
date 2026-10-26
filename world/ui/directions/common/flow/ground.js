// ground.js: the page ground as a living medium of water and air. The page's acts are the additives:
// hover warms it, a press drops ink, scrolling moves current and carries the field with the page,
// typing sends a ripple, and a passage held in view leaves sediment beside it.
// Sections declare their viscosity with data-medium="thin|water|viscous". Plain view hides the medium;
// reduced motion shows one settled still. ?view=mosaic or ?view=ink|warmth|current|sediment shows a reading.
import { createMedium } from "./medium.js";

const VISC = { thin: 0.5, water: 0.9, viscous: 3.2 };
const root = document.documentElement;

function start() {
  if (new URLSearchParams(location.search).get("medium") === "off" || document.documentElement.dataset.ground === "off") return; // A/B audits
  const c = document.createElement("canvas");
  c.className = "medium-ground"; c.setAttribute("aria-hidden", "true"); c.dataset.art = "";
  document.body.prepend(c);
  let m;
  try { m = createMedium(c); } catch (e) { console.info("flow ground off:", e.message); }
  if (!m) { c.remove(); return; }
  root.classList.add("medium-on"); window.__medium = m;

  const vw = () => innerWidth, vh = () => innerHeight;
  const at = (x, y) => ({ x: x / vw(), y: y / vh() });
  const regions = () => m.region([...document.querySelectorAll("[data-medium]")].map((el) => {
    const r = el.getBoundingClientRect();
    return { x0: r.left / vw(), x1: r.right / vw(), y0: r.top / vh(), y1: r.bottom / vh(), viscosity: VISC[el.dataset.medium] ?? 0.9 };
  }));
  const READ = "main h1, main h2, main h3, main p, main li, main figcaption, dialog[open]";
  // reading blocks that carry their own ground (an opaque background) are cleared to their edge, so no box shows
  const solid = (e) => { const c = getComputedStyle(e).backgroundColor; return c && c !== "transparent" && !/,\s*0\)$/.test(c); };
  const clears = () => m.clear([...document.querySelectorAll(READ), ...[...document.querySelectorAll(".wall,.lede,.walltext,.reading,.deck")].filter(solid)]
    .map((e) => { const r = e.getBoundingClientRect(), pad = e.matches("p,li,h1,h2,h3,figcaption") ? 0 : 10; return { left: r.left - pad, right: r.right + pad, top: r.top - pad, bottom: r.bottom + pad, width: r.width, height: r.height }; })
    .filter((r) => r.width && r.bottom > 0 && r.top < vh()).sort((a, b) => b.width * b.height - a.width * a.height).slice(0, 8));
  // the lamp: each room's light pool sits at 70% across its top edge (the old CSS gradient's geometry)
  const lamps = () => m.lamp([...document.querySelectorAll(".room")].map((e) => e.getBoundingClientRect())
    .filter((r) => r.bottom > 0 && r.top < vh()).slice(0, 4).map((r) => ({ cx: r.left + r.width * 0.7, cy: r.top, rx: r.width * 0.6, ry: r.height * 0.7 })));
  // the page grid: the medium draws the column rules itself so the water can refract them (CSS rules hidden)
  const grids = () => m.grid([...document.querySelectorAll(".gridded > .room-in")].map((e) => e.getBoundingClientRect())
    .filter((r) => r.bottom > -24 && r.top < vh() + 24).slice(0, 4).map((r) => ({ left: r.left, right: r.right, top: r.top - 24, bottom: r.bottom + 24, period: (r.width + 20) / 12 })));
  regions(); clears(); lamps(); grids();

  // pools: soak stains poured at fixed places down the page (a seeded list, the same on every visit).
  // Each pool is poured when its place first scrolls into view, so the ground stays attached to the page.
  const rnd = ((s) => () => ((s = (s * 16807) % 2147483647) / 2147483647))(1925);
  const EVERY = 420, pools = Array.from({ length: Math.ceil(document.documentElement.scrollHeight / EVERY) + 1 }, (_, i) =>
    ({ y: i * EVERY + rnd() * EVERY * 0.6, x: 0.08 + rnd() * 0.84, r: 0.05 + rnd() * 0.05, done: false }));
  // a pool is poured only on bare ground: tried at a few places along its row, never on a slab, plate or passage
  const NOT_GROUND = "img,canvas,svg,video,picture,figure,p,li,h1,h2,h3,a,button,span,dialog,header,footer,.cut,[data-art],[data-alive],.specimen,.super";
  const bareAt = (x, y) => { const e = document.elementFromPoint(x * vw(), y); return !!e && !e.closest(NOT_GROUND); };
  const bare = (p) => {
    for (let k = 0; k < 12; k++) {
      const x = k ? 0.06 + rnd() * 0.88 : p.x, y = p.y + (k ? (rnd() - 0.5) * 300 : 0) - scrollY;
      if (y > vh() * 0.08 && y < vh() * 0.92 && bareAt(x, y)) { p.x = x; p.y = y + scrollY; return true; }
    }
    return false; };
  const pour = (first) => {
    const out = [];
    for (const p of pools) if (!p.done && p.y > scrollY + vh() * 0.12 && p.y < scrollY + vh() * 0.88) {
      if (!bare(p)) continue; p.done = true; out.push({ kind: "ink", x: p.x, y: (p.y - scrollY) / vh(), r: p.r, amount: 1.5, always: true }, { kind: "wash", x: p.x + p.r * 0.5, y: (p.y - scrollY) / vh() + p.r * 0.3, r: p.r * 0.6, amount: 1.2, always: true },
        { kind: "ripple", x: p.x, y: (p.y - scrollY) / vh(), r: p.r * 1.4, amount: 18, always: true });
    }
    if (out.length && (first || !m.still)) { m.seed(out); m.stats.poured = (m.stats.poured || 0) + out.length / 3; }
  };
  // a spring: open ground the page leaves for the water. One slow pool is poured there at load,
  // large and calm, so the first screen shows the medium before the reader has done anything.
  const springs = [...document.querySelectorAll("[data-medium-spring]")].map((e) => e.getBoundingClientRect()).filter((r) => r.top < vh() && r.bottom > 0);
  for (const r of springs) {
    // three overlapping pours of two tones, each a cluster of drops, so the outline is irregular and the body has depth
    const x = (r.left + r.width * 0.45) / vw(), y = (r.top + r.height * 0.62) / vh(), rad = Math.min(0.1, Math.max(0.05, Math.min(r.width, r.height) / vw() * 0.36));
    const pours = [[-0.15, -0.1, 1, "ink", 1.6], [0.75, 0.45, 0.85, "wash", 1.5], [-0.55, 0.75, 0.5, "ink", 1.1]], drops = [];
    for (const [ox, oy, s, kind, amt] of pours) for (let k = 0; k < 6; k++) {
      const a = rnd() * 6.283, d = rnd() * 0.55 * rad * s;
      drops.push({ kind, x: x + ox * rad + Math.cos(a) * d, y: y + oy * rad * (vw() / vh()) + Math.sin(a) * d * (vw() / vh()), r: rad * s * (0.35 + rnd() * 0.3), amount: amt * (0.5 + rnd() * 0.5), always: true });
    }
    m.seed(drops.concat([{ kind: "ripple", x, y, r: rad * 1.3, amount: 8, always: true }, { kind: "current", x, y, r: rad * 2, vx: 1.2, vy: -0.3, always: true }]));
  }
  pour(true);
  m.seed([{ kind: "sediment", x: 0.3, y: 0.92, r: 0.22, aspect: 0.05, amount: 0.5, always: true }]);

  let px = -1, py = -1;
  addEventListener("pointermove", (e) => {
    if (px >= 0) { const dx = e.clientX - px, dy = e.clientY - py; if (dx * dx + dy * dy > 4) m.add("current", { ...at(e.clientX, e.clientY), r: 0.025, vx: dx * 0.22, vy: dy * 0.22 }); }
    px = e.clientX; py = e.clientY;
  }, { passive: true });
  document.addEventListener("pointerover", (e) => {
    const t = e.target.closest?.("a,button,[role=button],summary,input,label");
    if (!t) return; const r = t.getBoundingClientRect();
    m.add("warmth", { ...at(r.left + r.width / 2, r.top + r.height / 2), r: Math.max(r.width, r.height) / vw() * 0.7, amount: 0.8 });
  }, { passive: true });
  addEventListener("pointerdown", (e) => m.add("ink", { ...at(e.clientX, e.clientY), r: 0.035, amount: 1.3 }), { passive: true });
  addEventListener("keydown", (e) => {
    const t = document.activeElement; if (!t || !t.matches("input,textarea,[contenteditable]")) return;
    const r = t.getBoundingClientRect(); m.add("ripple", { ...at(r.left + Math.min(r.width, 12 + t.value?.length * 8 || 0), r.top + r.height / 2), r: 0.03, amount: 30 });
    void e;
  });
  let sy = scrollY;
  addEventListener("scroll", () => {
    const dy = scrollY - sy; sy = scrollY; if (!dy) return;
    m.shift(dy); regions(); clears(); lamps(); grids(); pour(false);
    m.add("current", { x: 0.5, y: 0.5, r: 0.6, vx: 0, vy: Math.max(-8, Math.min(8, -dy * 0.08)) });
  }, { passive: true });
  addEventListener("resize", () => { regions(); clears(); lamps(); grids(); });
  // switching the lamp on warms the water under every lamp in view
  for (const b of document.querySelectorAll("[data-theme-toggle]")) b.addEventListener("click", () => setTimeout(() => {
    m.retheme(); for (const l of document.querySelectorAll(".room")) { const r = l.getBoundingClientRect(); if (r.bottom < 0 || r.top > vh()) continue;
      m.add("warmth", { ...at(r.left + r.width * 0.7, Math.max(0, r.top) + 40), r: 0.3, amount: 1.2 }); } }, 60));

  // reading leaves sediment: a passage that stays in view for four seconds settles a band at its left edge
  const held = new Map();
  const io = new IntersectionObserver((es) => { for (const e of es) {
    if (e.isIntersecting && e.intersectionRatio > 0.6) held.set(e.target, setTimeout(() => {
      const r = e.target.getBoundingClientRect();
      m.add("sediment", { ...at(r.left + Math.min(r.width * 0.3, vw() * 0.14), r.bottom + 4), r: Math.min(0.14, r.width / vw() * 0.3), aspect: 0.06, amount: 0.25 });
    }, 4000));
    else { clearTimeout(held.get(e.target)); held.delete(e.target); }
  } }, { threshold: [0, 0.6] });
  for (const p of document.querySelectorAll("main p, main h2")) io.observe(p);

  new MutationObserver(() => setTimeout(() => m.retheme(), 30)).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => m.retheme());

  const v = new URLSearchParams(location.search).get("view");
  if (v) setTimeout(() => m.view(v === "mosaic" ? { mosaic: true } : { layers: { solo: v } }), 1200);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
