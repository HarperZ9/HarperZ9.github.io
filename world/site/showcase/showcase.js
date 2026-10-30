// showcase.js: mounts a deep-zoom viewer on each render and fills its caption from the render's own receipt (the
// time, the GPU energy and the size come from the file written by the renderer, never typed by hand).
// Tiles come from <main data-tiles>; ?tiles= may point at this origin or a local server, for testing a tile set.
import { mount } from "/world/site/showcase/deepzoom.js";

const main = document.querySelector("main[data-tiles]");
let base = main.dataset.tiles;
const q = new URLSearchParams(location.search).get("tiles");
if (q) { const u = new URL(q, location.href); if (u.origin === location.origin || ["127.0.0.1", "localhost"].includes(u.hostname)) base = u.href; }
const fmt = (n) => n.toLocaleString("en-GB");
for (const fig of document.querySelectorAll("figure[data-render]")) {
  const name = fig.dataset.render, frame = fig.querySelector(".dz-frame"), cap = fig.querySelector("[data-receipt]");
  mount(frame, `${base}${name}.json`).then(({ manifest: m }) => {
    window.__showcase = { ...(window.__showcase || {}), [name]: { level: frame.dataset.level } };
    return fetch(`${base}${name}.receipt.json`).then((r) => (r.ok ? r.json() : null)).then((rc) => {
      if (!rc) return;
      const s = Math.round(rc.render_s + rc.grade_s), j = rc.render_J == null ? null : Math.round(rc.render_J + (rc.grade_J || 0));
      cap.textContent = `${fmt(m.width)} by ${fmt(m.height)} pixels, ${rc.samples_per_pixel} samples a pixel, ${rc.wavelengths} wavelengths; ${s} s on one ${rc.device.replace(/^NVIDIA /, "")}${j == null ? "" : `, ${fmt(j)} J of GPU energy`}.`;
    });
  }).catch((e) => { console.error("showcase: tiles did not load for", name, e); cap.textContent = "The tiles for this render are not available here."; });
}
