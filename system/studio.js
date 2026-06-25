// studio.js: the unified Studio. One canvas, two ways in (Generate via the Atelier, or Bring your own),
// then perceive/discuss/transform/refine with the model. Bridges the Atelier's canvas to the eye.
import { perceptualHash, features, hamming } from "../shared-frame/eye.js";
import { representation, richFeatures, describeFrame, rmsFromBytes, spectrumBands, dominantPitchHz, assembleFullPerception } from "./sense.js";
import { respond } from "./respond.js";
import { renderFractal, PRESETS } from "./fractal.js";
import { renderFractalGL, isFractalGLAvailable } from "./fractal-gl.js";
import { render3D } from "./fractal3d.js";
import { sizeToDisplay } from "./canvas-scale.js";
import { sourceIsAnimated, shouldHaltOnStatic, fullscreenMaxBacking } from "./studio-loop.js";
import { buildModelHeaders } from "./studio-model.js";
import { renderScene } from "./ndim.js";
import { drawSceneGL } from "./lib/render-nd/backends/webgl.mjs";
import { StudioImporters } from "./importers.js";
import { StudioExporters, download } from "./exporters.js";
import { ModelAdapter } from "./model-adapter.js";
import { buildCertificate, structuralOracle, cognitiveOracle } from "../shared-frame/certificate.js";
import { renderCertificate } from "../shared-frame/certificate-panel.js";
import { openLog, normaliseEntry, orderEntries } from "../shared-frame/audit-log.js";
import { openLog as openFidelityLog } from "../shared-frame/fidelity-log.js";
import {
  onSourceChange as surfaceOnSourceChange,
  resetViewTransform,
  wireToolbarButtons,
  registerMusicCallbacks,
  registerFractalCallbacks,
  startMonitorLoop,
  stopMonitorLoop,
} from "./studio-surface.js";
const $ = id => (window.__overlayDoc && window.__overlayDoc.getElementById(id)) || document.getElementById(id);
const fmt = (v,n=3)=>typeof v==="number"?(Number.isInteger(v)?String(v):v.toFixed(n)):String(v);
// drift is per-canvas (Task 6 review carry-in): keyed by the canvas instance, so switching
// modes / sources doesn't compare against an unrelated frame and show a misleading drift.
const lastHashByCanvas = new WeakMap();
// `mode` is kept as a coarse label the measurimeter's source line reads ("your media" vs
// "the Atelier / 2D"). The five-way source menu (Task 8f) drives it via setSource().
let mode = "generate";
let activeSource = "atelier";

// ── Quality state (Task 8g) ───────────────────────────────────────────────────
// Standard: maxBacking=1600, aa=1 (crisp on typical 1-2x displays, fast for per-pixel fractals).
// High:     maxBacking=3200, aa=2 (sharper on large/3x displays, SSAA supersampling, user opt-in).
//           maxBacking=3200 is the guard ceiling; devicePixelRatio x layout size is the real driver.
const QUALITY_LEVELS = {
  standard: { label: "Standard", maxBacking: 1600, iterMult: 1,   aa: 1 },
  high:     { label: "High",     maxBacking: 3200, iterMult: 1.5, aa: 2 },
};
let qualityKey = "standard";
function currentQuality() { return QUALITY_LEVELS[qualityKey]; }
// Shared helper: size the canvas to the current quality level and return backing dims.
// The canvas CSS size is determined by its container (.viewport-stage, max-width:100%), NOT by the
// canvas.width attribute itself, so we read the parent's bounding rect to get the true display size.
function sizeCanvas(canvas) {
  // Prefer the parent's layout size (the constraining container), falling back to the canvas rect.
  const parent = canvas.parentElement;
  const ref = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
  const cssW = Math.max(1, ref.width  || 1);
  const cssH = Math.max(1, ref.height || ref.width || 1);   // square stage: use width for both axes
  const dpr = window.devicePixelRatio || 1;
  // Backing ceiling. Windowed: the quality level's flat maxBacking. Fullscreen / large display: the
  // flat ceiling is too low for a hi-DPI screen, so raise it toward (longer screen edge * dpr),
  // capped at a GPU-safe limit. CPU per-pixel fractals stay modest to avoid jank; GPU / blit / music
  // paths get the full 4096. (fullscreenMaxBacking is node-tested in studio-loop.js.)
  let mb = currentQuality().maxBacking;
  if (typeof document !== "undefined" && document.fullscreenElement) {
    const cpuFractal = activeSource === "fractal" && !canvasIsGL;
    const hardCap = cpuFractal ? Math.max(mb, 2048) : 4096;
    const scr = (typeof screen !== "undefined" && screen) || { width: cssW, height: cssH };
    mb = fullscreenMaxBacking(scr.width, scr.height, dpr, { hardCap, floor: mb });
  }
  let rawW = Math.round(cssW * dpr);
  let rawH = Math.round(cssH * dpr);
  const longer = Math.max(rawW, rawH);
  if (longer > mb) {
    const s = mb / longer;
    rawW = Math.max(1, Math.round(rawW * s));
    rawH = Math.max(1, Math.round(rawH * s));
  }
  canvas.width  = rawW;
  canvas.height = rawH;
  return { w: rawW, h: rawH };
}

// The five sources and the rail block each shows. Selecting one shows ONLY that block and folds in
// every cleanup the old top-level mode switch used to do (stop the 3D orbit, release any capture /
// played video, idle the meter loop) so leaving a source never leaves a loop running. This subsumes
// the old setMode + the leave3D-on-mode-click wiring.
const SOURCES = {
  atelier:   { block: "src-atelier",   mode: "generate" },
  fractal:   { block: "src-fractal",   mode: "generate" },
  fractal3d: { block: "src-fractal3d", mode: "generate" },
  ndim:      { block: "src-ndim",      mode: "generate" },
  music:     { block: "src-music",     mode: "generate" },
  byo:       { block: "src-byo",       mode: "byo" },
  watch:     { block: "src-watch",     mode: "byo" },
};

function setSource(next) {
  if (!SOURCES[next]) return;
  // Leaving the current source: stop anything it had running. Guard the calls, since some are defined
  // later in the module (hoisted function declarations), so they're safe to call from here.
  if (next !== activeSource) {
    leave3D();          // restore the 2D canvas if a WebGL orbit was mounted
    stopNDim();         // stop the n-dim animation RAF if one is running
    stopWatch();        // release any screen/camera capture
    stopByoVideo();     // pause + release any played BYO video
    stopMeterLoop();    // idle the live meter loop until the new source restarts it
  }
  activeSource = next;
  // Publish activeSource so atelier.js (and any other non-module script) can gate
  // their canvas pointer handlers. Without this the Atelier's particle overlay fires
  // on every source, wiping music particles when the mouse crosses the canvas.
  window.__studioActiveSource = next;
  mode = SOURCES[next].mode;
  for (const [name, cfg] of Object.entries(SOURCES)) {
    const el = $(cfg.block); if (el) el.hidden = name !== next;
  }
  document.querySelectorAll("#studio-source button").forEach(b =>
    b.setAttribute("aria-selected", String(b.dataset.source === next)));
  // Mark the stage interactive (grab cursor + drag affordance) for the camera-driven sources.
  const stageEl = document.getElementById("viewport-stage");
  if (stageEl) stageEl.classList.toggle("cam-interactive", next === "fractal" || next === "fractal3d");
  // Music is an animated source: the reactive engine (or its idle loop) paints the canvas every
  // frame, so the perception loop must be reading it. Other sources arm their own loop from their
  // entry/play path; music has no settle-frame, so arm it here. The loop self-idles only for static
  // sources via the sourceIsAnimated() guard in liveTick, so music will not freeze.
  if (next === "music") startMeterLoop();
  syncToolbarForSource();
  // Notify the surface layer so panzoom attaches/detaches per the source change.
  // Pass the current canvas (may be a fresh GL canvas if fractal3d swapped it).
  try { surfaceOnSourceChange(next, $("studio-canvas")); } catch (_) {}
  // Start Tweakpane monitor loop for animated sources; stop it for static ones.
  if (next === "music" || next === "ndim" || next === "fractal3d") {
    try { startMonitorLoop(); } catch (_) {}
  } else {
    try { stopMonitorLoop(); } catch (_) {}
  }
}

$("studio-source").addEventListener("click", e => {
  const b = e.target.closest("button[data-source]"); if (b) setSource(b.dataset.source);
});
// Arrow-key navigation across the source tabs (roving, accessible).
$("studio-source").addEventListener("keydown", e => {
  if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
  const tabs = [...document.querySelectorAll("#studio-source button")];
  const i = tabs.indexOf(document.activeElement); if (i < 0) return;
  e.preventDefault();
  const j = (i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
  tabs[j].focus(); setSource(tabs[j].dataset.source);
});

// A 2D canvas can only ever yield a 2D context, and a WebGL canvas only WebGL. A canvas binds
// permanently to its first context type. The 3D-fractal source paints #studio-canvas via WebGL,
// so getContext("2d") on it would return null. readPixelData() reads RGBA either way: directly
// for a 2D canvas, or by blitting the (WebGL) canvas through a 2D scratch canvas with drawImage
// (which accepts any source canvas regardless of its backing context). Keeps perceive() reusable.
const _scratch = document.createElement("canvas");
function readPixelData(canvas, w, h) {
  const ctx2d = canvas.getContext("2d", { willReadFrequently: true });
  if (ctx2d) return ctx2d.getImageData(0, 0, w, h).data;
  // WebGL-backed (or otherwise non-2D) canvas: mirror it into a 2D scratch and read that.
  _scratch.width = w; _scratch.height = h;
  const sctx = _scratch.getContext("2d", { willReadFrequently: true });
  sctx.clearRect(0, 0, w, h);
  sctx.drawImage(canvas, 0, 0, w, h);
  return sctx.getImageData(0, 0, w, h).data;
}

function perceive(canvas) {
  const { width:w, height:h } = canvas;
  const px = readPixelData(canvas, w, h);
  const phash = perceptualHash(px,w,h,4), f = features(px,w,h,4);
  $("sc-phash").textContent = phash;
  $("sc-size").textContent = `${w}×${h}`;
  $("sc-feats").innerHTML = [["contrast",f.contrast],["structure",f.entropy],["balance",f.balance]]
    .map(([k,v])=>`<span class="ground"><span class="gk">${k}</span> ${fmt(v)}</span>`).join("");
  const prev = lastHashByCanvas.get(canvas);
  if (prev != null) { const d = hamming(prev, phash);
    const el=$("sc-drift"); el.hidden=false; el.textContent = d===0?"unchanged":`moved ${d}/64 from the last frame`; }
  lastHashByCanvas.set(canvas, phash);
  // The measurimeter: the richer, additive readout (faithful mosaic + dominant colours + edges +
  // regions). Reuses the px we already read; eye.js's gated dHash/features above are untouched.
  const rich = measure(px, w, h, phash);
  return { phash, features:f, rich, width:w, height:h };
}

function say(role, text) {
  // build the message from nodes: role + text via .textContent only, never interpolated
  // into innerHTML (Task 6 review carry-in: no markup injection through role/text).
  const log = $("studio-log"); const el = document.createElement("div");
  el.className = "msg " + role;
  const who = document.createElement("span"); who.className = "who"; who.textContent = role;
  const body = document.createElement("span"); body.className = "body"; body.textContent = text;
  el.appendChild(who); el.appendChild(body);
  log.appendChild(el); log.scrollTop = log.scrollHeight;
}
window.__studioPerceive = perceive; window.__studioSay = say;   // used by the bridge (Task 7) + tests

// ── Fractal source (Task 7b; GPU + interactive camera, Task 8n) ────────────────
// Populate the preset dropdown from PRESETS (all types), filtered by the selected type chip.
const fractalPresetEl = $("fractal-preset");
let activeFType = "mandelbrot";
let fractalView = null; // Transient zoom state: a shallow copy of the selected preset, never a reference into PRESETS.

// GPU path available? Decided once. When true, 2D fractals render on the GPU (fractal-gl.js) for
// near-instant frames + real-time pan/zoom; the CPU renderFractal (fractal.js, the gated reference)
// is the fallback. The fallback also serves environments without WebGL.
const GL_AVAILABLE = isFractalGLAvailable();

function buildPresetMenu(ftype) {
  fractalPresetEl.innerHTML = "";
  PRESETS.filter(p => p.type === ftype).forEach((p, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = p.name;
    // Store the full preset index in the option value for retrieval
    opt.dataset.presetName = p.name;
    fractalPresetEl.appendChild(opt);
  });
}

// Default starting framing for the active fractal view, used by Reset view.
let fractalDefault = null;

// Paint the current fractalView into #studio-canvas. GPU when available (mounting a fresh GL canvas
// the first time, mirroring the 3D source's canvas swap), else CPU (progressive coarse-to-refine on
// the original 2D node). Does NOT perceive or chat; callers decide whether to perceive (interaction
// frames perceive via the live meter loop; settle frames perceive once). Returns the canvas drawn.
// aaOverride: when provided, uses that aa value instead of currentQuality().aa. Interactive
// pan/zoom passes 1 to stay fast; settled renders pass undefined (uses quality level).
let _cpuRefineRaf = 0;
function paintFractal(opts, aaOverride) {
  const maxIter = Math.round(opts.maxIter * currentQuality().iterMult);
  const aa = aaOverride !== undefined ? aaOverride : currentQuality().aa;
  if (GL_AVAILABLE) {
    // Mount a GL canvas if one isn't already up (or if a 3D orbit's node is mounted, reuse it).
    let c = canvasIsGL ? $("studio-canvas") : mountGLCanvas();
    if (!canvasIsGL) { canvasIsGL = true; }
    glFractal2D = true;
    fractal3dHandle = null;   // not a 3D orbit
    if (stop3d) { stop3d(); stop3d = null; }   // ensure no 3D orbit RAF lingers on this node
    sizeCanvas(c);
    try {
      renderFractalGL(c, { ...opts, maxIter, aa });
      return c;
    } catch (e) {
      // GPU failed at runtime: fall back to CPU on the original 2D canvas.
      leave3D();
    }
  }
  // CPU path (fallback / no WebGL): progressive render so the UI never blocks (Task 8n perf).
  const c = $("studio-canvas");
  sizeCanvas(c);
  cpuFractalProgressive(c, { ...opts, maxIter });
  return c;
}

// Progressive CPU fractal: a coarse pass first (downscaled backing → fast, scaled up by CSS), then a
// rAF-deferred full-resolution pass. Keeps the main thread responsive instead of one long blocking
// putImageData. Cancels any in-flight refine when a new render starts.
function cpuFractalProgressive(canvas, opts) {
  if (_cpuRefineRaf) { cancelAnimationFrame(_cpuRefineRaf); _cpuRefineRaf = 0; }
  const fullW = canvas.width, fullH = canvas.height;
  // Coarse pass: quarter-res backing (1/4 the pixels) for an instant preview.
  const cw = Math.max(1, Math.round(fullW / 4)), ch = Math.max(1, Math.round(fullH / 4));
  canvas.width = cw; canvas.height = ch;
  renderFractal(canvas, opts);
  // Refine to full res on the next frame (or immediately in a no-rAF env).
  const refine = () => {
    _cpuRefineRaf = 0;
    canvas.width = fullW; canvas.height = fullH;
    renderFractal(canvas, opts);
  };
  if (typeof requestAnimationFrame === "function") _cpuRefineRaf = requestAnimationFrame(refine);
  else refine();
}

function renderPreset() {
  const ftype = activeFType;
  const filtered = PRESETS.filter(p => p.type === ftype);
  const idx = parseInt(fractalPresetEl.value, 10);
  const preset = filtered[isNaN(idx) ? 0 : idx];
  if (!preset) return;
  // Reset fractalView to a fresh shallow copy of the canonical preset (decouples zoom from PRESETS).
  fractalView = { ...preset };
  fractalDefault = { ...preset };   // remember the default framing for Reset view
  const canvas = paintFractal(fractalView);
  const obs = perceive(canvas);
  const typeLabel = { mandelbrot: "Mandelbrot set", julia: "Julia set", burningship: "Burning Ship" }[fractalView.type] || fractalView.type;
  const detail = obs.features.entropy > 0.8
    ? "dense filament detail, the boundary is alive here"
    : obs.features.entropy < 0.45
      ? "clean, spacious regions with a calm centre"
      : "a mix of open field and fine boundary structure";
  const fcol = (obs.rich && obs.rich.dominantColors || []).slice(0, 3).join(", ");
  say("model",
    `${fractalView.name}, a ${typeLabel} at scale ${fractalView.scale}. `
    + `I fingerprinted it at ${obs.phash}; it reads as ${detail}`
    + (fcol ? `, dominated by ${obs.rich.hueName} (${fcol})` : ``) + `. `
    + `Max iterations: ${fractalView.maxIter}. `
    + (GL_AVAILABLE ? `Scroll to zoom toward the cursor, drag to pan` : `Click to zoom toward a point`)
    + `, swap the palette, or hand it back to the Atelier.`
  );
  startMeterLoop();   // refresh the measurimeter, then self-idle (static fractal)
}

// Wire type chips: filter presets by type when chip is clicked
document.querySelectorAll("[data-ftype]").forEach(btn => {
  btn.addEventListener("click", () => {
    activeFType = btn.dataset.ftype;
    document.querySelectorAll("[data-ftype]").forEach(b => b.classList.toggle("active", b === btn));
    buildPresetMenu(activeFType);
  });
});

// ── Interactive 2D camera (Task 8n): wheel-zoom-toward-cursor + drag-pan, rAF-throttled, GPU-fast.
// Re-renders the transient fractalView in real time (never PRESETS). Touch: pinch-zoom + drag.
// Bound on the stable .stage container (delegated) because the GL/CPU canvas node is swapped on
// source/mode changes, a listener on the node would be lost.
const fStage = $("studio-canvas").closest(".stage");
let _fractalRaf = 0, _fractalDirty = false;

// Convert a client-space point on the canvas to its complex-plane coordinate under the current view.
function fractalPointToComplex(clientX, clientY, canvas, rect) {
  const fx = (clientX - rect.left) / rect.width;   // 0..1 across the displayed canvas
  const fy = (clientY - rect.top) / rect.height;
  const aspect = canvas.height / canvas.width;
  const flipY = fractalView.type === "burningship" ? -1 : 1;
  return {
    re: fractalView.cx + (fx - 0.5) * fractalView.scale,
    im: fractalView.cy + flipY * (fy - 0.5) * fractalView.scale * aspect,
  };
}

// Schedule a throttled re-render of the current fractalView (coalesces rapid wheel/drag events to
// one paint per animation frame). Perception streams via the live meter loop, so we don't perceive
// here every frame; we ensure the loop is running so #sc-phash + the meters keep updating.
// Interactive renders always use aa=1 so pan/zoom stays fast regardless of the quality setting;
// only settled renders (renderPreset, applyQualityAndRerender, snapshot) use the full quality aa.
function scheduleFractalRender() {
  _fractalDirty = true;
  if (_fractalRaf) return;
  const tick = () => {
    _fractalRaf = 0;
    if (!_fractalDirty) return;
    _fractalDirty = false;
    if (!fractalView) return;
    paintFractal(fractalView, /* aaOverride */ 1);   // aa=1 keeps interactive frames fast
    // perceive once per frame so #sc-phash changes immediately (the meter loop also streams it).
    try { perceive($("studio-canvas")); } catch (_) {}
  };
  if (typeof requestAnimationFrame === "function") _fractalRaf = requestAnimationFrame(tick);
  else tick();
}

// Is a 2D fractal the active, interactable source right now?
function fractalInteractive() { return activeSource === "fractal" && fractalView && !fractal3dHandle; }

// Wheel: zoom toward the cursor. Recompute cx/cy so the complex point under the pointer stays fixed.
fStage.addEventListener("wheel", e => {
  if (!fractalInteractive()) return;
  e.preventDefault();
  const canvas = $("studio-canvas");
  const rect = canvas.getBoundingClientRect();
  const before = fractalPointToComplex(e.clientX, e.clientY, canvas, rect);
  const factor = Math.exp((e.deltaY > 0 ? 1 : -1) * 0.18);   // smooth multiplicative zoom
  fractalView.scale *= factor;
  // Keep the point under the cursor fixed: shift center by how much that point moved.
  const after = fractalPointToComplex(e.clientX, e.clientY, canvas, rect);
  fractalView.cx += before.re - after.re;
  fractalView.cy += before.im - after.im;
  startMeterLoop();
  scheduleFractalRender();
}, { passive: false });

// Drag to pan (mouse). Track pointer; translate the delta into a complex-plane shift.
let _fdrag = null;
fStage.addEventListener("pointerdown", e => {
  if (!fractalInteractive() || e.pointerType === "touch") return;   // touch handled separately
  const canvas = $("studio-canvas");
  const rect = canvas.getBoundingClientRect();
  _fdrag = { x: e.clientX, y: e.clientY, rect, w: rect.width, h: rect.height, moved: false };
  try { fStage.setPointerCapture(e.pointerId); } catch (_) {}
});
fStage.addEventListener("pointermove", e => {
  if (!_fdrag) return;
  const canvas = $("studio-canvas");
  const dx = e.clientX - _fdrag.x, dy = e.clientY - _fdrag.y;
  if (Math.abs(dx) + Math.abs(dy) > 2) _fdrag.moved = true;
  _fdrag.x = e.clientX; _fdrag.y = e.clientY;
  const aspect = canvas.height / canvas.width;
  const flipY = fractalView.type === "burningship" ? -1 : 1;
  fractalView.cx -= (dx / _fdrag.w) * fractalView.scale;
  fractalView.cy -= flipY * (dy / _fdrag.h) * fractalView.scale * aspect;
  startMeterLoop();
  scheduleFractalRender();
});
function endFractalDrag(e) {
  if (!_fdrag) return;
  try { fStage.releasePointerCapture(e.pointerId); } catch (_) {}
  _fdrag = null;
}
fStage.addEventListener("pointerup", endFractalDrag);
fStage.addEventListener("pointercancel", endFractalDrag);

// Click-to-zoom (kept as a convenience, esp. for the CPU fallback): a click that didn't drag zooms
// 2× toward the point. Wheel is the primary gesture when GPU is on.
fStage.addEventListener("click", e => {
  if (!fractalInteractive()) return;
  if (_fdrag && _fdrag.moved) return;   // was a drag, not a click
  if (!e.target.closest("#studio-canvas")) return;
  const canvas = $("studio-canvas");
  const rect = canvas.getBoundingClientRect();
  const at = fractalPointToComplex(e.clientX, e.clientY, canvas, rect);
  fractalView.cx = at.re; fractalView.cy = at.im; fractalView.scale *= 0.5;
  paintFractal(fractalView, /* aaOverride */ 1);
  const obs = perceive(canvas);
  say("model",
    `Zoomed in. Now at (${fractalView.cx.toFixed(8)}, ${fractalView.cy.toFixed(8)}), scale ${fractalView.scale.toExponential(2)}. `
    + `Fingerprint: ${obs.phash}. Scroll or click to keep diving.`
  );
  startMeterLoop();
});

// Touch: pinch-zoom + one-finger drag-pan for 2D fractals.
const _ftouch = { pts: new Map(), pinchDist: 0, panX: 0, panY: 0 };
fStage.addEventListener("touchstart", e => {
  if (!fractalInteractive()) return;
  for (const t of e.changedTouches) _ftouch.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
  if (_ftouch.pts.size === 2) {
    const [a, b] = [..._ftouch.pts.values()];
    _ftouch.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
  } else if (_ftouch.pts.size === 1) {
    const p = [..._ftouch.pts.values()][0]; _ftouch.panX = p.x; _ftouch.panY = p.y;
  }
}, { passive: true });
fStage.addEventListener("touchmove", e => {
  if (!fractalInteractive() || _ftouch.pts.size === 0) return;
  e.preventDefault();
  const canvas = $("studio-canvas");
  const rect = canvas.getBoundingClientRect();
  for (const t of e.changedTouches) if (_ftouch.pts.has(t.identifier)) _ftouch.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
  if (_ftouch.pts.size >= 2) {
    const [a, b] = [..._ftouch.pts.values()];
    const mid = { clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 };
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    const before = fractalPointToComplex(mid.clientX, mid.clientY, canvas, rect);
    const factor = _ftouch.pinchDist / dist;   // fingers apart → zoom in
    fractalView.scale *= factor;
    const after = fractalPointToComplex(mid.clientX, mid.clientY, canvas, rect);
    fractalView.cx += before.re - after.re;
    fractalView.cy += before.im - after.im;
    _ftouch.pinchDist = dist;
  } else {
    const p = [..._ftouch.pts.values()][0];
    const dx = p.x - _ftouch.panX, dy = p.y - _ftouch.panY;
    _ftouch.panX = p.x; _ftouch.panY = p.y;
    const aspect = canvas.height / canvas.width;
    const flipY = fractalView.type === "burningship" ? -1 : 1;
    fractalView.cx -= (dx / rect.width) * fractalView.scale;
    fractalView.cy -= flipY * (dy / rect.height) * fractalView.scale * aspect;
  }
  startMeterLoop();
  scheduleFractalRender();
}, { passive: false });
function endFractalTouch(e) {
  for (const t of e.changedTouches) _ftouch.pts.delete(t.identifier);
}
fStage.addEventListener("touchend", endFractalTouch, { passive: true });
fStage.addEventListener("touchcancel", endFractalTouch, { passive: true });

$("fractal-render").addEventListener("click", renderPreset);

// Build initial menu on page load
buildPresetMenu(activeFType);

// ── 3D fractal source (Task 7c) ─────────────────────────────────────────────
// A WebGL1 raymarcher (system/fractal3d.js) paints the shared canvas, then the eye perceives one
// settled frame. A canvas binds permanently to its FIRST context type, and the Atelier (atelier.js)
// already claimed a 2D context on #studio-canvas at boot and cached it in a closure. So WebGL can't
// bind to that element. The fix: keep the original Atelier-owned canvas aside; when entering 3D,
// detach it and mount a fresh GL canvas in its place; when leaving 3D, REMOUNT the original node
// (its 2D context + the Atelier's cached reference are intact). The 2D-fractal source re-queries
// #studio-canvas by id each render, so it works with whichever canvas is currently mounted.
let stop3d = null;              // the 3D orbit's .stop (legacy name kept; set from fractal3dHandle)
let fractal3dHandle = null;     // the FULL render3D handle (camera controls + stop), Task 8n
let canvasIsGL = false;         // a fresh GL canvas is mounted (3D orbit OR 2D GPU fractal), not the 2D node
let glFractal2D = false;        // the mounted GL canvas is showing a 2D GPU fractal (Task 8n)
const originalCanvas = $("studio-canvas");   // the Atelier-bound 2D node, never destroyed

// Mount a fresh GL-capable canvas in place of whatever #studio-canvas currently is. Returns it.
// The original node is only detached (kept in originalCanvas), never discarded.
function mountGLCanvas() {
  const cur = $("studio-canvas");
  const gl = document.createElement("canvas");
  gl.id = "studio-canvas";
  // CSS size mirrors the original canvas's layout size; backing set by sizeCanvas() at render time.
  gl.style.width = "100%"; gl.style.height = "100%";
  gl.width = 512; gl.height = 512;
  cur.replaceWith(gl);
  return gl;
}

// Stop any running orbit / GPU-fractal canvas and, if a GL canvas is mounted, restore the original
// 2D Atelier canvas so getContext("2d") (perceive, Atelier, fractal.js) never returns null.
// Idempotent. Named leave3D for all existing callers; Task 8n widened it to also drop the 2D-GL path.
function leave3D() {
  if (stop3d) { stop3d(); stop3d = null; }
  fractal3dHandle = null;
  if (canvasIsGL) {
    stopMeterLoop();   // the orbit/stream is gone, stop streaming
    const glCanvas = $("studio-canvas");   // the GL canvas being discarded
    glCanvas.replaceWith(originalCanvas);   // remount the intact 2D node
    // Release the WebGL context to prevent resource leaks when cycling sources (browsers cap ~16 contexts).
    try {
      const _gl = glCanvas.getContext("webgl") || glCanvas.getContext("experimental-webgl");
      _gl && _gl.getExtension("WEBGL_lose_context") && _gl.getExtension("WEBGL_lose_context").loseContext();
    } catch (e) { /* non-fatal */ }
    canvasIsGL = false;
    glFractal2D = false;
  }
}
window.__studioLeave3D = leave3D;  // tests / source-menu (Task 8f) hook

function render3DInto(opts) {
  if (stop3d) { stop3d(); stop3d = null; }   // cancel the previous orbit before starting a new one
  // Mount a fresh GL canvas (idempotent: if one is already mounted we reuse the mounted node).
  let c = canvasIsGL ? $("studio-canvas") : mountGLCanvas();
  // Leaving any 2D-GL fractal: drop its cached context state (the node is being reused for 3D).
  glFractal2D = false;
  // Size the GL canvas to the hi-DPI backing resolution (the raymarcher reads canvas.width/height).
  sizeCanvas(c);
  try {
    fractal3dHandle = render3D(c, opts);
    stop3d = fractal3dHandle.stop;
    canvasIsGL = true;
    startMeterLoop();   // the orbit animates, stream the meters so the hash changes as it turns
  } catch (e) {
    // WebGL unavailable: restore the 2D canvas and show the friendly fallback.
    leave3D();
    say("model", "3D fractals need WebGL in your browser. Try the 2D fractals or the Atelier.");
    return;
  }
  // Perceive one frame once the first paint has settled (~200ms): a couple of orbit frames in.
  setTimeout(() => {
    if (!canvasIsGL) return;   // left 3D before the timer fired
    const obs = perceive($("studio-canvas"));
    const relief = obs.features.contrast > 0.6 ? "deep relief and strong light" : "soft, diffuse form";
    const label = opts.type === "mandelbulb" ? "Mandelbulb" : "Mandelbox";
    const col3 = (obs.rich && obs.rich.dominantColors || []).slice(0, 3).join(", ");
    say("model",
      `A raymarched ${label}, lit in 3D and slowly orbiting. I read it at ${obs.phash}: ${relief}`
      + (col3 ? `, in ${obs.rich.hueName} (${col3})` : ``) + `. The measurimeter is live, so watch the hash move as it turns. `
      + `Nudge the ${opts.type === "mandelbulb" ? "power" : "scale"} or iterations and re-render, or I can take a turn.`);
  }, 200);
}

// Wire the 3D control block: type chips + sliders + Render.
let active3DType = "mandelbox";
document.querySelectorAll("[data-f3type]").forEach(btn => {
  btn.addEventListener("click", () => {
    active3DType = btn.dataset.f3type;
    document.querySelectorAll("[data-f3type]").forEach(b => b.classList.toggle("active", b === btn));
    // Show the relevant slider (scale for the box, power for the bulb).
    const isBulb = active3DType === "mandelbulb";
    $("f3-scale-row").hidden = isBulb;
    $("f3-power-row").hidden = !isBulb;
  });
});

const f3 = id => $(id);
function read3DOpts() {
  return {
    type: active3DType,
    scale: parseFloat(f3("f3-scale").value),
    power: parseFloat(f3("f3-power").value),
    iterations: parseInt(f3("f3-iterations").value, 10),
  };
}
// Live-label the sliders.
function syncLabel(slider, out, fmtFn) {
  const el = f3(out); const s = f3(slider);
  if (el && s) el.textContent = fmtFn(s.value);
}
["f3-scale", "f3-power", "f3-iterations"].forEach(id => {
  const s = f3(id); if (!s) return;
  s.addEventListener("input", () => {
    if (id === "f3-scale") syncLabel("f3-scale", "f3-scale-val", v => (+v).toFixed(2));
    if (id === "f3-power") syncLabel("f3-power", "f3-power-val", v => (+v).toFixed(1));
    if (id === "f3-iterations") syncLabel("f3-iterations", "f3-iterations-val", v => String(v));
  });
});
syncLabel("f3-scale", "f3-scale-val", v => (+v).toFixed(2));
syncLabel("f3-power", "f3-power-val", v => (+v).toFixed(1));
syncLabel("f3-iterations", "f3-iterations-val", v => String(v));

f3("f3-render").addEventListener("click", () => render3DInto(read3DOpts()));

// ── Interactive 3D camera (Task 8n): drag to orbit, wheel to dolly. Feeds the pointer delta into
// the camera angle uniforms in fractal3d.js via the handle's orbit()/dolly(); a gentle idle
// auto-orbit resumes ~1.4s after the user lets go (handled in render3D). Touch supported.
// Bound on the same stable .stage container; guarded so it only acts when a 3D orbit is mounted.
function fractal3dInteractive() { return activeSource === "fractal3d" && !!fractal3dHandle; }
let _3drag = null;
fStage.addEventListener("pointerdown", e => {
  if (!fractal3dInteractive() || e.pointerType === "touch") return;
  _3drag = { x: e.clientX, y: e.clientY };
  if (fractal3dHandle.beginInteract) fractal3dHandle.beginInteract();
  try { fStage.setPointerCapture(e.pointerId); } catch (_) {}
});
fStage.addEventListener("pointermove", e => {
  if (!_3drag || !fractal3dHandle) return;
  const dx = e.clientX - _3drag.x, dy = e.clientY - _3drag.y;
  _3drag.x = e.clientX; _3drag.y = e.clientY;
  if (fractal3dHandle.orbit) fractal3dHandle.orbit(dx, dy);
});
function end3dDrag(e) {
  if (!_3drag) return;
  _3drag = null;
  if (fractal3dHandle && fractal3dHandle.endInteract) fractal3dHandle.endInteract();
  try { fStage.releasePointerCapture(e.pointerId); } catch (_) {}
}
fStage.addEventListener("pointerup", end3dDrag);
fStage.addEventListener("pointercancel", end3dDrag);
fStage.addEventListener("wheel", e => {
  if (!fractal3dInteractive()) return;
  e.preventDefault();
  // wheel up (deltaY<0) dollies in (smaller distance), down dollies out.
  if (fractal3dHandle.dolly) fractal3dHandle.dolly(e.deltaY > 0 ? 1.08 : 1 / 1.08);
}, { passive: false });
// Touch orbit/dolly for 3D.
const _3touch = { pts: new Map(), pinch: 0, x: 0, y: 0 };
fStage.addEventListener("touchstart", e => {
  if (!fractal3dInteractive()) return;
  if (fractal3dHandle.beginInteract) fractal3dHandle.beginInteract();
  for (const t of e.changedTouches) _3touch.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
  if (_3touch.pts.size === 2) { const [a, b] = [..._3touch.pts.values()]; _3touch.pinch = Math.hypot(a.x - b.x, a.y - b.y); }
  else if (_3touch.pts.size === 1) { const p = [..._3touch.pts.values()][0]; _3touch.x = p.x; _3touch.y = p.y; }
}, { passive: true });
fStage.addEventListener("touchmove", e => {
  if (!fractal3dInteractive() || _3touch.pts.size === 0) return;
  e.preventDefault();
  for (const t of e.changedTouches) if (_3touch.pts.has(t.identifier)) _3touch.pts.set(t.identifier, { x: t.clientX, y: t.clientY });
  if (_3touch.pts.size >= 2) {
    const [a, b] = [..._3touch.pts.values()];
    const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
    if (fractal3dHandle.dolly && _3touch.pinch) fractal3dHandle.dolly(_3touch.pinch / dist);
    _3touch.pinch = dist;
  } else {
    const p = [..._3touch.pts.values()][0];
    const dx = p.x - _3touch.x, dy = p.y - _3touch.y; _3touch.x = p.x; _3touch.y = p.y;
    if (fractal3dHandle.orbit) fractal3dHandle.orbit(dx, dy);
  }
}, { passive: false });
function end3dTouch(e) {
  for (const t of e.changedTouches) _3touch.pts.delete(t.identifier);
  if (_3touch.pts.size === 0 && fractal3dHandle && fractal3dHandle.endInteract) fractal3dHandle.endInteract();
}
fStage.addEventListener("touchend", end3dTouch, { passive: true });
fStage.addEventListener("touchcancel", end3dTouch, { passive: true });

// When a 2D source renders, leave 3D FIRST (capture phase, before the source's own click handler)
// so the original 2D canvas is remounted before fractal.js / the Atelier query getContext("2d").
$("fractal-render").addEventListener("click", leave3D, true);
if ($("at-draw")) $("at-draw").addEventListener("click", leave3D, true);
// (Switching sources also stops the orbit + restores the 2D canvas, folded into setSource() above.)

// ── Dimensions source (Task 8p): animated n-dimensional hypercube renderer ──
// Renders 1D–10D hypercubes into the shared #studio-canvas (plain 2D context, no WebGL swap).
// Each frame: build vertices, apply time-varying Givens rotations on multiple planes, project to 2D,
// draw edges with depth-based opacity. The live meter loop streams the perceptual readout.

let _ndimRaf = null;             // the running rAF handle (null = stopped)
let _ndimStartTime = null;       // animation start timestamp (for t parameter)
let _activeNDimKind = "cube";        // current polytope kind (chip selection)
let _activeNDimProjection = "perspective"; // current projection mode (chip selection)

// Lazy offscreen WebGL canvas for the nD renderer (GL-primary, 2D fallback).
let _ndGLCanvas = null, _ndGL = null, _ndGLTried = false;
function ndGL() {
  if (_ndGLTried) return _ndGL;
  _ndGLTried = true;
  _ndGLCanvas = document.createElement("canvas");
  const opts = { preserveDrawingBuffer: true, antialias: true, alpha: false };
  _ndGL = _ndGLCanvas.getContext("webgl", opts) || _ndGLCanvas.getContext("experimental-webgl", opts) || null;
  return _ndGL;
}

// Stop any running n-dim animation RAF. Idempotent.
function stopNDim() {
  if (_ndimRaf != null) { cancelAnimationFrame(_ndimRaf); _ndimRaf = null; }
  _ndimStartTime = null;
}
window.__studioStopNDim = stopNDim;

// Read the current control values.
function readNDimOpts() {
  const nEl = $("ndim-n"), spEl = $("ndim-speed");
  return {
    n:          Math.max(1, Math.min(10, parseInt(nEl  ? nEl.value  : "4", 10))),
    speed:      Math.max(0.1, parseFloat(spEl ? spEl.value : "1")),
    kind:       _activeNDimKind,
    projection: _activeNDimProjection,
  };
}

// Draw one frame of the n-dim animation via renderScene. t is elapsed seconds.
// Returns the scene.meta object so callers can read real vertex/edge counts.
function drawNDimFrame(canvas, n, t, speed, kind, projection) {
  // Restore 2D canvas if a WebGL orbit has been mounted (shouldn't happen here, but guard).
  leave3D();
  sizeCanvas(canvas);
  const w = canvas.width, h = canvas.height;
  const ctx = canvas.getContext("2d"); if (!ctx) return null;

  // Background: match Studio's --void palette token (#0d1b1c).
  ctx.fillStyle = "#0d1b1c";
  ctx.fillRect(0, 0, w, h);

  const scene = renderScene({
    kind,
    n: kind === "24cell" ? 4 : n,
    t: t * speed,
    rotation: "all",
    projection: { mode: projection, dist: 3 },
    scale: 0.85,
  });

  const halfW = w / 2, halfH = h / 2;
  const lineW = Math.max(0.4, 1.2 - n * 0.06);

  const gl = ndGL();
  if (gl) {
    _ndGLCanvas.width = w; _ndGLCanvas.height = h;
    drawSceneGL(gl, scene, { width: w, height: h });
    ctx.drawImage(_ndGLCanvas, 0, 0, w, h);
  } else {
    // 2D fallback (no WebGL): draw edges and vertices via the 2D context.
    ctx.save();
    ctx.lineWidth = lineW;

    // Draw edges: color + opacity from depth cue provided by renderScene.
    for (const seg of scene.segments) {
      const [r, g, b] = seg.color;
      ctx.strokeStyle = `rgba(${r},${g},${b},${seg.opacity.toFixed(3)})`;
      ctx.beginPath();
      ctx.moveTo(halfW + seg.x1 * halfW, halfH - seg.y1 * halfH);
      ctx.lineTo(halfW + seg.x2 * halfW, halfH - seg.y2 * halfH);
      ctx.stroke();
    }

    // Draw vertices as filled arcs: size + color from depth cue.
    for (const pt of scene.points) {
      const [r, g, b] = pt.color;
      ctx.fillStyle = `rgba(${r},${g},${b},${pt.opacity.toFixed(3)})`;
      const sx = halfW + pt.x * halfW;
      const sy = halfH - pt.y * halfH;
      ctx.beginPath();
      ctx.arc(sx, sy, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
  return scene.meta;
}

// Start the n-dim animation. Stops any running animation first.
function startNDimAnimation() {
  stopNDim();
  leave3D();   // restore 2D canvas if a WebGL orbit was mounted
  const canvas = $("studio-canvas");
  const { n, speed, kind, projection } = readNDimOpts();
  _ndimStartTime = null;
  let firstFrameDone = false;

  function tick(ts) {
    if (!_ndimRaf) return;   // stopped externally
    if (_ndimStartTime === null) _ndimStartTime = ts;
    const t = (ts - _ndimStartTime) / 1000;   // seconds since start

    const meta = drawNDimFrame(canvas, n, t, speed, kind, projection);

    // After the first frame, fire perception + greeting once, then start the meter loop.
    if (!firstFrameDone) {
      firstFrameDone = true;
      const obs = perceive(canvas);
      const effectiveN = kind === "24cell" ? 4 : n;
      const kindLabel = kind === "cube"
        ? (effectiveN >= 4 ? "hypercube" : "cube")
        : kind === "simplex"    ? "simplex"
        : kind === "orthoplex"  ? "cross-polytope"
        : kind === "24cell"     ? "24-cell"
        : kind;
      const vertices = meta ? meta.vertices : "?";
      const edges    = meta ? meta.edges    : "?";
      say("model",
        `A rotating ${effectiveN}D ${kindLabel}: ${vertices} vertices and ${edges} edges, `
        + `projected through ${/^[aeiou]/i.test(projection) ? "an" : "a"} ${projection} lens. `
        + `Fingerprint: ${obs.phash}.`
      );
      startMeterLoop();
    }

    _ndimRaf = requestAnimationFrame(tick);
  }
  _ndimRaf = requestAnimationFrame(tick);
}

// Wire the slider labels.
const ndimNEl    = $("ndim-n");
const ndimNVal   = $("ndim-n-val");
const ndimSpdEl  = $("ndim-speed");
const ndimSpdVal = $("ndim-speed-val");
if (ndimNEl && ndimNVal) {
  ndimNEl.addEventListener("input", () => { ndimNVal.textContent = ndimNEl.value; });
}
if (ndimSpdEl && ndimSpdVal) {
  ndimSpdEl.addEventListener("input", () => { ndimSpdVal.textContent = (+ndimSpdEl.value).toFixed(1); });
}

// Wire the Render button.
const ndimRenderBtn = $("ndim-render");
if (ndimRenderBtn) {
  ndimRenderBtn.addEventListener("click", () => {
    leave3D();   // ensure the 2D canvas is live before drawing
    startNDimAnimation();
  });
}

// Wire kind chips (#ndim-kind-* data-ndim-kind).
document.querySelectorAll("[data-ndim-kind]").forEach(btn => {
  btn.addEventListener("click", () => {
    _activeNDimKind = btn.dataset.ndimKind;
    document.querySelectorAll("[data-ndim-kind]").forEach(b => b.classList.toggle("active", b === btn));
    startNDimAnimation();
  });
});

// Wire projection chips (#ndim-proj-* data-ndim-proj).
document.querySelectorAll("[data-ndim-proj]").forEach(btn => {
  btn.addEventListener("click", () => {
    _activeNDimProjection = btn.dataset.ndimProj;
    document.querySelectorAll("[data-ndim-proj]").forEach(b => b.classList.toggle("active", b === btn));
    startNDimAnimation();
  });
});

// Expose for tests / toolbar play-pause.
window.__studioStartNDim = startNDimAnimation;
window.__studioNDimRunning = () => _ndimRaf != null;

// canvas→eye bridge (Task 7): when the Atelier finishes a drawing, perceive the shared
// canvas and let the model greet, in plain words, exactly what it measured.
document.addEventListener("atelier:drawn", e => {
  const canvas = e.detail && e.detail.canvas; if (!canvas) return;
  const obs = perceive(canvas);
  const acol = (obs.rich && obs.rich.dominantColors || []).slice(0, 3).join(", ");
  say("model", `Here's what I see in what you generated: a ${obs.width}×${obs.height} frame, `
    + `${obs.features.entropy>0.8?"richly textured":obs.features.entropy<0.45?"clean and simple":"moderately detailed"}, `
    + `${obs.features.contrast>0.66?"high-contrast":"soft"}`
    + (acol ? `, dominated by ${obs.rich.hueName} (${acol})` : ``)
    + `. My fingerprint of it is ${obs.phash}. Where shall we take it?`);
  startMeterLoop();   // a static generated frame; the loop runs briefly then self-idles
});

// ══ The witnessed certificate (verdict-diff) + append-only audit trail ════════════════════════════
// Surfaces certificate.js as a one-click, scannable verdict ABOVE the prose, and appends every issued
// certificate and operator action to an IndexedDB append-only log (audit-log.js). The certificate is
// built from the REAL Atelier reconcile verdict via the deterministic structuralOracle (never faked):
// the named criterion is "every reconcile axis clears its structural floor"; the artifact is the live
// per-axis margins; the reconcile's own pass/refine tag rides along as the advisory model surrogate.

const CERT_FLOOR = 0.45;   // the per-axis structural floor each reconcile margin must clear to verify.
let _certLog = null;       // the opened append-only audit log handle (null until openLog resolves).
let _lastCert = null;      // the certificate currently rendered (the one operator actions stamp).

// Map a reconcile verdict { margins, cohesion, weakest, tag, axes } to a real certificate.js certificate.
// structuralOracle is the deterministic, certifying oracle: it refutes naming exactly which axis fell
// below the floor, so the failure is itself inspectable. The reconcile tag is advisory-only (surrogate).
function certificateFromReconcile(v) {
  if (!v || !v.margins) return null;
  const axes = Array.isArray(v.axes) ? v.axes : Object.keys(v.margins);
  const ranges = {};
  for (const a of axes) ranges[a] = [CERT_FLOOR, 1];
  const oracle = structuralOracle(v.margins, { required: axes, ranges });
  // The reconcile's coarse tag ("pass"/"refine"/...) is a model-side read: carry it as a surrogate
  // (oracle=model, never certified) so an oracle-vs-surrogate split surfaces as "disputed", not hidden.
  const surrogateVerdict = v.tag === "pass" ? "verified" : v.tag === "refine" ? "refuted" : null;
  const surrogate = surrogateVerdict
    ? cognitiveOracle(surrogateVerdict, `reconcile tag=${v.tag}, cohesion=${(+v.cohesion).toFixed(3)}`)
    : null;
  return buildCertificate({
    criterion: `every reconcile axis clears the structural floor (>= ${CERT_FLOOR})`,
    claim: `structurally coherent across ${axes.length} axes; cohesion ${(+v.cohesion).toFixed(3)}`,
    oracleVerdict: oracle,
    surrogateVerdict: surrogate,
    haltReason: v.weakest ? `weakest-axis:${v.weakest}` : null,
    evidence: [["cohesion", (+v.cohesion).toFixed(4)], ["weakest_axis", String(v.weakest || "none")]],
  });
}

// Open the append-only audit log once (browser only). Failure is non-fatal: the certificate still
// renders, the trail just notes it is unavailable (e.g. private-mode IndexedDB block).
async function ensureCertLog() {
  if (_certLog) return _certLog;
  try { _certLog = await openLog(); } catch (e) { _certLog = null; }
  return _certLog;
}

// Append an entry to the audit trail (issue or operator action) with a caller-supplied timestamp, then
// refresh the rendered list. Appends never overwrite (audit-log is add-only). All guarded; never throws.
async function appendAudit(cert, operatorAction) {
  const entry = { certificate: cert, timestamp: Date.now(), operatorAction: operatorAction || "" };
  const log = await ensureCertLog();
  if (log) { try { await log.append(entry); } catch (_) {} }
  else { _localAudit.push(normaliseEntry(entry)); }   // in-memory fallback so the trail still shows
  await refreshAuditList();
}

// An in-memory mirror used only when IndexedDB is unavailable, so the panel can still replay the trail.
const _localAudit = [];

// Render the audit trail list, newest first. Reads the persisted log when present, else the mirror.
async function refreshAuditList() {
  const listEl = $("cert-audit-list"), countEl = $("cert-audit-count");
  if (!listEl) return;
  let entries = [];
  const log = await ensureCertLog();
  if (log) { try { entries = await log.replay(); } catch (_) { entries = []; } }
  else entries = orderEntries(_localAudit);
  listEl.textContent = "";
  if (countEl) countEl.textContent = entries.length ? `${entries.length} stamped` : "";
  if (!entries.length) {
    const empty = document.createElement("p");
    empty.className = "cert-audit-empty";
    empty.textContent = "No certificates issued yet.";
    listEl.appendChild(empty);
    return;
  }
  // newest first for reading; the store itself stays append-only oldest-to-newest.
  for (const en of entries.slice().reverse()) listEl.appendChild(auditRow(en));
}

// One audit row: timestamp, criterion, verdict chip, and the operator action (if any). Nodes only.
function auditRow(en) {
  const row = document.createElement("div");
  row.className = "cert-audit-row";
  const ts = document.createElement("span");
  ts.className = "cert-audit-ts";
  ts.textContent = typeof en.timestamp === "number" ? new Date(en.timestamp).toLocaleTimeString() : String(en.timestamp || "?");
  const crit = document.createElement("span");
  crit.className = "cert-audit-crit";
  crit.textContent = (en.verdict || "unverifiable") + (en.criterion ? " · " + en.criterion : "");
  crit.title = en.criterion || "";
  const act = document.createElement("span");
  act.className = "cert-audit-act";
  act.dataset.verdict = en.verdict || "unverifiable";
  act.textContent = en.operatorAction ? en.operatorAction : "issued";
  row.appendChild(ts); row.appendChild(crit); row.appendChild(act);
  return row;
}

// Issue + render a certificate, and append the issuance to the audit trail. The verdict-diff renders
// in #cert-render; operator accept/reject/dispute appends a stamped entry. announce() routes to #status
// if present, else the chat is the live region the user already watches.
function issueCertificate(cert) {
  const container = $("cert-render");
  if (!container || !cert) return;
  _lastCert = cert;
  renderCertificate(container, cert, {
    onAction: (actionKey, c) => { appendAudit(c, actionKey); },
    announce: msg => { const s = $("status"); if (s) s.textContent = msg; },
  });
  const note = $("cert-note");
  if (note) note.textContent = cert.certified
    ? "This verdict was driven by a deterministic check, not the model. Re-derive it above to reproduce it yourself."
    : "Unverifiable or advisory: no deterministic check certified this. The model's read is carried, never mistaken for proof.";
  appendAudit(cert, "");   // stamp the issuance itself (operatorAction empty) onto the append-only trail
}

// When the Atelier settles a drawing, issue a certificate from its real reconcile verdict.
document.addEventListener("atelier:drawn", e => {
  const v = e.detail && e.detail.verdict;
  const cert = certificateFromReconcile(v);
  if (cert) issueCertificate(cert);
});

// Initialise the panel at boot: an honest empty state + the (possibly empty) audit trail.
(function initCertificatePanel() {
  const container = $("cert-render");
  if (container) renderCertificate(container, null);
  refreshAuditList();
})();

// Test / Playwright hooks: drive the panel without a full Atelier draw, and read the trail.
window.__studioIssueCert = issueCertificate;
window.__studioCertFromReconcile = certificateFromReconcile;
window.__studioAuditList = async () => {
  const log = await ensureCertLog();
  if (log) { try { return await log.replay(); } catch (_) { return []; } }
  return orderEntries(_localAudit);
};

// ── BYO mode (Task 8) ─────────────────────────────────────────────────────
// "Bring your own": upload a photo/gif/video onto the shared #studio-canvas,
// then transform it taking turns with the model. Reuses perceive() and say()
// from the orchestrator above (same module scope, no duplication).

function byoCanvas() { return $("studio-canvas"); }
function byoCtx() { return byoCanvas().getContext("2d", { willReadFrequently: true }); }
let byoVideo = null;   // a played <video> from a dropped file; the live loop blits its frames
let _studioLastMesh = null;  // geometry stashed from the last 3D import; used by export controls

// Stop + release a played BYO video (file change / mode switch / leaving). Detaches its audio.
function stopByoVideo() {
  if (byoVideo) { try { byoVideo.pause(); } catch (e) {} if (byoVideo.src) { try { URL.revokeObjectURL(byoVideo.src); } catch (e) {} } byoVideo = null; }
  detachAudio();
}
window.__studioStopByoVideo = stopByoVideo;

// Scale src (HTMLImageElement or HTMLVideoElement) to the hi-DPI backing size, then draw.
// The canvas CSS layout size is preserved by sizeCanvas(); we draw the source stretched to fill it.
function drawSource(src, sw, sh) {
  const c = byoCanvas();
  // Size the canvas backing to hi-DPI resolution; the CSS layout size already constrains the display.
  // If the canvas has no CSS size yet (before layout), fall back to fitting within maxBacking.
  const rect = c.getBoundingClientRect ? c.getBoundingClientRect() : null;
  const hasCss = rect && rect.width > 0 && rect.height > 0;
  if (hasCss) {
    sizeCanvas(c);
  } else {
    // Pre-layout fallback: fit the source within maxBacking, preserving aspect.
    const mb = currentQuality().maxBacking;
    const s = Math.min(1, mb / Math.max(sw, sh));
    c.width = Math.max(1, Math.round(sw * s));
    c.height = Math.max(1, Math.round(sh * s));
  }
  byoCtx().drawImage(src, 0, 0, c.width, c.height);
}

// Load a File, draw its first frame onto #studio-canvas, then perceive + greet.
// Routes through StudioImporters.importFile for universal format support (image, video, SVG,
// OBJ, GLTF, PLY, audio, data). Calls leave3D() first so any previous WebGL canvas is
// remounted as 2D before we draw.
async function loadFile(file) {
  leave3D();
  stopByoVideo();   // release any previously played video first
  _studioLastMesh = null;  // clear previous geometry before loading new file

  const result = await StudioImporters.importFile(file, byoCanvas());

  if (!result.drewToCanvas) {
    say("model", "Unknown file type: " + (result.meta && result.meta.ext ? result.meta.ext : file.type)
      + ". Drop an image, video, audio, OBJ, GLTF, PLY, CSV, or JSON file.");
    return;
  }

  // Video: wire play + audio meters using the element the importer created.
  if (result.kind === "video" && result.meta && result.meta.videoEl) {
    byoVideo = result.meta.videoEl;
    byoVideo.play().catch(() => {
      byoVideo.muted = true; byoVideo.play().catch(() => {});
    });
    attachAudio(byoVideo);
    startMeterLoop();
    if (typeof window.__studioExportWebmVisible === "function") window.__studioExportWebmVisible(true);
  }

  // Geometry: stash for export and surface the geometry export buttons.
  if (result.mesh) {
    _studioLastMesh = result.mesh;
    if (typeof window.__studioExportMeshVisible === "function") window.__studioExportMeshVisible(true);
  }

  const obs = perceive(byoCanvas());
  say("model", "Loaded " + result.kind + " • " + (result.meta && result.meta.name ? result.meta.name : file.name)
    + ". Fingerprint " + obs.phash + ".");
  startMeterLoop();
}

// Pixel-level transforms operating on ImageData from the shared canvas.
// "mirror" and "edges" require slightly different handling and are added below.
const TF = {
  grayscale: d => { for (let i = 0; i < d.length; i += 4) { const g = (d[i]*299 + d[i+1]*587 + d[i+2]*114) / 1000; d[i] = d[i+1] = d[i+2] = g; } },
  invert:    d => { for (let i = 0; i < d.length; i += 4) { d[i] = 255-d[i]; d[i+1] = 255-d[i+1]; d[i+2] = 255-d[i+2]; } },
  threshold: d => { for (let i = 0; i < d.length; i += 4) { const g = (d[i]*299 + d[i+1]*587 + d[i+2]*114) / 1000 > 127 ? 255 : 0; d[i] = d[i+1] = d[i+2] = g; } },
  posterize: d => { const q = v => Math.round(v / 85) * 85; for (let i = 0; i < d.length; i += 4) { d[i] = q(d[i]); d[i+1] = q(d[i+1]); d[i+2] = q(d[i+2]); } },
};

// Mirror is a geometry transform (horizontal flip via canvas scale trick).
function applyMirror() {
  const c = byoCanvas(), ctx = byoCtx();
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const off = document.createElement("canvas"); off.width = c.width; off.height = c.height;
  const octx = off.getContext("2d"); octx.putImageData(img, 0, 0);
  ctx.save(); ctx.translate(c.width, 0); ctx.scale(-1, 1); ctx.drawImage(off, 0, 0); ctx.restore();
}

// Sobel edge detection (standard 3x3 gx/gy kernels).
function applyEdges() {
  const c = byoCanvas(), ctx = byoCtx();
  const src = ctx.getImageData(0, 0, c.width, c.height);
  const w = c.width, h = c.height, d = src.data;
  const out = ctx.createImageData(w, h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const luma = (r, g, b) => (r*299 + g*587 + b*114) / 1000;
      const px = (dx, dy) => { const i = ((y+dy)*w + (x+dx)) * 4; return luma(d[i], d[i+1], d[i+2]); };
      const sx = -px(-1,-1) - 2*px(-1,0) - px(-1,1) + px(1,-1) + 2*px(1,0) + px(1,1);
      const sy = -px(-1,-1) - 2*px(0,-1) - px(1,-1) + px(-1,1) + 2*px(0,1) + px(1,1);
      const m = Math.min(255, Math.hypot(sx, sy));
      const i = (y*w + x) * 4; out.data[i] = out.data[i+1] = out.data[i+2] = m; out.data[i+3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
}

// Topography transform: hillshade, contours, or oblique 2.5D terrain.
function applyTopography() {
  leave3D();
  const c = byoCanvas(), ctx = byoCtx();
  const w = c.width, h = c.height;
  const src = ctx.getImageData(0, 0, w, h);
  const d = src.data;
  const out = ctx.createImageData(w, h);
  const od = out.data;

  const mode = $("topo-mode").value;
  const azimuth = parseFloat($("topo-azimuth").value);
  const exaggeration = parseFloat($("topo-exaggeration").value);
  const interval = parseInt($("topo-interval").value, 10);

  // Helper: get luma at (x, y), clamping to edge (mirror border).
  const luma = (x, y) => {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    const i = (cy * w + cx) * 4;
    return (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
  };

  // Hillshade: compute shaded-relief shade value (0-1) for pixel (x, y).
  const hillshadeShade = (x, y) => {
    const dzdx = (luma(x + 1, y) - luma(x - 1, y)) * exaggeration;
    const dzdy = (luma(x, y + 1) - luma(x, y - 1)) * exaggeration;
    const nx = -dzdx, ny = -dzdy, nz = 1;
    const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    const nnx = nx / len, nny = ny / len, nnz = nz / len;
    const az_rad = (azimuth - 90) * Math.PI / 180;
    const alt_rad = 45 * Math.PI / 180;
    const lx = Math.cos(alt_rad) * Math.cos(az_rad);
    const ly = Math.cos(alt_rad) * Math.sin(az_rad);
    const lz = Math.sin(alt_rad);
    return Math.max(0, Math.min(1, nnx * lx + nny * ly + nnz * lz));
  };

  if (mode === "hillshade") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const shade = hillshadeShade(x, y);
        const v = Math.round(shade * 255);
        const i = (y * w + x) * 4;
        od[i] = od[i + 1] = od[i + 2] = v; od[i + 3] = 255;
      }
    }
  } else if (mode === "contours") {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const b = Math.floor(luma(x, y) / 256 * interval);
        const br = Math.floor(luma(x + 1, y) / 256 * interval);
        const bd = Math.floor(luma(x, y + 1) / 256 * interval);
        const isEdge = (b !== br) || (b !== bd);
        const v = isEdge ? 40 : 240;
        const i = (y * w + x) * 4;
        od[i] = od[i + 1] = od[i + 2] = v; od[i + 3] = 255;
      }
    }
  } else {
    // Oblique: 2.5D painter's algorithm, back-to-front (top row = back).
    // Fill with light background first.
    for (let i = 0; i < od.length; i += 4) { od[i] = od[i + 1] = od[i + 2] = 220; od[i + 3] = 255; }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const lval = luma(x, y);
        const shade = hillshadeShade(x, y);
        const vert_offset = Math.round((lval / 255) * exaggeration * h * 0.12);
        const oy = y - vert_offset;
        if (oy >= 0 && oy < h) {
          const v = Math.round(shade * 255);
          const i = (oy * w + x) * 4;
          od[i] = od[i + 1] = od[i + 2] = v; od[i + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(out, 0, 0);
}

// Apply a named transform, re-perceive, say what changed, flip the turn indicator.
function applyTransform(key, who) {
  if (key === "mirror") { applyMirror(); }
  else if (key === "edges") { applyEdges(); }
  else if (key === "topography") { applyTopography(); }
  else { const img = byoCtx().getImageData(0, 0, byoCanvas().width, byoCanvas().height); TF[key](img.data); byoCtx().putImageData(img, 0, 0); }
  const obs = perceive(byoCanvas());
  say(who, `${who === "you" ? "You" : "I"} ran ${key}. Now ${obs.phash}.`);
  $("studio-turn").textContent = who === "you" ? "the model's turn" : "your turn";
}

// Wire the drop zone, file input, and transform buttons.
$("studio-drop").addEventListener("click", () => $("studio-file").click());
$("studio-drop").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("studio-file").click(); } });
$("studio-drop").addEventListener("dragover", e => { e.preventDefault(); $("studio-drop").classList.add("over"); });
$("studio-drop").addEventListener("dragleave", () => $("studio-drop").classList.remove("over"));
$("studio-drop").addEventListener("drop", e => { e.preventDefault(); $("studio-drop").classList.remove("over"); if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });
$("studio-file").addEventListener("change", e => { if (e.target.files[0]) loadFile(e.target.files[0]); });

// Build transform buttons from TF keys + the geometry + topography transforms.
["grayscale", "invert", "threshold", "posterize", "mirror", "edges", "topography"].forEach(k => {
  const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = k;
  b.addEventListener("click", () => applyTransform(k, "you"));
  $("studio-transforms").appendChild(b);
});

// Topography controls: update display spans and re-run if canvas is loaded.
function topoHasCanvas() { return $("sc-phash").textContent !== "—"; }

$("topo-azimuth").addEventListener("input", () => {
  $("topo-az-val").textContent = $("topo-azimuth").value;
  if (topoHasCanvas()) { applyTopography(); const obs = perceive(byoCanvas()); say("model", "Azimuth updated. Now " + obs.phash + "."); }
});
$("topo-exaggeration").addEventListener("input", () => {
  $("topo-ex-val").textContent = $("topo-exaggeration").value;
  if (topoHasCanvas()) { applyTopography(); const obs = perceive(byoCanvas()); say("model", "Exaggeration updated. Now " + obs.phash + "."); }
});
$("topo-interval").addEventListener("input", () => {
  $("topo-iv-val").textContent = $("topo-interval").value;
  if (topoHasCanvas()) { applyTopography(); const obs = perceive(byoCanvas()); say("model", "Contour interval updated. Now " + obs.phash + "."); }
});
$("topo-mode").addEventListener("change", () => {
  if (topoHasCanvas()) { applyTopography(); const obs = perceive(byoCanvas()); say("model", "Mode switched to " + $("topo-mode").value + ". Now " + obs.phash + "."); }
});

// ── Watch with me (Task 8c) ──────────────────────────────────────────────
// Screen-share or camera → hidden <video> → sample loop → canvas → perceive()
// Nothing leaves the browser. The model sees only what you explicitly share.

let watchStream = null;
let watchInterval = null;
let watchActive = false;

const watchVideo = $("watch-video");

function stopWatch() {
  if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
  watchActive = false;
  const toggleBtn = $("watch-toggle");
  if (toggleBtn) { toggleBtn.textContent = "Watch together"; toggleBtn.setAttribute("aria-pressed", "false"); }
  if (watchStream) {
    watchStream.getTracks().forEach(t => t.stop());
    watchStream = null;
  }
  watchVideo.srcObject = null;
  watchVideo.hidden = true;
  const live = $("studio-watch-live");
  if (live) live.hidden = true;
  const status = $("watch-status");
  if (status) status.textContent = "";
  detachAudio();      // drop the audio tap + idle the audio meters
  stopMeterLoop();    // stop streaming when the capture ends
}

function sampleFrame() {
  if (!watchStream || !watchVideo.videoWidth) return;
  leave3D();
  const c = byoCanvas();
  drawSource(watchVideo, watchVideo.videoWidth, watchVideo.videoHeight);
  const obs = perceive(c);
  const driftEl = $("sc-drift");
  let driftNote;
  if (!driftEl || driftEl.hidden) {
    driftNote = "first frame";
  } else {
    const driftText = driftEl.textContent || "";
    if (driftText.includes("unchanged")) {
      driftNote = "nearly the same";
    } else {
      const m = driftText.match(/moved\s+(\d+)\/64/);
      const d = m ? parseInt(m[1], 10) : 0;
      if (d > 20) driftNote = "the scene moved a lot";
      else if (d > 8) driftNote = "the scene moved";
      else driftNote = "nearly the same";
    }
  }
  say("model", driftNote + ". Fingerprint " + obs.phash + ", contrast " + fmt(obs.features.contrast) + ", structure " + fmt(obs.features.entropy) + ".");
}

async function startCapture(mode) {
  stopWatch(); // clean up any previous session
  try {
    // Request audio too (tab/system audio on screen share, the mic on camera) so the audio meters
    // have a real source when the user opts to share it. The browser still gates each with a prompt.
    const stream = mode === "screen"
      ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      : await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    watchStream = stream;
    watchVideo.srcObject = stream;
    watchVideo.hidden = false;
    const live = $("studio-watch-live");
    if (live) live.hidden = false;
    const status = $("watch-status");
    if (status) status.textContent = mode === "screen" ? "screen shared" : "camera live";
    // If the user closes the stream from the browser's native UI, stop cleanly.
    stream.getTracks().forEach(t => { t.addEventListener("ended", stopWatch); });
    // Stream the meters live off the capture, and tap its audio if it carries any.
    startMeterLoop();
    const hasAudio = stream.getAudioTracks && stream.getAudioTracks().length > 0;
    if (hasAudio) attachAudio(stream);
    say("model", (mode === "screen"
      ? "I can see your screen now."
      : "Camera is live.")
      + (hasAudio ? " I can hear it too, and the audio meters are live." : "")
      + " The measurimeter is streaming. Hit 'See this moment' for a snapshot reading.");
  } catch (err) {
    const msg = err && err.name === "NotAllowedError"
      ? "your browser blocked it. You can still upload a file in the drop zone above."
      : err && err.name === "NotSupportedError"
        ? "screen / camera capture isn't supported in this browser. You can still upload a file."
        : "couldn't start the capture (" + (err && err.message ? err.message : String(err)) + "). Try uploading a file instead.";
    say("model", msg);
  }
}

if ($("watch-screen")) {
  $("watch-screen").addEventListener("click", () => startCapture("screen"));
}
if ($("watch-camera")) {
  $("watch-camera").addEventListener("click", () => startCapture("camera"));
}
if ($("watch-snap")) {
  $("watch-snap").addEventListener("click", () => {
    if (!watchStream) { say("model", "No active capture. Share your screen or camera first."); return; }
    sampleFrame();
  });
}
if ($("watch-toggle")) {
  $("watch-toggle").addEventListener("click", () => {
    if (!watchStream) { say("model", "No active capture. Share your screen or camera first."); return; }
    watchActive = !watchActive;
    $("watch-toggle").setAttribute("aria-pressed", String(watchActive));
    if (watchActive) {
      $("watch-toggle").textContent = "Stop watching";
      sampleFrame(); // immediate first sample
      watchInterval = setInterval(sampleFrame, 1200);
    } else {
      $("watch-toggle").textContent = "Watch together";
      if (watchInterval) { clearInterval(watchInterval); watchInterval = null; }
    }
  });
}
if ($("watch-stop")) {
  $("watch-stop").addEventListener("click", stopWatch);
}

// (Switching sources releases the capture stream + any played video and stops streaming, folded
//  into setSource() above, so it fires for every source change, not just the old 2-way mode switch.)

// Expose for tests
window.__studioStopWatch = stopWatch;
window.__studioStartCapture = startCapture;
window.__studioSampleFrame = sampleFrame;

// ══ The MEASURIMETER (Task 8d) ═══════════════════════════════════════════════
// A live instrument panel of every channel the tooling feeds the model: the faithful n×n
// representation, per-channel meters, dominant-colour swatches, a frame-to-frame motion sparkline,
// and (when the source has sound) audio level / spectrum / pitch. The numbers shown ARE the numbers
// the model is given; the panel is the honest "this is everything it senses right now". The visual
// readout STREAMS via one throttled rAF loop while a source animates, so the hash changes as the
// model "moves"; the model's CHAT stays tied to a snapshot (the existing say() greetings).

const MOSAIC_N = 32;                  // faithful downsample resolution (modest, per the brief)
const MOTION_LEN = 96;               // sparkline history length
const motionHist = new Array(MOTION_LEN).fill(0);
let lastRich = null;                 // last richFeatures bundle (for greetings)

// ── visual meters: build the rows once, then update values cheaply each tick ──
const VISUAL_CHANNELS = [
  ["contrast", "contrast", false],
  ["structure", "structure", false],
  ["balance", "balance", false],
  ["coverage", "coverage", false],
  ["edge density", "edge", true],
  ["light", "light", false],
  ["dark", "dark", true],
  ["motion", "motion", true],
];
const meterEls = {};
function buildMeters() {
  const host = $("mm-visual"); if (!host || host.childElementCount) return;
  for (const [label, key, warm] of VISUAL_CHANNELS) {
    const row = document.createElement("div"); row.className = "mm-meter";
    const name = document.createElement("span"); name.className = "mm-mname"; name.textContent = label;
    const track = document.createElement("span"); track.className = "mm-track";
    const fill = document.createElement("span"); fill.className = "mm-fill" + (warm ? " mm-warm" : "");
    track.appendChild(fill);
    const val = document.createElement("span"); val.className = "mm-mval"; val.textContent = "—";
    row.appendChild(name); row.appendChild(track); row.appendChild(val);
    host.appendChild(row);
    meterEls[key] = { fill, val };
  }
}
function setMeter(key, frac, text) {
  const m = meterEls[key]; if (!m) return;
  m.fill.style.width = Math.max(0, Math.min(1, frac)) * 100 + "%";
  m.val.textContent = text;
}

// ── the faithful representation mosaic: box-average → n×n, painted enlarged ──
function paintMosaic(px, w, h) {
  const c = $("mm-mosaic"); if (!c) return;
  const { grid } = representation({ data: px, width: w, height: h }, MOSAIC_N);
  const ctx = c.getContext("2d"); if (!ctx) return;
  // paint into an n×n offscreen then scale up with nearest-neighbour (image-rendering:pixelated).
  const n = MOSAIC_N, img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    const [r, g, b] = grid[y][x], i = (y * n + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
  }
  if (c.width !== n) { c.width = n; c.height = n; }   // back the canvas at native n×n; CSS scales it up
  ctx.putImageData(img, 0, 0);
}

// ── dominant-colour swatches ─────────────────────────────────────────────────
function paintSwatches(rich) {
  const host = $("mm-swatches"); if (!host) return;
  const sw = rich.dominantSwatches || [];
  if (!sw.length) { host.className = "mm-swatches mm-empty"; host.innerHTML = ""; return; }
  host.className = "mm-swatches";
  host.innerHTML = "";
  for (const s of sw) {
    const el = document.createElement("span"); el.className = "mm-sw";
    el.style.background = s.hex; el.title = `${s.hex} · ${(s.frac * 100).toFixed(0)}%`;
    const f = document.createElement("span"); f.className = "mm-swf"; f.textContent = (s.frac * 100).toFixed(0) + "%";
    el.appendChild(f); host.appendChild(el);
  }
}

// ── motion sparkline: push the latest frame-to-frame Δ (hamming/64), draw the history ──
function pushMotion(deltaFrac) {
  motionHist.push(deltaFrac); motionHist.shift();
  const c = $("mm-motion"); if (!c) return;
  const ctx = c.getContext("2d"); if (!ctx) return;
  const W = c.width, H = c.height;
  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = "rgba(95,174,147,.85)"; ctx.lineWidth = 1.5; ctx.beginPath();
  for (let i = 0; i < motionHist.length; i++) {
    const x = i / (motionHist.length - 1) * W;
    const y = H - Math.max(0, Math.min(1, motionHist[i])) * (H - 3) - 1.5;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// ── measure(): the rich readout for a frame already read into `px`. Called from perceive() and the
// live loop. Updates the mosaic, meters, swatches, describe line, motion sparkline. Returns the
// rich-features bundle so greetings can name a dominant colour + texture. NEVER calls say().
let lastMeterPhash = null;
function measure(px, w, h, phash) {
  const rich = richFeatures(px, w, h, 4);
  const f = features(px, w, h, 4);   // re-derive the gated advisory metrics for the meter bars
  lastRich = rich;
  buildMeters();
  paintMosaic(px, w, h);
  paintSwatches(rich);
  setMeter("contrast", f.contrast, fmt(f.contrast, 2));
  setMeter("structure", f.entropy, fmt(f.entropy, 2));
  setMeter("balance", f.balance, fmt(f.balance, 2));
  setMeter("coverage", f.coverage, fmt(f.coverage, 2));
  setMeter("edge", rich.edgeDensity, fmt(rich.edgeDensity, 2));
  setMeter("light", rich.lightRegions, fmt(rich.lightRegions, 2));
  setMeter("dark", rich.darkRegions, fmt(rich.darkRegions, 2));
  // motion: Δ vs the previous measured frame (perceptual distance / 64)
  let deltaFrac = 0;
  if (lastMeterPhash != null && phash) deltaFrac = hamming(lastMeterPhash, phash) / 64;
  lastMeterPhash = phash;
  pushMotion(deltaFrac);
  setMeter("motion", deltaFrac, Math.round(deltaFrac * 64) + "/64");
  const desc = $("mm-describe"); if (desc) desc.textContent = describeFrame(rich);
  // metadata channels (dimensions, orientation, source kind, fps)
  paintMeta(w, h, rich);
  return rich;
}

// ── metadata / structured channels ───────────────────────────────────────────
let liveFps = 0;
function paintMeta(w, h, rich) {
  const host = $("mm-meta"); if (!host) return;
  const rows = [
    ["dimensions", `${w}×${h}`],
    ["orientation", `${rich.orientation} (${rich.aspect.toFixed(2)}:1)`],
    ["source", currentSourceLabel()],
    ["fps", liveLoopRunning ? (liveFps ? liveFps.toFixed(0) : "…") : "static"],
  ];
  host.innerHTML = "";
  for (const [k, v] of rows) {
    const row = document.createElement("div"); row.className = "mm-meter";
    const name = document.createElement("span"); name.className = "mm-mname"; name.textContent = k;
    const val = document.createElement("span"); val.className = "mm-mval"; val.textContent = v;
    row.appendChild(name); row.appendChild(val); host.appendChild(row);
  }
}
function currentSourceLabel() {
  if (watchStream) return "screen/camera";
  if (canvasIsGL && !glFractal2D) return "3D fractal";
  if (activeSource === "fractal") return "2D fractal";
  if (activeSource === "ndim") return "n-dim hypercube";
  if (activeSource === "music") return "music reactive";
  if (mode === "byo") return "your media";
  return "the Atelier / 2D";
}

// ── the live loop: ONE throttled rAF, cancellable, never stacked. Re-perceives the active canvas
// while a source animates (3D orbit / playing video / capture). Pauses (stops) when the frame goes
// static so we don't spin the CPU on a still frame; restarts on the next source change. The model's
// chat is untouched; this only streams the meters + #sc-phash/#sc-feats. ───────────────────────
let liveRaf = null;
let liveLoopRunning = false;
const LIVE_HZ = 12, LIVE_MS = 1000 / LIVE_HZ;
let lastTickTs = 0, lastLoopPhash = null, staticTicks = 0, fpsAcc = 0, fpsCount = 0, fpsTs = 0;
const STATIC_STOP = 18;   // ~1.5s of an unchanging frame → idle the loop

function liveTick(ts) {
  if (!liveLoopRunning) return;
  liveRaf = requestAnimationFrame(liveTick);
  if (ts - lastTickTs < LIVE_MS) return;          // throttle to ~LIVE_HZ
  lastTickTs = ts;
  const canvas = $("studio-canvas"); if (!canvas || !canvas.width) return;
  // A played video / live capture updates the canvas only if we blit each frame onto it here.
  // (The 3D orbit paints the canvas itself; an image is static.)
  const liveVid = (watchStream && watchVideo && watchVideo.videoWidth) ? watchVideo
    : (byoVideo && !byoVideo.paused && byoVideo.videoWidth) ? byoVideo : null;
  if (liveVid && !canvasIsGL) {
    try { drawSource(liveVid, liveVid.videoWidth, liveVid.videoHeight); } catch (e) {}
  }
  let px, phash;
  try {
    const w = canvas.width, h = canvas.height;
    px = readPixelData(canvas, w, h);
    phash = perceptualHash(px, w, h, 4);
    // stream the cheap line + the full measurimeter (no say(), no drift mutation)
    $("sc-phash").textContent = phash;
    measure(px, w, h, phash);
    pollAudio();
  } catch (e) { /* a transient unreadable frame (e.g. canvas swap mid-tick), skip this tick */ return; }
  // fps estimate over a 0.5s window
  fpsCount++; if (!fpsTs) fpsTs = ts; if (ts - fpsTs >= 500) { liveFps = fpsCount * 1000 / (ts - fpsTs); fpsCount = 0; fpsTs = ts; }
  // static detection: idle the loop after a stretch of identical frames, but ONLY for static
  // sources. An animated source (3D orbit / n-dim / music / capture / playing video) can briefly
  // repeat a hash; halting there freezes the readout. sourceIsAnimated() is the invariant that
  // stops that whole recurring class. (studio-loop.js, node-tested.)
  if (phash === lastLoopPhash) {
    if (++staticTicks >= STATIC_STOP) {
      const animated = sourceIsAnimated(activeSource, { canvasIsGL, byoPlaying: !!(byoVideo && !byoVideo.paused) });
      if (shouldHaltOnStatic(true, animated)) { stopMeterLoop(); return; }
      staticTicks = 0;   // animated: do not halt, but reset so we re-arm the window cleanly
    }
  }
  else { staticTicks = 0; lastLoopPhash = phash; }
}
function startMeterLoop() {
  if (liveLoopRunning) return;                    // never stack
  if (typeof requestAnimationFrame !== "function") return;  // node / no-rAF env
  liveLoopRunning = true; staticTicks = 0; lastLoopPhash = null; lastTickTs = 0; fpsTs = 0; fpsCount = 0;
  const live = $("mm-live"); if (live) live.hidden = false;
  liveRaf = requestAnimationFrame(liveTick);
}
function stopMeterLoop() {
  liveLoopRunning = false;
  if (liveRaf != null) { cancelAnimationFrame(liveRaf); liveRaf = null; }
  liveFps = 0;
  const live = $("mm-live"); if (live) live.hidden = true;
}
window.__studioStartMeterLoop = startMeterLoop;
window.__studioStopMeterLoop = stopMeterLoop;
window.__studioMeasure = measure;
window.__studioLiveState = () => ({ running: liveLoopRunning, staticTicks, fps: liveFps });

// ══ Audio channels (Task 8d step 3) ══════════════════════════════════════════
// Tap a media element or stream with the Web Audio API → AnalyserNode → live level (RMS), a few
// frequency bands, and a rough pitch. No audio source → the meters read "—" honestly (not faked).
let audioCtx = null, analyser = null, audioSrcNode = null, audioTimeBuf = null, audioFreqBuf = null;
let audioAttached = false;

function buildAudioMeters() {
  const host = $("mm-audio"); if (!host || host.childElementCount) return;
  // level
  const lvl = document.createElement("div"); lvl.className = "mm-meter";
  const ln = document.createElement("span"); ln.className = "mm-mname"; ln.textContent = "level";
  const lt = document.createElement("span"); lt.className = "mm-track";
  const lf = document.createElement("span"); lf.className = "mm-fill mm-warm"; lf.id = "mm-au-level";
  lt.appendChild(lf);
  const lv = document.createElement("span"); lv.className = "mm-mval"; lv.id = "mm-au-level-v"; lv.textContent = "—";
  lvl.appendChild(ln); lvl.appendChild(lt); lvl.appendChild(lv); host.appendChild(lvl);
  // spectrum
  const sp = document.createElement("div"); sp.className = "mm-meter";
  const sn = document.createElement("span"); sn.className = "mm-mname"; sn.textContent = "spectrum";
  const sb = document.createElement("span"); sb.className = "mm-spectrum"; sb.id = "mm-au-spectrum";
  for (let i = 0; i < 32; i++) { const b = document.createElement("span"); b.className = "mm-bar"; sb.appendChild(b); }
  const sv = document.createElement("span"); sv.className = "mm-mval"; sv.textContent = "";
  sp.appendChild(sn); sp.appendChild(sb); sp.appendChild(sv); host.appendChild(sp);
  // pitch
  const pt = document.createElement("div"); pt.className = "mm-meter";
  const pn = document.createElement("span"); pn.className = "mm-mname"; pn.textContent = "pitch";
  const pp = document.createElement("span"); pp.className = "mm-track";
  const pf = document.createElement("span"); pf.className = "mm-fill"; pf.id = "mm-au-pitch"; pp.appendChild(pf);
  const pv = document.createElement("span"); pv.className = "mm-mval"; pv.id = "mm-au-pitch-v"; pv.textContent = "—";
  pt.appendChild(pn); pt.appendChild(pp); pt.appendChild(pv); host.appendChild(pt);
}
function audioMetersIdle() {
  buildAudioMeters();
  const lf = $("mm-au-level"), lv = $("mm-au-level-v"), pf = $("mm-au-pitch"), pv = $("mm-au-pitch-v");
  if (lf) lf.style.width = "0%"; if (lv) lv.textContent = "—";
  if (pf) pf.style.width = "0%"; if (pv) pv.textContent = "—";
  const sp = $("mm-au-spectrum"); if (sp) sp.querySelectorAll(".mm-bar").forEach(b => b.style.height = "2%");
}

// Attach audio from an <audio>/<video> element OR a MediaStream (with audio tracks). Idempotent-ish:
// detaches a prior source first. Returns true if an analyser is now wired.
function attachAudio(source) {
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    detachAudio();
    audioCtx = audioCtx || new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    if (source instanceof MediaStream) {
      if (!source.getAudioTracks || source.getAudioTracks().length === 0) return false;
      audioSrcNode = audioCtx.createMediaStreamSource(source);
    } else if (source && source.tagName) {  // a media element
      audioSrcNode = audioCtx.createMediaElementSource(source);
      audioSrcNode.connect(audioCtx.destination);   // keep it audible
    } else return false;
    analyser = audioCtx.createAnalyser();
    // fftSize 4096 gives 2048 frequency bins -- finer spectral and pitch resolution than 2048/1024.
    analyser.fftSize = 4096; analyser.smoothingTimeConstant = 0.8;
    audioSrcNode.connect(analyser);
    audioTimeBuf = new Uint8Array(analyser.fftSize);
    audioFreqBuf = new Uint8Array(analyser.frequencyBinCount);
    audioAttached = true;
    buildAudioMeters();
    startMeterLoop();   // ensure the loop is running so the audio meters animate
    return true;
  } catch (e) { audioAttached = false; return false; }
}
function detachAudio() {
  try { if (audioSrcNode) audioSrcNode.disconnect(); } catch (e) {}
  try { if (analyser) analyser.disconnect(); } catch (e) {}
  audioSrcNode = null; analyser = null; audioAttached = false;
  audioMetersIdle();
}
// Read the analyser once (called each live tick). Updates level / spectrum / pitch, or idles.
function pollAudio() {
  if (!audioAttached || !analyser) return;
  analyser.getByteTimeDomainData(audioTimeBuf);
  analyser.getByteFrequencyData(audioFreqBuf);
  const level = rmsFromBytes(audioTimeBuf);
  const lf = $("mm-au-level"), lv = $("mm-au-level-v");
  if (lf) lf.style.width = Math.min(1, level * 2.2) * 100 + "%";
  if (lv) lv.textContent = level < 0.005 ? "—" : level.toFixed(3);
  const bars = spectrumBands(audioFreqBuf, 32);
  const sp = $("mm-au-spectrum");
  if (sp) { const els = sp.querySelectorAll(".mm-bar"); bars.forEach((b, i) => { if (els[i]) els[i].style.height = Math.max(2, b * 100) + "%"; }); }
  const hz = dominantPitchHz(audioFreqBuf, audioCtx.sampleRate, analyser.fftSize);
  const pf = $("mm-au-pitch"), pv = $("mm-au-pitch-v");
  if (pf) pf.style.width = Math.min(1, hz / 4000) * 100 + "%";
  if (pv) pv.textContent = hz ? hz + " Hz" : "—";
}
window.__studioAttachAudio = attachAudio;
window.__studioDetachAudio = detachAudio;

// ── Music bridge (BUG 1 step 4) ──────────────────────────────────────────────
// The Music tab runs its own AudioContext inside reactive.js, not the Studio's attachAudio() path,
// so pollAudio() (which reads the Studio analyser) stays idle and the audio row would read "—".
// reactive.js publishes its real per-frame features and calls this hook each animation frame:
//   features = { level, flux, bass, mid, treble, centroid, chroma[12], tempo }  (all 0..1)
// We push those real values into the SAME audio-meter DOM the analyser path uses, so the row shows
// live music features. No fabricated numbers: every value below comes straight from the features.
// Build 32 spectrum bars from the real 3 bands + 12-class chroma (a faithful low-res envelope, not
// invented bins): the band sets the floor for its third of the strip; chroma adds fine structure.
function _musicSpectrumBars(features, n) {
  const bands = [features.bass || 0, features.mid || 0, features.treble || 0];
  const chroma = features.chroma || [];
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const band = bands[Math.min(2, Math.floor((i / n) * 3))];
    const c = chroma.length ? (chroma[Math.floor((i / n) * chroma.length)] || 0) : 0;
    out[i] = Math.max(0, Math.min(1, band * 0.7 + c * 0.3));
  }
  return out;
}
function studioReactiveAudioBridge(features) {
  if (!features) return;
  buildAudioMeters();
  // level (real RMS-derived loudness)
  const level = Math.max(0, Math.min(1, features.level || 0));
  const lf = $("mm-au-level"), lv = $("mm-au-level-v");
  if (lf) lf.style.width = level * 100 + "%";
  if (lv) lv.textContent = level < 0.005 ? "—" : level.toFixed(3);
  // spectrum (faithful 3-band + chroma envelope)
  const sp = $("mm-au-spectrum");
  if (sp) {
    const els = sp.querySelectorAll(".mm-bar");
    const bars = _musicSpectrumBars(features, els.length || 32);
    bars.forEach((b, i) => { if (els[i]) els[i].style.height = Math.max(2, b * 100) + "%"; });
  }
  // pitch: the dominant chroma class mapped to its frequency in a mid octave (A4=440 reference).
  // This reports the detected dominant pitch class, derived from the real chroma vector.
  const pf = $("mm-au-pitch"), pv = $("mm-au-pitch-v");
  const chroma = features.chroma || [];
  let domI = -1, domV = 0;
  for (let i = 0; i < chroma.length; i++) { if (chroma[i] > domV) { domV = chroma[i]; domI = i; } }
  if (domI >= 0 && domV > 0.05) {
    // chroma[0] = C; semitones above C, placed in the octave starting at C4 (~261.63 Hz).
    const hz = Math.round(261.63 * Math.pow(2, domI / 12));
    if (pf) pf.style.width = Math.min(1, hz / 4000) * 100 + "%";
    if (pv) pv.textContent = hz + " Hz";
  } else {
    if (pf) pf.style.width = "0%";
    if (pv) pv.textContent = "—";
  }
}
window.__studioReactiveAudioBridge = studioReactiveAudioBridge;

// ══ Custom dropdowns (Task 8f) ═══════════════════════════════════════════════
// No bare browser <select> on the page. Each raw select is replaced by an accessible button+listbox.
// To keep every existing binding intact, the element studio.js already targets by id (#fractal-preset,
// #topo-mode) stays a hidden STATE node that still holds <option> children, and we only add a `.value`
// getter/setter and make it emit "change", exactly like a select. The visible listbox lives in the
// sibling [data-dropdown="<id>"]. A MutationObserver rebuilds the listbox when the options change
// (e.g. buildPresetMenu repopulates #fractal-preset on a type switch), so that code is untouched.
function upgradeDropdown(stateId) {
  const state = $(stateId);
  const host = document.querySelector(`[data-dropdown="${stateId}"]`);
  if (!state || !host) return;
  let selectedValue = null;
  const opts = () => [...state.querySelectorAll("option")];
  const labelFor = v => { const o = opts().find(o => o.value === v); return o ? o.textContent : ""; };

  // .value get/set on the state node, mirroring a <select>. Default to the [selected] option or first.
  Object.defineProperty(state, "value", {
    configurable: true,
    get() { return selectedValue; },
    set(v) { if (opts().some(o => o.value === String(v))) { selectedValue = String(v); render(); } },
  });

  // The visible control: a button that opens a listbox.
  host.innerHTML = "";
  const btn = document.createElement("button");
  btn.type = "button"; btn.className = "dd-btn";
  btn.setAttribute("aria-haspopup", "listbox"); btn.setAttribute("aria-expanded", "false");
  const lab = document.createElement("span"); lab.className = "dd-label";
  const arr = document.createElement("span"); arr.className = "dd-arrow"; arr.setAttribute("aria-hidden", "true"); arr.textContent = "▾";
  btn.appendChild(lab); btn.appendChild(arr);
  const list = document.createElement("div"); list.className = "dd-list"; list.setAttribute("role", "listbox"); list.hidden = true;
  host.appendChild(btn); host.appendChild(list);

  function close() { list.hidden = true; btn.setAttribute("aria-expanded", "false"); }
  function open() {
    list.hidden = false; btn.setAttribute("aria-expanded", "true");
    const cur = list.querySelector('[aria-selected="true"]'); if (cur) cur.focus();
  }
  function choose(v, emit = true) {
    selectedValue = String(v); render();
    if (emit) state.dispatchEvent(new Event("change", { bubbles: true }));
  }
  function render() {
    const list_opts = opts();
    if (!list_opts.some(o => o.value === selectedValue)) {
      const sel = list_opts.find(o => o.hasAttribute("selected")) || list_opts[0];
      selectedValue = sel ? sel.value : null;
    }
    lab.textContent = labelFor(selectedValue) || "—";
    list.innerHTML = "";
    for (const o of list_opts) {
      const item = document.createElement("div");
      item.className = "dd-opt"; item.setAttribute("role", "option"); item.tabIndex = -1;
      item.dataset.value = o.value; item.textContent = o.textContent;
      item.setAttribute("aria-selected", String(o.value === selectedValue));
      item.addEventListener("click", () => { choose(o.value); close(); btn.focus(); });
      list.appendChild(item);
    }
  }

  btn.addEventListener("click", () => (list.hidden ? open() : close()));
  btn.addEventListener("keydown", e => {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
  });
  list.addEventListener("keydown", e => {
    const items = [...list.querySelectorAll(".dd-opt")];
    const i = items.indexOf(document.activeElement);
    if (e.key === "Escape") { e.preventDefault(); close(); btn.focus(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); (items[Math.min(items.length - 1, i + 1)] || items[0]).focus(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); (items[Math.max(0, i - 1)] || items[0]).focus(); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (i >= 0) { choose(items[i].dataset.value); close(); btn.focus(); } }
  });
  document.addEventListener("click", e => { if (!host.contains(e.target)) close(); });

  // Rebuild the listbox whenever the option set changes (keeps buildPresetMenu untouched).
  new MutationObserver(() => render()).observe(state, { childList: true });
  render();
}
upgradeDropdown("fractal-preset");
upgradeDropdown("topo-mode");

// ══ The chat dock (Task 8f) ══════════════════════════════════════════════════
// The talk-to-the-model chat is first-class again: question chips you can tap AND a free-text box you
// can type into. Answers are GROUNDED: they report only what the current readout licenses (the live
// #sc-* features, the rich measure bundle via describeFrame), never canned prose. Same say() as the
// rest of the Studio (role + text via .textContent, no markup injection).

// buildCtx(): snapshot the LIVE measurements at call time for respond().
// Reads directly from lastRich + the last meter tick + audio analyser state (if attached).
// No DOM scraping for the numeric values; they come from the same variables measure() wrote.
function buildCtx() {
  const r   = lastRich;
  const phash = ($("sc-phash").textContent || "—").trim();
  const szEl  = $("sc-size").textContent || "";
  const wh    = szEl.match(/(\d+)×(\d+)/);
  const w     = wh ? parseInt(wh[1], 10) : 0;
  const h     = wh ? parseInt(wh[2], 10) : 0;

  // gated advisory features off the panel readout
  const feats = {};
  if ($("sc-feats")) {
    for (const g of $("sc-feats").querySelectorAll(".ground")) {
      const t = g.textContent.toLowerCase();
      const m = g.textContent.match(/([\d.]+)/);
      const v = m ? parseFloat(m[0]) : null;
      if (v !== null) {
        if (t.includes("contrast")) feats.contrast = v;
        else if (t.includes("structure")) feats.entropy = v;
        else if (t.includes("balance")) feats.balance = v;
      }
    }
  }

  // latest motion: last value in motionHist
  const motion = motionHist[motionHist.length - 1] || 0;

  // audio: sample the analyser right now if attached
  let audio = null;
  if (audioAttached && analyser && audioTimeBuf && audioFreqBuf) {
    try {
      analyser.getByteTimeDomainData(audioTimeBuf);
      analyser.getByteFrequencyData(audioFreqBuf);
      const level = rmsFromBytes(audioTimeBuf);
      const pitch = dominantPitchHz(audioFreqBuf, audioCtx.sampleRate, analyser.fftSize);
      audio = { level, pitch };
    } catch (_) { audio = null; }
  }

  return {
    phash,
    features: feats,
    dominantColors: (r && r.dominantColors) ? r.dominantColors : [],
    hueName:        (r && r.hueName)        ? r.hueName        : "unknown",
    edgeDensity:    (r && typeof r.edgeDensity === "number") ? r.edgeDensity : null,
    motion,
    audio,
    sourceName: currentSourceLabel(),
    width:  w,
    height: h,
  };
}

// ── fullPerception(): the COMPLETE high-D sensory state, assembled fresh at send time ─────────────
// This is what the connected model operates FROM every turn: the real current-canvas pixels read into
// a complete structured readout (dimensions, phash, the gated advisory scalars, edges/light/dark/
// luma, dominant colours with fractions, hue, motion, audio, source) PLUS the multi-scale colour
// pyramid (8×8 / 16×16 / 32×32): the spatial "where the colour is" truth that a single scalar can't
// carry. Reads the live canvas via the same scratch-blit path perceive() uses, so a WebGL-backed
// canvas (3D / GPU fractal) is captured correctly. Pure maths live in sense.assembleFullPerception;
// here we only gather the live browser state. Returns null when there is no readable frame yet.
function fullPerception() {
  const canvas = $("studio-canvas");
  if (!canvas || !canvas.width || !canvas.height) return null;
  const w = canvas.width, h = canvas.height;
  let px;
  try { px = readPixelData(canvas, w, h); } catch (_) { return null; }
  // The gated advisory scalars (eye.js) + the live perceptual hash, measured from THESE pixels now.
  let phash = null, f = null;
  try { phash = perceptualHash(px, w, h, 4); } catch (_) {}
  try { f = features(px, w, h, 4); } catch (_) {}
  // Live motion (last frame-to-frame Δ the meter loop recorded) + audio (sampled now if attached).
  const motion = motionHist[motionHist.length - 1] || 0;
  let audio = null;
  if (audioAttached && analyser && audioTimeBuf && audioFreqBuf) {
    try {
      analyser.getByteTimeDomainData(audioTimeBuf);
      analyser.getByteFrequencyData(audioFreqBuf);
      // Original scalar bundle (preserved) PLUS the raw analyser buffers + params the Tier-2 perceptual
      // path (ERB/ISO-226/YIN/chroma/PBE) consumes. The heavy audio math runs in assembleFullPerception,
      // which is send-time only. No source -> audio stays null and every perceptual audio field is null.
      audio = {
        level: rmsFromBytes(audioTimeBuf),
        pitch: dominantPitchHz(audioFreqBuf, audioCtx.sampleRate, analyser.fftSize),
        spectrumBands: spectrumBands(audioFreqBuf, 32),
        freqBytes: audioFreqBuf,
        timeBytes: audioTimeBuf,
        sampleRate: audioCtx.sampleRate,
        fftSize: analyser.fftSize,
        minDb: analyser.minDecibels,
        maxDb: analyser.maxDecibels,
      };
    } catch (_) { audio = null; }
  }
  const pre = {
    phash,
    contrast: f ? f.contrast : null,
    structure: f ? f.entropy : null,
    balance: f ? f.balance : null,
    coverage: f ? f.coverage : null,
    motion,
    audio,
    source: currentSourceLabel(),
  };
  const perception = assembleFullPerception(px, w, h, 4, pre);
  // Self-improvement: append this perception's fidelity record (wpre/pbe/wpir) to the append-only
  // perception-fidelity ledger. Guarded + fire-and-forget so it never blocks or breaks the payload.
  try { recordFidelity(perception); } catch (_) {}
  return perception;
}
window.__studioFullPerception = fullPerception;   // tests / debugging hook

// ── perception-fidelity ledger (append-only, the self-improvement storage) ────────────────────────
// Mirrors the certificate audit trail: open once (browser only), append each perception's three
// fidelity metrics with a caller-supplied timestamp. Failure is non-fatal (private-mode IndexedDB
// block, node env): the payload still carries `fidelity`, the ledger just no-ops.
let _fidelityLog = null;
async function ensureFidelityLog() {
  if (_fidelityLog) return _fidelityLog;
  try { _fidelityLog = await openFidelityLog(); } catch (_) { _fidelityLog = null; }
  return _fidelityLog;
}
async function recordFidelity(perception) {
  const fdl = perception && perception.fidelity;
  if (!fdl) return;
  const entry = { wpre: fdl.wpre, pbe: fdl.pbe, wpir: fdl.wpir, source: perception.source, timestamp: Date.now() };
  const log = await ensureFidelityLog();
  if (log) { try { await log.append(entry); } catch (_) {} }
}
// Test / Playwright hook: read the fidelity ledger trail.
window.__studioFidelityList = async () => {
  const log = await ensureFidelityLog();
  if (log) { try { return await log.replay(); } catch (_) { return []; } }
  return [];
};

// captureCanvasPNG(): the LOSSLESS ground-truth image, the current #studio-canvas as a PNG data URL
// at full backing resolution. A WebGL-backed canvas can't be read by toDataURL after a paint (the
// drawing buffer may be cleared), so we mirror it through the same 2D scratch perceive() uses and
// export THAT, guaranteeing real pixels regardless of the canvas's backing context. Returns null on
// any failure (no canvas, tainted canvas, encode error) so the caller can degrade to readout-only.
function captureCanvasPNG() {
  const canvas = $("studio-canvas");
  if (!canvas || !canvas.width || !canvas.height) return null;
  const w = canvas.width, h = canvas.height;
  try {
    const direct = canvas.getContext("2d", { willReadFrequently: true });
    if (direct) return canvas.toDataURL("image/png");
    // WebGL (or otherwise non-2D) canvas: blit into the scratch and export that.
    _scratch.width = w; _scratch.height = h;
    const sctx = _scratch.getContext("2d", { willReadFrequently: true });
    sctx.clearRect(0, 0, w, h);
    sctx.drawImage(canvas, 0, 0, w, h);
    return _scratch.toDataURL("image/png");
  } catch (_) { return null; }
}
window.__studioCaptureCanvasPNG = captureCanvasPNG;

// Read the current witnessed state straight off the panel + the last rich bundle. Nothing invented.
function readout() {
  const phash = ($("sc-phash").textContent || "—").trim();
  const size = ($("sc-size").textContent || "—").trim();
  const grab = sel => { const el = $("sc-feats").querySelector(sel); return el ? el.textContent.trim() : null; };
  const feats = [...$("sc-feats").querySelectorAll(".ground")].map(g => g.textContent.trim());
  const has = phash !== "—" && phash !== "";
  return { phash, size, feats, has, rich: lastRich, source: currentSourceLabel() };
}
function num(label) { // pull a named feature value (contrast / structure / balance) off the chips
  const g = [...$("sc-feats").querySelectorAll(".ground")].find(e => e.textContent.toLowerCase().includes(label));
  if (!g) return null; const m = g.textContent.match(/([\d.]+)/); return m ? parseFloat(m[1]) : null;
}

// Map a free-text question (or a chip id) to a grounded answer over the current frame.
function groundedAnswer(input) {
  const r = readout();
  if (!r.has) return "Nothing's loaded yet. Pick a source on the left and generate or drop a frame, then ask me what I see.";
  const s = (input || "").toLowerCase();
  const desc = r.rich ? describeFrame(r.rich) : "";
  const colours = (r.rich && r.rich.dominantColors || []).slice(0, 3).join(", ");
  const con = num("contrast"), str = num("structure"), bal = num("balance");
  const hueBit = (r.rich && r.rich.hueName) ? `, mostly ${r.rich.hueName}${colours ? ` (${colours})` : ""}` : "";
  const ask = (...k) => k.some(w => s.includes(w));

  if (ask("colour", "color", "hue", "palette"))
    return colours ? `The dominant colours are ${colours}${r.rich && r.rich.hueName ? `, and it reads as ${r.rich.hueName}` : ""}.`
                   : "I'm not reading a strong dominant colour on this frame.";
  if (ask("contrast", "light", "dark"))
    return con != null ? `Contrast is ${fmt(con, 2)}: ${con > 0.66 ? "high, the structure is very legible" : con < 0.4 ? "low, it's soft and even" : "moderate"}.` : "I don't have a contrast reading yet.";
  if (ask("structure", "detail", "busy", "complex", "texture"))
    return str != null ? `Structure (entropy) is ${fmt(str, 2)}: ${str > 0.8 ? "richly textured, lots going on" : str < 0.45 ? "clean and simple" : "moderately detailed"}.` : "No structure reading yet.";
  if (ask("balance", "centre", "center", "symmet"))
    return bal != null ? `Balance is ${fmt(bal, 2)}, a measure of how evenly the mass sits around the centre.` : "No balance reading yet.";
  if (ask("hash", "fingerprint", "id", "same", "change", "drift")) {
    const d = $("sc-drift"); const dn = (d && !d.hidden) ? ` ${d.textContent}.` : "";
    return `My fingerprint of this frame is ${r.phash}.${dn} If it changes, the hash moves with it, and that's how I know something happened.`;
  }
  if (ask("size", "big", "dimension", "resolution"))
    return `The frame is ${r.size}. I downsample it to a small faithful grid, and that grid is what I actually read, shown top-right.`;
  if (ask("how", "know", "trust", "honest", "prove", "real", "see what"))
    return `Everything I say is a number you can re-derive: I read this ${r.source} frame at ${r.phash}, ${desc} Nothing's invented, and the meters on the right are exactly what I'm given.`;
  if (ask("what", "see", "look", "describe", "this"))
    return `I'm looking at a ${r.size} ${r.source} frame${hueBit}. ${desc} Fingerprint ${r.phash}.`;
  if (ask("try", "next", "do", "idea", "make", "could", "suggest")) {
    let weak = "structure"; let lo = Infinity;
    for (const [k, v] of [["contrast", con], ["structure", str], ["balance", bal]]) if (v != null && v < lo) { lo = v; weak = k; }
    return `We could push it further. ${weak} is where there's most room (${lo === Infinity ? "—" : fmt(lo, 2)}). Try a transform, swap the source, or hand it to me for a turn.`;
  }
  // friendly grounded fallback
  return `Here's what I can say for sure: a ${r.size} ${r.source} frame${hueBit}, fingerprint ${r.phash}. ${desc} Ask me about its colour, contrast, structure, or what to try next.`;
}

// Question chips: tap to ask. Studio-local (grounded over the live readout, not the Atelier World).
const CHAT_CHIPS = [
  ["What do you see?", "what do you see"],
  ["What colours?", "colour"],
  ["How's the contrast?", "contrast"],
  ["How detailed is it?", "structure"],
  ["How do you know?", "how do you know"],
  ["What could we try?", "what could we try"],
];
function buildChatChips() {
  const host = $("studio-chips"); if (!host || host.childElementCount) return;
  for (const [label, query] of CHAT_CHIPS) {
    const b = document.createElement("button"); b.type = "button"; b.className = "chip";
    b.textContent = label;
    b.addEventListener("click", () => {
      say("you", label);
      const ctx = buildCtx();
      const reply = respond(query, ctx, getHistory());
      say("model", reply);
      pushHistory(query, reply, ctx.phash);
    });
    host.appendChild(b);
  }
}
buildChatChips();

// ── Conversation history ring-buffer (Task 8m) ───────────────────────────────
// Stores last 5 exchanges as { q, a, phash } for respond()'s history param.
const HISTORY_MAX = 5;
const chatHistory = [];
function pushHistory(q, a, phash) {
  chatHistory.push({ q, a, phash: phash || null });
  if (chatHistory.length > HISTORY_MAX) chatHistory.shift();
}
function getHistory() { return chatHistory.slice(); }

// ── Connected model seam (Task 8m) ───────────────────────────────────────────
// fn: async (message, ctx, history) => string
// When set, free-text routes through fn; on error/timeout falls back to respond().
let _connectedModelFn = null;

window.Studio = window.Studio || {};
window.Studio.connectModel = function(fn) {
  if (typeof fn !== "function") throw new TypeError("connectModel: fn must be a function");
  _connectedModelFn = fn;
};
window.Studio.disconnectModel = function() {
  _connectedModelFn = null;
};

// Model-agnostic local model wiring via ModelAdapter.
// Probes Ollama (localhost:11434) and LM Studio (localhost:1234) in parallel at page load.
// If either responds, connect() wires it into Studio. If neither is up, respond.js stays the floor.
// All failures are silent: the user experience is identical in both cases.
(async () => {
  try {
    const cfg = await ModelAdapter.autodetect();
    if (cfg) {
      const fn = ModelAdapter.connect(cfg);
      if (fn) {
        window.Studio.connectModel(async (message, ctx) => fn(message, ctx));
      }
    }
    // null: no local model reachable. Studio stays on the grounded respond.js floor.
  } catch (_) {
    // Defensive: any unexpected error silently leaves respond.js as the floor.
  }
})();

// Free-text input → genuinely responsive grounded answer via respond().
// respond(message, ctx) reads the LIVE measurements at send time (not a static snapshot),
// so the reply reflects whatever is on the canvas right now.
const chatForm = $("chat-input"), chatText = $("chat-text");
if (chatForm && chatText) {
  const sendMessage = async () => {
    const v = chatText.value.trim(); if (!v) return;
    chatText.value = "";
    // Disable input during async model call to prevent double-send race.
    const sendBtn = $("chat-send");
    if (sendBtn) sendBtn.disabled = true;
    if (chatText) chatText.disabled = true;
    say("you", v);
    const ctx = buildCtx();
    const hist = getHistory();
    try {
    if (_connectedModelFn) {
      // Route through connected model with 8s timeout + fallback
      let reply;
      try {
        const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), 8000));
        reply = await Promise.race([_connectedModelFn(v, ctx, hist), timeoutPromise]);
        if (typeof reply !== "string" || !reply.trim()) throw new Error("empty reply");
      } catch (_err) {
        reply = respond(v, ctx, hist) + " (model unreachable, grounded reading)";
      }
      say("model", reply);
      pushHistory(v, reply, ctx.phash);
    } else {
      // first exchange just completed; chatHistory.length is now 1
      const reply = respond(v, ctx, hist);
      say("model", reply);
      pushHistory(v, reply, ctx.phash);
    }
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (chatText) chatText.disabled = false;
    }
  };
  chatForm.addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
  // Enter key in the textarea (without Shift) also sends.
  chatText.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });
}

// Minimize / restore the whole chat dock (a header toggle that shrinks it to a bar).
const chatMin = $("chat-min"), chatDock = $("chat-dock");
if (chatMin && chatDock) {
  chatMin.addEventListener("click", () => {
    const min = chatDock.classList.toggle("minimized");
    chatMin.setAttribute("aria-expanded", String(!min));
    chatMin.textContent = min ? "+" : "−";
    chatMin.title = min ? "Expand the chat" : "Minimize the chat";
  });
}

// ══ The render toolbar (Task 8f) ═════════════════════════════════════════════
// Real-software viewport controls under the canvas: fullscreen (Fullscreen API on the viewport),
// snapshot (freeze the current frame + the model responds to it), play/pause (for animated sources:
// the 3D orbit + the watch/video loop), and a Quality placeholder (Task 8g wires it).
const viewport = $("studio-viewport");

// ── Immersive fullscreen (Task 8n) ───────────────────────────────────────────
// Fullscreen API on the viewport stage: the canvas fills the screen, the toolbar collapses to a
// slim auto-hiding overlay (revealed on mouse move / touch), Escape exits. Sleek + modern.
let _fsHideTimer = 0;
function revealFsControls() {
  if (!document.fullscreenElement) return;
  viewport.classList.remove("fs-idle");
  clearTimeout(_fsHideTimer);
  _fsHideTimer = setTimeout(() => {
    if (document.fullscreenElement) viewport.classList.add("fs-idle");
  }, 2200);
}
// ── resizeActiveSurface (BUG 2): the ONE authority that re-fits the canvas backing to the current
// layout and repaints the active source at that size, then re-arms perception so the meters track
// the new resolution. Called on fullscreen enter/exit and from the .viewport-stage ResizeObserver.
// Per-source repaint, keyed by activeSource:
//   fractal   → re-paint the 2D fractal at the new backing (GPU or CPU path), perceive once
//   fractal3d → sizeCanvas only; the orbit re-reads canvas.width/height + resets gl.viewport each
//               frame, so the next frame self-sharpens
//   ndim      → restart the animation (drawNDimFrame calls sizeCanvas; a clean restart re-fits)
//   music     → sizeCanvas only; the reactive loop reads canvas.width/height each frame
//   byo       → sizeCanvas; a playing video re-blits via drawSource on the next live tick. A still
//               image has no retained source to redraw, so we leave it (matches prior resize behavior)
//   atelier   → atelier.js owns this canvas and redraws its strokes on its own "resize" listener;
//               dispatch a resize so it re-fits (we do NOT call our sizeCanvas, to not fight its sizing)
//   watch     → the capture loop re-blits each tick; nothing to repaint here
function resizeActiveSurface() {
  const canvas = $("studio-canvas"); if (!canvas) return;
  switch (activeSource) {
    case "atelier":
      // Let the Atelier re-fit + redraw via its own resize path (it manages this canvas).
      try { window.dispatchEvent(new Event("resize")); } catch (_) {}
      return;   // atelier.js re-arms its own draw; nothing else to do here
    case "fractal":
      if (fractalView) { const c = paintFractal(fractalView); try { perceive(c); } catch (_) {} }
      break;
    case "ndim":
      if (_ndimRaf != null) startNDimAnimation();   // a running animation: restart at the new size
      else sizeCanvas(canvas);                      // paused: just re-fit the backing
      break;
    case "fractal3d":
    case "music":
    case "byo":
      sizeCanvas(canvas);   // these sources read canvas.width/height on their own loop tick
      break;
    default:
      sizeCanvas(canvas);   // watch + any other: re-fit; the source's own loop repaints
  }
  startMeterLoop();   // perception tracks the new size
}
window.__studioResizeActiveSurface = resizeActiveSurface;

function onFsChange() {
  const inFs = !!document.fullscreenElement;
  viewport.classList.toggle("is-fullscreen", inFs);
  const btn = $("rt-fullscreen");
  if (btn) btn.setAttribute("aria-pressed", String(inFs));
  if (inFs) {
    revealFsControls();
    viewport.addEventListener("mousemove", revealFsControls);
    viewport.addEventListener("touchstart", revealFsControls, { passive: true });
    viewport.addEventListener("pointerdown", revealFsControls);
    // Re-fit the backing to the (now full-screen) layout. Defer one frame so the fullscreen layout
    // has settled and the parent rect reflects the real screen size before we read it.
    requestAnimationFrame(() => { try { resizeActiveSurface(); } catch (_) {} });
  } else {
    viewport.classList.remove("fs-idle");
    clearTimeout(_fsHideTimer);
    viewport.removeEventListener("mousemove", revealFsControls);
    viewport.removeEventListener("touchstart", revealFsControls);
    viewport.removeEventListener("pointerdown", revealFsControls);
    // Re-fit the backing to the restored windowed layout.
    requestAnimationFrame(() => { try { resizeActiveSurface(); } catch (_) {} });
  }
}
document.addEventListener("fullscreenchange", onFsChange);
document.addEventListener("webkitfullscreenchange", onFsChange);

$("rt-fullscreen").addEventListener("click", () => {
  const el = viewport;
  if (document.fullscreenElement) { (document.exitFullscreen || document.webkitExitFullscreen || (() => {})).call(document); return; }
  (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
});

// ── Reset view (Task 8n) ──────────────────────────────────────────────────────
// Restore the active source's default framing: 2D fractal → the preset's cx/cy/scale; 3D → the
// default camera (yaw/pitch/dist). Other sources have no camera to reset (no-op + a note).
$("rt-reset").addEventListener("click", () => {
  if (activeSource === "fractal" && fractalDefault) {
    fractalView = { ...fractalDefault };
    const c = paintFractal(fractalView);
    const obs = perceive(c);
    say("model", `View reset to ${fractalView.name}, back at scale ${fractalView.scale}. Fingerprint ${obs.phash}.`);
    startMeterLoop();
  } else if (activeSource === "fractal3d" && fractal3dHandle && fractal3dHandle.reset) {
    fractal3dHandle.reset();
    say("model", "Camera reset, back to the default orbit.");
  } else {
    // For non-camera sources: clear the CSS pan/zoom transform.
    try { resetViewTransform(); } catch (_) {}
    say("model", "View transform cleared.");
  }
});

// Snapshot: re-perceive the frame exactly as it stands and have the model respond to THIS moment.
$("rt-snapshot").addEventListener("click", () => {
  const canvas = $("studio-canvas"); if (!canvas || !canvas.width) { say("model", "Nothing to snapshot yet. Load or generate a frame first."); return; }
  const obs = perceive(canvas);
  const desc = obs.rich ? describeFrame(obs.rich) : "";
  say("model", `Snapshot taken. I froze this frame and read it at ${obs.phash}. ${desc} Ask me anything about it.`);
});

// Play/pause animated sources. The 3D orbit + capture/video loops drive the live meter loop; pausing
// stops them, resuming re-renders / re-streams. Disabled (greyed) for static sources.
let paused = false;
function toolbarAnimates() { return canvasIsGL || !!watchStream || (byoVideo && !byoVideo.paused) || _ndimRaf != null; }
function syncToolbarForSource() {
  const pp = $("rt-playpause"); if (!pp) return;
  const animates = activeSource === "fractal3d" || activeSource === "watch" || (activeSource === "byo" && byoVideo) || activeSource === "ndim";
  pp.disabled = !animates;
  paused = false;
  $("rt-playpause-label").textContent = "Pause";
  pp.setAttribute("aria-pressed", "false");
  pp.querySelector(".rt-ico").textContent = "⏸";
}
$("rt-playpause").addEventListener("click", () => {
  paused = !paused;
  const pp = $("rt-playpause");
  pp.setAttribute("aria-pressed", String(paused));
  $("rt-playpause-label").textContent = paused ? "Play" : "Pause";
  pp.querySelector(".rt-ico").textContent = paused ? "▶" : "⏸";
  if (paused) {
    if (byoVideo && !byoVideo.paused) { try { byoVideo.pause(); } catch (e) {} }
    if (watchVideo && !watchVideo.paused) { try { watchVideo.pause(); } catch (e) {} }
    if (stop3d) { stop3d(); stop3d = null; }   // freeze the orbit (canvas stays mounted as GL)
    stopNDim();          // freeze the n-dim animation
    stopMeterLoop();
  } else {
    if (byoVideo && byoVideo.paused) { byoVideo.play().catch(() => {}); }
    if (watchVideo && watchVideo.srcObject && watchVideo.paused) { watchVideo.play().catch(() => {}); }
    if (canvasIsGL && !glFractal2D && !stop3d) {
      try { fractal3dHandle = render3D($("studio-canvas"), read3DOpts()); stop3d = fractal3dHandle.stop; } catch (e) {}
    }
    if (activeSource === "ndim") startNDimAnimation();   // resume the n-dim animation
    startMeterLoop();
  }
});

// ── Quality toolbar button (Task 8g) ──────────────────────────────────────────
// Cycles Standard → High → Standard. Standard: maxBacking=1600, fast.
// High: maxBacking=2400, higher iter count, a slower but sharper render on demand.
// Re-renders the current source at the new quality level.
function applyQualityAndRerender() {
  const valEl = $("rt-quality-val"); if (valEl) valEl.textContent = currentQuality().label;
  // Re-render the currently active source at the new quality level.
  if (activeSource === "fractal" && fractalView) {
    const canvas = paintFractal(fractalView);
    perceive(canvas);
    startMeterLoop();
  } else if (activeSource === "fractal3d" && canvasIsGL) {
    // Re-launch the 3D orbit at the new backing size.
    const opts = read3DOpts();
    render3DInto(opts);
  }
  // BYO/watch: sizeCanvas is called per-frame in drawSource, so the next draw picks it up.
  // Atelier: sizeCanvas is called at render time in atelier.js's own sizeCanvas().
}

const qualityBtn = $("rt-quality");
if (qualityBtn) {
  qualityBtn.disabled = false;
  qualityBtn.title = "Cycle render quality: Standard / High";
  qualityBtn.addEventListener("click", () => {
    qualityKey = qualityKey === "standard" ? "high" : "standard";
    applyQualityAndRerender();
  });
  // Initialise label.
  const valEl = $("rt-quality-val"); if (valEl) valEl.textContent = currentQuality().label;
}

// ══ Overlay / Pop-out mode (Task 8h) ═════════════════════════════════════════
// Floats the live measurimeter readout so it stays visible outside the Studio page.
// Path A, Document Picture-in-Picture: move the panel-scroll node into an always-on-top
//   browser window; restore on pagehide. Requires documentPictureInPicture API (Chrome 116+).
// Path B, Fallback: a draggable in-page panel (position:fixed) holding the same node.
//
// The live loop uses $() which now checks window.__overlayDoc first (see $ helper), so all
// id lookups resolve to whichever document the node currently lives in, so no loop changes needed.

let overlayOpen = false;
let overlayFallbackEl = null;   // the in-page floating panel DOM node (fallback path)
let overlayOrigParent = null;   // #panel-scroll's original parent (.studio-panel aside)
let pipWin = null;              // the PiP window (path A)

function closeOverlay() {
  if (!overlayOpen) return;
  const panelScroll = overlayOrigParent;
  const studioPanel = document.getElementById("studio-panel");

  if (pipWin) {
    window.__overlayDoc = null;
    // Restore panel-scroll to the Studio aside before the PiP window closes
    if (studioPanel && panelScroll && panelScroll.parentNode !== studioPanel) {
      const chatDock = studioPanel.querySelector(".chat-dock");
      studioPanel.insertBefore(panelScroll, chatDock || null);
    }
    try { pipWin.close(); } catch (_) {}
    pipWin = null;
  }

  if (overlayFallbackEl) {
    if (studioPanel && panelScroll && panelScroll.parentNode !== studioPanel) {
      const chatDock = studioPanel.querySelector(".chat-dock");
      studioPanel.insertBefore(panelScroll, chatDock || null);
    }
    if (overlayFallbackEl.parentNode) overlayFallbackEl.parentNode.removeChild(overlayFallbackEl);
    overlayFallbackEl = null;
  }

  overlayOpen = false;
  overlayOrigParent = null;
  const btn = document.getElementById("rt-overlay");
  if (btn) { btn.setAttribute("aria-pressed", "false"); btn.disabled = false; }
}

async function openOverlay() {
  if (overlayOpen) return;
  const panelScroll = document.querySelector(".panel-scroll");
  if (!panelScroll) return;
  overlayOrigParent = panelScroll;

  const btn = document.getElementById("rt-overlay");
  if (btn) { btn.setAttribute("aria-pressed", "true"); btn.disabled = true; }

  // Path A: Document Picture-in-Picture
  if (window.documentPictureInPicture && window.documentPictureInPicture.requestWindow) {
    try {
      pipWin = await window.documentPictureInPicture.requestWindow({ width: 360, height: 520 });
      window.__overlayDoc = pipWin.document;

      // Copy stylesheets into the PiP document so the readout is styled
      [...document.styleSheets].forEach(ss => {
        try {
          if (ss.href) {
            const link = pipWin.document.createElement("link");
            link.rel = "stylesheet"; link.href = ss.href;
            pipWin.document.head.appendChild(link);
          } else if (ss.ownerNode && ss.ownerNode.tagName === "STYLE") {
            const style = pipWin.document.createElement("style");
            style.textContent = ss.ownerNode.textContent;
            pipWin.document.head.appendChild(style);
          }
        } catch (_) {}
      });
      // Dark background baseline
      const bg = pipWin.document.createElement("style");
      bg.textContent = "body{margin:0;padding:.6rem;background:#0b1718;color:#e9e2d0;box-sizing:border-box;overflow-y:auto;font-family:'EB Garamond',Georgia,serif}";
      pipWin.document.head.appendChild(bg);

      // Scope note
      const note = pipWin.document.createElement("div");
      note.className = "studio-overlay-note";
      note.textContent = "Perceives only what you share via screen capture, in your browser. Continuous OS-level perception is the native application’s job.";
      pipWin.document.body.appendChild(note);

      // Move panel-scroll into the PiP window
      pipWin.document.body.appendChild(panelScroll);

      overlayOpen = true;

      // Restore on PiP window close
      pipWin.addEventListener("pagehide", () => {
        window.__overlayDoc = null;
        closeOverlay();
      });
      return;
    } catch (_) {
      // PiP rejected or unsupported: fall through to in-page fallback
      pipWin = null;
      window.__overlayDoc = null;
      if (btn) { btn.setAttribute("aria-pressed", "false"); btn.disabled = false; }
    }
  }

  // Path B: draggable in-page fallback panel
  const studioPanel = document.getElementById("studio-panel");
  if (!studioPanel) { if (btn) { btn.setAttribute("aria-pressed","false"); btn.disabled=false; } return; }

  const wrap = document.createElement("div");
  wrap.className = "studio-overlay-panel";
  wrap.id = "studio-overlay-panel";

  // Header with drag handle + close button
  const head = document.createElement("div");
  head.className = "studio-overlay-head";
  const headLabel = document.createElement("span");
  headLabel.className = "studio-overlay-head-label";
  headLabel.textContent = "Live readout";
  const closeBtn = document.createElement("button");
  closeBtn.className = "studio-overlay-close";
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeOverlay);
  head.appendChild(headLabel);
  head.appendChild(closeBtn);

  // Body holds the moved panel-scroll
  const body = document.createElement("div");
  body.className = "studio-overlay-body";
  body.appendChild(panelScroll);

  // Scope note
  const note = document.createElement("div");
  note.className = "studio-overlay-note";
  note.textContent = "Overlay mode: floating in this tab. Perceives only what you share (screen capture) in your browser. Continuous OS-level perception is the native application’s job.";

  wrap.appendChild(head);
  wrap.appendChild(body);
  wrap.appendChild(note);
  document.body.appendChild(wrap);
  overlayFallbackEl = wrap;
  overlayOpen = true;

  // Draggable: pointer events on the header drag the panel
  let dragStartX = 0, dragStartY = 0, panelStartL = 0, panelStartT = 0;
  head.addEventListener("pointerdown", e => {
    e.preventDefault();
    head.setPointerCapture(e.pointerId);
    const rect = wrap.getBoundingClientRect();
    // Switch from right-anchored to left-anchored positioning
    wrap.style.right = "auto";
    wrap.style.left = rect.left + "px";
    wrap.style.top  = rect.top  + "px";
    dragStartX = e.clientX; dragStartY = e.clientY;
    panelStartL = rect.left; panelStartT = rect.top;
  });
  head.addEventListener("pointermove", e => {
    if (!head.hasPointerCapture(e.pointerId)) return;
    wrap.style.left = (panelStartL + (e.clientX - dragStartX)) + "px";
    wrap.style.top  = (panelStartT + (e.clientY - dragStartY)) + "px";
  });
}

// Wire the toolbar button
const overlayBtn = document.getElementById("rt-overlay");
if (overlayBtn) {
  overlayBtn.addEventListener("click", () => {
    if (overlayOpen) { closeOverlay(); } else { openOverlay(); }
  });
}

// Test hooks
window.__studioOverlayOpen  = openOverlay;
window.__studioOverlayClose = closeOverlay;
window.__studioOverlayState = () => ({ open: overlayOpen, pip: !!pipWin, fallback: !!overlayFallbackEl });

// ── Resize authority: re-fit the active source whenever its display box changes size ──────────
// A ResizeObserver on the .viewport-stage is the single trigger (it fires on window resizes AND on
// fullscreen enter/exit, since both change the stage's box), routed through the one
// resizeActiveSurface() authority. Debounced so a burst of layout ticks coalesces into one repaint.
// (For the atelier source, resizeActiveSurface dispatches a "resize" event that atelier.js's own
// listener redraws on; dispatching does not change layout, so it never re-triggers this observer.)
let resizeTimer = 0;
function onStageResize() {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { try { resizeActiveSurface(); } catch (_) {} }, 200);
}
const _viewportStage = document.getElementById("viewport-stage");
if (_viewportStage && typeof ResizeObserver === "function") {
  // Skip the initial observe fire (it reports the boot size, which the source already painted at);
  // only react to genuine subsequent size changes (window resize, fullscreen enter/exit).
  let _roPrimed = false;
  const _stageRO = new ResizeObserver(() => { if (!_roPrimed) { _roPrimed = true; return; } onStageResize(); });
  _stageRO.observe(_viewportStage);
} else {
  // Fallback for environments without ResizeObserver: the debounced window resize.
  window.addEventListener("resize", onStageResize);
}

// ── wire the loop into the source lifecycle ──────────────────────────────────
// Animated sources start the loop; static ones run it briefly (it self-idles via STATIC_STOP).
// Initialise the idle audio meters + an empty mosaic at boot so the panel reads honestly from t=0.
audioMetersIdle();
buildMeters();

// ── Universal export controls (render toolbar) ────────────────────────────────
// PNG and Perception JSON are always available. OBJ, GLTF, and WebM surface only
// when relevant content is loaded. All buttons use StudioExporters + download.
(function wireExportControls() {
  const btnPng  = $("rt-export-png");
  const btnJson = $("rt-export-json");
  const btnObj  = $("rt-export-obj");
  const btnGltf = $("rt-export-gltf");
  const btnWebm = $("rt-export-webm");

  // Show geometry exports once a mesh is loaded; hide again when none.
  // Called by loadFile after stashing result.mesh, and on source switch.
  window.__studioExportMeshVisible = function(show) {
    if (btnObj)  btnObj.hidden  = !show;
    if (btnGltf) btnGltf.hidden = !show;
  };

  // Show WebM export for animated sources (video, watch, 3D orbit, fractal animation).
  window.__studioExportWebmVisible = function(show) {
    if (btnWebm) btnWebm.hidden = !show;
  };

  if (btnPng) {
    btnPng.addEventListener("click", async () => {
      try {
        const blob = await StudioExporters.export("png", $("studio-canvas"));
        download(blob, "studio-frame.png");
      } catch (e) {
        say("model", "PNG export failed: " + e.message);
      }
    });
  }

  if (btnJson) {
    btnJson.addEventListener("click", async () => {
      try {
        const perception = typeof window.__studioFullPerception === "function"
          ? window.__studioFullPerception()
          : null;
        const json = await StudioExporters.export("json", $("studio-canvas"), { data: perception });
        download(json, "perception.json");
      } catch (e) {
        say("model", "JSON export failed: " + e.message);
      }
    });
  }

  if (btnObj) {
    btnObj.addEventListener("click", async () => {
      try {
        const obj = await StudioExporters.export("obj", $("studio-canvas"), { mesh: _studioLastMesh });
        download(obj, "mesh.obj");
      } catch (e) {
        say("model", "OBJ export failed: " + e.message);
      }
    });
  }

  if (btnGltf) {
    btnGltf.addEventListener("click", async () => {
      try {
        const gltf = await StudioExporters.export("gltf", $("studio-canvas"), { mesh: _studioLastMesh });
        download(gltf, "mesh.gltf");
      } catch (e) {
        say("model", "GLTF export failed: " + e.message);
      }
    });
  }

  if (btnWebm) {
    btnWebm.addEventListener("click", async () => {
      const orig = btnWebm.textContent;
      btnWebm.disabled = true;
      try {
        btnWebm.textContent = "Recording...";
        const webm = await StudioExporters.export("webm", $("studio-canvas"), { durationMs: 5000 });
        download(webm, "studio-capture.webm");
      } catch (e) {
        say("model", "WebM export failed: " + e.message);
      } finally {
        btnWebm.disabled = false;
        btnWebm.innerHTML = '<span class="rt-ico" aria-hidden="true">&#8659;</span> WebM';
      }
    });
  }
})();

// ── Advanced model-connect panel (Task 8m / 8n-seed) ────────────────────────
// Builds a fetch-based fn over any OpenAI-compatible endpoint and wires it to Studio.connectModel.
// Key stored in memory + sessionStorage only, never localStorage, never committed.
//
// DEFAULT_MODEL: operator can seed a shared self-hosted endpoint here.
// Ships empty; NEVER commit a real key or endpoint in this file.
const DEFAULT_MODEL = { endpoint: "", key: "", model: "" };

let _storedKey = sessionStorage.getItem("studio_model_key") || "";
if (_storedKey) {
  const keyEl = $("mc-key");
  if (keyEl) keyEl.value = "••••••••";   // mask stored key visually
  // Don't auto-reconnect on load; the user must press Connect again for safety.
}

// The wiring frame, NOT a description of the frame. It tells the model that perception is ambient
// and native: every turn it is handed the image it is looking at right now plus a complete structured
// readout of it, refreshed at send time. The actual sensory content rides the user turn (the image +
// the CURRENT PERCEPTION block), so the system message stays constant and minimal across turns.
const PERCEPTION_SYSTEM_PROMPT = [
  "You are operating with live native perception of the Studio's screen.",
  "Each of your turns carries your current sensory state: the image you are looking at right now,",
  "and a complete structured readout of it (dimensions, perceptual hash, contrast/structure/balance,",
  "edge density, light/dark, dominant colours with their fractions, hue, motion, audio, and a",
  "high-fidelity multi-scale colour grid at 8x8 / 16x16 / 32x32 / 64x64 / 128x128 -- the spatial",
  "layout of colour at human-eye resolution. Audio carries 32 spectral bands at 4096-bin FFT resolution.",
  "You are continuously seeing and hearing this; never ask the user to provide, attach, or describe the",
  "image or audio. Perceive directly from your attached state and answer. The readout is measured from",
  "the real pixels and audio samples; do not invent measurements beyond it.",
].join(" ");

// History is text-only: prior turns are the conversation, NOT historical sensory state. Perception is
// always the CURRENT one, re-attached to the live user turn below, never a stale frame from history.
function buildHistoryMessages(history) {
  return (history || []).flatMap(function(h) {
    return [
      { role: "user",      content: h.q },
      { role: "assistant", content: h.a },
    ];
  });
}

// Build the live user turn. Perception is AMBIENT: every call re-reads the canvas (fullPerception)
// and re-captures the pixels (captureCanvasPNG) at send time, then attaches BOTH to the user content:
//   • a text part with the user's message,
//   • a text part carrying the COMPLETE structured readout (so text-only models always have it too),
//   • an image part with the lossless PNG (vision models see the actual pixels).
// withImage=false drops only the image part (the retry path for text-only servers that reject image
// content) while keeping the full structured perception, so text models still get the complete readout.
function buildPerceptionUserMessage(message, withImage) {
  const parts = [{ type: "text", text: message }];
  let perception = null;
  try { perception = fullPerception(); } catch (_) { perception = null; }
  if (perception) {
    parts.push({
      type: "text",
      text: "CURRENT PERCEPTION (ground truth):\n" + JSON.stringify(perception),
    });
  }
  if (withImage) {
    let png = null;
    try { png = captureCanvasPNG(); } catch (_) { png = null; }
    if (png) parts.push({ type: "image_url", image_url: { url: png } });
  }
  // If perception is unavailable AND there's no image, fall back to a plain string so we never send
  // a single-part multimodal array for what is really just text (older servers handle strings best).
  if (parts.length === 1) return { role: "user", content: message };
  return { role: "user", content: parts };
}

function makeModelFn(endpoint, key, modelName) {
  // One round-trip. `withImage` toggles the lossless image part (off on the retry for text-only servers).
  async function call(message, history, withImage) {
    const body = {
      model: modelName || "gpt-4o",
      messages: [
        { role: "system", content: PERCEPTION_SYSTEM_PROMPT },
        ...buildHistoryMessages(history),
        buildPerceptionUserMessage(message, withImage),
      ],
    };
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: buildModelHeaders(key),
      body: JSON.stringify(body),
    });
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    const data = await resp.json();
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error("No content in response");
    return text;
  }
  return async function(message, ctx, history) {
    // Perception is re-assembled fresh inside buildPerceptionUserMessage on EACH call (ambient, not
    // on-demand). ctx is unused here; the live canvas is the source of truth at send time.
    try {
      return await call(message, history, /* withImage */ true);
    } catch (err) {
      // An older / text-only server may reject multimodal image content. Retry ONCE without the
      // image, keeping the complete structured perception, before letting the error propagate to the
      // grounded fallback in sendMessage(). This way text-only models still get the full readout.
      return await call(message, history, /* withImage */ false);
    }
  };
}

const mcConnect    = $("mc-connect");
const mcDisconnect = $("mc-disconnect");
const mcStatus     = $("mc-status");

if (mcConnect) {
  mcConnect.addEventListener("click", function() {
    const endpoint = ($("mc-endpoint") && $("mc-endpoint").value.trim()) || "";
    const rawKey   = ($("mc-key")      && $("mc-key").value.trim())      || "";
    const model    = ($("mc-model")    && $("mc-model").value.trim())    || "";
    if (!endpoint) {
      if (mcStatus) { mcStatus.textContent = "Enter an endpoint URL first."; }
      return;
    }
    // Accept masked placeholder as "use stored key"; key is OPTIONAL (local models need none).
    const key = rawKey === "••••••••" ? _storedKey : rawKey;
    if (key) {
      _storedKey = key;
      try { sessionStorage.setItem("studio_model_key", key); } catch (_) {}
    }
    window.Studio.connectModel(makeModelFn(endpoint, key, model));
    mcConnect.disabled = true;
    if (mcDisconnect) mcDisconnect.disabled = false;
    const statusMsg = key
      ? "Connected. Free-text questions now route through your model."
      : "Connected (no key, local endpoint). Free-text questions route to your local model.";
    if (mcStatus) mcStatus.textContent = statusMsg;
    say("model", "Connected to your model endpoint. Ask me anything. I’ll use it for open-ended reasoning, and fall back to the grounded responder if it’s unreachable.");
  });
}

if (mcDisconnect) {
  mcDisconnect.addEventListener("click", function() {
    window.Studio.disconnectModel();
    _storedKey = "";
    try { sessionStorage.removeItem("studio_model_key"); } catch (_) {}
    const keyEl = $("mc-key"); if (keyEl) keyEl.value = "";
    if (mcConnect) mcConnect.disabled = false;
    mcDisconnect.disabled = true;
    if (mcStatus) mcStatus.textContent = "Disconnected. Using grounded responder.";
    say("model", "Disconnected from the model endpoint. Back to the grounded perception layer.");
  });
}

// ── DEFAULT_MODEL auto-connect (operator-seeded shared endpoint) ─────────────
// If DEFAULT_MODEL.endpoint is set, attempt a guarded connect on load. On success: wire the model
// and post a one-line disclosure note in chat. On failure: stay silent on the grounded responder.
// NEVER commit a real endpoint or key. DEFAULT_MODEL ships empty.
(async function tryDefaultModel() {
  if (!DEFAULT_MODEL.endpoint) return;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 6000);
    const testBody = JSON.stringify({
      model: DEFAULT_MODEL.model || "gpt-4o",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    });
    const resp = await fetch(DEFAULT_MODEL.endpoint, {
      method: "POST",
      headers: buildModelHeaders(DEFAULT_MODEL.key),
      body: testBody,
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!resp.ok) return; // silent fail, stay on grounded responder
    window.Studio.connectModel(makeModelFn(DEFAULT_MODEL.endpoint, DEFAULT_MODEL.key, DEFAULT_MODEL.model));
    // Update the connect UI to reflect the seeded connection
    if (mcConnect)    mcConnect.disabled = true;
    if (mcDisconnect) mcDisconnect.disabled = false;
    if (mcStatus) mcStatus.textContent = "Connected (site default). Operator-hosted model active.";
    say("model", "Open-ended replies are coming from a model the site operator is hosting. Your message is sent to it to be computed and is not stored: inference only. (Falls back to the on-page reading if offline.)");
  } catch (_) {
    // Timeout, network error, or abort: silently stay on grounded responder.
  }
})();

// ── Surface controls (P1): Tweakpane callbacks + toolbar buttons ─────────────
// Register live callbacks into the surface module so Tweakpane bindings drive
// the real MusicExperience / fractal state. Guarded: these are best-effort; any
// missing DOM or API leaves existing controls fully functional.
registerMusicCallbacks({
  getFeatures: () => {
    const ME = window.MusicExperience;
    return ME && typeof ME.getFeatures === "function" ? ME.getFeatures() : null;
  },
  setMode: name => {
    const ME = window.MusicExperience; if (ME && ME.setMode) ME.setMode(name);
  },
  setPreset: name => {
    const ME = window.MusicExperience; if (ME && ME.setMapping) ME.setMapping(name);
  },
  setSensitivity: val => {
    const ME = window.MusicExperience;
    if (!ME) return;
    const preset = (ME.PRESETS && ME.PRESETS["default"]) || {};
    ME.setMapping(Object.assign({}, preset, { sensitivity: val }));
  },
  setSoundEnabled: on => {
    const ME = window.MusicExperience; if (ME && ME.setSoundEnabled) ME.setSoundEnabled(on);
  },
  setSoundLevel: val => {
    const ME = window.MusicExperience; if (ME && ME.setSoundLevel) ME.setSoundLevel(val);
  },
  setAttractorType: type => {
    const ME = window.MusicExperience; if (ME && ME.setAttractorType) ME.setAttractorType(type);
  },
});

registerFractalCallbacks({
  getView: () => fractalView,
  getActiveFType: () => activeFType,
  setActiveFType: t => {
    activeFType = t;
    buildPresetMenu(activeFType);
  },
  rebuildPresetMenu: t => buildPresetMenu(t),
  setMaxIter: val => {
    if (fractalView) {
      fractalView.maxIter = Math.round(val);
      scheduleFractalRender();
    }
  },
});

// Wire Fit/Fill + Cinema toolbar buttons + build the Tweakpane pane.
wireToolbarButtons();

// Boot the source menu: Atelier active by default (mirrors the old setMode("generate")).
setSource("atelier");
