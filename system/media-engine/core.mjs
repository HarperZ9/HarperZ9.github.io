// system/media-engine/core.mjs
// The media engine core: one plugin registry and one frame scheduler for every visual surface.
//
// Today each surface carries its own requestAnimationFrame loop with its own idea of when to
// stop: hero-aperture.js pauses off screen, generative-field.js throttles to 82 ms but keeps
// running behind a hidden canvas, and the Retro Engine loop runs whether or not anyone can see
// it and whether or not the reader asked for less motion. The scheduler makes those rules one
// policy that every plugin inherits:
//
//   1. One requestAnimationFrame for the whole page, however many instances are mounted.
//   2. An instance draws only while its canvas intersects the viewport and the tab is visible.
//   3. prefers-reduced-motion draws one still frame per mount, resize or parameter change.
//   4. Each instance may declare minFrameMs (a cadence cap) and gets its own CPU-time meter.
//   5. A frame-time governor (system/engine/governor.js) can step quality down on slow devices.
//   6. An instance whose output is not only visual (the Retro Engine sonifying its own frame)
//      may pass keepAlive(): while it returns true the instance runs off screen too. Reduced
//      motion still holds its picture to one still frame.
//
// Plugin contract (a plain object; see plugins/*.mjs):
//   { id, version, backends: ["webgl2", "canvas2d", ...],
//     create({ canvas, params, seed, backend, reduced, requestRedraw }) -> instance }
// An instance with static: true is drawn only on request (mount, setParams, resize, redraw, or its
// own requestRedraw() when an asset arrives), never by the animation loop.
// Instance contract:
//   frame(tSeconds, dtSeconds)   draw one frame; must be cheap to call when nothing changed
//   resize?()                    canvas box changed
//   setParams?(params)           new parameters; the scheduler queues one redraw
//   readPixels?() -> Uint8Array  RGBA bytes of the last frame, for receipts and tests
//   dispose()

import { makeGovernor } from "../engine/governor.js";
import { frameReceipt, reconcile } from "./receipt.mjs";

// Backends. A plugin lists the ones it can draw with; the first available wins. "wasm-raw" is the
// raw-native core compiled to WebAssembly: the suite's exact reference rasterizer for 3D work.
// A 3D-capable plugin that lists it can ask for an exact render of any request, and its receipt
// carries the reconcile result. 2D surfaces (weave, plotter, Canvas2D plates, audio) keep their own
// backends: they are not rasterization problems.
export const BACKENDS = Object.freeze(["webgpu", "webgl2", "webgl", "canvas2d", "wasm-raw", "wasm"]);
export const REFERENCE_BACKEND = "wasm-raw";

// Reference renderers by backend id. A renderer is { render(request) -> Promise<Uint8Array RGBA> }
// for the same request shape frameReceipt hashes (see scene.mjs for the camera fields).
const references = new Map();
export function registerReferenceBackend(id, renderer) {
  if (!renderer || typeof renderer.render !== "function") throw new Error("media-engine: a reference backend needs render(request)");
  references.set(id, renderer);
}
export function referenceBackend(id = REFERENCE_BACKEND) { return references.get(id) || null; }

const reducedQuery = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;

export function createEngine(opts = {}) {
  const plugins = new Map();
  const live = new Set();
  let raf = 0;
  let last = 0;
  const governor = makeGovernor(opts.targetMs || 16.6, { levels: opts.levels || 3 });
  const reduced = () => (opts.reduced !== undefined ? !!opts.reduced : !!(reducedQuery && reducedQuery.matches));

  function wake() {
    if (raf || reduced() || document.hidden) return;
    if (![...live].some(runnable)) return;
    raf = requestAnimationFrame(tick);
  }

  const runnable = (m) => !m.disposed && !m.instance.static && (m.visible || (m.keepAlive && m.keepAlive()));

  function tick(now) {
    raf = 0;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const t0 = performance.now();
    for (const m of live) {
      if (!runnable(m)) continue;
      if (m.minFrameMs && now - m.lastDraw < m.minFrameMs) continue;
      drawOne(m, now / 1000, dt);
    }
    governor.observe(dt * 1000 || 16.6);
    engine.stats.schedulerMs = performance.now() - t0;
    wake();
  }

  function drawOne(m, t, dt) {
    const s = performance.now();
    try { m.instance.frame(t, dt); m.error = null; }
    catch (e) { m.error = String(e && e.message || e); console.error("[media-engine] " + m.plugin.id + " frame failed:", e); }
    const ms = performance.now() - s;
    m.cpuMs = m.cpuMs ? m.cpuMs * 0.9 + ms * 0.1 : ms;
    m.frames += 1;
    m.lastDraw = t * 1000;
  }

  // A still frame: used for reduced motion and for one-shot redraws (resize, parameter change).
  function still(m) {
    if (m.pendingStill) return;
    m.pendingStill = true;
    requestAnimationFrame((now) => { m.pendingStill = false; if (!m.disposed) drawOne(m, m.stillTime ?? now / 1000, 0); });
  }

  const io = typeof IntersectionObserver === "function"
    ? new IntersectionObserver((entries) => {
        for (const e of entries) {
          const m = [...live].find((x) => x.canvas === e.target);
          if (!m) continue;
          m.visible = e.isIntersecting;
          if (m.visible && reduced()) still(m);
        }
        wake();
      }, { rootMargin: "64px" })
    : null;

  const onVis = () => { if (!document.hidden) { last = 0; wake(); } };
  // A still frame drawn for one pole must be redrawn when the reader picks the other.
  const onTheme = () => { for (const m of live) still(m); };
  if (typeof window !== "undefined") window.addEventListener("themechange", onTheme);
  document.addEventListener("visibilitychange", onVis);
  if (reducedQuery && reducedQuery.addEventListener) reducedQuery.addEventListener("change", () => { for (const m of live) still(m); wake(); });

  const engine = {
    stats: { schedulerMs: 0 },
    governor,
    register(plugin) {
      if (!plugin || !plugin.id || typeof plugin.create !== "function") throw new Error("media-engine: a plugin needs an id and create()");
      plugins.set(plugin.id, plugin);
      return engine;
    },
    plugins() { return [...plugins.keys()]; },
    get reduced() { return reduced(); },
    // Ask for one redraw of every instance (used after a layout change the engine cannot see).
    redrawAll() { for (const m of live) still(m); },
    mount(canvas, id, { params = {}, seed = "telos", backend, minFrameMs = 0, stillTime, keepAlive } = {}) {
      const plugin = plugins.get(id);
      if (!plugin) throw new Error("media-engine: unknown plugin " + id);
      const chosen = backend || plugin.backends[0];
      let self = null;
      const requestRedraw = () => { if (self && !self.disposed) still(self); };
      const instance = plugin.create({ canvas, params, seed, backend: chosen, reduced: reduced(), requestRedraw });
      const m = { plugin, canvas, instance, params, seed, backend: instance.backend || chosen, minFrameMs, stillTime, keepAlive,
        visible: !io, disposed: false, frames: 0, cpuMs: 0, lastDraw: 0, error: null, pendingStill: false };
      self = m;
      live.add(m);
      if (io) io.observe(canvas);
      still(m);
      wake();
      const handle = {
        get backend() { return m.backend; },
        get plugin() { return { id: plugin.id, version: plugin.version }; },
        get stats() { return { frames: m.frames, cpuMs: +m.cpuMs.toFixed(3), visible: m.visible, error: m.error }; },
        setParams(p) { m.params = { ...m.params, ...p }; if (instance.setParams) instance.setParams(m.params); still(m); },
        resize() { if (instance.resize) instance.resize(); still(m); },
        // Draw one frame now (a parameter the plugin reads live changed) and wake the loop.
        redraw() { still(m); wake(); },
        get instance() { return instance; },
        // Draw the frame at a fixed time and return its receipt: the request, its hash, and the
        // pixel hash of what came out. Same request + same backend + same device must agree.
        // With { reference: true } and a plugin that lists "wasm-raw", the same request is also drawn
        // by the reference backend and the receipt carries the reconcile result.
        async receipt(t = 1.3, { keepPixels = false, reference = false, tolerance } = {}) {
          instance.frame(t, 0);
          const rgba = instance.readPixels ? instance.readPixels() : null;
          const request = { plugin: plugin.id, version: plugin.version, params: m.params, seed: String(m.seed), t, backend: m.backend };
          let ref = null, rec = null;
          if (reference && plugin.backends.includes(REFERENCE_BACKEND)) {
            ref = REFERENCE_BACKEND;
            const renderer = references.get(REFERENCE_BACKEND);
            const none = (reason) => ({ verdict: "UNVERIFIABLE", rmse: null, maxError: null, pixels: 0, reason });
            if (!renderer) rec = none(REFERENCE_BACKEND + " is not registered on this page");
            else {
              try { rec = reconcile(rgba, await renderer.render({ ...request, backend: REFERENCE_BACKEND }), tolerance ? { tolerance } : {}); }
              catch (e) { console.error("[media-engine] reference render failed:", e); rec = none("reference render failed"); }
            }
          }
          const r = await frameReceipt(request, rgba, { referenceBackend: ref, reconcile: rec });
          if (keepPixels) Object.defineProperty(r, "pixels", { value: rgba, enumerable: false });
          return r;
        },
        dispose() {
          m.disposed = true; live.delete(m);
          if (io) io.unobserve(canvas);
          try { instance.dispose(); } catch (_) {}
        },
      };
      return handle;
    },
    dispose() {
      cancelAnimationFrame(raf); raf = 0;
      for (const m of [...live]) { m.disposed = true; try { m.instance.dispose(); } catch (_) {} }
      live.clear();
      if (io) io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      if (typeof window !== "undefined") window.removeEventListener("themechange", onTheme);
    },
  };
  return engine;
}
