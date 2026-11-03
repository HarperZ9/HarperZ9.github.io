// glass-water.js: the glass-and-water place. The field (world/site/field/) renders live in WebGL2; the spaces are its
// parameter sets, and a press eases every parameter to the next one. Reduced motion settles each space into one
// accumulated still. Without WebGL2 and float targets, the page keeps its rendered plate.
import { createField, SPACES } from "/world/site/field/field.js";

const host = document.querySelector("[data-glass-water]");
if (host) {
  const canvas = host.querySelector("canvas.gw-field"), say = host.querySelector(".gw-say"), buttons = [...host.querySelectorAll("[data-space]")];
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const params = new URLSearchParams(location.search), start = SPACES[params.get("space")] ? params.get("space") : "close";
  const SAY = {
    "low-sun": "The sun a hand above the horizon: the sky reddens toward it, and the glass carries the light across the water.",
    "close": "At the water line, close enough that the letters fill the view and the horizon runs through them.",
    "noon": "High sun, seen from a cliff: the water clears to blue, and the glass throws back the light it bends.",
    "night": "A gibbous moon over a dark sea: one cold path of light, and the glass only where it catches it.",
  };
  const mark = (id) => {
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.space === id));
    if (say) say.textContent = SAY[id];
    canvas.setAttribute("aria-label", `${SPACES[id].label}: ${SAY[id]} The glass letters read "${SPACES[id].word}".`);
  };
  // each space's rendered plate shows first (and stays where the live render cannot run)
  const plate = (id) => { host.style.setProperty("--gw-plate", `url("/media/world/glass-water/${id}-${innerWidth > 960 ? 1920 : 960}.webp")`); };
  let field = null, cur = start;
  const make = () => {
    try { field = createField(canvas, { space: cur, reduced, dprCap: Math.min(3, Number(params.get("dpr")) || 1.5) }); host.classList.add("gw-live-on"); }
    catch (e) { console.info("glass-water: the live field is not available here; the rendered plate stays", e.message); }
    return field;
  };
  plate(start); mark(start);
  const still = params.get("still");
  if (still) make();
  // ?still=1&w=3840&h=2160&n=32 renders one accumulated still at that size and stops (for the rendered plates)
  if (field && still) {
    document.fonts.ready.then(() => { field.still({ n: Number(params.get("n")) || 32, w: Number(params.get("w")) || 3840, h: Number(params.get("h")) || 2160 }); window.__stillDone = true; });
  } else {
    // the live render starts at the first move, scroll, key or press of a space, after the plate has painted
    const EV = ["pointermove", "pointerdown", "scroll", "keydown", "wheel"];
    const go = () => { for (const e of EV) removeEventListener(e, go); if (field || !make()) return;
      document.fonts.ready.then(() => field.start());
      new IntersectionObserver(([e]) => field.setVisible(e.isIntersecting)).observe(canvas);
      document.addEventListener("visibilitychange", () => field.setVisible(!document.hidden));
      window.__glassWater = field; };
    for (const e of EV) addEventListener(e, go, { passive: true });
  }
  for (const b of buttons) b.addEventListener("click", () => {
    const id = b.dataset.space; cur = id; mark(id); plate(id); field?.go(id);
    const u = new URL(location.href); u.searchParams.set("space", id); history.replaceState(null, "", u);
  });
}
