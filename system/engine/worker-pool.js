// system/engine/worker-pool.js
// Stage 1 of the Telos scalable engine: the worker pool + OffscreenCanvas wiring.
// Zero external dependencies. ES module. ASCII only (no em-dashes).
//
// Owns the render/sim worker that runs the particle backend off the main thread. The surface is
// transferred via canvas.transferControlToOffscreen() (the element becomes inert on the main thread).
// Communication is plain postMessage; Transferable ArrayBuffers carry state only on the CPU-in-worker
// path (the steady GPU loop keeps state GPU-resident). SharedArrayBuffer is NOT used by default
// (GitHub Pages cannot set COOP/COEP); it is a detected enhancement only when crossOriginIsolated.
//
// Graceful fallback is mandatory: if OffscreenCanvas or Worker is unavailable, or the worker reports
// it cannot run a GPU path, spawnRenderWorker() resolves with { ok:false, reason } and the caller
// (gpu-particles.js) runs the main-thread path instead. Nothing here is load-bearing for the engine
// to RUN; it only moves work off the main thread when the platform allows.
//
// API:
//   canOffscreen(cap)         -> boolean   (OffscreenCanvas + transferControlToOffscreen + Worker)
//   workerPoolSize(cap)       -> int 1..4  (min(cores-1, 4); hardwareConcurrency sizes the pool ONLY)
//   spawnRenderWorker(opts)   -> Promise<{ ok, reason?, handle? }>
//     opts: { canvas, workerUrl, width, height, count, allowWebGPU, onTelemetry }
//     handle: { worker, frame(dt,forces,params), resize(w,h,dpr), setCount(n), dispose(), backend }

// Re-export the pure sizing helper so callers have one import surface (it also lives in capability.js
// for the node tests; this is a thin convenience alias, not a second implementation).
export { workerPoolSize } from "./capability.js";

// canOffscreen(cap): can we move rendering to a worker on this platform?
export function canOffscreen(cap) {
  const c = cap || {};
  // Prefer the probed capability record; fall back to a live feature check for callers that pass none.
  const hasWorker = (c.workers !== undefined) ? !!c.workers : (typeof Worker !== "undefined");
  const hasOffscreen = (c.offscreenCanvas !== undefined)
    ? !!c.offscreenCanvas
    : (typeof OffscreenCanvas !== "undefined" &&
       typeof HTMLCanvasElement !== "undefined" &&
       typeof HTMLCanvasElement.prototype.transferControlToOffscreen === "function");
  return hasWorker && hasOffscreen;
}

// spawnRenderWorker: transfer the canvas to a fresh module worker and drive it. Resolves only after
// the worker reports "ready" (a backend was picked) or "fallback" (run on the main thread instead).
export function spawnRenderWorker(opts) {
  const o = opts || {};
  return new Promise((resolve) => {
    if (!canOffscreen()) { resolve({ ok: false, reason: "no-offscreen" }); return; }
    if (!o.canvas || typeof o.canvas.transferControlToOffscreen !== "function") {
      resolve({ ok: false, reason: "no-canvas" }); return;
    }

    let worker;
    try {
      worker = new Worker(o.workerUrl, { type: "module" });
    } catch (err) {
      resolve({ ok: false, reason: "worker-ctor:" + (err && err.message) });
      return;
    }

    let settled = false;
    let offscreen;
    try {
      offscreen = o.canvas.transferControlToOffscreen();
    } catch (err) {
      try { worker.terminate(); } catch (_) {}
      resolve({ ok: false, reason: "transfer-failed:" + (err && err.message) });
      return;
    }

    worker.onmessage = (e) => {
      const m = e.data || {};
      if (m.type === "ready" && !settled) {
        settled = true;
        resolve({ ok: true, handle: makeHandle(worker, m.backend) });
      } else if (m.type === "fallback" && !settled) {
        settled = true;
        try { worker.terminate(); } catch (_) {}
        resolve({ ok: false, reason: m.reason || "worker-fallback" });
      } else if (m.type === "telemetry") {
        if (typeof o.onTelemetry === "function") {
          try { o.onTelemetry(m); } catch (_) {}
        }
      }
    };
    worker.onerror = (err) => {
      if (!settled) {
        settled = true;
        try { worker.terminate(); } catch (_) {}
        resolve({ ok: false, reason: "worker-error:" + (err && err.message) });
      }
    };

    // Kick off init, transferring the OffscreenCanvas (zero-copy ownership move).
    worker.postMessage({
      type: "init",
      canvas: offscreen,
      w: Math.max(1, o.width || 1),
      h: Math.max(1, o.height || 1),
      count: o.count | 0,
      allowWebGPU: o.allowWebGPU !== false,
    }, [offscreen]);

    // Safety net: if the worker never answers (e.g. import error swallowed), fall back after a beat.
    setTimeout(() => {
      if (!settled) {
        settled = true;
        try { worker.terminate(); } catch (_) {}
        resolve({ ok: false, reason: "worker-timeout" });
      }
    }, 4000);
  });
}

function makeHandle(worker, backend) {
  let disposed = false;
  return {
    worker,
    backend,
    frame(dt, forces, params) {
      if (disposed) return;
      worker.postMessage({ type: "frame", dt, forces, params });
    },
    resize(w, h, dpr) {
      if (disposed) return;
      worker.postMessage({ type: "resize", w, h, dpr });
    },
    setCount(n) {
      if (disposed) return;
      worker.postMessage({ type: "setCount", count: n | 0 });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      try { worker.postMessage({ type: "dispose" }); } catch (_) {}
      // Give the worker a moment to release GPU resources, then terminate.
      setTimeout(() => { try { worker.terminate(); } catch (_) {} }, 50);
    },
  };
}

export default { canOffscreen, spawnRenderWorker };
