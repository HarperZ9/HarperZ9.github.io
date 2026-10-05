// studio-worlds.js: the Worlds source. The One Step worlds as small 3D dioramas, raymarched by
// raw-native's web GPU host (media/raw-native/web-*/, vendored and pinned). Each frame is copied
// onto the Studio's 2D stage in the same task, so perception and export read it like any source.
// Camera: wheel-click drag to orbit, wheel to zoom, shift or right drag to pan, WASD and Q E to fly,
// double-click to focus, R to reset; touch orbit, pinch and pan. Idle for a while and it tours.
const RAW = "../media/raw-native/web-f2cd6e9/";
const TOUR_AFTER_MS = 6000;

let host = null, worlds = null, ctl = null, gpuCanvas = null, loading = null, mod = null;
let raf = 0, last = 0, stage = null, ctx2d = null, inputEl = null, still = false, readoutAt = 0, onFrame = null;

const reducedMotion = () => typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function boot(world) {
  const [gpu, wm, cm, wgsl] = await Promise.all([
    import(RAW + "raw-gpu.mjs"), import(RAW + "worlds.mjs"), import(RAW + "camera.mjs"),
    fetch(new URL(RAW + "worlds.wgsl", import.meta.url)).then((r) => {
      if (!r.ok) throw new Error("worlds.wgsl: HTTP " + r.status);
      return r.text();
    }),
  ]);
  gpuCanvas = document.createElement("canvas");
  host = await gpu.createHost({ canvas: gpuCanvas });
  worlds = await wm.createWorlds(host, { wgsl, world });
  const q = document.getElementById("worlds-quality");
  if (q) worlds.set({ quality: +q.value });
  mod = { worlds: wm, camera: cm };
}

function blit() {
  if (!ctx2d) ctx2d = stage.getContext("2d");
  ctx2d.imageSmoothingQuality = "high";
  ctx2d.drawImage(gpuCanvas, 0, 0, stage.width, stage.height);
}

function readout() {
  const el = document.getElementById("worlds-readout");
  if (!el || !worlds) return;
  const t = host.timings();
  const [w, h] = worlds.renderSize();
  el.textContent = (t && t.total ? `${t.total.toFixed(2)} ms of GPU time per frame` : "GPU time unavailable in this browser")
    + `, rendered at ${w} x ${h}`;
}

function draw(dt) {
  worlds.resize(stage.width, stage.height);
  if (ctl) ctl.keys(dt);
  const tour = !still && worlds.opts.tour && ctl && ctl.idle() > TOUR_AFTER_MS;
  worlds.frame(still ? 0 : dt, { tour });
  blit();
}

function loop(now) {
  raf = 0;
  if (!worlds || !stage) return;
  const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
  last = now;
  draw(dt);
  if (now - readoutAt > 1000) { readoutAt = now; readout(); }
  if (onFrame) onFrame();
  raf = requestAnimationFrame(loop);
}

// Without WebGPU, the stage shows the film that holds this world instead (studio-films.js).
let fallback = null;
async function noGpu(why) {
  const el = document.getElementById("worlds-readout");
  if (el) el.textContent = "This browser has no WebGPU, so here is the world on film. " + why;
  const films = await import("./studio-films.js?v=20261004-films");
  const host = inputEl;
  if (!host || !stage) return;
  if (getComputedStyle(host).position === "static") host.style.position = "relative";
  const show = () => {
    const pick = document.getElementById("worlds-world");
    const f = films.filmForWorld(pick ? pick.value : "eye");
    if (fallback && fallback.dataset.film === f.id) return;
    if (fallback) fallback.remove();
    fallback = document.createElement("div");
    fallback.className = "sf-fallback"; fallback.dataset.film = f.id;
    fallback.append(films.filmPlayer(f));
    host.append(fallback);
  };
  show();
  const pick = document.getElementById("worlds-world");
  if (pick && !pick.dataset.filmWired) { pick.dataset.filmWired = "1"; pick.addEventListener("change", () => { if (fallback) show(); }); }
}

/** Enter the source. input: the element that takes the camera's mouse, touch and keys. */
export async function enterWorlds(canvas, input, o = {}) {
  stage = canvas; ctx2d = null; inputEl = input; onFrame = o.onFrame || null;
  const pick = document.getElementById("worlds-world");
  try {
    loading = loading || boot(pick ? pick.value : "eye");
    await loading;
  } catch (e) {
    loading = null;
    await noGpu(e && e.message ? e.message : String(e));
    if (o.say) o.say("model", "Worlds needs WebGPU: " + (e && e.message ? e.message : String(e)));
    return false;
  }
  if (stage !== canvas) return false;
  if (ctl) ctl.detach();
  ctl = mod.camera.bindControls(inputEl, worlds.cam, { onPick: (x, y) => worlds.focusAt(x, y) });
  still = reducedMotion();
  last = 0;
  if (!raf) raf = requestAnimationFrame(loop);
  return true;
}

export function leaveWorlds() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  if (ctl) { ctl.detach(); ctl = null; }
  if (fallback) { fallback.remove(); fallback = null; }
  stage = null; ctx2d = null;
}

/** Worlds always redraws (the camera can move); under reduced motion the scene itself holds still. */
export function worldsStatic() { return !worlds; }

/** world, quality, light, fog, motion, tour, playing. */
export function setWorlds(values) {
  if (!worlds) return Promise.resolve(null);
  return worlds.set(values).then(() => worlds.opts);
}
export function resetWorldsView() { if (worlds) worlds.cam.reset(); }
export function worldsOptions() { return worlds ? { ...worlds.opts } : null; }
export function worldsList() { return mod ? mod.worlds.WORLDS : []; }
