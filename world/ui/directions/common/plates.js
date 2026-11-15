// Plates: drifting art layers and halftone photographs. base.js loads this file only on a page that holds
// [data-drift] or img[data-halftone]; a page without them never downloads it.
const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)");

// Drift: art layers move against the scroll at their own rate. Off under reduced motion.
function initDrift() {
  const layers = [...document.querySelectorAll("[data-drift]")];
  if (!layers.length) return;
  let ticking = false;
  const apply = () => {
    ticking = false;
    if (reduced.matches) { layers.forEach((l) => { l.style.transform = ""; }); return; }
    const y = scrollY;
    layers.forEach((l) => {
      const d = (y * Number(l.dataset.drift)).toFixed(1);
      l.style.transform = l.dataset.axis === "x" ? `translate3d(${d}px, -50%, 0)` : `translate3d(0, ${d}px, 0)`;
    });
  };
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(apply); } }, { passive: true });
  reduced.addEventListener("change", apply);
  apply();
}

// Halftone: an archival photograph re-screened as dots whose size follows the tone, drawn in
// the colour of its container. The <img> stays in the markup for no-JS and plain view.
function halftone(img) {
  const draw = () => {
    const box = img.parentElement, r = box.getBoundingClientRect();
    if (!r.width || !img.naturalWidth) return;
    const cell = Number(img.dataset.halftone) || 6, dpr = Math.min(devicePixelRatio || 1, 2);
    let c = box.querySelector("canvas.ht");
    if (!c) { c = document.createElement("canvas"); c.className = "ht"; c.setAttribute("aria-hidden", "true"); c.dataset.art = ""; box.appendChild(c); }
    c.width = Math.round(r.width * dpr); c.height = Math.round(r.height * dpr);
    const cols = Math.ceil(r.width / cell), rows = Math.ceil(r.height / cell);
    const s = document.createElement("canvas"); s.width = cols; s.height = rows;
    const sx = s.getContext("2d", { willReadFrequently: true });
    const k = Math.max(cols / img.naturalWidth, rows / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    // data-halftone-y picks the vertical focus (0 top, 1 bottom) when the plate is taller than its slab
    const fy = img.dataset.halftoneY !== undefined ? Number(img.dataset.halftoneY) : 0.5;
    sx.drawImage(img, (cols - w) / 2, (rows - h) * fy, w, h);
    const px = sx.getImageData(0, 0, cols, rows).data;
    const g = c.getContext("2d", { colorSpace: "display-p3" }) || c.getContext("2d"); g.scale(dpr, dpr);
    g.fillStyle = getComputedStyle(c).color;
    const invert = img.dataset.halftoneInvert !== undefined;
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4, lum = (0.2126 * px[i] + 0.7152 * px[i + 1] + 0.0722 * px[i + 2]) / 255;
      const t = invert ? lum : 1 - lum, rad = (cell / 2) * Math.sqrt(Math.min(1, t * 1.15));
      if (rad < 0.35) continue;
      g.beginPath(); g.arc(x * cell + cell / 2 + (y % 2 ? cell / 2 : 0), y * cell + cell / 2, rad, 0, 6.2832); g.fill();
    }
    box.classList.add("ht-on");
  };
  if (img.complete) draw(); else img.addEventListener("load", draw, { once: true });
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(draw, 150); });
  new MutationObserver(() => setTimeout(draw, 30)).observe(root, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
}

export function initPlates() {
  document.querySelectorAll("img[data-halftone]").forEach(halftone);
  initDrift();
}
