// SPDX-FileCopyrightText: 2026 Zain Dana Harper
// SPDX-License-Identifier: MIT
//
// system/studio-all-repos-panel.js
// Live interactive All-Repository Showcase cockpit mounted inside #supertool-superframe-mount
// (wired by studio-supertool-bridge.js), operating Superframe + RAW, Flywheel + Articulate,
// CMMNS + Gather + BuildOS-2.2, and BuildLang FM Audio Synth directly through supertool_kernel.wasm.

const FILLER_WORDS = new Set([
  "actually", "basically", "obviously", "simply", "just", "very", "really",
  "essentially", "literally", "arguably", "potentially", "virtually", "utilize",
]);

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export function analyzeProse(text) {
  const src = String(text ?? "");
  const emDashes = (src.match(/\u2014/g) || []).length;
  const words = src.toLowerCase().match(/[a-z0-9']+/g) || [];
  let fillerHits = 0;
  for (const w of words) {
    if (FILLER_WORDS.has(w)) fillerHits++;
  }
  return { emDashes, fillerHits, wordCount: words.length };
}

export function verdictLabel(code) {
  if (code === 1) return "VERIFIED";
  if (code === -1) return "INVALID_CONTROL";
  return "REFUTED";
}

export function fnv1aString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function chunkAndMerkle(text, wasm, chunkSize = 32) {
  const src = String(text ?? "");
  const size = Math.max(4, Math.min(256, chunkSize | 0));
  const chunks = [];
  if (!src.length) {
    chunks.push("");
  } else {
    for (let i = 0; i < src.length; i += size) chunks.push(src.slice(i, i + size));
  }
  const leaves = chunks.map((chunk, idx) => {
    const seed = fnv1aString(chunk);
    if (wasm && typeof wasm.scene_fnv1a === "function") {
      return (wasm.scene_fnv1a(seed, chunk.length, idx + 1, 1) >>> 0);
    }
    return seed >>> 0;
  });
  let level = leaves.slice();
  const combine = (l, r) => (wasm && typeof wasm.merkle_combine === "function")
    ? (wasm.merkle_combine(l >>> 0, r >>> 0) >>> 0)
    : (Math.imul(Math.imul(Math.imul(2166136261 ^ 1, 16777619) ^ (l >>> 0), 16777619) ^ (r >>> 0), 16777619) >>> 0);
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += 2) {
      const left = level[i];
      const right = i + 1 < level.length ? level[i + 1] : left;
      next.push(combine(left, right));
    }
    level = next;
  }
  const root = (level[0] ?? 0) >>> 0;
  return {
    chunks,
    leaves,
    root,
    rootHex: "0x" + root.toString(16).padStart(8, "0"),
  };
}

export function computeBftState(faultySet, totalNodes, wasm) {
  const total = Math.max(4, Math.min(16, totalNodes | 0));
  let faulty = 0;
  for (let i = 0; i < total; i++) {
    if (faultySet && faultySet.has(i)) faulty++;
  }
  const agree = total - faulty;
  const maxFaults = Math.floor((total - 1) / 3);
  const ok = (wasm && typeof wasm.bft_quorum_check === "function")
    ? wasm.bft_quorum_check(agree, total) === 1
    : (agree * 3 > total * 2);
  return {
    total,
    agree,
    faulty,
    maxFaults,
    quorum: ok,
    status: ok ? "QUORUM REACHED" : "FAIL-SAFE HALT",
  };
}

export function renderSuperframeToRgba(wasm, {
  width = 160,
  height = 90,
  sunElev = 0.28,
  roughness = 0.35,
  iorA = 1.5046,
  kmK = 0.25,
  phase = 0.0,
  splitPct = 50,
} = {}) {
  const w = Math.max(8, width | 0);
  const h = Math.max(8, height | 0);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const u32 = new Uint32Array(rgba.buffer);
  const splitX = Math.round((Math.max(0, Math.min(100, splitPct)) / 100) * w);
  let sumSq = 0;
  let maxDiff = 0;
  let compared = 0;

  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const idx = py * w + px;
      const refPx = (wasm && typeof wasm.shade_superframe_pixel === "function")
        ? (wasm.shade_superframe_pixel(px, py, w, h, sunElev, roughness, iorA, kmK, phase) >>> 0)
        : 0xff332211;
      // Fast approximation (coarser roughness + simplified dispersion) for Reference-vs-Fast split comparison.
      const fastPx = (wasm && typeof wasm.shade_superframe_pixel === "function")
        ? (wasm.shade_superframe_pixel(px, py, w, h, sunElev, Math.min(0.98, roughness + 0.12), Math.max(1.05, iorA - 0.08), kmK * 1.15, phase) >>> 0)
        : 0xff302010;
      const r1 = (refPx & 255) / 255, g1 = ((refPx >>> 8) & 255) / 255, b1 = ((refPx >>> 16) & 255) / 255;
      const r2 = (fastPx & 255) / 255, g2 = ((fastPx >>> 8) & 255) / 255, b2 = ((fastPx >>> 16) & 255) / 255;
      const d = ((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) / 3;
      sumSq += d;
      const lumaDiff = Math.abs((0.299 * (r1 - r2)) + (0.587 * (g1 - g2)) + (0.114 * (b1 - b2)));
      if (lumaDiff > maxDiff) maxDiff = lumaDiff;
      compared++;
      if (px === splitX) {
        u32[idx] = 0xff359ed7; // crisp amber vertical split hairline
      } else {
        u32[idx] = px < splitX ? refPx : fastPx;
      }
    }
  }
  const rmse = Math.sqrt(sumSq / Math.max(1, compared));
  const flipProxy = Math.min(1, rmse * 1.65 + maxDiff * 0.25);
  return { width: w, height: h, rgba, rmse, flipProxy };
}

export function synthesizeFmBuffer(wasm, {
  freqHz = 220,
  modIndex = 2.4,
  ratio = 2.0,
  sampleRate = 44100,
  durationSec = 0.65,
} = {}) {
  const sr = Math.max(8000, sampleRate | 0);
  const count = Math.max(64, Math.round(sr * Math.max(0.05, Math.min(2.0, durationSec))));
  const out = new Float32Array(count);
  const twoPi = Math.PI * 2;
  for (let i = 0; i < count; i++) {
    const t = i / sr;
    const phase = twoPi * freqHz * t;
    const raw = (wasm && typeof wasm.harmonic_fm_sample === "function")
      ? wasm.harmonic_fm_sample(phase, modIndex, ratio)
      : Math.sin(phase + modIndex * Math.sin(phase * ratio));
    const attack = Math.min(1, t / 0.015);
    const release = Math.min(1, (durationSec - t) / 0.08);
    const env = Math.max(0, Math.min(attack, release));
    out[i] = Math.max(-1, Math.min(1, raw * 0.35 * env));
  }
  return out;
}

export async function sha256Hex(payload) {
  const text = String(payload ?? "");
  try {
    if (globalThis.crypto?.subtle?.digest) {
      const bytes = new TextEncoder().encode(text);
      const buf = await globalThis.crypto.subtle.digest("SHA-256", bytes);
      return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
  } catch { /* fallback below */ }
  return "fnv-" + fnv1aString(text).toString(16).padStart(8, "0");
}

export function mountAllReposPanel(host, { canvas = null, wasm = null } = {}) {
  if (!host) return { destroy() {} };
  host.innerHTML = "";
  const root = document.createElement("section");
  root.className = "all-repos-cockpit";
  root.setAttribute("aria-label", "All-Repository BuildLang WASM Cockpit");
  root.innerHTML = `
<style>
  .all-repos-cockpit { border-top: 1px solid var(--line, rgba(244,239,230,.28)); padding-top: 12px; display: grid; gap: 12px; font-size: 0.86rem; }
  .arc-tabs { display: flex; flex-wrap: wrap; gap: 6px; border-bottom: 1px solid var(--line, rgba(244,239,230,.22)); padding-bottom: 8px; }
  .arc-tabs button { min-height: 38px; padding: 4px 11px; border: 1px solid var(--line, rgba(244,239,230,.32)); border-radius: 0; background: transparent; color: inherit; font: 600 0.78rem/1.1 var(--face-utility, monospace); cursor: pointer; }
  .arc-tabs button[aria-selected="true"] { border-color: #d79e35; background: rgba(215,158,53,.16); }
  .arc-pane { display: grid; gap: 10px; }
  .arc-pane[hidden] { display: none; }
  .arc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 8px 12px; }
  .arc-field { display: grid; gap: 3px; font: 500 0.74rem/1.2 var(--face-utility, monospace); color: var(--soft, #b8b3a8); }
  .arc-field input[type="range"] { width: 100%; accent-color: #d79e35; }
  .arc-field input[type="number"], .arc-field textarea { width: 100%; padding: 6px 8px; border: 1px solid var(--line, rgba(244,239,230,.28)); background: rgba(8,18,28,.55); color: inherit; font: 500 0.8rem/1.35 var(--face-utility, monospace); }
  .arc-readout { border-top: 1px solid var(--line, rgba(244,239,230,.22)); padding-top: 8px; font: 600 0.78rem/1.45 var(--face-utility, monospace); font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
  .arc-nodes { display: grid; grid-template-columns: repeat(auto-fill, minmax(68px, 1fr)); gap: 6px; }
  .arc-node { min-height: 36px; border: 1px solid var(--line, rgba(244,239,230,.32)); border-radius: 0; background: rgba(78,166,184,.16); color: inherit; font: 600 0.74rem/1 var(--face-utility, monospace); cursor: pointer; }
  .arc-node[aria-pressed="true"] { border-color: #e05a47; background: rgba(224,90,71,.24); }
  .arc-btn { min-height: 40px; padding: 6px 14px; border: 1px solid var(--line, rgba(244,239,230,.35)); border-radius: 0; background: rgba(215,158,53,.18); color: inherit; font: 600 0.78rem/1.1 var(--face-utility, monospace); cursor: pointer; justify-self: start; }
</style>
<div class="arc-tabs" role="tablist" aria-label="Flagship repository cores">
  <button type="button" role="tab" data-arc-tab="render" aria-selected="true">Superframe + RAW</button>
  <button type="button" role="tab" data-arc-tab="oracle" aria-selected="false">Flywheel + Articulate</button>
  <button type="button" role="tab" data-arc-tab="cluster" aria-selected="false">CMMNS + BuildOS-2.2</button>
  <button type="button" role="tab" data-arc-tab="audio" aria-selected="false">BuildLang FM Synth</button>
</div>
<div class="arc-pane" data-arc-pane="render">
  <div class="arc-grid">
    <label class="arc-field"><span>Sun Elev <output id="arc-sun-o">0.28</output></span><input id="arc-sun" type="range" min="-50" max="95" value="28"></label>
    <label class="arc-field"><span>GGX Rough <output id="arc-rough-o">0.35</output></span><input id="arc-rough" type="range" min="5" max="95" value="35"></label>
    <label class="arc-field"><span>Cauchy IOR <output id="arc-ior-o">1.505</output></span><input id="arc-ior" type="range" min="130" max="200" value="150"></label>
    <label class="arc-field"><span>KM K/S <output id="arc-km-o">0.25</output></span><input id="arc-km" type="range" min="2" max="200" value="25"></label>
    <label class="arc-field"><span>Ref/Fast Split <output id="arc-split-o">50%</output></span><input id="arc-split" type="range" min="0" max="100" value="50"></label>
  </div>
  <p class="arc-readout" id="arc-render-out" role="status" aria-live="polite">Rendering Superframe + RAW frame via BuildLang WASM...</p>
</div>
<div class="arc-pane" data-arc-pane="oracle" hidden>
  <label class="arc-field"><span>Prose sample (Articulate WASM scorer)</span><textarea id="arc-prose" rows="3">Measured 39 of 39 renderer modules at 0 ULP parity against the C++23 reference with 4 planted fault controls.</textarea></label>
  <div class="arc-grid">
    <label class="arc-field"><span>Measured Err</span><input id="arc-meas" type="number" step="0.005" value="0.012"></label>
    <label class="arc-field"><span>Tolerance</span><input id="arc-tol" type="number" step="0.005" value="0.050"></label>
    <label class="arc-field"><span>Planted Control Err</span><input id="arc-ctrl" type="number" step="0.005" value="0.140"></label>
  </div>
  <p class="arc-readout" id="arc-oracle-out" role="status" aria-live="polite"></p>
</div>
<div class="arc-pane" data-arc-pane="cluster" hidden>
  <label class="arc-field"><span>CMMNS / Gather provenance chunk input</span><textarea id="arc-chunks" rows="2">Superframe 0.4.0 | Flywheel 2.1.0 | CMMNS 3.11.0 | BuildOS-2.2 Zero-C 5-ISA</textarea></label>
  <div class="arc-grid">
    <label class="arc-field"><span>Cluster Size (4..16 nodes) <output id="arc-n-o">7</output></span><input id="arc-nodes-n" type="range" min="4" max="16" value="7"></label>
  </div>
  <div class="arc-nodes" id="arc-nodes" role="group" aria-label="Toggle Byzantine node faults"></div>
  <p class="arc-readout" id="arc-cluster-out" role="status" aria-live="polite"></p>
</div>
<div class="arc-pane" data-arc-pane="audio" hidden>
  <div class="arc-grid">
    <label class="arc-field"><span>Carrier Hz <output id="arc-freq-o">220 Hz</output></span><input id="arc-freq" type="range" min="110" max="880" value="220"></label>
    <label class="arc-field"><span>Mod Index <output id="arc-mod-o">2.4</output></span><input id="arc-mod" type="range" min="0" max="80" value="24"></label>
    <label class="arc-field"><span>Ratio <output id="arc-rat-o">2.0</output></span><input id="arc-rat" type="range" min="5" max="60" value="20"></label>
  </div>
  <button type="button" class="arc-btn" id="arc-play">Play BuildLang FM Tone</button>
  <p class="arc-readout" id="arc-audio-out" role="status" aria-live="polite">Muted until Play is pressed. Synthesized via harmonic_fm_sample in supertool_kernel.wasm.</p>
</div>`;
  host.appendChild(root);

  // Tab switching
  root.querySelectorAll("[data-arc-tab]").forEach((btn) => btn.addEventListener("click", () => {
    const k = btn.dataset.arcTab;
    root.querySelectorAll("[data-arc-tab]").forEach((b) => b.setAttribute("aria-selected", String(b === btn)));
    root.querySelectorAll("[data-arc-pane]").forEach((p) => { p.hidden = p.dataset.arcPane !== k; });
  }));

  // 1. Superframe + RAW Live Renderer
  const off = typeof document !== "undefined" ? document.createElement("canvas") : null;
  if (off) { off.width = 160; off.height = 90; }
  const updateRender = () => {
    const sunElev = +root.querySelector("#arc-sun").value / 100;
    const roughness = +root.querySelector("#arc-rough").value / 100;
    const iorA = +root.querySelector("#arc-ior").value / 100;
    const kmK = +root.querySelector("#arc-km").value / 100;
    const splitPct = +root.querySelector("#arc-split").value;
    root.querySelector("#arc-sun-o").textContent = sunElev.toFixed(2);
    root.querySelector("#arc-rough-o").textContent = roughness.toFixed(2);
    root.querySelector("#arc-ior-o").textContent = iorA.toFixed(3);
    root.querySelector("#arc-km-o").textContent = kmK.toFixed(2);
    root.querySelector("#arc-split-o").textContent = `${splitPct}%`;

    const res = renderSuperframeToRgba(wasm, { width: 160, height: 90, sunElev, roughness, iorA, kmK, splitPct });
    if (canvas && off) {
      const octx = off.getContext("2d");
      const cctx = canvas.getContext("2d");
      if (octx && cctx && typeof ImageData !== "undefined") {
        octx.putImageData(new ImageData(res.rgba, res.width, res.height), 0, 0);
        cctx.imageSmoothingEnabled = true;
        cctx.drawImage(off, 0, 0, canvas.width, canvas.height);
      }
    }
    const ior550 = wasm ? wasm.cauchy_ior(0.55, iorA, 0.0042).toFixed(4) : (iorA + 0.0042 / 0.3025).toFixed(4);
    const ndf = wasm ? wasm.ggx_ndf(1.0, roughness).toFixed(3) : "1.000";
    const ray = wasm ? wasm.sky_rayleigh_phase(Math.max(-1, Math.min(1, sunElev))).toFixed(4) : "0.0640";
    root.querySelector("#arc-render-out").textContent =
      `WASM Live | IOR(550nm)=${ior550} | GGX=${ndf} | Rayleigh=${ray} | Ref-vs-Fast RMSE=${res.rmse.toFixed(4)} | FLIP~${res.flipProxy.toFixed(4)}`;
  };
  ["#arc-sun", "#arc-rough", "#arc-ior", "#arc-km", "#arc-split"].forEach((s) =>
    root.querySelector(s)?.addEventListener("input", updateRender)
  );
  updateRender();

  // 2. Flywheel + Articulate Live Oracle
  const updateOracle = async () => {
    const prose = root.querySelector("#arc-prose").value;
    const meas = +root.querySelector("#arc-meas").value;
    const tol = +root.querySelector("#arc-tol").value;
    const ctrl = +root.querySelector("#arc-ctrl").value;
    const { emDashes, fillerHits, wordCount } = analyzeProse(prose);
    const slop = (wasm && typeof wasm.articulate_slop_score === "function")
      ? wasm.articulate_slop_score(emDashes, fillerHits, wordCount)
      : (wordCount > 0 ? Math.min(100, Math.floor(((emDashes * 15 + fillerHits * 8) * 100) / wordCount)) : 0);
    const vcode = (wasm && typeof wasm.flywheel_verdict === "function")
      ? wasm.flywheel_verdict(meas, tol, ctrl)
      : (ctrl <= tol ? -1 : (meas <= tol ? 1 : 0));
    const vlabel = verdictLabel(vcode);
    const digest = await sha256Hex(`${vlabel}|${meas}|${tol}|${ctrl}|${slop}|${prose}`);
    root.querySelector("#arc-oracle-out").textContent =
      `Verdict: ${vlabel} | Articulate Slop: ${slop}/100 (words=${wordCount}, filler=${fillerHits}, em=${emDashes}) | Receipt SHA-256: ${digest.slice(0, 16)}...`;
  };
  ["#arc-prose", "#arc-meas", "#arc-tol", "#arc-ctrl"].forEach((s) =>
    root.querySelector(s)?.addEventListener("input", updateOracle)
  );
  updateOracle();

  // 3. CMMNS + Gather + BuildOS-2.2 Live Cluster
  const faulty = new Set();
  const nodesHost = root.querySelector("#arc-nodes");
  const updateCluster = () => {
    const text = root.querySelector("#arc-chunks").value;
    const total = +root.querySelector("#arc-nodes-n").value;
    root.querySelector("#arc-n-o").textContent = String(total);
    const mk = chunkAndMerkle(text, wasm, 24);
    const bft = computeBftState(faulty, total, wasm);
    nodesHost.innerHTML = Array.from({ length: total }, (_, i) => {
      const isFault = faulty.has(i);
      return `<button type="button" class="arc-node" data-node="${i}" aria-pressed="${isFault}">N${i + 1}:${isFault ? "FLT" : "OK"}</button>`;
    }).join("");
    root.querySelector("#arc-cluster-out").textContent =
      `Merkle Root: ${mk.rootHex} (${mk.chunks.length} chunks) | BuildOS-2.2 BFT: ${bft.status} (${bft.agree}/${bft.total} honest, f_max=${bft.maxFaults})`;
  };
  nodesHost.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-node]");
    if (!btn) return;
    const idx = +btn.dataset.node;
    if (faulty.has(idx)) faulty.delete(idx); else faulty.add(idx);
    updateCluster();
  });
  root.querySelector("#arc-chunks")?.addEventListener("input", updateCluster);
  root.querySelector("#arc-nodes-n")?.addEventListener("input", updateCluster);
  updateCluster();

  // 4. BuildLang Live Audio FM Synth
  let audioCtx = null;
  let activeSource = null;
  const updateAudioLabels = () => {
    root.querySelector("#arc-freq-o").textContent = `${root.querySelector("#arc-freq").value} Hz`;
    root.querySelector("#arc-mod-o").textContent = (+root.querySelector("#arc-mod").value / 10).toFixed(1);
    root.querySelector("#arc-rat-o").textContent = (+root.querySelector("#arc-rat").value / 10).toFixed(1);
  };
  ["#arc-freq", "#arc-mod", "#arc-rat"].forEach((s) =>
    root.querySelector(s)?.addEventListener("input", updateAudioLabels)
  );
  root.querySelector("#arc-play")?.addEventListener("click", () => {
    const freqHz = +root.querySelector("#arc-freq").value;
    const modIndex = +root.querySelector("#arc-mod").value / 10;
    const ratio = +root.querySelector("#arc-rat").value / 10;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) {
      root.querySelector("#arc-audio-out").textContent = "WebAudio unavailable in this environment.";
      return;
    }
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume().catch(() => {});
    if (activeSource) { try { activeSource.stop(); } catch (_) {} activeSource = null; }
    const samples = synthesizeFmBuffer(wasm, { freqHz, modIndex, ratio, sampleRate: audioCtx.sampleRate, durationSec: 0.65 });
    const buf = audioCtx.createBuffer(1, samples.length, audioCtx.sampleRate);
    buf.getChannelData(0).set(samples);
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    activeSource = src;
    root.querySelector("#arc-audio-out").textContent =
      `Playing WASM FM tone: ${freqHz} Hz, mod=${modIndex.toFixed(1)}, ratio=${ratio.toFixed(1)} (${samples.length} samples).`;
  });

  return {
    destroy() {
      if (activeSource) { try { activeSource.stop(); } catch (_) {} activeSource = null; }
      if (audioCtx) { try { audioCtx.close(); } catch (_) {} audioCtx = null; }
      host.innerHTML = "";
    },
  };
}
