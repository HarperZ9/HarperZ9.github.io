// The live form: sizing, the animation loop and the behaviours that run on
// their own (idle dreaming, the hold, the eclipse). Input lives in
// stage-input.ts, shared effects in effects.ts, rendering in the form-* modules.
import { drawShocks, drawWater, eclipse, scanTear } from "./effects";
import { freshState, readPalette, wrap, type FormRenderer } from "./form-shared";
import { bindInput } from "./stage-input";

export type Stage = {
  select(i: number): void;
  preview(i: number | null): void;
  setWater(on: boolean): void;
};

export type StageEvents = {
  mood?(m: { dream: boolean; hold: boolean }): void;
  pick(i: number): void;
  secret(on: boolean): void;
  touched(kind: string): void;
};

const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
const wide = window.matchMedia("(min-width: 64rem)");
const IDLE_AFTER = 7;

export function mountStage(canvas: HTMLCanvasElement, renderer: FormRenderer, n: number, ev: StageEvents): Stage {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("front door: no 2D canvas context");
  const s = freshState(n);
  const goal = { rot: 0, water: 0, split: 0, eclipse: 0 };
  let size = 0, palette = readPalette(), quiet = 0;
  const mood = { dream: false, hold: false };
  let visible = true, frame = 0, last = 0, odd = false;

  const layout = () => {
    s.pointAngle = wide.matches ? 0 : Math.PI / 2;
    goal.rot = renderer.targetRot(s.sel, s);
  };
  const resize = () => {
    const box = canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    size = Math.max(1, Math.round(box.width * dpr));
    canvas.width = size; canvas.height = size;
    layout();
    kick();
  };

  const advance = (dt: number) => {
    const still = reduce.matches;
    s.calm = still;
    const ease = (rate: number) => (still ? 1 : 1 - Math.exp(-dt * rate));
    if (!still) s.t += dt;
    quiet += dt;
    s.idle = still ? 0 : Math.max(0, Math.min(1, (quiet - IDLE_AFTER) / 4));
    s.energy = still ? 0 : s.energy * Math.exp(-dt * 2.5);
    s.spin *= Math.exp(-dt * 0.8);
    s.rot += wrap(goal.rot - s.rot) * ease(4);
    s.water += (goal.water - s.water) * ease(2.5);
    s.split += (goal.split - s.split) * ease(goal.split > s.split ? 3 : 5);
    s.eclipse += (goal.eclipse - s.eclipse) * ease(3);
    const dream = s.idle > 0.4, hold = s.split > 0.3;
    if (dream !== mood.dream || hold !== mood.hold) { mood.dream = dream; mood.hold = hold; ev.mood?.(mood); }
  };
  const settled = () => Math.abs(wrap(goal.rot - s.rot)) < 1e-3 && Math.abs(goal.water - s.water) < 1e-3
    && Math.abs(goal.split - s.split) < 1e-3 && Math.abs(goal.eclipse - s.eclipse) < 1e-3;

  const step = (now: number) => {
    frame = 0;
    const running = visible && !document.hidden;
    // At rest the ambient drift draws every other frame to save the battery.
    if (running && !reduce.matches && quiet > 2 && settled() && s.energy < 0.01 && (odd = !odd)) {
      frame = requestAnimationFrame(step);
      return;
    }
    const dt = Math.min(0.06, last ? (now - last) / 1000 : 0.016);
    last = now;
    advance(dt);
    renderer.draw(ctx, size, s, palette);
    drawWater(ctx, size, s, palette);
    drawShocks(ctx, size, s, palette);
    scanTear(ctx, size, s);
    eclipse(ctx, size, s, palette, (inv) => renderer.draw(ctx, size, s, inv));
    if (running && (!reduce.matches || !settled())) frame = requestAnimationFrame(step);
    else last = 0;
  };
  function kick() { if (!frame) frame = requestAnimationFrame(step); }

  bindInput(canvas, s, renderer, {
    size: () => size,
    setRot: (rot) => { goal.rot = rot; s.rot = rot; kick(); },
    pick: (i) => ev.pick(i),
    hold: (on) => { goal.split = on && !reduce.matches ? 1 : 0; kick(); },
    secret: () => { goal.eclipse = goal.eclipse ? 0 : 1; ev.secret(goal.eclipse === 1); kick(); },
    touched: (kind) => { quiet = 0; ev.touched(kind); kick(); },
    calm: () => reduce.matches,
  });

  new ResizeObserver(resize).observe(canvas);
  wide.addEventListener("change", () => { layout(); kick(); });
  reduce.addEventListener("change", kick);
  new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); if (visible) kick(); }).observe(canvas);
  document.addEventListener("visibilitychange", kick);
  const repaint = () => { palette = readPalette(); kick(); };
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", repaint);
  new MutationObserver(repaint).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });

  return {
    select(i) { s.sel = i; s.selAt = s.t; quiet = 0; goal.rot = renderer.targetRot(i, s); kick(); },
    preview(i) { s.preview = i; kick(); },
    setWater(on) { goal.water = on ? 1 : 0; kick(); },
  };
}
