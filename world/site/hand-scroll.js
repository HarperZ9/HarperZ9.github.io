// hand-scroll.js: the hand (the site's floating navigation) steps out of the way while the visitor reads down, and
// comes back on the first move up, at the top of the page, on focus, or while a menu is open. It never covers
// content the visitor is moving toward. Reduced motion: it still steps away, without the slide.
const hand = document.querySelector("header.o-hand");
if (hand) {
  const phone = matchMedia("(max-width: 860px)"), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let last = scrollY, away = false;
  // it moves by its top or bottom offset, never a transform: a transform would make the hand the containing block of
  // its fixed children (the skip link would then show while the hand is away)
  const style = () => { hand.style.transition = reduced.matches ? "none" : "top .28s cubic-bezier(.2,0,0,1)"; };
  const set = (v) => {
    if (v === away) return;
    away = v;
    const h = hand.offsetHeight + 32;
    hand.style.top = v ? `${-h}px` : "";
    hand.toggleAttribute("data-away", v);
  };
  style(); reduced.addEventListener("change", style);
  addEventListener("scroll", () => {
    const y = scrollY, dy = y - last; last = y;
    if (y < 80 || hand.contains(document.activeElement) || document.querySelector("dialog[open]")) return set(false);
    if (dy > 6) set(true); else if (dy < -6) set(false);
  }, { passive: true });
  hand.addEventListener("focusin", () => set(false));
  phone.addEventListener("change", () => { if (away) { away = false; set(true); } });
}
// magnetic links for a mouse, loaded when the page is idle; touch screens never fetch it
if (matchMedia("(pointer: fine)").matches) {
  const load = () => import("./magnet.js").catch((e) => console.error("magnet links did not load", e));
  addEventListener("load", () => ("requestIdleCallback" in window ? requestIdleCallback(load, { timeout: 2000 }) : setTimeout(load, 800)));
}
