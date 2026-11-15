// What the generator-backed parts share: the workspace loader, the shared clock, and a canvas laid in an element.
import { workspaceRoot } from "./root.js";
export const root = document.documentElement;
export const reduced = matchMedia("(prefers-reduced-motion: reduce)");
export const still = () => reduced.matches || root.classList.contains("plain");
export const WS = (() => { try { return new URL(workspaceRoot()); } catch (e) { console.info(e.message); return null; } })();
export const load = (p) => (WS ? import(new URL(p, WS).href) : Promise.reject(new Error("workspace root unknown, " + p + " skipped")));
export const clock = (f) => window.UIShell?.clock?.subscribe?.(f) ?? (() => {});
export const DPR = () => Math.min(devicePixelRatio || 1, 2);
export const css = (el, k) => getComputedStyle(el).getPropertyValue(k).trim();
export const hexRgb = (h) => { const c = document.createElement("canvas").getContext("2d"); c.fillStyle = h; const v = c.fillStyle; return v.startsWith("#") ? [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)) : (v.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number); };
export function canvasIn(el, cls) {
  let cv = el.querySelector(`:scope > canvas.${cls}`);
  if (!cv) { cv = document.createElement("canvas"); cv.className = cls; cv.setAttribute("aria-hidden", "true"); cv.dataset.art = ""; el.prepend(cv); }
  return cv;
}
