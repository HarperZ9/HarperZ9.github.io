// home-field.js: the glass-and-water field behind the home. The rendered plate (a 32-sample still of the same
// renderer) is the first screen; on a device with a fine pointer, WebGL2 float targets, motion allowed and no
// data saving, the live render fades in over it once the page is idle. The dark scheme shows night.
// The Sky control (sky/sky.js) lights the same water with the visitor's own Sun and Moon, only when asked.
const box = document.querySelector(".gw-backdrop"), canvas = box?.querySelector("canvas.gw-live");
const root = document.documentElement;
const dark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
const space = () => (dark() ? "field-night" : "field-day") + (innerHeight > innerWidth ? "-tall" : "");
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const able = () => !reducedMotion() && matchMedia("(pointer: fine)").matches && navigator.connection?.saveData !== true && !root.classList.contains("weak") && !root.classList.contains("plain");
let field = null, making = null, skyOn = false;

// the field itself; asked=true when the visitor turned on Sky, which may start it on a phone too (their choice), and
// as one still frame instead of motion when reduced motion is set
function makeField(asked = false) {
  if (field) return Promise.resolve(field);
  if (making) return making;
  if (!canvas || root.classList.contains("plain") || (!asked && !able())) return Promise.resolve(null);
  making = (async () => {
    try {
      const { createField } = await import("/world/site/field/field.js");
      const reduced = reducedMotion();
      field = createField(canvas, { space: space(), dprCap: 1, reduced });
      if (reduced) { const r = canvas.getBoundingClientRect(); field.still({ n: 4, w: Math.round(r.width), h: Math.round(r.height) }); }
      field.start(); requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add("live")));
      document.addEventListener("visibilitychange", () => field.setVisible(!document.hidden));
      new MutationObserver(() => { if (!skyOn) field.go(space()); }).observe(root, { attributes: true, attributeFilter: ["data-theme", "class"] });
      matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (!skyOn) field.go(space()); });
      return field;
    } catch (e) { console.info("home field: the rendered plate stays", e.message); return null; }
  })();
  return making;
}
// the live render (a large shader to compile, the lettering's distance field to build) starts at the visitor's first
// move, scroll or key after load, so it never weighs on the first screen; until then the plate is the field
const EV = ["pointermove", "pointerdown", "scroll", "keydown", "wheel"];
const once = () => { for (const e of EV) removeEventListener(e, once); ("requestIdleCallback" in window ? requestIdleCallback(() => makeField(), { timeout: 1200 }) : setTimeout(() => makeField(), 200)); };
const arm = () => { for (const e of EV) addEventListener(e, once, { passive: true }); };
if (document.readyState === "complete") arm(); else addEventListener("load", arm, { once: true });

// the Sky control sits beside the lamp; its code loads only when it is pressed (or when the address plants a sky)
const hand = document.querySelector(".o-hand");
if (hand && canvas) {
  const cell = document.createElement("span");
  cell.className = "o-cell";
  cell.innerHTML = '<button type="button" data-o="sky" aria-haspopup="dialog" aria-pressed="false"><span class="o-name">Sky</span></button><span class="o-under" aria-hidden="true">Sky</span>';
  const lampBtn = hand.querySelector('[data-o="lamp"]');
  const anchor = lampBtn?.closest(".o-cell") || lampBtn;
  if (anchor) anchor.after(cell); else hand.append(cell);
  const btn = cell.querySelector("button");
  let mounted = null;
  const mount = () => (mounted ??= import("/world/site/sky/sky.js").then(({ mountSky }) => mountSky({ button: btn, getField: () => makeField(true), onActive: (on) => { skyOn = on; if (!on && field) field.go(space()); } })));
  btn.addEventListener("click", () => mount().then(() => btn.click()), { once: true });
  if (new URLSearchParams(location.search).get("sky")) mount();
}
