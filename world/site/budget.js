// budget.js: the site's step-down for weak devices, read before any art starts. Under 4 GB of memory, four or
// fewer cores, or Save-Data, the flow ground stays off (<html data-ground="off">) and loops stay on their posters
// (html.weak). Every other GPU path carries its own guard: the flow medium holds its GPU time to 4 ms a frame and
// stops when the tab is hidden or the water has settled; loops and living type pause off screen.
const n = navigator, root = document.documentElement;
const weak = (n.deviceMemory && n.deviceMemory < 4) || (n.hardwareConcurrency && n.hardwareConcurrency <= 4) || n.connection?.saveData === true;
if (weak || new URLSearchParams(location.search).get("weak") === "1") { root.dataset.ground = "off"; root.classList.add("weak"); }
