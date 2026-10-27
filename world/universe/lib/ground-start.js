// ground-start.js: the road's ground on the one medium engine. The superframe's lib/medium gained its GPU top view on
// 2026-10-26 (lib/medium/topview.mjs: topView, the same add(kind, where) as the tank), so the road starts its ground
// from there instead of the UI agent's local stand-in. This is the starter only: the canvas, the sections' viscosity
// (data-medium), clear water around reading blocks, the field carried with the scroll, and the visitor's own acts
// (a press drops ink, a moving pointer pushes current). The page sets window.__medium for its transfers and stops.
// Reduced motion and plain view are the engine's own (it settles once and holds a still).
import { topView } from "../../superframe/lib/medium/topview.mjs";

const VISC = { thin: 0.5, water: 0.9, viscous: 3.2 };
const root = document.documentElement;

export function startGround() {
  if (new URLSearchParams(location.search).get("medium") === "off") return null;  // A/B audits
  const c = document.createElement("canvas");
  c.className = "medium-ground"; c.setAttribute("aria-hidden", "true"); c.dataset.art = "";
  document.body.prepend(c);
  let m = null;
  try { m = topView(c); } catch (e) { console.info("road ground off:", e.message); }
  if (!m) { c.remove(); return null; }
  root.classList.add("medium-on"); window.__medium = m;
  const vw = () => innerWidth, vh = () => innerHeight, at = (x, y) => ({ x: x / vw(), y: y / vh() });
  const regions = () => m.region([...document.querySelectorAll("[data-medium]")].map((el) => {
    const r = el.getBoundingClientRect(); return { x0: r.left / vw(), x1: r.right / vw(), y0: r.top / vh(), y1: r.bottom / vh(), viscosity: VISC[el.dataset.medium] ?? 0.9 };
  }));
  const clears = () => m.clear?.([...document.querySelectorAll("main h2, main p")].map((e) => e.getBoundingClientRect())
    .filter((r) => r.width && r.bottom > 0 && r.top < vh()).slice(0, 8).map((r) => ({ left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height })));
  regions(); clears();
  m.seed?.([{ kind: "sediment", x: 0.3, y: 0.92, r: 0.22, aspect: 0.05, amount: 0.5, always: true }]);
  let px = -1, py = -1, sy = scrollY;
  addEventListener("pointermove", (e) => {
    if (px >= 0) { const dx = e.clientX - px, dy = e.clientY - py; if (dx * dx + dy * dy > 4) m.add("current", { ...at(e.clientX, e.clientY), r: 0.025, vx: dx * 0.22, vy: dy * 0.22 }); }
    px = e.clientX; py = e.clientY;
  }, { passive: true });
  addEventListener("pointerdown", (e) => m.add("ink", { ...at(e.clientX, e.clientY), r: 0.035, amount: 1.3 }), { passive: true });
  addEventListener("scroll", () => {
    const dy = scrollY - sy; sy = scrollY; if (!dy) return;
    m.shift?.(dy); regions(); clears();
    m.add("current", { x: 0.5, y: 0.5, r: 0.6, vx: 0, vy: Math.max(-8, Math.min(8, -dy * 0.08)) });
  }, { passive: true });
  addEventListener("resize", () => { regions(); clears(); });
  new MutationObserver(() => setTimeout(() => m.retheme?.(), 30)).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => m.retheme?.());
  return m;
}
