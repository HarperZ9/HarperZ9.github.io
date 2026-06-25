// system/engine/render-worker.js
// Stage 1 of the Telos scalable engine: the OffscreenCanvas render/sim worker.
// Zero external dependencies. ES module worker (loaded with { type: "module" }). ASCII only.
//
// This worker owns the drawing surface transferred from the main thread via
// canvas.transferControlToOffscreen(), picks the GPU particle backend it can run IN A WORKER
// (WebGPU via WorkerNavigator.gpu, else WebGL2 in the worker, else it reports back so the main thread
// runs the CPU path), and runs the particle sim + render loop off the main thread.
//
// Workers have no requestAnimationFrame and no DOM, so the contract (SPEC A.2) is:
//   main -> worker  { type: "resize", w, h, dpr }
//   main -> worker  { type: "frame", t, forces, params }   one per main-thread rAF (vsync-aligned)
//   main -> worker  { type: "setCount", count }
//   main -> worker  { type: "dispose" }
//   worker -> main  { type: "ready", backend }             after init picks a backend
//   worker -> main  { type: "telemetry", frameMs, count, perceive }   after each frame
//   worker -> main  { type: "fallback", reason }           could not run a worker GPU path
//
// Transport: plain postMessage; Transferable ArrayBuffers when state must cross (not used in the
// steady GPU loop, where state stays GPU-resident; reserved for the SAB-absent CPU-in-worker path).
// SharedArrayBuffer is NOT used (GitHub Pages cannot set COOP/COEP); it would only be a detected
// enhancement when self.crossOriginIsolated === true, which this worker reports but does not require.

let backend = null;
let canvas = null;
let width = 1, height = 1;
let running = false;

// Dynamic-imported backend factories (kept lazy so the worker only pulls the rung it will run).
async function pickBackend(initCfg) {
  // Try WebGPU in the worker first (WorkerNavigator.gpu). requestAdapter resolves null when absent.
  try {
    if (typeof navigator !== "undefined" && navigator.gpu && initCfg.allowWebGPU !== false) {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const device = await adapter.requestDevice();
        const mod = await import("./sim/particles-webgpu.js");
        const b = mod.createWebGPUParticles();
        const ctx = canvas.getContext("webgpu");
        await b.init({ device, context: ctx, width, height, count: initCfg.count });
        return b;
      }
    }
  } catch (_) { /* fall through to WebGL2 */ }

  // WebGL2 in the worker (OffscreenCanvas webgl2 context is Baseline).
  try {
    const gl = canvas.getContext("webgl2");
    if (gl) {
      const mod = await import("./sim/particles-webgl2.js");
      const b = mod.createWebGL2Particles();
      await b.init({ gl, width, height, count: initCfg.count });
      return b;
    }
  } catch (_) { /* fall through */ }

  return null;   // worker could not run a GPU path; main thread should take the CPU path
}

self.onmessage = async (e) => {
  const msg = e.data || {};
  switch (msg.type) {
    case "init": {
      canvas = msg.canvas;          // the transferred OffscreenCanvas
      width = Math.max(1, msg.w || 1);
      height = Math.max(1, msg.h || 1);
      if (canvas) { canvas.width = width; canvas.height = height; }
      backend = await pickBackend(msg);
      if (!backend) { self.postMessage({ type: "fallback", reason: "no-worker-gpu" }); return; }
      running = true;
      self.postMessage({ type: "ready", backend: backend.name });
      break;
    }
    case "resize": {
      width = Math.max(1, msg.w || width);
      height = Math.max(1, msg.h || height);
      if (canvas) { canvas.width = width; canvas.height = height; }
      if (backend) backend.resize(width, height);
      break;
    }
    case "setCount": {
      if (backend) backend.setCount(msg.count | 0);
      break;
    }
    case "frame": {
      if (!running || !backend) return;
      const t0 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      try {
        backend.step(msg.dt || 0.016, msg.forces || {});
        backend.render(null, width, height, msg.params || {});
      } catch (err) {
        self.postMessage({ type: "fallback", reason: "worker-step-threw:" + (err && err.message) });
        running = false;
        return;
      }
      const t1 = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      // Transfer the terminal frame back to the main thread as an ImageBitmap (transferable; the only
      // thing besides the perception read that crosses back, per SPEC A.2). The main thread draws it
      // onto #studio-canvas so the perception loop keeps reading one canvas. transferToImageBitmap is
      // valid for an OffscreenCanvas backed by any context type (2d/webgl/webgl2/webgpu).
      let bitmap = null;
      try { if (canvas && canvas.transferToImageBitmap) bitmap = canvas.transferToImageBitmap(); } catch (_) { bitmap = null; }
      const payload = {
        type: "telemetry",
        frameMs: t1 - t0,
        count: backend.getCount ? backend.getCount() : 0,
        perceive: backend.perceive ? backend.perceive() : null,
        bitmap,
      };
      if (bitmap) self.postMessage(payload, [bitmap]);
      else self.postMessage(payload);
      break;
    }
    case "dispose": {
      running = false;
      if (backend) { try { backend.dispose(); } catch (_) {} }
      backend = null; canvas = null;
      self.postMessage({ type: "disposed" });
      break;
    }
    default:
      break;
  }
};
