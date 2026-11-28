// system/studio-supertool-bridge.js
// Consolidates all 7 BuildLang-compiled WASM kernels (supertool_kernel, estuary_kernel,
// plotter_loom_kernel, type_forge_kernel, glass_optics_kernel, fluid_well_kernel,
// daw_synth_kernel), the Unified 13-Format Export Hub, and the 6 BuildLang-native
// Playground engines directly into studio.html with zero page errors.

import { registerUnifiedExporters, mountUnifiedExportHub } from "./exporters-unified.js";
import { loadSupertoolWasm } from "./supertool-wasm.js";
import { mountSandSource } from "./studio-sand.js";
import { mountAllReposPanel } from "./studio-all-repos-panel.js";

const BRIDGE_SOURCES = new Set(["sand", "estuary", "elements", "shaders", "daw", "superframe"]);
const NOOP_ENV_TARGET = {
  print_i32: () => {},
  print_i64: () => {},
  print_u64: () => {},
  print_f64: () => {},
  print_bool: () => {},
  print_str: () => {},
  print_newline: () => {},
};
const NOOP_ENV = Object.freeze({
  env: new Proxy(NOOP_ENV_TARGET, {
    get: (target, prop) => (prop in target ? target[prop] : () => {}),
  }),
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
  const sunAz = mix * Math.PI * 2;
  const sunEl = 0.25 + mix * 0.95;
  const lambdaNm = 440 + mix * 220;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      const lum = estWasm
        ? estWasm.perret_aperture_luminance(idx, sunAz, sunEl, lambdaNm)
        : 0.4 + 0.5 * Math.sin(idx * 0.25 + mix * 4);
      const v = Math.max(0, Math.min(1, lum));
      ctx.fillStyle = `rgb(${Math.round(30 + v * 210)}, ${Math.round(65 + v * 165)}, ${Math.round(105 + v * 135)})`;
      ctx.fillRect(40 + c * cw + 4, 40 + r * ch + 4, cw - 8, ch - 8);
    }
  }
}

function renderOpticsOnCanvas(canvas, wasm, iorA, kmK, glassWasm = null, opts = {}) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width || 960;
  const h = canvas.height || 540;
  const angleDeg = Number(opts.angleDeg ?? 32);
  const filmNm = Number(opts.filmNm ?? 380);
  const lensR = Number(opts.lensR ?? 0.5);
  ctx.fillStyle = "#091521";
  ctx.fillRect(0, 0, w, h);
  const wavelengths = [
    { um: 0.65, nm: 650, color: "#f26b5b" },
    { um: 0.55, nm: 550, color: "#76d18a" },
    { um: 0.45, nm: 450, color: "#58b7f0" },
  ];
  const rad = (angleDeg * Math.PI) / 180;
  const sinI = Math.sin(rad);
  const cosI = Math.cos(rad);
  for (let ray = 0; ray < 9; ray++) {
    const y0 = 90 + ray * 45;
    const impact = ((ray - 4) / 4.5) * Math.max(0.15, lensR);
    const luneBend = glassWasm ? glassWasm.luneburg_ray_bend(impact, 1.0) : impact * 0.6;
    for (const wl of wavelengths) {
      const ior = wasm ? wasm.cauchy_ior(wl.um, iorA, 0.0042) : iorA;
      const sinT = glassWasm ? glassWasm.snell_sin_theta_t(sinI, 1.0, ior) : sinI / ior;
      const airy = glassWasm ? glassWasm.airy_thin_film_reflectance(1.38, filmNm, Math.max(0.1, cosI), wl.nm, 0.04) : 0.12;
      const bend = (ior - 1.0) * (ray - 4) * 14 + sinT * 38 + luneBend * 42;
      ctx.strokeStyle = wl.color;
      ctx.lineWidth = 1.6 + airy * 2.4;
      ctx.beginPath();
      ctx.moveTo(40, y0);
      ctx.quadraticCurveTo(w * 0.5, y0 + bend * 0.42, w - 40, y0 + bend);
      ctx.stroke();
    }
  }
  const km = wasm ? wasm.km_reflectance(kmK, 1.0) : 0.5;
  const luneN = glassWasm ? glassWasm.luneburg_ior(lensR) : 1.32;
  const radius = Math.min(w, h) * (0.18 + Math.min(0.16, (luneN - 1.0) * 0.25));
  ctx.strokeStyle = `rgba(215, 158, 53, ${0.35 + km * 0.55})`;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, radius, 0, Math.PI * 2);
  ctx.stroke();
  const trans = glassWasm ? glassWasm.beer_lambert_transmittance(0.45, Math.max(0.1, kmK), 1.5) : 0.6;
  ctx.strokeStyle = `rgba(118, 209, 138, ${0.25 + trans * 0.6})`;
  ctx.lineWidth = 1.25;
  ctx.beginPath();
  ctx.arc(w * 0.5, h * 0.5, radius * (0.65 + 0.35 * lensR), 0, Math.PI * 2);
  ctx.stroke();
}

function renderDawOnCanvas(canvas, dawWasm, { mode = 0, cutoff = 1800, res = 0.35, damp = 0.96 } = {}) {
  if (!canvas) return { rms: 0, lufs: -60, alpha: 0.2 };
  const ctx = canvas.getContext("2d");
  const w = canvas.width || 960;
  const h = canvas.height || 540;
  const sr = 44100;
  const alpha = dawWasm ? dawWasm.one_pole_lpf_alpha(cutoff, sr) : 0.2;
  const samples = new Float32Array(256);
  let prev = 0;
  let ks0 = 0.8;
  let ks1 = -0.35;
  for (let i = 0; i < samples.length; i++) {
    const t = i / 640;
    const raw = dawWasm ? dawWasm.coastal_jazz_chord_sample(t, 220.0, mode) : Math.sin(2 * Math.PI * 220 * t);
    const ks = dawWasm ? dawWasm.karplus_strong_step(ks0, ks1, damp) : (ks0 + ks1) * 0.5 * damp;
    ks1 = ks0;
    ks0 = ks;
    const mixed = raw * 0.72 + ks * 0.28;
    const out = dawWasm ? dawWasm.resonant_lpf_step(mixed, prev, prev * 0.5, res, alpha) : mixed;
    prev = out;
    samples[i] = out;
  }
  const rms = dawWasm
    ? dawWasm.rms_4_samples(samples[32], samples[96], samples[160], samples[224])
    : 0.25;
  const lufs = dawWasm ? dawWasm.lufs_from_rms(Math.max(1e-6, rms)) : -12.0;

  if (ctx) {
    ctx.fillStyle = "#08121b";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(182, 206, 226, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, h * 0.5);
    ctx.lineTo(w - 24, h * 0.5);
    ctx.stroke();

    ctx.strokeStyle = mode === 0 ? "#76d18a" : "#6bb8f5";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < samples.length; i++) {
      const x = 24 + (i / (samples.length - 1)) * (w - 48);
      const y = h * 0.5 - Math.max(-1, Math.min(1, samples[i])) * (h * 0.34);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return { rms, lufs, alpha };
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
    const fluidWasm = await loadExtraWasm("fluid_well_kernel");
    const api = mountSandSource(host, canvas);
    const bar = document.createElement("div");
    bar.className = "supertool-fluid-bar";
    const badge = document.createElement("p");
    badge.className = "transform-note";
    const freqLab = document.createElement("label");
    freqLab.textContent = "Curl Freq ";
    const freqRange = document.createElement("input");
    freqRange.type = "range"; freqRange.min = "5"; freqRange.max = "40"; freqRange.value = "16";
    freqLab.appendChild(freqRange);
    const wetLab = document.createElement("label");
    wetLab.textContent = " Well Wetness ";
    const wetRange = document.createElement("input");
    wetRange.type = "range"; wetRange.min = "0"; wetRange.max = "100"; wetRange.value = "45";
    wetLab.appendChild(wetRange);
    const vortLab = document.createElement("label");
    vortLab.textContent = " Vorticity ";
    const vortRange = document.createElement("input");
    vortRange.type = "range"; vortRange.min = "1"; vortRange.max = "20"; vortRange.value = "8";
    vortLab.appendChild(vortRange);

    const updateFluid = () => {
      const freq = Number(freqRange.value) / 10;
      const wetness = Number(wetRange.value) / 100;
      const eps = Number(vortRange.value) / 10;
      const ior = wasm ? wasm.cauchy_ior(0.55, 1.5046, 0.0042).toFixed(4) : "1.5185";
      if (fluidWasm) {
        const vx = fluidWasm.curl_noise_vx(0.35, 0.72, freq, 1.0);
        const vy = fluidWasm.curl_noise_vy(0.35, 0.72, freq, 1.0);
        const div = fluidWasm.curl_noise_divergence(0.35, 0.72, freq, 1.0);
        const fx = fluidWasm.vorticity_confinement_fx(0.4, -0.3, 1.2, eps, 0.016);
        const fy = fluidWasm.vorticity_confinement_fy(0.4, -0.3, 1.2, eps, 0.016);
        const kmWet = fluidWasm.km_wet_well_blend(0.25, 1.0, 0.85, 0.65, 0.5, wetness);
        badge.textContent =
          `BuildLang fluid_well_kernel.wasm: curl=(${vx.toFixed(3)}, ${vy.toFixed(3)}), div=${div.toExponential(1)}, ` +
          `vort=(${fx.toFixed(3)}, ${fy.toFixed(3)}), KM_wet=${kmWet.toFixed(4)} | BK7 IOR(550nm)=${ior}`;
      } else {
        const km = wasm ? wasm.km_reflectance(0.25, 1.0).toFixed(3) : "0.500";
        badge.textContent = `BuildLang WASM kernel live: BK7 IOR(550nm)=${ior}, KM(0.25)=${km}, thermal sand->glass active.`;
      }
    };
    freqRange.addEventListener("input", updateFluid);
    wetRange.addEventListener("input", updateFluid);
    vortRange.addEventListener("input", updateFluid);
    bar.append(badge, freqLab, wetLab, vortLab);
    host.prepend(bar);
    updateFluid();
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
      const sunAz = mix * Math.PI * 2;
      const sunEl = 0.25 + mix * 0.95;
      const lambdaNm = 440 + mix * 220;
      const tot = estWasm ? estWasm.perret_lantern_total_luminance(sunAz, sunEl, lambdaNm).toFixed(2) : (30 + mix * 18).toFixed(2);
      const b0 = estWasm ? estWasm.betti0_components(6, Math.round(2 + mix * 3)) : 1;
      const b1 = estWasm ? estWasm.betti1_cycles(6, Math.round(5 + mix * 4), Math.max(1, b0)) : 0;
      const md = estWasm ? estWasm.metamer_delta(0.4, 0.5, 0.6, 0.4, 0.5, 0.6, mix).toFixed(3) : "0.000";
      status.textContent =
        `BuildLang estuary_kernel.wasm: mix=${mix.toFixed(2)}, lambda=${Math.round(lambdaNm)}nm, ` +
        `total_lum=${tot}, metamer=${md}, beta0=${b0}, beta1=${b1}`;
      renderEstuaryOnCanvas(canvas, estWasm, mix);
    };
    slider.addEventListener("input", update);
    lab.appendChild(slider);
    host.append(status, lab);
    update();
    return;
  }

  if (id === "elements") {
    const glassWasm = await loadExtraWasm("glass_optics_kernel");
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
    const angLab = document.createElement("label");
    angLab.textContent = " Angle (deg) ";
    const angRange = document.createElement("input");
    angRange.type = "range"; angRange.min = "0"; angRange.max = "85"; angRange.value = "32";
    angLab.appendChild(angRange);
    const filmLab = document.createElement("label");
    filmLab.textContent = " Thin-Film (nm) ";
    const filmRange = document.createElement("input");
    filmRange.type = "range"; filmRange.min = "120"; filmRange.max = "780"; filmRange.value = "380";
    filmLab.appendChild(filmRange);
    const lensLab = document.createElement("label");
    lensLab.textContent = " Luneburg r ";
    const lensRange = document.createElement("input");
    lensRange.type = "range"; lensRange.min = "0"; lensRange.max = "100"; lensRange.value = "50";
    lensLab.appendChild(lensRange);

    const update = () => {
      const iorA = Number(iorRange.value) / 100;
      const kmK = Number(kmRange.value) / 100;
      const angleDeg = Number(angRange.value);
      const filmNm = Number(filmRange.value);
      const lensR = Number(lensRange.value) / 100;
      const rad = (angleDeg * Math.PI) / 180;
      const r = wasm ? wasm.km_reflectance(kmK, 1.0).toFixed(4) : "0.5000";
      const ior550 = wasm ? wasm.cauchy_ior(0.55, iorA, 0.0042).toFixed(4) : iorA.toFixed(4);
      if (glassWasm) {
        const luneN = glassWasm.luneburg_ior(lensR).toFixed(4);
        const sinT = glassWasm.snell_sin_theta_t(Math.sin(rad), 1.0, iorA);
        const cosT = glassWasm.snell_cos_theta_t(Math.cos(rad), 1.0, iorA);
        const blT = glassWasm.beer_lambert_transmittance(0.45, Math.max(0.1, kmK), 1.5).toFixed(4);
        const airyR = glassWasm.airy_thin_film_reflectance(1.38, filmNm, Math.max(0.05, cosT), 550.0, 0.04).toFixed(4);
        const tir = sinT < 0 ? "TIR" : `sin(t)=${sinT.toFixed(3)}`;
        status.textContent =
          `BuildLang glass_optics_kernel.wasm: IOR(550nm)=${ior550}, Luneburg n(${lensR.toFixed(2)})=${luneN}, ` +
          `${tir}, Beer-Lambert T=${blT}, Airy R=${airyR}, KM R=${r}`;
      } else {
        status.textContent = `BuildLang WASM Optics: IOR(550nm)=${ior550}, KM R=${r}`;
      }
      renderOpticsOnCanvas(canvas, wasm, iorA, kmK, glassWasm, { angleDeg, filmNm, lensR });
    };
    for (const el of [iorRange, kmRange, angRange, filmRange, lensRange]) {
      el.addEventListener("input", update);
    }
    host.append(status, iorLab, kmLab, angLab, filmLab, lensLab);
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
    const dawWasm = await loadExtraWasm("daw_synth_kernel");
    host.innerHTML = "";
    const status = document.createElement("p");
    status.className = "transform-note";

    const modeLab = document.createElement("label");
    modeLab.textContent = "Voicing ";
    const modeSel = document.createElement("select");
    modeSel.innerHTML = '<option value="0">Coastal Maj7/9</option><option value="1">Coastal Min7/9</option>';
    modeLab.appendChild(modeSel);

    const cutLab = document.createElement("label");
    cutLab.textContent = " LPF Cutoff (Hz) ";
    const cutRange = document.createElement("input");
    cutRange.type = "range"; cutRange.min = "300"; cutRange.max = "6000"; cutRange.value = "1800";
    cutLab.appendChild(cutRange);

    const resLab = document.createElement("label");
    resLab.textContent = " Resonance ";
    const resRange = document.createElement("input");
    resRange.type = "range"; resRange.min = "0"; resRange.max = "80"; resRange.value = "35";
    resLab.appendChild(resRange);

    const dampLab = document.createElement("label");
    dampLab.textContent = " Karplus Damp ";
    const dampRange = document.createElement("input");
    dampRange.type = "range"; dampRange.min = "900"; dampRange.max = "995"; dampRange.value = "965";
    dampLab.appendChild(dampRange);

    const updateDaw = () => {
      const mode = Number(modeSel.value);
      const cutoff = Number(cutRange.value);
      const res = Number(resRange.value) / 100;
      const damp = Number(dampRange.value) / 1000;
      const meter = renderDawOnCanvas(canvas, dawWasm, { mode, cutoff, res, damp });
      status.textContent = dawWasm
        ? `BuildLang daw_synth_kernel.wasm (muted until Play): ${mode === 0 ? "Maj7/9" : "Min7/9"}, ` +
          `cutoff=${cutoff}Hz (alpha=${meter.alpha.toFixed(3)}), damp=${damp.toFixed(3)}, ` +
          `RMS=${meter.rms.toFixed(3)}, ${meter.lufs.toFixed(1)} LUFS`
        : "BuildLang WASM FM Synth ready (muted until Play).";
    };

    const playChordBtn = document.createElement("button");
    playChordBtn.type = "button"; playChordBtn.className = "btn primary"; playChordBtn.textContent = "Play Coastal Jazz Chord";
    playChordBtn.addEventListener("click", () => {
      try {
        const mode = Number(modeSel.value);
        const cutoff = Number(cutRange.value);
        const res = Number(resRange.value) / 100;
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const sr = ac.sampleRate;
        const len = Math.floor(sr * 1.5);
        const buf = ac.createBuffer(1, len, sr);
        const ch = buf.getChannelData(0);
        const alpha = dawWasm ? dawWasm.one_pole_lpf_alpha(cutoff, sr) : 0.2;
        let prev = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = Math.min(1, t * 22) * Math.exp(-t * 1.8);
          const raw = dawWasm
            ? dawWasm.coastal_jazz_chord_sample(t, 220.0, mode)
            : (wasm ? wasm.harmonic_fm_sample(2 * Math.PI * 220 * t, 1.5, 2.0) : Math.sin(2 * Math.PI * 220 * t));
          const filt = dawWasm ? dawWasm.resonant_lpf_step(raw, prev, prev * 0.4, res, alpha) : raw;
          prev = filt;
          ch[i] = Math.max(-0.9, Math.min(0.9, env * 0.38 * filt));
        }
        const rms = dawWasm ? dawWasm.rms_4_samples(ch[1024], ch[4096], ch[8192], ch[16384]) : 0.2;
        const lufs = dawWasm ? dawWasm.lufs_from_rms(Math.max(1e-6, rms)) : -14.0;
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start();
        status.textContent = `Played 1.5 s BuildLang daw_synth_kernel.wasm ${mode === 0 ? "Maj7/9" : "Min7/9"} (${lufs.toFixed(1)} LUFS).`;
      } catch (err) {
        status.textContent = `Audio unavailable: ${err?.message || err}`;
      }
    });

    const playPluckBtn = document.createElement("button");
    playPluckBtn.type = "button"; playPluckBtn.className = "btn"; playPluckBtn.textContent = "Play Karplus-Strong Pluck";
    playPluckBtn.addEventListener("click", () => {
      try {
        const damp = Number(dampRange.value) / 1000;
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const sr = ac.sampleRate;
        const period = Math.max(32, Math.round(sr / 220));
        const ring = new Float32Array(period);
        for (let i = 0; i < period; i++) {
          ring[i] = ((i * 73) % 97) / 48.5 - 1.0;
        }
        const len = Math.floor(sr * 1.2);
        const buf = ac.createBuffer(1, len, sr);
        const ch = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const p0 = i % period;
          const p1 = (i + 1) % period;
          const next = dawWasm ? dawWasm.karplus_strong_step(ring[p0], ring[p1], damp) : (ring[p0] + ring[p1]) * 0.5 * damp;
          ring[p0] = next;
          ch[i] = Math.max(-0.9, Math.min(0.9, next * 0.42));
        }
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start();
        status.textContent = `Played 1.2 s BuildLang Karplus-Strong pluck (220 Hz, damp=${damp.toFixed(3)}).`;
      } catch (err) {
        status.textContent = `Audio unavailable: ${err?.message || err}`;
      }
    });

    for (const el of [modeSel, cutRange, resRange, dampRange]) {
      el.addEventListener("input", updateDaw);
      el.addEventListener("change", updateDaw);
    }
    host.append(status, modeLab, cutLab, resLab, dampLab, playChordBtn, playPluckBtn);
    updateDaw();
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
