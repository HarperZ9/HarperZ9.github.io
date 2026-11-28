// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
//
// system/floor-wasm-runner.js
// Live Interactive 10-Domain Unified Studio & 7-Kernel BuildLang WASM Runner mounted on /floor.html.
// Shares ONE live reactive state bus (system/studio-state-bus.js) across all 10 cohesive domains:
// 1. Tools, 2. Engine, 3. Exhibit, 4. Motion & Film, 5. Data & Visualizer, 6. Sound,
// 7. Ink & Water, 8. Mosaic, 9. Type & Lettering, 10. Light & Glass.

import { mountAllReposPanel } from "./studio-all-repos-panel.js";
import { registerUnifiedExporters, mountUnifiedExportHub } from "./exporters-unified.js";
import { TEN_DOMAINS, getSharedStudioBus } from "./studio-state-bus.js";

export { TEN_DOMAINS };

export const FLOOR_WASM_KERNELS = Object.freeze([
  { id: "supertool_kernel", label: "Supertool Core", platform: "Tools / Engine / Flywheel / CMMNS", file: "supertool_kernel.wasm" },
  { id: "estuary_kernel", label: "Estuary Lantern", platform: "Exhibit / Motion / Data", file: "estuary_kernel.wasm" },
  { id: "plotter_loom_kernel", label: "Plotter + Loom", platform: "Mosaic / Fabrication", file: "plotter_loom_kernel.wasm" },
  { id: "type_forge_kernel", label: "Type Forge", platform: "Type & Lettering", file: "type_forge_kernel.wasm" },
  { id: "glass_optics_kernel", label: "Glass Optics", platform: "Light & Glass", file: "glass_optics_kernel.wasm" },
  { id: "fluid_well_kernel", label: "Fluid Well", platform: "Ink & Water", file: "fluid_well_kernel.wasm" },
  { id: "daw_synth_kernel", label: "Coastal DAW", platform: "Sound", file: "daw_synth_kernel.wasm" },
]);

const NOOP_ENV_TARGET = {
  print_i32: () => {},
  print_i64: () => {},
  print_u64: () => {},
  print_f64: () => {},
  print_bool: () => {},
  print_str: () => {},
  print_newline: () => {},
};

export const WASM_NOOP_ENV = Object.freeze({
  env: new Proxy(NOOP_ENV_TARGET, {
    get: (target, prop) => (prop in target ? target[prop] : () => {}),
  }),
});

export function probeKernelExports(id, k, params = {}) {
  if (!k || typeof k !== "object") {
    return { id, ok: false, summary: "kernel not loaded", metrics: {} };
  }
  const mix = Math.max(0, Math.min(1, Number(params.mix ?? params.mosaicMix ?? 0.5)));
  const iorA = Math.max(1.3, Math.min(2.4, Number(params.iorA ?? params.optics?.iorA ?? 1.5046)));
  const cutoff = Math.max(300, Math.min(6000, Number(params.cutoff ?? params.audio?.cutoff ?? 1800)));
  const wetness = Math.max(0, Math.min(1, Number(params.wetness ?? params.fluid?.wetness ?? mix)));
  const selfCheck = typeof k.main === "function" ? k.main() : 0;

  if (id === "supertool_kernel") {
    const ior550 = k.cauchy_ior(0.55, iorA, 0.0042);
    const km = k.km_reflectance(0.15 + mix * 0.7, 1.0);
    const quorum = k.bft_quorum_check(5, 7);
    const verdict = k.flywheel_verdict(0.01, 0.05, 0.14);
    const hash = k.scene_fnv1a(101, 720, 260, 1) >>> 0;
    const ok = selfCheck === 0 && Number.isFinite(ior550) && quorum === 1 && verdict === 1;
    return {
      id,
      ok,
      summary: `IOR=${ior550.toFixed(4)} KM=${km.toFixed(3)} BFT=${quorum} hash=0x${hash.toString(16).padStart(8, "0")}`,
      metrics: { selfCheck, ior550, km, quorum, verdict, hash },
    };
  }

  if (id === "estuary_kernel") {
    const lum = k.perret_lantern_total_luminance(mix * Math.PI * 2, Math.PI / 4, 555.0);
    const b0 = k.betti0_components(6, 4);
    const b1 = k.betti1_cycles(6, 7, 2);
    const md = k.metamer_delta(0.4, 0.5, 0.6, 0.4, 0.5, 0.6, mix);
    const ok = selfCheck === 0 && Number.isFinite(lum) && lum > 10 && b0 === 2 && b1 === 3;
    return {
      id,
      ok,
      summary: `lantern=${lum.toFixed(2)} metamer=${md.toFixed(3)} b0=${b0} b1=${b1}`,
      metrics: { selfCheck, lum, md, b0, b1 },
    };
  }

  if (id === "plotter_loom_kernel") {
    const spacing = k.luma_to_hatch_spacing(mix, 0.4, 2.4, 1.0);
    const density = k.hatch_density_lines_per_cm(mix, 0.5, 2.5);
    const twill = k.weave_cell(1, 0, 1);
    const relief = k.relief_height_quantize(mix, 5, 4.0);
    const ok = selfCheck === 0 && Number.isFinite(spacing) && spacing >= 0.4 && spacing <= 2.4;
    return {
      id,
      ok,
      summary: `hatch=${spacing.toFixed(2)}mm (${density.toFixed(1)}/cm) twill=${twill} relief=${relief.toFixed(1)}mm`,
      metrics: { selfCheck, spacing, density, twill, relief },
    };
  }

  if (id === "type_forge_kernel") {
    const bez = k.cubic_bezier(10.0, 30.0, 70.0, 100.0, mix);
    const valid = k.validate_counter_weight(90.0, 600.0);
    const ratio = k.counter_ratio(90.0, 600.0);
    const kernAV = k.kerning_pair_delta(65, 86);
    const ok = selfCheck === 0 && Number.isFinite(bez) && valid === 1 && kernAV === -75.0;
    return {
      id,
      ok,
      summary: `bezier=${bez.toFixed(1)} counter=${ratio.toFixed(2)} kern(AV)=${kernAV}`,
      metrics: { selfCheck, bez, valid, ratio, kernAV },
    };
  }

  if (id === "glass_optics_kernel") {
    const luneN = k.luneburg_ior(mix);
    const bend = k.luneburg_ray_bend(0.4, 1.0);
    const sinT = k.snell_sin_theta_t(0.5, 1.0, iorA);
    const blT = k.beer_lambert_transmittance(0.45, 0.8, 1.5);
    const airyR = k.airy_thin_film_reflectance(1.38, 220 + mix * 460, 0.9, 550.0, 0.04);
    const ok = selfCheck === 0 && Number.isFinite(luneN) && luneN >= 1.0 && sinT > 0 && blT > 0 && blT <= 1;
    return {
      id,
      ok,
      summary: `Luneburg n=${luneN.toFixed(3)} sin(t)=${sinT.toFixed(3)} BL=${blT.toFixed(3)} Airy=${airyR.toFixed(3)}`,
      metrics: { selfCheck, luneN, bend, sinT, blT, airyR },
    };
  }

  if (id === "fluid_well_kernel") {
    const freq = 1.0 + mix * 2.5;
    const vx = k.curl_noise_vx(0.35, 0.72, freq, 1.0);
    const vy = k.curl_noise_vy(0.35, 0.72, freq, 1.0);
    const div = k.curl_noise_divergence(0.35, 0.72, freq, 1.0);
    const fx = k.vorticity_confinement_fx(0.4, -0.3, 1.2, 0.8, 0.016);
    const kmWet = k.km_wet_well_blend(0.25, 1.0, 0.85, 0.65, 0.5, wetness);
    const ok = selfCheck === 0 && Number.isFinite(vx) && Number.isFinite(vy) && Math.abs(div) < 1e-3 && kmWet >= 0;
    return {
      id,
      ok,
      summary: `curl=(${vx.toFixed(3)},${vy.toFixed(3)}) div=${div.toExponential(1)} vortX=${fx.toFixed(3)} KMwet=${kmWet.toFixed(3)}`,
      metrics: { selfCheck, vx, vy, div, fx, kmWet },
    };
  }

  if (id === "daw_synth_kernel") {
    const alpha = k.one_pole_lpf_alpha(cutoff, 44100);
    const ks = k.karplus_strong_step(0.6, -0.2, 0.96);
    const chord = k.coastal_jazz_chord_sample(0.08 + mix * 0.2, 220.0, 0);
    const filt = k.resonant_lpf_step(chord, 0.1, 0.05, 0.35, alpha);
    const rms = k.rms_4_samples(chord, filt, ks, 0.25);
    const lufs = k.lufs_from_rms(Math.max(1e-6, rms));
    const ok = selfCheck === 0 && alpha > 0 && alpha < 1 && Number.isFinite(lufs);
    return {
      id,
      ok,
      summary: `alpha=${alpha.toFixed(3)} KS=${ks.toFixed(3)} RMS=${rms.toFixed(3)} ${lufs.toFixed(1)} LUFS`,
      metrics: { selfCheck, alpha, ks, chord, filt, rms, lufs },
    };
  }

  return { id, ok: false, summary: `unknown kernel: ${id}`, metrics: {} };
}

export function probeAllKernels(kernelMap, params = {}) {
  const results = FLOOR_WASM_KERNELS.map((meta) => {
    const exportsObj = kernelMap instanceof Map ? kernelMap.get(meta.id) : kernelMap?.[meta.id];
    return { ...meta, ...probeKernelExports(meta.id, exportsObj, params) };
  });
  const passed = results.filter((r) => r.ok).length;
  return { total: results.length, passed, allOk: passed === results.length, results };
}

function injectScopedStyles() {
  if (document.getElementById("floor-wasm-runner-css")) return;
  const style = document.createElement("style");
  style.id = "floor-wasm-runner-css";
  style.textContent = `
.floor-live-runner {
  margin: 1.5rem 0 2rem;
  border-top: 1px solid currentColor;
  border-bottom: 1px solid currentColor;
  padding: 1rem 0 1.25rem;
}
.flr-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.4rem 1rem;
  margin-bottom: 0.65rem;
}
.flr-head h2 { margin: 0; font-size: 1.05rem; letter-spacing: 0.04em; text-transform: uppercase; }
.flr-status { font: 0.8rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; opacity: 0.88; }
.flr-bus-bar {
  font: 0.78rem/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 0.35rem 0;
  margin-bottom: 0.55rem;
  border-top: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent);
  word-break: break-word;
}
.flr-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin: 0 0 0.75rem;
  padding-bottom: 0.65rem;
  border-bottom: 1px solid color-mix(in srgb, currentColor 22%, transparent);
}
.flr-tab {
  appearance: none;
  background: transparent;
  color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 35%, transparent);
  padding: 0.28rem 0.58rem;
  font: 0.8rem/1.2 inherit;
  cursor: pointer;
}
.flr-tab[aria-selected="true"] {
  background: currentColor;
  border-color: currentColor;
}
.flr-tab[aria-selected="true"] span { color: Canvas; }
.flr-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 1rem;
  align-items: start;
}
@media (max-width: 760px) {
  .flr-grid { grid-template-columns: minmax(0, 1fr); }
}
.flr-canvas {
  display: block;
  width: 100%;
  height: auto;
  border: 1px solid color-mix(in srgb, currentColor 28%, transparent);
  background: #09131d;
}
.flr-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 0.55rem 0.9rem;
  margin-top: 0.6rem;
  font-size: 0.82rem;
}
.flr-controls label { display: inline-flex; align-items: center; gap: 0.35rem; }
.flr-controls input[type="text"] {
  background: transparent;
  color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 38%, transparent);
  padding: 0.2rem 0.4rem;
  font: inherit;
  width: 8.5rem;
}
.flr-matrix {
  width: 100%;
  border-collapse: collapse;
  font: 0.76rem/1.35 ui-monospace, SFMono-Regular, Menlo, monospace;
}
.flr-matrix th, .flr-matrix td {
  text-align: left;
  padding: 0.26rem 0.36rem;
  border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
  vertical-align: top;
}
.flr-ok { font-weight: 600; }
.flr-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem 0.75rem;
  margin-top: 0.85rem;
  padding-top: 0.75rem;
  border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent);
}
.flr-btn {
  appearance: none;
  background: transparent;
  color: inherit;
  border: 1px solid currentColor;
  padding: 0.32rem 0.65rem;
  font: 0.8rem/1.2 inherit;
  cursor: pointer;
  text-decoration: none;
}
.flr-cockpit {
  margin-top: 0.9rem;
  padding-top: 0.8rem;
  border-top: 1px solid color-mix(in srgb, currentColor 22%, transparent);
}
.unified-export-hub {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
}
.unified-export-hub select, .unified-export-hub button {
  background: transparent;
  color: inherit;
  border: 1px solid color-mix(in srgb, currentColor 40%, transparent);
  padding: 0.28rem 0.52rem;
  font: inherit;
}
`;
  document.head.appendChild(style);
}

function drawDomainCanvas(canvas, domainId, kernels, state) {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const w = canvas.width;
  const h = canvas.height;
  const mix = state.mosaicMix;
  const iorA = state.optics.iorA;
  const cutoff = state.audio.cutoff;
  const wetness = state.fluid.wetness;

  ctx.fillStyle = state.palette[0] || "#09131d";
  ctx.fillRect(0, 0, w, h);

  const st = kernels.get("supertool_kernel");
  const est = kernels.get("estuary_kernel");
  const plt = kernels.get("plotter_loom_kernel");
  const typ = kernels.get("type_forge_kernel");
  const gls = kernels.get("glass_optics_kernel");
  const fld = kernels.get("fluid_well_kernel");
  const daw = kernels.get("daw_synth_kernel");

  if (domainId === "light-glass") {
    const wls = [
      { um: 0.65, nm: 650, color: "#f26b5b" },
      { um: 0.55, nm: 550, color: "#76d18a" },
      { um: 0.45, nm: 450, color: "#58b7f0" },
    ];
    for (let r = 0; r < 7; r++) {
      const y0 = 30 + r * 33;
      const b = (r - 3) * 0.25;
      const bendL = gls ? gls.luneburg_ray_bend(b, 1.0) : b * 0.5;
      for (const wl of wls) {
        const ior = st ? st.cauchy_ior(wl.um, iorA, 0.0042) : iorA;
        const sinT = gls ? gls.snell_sin_theta_t(Math.sin(0.2 + mix * 1.1), 1.0, ior) : 0.3;
        const airy = gls ? gls.airy_thin_film_reflectance(1.38, 220 + mix * 460, 0.85, wl.nm, 0.04) : 0.1;
        const dy = (ior - 1.0) * (r - 3) * 14 + sinT * 24 + bendL * 32;
        ctx.strokeStyle = wl.color;
        ctx.lineWidth = 1.4 + airy * 2.4;
        ctx.beginPath();
        ctx.moveTo(20, y0);
        ctx.quadraticCurveTo(w * 0.5, y0 + dy * 0.45, w - 20, y0 + dy);
        ctx.stroke();
      }
    }
    const luneN = gls ? gls.luneburg_ior(mix) : 1.3;
    ctx.strokeStyle = "#d79e35";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w * 0.5, h * 0.5, 40 + (luneN - 1) * 70, 0, Math.PI * 2);
    ctx.stroke();
    return;
  }

  if (domainId === "ink-water") {
    const freq = 1.0 + mix * 2.5;
    const cols = 22, rows = 9;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = (i + 0.5) * (w / cols);
        const y = (j + 0.5) * (h / rows);
        const nx = i / cols, ny = j / rows;
        const vx = fld ? fld.curl_noise_vx(nx, ny, freq, 1.0) : Math.cos(nx * 6);
        const vy = fld ? fld.curl_noise_vy(nx, ny, freq, 1.0) : Math.sin(ny * 6);
        const kmW = fld ? fld.km_wet_well_blend(0.25, 1.0, 0.85, 0.65, nx, wetness) : 0.5;
        ctx.strokeStyle = `rgb(${Math.round(50 + kmW * 195)}, ${Math.round(145 + kmW * 85)}, 225)`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + vx * 16, y + vy * 16);
        ctx.stroke();
      }
    }
    return;
  }

  if (domainId === "mosaic") {
    const modeIdx = Math.min(3, Math.floor(mix * 4));
    const cols = 28, rows = 10;
    const cw = (w - 40) / cols, ch = (h - 40) / rows;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const lift = plt ? plt.weave_cell(x, y, modeIdx) : (x + y) % 2;
        const luma = (x / cols + y / rows) * 0.5;
        const q = plt ? plt.relief_height_quantize(luma, 5, 1.0) : luma;
        ctx.fillStyle = lift
          ? `rgb(${Math.round(180 + q * 60)}, ${Math.round(145 + q * 65)}, ${Math.round(90 + q * 60)})`
          : `rgb(${Math.round(18 + q * 38)}, ${Math.round(36 + q * 62)}, ${Math.round(58 + q * 82)})`;
        ctx.fillRect(20 + x * cw + 1, 20 + y * ch + 1, cw - 2, ch - 2);
      }
    }
    return;
  }

  if (domainId === "type") {
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.moveTo(20, h * 0.72); ctx.lineTo(w - 20, h * 0.72); ctx.stroke();
    ctx.strokeStyle = "#76d18a";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 64; i++) {
      const t = i / 64;
      const bx = typ ? typ.cubic_bezier(24, 140 + mix * 240, w - 180, w - 24, t) : 24 + t * (w - 48);
      const by = typ ? typ.cubic_bezier(h - 32, 26, h - 24 - mix * 170, 36, t) : h - 32 - t * 180;
      if (i === 0) ctx.moveTo(bx, by);
      else ctx.lineTo(bx, by);
    }
    ctx.stroke();
    const label = (state.typeText || "Accession").slice(0, 28);
    ctx.fillStyle = "#e8f0f6";
    ctx.font = "600 42px Georgia, serif";
    ctx.fillText(label, 36, h * 0.58);
    const kern = typ ? typ.kerning_pair_delta(65, 86) : -75;
    const ratio = typ ? typ.counter_ratio(90.0, 600.0).toFixed(2) : "0.70";
    ctx.fillStyle = "#d79e35";
    ctx.font = "12px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`type_forge_kernel.wasm | kern(AV)=${kern} | counter_ratio=${ratio}`, 36, h - 18);
    return;
  }

  if (domainId === "sound") {
    const alpha = daw ? daw.one_pole_lpf_alpha(cutoff, 44100) : 0.2;
    let prev = 0;
    ctx.strokeStyle = "rgba(255,255,255,0.16)";
    ctx.beginPath(); ctx.moveTo(16, h * 0.5); ctx.lineTo(w - 16, h * 0.5); ctx.stroke();
    ctx.strokeStyle = "#76d18a";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < 240; i++) {
      const t = i / 640;
      const s = daw ? daw.coastal_jazz_chord_sample(t, 220.0, mix > 0.5 ? 1 : 0) : Math.sin(t * 25);
      const f = daw ? daw.resonant_lpf_step(s, prev, prev * 0.4, 0.35, alpha) : s;
      prev = f;
      const x = 16 + (i / 239) * (w - 32);
      const y = h * 0.5 - Math.max(-1, Math.min(1, f)) * (h * 0.38);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    return;
  }

  if (domainId === "exhibit" || domainId === "motion") {
    const count = 60;
    const bw = (w - 32) / count;
    const sunAz = (domainId === "motion" ? mix * 2 : mix) * Math.PI * 2;
    for (let i = 0; i < count; i++) {
      const lum = est ? est.perret_aperture_luminance(i, sunAz, 0.35 + mix * 0.8, 460 + mix * 180) : 0.5;
      const bh = Math.max(8, Math.min(h - 42, lum * (h - 52)));
      ctx.fillStyle = domainId === "exhibit" ? "#58b7f0" : "#b89df6";
      ctx.fillRect(16 + i * bw + 1, h - 22 - bh, Math.max(2, bw - 2), bh);
    }
    return;
  }

  if (domainId === "engine" || domainId === "data") {
    const splitX = Math.round(w * (0.2 + mix * 0.6));
    for (let x = 0; x < w; x += 6) {
      const u = x / w;
      const km = st ? st.km_reflectance(0.1 + u * 1.4, 1.0) : 0.5;
      const bl = gls ? gls.beer_lambert_transmittance(0.45, 0.2 + u, 1.5) : 0.6;
      const v = x < splitX ? km : bl;
      ctx.fillStyle = x < splitX
        ? `rgb(${Math.round(30 + v * 195)}, ${Math.round(75 + v * 135)}, ${Math.round(125 + v * 110)})`
        : `rgb(${Math.round(25 + v * 165)}, ${Math.round(115 + v * 115)}, ${Math.round(90 + v * 130)})`;
      ctx.fillRect(x, 16, 5, h - 32);
    }
    ctx.strokeStyle = "#f26b5b";
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(splitX, 12); ctx.lineTo(splitX, h - 12); ctx.stroke();
    return;
  }

  // Default "tools": 7-kernel live composite strip
  const bandW = (w - 32) / 7;
  const colors = ["#d79e35", "#58b7f0", "#e3c584", "#76d18a", "#f26b5b", "#64d2c3", "#b89df6"];
  for (let k = 0; k < 7; k++) {
    const x0 = 16 + k * bandW;
    ctx.strokeStyle = "rgba(255,255,255,0.14)";
    ctx.strokeRect(x0 + 2, 14, bandW - 4, h - 28);
    ctx.strokeStyle = colors[k];
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i <= 24; i++) {
      const u = i / 24;
      let val = 0.5;
      if (k === 0 && st) val = st.km_reflectance(0.1 + u * 1.4, 1.0);
      else if (k === 1 && est) val = est.perret_aperture_luminance(i * 2, mix * Math.PI * 2, 0.78, 555.0);
      else if (k === 2 && plt) val = plt.luma_to_hatch_spacing(u, 0.4, 2.4, 0.8 + mix) / 2.4;
      else if (k === 3 && typ) val = typ.cubic_bezier(0.1, 0.9 * mix, 1.0 - 0.8 * mix, 0.9, u);
      else if (k === 4 && gls) val = gls.airy_thin_film_reflectance(1.38, 180 + u * 500, 0.88, 550.0, 0.04) * 3.0;
      else if (k === 5 && fld) val = 0.5 + 0.45 * fld.curl_noise_vx(u, mix, 1.5, 1.0);
      else if (k === 6 && daw) val = 0.5 + 0.45 * daw.coastal_jazz_chord_sample(u * 0.04, 220.0, mix > 0.5 ? 1 : 0);
      const clamped = Math.max(0.05, Math.min(0.95, Number.isFinite(val) ? val : 0.5));
      const px = x0 + 8 + u * (bandW - 16);
      const py = h - 24 - clamped * (h - 56);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(235, 242, 248, 0.88)";
    ctx.font = "11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(FLOOR_WASM_KERNELS[k].label.split(" ")[0], x0 + 8, 30);
  }
}

export async function mountFloorWasmRunner(root) {
  if (!root || root.dataset.floorRunnerMounted) return null;
  root.dataset.floorRunnerMounted = "1";
  injectScopedStyles();
  registerUnifiedExporters();

  const bus = getSharedStudioBus();
  const statusEl = root.querySelector("[data-flr-status]");
  const busBarEl = root.querySelector("[data-flr-bus]");
  const canvas = root.querySelector("#floor-wasm-canvas");
  const tbody = root.querySelector("[data-flr-tbody]");
  const tabsHost = root.querySelector("[data-flr-tabs]");
  const exportHost = root.querySelector("#floor-export-mount");
  const cockpitHost = root.querySelector("#floor-cockpit-mount");
  const cockpitBtn = root.querySelector("[data-flr-cockpit-toggle]");
  const mixInput = root.querySelector("[data-flr-mix]");
  const iorInput = root.querySelector("[data-flr-ior]");
  const wetInput = root.querySelector("[data-flr-wet]");
  const cutInput = root.querySelector("[data-flr-cutoff]");
  const typeInput = root.querySelector("[data-flr-type]");
  const playBtn = root.querySelector("[data-flr-play]");

  const kernels = new Map();
  await Promise.all(
    FLOOR_WASM_KERNELS.map(async (meta) => {
      try {
        const resp = await fetch(`/system/wasm/${meta.file}`);
        if (!resp.ok) return;
        const { instance } = await WebAssembly.instantiate(await resp.arrayBuffer(), WASM_NOOP_ENV);
        kernels.set(meta.id, instance.exports);
      } catch (_) {}
    }),
  );

  if (kernels.has("supertool_kernel")) {
    bus.setWasm(kernels.get("supertool_kernel"));
  }

  let cockpitApi = null;

  const renderState = (state) => {
    const dom = bus.domainById(state.activeDomain);
    const report = probeAllKernels(kernels, {
      mix: state.mosaicMix,
      iorA: state.optics.iorA,
      cutoff: state.audio.cutoff,
      wetness: state.fluid.wetness,
    });
    if (statusEl) {
      statusEl.textContent = `${report.passed}/${report.total} BuildLang WASM kernels live | 10 domains synced`;
    }
    if (busBarEl) {
      busBarEl.textContent =
        `Domain ${dom.label} | Bus Receipt ${state.receiptSha256} | ` +
        `IOR=${state.optics.iorA.toFixed(2)} | Wet=${state.fluid.wetness.toFixed(2)} | ` +
        `LPF=${state.audio.cutoff}Hz | Type="${state.typeText}"`;
    }
    if (tbody) {
      tbody.innerHTML = report.results
        .map((r) => `<tr><td>${r.label}</td><td class="flr-ok">${r.ok ? "PASS" : "OFFLINE"}</td><td>${r.summary}</td></tr>`)
        .join("");
    }
    if (tabsHost) {
      tabsHost.querySelectorAll("button[data-domain]").forEach((b) => {
        b.setAttribute("aria-selected", String(b.dataset.domain === state.activeDomain));
      });
    }
    drawDomainCanvas(canvas, state.activeDomain, kernels, state);
  };

  const unsub = bus.subscribe((snap) => renderState(snap));

  if (tabsHost) {
    tabsHost.addEventListener("click", (ev) => {
      const btn = ev.target?.closest?.("button[data-domain]");
      if (!btn) return;
      bus.update({ activeDomain: btn.dataset.domain }, "floor-tab");
    });
  }

  if (cockpitBtn && cockpitHost) {
    cockpitBtn.addEventListener("click", () => {
      const isHidden = cockpitHost.hasAttribute("hidden");
      if (isHidden) {
        cockpitHost.removeAttribute("hidden");
        cockpitBtn.setAttribute("aria-expanded", "true");
        if (!cockpitApi) {
          cockpitApi = mountAllReposPanel(cockpitHost, {
            canvas,
            wasm: kernels.get("supertool_kernel") || null,
          });
        }
      } else {
        cockpitHost.setAttribute("hidden", "");
        cockpitBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

  const pushControls = () => {
    const mix = Number(mixInput?.value ?? 50) / 100;
    const iorA = Number(iorInput?.value ?? 151) / 100;
    const wetness = Number(wetInput?.value ?? 45) / 100;
    const cutoff = Number(cutInput?.value ?? 1800);
    const typeText = String(typeInput?.value ?? "Accession").trim() || "Accession";
    bus.update(
      {
        mosaicMix: mix,
        elements: { mix },
        optics: { iorA },
        fluid: { wetness },
        audio: { cutoff },
        typeText,
      },
      "floor-controls",
    );
  };

  for (const el of [mixInput, iorInput, wetInput, cutInput, typeInput]) {
    if (el) el.addEventListener("input", pushControls);
  }

  if (playBtn) {
    playBtn.addEventListener("click", () => {
      try {
        const daw = kernels.get("daw_synth_kernel");
        const state = bus.getState();
        const ac = new (window.AudioContext || window.webkitAudioContext)();
        const sr = ac.sampleRate;
        const len = Math.floor(sr * 1.2);
        const buf = ac.createBuffer(1, len, sr);
        const ch = buf.getChannelData(0);
        const alpha = daw ? daw.one_pole_lpf_alpha(state.audio.cutoff, sr) : 0.2;
        let prev = 0;
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          const env = Math.min(1, t * 24) * Math.exp(-t * 2.1);
          const raw = daw ? daw.coastal_jazz_chord_sample(t, 220.0, state.mosaicMix > 0.5 ? 1 : 0) : Math.sin(2 * Math.PI * 220 * t);
          const out = daw ? daw.resonant_lpf_step(raw, prev, prev * 0.4, 0.35, alpha) : raw;
          prev = out;
          ch[i] = Math.max(-0.9, Math.min(0.9, env * 0.35 * out));
        }
        const src = ac.createBufferSource();
        src.buffer = buf;
        src.connect(ac.destination);
        src.start();
      } catch (_) {}
    });
  }

  if (exportHost) {
    mountUnifiedExportHub(exportHost, () => {
      const state = bus.getState();
      return {
        source: `floor-${state.activeDomain}`,
        canvas,
        extra: {
          source: `floor-${state.activeDomain}`,
          seed: `${state.seed}-${state.activeDomain}`,
          receiptSha256: state.receiptSha256,
          stateBus: state,
        },
      };
    });
  }

  renderState(bus.getState());
  return {
    bus,
    kernels,
    render: () => renderState(bus.getState()),
    destroy: () => {
      unsub();
      cockpitApi?.destroy?.();
    },
  };
}

if (typeof document !== "undefined") {
  const boot = () => {
    const el = document.getElementById("floor-live-runner");
    if (el) mountFloorWasmRunner(el);
  };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
}
