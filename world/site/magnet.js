// magnet.js: links reach for the pointer. After Lee Black's magnetic nodes (Fitts's law: a target that grows
// toward the pointer is faster to hit) the nearest link inside a capture radius leans toward the pointer and its
// underline takes the link's own colour at full weight. It lets go only past a wider release radius (hysteresis),
// so a link never flickers between two neighbours. On release it settles back on the slowing law of a system just
// past a saddle-node: it lingers near the boundary and falls away faster further out, with a delay that scales as
// (d - d_c)^(-1/2). Fine pointers only; with reduced motion the link is marked and does not move.
const CAPTURE = 26, RELEASE = 42, LEAN = 2.5; // px
const reduced = matchMedia("(prefers-reduced-motion: reduce)");
let held = null, raf = 0, px = 0, py = 0;

const links = () => document.querySelectorAll(".wi-links a, .wi-jump a, .floor-list a, header.o-hand a[href]");

function gap(el) { // distance from the pointer to the link's box, 0 inside it
  const r = el.getBoundingClientRect();
  return { d: Math.hypot(Math.max(r.left - px, 0, px - r.right), Math.max(r.top - py, 0, py - r.bottom)), r };
}
function lean(el, r) {
  if (reduced.matches) return;
  const cx = (r.left + r.right) / 2, cy = (r.top + r.bottom) / 2, dx = px - cx, dy = py - cy, n = Math.hypot(dx, dy) || 1;
  const k = Math.min(n / 40, 1) * LEAN;
  el.style.transition = "transform 90ms cubic-bezier(.2,0,0,1)";
  el.style.transform = `translate(${(dx / n * k).toFixed(2)}px, ${(dy / n * k).toFixed(2)}px)`;
}
function release(el, d) {
  // ghost slowing: tau = tau0 / sqrt((d - d_c) / d_c), clamped; d_c is the release radius
  const over = Math.max((d - RELEASE) / RELEASE, 0.02);
  const ms = Math.min(Math.max(70 / Math.sqrt(over), 80), 520);
  el.style.transition = reduced.matches ? "none" : `transform ${ms.toFixed(0)}ms cubic-bezier(.3,0,.1,1)`;
  el.style.transform = "";
  el.removeAttribute("data-held");
}
function frame() {
  raf = 0;
  if (held) { const { d, r } = gap(held); if (d > RELEASE || !held.isConnected) { release(held, d); held = null; } else { lean(held, r); return; } }
  let best = null, bd = CAPTURE;
  for (const a of links()) { const r = a.getBoundingClientRect(); if (r.bottom < py - 60 || r.top > py + 60) continue;
    const { d } = gap(a); if (d < bd) { bd = d; best = a; } }
  if (best) { held = best; held.setAttribute("data-held", ""); lean(held, held.getBoundingClientRect()); }
}
addEventListener("pointermove", (e) => { if (e.pointerType !== "mouse") return; px = e.clientX; py = e.clientY; if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
addEventListener("scroll", () => { if (held && !raf) raf = requestAnimationFrame(frame); }, { passive: true });
