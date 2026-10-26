// budget.js: the site's step-down for weak devices, read before any art starts. Under 4 GB of memory, four or
// fewer cores, or Save-Data, the flow ground stays off (<html data-ground="off">) and loops stay on their posters
// (html.weak). Every other GPU path carries its own guard: the flow medium holds its GPU time to 4 ms a frame and
// stops when the tab is hidden or the water has settled; loops and living type pause off screen.
const n = navigator, root = document.documentElement;
const weak = (n.deviceMemory && n.deviceMemory < 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || n.connection?.saveData === true;
if (weak || new URLSearchParams(location.search).get("weak") === "1") { root.dataset.ground = "off"; root.classList.add("weak"); }

// Touch screens: the heavy layers (the flow ground, the alive layer) start at the visitor's first touch, scroll or
// key, after the first screen is settled. Pointer screens start them when the page is idle after load.
const coarse = matchMedia("(pointer: coarse)").matches;
window.__siteWhenVisited = (fn) => {
  if (!coarse) return fn();
  const once = () => { for (const ev of ["pointerdown", "scroll", "keydown", "touchstart"]) removeEventListener(ev, once); fn(); };
  for (const ev of ["pointerdown", "scroll", "keydown", "touchstart"]) addEventListener(ev, once, { passive: true });
};
