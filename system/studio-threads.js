// studio-threads.js: the Threads source. Particles trace one of fifteen form fields and
// leave light, rendered by raw-native's web GPU host (media/raw-native/web-*/, vendored and
// pinned). The host draws on its own WebGPU canvas; each frame is copied onto the Studio's
// 2D canvas in the same task, so perception, PNG and video export read it like any source.
// Without WebGPU the source says so on the stage and draws nothing else.
const RAW = "../media/raw-native/web-6f5d142/";
const MOTION_STILL_FRAMES = 150;

let host = null, threads = null, gpuCanvas = null, loading = null;
let raf = 0, last = 0, stage = null, ctx2d = null, opts = null, still = false, readoutAt = 0;

const reducedMotion = () => typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

async function boot() {
  const [gpu, mod, wgsl] = await Promise.all([
    import(RAW + "raw-gpu.mjs"), import(RAW + "threads.mjs"),
    fetch(new URL(RAW + "threads.wgsl", import.meta.url)).then((r) => {
      if (!r.ok) throw new Error("threads.wgsl: HTTP " + r.status);
      return r.text();
    }),
  ]);
  gpuCanvas = document.createElement("canvas");
  host = await gpu.createHost({ canvas: gpuCanvas });
  threads = await mod.createThreads(host, { wgsl });
  // A software adapter (SwiftShader and the like) runs the passes on the CPU: start small.
  const info = host.adapter.info || {};
  if (info.isFallbackAdapter || /swiftshader|llvmpipe|basic render/i.test(`${info.vendor} ${info.architecture} ${info.description}`)) {
    threads.set({ particles: 16384 });
    const sel = document.getElementById("threads-particles");
    if (sel) { const o = new Option("16,384", "16384", true, true); sel.prepend(o); }
  }
  return mod;
}

function fit() {
  const w = stage.width, h = stage.height;
  threads.resize(w, h);
}

function blit() {
  if (!ctx2d) ctx2d = stage.getContext("2d");
  ctx2d.drawImage(gpuCanvas, 0, 0, stage.width, stage.height);
}

function readout() {
  const el = document.getElementById("threads-readout");
  if (!el || !threads) return;
  const t = host.timings();
  const s = threads.state();
  const gpu = t && t.total ? `${t.total.toFixed(2)} ms of GPU time per frame` : "GPU time unavailable in this browser";
  el.textContent = `${gpu}, ${s.width} x ${s.height}, ${s.particles.toLocaleString("en-US")} particles`;
}

function loop(now) {
  raf = 0;
  if (!threads || !stage) return;
  if (stage.width !== threads.w || stage.height !== threads.h) fit();
  const dt = last ? (now - last) / 1000 : 1 / 60;
  last = now;
  threads.frame(dt);
  blit();
  if (now - readoutAt > 1000) { readoutAt = now; readout(); }
  if (opts && opts.onFrame) opts.onFrame();
  if (!still && threads.opts.playing) raf = requestAnimationFrame(loop);
}

// Reduced motion: run the field forward, then hold that one frame.
function holdStill() {
  for (let i = 0; i < MOTION_STILL_FRAMES; i++) threads.frame(1 / 30);
  blit();
  readout();
}

function noGpu(why) {
  const c = stage.getContext("2d");
  c.fillStyle = "#0b0b0c"; c.fillRect(0, 0, stage.width, stage.height);
  c.fillStyle = "#cfc8bb";
  c.font = `${Math.max(12, Math.round(stage.width / 48))}px "Hanken Grotesk", system-ui, sans-serif`;
  c.textAlign = "center";
  c.fillText("Threads needs WebGPU, which this browser does not offer.", stage.width / 2, stage.height / 2);
  const el = document.getElementById("threads-readout");
  if (el) el.textContent = why;
}

/** Enter the source: boot the host on first entry, then start the frame loop. */
export async function enterThreads(canvas, o = {}) {
  stage = canvas; ctx2d = null; opts = o;
  try {
    loading = loading || boot();
    await loading;
  } catch (e) {
    loading = null;
    noGpu(e && e.message ? e.message : String(e));
    if (o.say) o.say("model", "Threads needs WebGPU: " + (e && e.message ? e.message : String(e)));
    return false;
  }
  if (stage !== canvas) return false;   // left while loading
  fit();
  if (!threads.started) { threads.restart(); threads.started = true; }
  still = reducedMotion();
  last = 0;
  if (still) holdStill();
  else if (!raf) raf = requestAnimationFrame(loop);
  return true;
}

export function leaveThreads() {
  if (raf) cancelAnimationFrame(raf);
  raf = 0; stage = null; ctx2d = null;
}

/** True while the source holds one frame (reduced motion, or paused). */
export function threadsStatic() { return still || !threads || !threads.opts.playing; }

/** Apply control values: world, tour, particles, persistence, exposure, spacing, levels, playing. */
export function setThreads(values) {
  if (!threads) return null;
  const o = threads.set(values);
  if (stage && !still && o.playing && !raf) { last = 0; raf = requestAnimationFrame(loop); }
  if (stage && still) holdStill();
  return o;
}

export function restartThreads() {
  if (!threads) return;
  threads.restart();
  if (stage && still) holdStill();
}

export function threadsOptions() { return threads ? { ...threads.opts } : null; }
