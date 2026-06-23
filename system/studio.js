// studio.js — the unified Studio: one canvas, two ways in (Generate via the Atelier, or Bring your own),
// then perceive/discuss/transform/refine with the model. Bridges the Atelier's canvas to the eye.
import { perceptualHash, features, hamming } from "../shared-frame/eye.js";
import { renderFractal, PRESETS } from "./fractal.js";
import { render3D } from "./fractal3d.js";
const $ = id => document.getElementById(id);
const fmt = (v,n=3)=>typeof v==="number"?(Number.isInteger(v)?String(v):v.toFixed(n)):String(v);
// drift is per-canvas (Task 6 review carry-in): keyed by the canvas instance, so switching
// modes / sources doesn't compare against an unrelated frame and show a misleading drift.
const lastHashByCanvas = new WeakMap();
let mode = "generate";

function setMode(next) {
  mode = next;
  $("studio-generate").hidden = next !== "generate";
  $("studio-byo").hidden = next !== "byo";
  document.querySelectorAll("#studio-mode button").forEach(b =>
    b.setAttribute("aria-pressed", String(b.dataset.mode === next)));
}

$("studio-mode").addEventListener("click", e => {
  const b = e.target.closest("button[data-mode]"); if (b) setMode(b.dataset.mode);
});
setMode("generate");

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
  return { phash, features:f, width:w, height:h };
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
  canvas.width = 360;
  canvas.height = 360;
  renderFractal(canvas, fractalView);
  const obs = perceive(canvas);
  const typeLabel = { mandelbrot: "Mandelbrot set", julia: "Julia set", burningship: "Burning Ship" }[fractalView.type] || fractalView.type;
  const detail = obs.features.entropy > 0.8
    ? "dense filament detail — the boundary is alive here"
    : obs.features.entropy < 0.45
      ? "clean, spacious regions with a calm centre"
      : "a mix of open field and fine boundary structure";
  say("model",
    `${fractalView.name} — a ${typeLabel} at scale ${fractalView.scale}. `
    + `I fingerprinted it at ${obs.phash}; it reads as ${detail}. `
    + `Max iterations: ${fractalView.maxIter}. Want to zoom into a point, swap the palette, or hand it back to the Atelier?`
  );
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
  canvas.width = 360; canvas.height = 360;
  renderFractal(canvas, fractalView);
  const obs = perceive(canvas);
  say("model",
    `Zoomed in — now at (${newCx.toFixed(8)}, ${newCy.toFixed(8)}), scale ${newScale.toExponential(2)}. `
    + `Fingerprint: ${obs.phash}. Click again to keep diving.`
  );
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
  gl.width = 512; gl.height = 512;
  cur.replaceWith(gl);
  return gl;
}

// Stop any running orbit and, if a GL canvas is mounted, restore the original 2D Atelier canvas
// so getContext("2d") (perceive, Atelier, fractal.js) never returns null. Idempotent.
function leave3D() {
  if (stop3d) { stop3d(); stop3d = null; }
  if (canvasIsGL) {
    $("studio-canvas").replaceWith(originalCanvas);   // remount the intact 2D node
    canvasIsGL = false;
  }
}
window.__studioLeave3D = leave3D;  // tests / source-menu (Task 8f) hook

function render3DInto(opts) {
  if (stop3d) { stop3d(); stop3d = null; }   // cancel the previous orbit before starting a new one
  // Mount a fresh GL canvas (idempotent: if one is already mounted we reuse the mounted node).
  let c = canvasIsGL ? $("studio-canvas") : mountGLCanvas();
  c.width = 512; c.height = 512;
  try {
    stop3d = render3D(c, opts).stop;
    canvasIsGL = true;
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
    say("model",
      `A raymarched ${label}, lit in 3D and slowly orbiting. I read it at ${obs.phash} — ${relief}. `
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
// Switching the top-level Generate/BYO mode also stops the orbit and restores the 2D canvas.
$("studio-mode").addEventListener("click", leave3D);

// canvas→eye bridge (Task 7): when the Atelier finishes a drawing, perceive the shared
// canvas and let the model greet, in plain words, exactly what it measured.
document.addEventListener("atelier:drawn", e => {
  const canvas = e.detail && e.detail.canvas; if (!canvas) return;
  const obs = perceive(canvas);
  say("model", `Here's what I see in what you generated: a ${obs.width}×${obs.height} frame, `
    + `${obs.features.entropy>0.8?"richly textured":obs.features.entropy<0.45?"clean and simple":"moderately detailed"}, `
    + `${obs.features.contrast>0.66?"high-contrast":"soft"}. My fingerprint of it is ${obs.phash}. Where shall we take it?`);
});

// ── BYO mode (Task 8) ─────────────────────────────────────────────────────
// "Bring your own" — upload a photo/gif/video onto the shared #studio-canvas,
// then transform it taking turns with the model. Reuses perceive() and say()
// from the orchestrator above (same module scope — no duplication).

function byoCanvas() { return $("studio-canvas"); }
function byoCtx() { return byoCanvas().getContext("2d", { willReadFrequently: true }); }

// Scale src (HTMLImageElement or HTMLVideoElement) to fit within MAX, draw onto the shared canvas.
function drawSource(src, sw, sh) {
  const MAX = 360, s = Math.min(1, MAX / Math.max(sw, sh));
  const c = byoCanvas(); c.width = Math.round(sw * s); c.height = Math.round(sh * s);
  byoCtx().drawImage(src, 0, 0, c.width, c.height);
}

// Load a File, draw its first frame onto #studio-canvas, then perceive + greet.
// Calls leave3D() first so a previous WebGL canvas is remounted as 2D before we draw.
function loadFile(file) {
  leave3D();
  const url = URL.createObjectURL(file);
  if (file.type.startsWith("video")) {
    const v = document.createElement("video"); v.muted = true; v.src = url;
    v.addEventListener("loadeddata", () => {
      drawSource(v, v.videoWidth, v.videoHeight);
      perceive(byoCanvas());
      say("model", "Loaded a video frame — I'll tell you what I see as it changes.");
    }, { once: true });
    return;
  }
  const img = new Image();
  img.onload = () => {
    drawSource(img, img.naturalWidth, img.naturalHeight);
    const obs = perceive(byoCanvas());
    say("model", `I see your image — ${obs.width}×${obs.height}, fingerprint ${obs.phash}. Let's reshape it together.`);
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
