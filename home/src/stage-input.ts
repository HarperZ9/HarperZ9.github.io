// How the form answers people: drag to turn it, click a body to open it,
// click empty space for a ripple, move fast and the scan tears, hold and it
// comes apart, scroll and the rings spin. Click the core five times, or type
// "eclipse", for the hidden mode.
import { wrap, type FormRenderer, type FormState } from "./form-shared";

export type InputHooks = {
  size(): number;
  setRot(rot: number): void;
  pick(i: number): void;
  hold(on: boolean): void;
  secret(): void;
  touched(kind: "move" | "ripple" | "hold" | "drag"): void;
  calm(): boolean;
};

export function bindInput(canvas: HTMLCanvasElement, s: FormState, renderer: FormRenderer, h: InputHooks) {
  let drag: { x: number; y: number; a: number; rot: number; moved: boolean } | null = null;
  let last = { x: 0, y: 0, t: 0 };
  let pressTimer = 0, holding = false, coreClicks = 0, coreAt = 0;

  const local = (e: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    const k = h.size() / box.width;
    return { x: (e.clientX - box.left) * k, y: (e.clientY - box.top) * k };
  };
  const nearest = () => {
    let best = 0, bestD = Infinity;
    for (let i = 0; i < s.n; i++) {
      const d = Math.abs(wrap(renderer.targetRot(i, s) - s.rot));
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  };

  canvas.addEventListener("pointermove", (e) => {
    const { x, y } = local(e);
    const size = h.size();
    s.px = (x / size) * 2 - 1; s.py = (y / size) * 2 - 1;
    const now = performance.now();
    if (last.t && !h.calm()) {
      const speed = Math.hypot(e.clientX - last.x, e.clientY - last.y) / Math.max(8, now - last.t);
      s.energy = Math.max(s.energy, Math.min(1, (speed - 0.4) / 1.8));
    }
    last = { x: e.clientX, y: e.clientY, t: now };
    if (drag) {
      if (Math.hypot(x - drag.x, y - drag.y) > size * 0.015) { drag.moved = true; window.clearTimeout(pressTimer); }
      if (drag.moved && !holding) h.setRot(drag.rot + wrap(Math.atan2(y - size / 2, x - size / 2) - drag.a));
    } else {
      s.preview = renderer.pick(x, y, size, s);
    }
    h.touched("move");
  });

  canvas.addEventListener("pointerleave", () => { s.px = 0; s.py = 0; if (!drag) s.preview = null; });

  canvas.addEventListener("pointerdown", (e) => {
    const { x, y } = local(e);
    const size = h.size();
    drag = { x, y, a: Math.atan2(y - size / 2, x - size / 2), rot: s.rot, moved: false };
    canvas.setPointerCapture(e.pointerId);
    window.clearTimeout(pressTimer);
    pressTimer = window.setTimeout(() => { holding = true; h.hold(true); h.touched("hold"); }, 550);
  });

  const release = (e: PointerEvent) => {
    window.clearTimeout(pressTimer);
    if (!drag) return;
    const d = drag;
    drag = null;
    if (holding) { holding = false; h.hold(false); return; }
    if (d.moved) { h.pick(nearest()); h.touched("drag"); return; }
    const { x, y } = local(e);
    const size = h.size();
    if (Math.hypot(x - size / 2, y - size / 2) < size * 0.07) {
      const now = performance.now();
      coreClicks = now - coreAt < 900 ? coreClicks + 1 : 1;
      coreAt = now;
      if (coreClicks >= 5) { coreClicks = 0; h.secret(); }
    }
    const hit = renderer.pick(x, y, size, s);
    if (hit !== null) h.pick(hit);
    else if (!h.calm()) { s.shocks.push({ x, y, t: s.t }); h.touched("ripple"); }
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", () => { window.clearTimeout(pressTimer); drag = null; if (holding) { holding = false; h.hold(false); } });
  canvas.addEventListener("contextmenu", (e) => { if (holding) e.preventDefault(); });

  let typed = "";
  document.addEventListener("keydown", (e) => {
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, [contenteditable]")) return;
    typed = (typed + e.key.toLowerCase()).slice(-7);
    if (typed === "eclipse") { typed = ""; h.secret(); }
  });

  let lastY = window.scrollY;
  window.addEventListener("scroll", () => {
    const dy = window.scrollY - lastY;
    lastY = window.scrollY;
    if (!h.calm()) s.spin += Math.max(-0.6, Math.min(0.6, dy * 0.004));
  }, { passive: true });
}
