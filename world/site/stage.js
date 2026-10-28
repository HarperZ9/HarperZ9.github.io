// stage.js: the page's one shared 2D renderer. Every drawn layer of the home (the strata, the road, each stop's
// sheets, the carried element, the places' crossings and uncovering stills, the theme's waveform) used to own a canvas;
// 140 of them were alive at once. Now each layer draws into its own offscreen surface or straight onto this one
// fixed canvas, and the stage composites them in z order on one clock.
//
//   import { stage } from "/world/site/stage.js";
//   stage.add({ name, z, draw(ctx, view), live?() })   // view: { w, h, px, cw, ch, dark }
//   stage.invalidate()                                  // something changed; composite on the next frame
//   stage.flush()                                       // composite now (the road's walk, at the end of its tick)
//
// The stage composites only when a layer asked (invalidate) or reports itself live. It stops when the tab is hidden,
// under reduced motion it composites once per change, and in Plain view it hides. Layers are told the device ratio
// (capped at 2) so their own surfaces stay sharp without paying for a 3x backing store on phones.
const root = document.documentElement;
const layers = [];
let canvas = null, ctx = null, raf = 0, dirty = true, frames = 0;

const px = () => Math.min(devicePixelRatio || 1, 2);
export const isDark = () => root.dataset.theme === "dark" || (!root.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
export const isStill = () => matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("plain");

function mount() {
  canvas = document.getElementById("stage");
  if (!canvas) { canvas = document.createElement("canvas"); canvas.id = "stage"; canvas.setAttribute("aria-hidden", "true"); document.body.prepend(canvas); }
  ctx = canvas.getContext("2d", { alpha: true, desynchronized: false });
}

function resize() {
  const p = px(), w = Math.round(innerWidth * p), h = Math.round(innerHeight * p);
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  return { w, h, px: p, cw: innerWidth, ch: innerHeight, dark: isDark(), still: isStill() };
}

function composite() {
  const view = resize();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1; ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, view.w, view.h);
  for (const L of layers) {
    if (L.hidden) continue;
    ctx.save();
    try { L.draw(ctx, view); } catch (e) { console.error(`stage: layer ${L.name} failed and was hidden`, e); L.hidden = true; }
    ctx.restore();
  }
  frames++;
}

function frame() {
  raf = 0;
  if (document.hidden || !canvas) return;
  const live = layers.some((L) => !L.hidden && L.live?.());
  if (dirty || live) { dirty = false; composite(); }
  if (live && !isStill()) raf = requestAnimationFrame(frame);
}

function wake() { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); }

export const stage = {
  get canvas() { return canvas; },
  get frames() { return frames; },
  add(layer) {
    if (!canvas) mount();
    layers.push(layer); layers.sort((a, b) => a.z - b.z); dirty = true; wake();
    return () => { const i = layers.indexOf(layer); if (i >= 0) layers.splice(i, 1); dirty = true; wake(); };
  },
  invalidate() { dirty = true; wake(); },
  // the owner of a clock (the road's walk) composites at the end of its own tick, so the stage is never a frame late
  flush() { if (!canvas || document.hidden) return; dirty = false; composite(); },
  px,
};

addEventListener("resize", () => stage.invalidate(), { passive: true });
addEventListener("scroll", () => stage.invalidate(), { passive: true });
document.addEventListener("visibilitychange", () => { if (!document.hidden) stage.invalidate(); });
new MutationObserver(() => stage.invalidate()).observe(root, { attributes: true, attributeFilter: ["data-theme", "class", "data-world"] });
window.SiteStage = stage;
