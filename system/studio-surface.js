// studio-surface.js
// P1 surface controls for Telos Studio:
//   - Universal pan/zoom via panzoom (anvaka) for non-camera sources
//   - Fit/Fill toggle (object-fit contain vs cover)
//   - Cinema mode (collapse side rails)
//   - Tweakpane controls for music + 2D fractal with live monitors
//
// INVARIANT: pan/zoom is a CSS/display transform only.
// The canvas backing (canvas.width/canvas.height) is never changed by this module.
// Perception reads the full backing; the human zooms the display. Never fake data.
//
// panzoom (anvaka) version: 9.4.3, vendored at system/lib/vendor/panzoom-anvaka-9.4.3.min.js
// Loaded via <script src> UMD tag (sets window.panzoom) before this module.
//
// Tweakpane version: 4.0.5, vendored at system/lib/vendor/tweakpane-4.0.5.min.js
// Lazy-imported as ESM (named export { Pane }) on the first buildPane() call, so the ~150 KB
// vendor bundle stays off the Studio's first-load critical path (buildPane runs from a
// setTimeout after boot, so the fetch is deferred and non-blocking either way).
let TweakpanePaneCtor = null;   // set when the lazy import resolves; null = not loaded (yet or ever)
let _tweakpanePromise = null;
function loadTweakpane() {
  if (!_tweakpanePromise) {
    _tweakpanePromise = import("./lib/vendor/tweakpane-4.0.5.min.js")
      .then(m => { TweakpanePaneCtor = (m && m.Pane) || null; return TweakpanePaneCtor; })
      .catch(err => {
        // A failed vendor load leaves the pane absent; every other control keeps working.
        console.warn("studio-surface: tweakpane load failed", err);
        _tweakpanePromise = null;
        return null;
      });
  }
  return _tweakpanePromise;
}

// ============================================================================
// Section 1: pan/zoom
// ============================================================================

// Sources that have a native CAMERA (the wheel/drag drive a real camera into a 3D render, or a
// GPU/CPU pan+zoom of the complex plane) and must NOT get the flat CSS pan/zoom layer. For these,
// pointer events already drive the source's own camera; adding panzoom on top would double-intercept
// and (worse) scale a flat image instead of moving the camera through the volume.
//   - fractal / fractal3d: native complex-plane / raymarch camera (unchanged).
//   - ndim (P2 directive a): the volumetric nD renderer dollies the camera INTO the volume on wheel
//     and orbits on drag, so CSS panzoom is wrong for it. Reclassified here from the flat set.
// CSS panzoom stays ONLY for genuinely flat content: atelier drawing, BYO still image, music, watch.
const NATIVE_CAMERA_SOURCES = new Set(["fractal", "fractal3d", "ndim"]);

// The panzoom instance currently attached to the canvas stage element.
let _pzInstance = null;
// The stage element (viewport-stage). Set once on init.
let _stage = null;
// The canvas element reference (may be replaced for GL). Reattached on source change.
let _canvasEl = null;
// Last source wired for panzoom.
let _pzSource = null;

// Exported: call from studio.js after setSource() to update panzoom attachment.
// source: the new activeSource string.
// canvas: the current #studio-canvas element (may be a fresh GL canvas).
export function onSourceChange(source, canvas) {
  _canvasEl = canvas;
  if (NATIVE_CAMERA_SOURCES.has(source)) {
    detachPanzoom();
    _pzSource = source;
    return;
  }
  // For non-camera sources, attach (or keep) panzoom on the stage.
  attachPanzoom(canvas);
  _pzSource = source;
}

// Called from the Reset view button in studio.js. Clears the pan/zoom transform
// for any non-camera source. Camera sources reset their own camera; skip those.
export function resetViewTransform() {
  if (_pzInstance) {
    _pzInstance.moveTo(0, 0);
    _pzInstance.zoomAbs(0, 0, 1);
  }
}

function attachPanzoom(canvas) {
  const panzoomFn = window.panzoom;
  if (typeof panzoomFn !== "function") return;   // library not loaded
  if (!canvas) return;

  // Detach any prior instance first.
  detachPanzoom();

  // panzoom (anvaka) attaches to the element that should be transformed.
  // We transform the canvas element itself inside its overflow-hidden stage.
  // bounds: false so zoom can go beyond the stage edge (user can pan to corners).
  // smoothScroll: false for crisp immediate response.
  // filterKey: suppress all keyboard shortcuts panzoom might intercept.
  _pzInstance = panzoomFn(canvas, {
    smoothScroll: false,
    bounds: false,
    zoomDoubleClickSpeed: 2,     // double-click zooms in 2x
    maxZoom: 32,
    minZoom: 0.125,
    filterKey: function() { return true; },  // suppress panzoom keyboard handling
    beforeWheel: function(e) {
      // Only handle wheel when no modifier key is held (pure scroll = pan).
      // With Ctrl held, wheel zooms (standard browser zoom-scroll behavior).
      // This lets the fractal source's own wheel handler (which checks fractalInteractive)
      // work first; panzoom intercepts for non-fractal sources.
      return false;   // false = do not prevent; panzoom handles it
    },
  });

  _stage = canvas.closest(".stage") || canvas.parentElement;
}

function detachPanzoom() {
  if (_pzInstance) {
    try { _pzInstance.dispose(); } catch (_) {}
    _pzInstance = null;
  }
}

// Expose for external reset (the Reset view button in studio.js).
export function getPanzoomInstance() { return _pzInstance; }

// ============================================================================
// Section 2: Fit / Fill toggle
// ============================================================================
// Fit  = object-fit contain (default): canvas letterboxed inside the stage.
// Fill = object-fit cover: canvas scaled to cover the stage; may clip edges.
// This is a pure CSS change on the canvas element; the backing is never touched.

let _fitMode = "fit";   // "fit" | "fill"

export function setFitMode(mode) {
  _fitMode = mode;
  applyFitMode();
}

export function toggleFitMode() {
  _fitMode = _fitMode === "fit" ? "fill" : "fit";
  applyFitMode();
  return _fitMode;
}

export function getFitMode() { return _fitMode; }

function applyFitMode() {
  // Apply to all canvases that might be in the stage: the original 2D canvas
  // and any swapped GL canvas. Query by id so we catch the current active node.
  const canvas = document.getElementById("studio-canvas");
  const stage = document.getElementById("viewport-stage");
  if (!canvas || !stage) return;

  if (_fitMode === "fill") {
    canvas.style.objectFit = "cover";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.maxWidth = "";
    canvas.style.maxHeight = "";
  } else {
    // Revert to the default CSS (object-fit: contain via the stylesheet).
    canvas.style.objectFit = "";
    canvas.style.width = "";
    canvas.style.height = "";
    canvas.style.maxWidth = "";
    canvas.style.maxHeight = "";
  }
}

// ============================================================================
// Section 3: Cinema mode
// ============================================================================
// Collapses both side rails so the canvas spans the full viewport width.
// Distinct from OS fullscreen: the page chrome stays; only the side panels fold.
// Implemented by toggling a `.cinema` class on .studio-app; CSS does the hiding.

let _cinemaActive = false;

export function toggleCinema() {
  _cinemaActive = !_cinemaActive;
  const app = document.querySelector(".studio-app");
  if (app) app.classList.toggle("cinema", _cinemaActive);
  return _cinemaActive;
}

export function setCinema(on) {
  _cinemaActive = !!on;
  const app = document.querySelector(".studio-app");
  if (app) app.classList.toggle("cinema", _cinemaActive);
}

export function isCinemaActive() { return _cinemaActive; }

// ============================================================================
// Section 4: Tweakpane pane
// ============================================================================
// A Tweakpane pane attached to the render-toolbar area. Folders per source.
// LIVE binding: each binding reads the current value every frame via monitor.
// Music monitors call MusicExperience.getFeatures() each tick.
// Fractal bindings mutate the fractalView object in studio.js via callbacks.

let _pane = null;
let _paneContainer = null;

// Callbacks registered by studio.js to read/write live state.
// Set via registerMusicCallbacks() / registerFractalCallbacks().
let _musicCallbacks = null;    // { getFeatures, setMode, setPreset, setSensitivity, setSoundEnabled, setSoundLevel, setAttractorType }
let _fractalCallbacks = null;  // { getView, setType, renderPreset, getActiveFType, setActiveFType, getPresets }

export function registerMusicCallbacks(cbs) { _musicCallbacks = cbs; }
export function registerFractalCallbacks(cbs) { _fractalCallbacks = cbs; }

// Build or rebuild the Tweakpane pane. Called once after the DOM is ready.
// Async: awaits the lazy tweakpane import first (cached after the first call).
export async function buildPane() {
  await loadTweakpane();
  if (!TweakpanePaneCtor) return;   // library not loaded (import failed)

  // Find or create a container in the render-toolbar.
  _paneContainer = document.getElementById("tp-pane-container");
  if (!_paneContainer) {
    _paneContainer = document.createElement("div");
    _paneContainer.id = "tp-pane-container";
    _paneContainer.className = "tp-pane-container";
    const toolbar = document.getElementById("render-toolbar");
    if (toolbar) {
      // Insert after the spacer (or just append).
      const spacer = toolbar.querySelector(".rt-spacer");
      if (spacer) toolbar.insertBefore(_paneContainer, spacer);
      else toolbar.appendChild(_paneContainer);
    } else {
      document.body.appendChild(_paneContainer);
    }
  }

  if (_pane) {
    try { _pane.dispose(); } catch (_) {}
    _pane = null;
  }

  _pane = new TweakpanePaneCtor({ container: _paneContainer, title: "Controls" });
  _pane.expanded = false;   // collapsed by default

  buildMusicFolder(_pane);
  buildFractalFolder(_pane);
}

// ---- Music folder ----

function buildMusicFolder(pane) {
  if (!_musicCallbacks) return;
  const cb = _musicCallbacks;

  const folder = pane.addFolder({ title: "Music", expanded: false });

  // Proxied params object that studio-surface mutates; each change calls the callback.
  const params = {
    mode: "particles",
    preset: "default",
    sensitivity: 1.0,
    soundOn: false,
    soundLevel: 0.07,
    attractorType: "clifford",
  };

  const MUSIC_MODES = ["particles", "attractor", "harmonograph", "flowfield", "spectrum"];
  const MUSIC_PRESETS = ["default", "pulse", "ambient", "bass", "bright"];
  const ATTRACTOR_TYPES = ["clifford", "dejong", "lorenz2d"];

  folder.addBinding(params, "mode", {
    label: "Mode",
    options: Object.fromEntries(MUSIC_MODES.map(m => [m, m])),
  }).on("change", ev => {
    if (cb.setMode) cb.setMode(ev.value);
    // Sync the HTML chips so both UIs stay consistent.
    syncChips("[data-music-mode]", "data-music-mode", ev.value);
    // Show/hide attractor row.
    const row = document.getElementById("music-attractor-row");
    if (row) row.hidden = ev.value !== "attractor";
  });

  folder.addBinding(params, "preset", {
    label: "Preset",
    options: Object.fromEntries(MUSIC_PRESETS.map(p => [p, p])),
  }).on("change", ev => {
    if (cb.setPreset) cb.setPreset(ev.value);
    syncChips("[data-music-preset]", "data-music-preset", ev.value);
  });

  folder.addBinding(params, "sensitivity", {
    label: "Sensitivity",
    min: 0.2, max: 3, step: 0.1,
  }).on("change", ev => {
    if (cb.setSensitivity) cb.setSensitivity(ev.value);
    const el = document.getElementById("music-sens-val");
    if (el) el.textContent = ev.value.toFixed(1);
    const sl = document.getElementById("music-sensitivity");
    if (sl) sl.value = String(ev.value);
  });

  folder.addBinding(params, "soundOn", { label: "Sound on" }).on("change", ev => {
    if (cb.setSoundEnabled) cb.setSoundEnabled(ev.value);
    const btn = document.getElementById("music-sound-toggle");
    if (btn) {
      btn.setAttribute("aria-pressed", String(ev.value));
      btn.textContent = ev.value ? "Sound on" : "Sound off";
    }
  });

  folder.addBinding(params, "soundLevel", {
    label: "Level",
    min: 0, max: 1, step: 0.01,
  }).on("change", ev => {
    if (cb.setSoundLevel) cb.setSoundLevel(ev.value);
    const sl = document.getElementById("music-sound-level");
    if (sl) sl.value = String(ev.value);
  });

  folder.addBinding(params, "attractorType", {
    label: "Attractor",
    options: Object.fromEntries(ATTRACTOR_TYPES.map(t => [t, t])),
  }).on("change", ev => {
    if (cb.setAttractorType) cb.setAttractorType(ev.value);
    syncChips("[data-attr-type]", "data-attr-type", ev.value);
  });

  // Live feature monitors (read-only). Updated each animation frame via
  // startMonitorLoop() below. Use Tweakpane monitor bindings.
  const monParams = { level: 0, centroid: 0, chroma0: 0, tempo: 0 };

  folder.addBlade({ view: "separator" });
  const monFolder = folder.addFolder({ title: "Live features", expanded: true });

  monFolder.addBinding(monParams, "level", {
    label: "Level",
    readonly: true,
    view: "graph",
    min: 0, max: 1,
  });
  monFolder.addBinding(monParams, "centroid", {
    label: "Centroid",
    readonly: true,
    view: "graph",
    min: 0, max: 1,
  });
  monFolder.addBinding(monParams, "chroma0", {
    label: "Chroma [C]",
    readonly: true,
    view: "graph",
    min: 0, max: 1,
  });
  monFolder.addBinding(monParams, "tempo", {
    label: "Tempo (bpm)",
    readonly: true,
  });

  // Store reference so the update loop can write to monParams.
  _musicMonParams = monParams;
  _musicMonFolder = monFolder;
  _musicMonCb = cb;
}

// Store references for the monitor update loop.
let _musicMonParams = null;
let _musicMonFolder = null;
let _musicMonCb = null;

// ---- Fractal folder ----

function buildFractalFolder(pane) {
  if (!_fractalCallbacks) return;
  const cb = _fractalCallbacks;

  const folder = pane.addFolder({ title: "2D Fractal", expanded: false });

  const FRACTAL_TYPES = ["mandelbrot", "julia", "burningship"];
  const params = {
    type: "mandelbrot",
    iterations: 128,
    palette: "spectrum",
  };

  folder.addBinding(params, "type", {
    label: "Type",
    options: Object.fromEntries(FRACTAL_TYPES.map(t => [t, t])),
  }).on("change", ev => {
    if (cb.setActiveFType) cb.setActiveFType(ev.value);
    syncChips("[data-ftype]", "data-ftype", ev.value);
    // Rebuild the preset dropdown for the new type.
    if (cb.rebuildPresetMenu) cb.rebuildPresetMenu(ev.value);
  });

  folder.addBinding(params, "iterations", {
    label: "Max iterations",
    min: 32, max: 2048, step: 16,
  }).on("change", ev => {
    if (cb.setMaxIter) cb.setMaxIter(ev.value);
  });

  _fractalPaneFolder = folder;
  _fractalPaneParams = params;
}

let _fractalPaneFolder = null;
let _fractalPaneParams = null;

// ============================================================================
// Section 5: Monitor update loop
// ============================================================================
// One rAF loop that updates Tweakpane monitor bindings at ~12 Hz.
// Only runs when the pane is expanded and the music folder is showing features.

let _monRaf = null;
const MON_HZ = 12;
const MON_MS = 1000 / MON_HZ;
let _monLastTs = 0;

function monTick(ts) {
  _monRaf = requestAnimationFrame(monTick);
  if (ts - _monLastTs < MON_MS) return;
  _monLastTs = ts;

  // Music monitor: read live features from MusicExperience.
  if (_musicMonParams && _musicMonCb && _pane) {
    const f = (_musicMonCb.getFeatures && _musicMonCb.getFeatures()) || null;
    if (f) {
      _musicMonParams.level = typeof f.level === "number" ? f.level : 0;
      _musicMonParams.centroid = typeof f.centroid === "number" ? f.centroid : 0;
      _musicMonParams.chroma0 = Array.isArray(f.chroma) && f.chroma.length > 0 ? (f.chroma[0] || 0) : 0;
      _musicMonParams.tempo = typeof f.tempo === "number" ? f.tempo : 0;
      // Refresh the pane so the graph bindings re-read monParams.
      try { _pane.refresh(); } catch (_) {}
    }
  }
}

export function startMonitorLoop() {
  if (_monRaf) return;
  if (typeof requestAnimationFrame !== "function") return;
  _monRaf = requestAnimationFrame(monTick);
}

export function stopMonitorLoop() {
  if (_monRaf != null) { cancelAnimationFrame(_monRaf); _monRaf = null; }
}

// ============================================================================
// Section 6: Helpers
// ============================================================================

// Sync HTML chip buttons so the visual state matches the Tweakpane selection.
function syncChips(selector, attr, value) {
  document.querySelectorAll(selector).forEach(b => {
    b.classList.toggle("active", b.getAttribute(attr) === value);
  });
}

// Wire the toolbar buttons for Fit/Fill and Cinema. Called once from studio.js.
export function wireToolbarButtons() {
  // Fit/Fill button.
  const ffBtn = document.getElementById("rt-fit-fill");
  if (ffBtn) {
    ffBtn.addEventListener("click", () => {
      const mode = toggleFitMode();
      const modeLabel = mode === "fill" ? "Fill" : "Fit";
      ffBtn.setAttribute("aria-pressed", String(mode === "fill"));
      // Update the label span (id="rt-fit-fill-label") if present.
      const label = document.getElementById("rt-fit-fill-label");
      if (label) label.textContent = modeLabel;
    });
  }

  // Cinema mode button.
  const cinBtn = document.getElementById("rt-cinema");
  if (cinBtn) {
    cinBtn.addEventListener("click", () => {
      const on = toggleCinema();
      cinBtn.setAttribute("aria-pressed", String(on));
    });
  }

  // Build the Tweakpane pane once the DOM is settled.
  setTimeout(buildPane, 0);
}
