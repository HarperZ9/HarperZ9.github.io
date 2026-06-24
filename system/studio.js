// studio.js — the unified Studio: one canvas, two ways in (Generate via the Atelier, or Bring your own),
// then perceive/discuss/transform/refine with the model. Bridges the Atelier's canvas to the eye.
import { perceptualHash, features, hamming } from "../shared-frame/eye.js";
import { representation, richFeatures, describeFrame, rmsFromBytes, spectrumBands, dominantPitchHz } from "./sense.js";
import { respond } from "./respond.js";
import { renderFractal, PRESETS } from "./fractal.js";
import { render3D } from "./fractal3d.js";
import { sizeToDisplay } from "./canvas-scale.js";
const $ = id => document.getElementById(id);
const fmt = (v,n=3)=>typeof v==="number"?(Number.isInteger(v)?String(v):v.toFixed(n)):String(v);
// drift is per-canvas (Task 6 review carry-in): keyed by the canvas instance, so switching
// modes / sources doesn't compare against an unrelated frame and show a misleading drift.
const lastHashByCanvas = new WeakMap();
// `mode` is kept as a coarse label the measurimeter's source line reads ("your media" vs
// "the Atelier / 2D"). The five-way source menu (Task 8f) drives it via setSource().
let mode = "generate";
let activeSource = "atelier";

// ── Quality state (Task 8g) ───────────────────────────────────────────────────
// Standard: maxBacking=1600 (crisp on typical 1-2× displays, fast for per-pixel fractals).
// High:     maxBacking=2400 (sharper on large/3× displays, slower — user opt-in).
const QUALITY_LEVELS = {
  standard: { label: "Standard", maxBacking: 1600, iterMult: 1 },
  high:     { label: "High",     maxBacking: 2400, iterMult: 1.5 },
};
let qualityKey = "standard";
function currentQuality() { return QUALITY_LEVELS[qualityKey]; }
// Shared helper: size the canvas to the current quality level and return backing dims.
// The canvas CSS size is determined by its container (.viewport-stage, max-width:100%), NOT by the
// canvas.width attribute itself — so we read the parent's bounding rect to get the true display size.
function sizeCanvas(canvas) {
  // Prefer the parent's layout size (the constraining container), falling back to the canvas rect.
  const parent = canvas.parentElement;
  const ref = parent ? parent.getBoundingClientRect() : canvas.getBoundingClientRect();
  const cssW = Math.max(1, ref.width  || 1);
  const cssH = Math.max(1, ref.height || ref.width || 1);   // square stage: use width for both axes
  const dpr = window.devicePixelRatio || 1;
  const mb = currentQuality().maxBacking;
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
  byo:       { block: "src-byo",       mode: "byo" },
  watch:     { block: "src-watch",     mode: "byo" },
};

function setSource(next) {
  if (!SOURCES[next]) return;
  // Leaving the current source: stop anything it had running. Guard the calls — some are defined
  // later in the module (hoisted function declarations), so they're safe to call from here.
  if (next !== activeSource) {
    leave3D();          // restore the 2D canvas if a WebGL orbit was mounted
    stopWatch();        // release any screen/camera capture
    stopByoVideo();     // pause + release any played BYO video
    stopMeterLoop();    // idle the live meter loop until the new source restarts it
  }
  activeSource = next;
  mode = SOURCES[next].mode;
  for (const [name, cfg] of Object.entries(SOURCES)) {
    const el = $(cfg.block); if (el) el.hidden = name !== next;
  }
  document.querySelectorAll("#studio-source button").forEach(b =>
    b.setAttribute("aria-selected", String(b.dataset.source === next)));
  syncToolbarForSource();
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

// A 2D canvas can only ever yield a 2D context, and a WebGL canvas only WebGL — a canvas binds
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
  // build the message from nodes — role + text via .textContent only, never interpolated
  // into innerHTML (Task 6 review carry-in: no markup injection through role/text).
  const log = $("studio-log"); const el = document.createElement("div");
  el.className = "msg " + role;
  const who = document.createElement("span"); who.className = "who"; who.textContent = role;
  const body = document.createElement("span"); body.className = "body"; body.textContent = text;
  el.appendChild(who); el.appendChild(body);
  log.appendChild(el); log.scrollTop = log.scrollHeight;
}
window.__studioPerceive = perceive; window.__studioSay = say;   // used by the bridge (Task 7) + tests

// ── Fractal source (Task 7b) ──────────────────────────────────────────────
// Populate the preset dropdown from PRESETS (all types), filtered by the selected type chip.
const fractalPresetEl = $("fractal-preset");
let activeFType = "mandelbrot";
let fractalView = null; // Transient zoom state: a shallow copy of the selected preset, never a reference into PRESETS.

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

function renderPreset() {
  const ftype = activeFType;
  const filtered = PRESETS.filter(p => p.type === ftype);
  const idx = parseInt(fractalPresetEl.value, 10);
  const preset = filtered[isNaN(idx) ? 0 : idx];
  if (!preset) return;
  // Reset fractalView to a fresh shallow copy of the canonical preset (decouples zoom from PRESETS).
  fractalView = { ...preset };
  const canvas = $("studio-canvas");
  sizeCanvas(canvas);
  // High quality: scale up maxIter by iterMult so per-pixel detail keeps up with resolution.
  const qOpts = { ...fractalView, maxIter: Math.round(fractalView.maxIter * currentQuality().iterMult) };
  renderFractal(canvas, qOpts);
  const obs = perceive(canvas);
  const typeLabel = { mandelbrot: "Mandelbrot set", julia: "Julia set", burningship: "Burning Ship" }[fractalView.type] || fractalView.type;
  const detail = obs.features.entropy > 0.8
    ? "dense filament detail — the boundary is alive here"
    : obs.features.entropy < 0.45
      ? "clean, spacious regions with a calm centre"
      : "a mix of open field and fine boundary structure";
  const fcol = (obs.rich && obs.rich.dominantColors || []).slice(0, 3).join(", ");
  say("model",
    `${fractalView.name} — a ${typeLabel} at scale ${fractalView.scale}. `
    + `I fingerprinted it at ${obs.phash}; it reads as ${detail}`
    + (fcol ? `, dominated by ${obs.rich.hueName} (${fcol})` : ``) + `. `
    + `Max iterations: ${fractalView.maxIter}. Want to zoom into a point, swap the palette, or hand it back to the Atelier?`
  );
  startMeterLoop();   // static fractal — refresh the measurimeter, then self-idle
}

// Wire type chips — filter presets by type when chip is clicked
document.querySelectorAll("[data-ftype]").forEach(btn => {
  btn.addEventListener("click", () => {
    activeFType = btn.dataset.ftype;
    document.querySelectorAll("[data-ftype]").forEach(b => b.classList.toggle("active", b === btn));
    buildPresetMenu(activeFType);
  });
});

// Click-to-zoom on the canvas: re-center on the clicked point and halve the scale.
// Research "make it special" move #4: "Write a UI that lets the user click into secondary bulbs."
// Delegated on the stable .stage container (not the canvas node) because the 3D source swaps the
// #studio-canvas element for a fresh one — a listener bound to the node would be lost on swap.
$("studio-canvas").closest(".stage").addEventListener("click", e => {
  if (!e.target.closest("#studio-canvas")) return;
  const canvas = $("studio-canvas");
  const rect = canvas.getBoundingClientRect();
  if (!fractalView) return; // No preset selected yet (e.g. a 3D frame is showing).
  // Map click pixel → complex plane coordinate
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const W = canvas.width, H = canvas.height;
  const aspect = H / W;
  const flipY = fractalView.type === "burningship" ? -1 : 1;
  const newCx = fractalView.cx + (px / W - 0.5) * fractalView.scale;
  const newCy = fractalView.cy + flipY * (py / H - 0.5) * fractalView.scale * aspect;
  const newScale = fractalView.scale * 0.5;
  // Mutate the transient fractalView, never the canonical PRESETS.
  fractalView.cx = newCx;
  fractalView.cy = newCy;
  fractalView.scale = newScale;
  sizeCanvas(canvas);
  const qOptsZ = { ...fractalView, maxIter: Math.round(fractalView.maxIter * currentQuality().iterMult) };
  renderFractal(canvas, qOptsZ);
  const obs = perceive(canvas);
  say("model",
    `Zoomed in — now at (${newCx.toFixed(8)}, ${newCy.toFixed(8)}), scale ${newScale.toExponential(2)}. `
    + `Fingerprint: ${obs.phash}. Click again to keep diving.`
  );
  startMeterLoop();
});

$("fractal-render").addEventListener("click", renderPreset);

// Build initial menu on page load
buildPresetMenu(activeFType);

// ── 3D fractal source (Task 7c) ─────────────────────────────────────────────
// A WebGL1 raymarcher (system/fractal3d.js) paints the shared canvas, then the eye perceives one
// settled frame. A canvas binds permanently to its FIRST context type — and the Atelier (atelier.js)
// already claimed a 2D context on #studio-canvas at boot and cached it in a closure. So WebGL can't
// bind to that element. The fix: keep the original Atelier-owned canvas aside; when entering 3D,
// detach it and mount a fresh GL canvas in its place; when leaving 3D, REMOUNT the original node
// (its 2D context + the Atelier's cached reference are intact). The 2D-fractal source re-queries
// #studio-canvas by id each render, so it works with whichever canvas is currently mounted.
let stop3d = null;
let canvasIsGL = false;
const originalCanvas = $("studio-canvas");   // the Atelier-bound 2D node — never destroyed

// Mount a fresh GL-capable canvas in place of whatever #studio-canvas currently is. Returns it.
// The original node is only detached (kept in originalCanvas), never discarded.
function mountGLCanvas() {
  const cur = $("studio-canvas");
  const gl = document.createElement("canvas");
  gl.id = "studio-canvas";
  // CSS size mirrors the original canvas's layout size; backing set by sizeCanvas() in render3DInto.
  gl.style.width = "100%"; gl.style.height = "100%";
  gl.width = 512; gl.height = 512;
  cur.replaceWith(gl);
  return gl;
}

// Stop any running orbit and, if a GL canvas is mounted, restore the original 2D Atelier canvas
// so getContext("2d") (perceive, Atelier, fractal.js) never returns null. Idempotent.
function leave3D() {
  if (stop3d) { stop3d(); stop3d = null; }
  if (canvasIsGL) {
    stopMeterLoop();   // the orbit is gone — stop streaming
    $("studio-canvas").replaceWith(originalCanvas);   // remount the intact 2D node
    canvasIsGL = false;
  }
}
window.__studioLeave3D = leave3D;  // tests / source-menu (Task 8f) hook

function render3DInto(opts) {
  if (stop3d) { stop3d(); stop3d = null; }   // cancel the previous orbit before starting a new one
  // Mount a fresh GL canvas (idempotent: if one is already mounted we reuse the mounted node).
  let c = canvasIsGL ? $("studio-canvas") : mountGLCanvas();
  // Size the GL canvas to the hi-DPI backing resolution (the raymarcher reads canvas.width/height).
  sizeCanvas(c);
  try {
    stop3d = render3D(c, opts).stop;
    canvasIsGL = true;
    startMeterLoop();   // the orbit animates — stream the meters so the hash changes as it turns
  } catch (e) {
    // WebGL unavailable: restore the 2D canvas and show the friendly fallback.
    leave3D();
    say("model", "3D fractals need WebGL in your browser — try the 2D fractals or the Atelier.");
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
      `A raymarched ${label}, lit in 3D and slowly orbiting. I read it at ${obs.phash} — ${relief}`
      + (col3 ? `, in ${obs.rich.hueName} (${col3})` : ``) + `. The measurimeter is live — watch the hash move as it turns. `
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

// When a 2D source renders, leave 3D FIRST (capture phase, before the source's own click handler)
// so the original 2D canvas is remounted before fractal.js / the Atelier query getContext("2d").
$("fractal-render").addEventListener("click", leave3D, true);
if ($("at-draw")) $("at-draw").addEventListener("click", leave3D, true);
// (Switching sources also stops the orbit + restores the 2D canvas — folded into setSource() above.)

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
  startMeterLoop();   // a static generated frame — the loop runs briefly then self-idles
});

// ── BYO mode (Task 8) ─────────────────────────────────────────────────────
// "Bring your own" — upload a photo/gif/video onto the shared #studio-canvas,
// then transform it taking turns with the model. Reuses perceive() and say()
// from the orchestrator above (same module scope — no duplication).

function byoCanvas() { return $("studio-canvas"); }
function byoCtx() { return byoCanvas().getContext("2d", { willReadFrequently: true }); }
let byoVideo = null;   // a played <video> from a dropped file; the live loop blits its frames

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
// Calls leave3D() first so a previous WebGL canvas is remounted as 2D before we draw.
function loadFile(file) {
  leave3D();
  stopByoVideo();   // release any previously played video first
  const url = URL.createObjectURL(file);
  if (file.type.startsWith("video")) {
    // Keep a reference so the live loop can copy each played frame onto the shared canvas.
    byoVideo = document.createElement("video"); byoVideo.src = url;
    byoVideo.loop = true; byoVideo.playsInline = true;
    byoVideo.addEventListener("loadeddata", () => {
      drawSource(byoVideo, byoVideo.videoWidth, byoVideo.videoHeight);
      const obs = perceive(byoCanvas());
      // Play it (unmuted so its audio feeds the audio meters) and stream the meters frame-by-frame.
      byoVideo.muted = false;
      byoVideo.play().then(() => { attachAudio(byoVideo); }).catch(() => {
        // autoplay-with-sound blocked: fall back to muted playback (visual meters still stream)
        byoVideo.muted = true; byoVideo.play().catch(() => {});
      });
      startMeterLoop();
      const sw = (obs.rich && obs.rich.dominantColors || []).slice(0, 3).join(", ");
      say("model", "Loaded a video — " + describeFrame(obs.rich) + (sw ? " Dominant: " + sw + "." : "")
        + " The meters stream as it plays.");
    }, { once: true });
    return;
  }
  const img = new Image();
  img.onload = () => {
    drawSource(img, img.naturalWidth, img.naturalHeight);
    const obs = perceive(byoCanvas());
    const sw = (obs.rich && obs.rich.dominantColors || []).slice(0, 3).join(", ");
    say("model", `I see your image — ${obs.width}×${obs.height}. ${describeFrame(obs.rich)}`
      + (sw ? ` Dominant: ${sw}.` : ``) + ` Fingerprint ${obs.phash}. Let's reshape it together.`);
    startMeterLoop();   // a still image — the loop runs briefly then self-idles
    URL.revokeObjectURL(url);
  };
  img.src = url;
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
  say("model", driftNote + " — fingerprint " + obs.phash + ", contrast " + fmt(obs.features.contrast) + ", structure " + fmt(obs.features.entropy) + ".");
}

async function startCapture(mode) {
  stopWatch(); // clean up any previous session
  try {
    // Request audio too — tab/system audio on screen share, the mic on camera — so the audio meters
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
      + (hasAudio ? " I can hear it too — the audio meters are live." : "")
      + " The measurimeter is streaming. Hit 'See this moment' for a snapshot reading.");
  } catch (err) {
    const msg = err && err.name === "NotAllowedError"
      ? "your browser blocked it — you can still upload a file in the drop zone above."
      : err && err.name === "NotSupportedError"
        ? "screen / camera capture isn't supported in this browser — you can still upload a file."
        : "couldn't start the capture (" + (err && err.message ? err.message : String(err)) + ") — try uploading a file instead.";
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
    if (!watchStream) { say("model", "No active capture — share your screen or camera first."); return; }
    sampleFrame();
  });
}
if ($("watch-toggle")) {
  $("watch-toggle").addEventListener("click", () => {
    if (!watchStream) { say("model", "No active capture — share your screen or camera first."); return; }
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

// (Switching sources releases the capture stream + any played video and stops streaming — folded
//  into setSource() above, so it fires for every source change, not just the old 2-way mode switch.)

// Expose for tests
window.__studioStopWatch = stopWatch;
window.__studioStartCapture = startCapture;
window.__studioSampleFrame = sampleFrame;

// ══ The MEASURIMETER (Task 8d) ═══════════════════════════════════════════════
// A live instrument panel of every channel the tooling feeds the model — the faithful n×n
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
  if (canvasIsGL) return "3D fractal";
  if (mode === "byo") return "your media";
  return "the Atelier / 2D";
}

// ── the live loop: ONE throttled rAF, cancellable, never stacked. Re-perceives the active canvas
// while a source animates (3D orbit / playing video / capture). Pauses (stops) when the frame goes
// static so we don't spin the CPU on a still frame; restarts on the next source change. The model's
// chat is untouched — this only streams the meters + #sc-phash/#sc-feats. ───────────────────────
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
  } catch (e) { /* a transient unreadable frame (e.g. canvas swap mid-tick) — skip this tick */ return; }
  // fps estimate over a 0.5s window
  fpsCount++; if (!fpsTs) fpsTs = ts; if (ts - fpsTs >= 500) { liveFps = fpsCount * 1000 / (ts - fpsTs); fpsCount = 0; fpsTs = ts; }
  // static detection: stop the loop after a stretch of identical frames
  if (phash === lastLoopPhash) { if (++staticTicks >= STATIC_STOP) { stopMeterLoop(); return; } }
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
  for (let i = 0; i < 12; i++) { const b = document.createElement("span"); b.className = "mm-bar"; sb.appendChild(b); }
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
    analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.8;
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
  const bars = spectrumBands(audioFreqBuf, 12);
  const sp = $("mm-au-spectrum");
  if (sp) { const els = sp.querySelectorAll(".mm-bar"); bars.forEach((b, i) => { if (els[i]) els[i].style.height = Math.max(2, b * 100) + "%"; }); }
  const hz = dominantPitchHz(audioFreqBuf, audioCtx.sampleRate, analyser.fftSize);
  const pf = $("mm-au-pitch"), pv = $("mm-au-pitch-v");
  if (pf) pf.style.width = Math.min(1, hz / 4000) * 100 + "%";
  if (pv) pv.textContent = hz ? hz + " Hz" : "—";
}
window.__studioAttachAudio = attachAudio;
window.__studioDetachAudio = detachAudio;

// ══ Custom dropdowns (Task 8f) ═══════════════════════════════════════════════
// No bare browser <select> on the page. Each raw select is replaced by an accessible button+listbox.
// To keep every existing binding intact, the element studio.js already targets by id (#fractal-preset,
// #topo-mode) stays a hidden STATE node that still holds <option> children — we only add a `.value`
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

  // .value get/set on the state node — mirrors a <select>. Default to the [selected] option or first.
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
// can type into. Answers are GROUNDED — they report only what the current readout licenses (the live
// #sc-* features, the rich measure bundle via describeFrame), never canned prose. Same say() as the
// rest of the Studio (role + text via .textContent — no markup injection).

// buildCtx() — snapshot the LIVE measurements at call time for respond().
// Reads directly from lastRich + the last meter tick + audio analyser state (if attached).
// No DOM scraping for the numeric values — they come from the same variables measure() wrote.
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
  if (!r.has) return "Nothing's loaded yet — pick a source on the left and generate or drop a frame, then ask me what I see.";
  const s = (input || "").toLowerCase();
  const desc = r.rich ? describeFrame(r.rich) : "";
  const colours = (r.rich && r.rich.dominantColors || []).slice(0, 3).join(", ");
  const con = num("contrast"), str = num("structure"), bal = num("balance");
  const hueBit = (r.rich && r.rich.hueName) ? `, mostly ${r.rich.hueName}${colours ? ` (${colours})` : ""}` : "";
  const ask = (...k) => k.some(w => s.includes(w));

  if (ask("colour", "color", "hue", "palette"))
    return colours ? `The dominant colours are ${colours}${r.rich && r.rich.hueName ? ` — it reads as ${r.rich.hueName}` : ""}.`
                   : "I'm not reading a strong dominant colour on this frame.";
  if (ask("contrast", "light", "dark"))
    return con != null ? `Contrast is ${fmt(con, 2)} — ${con > 0.66 ? "high, the structure is very legible" : con < 0.4 ? "low, it's soft and even" : "moderate"}.` : "I don't have a contrast reading yet.";
  if (ask("structure", "detail", "busy", "complex", "texture"))
    return str != null ? `Structure (entropy) is ${fmt(str, 2)} — ${str > 0.8 ? "richly textured, lots going on" : str < 0.45 ? "clean and simple" : "moderately detailed"}.` : "No structure reading yet.";
  if (ask("balance", "centre", "center", "symmet"))
    return bal != null ? `Balance is ${fmt(bal, 2)} — how evenly the mass sits around the centre.` : "No balance reading yet.";
  if (ask("hash", "fingerprint", "id", "same", "change", "drift")) {
    const d = $("sc-drift"); const dn = (d && !d.hidden) ? ` ${d.textContent}.` : "";
    return `My fingerprint of this frame is ${r.phash}.${dn} If it changes, the hash moves with it — that's how I know something happened.`;
  }
  if (ask("size", "big", "dimension", "resolution"))
    return `The frame is ${r.size}. I downsample it to a small faithful grid — that grid is what I actually read, shown top-right.`;
  if (ask("how", "know", "trust", "honest", "prove", "real", "see what"))
    return `Everything I say is a number you can re-derive: I read this ${r.source} frame at ${r.phash}, ${desc} Nothing's invented — the meters on the right are exactly what I'm given.`;
  if (ask("what", "see", "look", "describe", "this"))
    return `I'm looking at a ${r.size} ${r.source} frame${hueBit}. ${desc} Fingerprint ${r.phash}.`;
  if (ask("try", "next", "do", "idea", "make", "could", "suggest")) {
    let weak = "structure"; let lo = Infinity;
    for (const [k, v] of [["contrast", con], ["structure", str], ["balance", bal]]) if (v != null && v < lo) { lo = v; weak = k; }
    return `We could push it further — ${weak} is where there's most room (${lo === Infinity ? "—" : fmt(lo, 2)}). Try a transform, swap the source, or hand it to me for a turn.`;
  }
  // friendly grounded fallback
  return `Here's what I can say for sure: a ${r.size} ${r.source} frame${hueBit}, fingerprint ${r.phash}. ${desc} Ask me about its colour, contrast, structure, or what to try next.`;
}

// Question chips — tap to ask. Studio-local (grounded over the live readout, not the Atelier World).
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
    b.addEventListener("click", () => { say("you", label); say("model", groundedAnswer(query)); });
    host.appendChild(b);
  }
}
buildChatChips();

// Free-text input → genuinely responsive grounded answer via respond().
// respond(message, ctx) reads the LIVE measurements at send time (not a static snapshot),
// so the reply reflects whatever is on the canvas right now.
const chatForm = $("chat-input"), chatText = $("chat-text");
if (chatForm && chatText) {
  const sendMessage = () => {
    const v = chatText.value.trim(); if (!v) return;
    chatText.value = "";
    say("you", v);
    say("model", respond(v, buildCtx()));
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

// Fullscreen the viewport so the canvas fills the screen.
$("rt-fullscreen").addEventListener("click", () => {
  const el = viewport;
  if (document.fullscreenElement) { document.exitFullscreen && document.exitFullscreen(); return; }
  (el.requestFullscreen || el.webkitRequestFullscreen || (() => {})).call(el);
});

// Snapshot: re-perceive the frame exactly as it stands and have the model respond to THIS moment.
$("rt-snapshot").addEventListener("click", () => {
  const canvas = $("studio-canvas"); if (!canvas || !canvas.width) { say("model", "Nothing to snapshot yet — load or generate a frame first."); return; }
  const obs = perceive(canvas);
  const desc = obs.rich ? describeFrame(obs.rich) : "";
  say("model", `Snapshot taken — I froze this frame and read it at ${obs.phash}. ${desc} Ask me anything about it.`);
});

// Play/pause animated sources. The 3D orbit + capture/video loops drive the live meter loop; pausing
// stops them, resuming re-renders / re-streams. Disabled (greyed) for static sources.
let paused = false;
function toolbarAnimates() { return canvasIsGL || !!watchStream || (byoVideo && !byoVideo.paused); }
function syncToolbarForSource() {
  const pp = $("rt-playpause"); if (!pp) return;
  const animates = activeSource === "fractal3d" || activeSource === "watch" || (activeSource === "byo" && byoVideo);
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
    stopMeterLoop();
  } else {
    if (byoVideo && byoVideo.paused) { byoVideo.play().catch(() => {}); }
    if (watchVideo && watchVideo.srcObject && watchVideo.paused) { watchVideo.play().catch(() => {}); }
    if (canvasIsGL && !stop3d) { try { stop3d = render3D($("studio-canvas"), read3DOpts()).stop; } catch (e) {} }
    startMeterLoop();
  }
});

// ── Quality toolbar button (Task 8g) ──────────────────────────────────────────
// Cycles Standard → High → Standard. Standard: maxBacking=1600, fast.
// High: maxBacking=2400, higher iter count — a slower but sharper render on demand.
// Re-renders the current source at the new quality level.
function applyQualityAndRerender() {
  const valEl = $("rt-quality-val"); if (valEl) valEl.textContent = currentQuality().label;
  // Re-render the currently active source at the new quality level.
  if (activeSource === "fractal" && fractalView) {
    const canvas = $("studio-canvas");
    sizeCanvas(canvas);
    const qOpts = { ...fractalView, maxIter: Math.round(fractalView.maxIter * currentQuality().iterMult) };
    renderFractal(canvas, qOpts);
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

// ── Debounced resize: re-render the active static source at the new layout size ──────────────
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    // Only re-render sources that paint a fixed image (not the 3D orbit loop, which reads
    // canvas.width/height on every RAF frame already — it self-adjusts on the next frame).
    if (activeSource === "fractal" && fractalView) {
      const canvas = $("studio-canvas");
      sizeCanvas(canvas);
      const qOpts = { ...fractalView, maxIter: Math.round(fractalView.maxIter * currentQuality().iterMult) };
      renderFractal(canvas, qOpts);
      perceive(canvas);
    }
    // BYO still image: the drawSource path reads sizeCanvas() at draw time; re-draw the last source.
    // (Video/watch loop re-calls drawSource each tick — no action needed.)
  }, 200);
});

// ── wire the loop into the source lifecycle ──────────────────────────────────
// Animated sources start the loop; static ones run it briefly (it self-idles via STATIC_STOP).
// Initialise the idle audio meters + an empty mosaic at boot so the panel reads honestly from t=0.
audioMetersIdle();
buildMeters();
// Boot the source menu — Atelier active by default (mirrors the old setMode("generate")).
setSource("atelier");
