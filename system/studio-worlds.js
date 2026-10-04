// studio-worlds.js: the Worlds source. The One Step worlds as small 3D dioramas, raymarched by
// raw-native's web GPU host (media/raw-native/web-*/, vendored and pinned). Each frame is copied
// onto the Studio's 2D stage in the same task, so perception and export read it like any source.
// Camera: wheel-click drag to orbit, wheel to zoom, shift or right drag to pan, WASD and Q E to fly,
// double-click to focus, R to reset; touch orbit, pinch and pan. Idle for a while and it tours.
const RAW = "../media/raw-native/web-05a6cdd/";
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

function noGpu(why) {
  const c = stage.getContext("2d");
  c.fillStyle = "#0b0b0c"; c.fillRect(0, 0, stage.width, stage.height);
  c.fillStyle = "#cfc8bb";
  c.font = `${Math.max(12, Math.round(stage.width / 48))}px "Hanken Grotesk", system-ui, sans-serif`;
  c.textAlign = "center";
  c.fillText("Worlds needs WebGPU, which this browser does not offer.", stage.width / 2, stage.height / 2);
  const el = document.getElementById("worlds-readout");
  if (el) el.textContent = why;
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
    noGpu(e && e.message ? e.message : String(e));
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
