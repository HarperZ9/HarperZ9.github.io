// The negative cut. Where a slab crosses lettered type, the crossing prints in negative.
// Lettering from the library draws opaque material, so a blend on the text alone cannot invert it.
// Instead a white layer with a difference blend is laid over the heading, clipped to the part of the
// heading the slab covers: inside the crossing, letters and ground both print negative.
// Plain view, forced colours and print hide it with the rest of the art (data-art).
function polyOf(cut) {
  const v = getComputedStyle(cut).clipPath;
  const m = /polygon\((.*)\)/.exec(v);
  if (!m) return null;
  const r = cut.getBoundingClientRect();
  return m[1].split(",").map((pt) => {
    const [x, y] = pt.trim().split(/\s+/);
    const val = (s, size) => (s.endsWith("%") ? (parseFloat(s) / 100) * size : parseFloat(s));
    return [r.left + val(x, r.width), r.top + val(y, r.height)];
  });
}

function place(el, cut, layer) {
  const pts = polyOf(cut);
  if (!pts) { layer.hidden = true; return; }
  // cover the drawn art, which may bleed past the heading's box
  const art = el.querySelector(":scope > canvas, :scope > .slot-art") || el;
  const b = art.getBoundingClientRect(), e = el.getBoundingClientRect();
  Object.assign(layer.style, { left: `${b.left - e.left}px`, top: `${b.top - e.top}px`, width: `${b.width}px`, height: `${b.height}px` });
  layer.hidden = false;
  layer.style.clipPath = `polygon(${pts.map(([x, y]) => `${(x - b.left).toFixed(1)}px ${(y - b.top).toFixed(1)}px`).join(",")})`;
}

export function initNegatives() {
  for (const el of document.querySelectorAll("[data-negative]")) {
    const cut = el.closest(".room")?.querySelector(":scope > .cut");
    if (!cut) continue;
    const layer = document.createElement("span");
    layer.className = "negative";
    layer.setAttribute("aria-hidden", "true");
    layer.dataset.art = "";
    el.append(layer);
    const go = () => place(el, cut, layer);
    go();
    addEventListener("resize", go);
    cut.addEventListener("animationend", go);
    document.fonts.ready.then(go);
    setTimeout(go, 1000);
  }
}
