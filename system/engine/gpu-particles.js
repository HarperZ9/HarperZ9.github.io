// system/engine/gpu-particles.js
// Stage 1 of the Telos scalable engine: the gpu-particles (top) operator coordinator.
// Zero external dependencies. ES module. ASCII only (no em-dashes).
//
// This is the single entry point the music "particles" mode calls. It:
//   1. Holds the capability probe + tier + frame-time governor.
//   2. Selects the particle backend rung (WebGPU / WebGL2 / CPU) via the backend-selection ladder.
//   3. Runs the sim+render off the main thread (OffscreenCanvas + worker) when the platform allows,
//      else on the main thread; the CPU rung is the GUARANTEED floor (today's behavior, exactly).
//   4. Holds the frame budget by letting the governor rescale the particle count.
//   5. Composites the GPU rungs onto the existing #studio-canvas via drawImage so the perception
//      loop (which reads #studio-canvas) keeps working unchanged, and the 2D context binding of
//      #studio-canvas is never disturbed (a canvas binds permanently to its first context type).
//
// GRACEFUL DEGRADATION (mandatory): on a no-WebGPU, no-WebGL2, no-worker, no-OffscreenCanvas browser,
// this falls all the way down to the CPU backend drawing straight to #studio-canvas's 2D context,
// which is byte-for-byte the shipped reactive-visuals.js drawParticles behavior. No GPU/worker
// feature is load-bearing; they only raise scale and move work off the main thread.
//
// The audio features feed FORCES/SPAWNS here (reactive.js analysis is unchanged): drawFrame() takes
// the same features + params reactive-visuals.js already computes and maps them to the backend's
// force descriptor, so the audio-analyser (chop) -> gpu-particles (top) wiring is real but additive.

import {
  deriveTier, selectBackend, pickTier, TIER_BUDGETS,
} from "./capability.js";
import { makeGovernor, scaleCount } from "./governor.js";
import { canOffscreen, spawnRenderWorker } from "./worker-pool.js";
import { createCpuParticles } from "./sim/particles-cpu.js";

// The worker module URL, resolved relative to this module so it works under any static base path.
const WORKER_URL = new URL("./render-worker.js", import.meta.url);

// Map reactive.js features + applyMapping params to the backend force descriptor. This is the
// audio-analyser -> gpu-particles wire. Identity-mapped to the exact fields drawParticles reads.
function forcesFromAudio(features, params) {
  const f = features || {};
  const p = params || {};
  return {
    bass: f.bass || 0,
    treble: f.treble || 0,
    centroid: f.centroid || 0,
    level: f.level || 0,
    intensity: p.intensity || 0,
    highMod: p.highMod || 0,
    pulse: p.pulse || 0,
    hue: p.hue || 0,
    hueShift: p.hueShift || 0,
  };
}

// Quality levels for the governor, most-impactful-first per the DRS ordering. Index maps to a
// fraction of the tier budget (level 0 = smallest). The governor returns an index; we scale count.
function budgetForTier(tier) { return TIER_BUDGETS[tier] || TIER_BUDGETS.low; }

export function createGpuParticles() {
  let cap = null;
  let tier = "low";
  let backendName = "cpu";
  let mode = "main-cpu";   // "worker" | "main-gpu" | "main-cpu"
  let governor = null;

  let mainBackend = null;       // a backend instance running on the main thread (cpu or main-gpu)
  let workerHandle = null;      // the OffscreenCanvas worker handle
  let gpuCanvas = null;         // dedicated canvas for the main-thread GPU rungs (composited)
  let targetCanvas = null;      // the #studio-canvas we composite onto / draw into
  let lastTelemetryMs = 16;     // most recent worker frame time (for the governor)
  let latestBitmap = null;      // the most recent terminal frame the worker transferred back
  let count = 0;
  let budget = TIER_BUDGETS.low;
  let w = 1, h = 1;
  let lastFrameTs = 0;
  let disposed = false;
  let workerCount = 0;          // count the worker reports back (telemetry)

  // Build the main-thread CPU backend (the guaranteed floor). Always succeeds.
  async function buildMainCpu(initialCount) {
    mainBackend = createCpuParticles();
    await mainBackend.init({ count: initialCount, width: w, height: h });
    backendName = "cpu";
    mode = "main-cpu";
  }

  // Build a main-thread GPU backend (WebGPU or WebGL2) drawing into a dedicated gpuCanvas that we
  // composite onto targetCanvas. Returns true on success, false to let the caller fall to CPU.
  async function buildMainGpu(initialCount, want) {
    try {
      if (!gpuCanvas) gpuCanvas = (typeof document !== "undefined") ? document.createElement("canvas") : null;
      if (!gpuCanvas) return false;
      gpuCanvas.width = w; gpuCanvas.height = h;

      if (want === "webgpu" && cap.webgpu && cap.webgpu.device) {
        const mod = await import("./sim/particles-webgpu.js");
        const b = mod.createWebGPUParticles();
        const ctx = gpuCanvas.getContext("webgpu");
        if (!ctx) return false;
        await b.init({ device: cap.webgpu.device, context: ctx, width: w, height: h, count: initialCount });
        mainBackend = b; backendName = "webgpu"; mode = "main-gpu";
        return true;
      }
      if (want === "webgl2") {
        const gl = gpuCanvas.getContext("webgl2");
        if (!gl) return false;
        const mod = await import("./sim/particles-webgl2.js");
        const b = mod.createWebGL2Particles();
        await b.init({ gl, width: w, height: h, count: initialCount });
        mainBackend = b; backendName = "webgl2"; mode = "main-gpu";
        return true;
      }
    } catch (_) { /* any failure -> caller falls to CPU */ }
    return false;
  }

  return {
    name: "gpu-particles",

    // initialize the operator. capability is the probed record (or null to probe lazily here is not
    // done; studio.js passes the record). targetCanvasEl is #studio-canvas. override is the tier
    // override string ("auto"/"low"/"mid"/"high"/"max").
    async init(cfg) {
      const c = cfg || {};
      cap = c.capability || null;
      targetCanvas = c.canvas || null;
      w = Math.max(1, (targetCanvas && targetCanvas.width) || c.width || 1);
      h = Math.max(1, (targetCanvas && targetCanvas.height) || c.height || 1);

      tier = pickTier(cap, c.override || "auto");
      budget = budgetForTier(tier);
      const want = selectBackend(cap, tier);

      // Initial count: start near the tier budget but cap so a cold start is not a stall; the
      // governor climbs/drops from here within ~1 second.
      const initialCount = Math.min(budget, Math.max(256, Math.floor(budget * 0.5)));
      count = initialCount;

      // Governor: 5 quality levels mapped to count via scaleCount; ~16.6 ms budget; spec hysteresis.
      governor = makeGovernor(16.6, { alpha: 0.08, upFrames: 60, downFrames: 3, levels: 5 });

      // Decide the run mode. Try the worker (OffscreenCanvas) path only when the platform allows AND
      // the want is a GPU rung (the CPU-in-worker path is reserved for a later transfer-heavy stage;
      // for Stage 1 the CPU rung runs on the main thread, exactly as today).
      const wantsWorker = (want === "webgpu" || want === "webgl2") && canOffscreen(cap) && !!targetCanvas;

      if (wantsWorker) {
        // The worker needs its own surface. We CANNOT transfer #studio-canvas (it is 2D-bound and the
        // perception loop reads it), so the worker renders to a detached OffscreenCanvas we create,
        // and we copy its frames back via createImageBitmap. To keep Stage 1 simple and robust, we
        // give the worker a dedicated <canvas> overlay's control. If that canvas cannot be created or
        // transferred, we fall through to the main-thread GPU/CPU path.
        gpuCanvas = (typeof document !== "undefined") ? document.createElement("canvas") : null;
        if (gpuCanvas) {
          gpuCanvas.width = w; gpuCanvas.height = h;
          const res = await spawnRenderWorker({
            canvas: gpuCanvas,
            workerUrl: WORKER_URL,
            width: w, height: h, count: initialCount,
            allowWebGPU: want === "webgpu",
            onTelemetry: (m) => {
              if (typeof m.frameMs === "number") lastTelemetryMs = m.frameMs;
              if (typeof m.count === "number") workerCount = m.count;
              if (m.bitmap) {
                // Replace the held frame; close the previous bitmap so we do not leak GPU memory.
                try { if (latestBitmap && latestBitmap.close) latestBitmap.close(); } catch (_) {}
                latestBitmap = m.bitmap;
              }
            },
          });
          if (res.ok) {
            workerHandle = res.handle;
            backendName = res.handle.backend;
            mode = "worker";
          } else {
            // Worker spawn failed AFTER transferControlToOffscreen already detached this canvas, so
            // it is now inert. Drop it so the main-thread GPU fallback builds a FRESH surface.
            gpuCanvas = null;
          }
        }
      }

      // No worker path taken: try a main-thread GPU rung, then fall to the CPU floor.
      if (mode !== "worker") {
        let gpuOk = false;
        if (want === "webgpu" || want === "webgl2") {
          gpuOk = await buildMainGpu(initialCount, want);
        }
        if (!gpuOk) await buildMainCpu(initialCount);
      }

      return { tier, backend: backendName, mode };
    },

    // Draw one frame. features/params come straight from reactive.js (analysis unchanged).
    // ctx2d is the #studio-canvas 2D context (for the CPU floor + compositing the GPU rungs).
    drawFrame(features, params, elapsedSec) {
      if (disposed) return;
      const forces = forcesFromAudio(features, params);
      const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
      const dt = lastFrameTs ? Math.max(0, (now - lastFrameTs) / 1000) : 0.016;

      // Governor: feed the measured frame time, get an action, rescale the count.
      let frameMs = lastFrameTs ? (now - lastFrameTs) : 16.6;
      if (mode === "worker") frameMs = lastTelemetryMs;   // worker reports its own cook time
      const { action } = governor.observe(frameMs);
      if (action !== "hold") {
        count = scaleCount(count, action, { min: 256, max: budget, downStep: 0.6, upStep: 1.15 });
        this._applyCount(count);
      }
      lastFrameTs = now;

      if (mode === "worker" && workerHandle) {
        workerHandle.frame(dt, forces, { intensity: forces.intensity, hueShift: forces.hueShift });
        // Composite the worker's latest frame onto #studio-canvas so perception reads it.
        this._composite();
        return;
      }

      if (mode === "main-gpu" && mainBackend) {
        mainBackend.step(dt, forces);
        mainBackend.render(null, w, h, { intensity: forces.intensity, hueShift: forces.hueShift });
        this._composite();
        return;
      }

      // main-cpu: draw straight to #studio-canvas exactly as today (fade trail + beat flash are kept
      // in reactive-visuals.js; here we only step+render the particle bodies, then reactive-visuals
      // applies its overlay). To preserve identical behavior, the CPU path renders to the 2D context.
      if (mainBackend) {
        const ctx = targetCanvas && targetCanvas.getContext && targetCanvas.getContext("2d");
        mainBackend.step(dt, forces);
        if (ctx) mainBackend.render(ctx, w, h, { intensity: forces.intensity, hueShift: forces.hueShift });
      }
    },

    // Composite the GPU rung's terminal frame onto #studio-canvas (2D drawImage; accepts an
    // ImageBitmap or any source canvas regardless of its backing context). Keeps the perception loop
    // reading #studio-canvas. In worker mode the source is the ImageBitmap the worker transferred
    // back (its OffscreenCanvas control was transferred, so the element itself is inert); in main-gpu
    // mode the source is our dedicated gpuCanvas drawn this frame.
    _composite() {
      if (!targetCanvas) return;
      const ctx = targetCanvas.getContext && targetCanvas.getContext("2d");
      if (!ctx) return;
      const src = (mode === "worker") ? latestBitmap : gpuCanvas;
      if (!src) return;
      try { ctx.drawImage(src, 0, 0, targetCanvas.width, targetCanvas.height); } catch (_) {}
    },

    _applyCount(n) {
      if (mode === "worker" && workerHandle) workerHandle.setCount(n);
      else if (mainBackend && mainBackend.setCount) mainBackend.setCount(n);
    },

    resize(width, height) {
      w = Math.max(1, width || w); h = Math.max(1, height || h);
      if (mode === "worker" && workerHandle) {
        // The worker owns the OffscreenCanvas; resize it through the worker (touching the inert
        // main-thread element after transferControlToOffscreen would throw).
        workerHandle.resize(w, h, 1);
      } else {
        if (gpuCanvas) { gpuCanvas.width = w; gpuCanvas.height = h; }
        if (mainBackend && mainBackend.resize) mainBackend.resize(w, h);
      }
    },

    // Status for the toolbar / model readout. Honest: the live backend, tier, count, and mode.
    status() {
      return {
        tier,
        backend: backendName,
        mode,
        count: mode === "worker" ? (workerCount || count) : (mainBackend && mainBackend.getCount ? mainBackend.getCount() : count),
        budget,
        governorLevel: governor ? governor.level : 0,
        emaMs: governor ? governor.ema : NaN,
      };
    },

    // perceive() for the spine/measurimeter (any operator can be perceived).
    perceive() {
      if (mainBackend && mainBackend.perceive) return mainBackend.perceive();
      return { backend: backendName, count, cx: w / 2, cy: h / 2 };
    },

    dispose() {
      disposed = true;
      if (workerHandle) { try { workerHandle.dispose(); } catch (_) {} workerHandle = null; }
      if (mainBackend) { try { mainBackend.dispose(); } catch (_) {} mainBackend = null; }
      try { if (latestBitmap && latestBitmap.close) latestBitmap.close(); } catch (_) {}
      latestBitmap = null;
      gpuCanvas = null; targetCanvas = null; governor = null;
    },
  };
}

export default { createGpuParticles };
