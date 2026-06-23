// studio.js — the unified Studio: one canvas, two ways in (Generate via the Atelier, or Bring your own),
// then perceive/discuss/transform/refine with the model. Bridges the Atelier's canvas to the eye.
import { perceptualHash, features, hamming } from "../shared-frame/eye.js";
import { renderFractal, PRESETS } from "./fractal.js";
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

function perceive(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width:w, height:h } = canvas;
  const px = ctx.getImageData(0,0,w,h).data;
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
  const canvas = $("studio-canvas");
  canvas.width = 360;
  canvas.height = 360;
  renderFractal(canvas, preset);
  const obs = perceive(canvas);
  const typeLabel = { mandelbrot: "Mandelbrot set", julia: "Julia set", burningship: "Burning Ship" }[preset.type] || preset.type;
  const detail = obs.features.entropy > 0.8
    ? "dense filament detail — the boundary is alive here"
    : obs.features.entropy < 0.45
      ? "clean, spacious regions with a calm centre"
      : "a mix of open field and fine boundary structure";
  say("model",
    `${preset.name} — a ${typeLabel} at scale ${preset.scale}. `
    + `I fingerprinted it at ${obs.phash}; it reads as ${detail}. `
    + `Max iterations: ${preset.maxIter}. Want to zoom into a point, swap the palette, or hand it back to the Atelier?`
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
$("studio-canvas").addEventListener("click", e => {
  const canvas = $("studio-canvas");
  const rect = canvas.getBoundingClientRect();
  const ftype = activeFType;
  const filtered = PRESETS.filter(p => p.type === ftype);
  const idx = parseInt(fractalPresetEl.value, 10);
  const base = filtered[isNaN(idx) ? 0 : idx];
  if (!base) return;
  // Map click pixel → complex plane coordinate
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const W = canvas.width, H = canvas.height;
  const aspect = H / W;
  const flipY = base.type === "burningship" ? -1 : 1;
  const newCx = base.cx + (px / W - 0.5) * base.scale;
  const newCy = base.cy + flipY * (py / H - 0.5) * base.scale * aspect;
  const newScale = base.scale * 0.5;
  // Re-render with zoomed-in view (update the base preset values in place for chained zooms)
  filtered[isNaN(idx) ? 0 : idx].cx = newCx;
  filtered[isNaN(idx) ? 0 : idx].cy = newCy;
  filtered[isNaN(idx) ? 0 : idx].scale = newScale;
  canvas.width = 360; canvas.height = 360;
  renderFractal(canvas, filtered[isNaN(idx) ? 0 : idx]);
  const obs = perceive(canvas);
  say("model",
    `Zoomed in — now at (${newCx.toFixed(8)}, ${newCy.toFixed(8)}), scale ${newScale.toExponential(2)}. `
    + `Fingerprint: ${obs.phash}. Click again to keep diving.`
  );
});

$("fractal-render").addEventListener("click", renderPreset);

// Build initial menu on page load
buildPresetMenu(activeFType);

// canvas→eye bridge (Task 7): when the Atelier finishes a drawing, perceive the shared
// canvas and let the model greet, in plain words, exactly what it measured.
document.addEventListener("atelier:drawn", e => {
  const canvas = e.detail && e.detail.canvas; if (!canvas) return;
  const obs = perceive(canvas);
  say("model", `Here's what I see in what you generated: a ${obs.width}×${obs.height} frame, `
    + `${obs.features.entropy>0.8?"richly textured":obs.features.entropy<0.45?"clean and simple":"moderately detailed"}, `
    + `${obs.features.contrast>0.66?"high-contrast":"soft"}. My fingerprint of it is ${obs.phash}. Where shall we take it?`);
});
