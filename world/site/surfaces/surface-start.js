// surface-start.js: all a surface loads before a press. One press, or an address that carries ?start, brings the
// modules in (surface-page.mjs). The hand's scroll behaviour loads when the page is idle.
const b = document.getElementById("sx-start"), say = document.getElementById("sx-say");
if (b) {
  const words = b.textContent;
  const go = () => {
    b.disabled = true; b.textContent = "Starting";
    import("./surface-page.mjs").then((m) => m.start()).catch((e) => {
      console.error("surface: the modules did not start", e);
      b.disabled = false; b.textContent = words; say.textContent = "The modules did not load. The reading above stays as built.";
    });
  };
  b.hidden = false; b.addEventListener("click", go);
  if (new URLSearchParams(location.search).has("start")) go();
}
const idle = () => import("../hand-scroll.js").catch((e) => console.error("hand scroll did not load", e));
addEventListener("load", () => ("requestIdleCallback" in window ? requestIdleCallback(idle, { timeout: 2000 }) : setTimeout(idle, 800)));
