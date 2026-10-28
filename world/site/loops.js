// loops.js: every video loop on a page plays only while a quarter of it is in view, never under reduced motion, never
// in a hidden tab, and loads only as it comes near. The source is picked by the device pixels the slot needs, not by
// the viewport alone: a phone at 3x needs more than a 640 px file to fill its width, so it gets the 1280 px one, and
// a 1440 px window gets the 1920 px master. The poster is the still and follows the same rule.
//
//   <video data-loop data-src="/media/world/name-art/glass-tubes" data-sizes="1280 1920" preload="none" muted loop playsinline>
export function pick(sizes, cssWidth, dpr = devicePixelRatio || 1) {
  const need = cssWidth * Math.min(dpr, 2), list = [...sizes].sort((a, b) => a - b);
  return list.find((s) => s >= need) || list[list.length - 1];
}

function fill(v) {
  if (v.dataset.filled) return;
  const base = v.dataset.src, sizes = (v.dataset.sizes || "1920").split(/\s+/).map(Number);
  const w = pick(sizes, v.getBoundingClientRect().width || innerWidth);
  if (!v.poster) v.poster = `${base}-poster-${w}.webp`;
  if (base) {
    const level = w > 1280 ? "08" : "05";  // AV1 level 4.0 for 1080p, 3.1 for 720p; the masters are 10-bit
    v.innerHTML = `<source src="${base}-${w}.webm" type='video/webm; codecs="av01.0.${level}M.10"'><source src="${base}-${w}.mp4" type='video/mp4; codecs="avc1.640028"'>`;
    if (v.preload !== "none") v.load();
  }
  v.dataset.filled = String(w);
}

export function watchLoops(still) {
  const loops = [...document.querySelectorAll("video[data-loop]")];
  for (const v of loops) if (v.dataset.eager !== undefined) { fill(v); if (!still()) v.preload = "auto"; }
  const near = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) {
    const v = e.target; fill(v); if (v.preload === "none" && !still()) { v.preload = "auto"; v.load(); }
  } }, { rootMargin: "100% 0px" });
  const seen = new IntersectionObserver((es) => {
    for (const e of es) {
      const v = e.target;
      if (e.isIntersecting && !still() && !document.hidden) v.play().catch((err) => { if (err.name !== "AbortError") console.info("loop stays on its poster:", err.message); });
      else v.pause();
      v.__inView = e.isIntersecting;
    }
  }, { threshold: 0.25 });
  for (const v of loops) { near.observe(v); seen.observe(v); v.addEventListener("playing", () => v.classList.add("on")); }
  // a world switch hands the arrival a new loop: fill it again and play it if it is in view
  document.addEventListener("loops:refill", (e) => { const v = e.detail; fill(v); if (!still()) { v.preload = "auto"; v.load(); if (v.__inView) v.play().catch(() => {}); } });
  document.addEventListener("visibilitychange", () => { for (const v of loops) { if (document.hidden) v.pause(); else if (v.__inView && !still()) v.play().catch(() => {}); } });
  matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", () => { if (still()) for (const v of loops) v.pause(); });
  return loops;
}
