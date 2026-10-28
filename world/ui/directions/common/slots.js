// Display-type slots. A slot is any element with data-display="<technique>": a masthead, a room
// title, a one-word title. Its text stays real (DOM, selectable, read aloud, indexed). A lettering
// renderer draws the same words from a material and the shell lays that drawing over the text.
//
// Renderers, in order of preference:
//   1. A module named on <html data-lettering="path/to/module.mjs"> that exports
//      letter(text, technique, opts) and returns a Node, an SVG string, or a Promise of either.
//      This is the slot for the lettering library (lettering).
//   2. window.UIShell.registerLettering(fn) called by any script before or after load.
//   3. The shell's own small set in lettering.js (chladni, dots, spectrogram, scraps, series), applied
//      by copying the slot's technique into data-letter.
// If none can draw the technique, the slot shows its text as ink. Nothing is ever hidden.
const root = document.documentElement;
const LOCAL = new Set(["chladni", "dots", "spectrogram", "scraps", "series"]);
let external = null;
const OWN = new Set(["scraps", "dots", "spectrogram", "series", "chladni"]);
const pending = [];

window.UIShell = Object.assign(window.UIShell || {}, {
  registerLettering(fn) {
    if (typeof fn !== "function") throw new TypeError("UIShell.registerLettering needs a function");
    external = fn;
    pending.splice(0).forEach(draw);
  },
  slots: () => [...document.querySelectorAll("[data-display]")],
  // draw a slot that was hidden at load (a menu word), once it has a size
  drawSlot: (el) => draw(el),
});

function optsOf(el) {
  const cs = getComputedStyle(el), r = el.getBoundingClientRect();
  const o = { width: r.width, height: r.height, font: `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`, ink: cs.color, reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches };
  for (const [k, v] of Object.entries(el.dataset)) if (k.startsWith("opt")) {
    // image options are resolved against this page, so a slot can hand the library our own plates
    o[k.slice(3).replace(/^./, (c) => c.toLowerCase())] = /\.(webp|jpe?g|png)$/i.test(v) ? new URL(v, document.baseURI).href : v;
  }
  return o;
}

async function draw(el) {
  const technique = el.dataset.display, text = el.textContent.trim();
  // the shell's own archive-scrap, plate-dot, series and spectrogram systems are not in the library
  if (OWN.has(technique)) { el.dataset.letter = technique; return; }
  if (!external) {
    if (LOCAL.has(technique)) el.dataset.letter = technique;
    else pending.push(el);
    return;
  }
  try {
    let out = await external(text, technique, optsOf(el));
    // the lettering library returns a drawing that mounts itself under the element's own text
    if (out && typeof out.mount === "function") {
      // QUALITY-SPEC R5: 2D art canvases request display-p3. The library creates its own canvases, so the
      // adapter asks for p3 on 2D contexts created while it mounts. (Better fixed in the library itself.)
      const proto = HTMLCanvasElement.prototype, get = proto.getContext;
      proto.getContext = function (type, attrs) { return get.call(this, type, type === "2d" ? { colorSpace: "display-p3", ...(attrs || {}) } : attrs); };
      try { await out.mount(el); } finally { proto.getContext = get; }
      el.classList.add("slot-on"); el.lettering = out; return;
    }
    if (typeof out === "string") { const d = document.createElement("div"); d.innerHTML = out; out = d; }
    if (!(out instanceof Node)) throw new TypeError("letter() returned nothing drawable");
    let layer = el.querySelector(":scope > .slot-art");
    if (!layer) { layer = document.createElement("div"); layer.className = "slot-art"; layer.setAttribute("aria-hidden", "true"); layer.dataset.art = ""; el.prepend(layer); }
    layer.replaceChildren(out);
    el.classList.add("slot-on");
  } catch (e) {
    console.warn(`slots: technique "${technique}" could not draw; the text stays as ink`, e);
    el.classList.remove("slot-on");
    if (LOCAL.has(technique)) el.dataset.letter = technique;
  }
}

export async function initSlots() {
  const src = root.dataset.lettering;
  if (src) {
    try {
      const href = new URL(src, document.baseURI).href;
      const mod = await import(href);
      // the house face drives the lettering skeletons too, when the page is set in it
      if (root.dataset.type === "house") {
        try { await (await import(new URL("houseface.mjs", href).href)).registerHouseFace(); }
        catch (e) { console.info("slots: house face not registered with the lettering library; Hanken skeletons stay", e.message); }
      }
      if (typeof mod.letter === "function") external = mod.letter;
      else console.warn("slots: lettering module has no letter() export", src);
    } catch (e) { console.warn("slots: lettering module failed to load; using the shell's own set", src, e); }
  }
  for (const el of document.querySelectorAll("[data-display]")) await draw(el);
}
