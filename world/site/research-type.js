// research-type.js: depth and letter colour for the findings type, moved by light and scroll. The type stays real
// text: depth is drawn by text-shadow on the element and on a pseudo-element whose content is the heading's own
// data-depth string, marked with empty alternative text so it is never read aloud, and colour is a fill clipped to
// the glyphs. This script only sets three custom properties on the root:
//   --sx, --sy    the unit direction the extrusion falls, away from the light. The reading field's plate has its sun
//                 high on the right, so the light comes from the upper right and depth falls to the lower left; the
//                 angle swings 10 degrees either way as the reader moves down the page
//   --rt-shift    where the spectral fill sits along its gradient, 0 to 100 percent with the page's scroll
// Reduced motion keeps colour and depth and holds them at the page's first state. Plain view drops both (research.css).
const root = document.documentElement;
const still = matchMedia("(prefers-reduced-motion: reduce)");
const SUN = 38;  // degrees from vertical toward the right, the plate's sun

function place() {
  const span = root.scrollHeight - innerHeight, q = still.matches || span <= 0 ? 0 : Math.min(1, Math.max(0, scrollY / span));
  const a = ((SUN + (still.matches ? 0 : (q - 0.5) * 20)) * Math.PI) / 180;
  root.style.setProperty("--sx", (-Math.sin(a)).toFixed(3));
  root.style.setProperty("--sy", Math.cos(a).toFixed(3));
  root.style.setProperty("--rt-shift", `${(q * 100).toFixed(1)}%`);
}

let queued = false;
const onScroll = () => { if (queued || still.matches) return; queued = true; requestAnimationFrame(() => { queued = false; place(); }); };
addEventListener("scroll", onScroll, { passive: true });
addEventListener("resize", onScroll, { passive: true });
still.addEventListener("change", place);
place();
