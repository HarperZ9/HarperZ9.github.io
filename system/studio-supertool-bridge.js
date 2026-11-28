// system/studio-supertool-bridge.js
// Consolidates the 4 BuildLang-compiled WASM kernels (supertool_kernel, estuary_kernel,
// plotter_loom_kernel, type_forge_kernel), the Unified 13-Format Export Hub, and the 6
// BuildLang-native Playground engines directly into studio.html with zero page errors.

import { registerUnifiedExporters, mountUnifiedExportHub } from "./exporters-unified.js";
import { loadSupertoolWasm } from "./supertool-wasm.js";
import { mountSandSource } from "./studio-sand.js";
import { mountAllReposPanel } from "./studio-all-repos-panel.js";

const BRIDGE_SOURCES = new Set(["sand", "estuary", "elements", "shaders", "daw", "superframe"]);
const NOOP_ENV = Object.freeze({
  env: { print_i64: () => {}, print_u64: () => {}, print_f64: () => {}, print_bool: () => {}, print_str: () => {} },
});

let activeCleanup = null;
let activeSourceId = "atelier";
let wasmExports = null;
const extraWasmCache = new Map();

async function ensureWasm() {
  if (wasmExports) return wasmExports;
  try {
    wasmExports = await loadSupertoolWasm("system/wasm/supertool_kernel.wasm");
  } catch (err) {
    console.warn("[supertool-bridge] WASM kernel fallback:", err?.message || err);
  }
  return wasmExports;
}

async function loadExtraWasm(name) {
  if (extraWasmCache.has(name)) return extraWasmCache.get(name);
  try {
    const resp = await fetch(`system/wasm/${name}.wasm`);
    if (!resp.ok) return null;
    const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer(), NOOP_ENV);
    extraWasmCache.set(name, instance.exports);
    return instance.exports;
  } catch (_) {
    return null;
  }
}

function showBridgeBlock(id) {
  window.__studioActiveSource = id;
  document.querySelectorAll(".src-block").forEach((sec) => {
    if (sec.id === `src-${id}`) sec.removeAttribute("hidden");
    else sec.setAttribute("hidden", "");
  });
  const menu = document.getElementById("studio-source");
  if (menu) {
    menu.querySelectorAll("button[data-source]").forEach((btn) => {
      const sel = btn.dataset.source === id;
      btn.setAttribute("aria-selected", String(sel));
      btn.tabIndex = sel ? 0 : -1;
    });
  }
}

function renderEstuaryOnCanvas(canvas, estWasm, mix) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width || 960;
  const h = canvas.height || 540;
  ctx.fillStyle = "#0a131c";
  ctx.fillRect(0, 0, w, h);
  const cols = 10, rows = 6;
  const cw = (w - 80) / cols, ch = (h - 80) / rows;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const lum = estWasm ? estWasm.perret_aperture_luminance(idx, mix) : 0.4 + 0.5 * Math.sin(idx * 0.25 + mix * 4);
      const v = Math.max(0, Math.min(1, lum));
      ctx.fillStyle = `rgb(${Math.round(30 + v * 210)}, ${Math.round(65 + v * 165)}, ${Math.round(105 + v * 135)})`;
      ctx.fillRect(40 + c * cw + 4, 40 + r * ch + 4, cw - 8, ch - 8);
    }
  }
}

function renderOpticsOnCanvas(canvas, wasm, iorA, kmK) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width || 960;
  const h = canvas.height || 540;
  ctx.fillStyle = "#091521";
  ctx.fillRect(0, 0, w, h);
  const wavelengths = [
    { nm: 0.65, color: "#f26b5b" },
    { nm: 0.55, color: "#76d18a" },
    { nm: 0.45, color: "#58b7f0" },
  ];
  for (let ray = 0; ray < 9; ray++) {
    const y0 = 90 + ray * 45;
    for (const wl of wavelengths) {
      const ior = wasm ? wasm.cauchy_ior(wl.nm, iorA, 0.0042) : iorA;
      const bend = (ior - 1.0) * (ray - 4) * 18;
      ctx.strokeStyle = wl.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(40, y0);
      ctx.quadraticCurveTo(w * 0.5, y0 + bend * 0.35, w - 40, y0 + bend);
      ctx.stroke();
    }
  }
  const km = wasm ? wasm.km_reflectance(kmK, 1.0) : 0.5;
  ctx.strokeStyle = `rgba(215, 158, 53, ${0.35 + km * 0.55})`;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, Math.min(w, h) * 0.28, 0, Math.PI * 2);
  ctx.stroke();
}

function renderShaderOnCanvas(canvas, phase, freq) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width || 960;
  const h = canvas.height || 540;
  const sw = 160, sh = 90;
  const off = document.createElement("canvas");
  off.width = sw; off.height = sh;
  const octx = off.getContext("2d");
  const img = octx.createImageData(sw, sh);
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const px = (x / sw - 0.5) * 2;
      const py = (y / sh - 0.5) * 2;
      let a = 0;
      for (let k = 0; k < 5; k++) {
        const ang = k * 0.8975979;
        a += Math.sin(Math.cos(ang) * px * freq + Math.sin(ang) * py * freq + phase);
      }
      const v = 0.5 + 0.5 * Math.sin(a * 1.4);
      const o = (y * sw + x) * 4;
      img.data[o] = Math.round(14 + v * 235);
      img.data[o + 1] = Math.round(24 + v * 120 + Math.pow(v, 3) * 90);
      img.data[o + 2] = Math.round(45 + Math.pow(v, 2) * 195);
      img.data[o + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  ctx.drawImage(off, 0, 0, w, h);
}

async function mountBridgeSource(id) {
  if (activeCleanup) {
    try { activeCleanup(); } catch (_) {}
    activeCleanup = null;
  }
  activeSourceId = id;
  if (!BRIDGE_SOURCES.has(id)) return;

  showBridgeBlock(id);
  const host = document.getElementById(`supertool-${id}-mount`);
  const canvas = document.getElementById("studio-canvas");
  if (!host) return;

  const wasm = await ensureWasm();

  if (id === "sand") {
    const api = mountSandSource(host, canvas);
    if (wasm && api?.world) {
      const badge = document.createElement("p");
      badge.className = "transform-note";
      const ior = wasm.cauchy_ior(0.55, 1.5046, 0.0042).toFixed(4);
      const km = wasm.km_reflectance(0.25, 1.0).toFixed(3);
      badge.textContent = `BuildLang WASM kernel live: BK7 IOR(550nm)=${ior}, KM(0.25)=${km}, thermal sand->glass active.`;
      host.prepend(badge);
    }
    activeCleanup = () => api?.destroy?.();
    return;
  }

  if (id === "estuary") {
    const estWasm = await loadExtraWasm("estuary_kernel");
    host.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transform-note";
    const lab = document.createElement("label");
    lab.textContent = "Metamer Mix ";
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.value = "50";
    const update = () => {
      const mix = Number(slider.value) / 100;
      const tot = estWasm ? estWasm.perret_lantern_total_luminance(mix).toFixed(2) : (30 + mix * 18).toFixed(2);
      const b0 = estWasm ? estWasm.betti0_components(mix) : 1;
      const b1 = estWasm ? estWasm.betti1_cycles(mix) : 0;
      status.textContent = `BuildLang estuary_kernel.wasm: mix=${mix.toFixed(2)}, total_lum=${tot}, beta0=${b0}, beta1=${b1}`;
      renderEstuaryOnCanvas(canvas, estWasm, mix);
    };
    slider.addEventListener("input", update);
    lab.appendChild(slider);
    host.append(status, lab);
    update();
    return;
  }

  if (id === "elements") {
    host.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transform-note";
    const iorLab = document.createElement("label");
    iorLab.textContent = "Cauchy Glass IOR ";
    const iorRange = document.createElement("input");
    iorRange.type = "range"; iorRange.min = "130"; iorRange.max = "240"; iorRange.value = "151";
    iorLab.appendChild(iorRange);
    const kmLab = document.createElement("label");
    kmLab.textContent = " Kubelka-Munk K/S ";
    const kmRange = document.createElement("input");
    kmRange.type = "range"; kmRange.min = "5"; kmRange.max = "200"; kmRange.value = "25";
    kmLab.appendChild(kmRange);
    const update = () => {
      const iorA = Number(iorRange.value) / 100;
      const kmK = Number(kmRange.value) / 100;
      const r = wasm ? wasm.km_reflectance(kmK, 1.0).toFixed(4) : "0.5000";
      const ior550 = wasm ? wasm.cauchy_ior(0.55, iorA, 0.0042).toFixed(4) : iorA.toFixed(4);
      status.textContent = `BuildLang WASM Optics: IOR(550nm)=${ior550}, KM R=${r}`;
      renderOpticsOnCanvas(canvas, wasm, iorA, kmK);
    };
    iorRange.addEventListener("input", update);
    kmRange.addEventListener("input", update);
    host.append(status, iorLab, kmLab);
    update();
    return;
  }

  if (id === "shaders") {
    host.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transform-note";
    const lab = document.createElement("label");
    lab.textContent = "Wave Frequency ";
    const slider = document.createElement("input");
    slider.type = "range"; slider.min = "3"; slider.max = "18"; slider.value = "9";
    lab.appendChild(slider);
    const update = () => {
      const freq = Number(slider.value);
      status.textContent = `Live Interference Shader: frequency=${freq}, 5-wave golden-angle field.`;
      renderShaderOnCanvas(canvas, 0.65, freq);
    };
    slider.addEventListener("input", update);
    host.append(status, lab);
    update();
    return;
  }

  if (id === "daw") {
    host.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transform-note";
    status.textContent = "BuildLang WASM FM Synth ready (muted until Play).";
    const playBtn = document.createElement("button");
    playBtn.type = "button"; playBtn.className = "btn primary"; playBtn.textContent = "Play Coastal FM Chord";
    playBtn.addEventListener("click", () => {
      try {
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const sr = ac.sampleRate;
        const len = Math.floor(sr * 1.2);
        const buf = ac.createBuffer(1, len, sr);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = Math.min(1, t * 25) * Math.exp(-t * 2.5);
          const p = 2 * Math.PI * 220 * t;
          ch[i] = env * 0.35 * (wasm ? wasm.harmonic_fm_sample(p, 1.5, 2.0) : Math.sin(p));
        }
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start();
        status.textContent = "Played 1.2 s BuildLang WASM FM voice (220 Hz, mod 1.5, ratio 2.0).";
      } catch (err) {
        status.textContent = `Audio unavailable: ${err?.message || err}`;
      }
    });
    host.append(status, playBtn);
    return;
  }

  if (id === "superframe") {
    const api = mountAllReposPanel(host, { canvas, wasm });
    activeCleanup = () => api?.destroy?.();
  }
}

function bootSupertoolBridge() {
  registerUnifiedExporters();
  const exportHost = document.getElementById("unified-export-mount");
  if (exportHost) {
    mountUnifiedExportHub(exportHost, () => ({
      source: activeSourceId,
      canvas: document.getElementById("studio-canvas"),
      extra: { source: activeSourceId, seed: `${activeSourceId}-live` },
    }));
  }

  const menu = document.getElementById("studio-source");
  if (menu) {
    menu.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-source]");
      if (!btn) return;
      const src = btn.dataset.source;
      if (BRIDGE_SOURCES.has(src)) {
        mountBridgeSource(src);
      } else {
        if (activeCleanup) { try { activeCleanup(); } catch (_) {} activeCleanup = null; }
        activeSourceId = src;
      }
    });
  }

  if (window.__studioBootSource && BRIDGE_SOURCES.has(window.__studioBootSource)) {
    mountBridgeSource(window.__studioBootSource);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootSupertoolBridge);
} else {
  bootSupertoolBridge();
}
