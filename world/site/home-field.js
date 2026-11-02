// home-field.js: the glass-and-water field behind the home. The rendered plate (a 32-sample still of the same
// renderer) is the first screen; on a device with a fine pointer, WebGL2 float targets, motion allowed and no
// data saving, the live render fades in over it once the page is idle. The dark scheme shows night.
const box = document.querySelector(".gw-backdrop"), canvas = box?.querySelector("canvas.gw-live");
const root = document.documentElement;
const dark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
const space = () => (dark() ? "field-night" : "field-day") + (innerHeight > innerWidth ? "-tall" : "");
const able = () => !matchMedia("(prefers-reduced-motion: reduce)").matches && matchMedia("(pointer: fine)").matches && navigator.connection?.saveData !== true && !root.classList.contains("weak") && !root.classList.contains("plain");
async function start() {
  if (!canvas || !able()) return;
  let field;
  try { const { createField } = await import("/world/site/field/field.js"); field = createField(canvas, { space: space(), dprCap: 1 }); }
  catch (e) { console.info("home field: the rendered plate stays", e.message); return; }
  field.start(); requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("live")));
  document.addEventListener("visibilitychange", () => field.setVisible(!document.hidden));
  new MutationObserver(() => field.go(space())).observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => field.go(space()));
}
// the live render (a large shader to compile, the lettering's distance field to build) starts at the visitor's first
// move, scroll or key after load, so it never weighs on the first screen; until then the plate is the field
const EV = ["pointermove", "pointerdown", "scroll", "keydown", "wheel"];
const once = () => { for (const e of EV) removeEventListener(e, once); ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 200)); };
const arm = () => { for (const e of EV) addEventListener(e, once, { passive: true }); };
if (document.readyState === "complete") arm(); else addEventListener("load", arm, { once: true });
