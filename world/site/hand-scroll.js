// hand-scroll.js: the hand (the site's floating navigation) steps out of the way while the visitor reads down, and
// comes back on a move up, at the top of the page, on focus, or while a menu is open. It never covers content: one
// observer whose root is the hand's own place watches every text and control on the page, and while any of them is
// under that place the hand stays away. Focus and an open menu still bring it back, since then the visitor is using
// it. Once content sends it away during a scroll it waits for the scroll to settle before it comes back, so it does
// not blink in and out over the gaps between paragraphs. Reduced motion: it still steps away, without the slide.
const hand = document.querySelector("header.o-hand");
if (hand) {
  const phone = matchMedia("(max-width: 860px)"), reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let last = scrollY, away = false, down = false, held = false, settle = 0, io = null, zone = "";
  const under = new Set();
  // it moves by its top or bottom offset, never a transform: a transform would make the hand the containing block of
  // its fixed children (the skip link would then show while the hand is away)
  const style = () => { hand.style.transition = reduced.matches ? "none" : "top .28s cubic-bezier(.2,0,0,1)"; };
  const set = (v) => {
    if (v === away) return;
    away = v;
    const h = hand.offsetHeight + 32;
    hand.style.top = v ? `${-h}px` : "";
    hand.toggleAttribute("data-away", v);
    if (!v && reduced.matches) requestAnimationFrame(() => again());
  };
  const using = () => hand.contains(document.activeElement) || !!document.querySelector("dialog[open]");
  const decide = () => {
    if (using()) return set(false);
    if (under.size) { if (!away && settle) held = true; return set(true); }
    set(down || held);
  };
  const SKIP = "script,style,noscript,template,dialog,.skip";
  const CONTROL = 'a[href],button,input,select,textarea,summary,[role="button"],[tabindex]:not([tabindex="-1"])';
  const WHOLE = "img,svg,video";
  const mine = (e) => hand.contains(e) || !!e.closest(SKIP);
  // a picture held still on the screen (the backdrop's plate) is the ground, and always under the hand; it is asked
  // when the picture arrives under the hand, since a backdrop's style can land after this script runs
  const fixed = (e) => { for (let a = e; a && a !== document.body; a = a.parentElement) if (getComputedStyle(a).position === "fixed") return true; return false; };
  const ground = (e) => e.matches(WHOLE) && fixed(e);
  const add = (root) => {
    if (!io || !root || root.nodeType !== 1 || mine(root)) return;
    if (root.matches(CONTROL)) io.observe(root);
    for (const c of root.querySelectorAll(CONTROL)) if (!mine(c)) io.observe(c);
    for (const c of [root, ...root.querySelectorAll(WHOLE)]) if (c.matches(WHOLE) && !c.parentElement?.closest("svg") && !mine(c)) io.observe(c);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let p = null;
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const e = n.parentElement;
      if (e === p || !n.nodeValue.trim()) continue;
      p = e;
      if (!mine(e)) io.observe(e);
    }
  };
  // the place the hand holds at rest: every box it draws, its labels included, measured while it is home
  const measure = () => {
    if (away) return;
    let t = Infinity, l = Infinity, b = -Infinity, r = -Infinity;
    // the skip link and the menu are the hand's children but are placed on their own, so they are not its place
    for (const e of [hand, ...hand.querySelectorAll("*")]) for (const q of e.closest(".skip,dialog,[hidden]") ? [] : e.getClientRects()) {
      if (q.width < 1 || q.height < 1) continue;
      t = Math.min(t, q.top); l = Math.min(l, q.left); b = Math.max(b, q.bottom); r = Math.max(r, q.right);
    }
    if (t === Infinity) return;
    const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight, f = Math.floor;
    const m = `${-f(t - 2)}px ${-f(W - r - 2)}px ${-f(H - b - 2)}px ${-f(l - 2)}px`;
    if (m === zone) return;
    zone = m; io?.disconnect(); under.clear();
    io = new IntersectionObserver((es) => {
      for (const e of es) if (e.isIntersecting && !ground(e.target)) under.add(e.target); else under.delete(e.target);
      decide();
    }, { rootMargin: zone });
    add(document.body);
  };
  // content that arrives later (an opened panel, a run's results) is watched from the moment it is added
  new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) add(n.nodeType === 3 ? n.parentElement : n); })
    .observe(document.body, { childList: true, subtree: true });
  style(); reduced.addEventListener("change", style);
  addEventListener("scroll", () => {
    const y = scrollY, dy = y - last; last = y;
    if (y < 80) down = false; else if (dy > 6) down = true; else if (dy < -6) down = false;
    clearTimeout(settle); settle = setTimeout(() => { settle = 0; held = false; decide(); }, 160);
    decide();
  }, { passive: true });
  hand.addEventListener("focusin", () => set(false));
  hand.addEventListener("focusout", () => setTimeout(decide));
  // a new window size moves the hand's place; it is measured again the next time the hand is home and still
  let stale = false;
  const again = () => { if (stale && !away) { stale = false; measure(); } };
  hand.addEventListener("transitionend", again);
  addEventListener("resize", () => { stale = true; if (!away) requestAnimationFrame(again); }, { passive: true });
  phone.addEventListener("change", () => { if (away) { away = false; set(true); } });
  measure();
  document.fonts?.ready.then(() => { stale = true; again(); });
}
// magnetic links for a mouse, loaded when the page is idle; touch screens never fetch it
if (matchMedia("(pointer: fine)").matches) {
  const load = () => import("./magnet.js").catch((e) => console.error("magnet links did not load", e));
  addEventListener("load", () => ("requestIdleCallback" in window ? requestIdleCallback(load, { timeout: 2000 }) : setTimeout(load, 800)));
}
