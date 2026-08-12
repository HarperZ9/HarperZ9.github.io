// palpable.js: the house feel, shared by every surface. A pressed control
// knocks back (scale + ring flash + a short buzz), a dragged slider ticks
// through fourteen detents like a real knob. The module carries its own
// keyframes so a page needs no extra stylesheet, and every channel respects
// prefers-reduced-motion. An optional ping function adds the sound.

export const DETENTS = 14;

// Which detent a value sits in; pure for tests.
export function detentStep(value, min, max, steps) {
  const span = (max - min) / (steps || DETENTS);
  if (!(span > 0)) return 0;
  return Math.round((value - min) / span);
}

const CSS = "@keyframes wb-knock{0%{transform:scale(1)}38%{transform:scale(.93)}100%{transform:scale(1)}}" +
  "@keyframes wb-flash{0%{box-shadow:0 0 0 0 color-mix(in oklab,var(--orange,#c86a44) 70%,transparent)}" +
  "100%{box-shadow:0 0 0 .5rem transparent}}" +
  ".wb-hit{animation:wb-knock .16s ease-out, wb-flash .42s ease-out}" +
  "@keyframes wb-detent{0%{background:color-mix(in oklab,var(--orange,#c86a44) 40%,transparent)}100%{background:transparent}}" +
  ".wb-tick{animation:wb-detent .18s ease-out}" +
  "@media (prefers-reduced-motion:reduce){.wb-hit,.wb-tick{animation:none}}";

let cssMounted = false;
function ensureCss(doc) {
  if (cssMounted) return;
  const st = doc.createElement("style");
  st.textContent = CSS;
  doc.head.appendChild(st);
  cssMounted = true;
}

// Wire a panel: opts.hitSelector picks what knocks, opts.ping(kind, value)
// adds sound when the caller has audio running (a no-op default otherwise).
export function wirePalpable(root, opts = {}) {
  if (!root) return;
  ensureCss(root.ownerDocument || document);
  const ping = opts.ping || (() => {});
  const hitSel = opts.hitSelector || "button, .re-chip, .re-toggle";
  const canBuzz = () => "vibrate" in navigator &&
    !matchMedia("(prefers-reduced-motion: reduce)").matches;
  root.addEventListener("pointerdown", (e) => {
    const el = e.target.closest(hitSel);
    if (!el || el.disabled) return;
    if (canBuzz()) try { navigator.vibrate(10); } catch (_) {}
    el.classList.remove("wb-hit"); void el.offsetWidth; el.classList.add("wb-hit");
    try { ping("chip", 0.5); } catch (_) {}
  });
  root.addEventListener("input", (e) => {
    const el = e.target;
    if (!el || el.type !== "range") return;
    const snap = detentStep(+el.value, +el.min || 0, +el.max || 100, DETENTS);
    if (el.__wbDetent === snap) return;
    el.__wbDetent = snap;
    if (canBuzz()) try { navigator.vibrate(6); } catch (_) {}
    el.classList.remove("wb-tick"); void el.offsetWidth; el.classList.add("wb-tick");
    try { ping("slider", (+el.value - (+el.min || 0)) / (((+el.max || 100) - (+el.min || 0)) || 1)); } catch (_) {}
  });
}
