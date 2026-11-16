// Drivers: bind a pure function of progress to a clock that is not the player's. A scene is a pure function of
// time, so the position of an element in the viewport, or a short clock, can stand in for t.
//
//   import { transitions, walk } from "./transitions.mjs";
//   import { bind } from "./scroll.mjs";
//   const stop = bind(figure, walk(transitions.aperture()), { driver: "view" });   // follows the scroll, both ways
//   bind(figure, transitions.tiles(), { driver: "clock", duration: 900 });         // plays once
//
// "view": progress is how far the element has crossed the viewport, 0 as its top edge meets the viewport's
// bottom and 1 as its bottom edge leaves the top. Where the browser has view timelines the frames are sampled
// once into keyframes and the browser moves them itself with the scroll, off the page's script; elsewhere a
// passive scroll listener sets the same frames, one read and one write a frame. Reduced motion: the settled
// frame, once, and nothing bound. The first half of this file is pure and runs in Node.

const pct = (v) => `${+(v * 100).toFixed(2)}%`;
// A shape as one CSS polygon. Contours after the first are joined through the first point of the first; the
// bridges have no area, so the nonzero rule fills each contour as its own piece.
export function clipPath(shape) {
  if (!shape || !shape.length) return "none";
  const out = [], a0 = shape[0].pts, anchor = `${pct(a0[0])} ${pct(a0[1])}`;
  shape.forEach((c, k) => {
    const a = c.pts;
    for (let i = 0; i < a.length; i += 2) out.push(`${pct(a[i])} ${pct(a[i + 1])}`);
    out.push(`${pct(a[0])} ${pct(a[1])}`);
    if (k < shape.length - 1) out.push(anchor);
  });
  return `polygon(nonzero, ${out.join(", ")})`;
}
// A frame as style values. The matrix's translation is in box units, so it is written in percent of the element.
export function styleOf(fr) {
  const [a, b, c, d, e, f] = fr.matrix;
  return { clipPath: clipPath(fr.clip), opacity: String(+fr.opacity.toFixed(4)), transform: `translate(${pct(e)}, ${pct(f)}) matrix(${+a.toFixed(5)}, ${+b.toFixed(5)}, ${+c.toFixed(5)}, ${+d.toFixed(5)}, 0, 0)` };
}
// n + 1 frames of f across 0..1 as keyframes with offsets.
export function keyframes(f, n = 32) {
  return Array.from({ length: n + 1 }, (_, i) => ({ offset: i / n, ...styleOf(f(i / n)) }));
}
// Progress of a box through a viewport: 0 as its top meets the viewport's bottom, 1 as its bottom leaves the top.
export function viewProgress(top, height, viewport) {
  const u = (viewport - top) / (viewport + height);
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

export function bind(el, f, { driver = "view", samples = 32, duration = 900, reduced = null, subject = el, win = globalThis } = {}) {
  const still = reduced ?? win.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const apply = (u) => Object.assign(el.style, styleOf(f(u)));
  const clear = () => { el.style.clipPath = el.style.opacity = el.style.transform = ""; };
  if (still) { clear(); return () => {}; }                         // the settled piece is the element as it stands
  if (driver === "clock") {
    const t0 = win.performance.now(); let id = 0;
    const step = (now) => { const u = Math.min(1, (now - t0) / duration); apply(u); if (u < 1) id = win.requestAnimationFrame(step); else clear(); };
    id = win.requestAnimationFrame(step);
    return () => { win.cancelAnimationFrame(id); clear(); };
  }
  if (typeof win.ViewTimeline === "function" && el.animate) {
    try {
      const anim = el.animate(keyframes(f, samples), { timeline: new win.ViewTimeline({ subject, axis: "block" }), rangeStart: "cover 0%", rangeEnd: "cover 100%", fill: "both", easing: "linear" });
      return () => anim.cancel();
    } catch (e) { console.warn("motion scroll: view timeline refused, following the scroll by script", e); }
  }
  let dirty = true, id = 0, live = true;
  const mark = () => { dirty = true; };
  const tick = () => {
    if (!live) return;
    if (dirty) { dirty = false; const r = subject.getBoundingClientRect(); apply(viewProgress(r.top, r.height, win.innerHeight)); }
    id = win.requestAnimationFrame(tick);
  };
  win.addEventListener("scroll", mark, { passive: true }); win.addEventListener("resize", mark);
  id = win.requestAnimationFrame(tick);
  return () => { live = false; win.cancelAnimationFrame(id); win.removeEventListener("scroll", mark); win.removeEventListener("resize", mark); clear(); };
}
