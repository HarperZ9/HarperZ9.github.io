// walk.js: moving along the road. The page scrolls natively (the visitor's own speed and momentum, back and
// forward as usual); each stop is a section of the page, and the distance s along the road is read from where
// the sections sit. Keys: N or J next stop, P or K previous stop, B the branches at a junction, I the index.
// Announcements say where the visitor is. One callback, onMove(s, at), runs on the page's shared clock.
export function walk({ road, sections, say, band, onMove, onStop }) {
  let s = 0, last = -1, dirty = true;
  const N = sections.length;
  const measure = () => {
    const mid = innerHeight * 0.45, y = scrollY;
    for (let i = N - 1; i >= 0; i--) {
      const r = sections[i].getBoundingClientRect();
      if (r.top <= mid || i === 0) { const local = Math.min(0.999, Math.max(0, (mid - r.top) / Math.max(1, r.height))); return Math.min(road.length - 1e-3, i + local); }
    }
    return y > 0 ? road.length - 1e-3 : 0;
  };
  const update = () => {
    s = measure(); const at = road.at(s);
    if (at.index !== last) {
      last = at.index;
      say.textContent = `${at.stop.title}. Stop ${at.index + 1} of ${road.length}, ${at.district.title.toLowerCase()}.`;
      band?.focus(at.stop.id); onStop?.(at);
    }
    band?.progress(at.progress + 1 / road.length * at.local);
    onMove(s, at);
  };
  const go = (i) => { i = Math.max(0, Math.min(N - 1, i)); const top = sections[i].getBoundingClientRect().top + scrollY; scrollTo({ top: top + 1, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); sections[i].querySelector("h2")?.focus({ preventScroll: true }); };
  addEventListener("scroll", () => { dirty = true; }, { passive: true });
  addEventListener("resize", () => { dirty = true; });
  document.addEventListener("keydown", (e) => {
    if (e.target.closest?.("input,textarea,select") || e.ctrlKey || e.metaKey || e.altKey) return;
    const i = road.at(s).index;
    if (e.key === "n" || e.key === "j") { e.preventDefault(); go(i + 1); }
    else if (e.key === "p" || e.key === "k") { e.preventDefault(); go(s - i < 0.05 ? i - 1 : i); }
    else if (e.key === "b") { const j = sections[i].querySelector(".branches a"); if (j) { e.preventDefault(); j.focus(); } }
    else if (e.key === "i") location.href = "floor.html";
  });
  return { tick() { if (dirty) { dirty = false; update(); } else onMove(s, road.at(s), true); }, go, get s() { return s; } };
}
